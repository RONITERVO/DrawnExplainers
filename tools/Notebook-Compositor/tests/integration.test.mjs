/** Real FFmpeg integration tests. Synthetic media only; never your episode media.
 * Set VERTICAL_TEST_DIR to retain an explicit test directory for inspecting logs.
 * Run: node --test tests/integration.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, statSync, copyFileSync,
  rmSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir, hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'tools', 'make-vertical-notebook.mjs');
const base = process.env.VERTICAL_TEST_DIR ? resolve(process.env.VERTICAL_TEST_DIR) : mkdtempSync(join(tmpdir(), "Vertical cafe's test "));
mkdirSync(base, { recursive: true });
const episode = join(base, "episode 2 – café's notebook");
const original = join(episode, 'originals'), narrator = join(episode, 'narrator'), masks = join(episode, 'masks');
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg', ffprobe = process.env.FFPROBE ?? 'ffprobe';
function command(exe, args, { expect = 0, binary = false } = {}) {
  const r = spawnSync(exe, args, { encoding: binary ? null : 'utf8', shell: false,
    windowsHide: true, timeout: 180000, maxBuffer: 128 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== expect) throw new Error(`${exe} ${JSON.stringify(args)}\nExit ${r.status}, expected ${expect}\n${String(r.stdout).slice(-8000)}\n${String(r.stderr).slice(-16000)}`);
  return r;
}
function ff(args, opts) { return command(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_threads', '1', '-filter_complex_threads', '1', ...args], opts); }
function probe(p) { return JSON.parse(command(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', p]).stdout); }
function run(extra = [], opts) {
  return command(process.execPath, [script, '--episode', episode, '--original-dir', 'originals',
    '--narrator-dir', 'narrator', '--mask-dir', 'masks', '--threads', '2', '--filter-threads', '1',
    '--preset', 'ultrafast', '--ffmpeg', ffmpeg, '--ffprobe', ffprobe, ...extra], opts);
}
function writeJSON(p, v) { writeFileSync(p, JSON.stringify(v, null, 2)); }
function rawFrame(p, frame, crop) {
  const filter = `select=eq(n\\,${frame})${crop ? `,crop=${crop}` : ''},format=rgb24`;
  return ff(['-i', p, '-vf', filter, '-frames:v', '1', '-c:v', 'rawvideo', '-threads:v', '1', '-f', 'rawvideo', 'pipe:1'], { binary: true }).stdout;
}
function audio(p) { return ff(['-i', p, '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'], { binary: true }).stdout; }
function meanAbsDiff(a, b) { assert.equal(a.length, b.length); let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length; }
function rmsPCM(b, start, end) { let sum = 0; const n = Math.min(end, b.length / 4); for (let i = start; i < n; i++) sum += b.readFloatLE(i * 4) ** 2; return Math.sqrt(sum / (n - start)); }
function tonePower(b, hz) {
  let re = 0, im = 0; const n = Math.min(48000, b.length / 4);
  for (let i = 0; i < n; i++) { const v = b.readFloatLE(i * 4), a = i * 2 * Math.PI * hz / 48000; re += v * Math.cos(a); im += v * Math.sin(a); }
  return Math.hypot(re, im) / n;
}
const manifest = {
  source: 'out.mp4', settings: { headMs: 0, gapMs: 0, fps: 30 },
  clips: [
    { index: 1, filename: '001__source.mp4', startMs: 0, endMs: 1467, durationMs: 1467, text: "Café's ink: 100%." },
    { index: 2, filename: '002__source.mp4', startMs: 1467, endMs: 3000, durationMs: 1533, text: 'Words stay still.' },
  ],
};
const timing = { scene: { durationMs: 3000, script: "Café's ink: 100%. Words stay still.", words: [
  { word: "Café's", startMs: 180, endMs: 500 }, { word: 'ink:', startMs: 500, endMs: 900 },
  { word: '100%.', startMs: 900, endMs: 1300 }, { word: 'Words', startMs: 1540, endMs: 1900 },
  { word: 'stay', startMs: 1900, endMs: 2300 }, { word: 'still.', startMs: 2300, endMs: 2850 },
] } };

await test('setup: synthetic notebook drawing, authoritative 440Hz audio and silent/voiced narrators', () => {
  for (const p of [episode, original, narrator, masks]) mkdirSync(p, { recursive: true });
  writeJSON(join(original, 'clip-index.json'), manifest); writeJSON(join(episode, 'timing.json'), timing);
  // Moving original helps catch accidental center replacement/freeze in later tests.
  ff(['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3',
    '-c:v', 'libx264', '-crf', '0', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'alac', '-ac', '2', join(episode, 'out.mp4')]);
  ff(['-f', 'lavfi', '-i', 'color=c=0xdc3322:s=320x180:r=30:d=0.7', '-f', 'lavfi', '-i', 'sine=frequency=9000:sample_rate=48000:duration=0.7',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', join(narrator, '001__red.mp4')]);
  ff(['-f', 'lavfi', '-i', 'color=c=0xdc3322:s=320x180:r=30:d=1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', join(narrator, '002__red.mp4')]);
  // Transparent RGBA character input with a visible red square, encoded as qtrle.
  const rgba = Buffer.alloc(320 * 180 * 4), mask = Buffer.alloc(320 * 180);
  for (let y = 40; y < 140; y++) for (let x = 120; x < 200; x++) {
    const i = (y * 320 + x) * 4; rgba[i] = 220; rgba[i + 1] = 51; rgba[i + 2] = 34; rgba[i + 3] = 255; mask[y * 320 + x] = 255;
  }
  writeFileSync(join(base, 'character.rgba'), rgba);
  writeFileSync(join(base, 'mask.gray'), mask);
  ff(['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', '320x180', '-framerate', '30', '-i', join(base, 'character.rgba'),
    '-frames:v', '1', join(base, 'character.png')]);
  ff(['-loop', '1', '-framerate', '30', '-i', join(base, 'character.png'), '-t', '1', '-c:v', 'qtrle', '-pix_fmt', 'argb', join(base, 'alpha.mov')]);
  ff(['-f', 'rawvideo', '-pixel_format', 'gray', '-video_size', '320x180', '-i', join(base, 'mask.gray'), '-frames:v', '1', join(masks, '001.png')]);
  ff(['-loop', '1', '-i', join(base, 'character.png'), '-f', 'lavfi', '-i', 'color=white:s=320x180:r=30:d=1',
    '-filter_complex', '[1:v][0:v]overlay=shortest=1', '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', join(base, 'white.mp4')]);
  console.log(`Integration fixtures: ${base}`);
});
await test('data-only and dry-run preflights work without creating output directories', () => {
  run(['--check-data']); run(['--dry-run']);
  assert.equal(existsSync(join(episode, 'vertical-notebook')), false);
});
await test('actual 1080x1920 two-clip render: 44 + 46 frames, joined video 90 frames', () => {
  const result = run(['--crf', '18']);
  writeFileSync(join(base, 'render-1080.log'), result.stdout + result.stderr);
  const output = join(episode, 'vertical-notebook');
  const a = probe(join(output, '001__top.mp4')), b = probe(join(output, '002__bottom.mp4')), full = probe(join(output, 'vertical-full.mp4'));
  assert.equal(a.streams[0].width, 1080); assert.equal(a.streams[0].height, 1920);
  assert.equal(Number(a.streams[0].nb_read_frames), 44); assert.equal(Number(b.streams[0].nb_read_frames), 46);
  assert.equal(Number(full.streams[0].nb_read_frames), 90); assert.equal(Number(full.streams[0].duration), 3);
  assert.equal(full.streams[1].codec_name, 'aac'); assert.equal(full.streams[1].channels, 2);
  assert.equal(JSON.parse(readFileSync(join(output, 'vertical-index.json'))).status, 'complete');
});
await test('joined audio follows original 440Hz, never the narrator 9000Hz', () => {
  const b = audio(join(episode, 'vertical-notebook', 'vertical-full.mp4'));
  assert.ok(tonePower(b, 440) > 0.04); assert.ok(tonePower(b, 9000) < 0.0001);
});
await test('the central drawing matches the independent reference through movement and the join', () => {
  const out = join(episode, 'vertical-notebook', 'vertical-full.mp4');
  // Reference follows exactly the compositor's declared contain/color conversion.
  const ref = join(base, 'reference.mp4');
  ff(['-i', join(episode, 'out.mp4'), '-vf', 'format=rgb24,scale=1056:594:flags=lanczos,setsar=1,pad=1080:608:12:7:color=0xebe4db,scale=iw:ih:in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '0', ref]);
  for (const frame of [0, 10, 30, 43, 44, 55, 89]) {
    const actual = rawFrame(out, frame, '1080:608:0:656'), expected = rawFrame(ref, frame);
    assert.ok(meanAbsDiff(actual, expected) < 3, `center differs from reference at frame ${frame}`);
  }
});
await test('resume reuses validated unchanged outputs; damaged cache is rebuilt', () => {
  const dest = join(episode, 'vertical-notebook', '001__top.mp4'), before = statSync(dest).mtimeMs;
  const r = run(['--crf', '18']); assert.ok(r.stdout.includes('verified video cache'));
  assert.equal(statSync(dest).mtimeMs, before);
  const video = join(episode, 'vertical-notebook', 'work', 'clip00001', 'video.mp4');
  writeFileSync(video, 'deliberately truncated');
  run(['--crf', '18']); assert.ok(statSync(video).size > 1000);
});
await test('changed config without --overwrite fails without modifying good MP4', () => {
  const p = join(episode, 'vertical-notebook', '001__top.mp4'), m = statSync(p).mtimeMs;
  const r = run(['--font-size', '53'], { expect: 1 }); assert.match(r.stderr, /Refusing to overwrite/);
  assert.equal(statSync(p).mtimeMs, m);
});
await test('alpha narrator render and mask narrator render succeed (270x480 fast fixtures)', () => {
  copyFileSync(join(base, 'alpha.mov'), join(narrator, '001__alpha.mov'));
  const config = { version: 3, canvas: { width: 270, height: 480 }, text: { fontSize: 18, margin: 16 },
    narrator: { panelMargin: 8 }, clips: { '1': { narratorFilename: '001__alpha.mov' } } };
  writeJSON(join(episode, 'alpha.json'), config);
  run(['--config', 'alpha.json', '--only', '1', '--no-join', '--narrator-mode', 'alpha', '--output-dir', 'alpha-output']);
  assert.equal(Number(probe(join(episode, 'alpha-output', '001__top.mp4')).streams[0].nb_read_frames), 44);
  config.clips['1'].narratorFilename = '001__red.mp4'; writeJSON(join(episode, 'mask.json'), config);
  run(['--config', 'mask.json', '--only', '1', '--no-join', '--narrator-mode', 'mask', '--output-dir', 'mask-output']);
  const a = rawFrame(join(episode, 'alpha-output', '001__top.mp4'), 20, '270:164:0:0');
  const b = rawFrame(join(episode, 'mask-output', '001__top.mp4'), 20, '270:164:0:0');
  assert.ok(meanAbsDiff(a, b) < 4, 'external matte and embedded alpha should give similar plate removal');
});
await test('opaque input is not silently accepted as an alpha input', () => {
  const r = run(['--config', 'mask.json', '--only', '1', '--no-join', '--narrator-mode', 'alpha', '--output-dir', 'bad-alpha'], { expect: 1 });
  assert.match(r.stderr, /no alpha-capable/);
});
await test('colorkey mode and loop duration policy execute without early EOF', () => {
  copyFileSync(join(base, 'white.mp4'), join(narrator, '001__white.mp4'));
  const c = JSON.parse(readFileSync(join(episode, 'mask.json'))); c.clips['1'].narratorFilename = '001__white.mp4';
  writeJSON(join(episode, 'key.json'), c);
  run(['--config', 'key.json', '--only', '1', '--no-join', '--narrator-mode', 'colorkey', '--narrator-policy', 'loop', '--output-dir', 'key-output']);
  assert.equal(Number(probe(join(episode, 'key-output', '001__top.mp4')).streams[0].nb_read_frames), 44);
});
await test('text pagination uses measured glyph bounds and does not cover the drawing', () => {
  const c = JSON.parse(readFileSync(join(episode, 'mask.json')));
  c.text.fontSize = 60; c.text.margin = 8; c.canvas = { width: 270, height: 480, centerHeight: 152 };
  c.transition = { seconds: 0 }; writeJSON(join(episode, 'pages.json'), c);
  run(['--config', 'pages.json', '--only', '1', '--no-join', '--output-dir', 'pages-output']);
  const layout = JSON.parse(readFileSync(join(episode, 'pages-output', 'work', 'clip00001', 'text-layout.json')));
  assert.ok(layout.pages.length >= 2, 'oversize paragraph should be paginated, not merely clipped');
  for (const p of layout.pages) assert.equal(p.bounds.fits, true);
});
await test('explicit clips fallback joins PCM, not independently encoded AAC', () => {
  for (const [i, start, duration] of [[1, 0, 44 / 30], [2, 44 / 30, 46 / 30]]) {
    ff(['-ss', String(start), '-i', join(episode, 'out.mp4'), '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'alac', join(original, `00${i}__source.mp4`)]);
  }
  const c = JSON.parse(readFileSync(join(episode, 'mask.json'))); c.audio = { codec: 'alac' };
  writeJSON(join(episode, 'clips.json'), c);
  run(['--config', 'clips.json', '--source-mode', 'clips', '--output-dir', 'clips-output']);
  const p = probe(join(episode, 'clips-output', 'vertical-full.mp4'));
  assert.equal(Number(p.streams[0].nb_read_frames), 90); assert.equal(p.streams[1].codec_name, 'alac');
  const raw = audio(join(episode, 'clips-output', 'vertical-full.mp4')); assert.equal(raw.length / 4, 144000);
});
await test('missing original audio fails before rendering', () => {
  ff(['-i', join(episode, 'out.mp4'), '-map', '0:v:0', '-c:v', 'copy', '-an', join(episode, 'silent-original.mp4')]);
  const r = run(['--config', 'mask.json', '--master', 'silent-original.mp4', '--only', '1', '--no-join', '--output-dir', 'bad-audio'], { expect: 1 });
  assert.match(r.stderr, /required original audio/);
  assert.equal(existsSync(join(episode, 'bad-audio')), false);
});
await test('live output lock is not stolen', () => {
  const d = join(episode, 'locked-output'); mkdirSync(d, { recursive: true });
  writeJSON(join(d, 'render.lock.json'), { pid: process.pid, host: hostname(), token: 'test' });
  const r = run(['--config', 'mask.json', '--only', '1', '--no-join', '--output-dir', 'locked-output'], { expect: 1 });
  assert.match(r.stderr, /locked/);
});
await test('rational 30000/1001 FPS uses continuous sample rounding across the join', () => {
  run(['--config', 'clips.json', '--fps', '30000/1001', '--output-dir', 'rational-output']);
  const p = probe(join(episode, 'rational-output', 'vertical-full.mp4'));
  assert.equal(Number(p.streams[0].nb_read_frames), 90);
  assert.equal(p.streams[0].avg_frame_rate, '30000/1001');
  assert.equal(audio(join(episode, 'rational-output', 'vertical-full.mp4')).length / 4, 144144);
});
await test('a positive original-audio timestamp offset remains silence, not a sync shift', () => {
  ff(['-i', join(episode, 'out.mp4'), '-itsoffset', '0.2', '-i', join(episode, 'out.mp4'),
    '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', join(episode, 'delayed.mp4')]);
  run(['--config', 'clips.json', '--master', 'delayed.mp4', '--output-dir', 'delayed-output']);
  const b = audio(join(episode, 'delayed-output', 'vertical-full.mp4'));
  assert.equal(b.length / 4, 144000);
  assert.ok(rmsPCM(b, 0, 9000) < 1e-6, 'first 187.5ms must remain silent');
  assert.ok(rmsPCM(b, 12000, 24000) > 0.04, 'original tone must begin after the offset');
});
await test('same-page type-on keeps the already-visible prefix at fixed pixel coordinates', () => {
  const p = join(episode, 'vertical-notebook', '001__top.mp4');
  // Compare the first letter after it appears and once the whole first word appears.
  // Use a loss-tolerant crop because standalone output is H.264, not a text raster.
  const layout = JSON.parse(readFileSync(join(episode, 'vertical-notebook', 'work', 'clip00001', 'text-layout.json')));
  const first = layout.pages[0];
  const crop = `34:58:${Math.floor(first.originX / 2) * 2}:${Math.floor((first.originY + first.bounds.top) / 2) * 2}`;
  const a = rawFrame(p, 7, crop), b = rawFrame(p, 14, crop);
  assert.ok(meanAbsDiff(a, b) < 2, 'existing first letter should not recenter or move vertically');
});
await test('per-clip grade is sampled once and locked; detailed style report is persisted', () => {
  const dir = join(episode, 'vertical-notebook', 'work', 'clip00001');
  const r = JSON.parse(readFileSync(join(dir, 'style-report.json')));
  assert.equal(r.samples.length, 5); assert.equal(r.mode, 'notebook');
  assert.ok(r.levels.black >= 0 && r.levels.black <= 0.06);
  assert.ok(r.levels.white >= 0.88 && r.levels.white <= 1);
  assert.match(r.temporalPolicy, /fixed LUT/);
  assert.ok(statSync(join(dir, 'narrator.cube')).size > 100000);
});
await test('rendered captions are inside the expected panels and safety margins in both layouts', () => {
  for (const [file, panelY] of [['001__top.mp4', 1264], ['002__bottom.mp4', 0]]) {
    const pixels = rawFrame(join(episode, 'vertical-notebook', file), 42, `1080:656:0:${panelY}`);
    let left = 1080, right = -1, top = 656, bottom = -1;
    for (let y = 0; y < 656; y++) for (let x = 0; x < 1080; x++) {
      const i = (y * 1080 + x) * 3;
      if (pixels[i] < 150 && pixels[i + 1] < 145 && pixels[i + 2] < 135) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    assert.ok(right > left, 'caption must actually be visible');
    assert.ok(left >= 94 && right <= 986 && top >= 93 && bottom < 562, `ink bounds ${left},${top}..${right},${bottom}`);
  }
});
await test('during the slide, already-revealed narrator pixels do not become globally translucent', () => {
  const output = join(episode, 'vertical-notebook', '001__top.mp4');
  const card = JSON.parse(readFileSync(join(episode, 'vertical-notebook', 'work', 'clip00001', 'style-report.json'))).card;
  const frame = 10, total = 44, transitionFrames = Math.min(18, Math.floor((total - 1) / 3));
  const u = frame / transitionFrames, e = u * u * u * (u * (u * 6 - 15) + 10);
  const hidden = 656 + (608 - card.h) / 2, shown = (656 - card.h) / 2;
  const movingY = Math.floor(hidden + (shown - hidden) * e);
  const a = rawFrame(output, frame), b = rawFrame(output, 20);
  // Solid synthetic narrator lets us compare corresponding source pixels without motion ambiguity.
  const at = (buf, y) => [...buf.subarray((y * 1080 + 540) * 3, (y * 1080 + 540) * 3 + 3)];
  const aa = at(a, movingY + 100), bb = at(b, shown + 100);
  aa.forEach((v, k) => assert.ok(Math.abs(v - bb[k]) < 5, `${aa} vs ${bb}`));
});
await test('narrator is absent at both animated endpoints while the notebook background stays unchanged', () => {
  const file = join(episode, 'vertical-notebook', '001__top.mp4');
  assert.ok(meanAbsDiff(rawFrame(file, 0, '1080:650:0:0'), rawFrame(file, 43, '1080:650:0:0')) < 1.5);
});
await test('a static mask with a positive narrator offset stays usable and synchronized', () => {
  const c = JSON.parse(readFileSync(join(episode, 'mask.json')));
  c.narrator = { ...c.narrator, mode: 'mask', offsetSeconds: 0.15 };
  writeJSON(join(episode, 'offset-mask.json'), c);
  run(['--config', 'offset-mask.json', '--only', '1', '--no-join', '--output-dir', 'offset-mask-output']);
  assert.equal(Number(probe(join(episode, 'offset-mask-output', '001__top.mp4')).streams[0].nb_read_frames), 44);
});
await test('declared wrong narrator source-cut bounds fail before any output is created', () => {
  const sidecar = join(narrator, 'narrator-index.json');
  writeJSON(sidecar, { clips: [{ index: 1, filename: '001__red.mp4', startMs: 1, endMs: 1467 }] });
  try {
    const r = run(['--config', 'mask.json', '--only', '1', '--no-join', '--output-dir', 'wrong-cut'], { expect: 1 });
    assert.match(r.stderr, /different source cut/);
    assert.equal(existsSync(join(episode, 'wrong-cut')), false);
  } finally { rmSync(sidecar); }
});
await test('unframed alpha and grade-off modes remain available without an opaque rectangle', () => {
  const c = JSON.parse(readFileSync(join(episode, 'alpha.json')));
  c.narrator = { ...c.narrator, mode: 'alpha', card: { enabled: false }, grade: { mode: 'off' } };
  writeJSON(join(episode, 'unframed.json'), c);
  run(['--config', 'unframed.json', '--only', '1', '--no-join', '--output-dir', 'unframed-output']);
  const r = JSON.parse(readFileSync(join(episode, 'unframed-output', 'work', 'clip00001', 'style-report.json')));
  assert.equal(r.mode, 'off'); assert.equal(r.samples.length, 0);
});
await test('all public synthetic MP4s fully decode with no FFmpeg errors', () => {
  for (const dir of ['vertical-notebook', 'alpha-output', 'mask-output', 'key-output', 'pages-output', 'clips-output', 'rational-output', 'delayed-output', 'offset-mask-output', 'unframed-output'])
    for (const f of readdirSync(join(episode, dir)).filter(x => x.endsWith('.mp4') && !x.includes('.partial.')))
      ff(['-v', 'error', '-xerror', '-i', join(episode, dir, f), '-f', 'null', '-']);
});
console.log(`Synthetic test artifacts retained at: ${base}`);
