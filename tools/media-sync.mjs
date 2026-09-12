// Push an episode's media to the media store and record what went where.
//
//   node tools/media-sync.mjs push <episode-dir>     upload + write media.json
//   node tools/media-sync.mjs pull <episode-dir>     fetch everything media.json lists
//   node tools/media-sync.mjs check <episode-dir>    verify local files against it
//   node tools/media-sync.mjs status                 every episode at a glance
//
// The repository is text only. Every binary lives in Drive, and each episode's
// media.json is the index: relative path, bytes, sha256, and the remote path.
// That file IS tracked, so a fresh clone knows exactly what it is missing and
// can prove what it fetched is what was uploaded.
//
// Archives per category rather than per file. Drive charges an API round trip
// per file and an episode is ~150 of them; at ten videos a week that is the
// difference between a sync that takes seconds and one that takes an hour.

import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join, relative, basename } from 'node:path';

const REMOTE = process.env.MEDIA_REMOTE || 'gdrive:DrawnExplainers';
const RCLONE = process.env.RCLONE
  || 'C:/Users/ronit/AppData/Local/Microsoft/WinGet/Packages/Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe/rclone-v1.75.1-windows-amd64/rclone.exe';

// What goes to the media store, grouped into one archive each. Order matters
// only for reporting.
const GROUPS = [
  { name: 'audio', match: f => f === 'music.wav' || f.startsWith('assets/syncvoice/audio/'),
    why: 'irreplaceable - Lyria has no seed, Gemini TTS is not deterministic' },
  { name: 'render', match: f => ['out.mp4', 'narration.wav', 'mixed.wav'].includes(f),
    why: 'regenerable: node lib/build.mjs <ep>' },
  { name: 'veo', match: f => /face-only-video/.test(f) && !/-muted\//.test(f),
    why: 'irreplaceable - Google video generation, costs money, never identical' },
  { name: 'clips', match: f => f.startsWith('out-clips-talking-face'),
    why: 'regenerable: node tools/make-speech-clips-v3.mjs, then mute/derive passes' },
  { name: 'vertical', match: f => f.startsWith('vertical-notebook/'),
    why: 'regenerable: tools/Notebook-Compositor' },
];

const sh = (args, opts = {}) => execFileSync(RCLONE, args, { encoding: 'utf8', ...opts });
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 32);
const mb = b => (b / 1024 / 1024).toFixed(1);

// Transient by nature: rewritten every run, meaningless to restore, and if they
// are counted they leave every episode permanently showing "not backed up",
// which trains you to ignore the one message that matters.
const TRANSIENT = f => f.startsWith('.media-tmp/') || f.endsWith('.syncvoice/generation-state.json')
  || f.startsWith('preview/');

function listLocal(epDir) {
  const out = execSync('git ls-files --others --ignored --exclude-standard', { cwd: epDir, encoding: 'utf8' });
  return out.split('\n').map(s => s.trim()).filter(Boolean)
    .filter(f => !TRANSIENT(f))
    .filter(f => existsSync(join(epDir, f)));
}

function push(epDir) {
  const slug = basename(epDir);
  const files = listLocal(epDir);
  if (!files.length) { console.log(`${slug}: nothing to push`); return; }

  const manifest = { slug, remote: `${REMOTE}/${slug}`, updated: new Date().toISOString().slice(0, 10), groups: {} };
  const tmp = join(epDir, '.media-tmp');
  mkdirSync(tmp, { recursive: true });

  for (const g of GROUPS) {
    const members = files.filter(g.match);
    if (!members.length) continue;
    const rel = `.media-tmp/${g.name}.tar`;
    const tar = join(epDir, rel);
    const listRel = `.media-tmp/${g.name}.files`;
    writeFileSync(join(epDir, listRel), members.map(m => m + '\n').join(''));
    execSync(`tar -cf "${rel}" -T "${listRel}"`, { cwd: epDir });
    const size = statSync(tar).size;
    console.log(`  ${slug}/${g.name}.tar  ${mb(size)} MB  (${members.length} files)  uploading...`);
    sh(['copyto', tar, `${REMOTE}/${slug}/${g.name}.tar`, '--drive-chunk-size', '64M'], { stdio: 'inherit' });
    manifest.groups[g.name] = {
      why: g.why,
      archive: `${g.name}.tar`,
      bytes: size,
      sha256: sha(tar),
      files: members.sort(),
    };
  }
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(epDir, 'media.json'), JSON.stringify(manifest, null, 2) + '\n');
  const total = Object.values(manifest.groups).reduce((a, g) => a + g.bytes, 0);
  console.log(`${slug}: ${Object.keys(manifest.groups).length} archives, ${mb(total)} MB -> media.json written (commit it)`);
}

function pull(epDir) {
  const slug = basename(epDir);
  const mPath = join(epDir, 'media.json');
  if (!existsSync(mPath)) { console.error(`${slug}: no media.json — nothing to pull`); process.exitCode = 1; return; }
  const manifest = JSON.parse(readFileSync(mPath, 'utf8'));
  const tmp = join(epDir, '.media-tmp');
  mkdirSync(tmp, { recursive: true });
  for (const [name, g] of Object.entries(manifest.groups)) {
    const rel = `.media-tmp/${g.archive}`;
    const tar = join(epDir, rel);
    console.log(`  ${slug}/${g.archive}  ${mb(g.bytes)} MB  downloading...`);
    sh(['copyto', `${manifest.remote}/${g.archive}`, tar], { stdio: 'inherit' });
    const got = sha(tar);
    if (got !== g.sha256) {
      console.error(`  CHECKSUM MISMATCH on ${name}: manifest ${g.sha256}, downloaded ${got}`);
      process.exitCode = 1;
      continue;
    }
    execSync(`tar -xf "${rel}"`, { cwd: epDir });
    console.log(`  ${name}: ${g.files.length} files restored, checksum verified`);
  }
  rmSync(tmp, { recursive: true, force: true });
}

/**
 * Both directions matter, and they mean opposite things.
 *
 * Listed but absent is a clone that has not pulled yet — harmless, fixable.
 * Present but unlisted is media that exists only on this disk and is in no
 * backup. While episodes are still being generated that is the normal state
 * after every run, and it is the one worth shouting about.
 */
function check(epDir) {
  const slug = basename(epDir);
  const mPath = join(epDir, 'media.json');
  const onDisk = listLocal(epDir);
  if (!existsSync(mPath)) {
    console.log(onDisk.length
      ? `${slug}: NO MANIFEST and ${onDisk.length} media file(s) on disk — nothing is backed up. push it.`
      : `${slug}: no media, no manifest`);
    return;
  }
  const manifest = JSON.parse(readFileSync(mPath, 'utf8'));
  const listed = new Set(Object.values(manifest.groups).flatMap(g => g.files));
  const missing = [...listed].filter(f => !existsSync(join(epDir, f)));
  const unlisted = onDisk.filter(f => !listed.has(f));

  if (!missing.length && !unlisted.length) {
    console.log(`${slug}: ${listed.size} files, all present and all backed up (pushed ${manifest.updated})`);
    return;
  }
  if (unlisted.length) {
    console.log(`${slug}: ${unlisted.length} file(s) on disk are in NO archive — not backed up:`);
    for (const f of unlisted.slice(0, 3)) console.log(`    ${f}`);
    if (unlisted.length > 3) console.log(`    ... and ${unlisted.length - 3} more`);
    console.log(`    fix: node tools/media-sync.mjs push ${epDir}`);
  }
  if (missing.length) {
    console.log(`${slug}: ${missing.length} file(s) listed in media.json are not on disk`);
    console.log(`    fix: node tools/media-sync.mjs pull ${epDir}`);
  }
}

const [cmd, target] = process.argv.slice(2);
const eps = () => execSync('git ls-files "sets/*/*/episode.json"', { encoding: 'utf8' })
  .split('\n').filter(Boolean).map(f => resolve(f, '..'));

if (cmd === 'push' && target) push(resolve(target));
else if (cmd === 'pull' && target) pull(resolve(target));
else if (cmd === 'check' && target) check(resolve(target));
else if (cmd === 'status') for (const d of eps()) check(d);
else {
  console.error('usage: node tools/media-sync.mjs push|pull|check <episode-dir>');
  console.error('       node tools/media-sync.mjs status');
  process.exit(2);
}
