// Upload an episode to YouTube, using the metadata already written in
// episode.json. Resumable, so a dropped connection resumes rather than restarts.
//
//   node lib/youtube-upload.mjs <episode-dir> [--public|--unlisted] [--dry-run]
//
// Defaults to private. An unverified OAuth app has its uploads forced private by
// Google regardless of what is requested, so the honest default is private and
// the realistic flow is: upload here, flip to public in Studio.

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync, createReadStream, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const CLIENT = process.env.YT_OAUTH_CLIENT || 'D:/Projects/tempTestKeys/youtube-oauth-client.json';
const TOKEN = process.env.YT_OAUTH_TOKEN || 'D:/Projects/tempTestKeys/youtube-token.json';
const CATEGORY_EDUCATION = '27';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const epDir = resolve(args.find(a => !a.startsWith('--')) || '');
const at = (...p) => join(epDir, ...p);

const privacy = flags.has('--public') ? 'public' : flags.has('--unlisted') ? 'unlisted' : 'private';

if (!existsSync(at('episode.json'))) { console.error(`No episode.json in ${epDir}`); process.exit(2); }
if (!existsSync(TOKEN)) { console.error(`No token at ${TOKEN}. Run: node lib/youtube-auth.mjs`); process.exit(2); }

const ep = JSON.parse(readFileSync(at('episode.json'), 'utf8'));
const meta = ep.publish?.youtube;
if (!meta?.title) { console.error('episode.json has no publish.youtube.title'); process.exit(2); }

const video = at('out.mp4');
if (!existsSync(video)) {
  console.error(`No out.mp4 — it is gitignored because it is reproducible.\nRun: node lib/build.mjs ${epDir}`);
  process.exit(2);
}

const { installed } = JSON.parse(readFileSync(CLIENT, 'utf8'));
const tokens = JSON.parse(readFileSync(TOKEN, 'utf8'));
const oauth = new google.auth.OAuth2(installed.client_id, installed.client_secret, 'http://127.0.0.1');
oauth.setCredentials(tokens);
const yt = google.youtube({ version: 'v3', auth: oauth });

const size = statSync(video).size;
console.log(`episode : ${ep.slug} (${ep.set})`);
console.log(`title   : ${meta.title}`);
console.log(`tags    : ${(meta.tags || []).join(', ')}`);
console.log(`privacy : ${privacy}`);
console.log(`file    : ${(size / 1024 / 1024).toFixed(1)} MB`);
console.log(`channel : ${tokens.channelTitle} (${tokens.channelId})`);
if (flags.has('--dry-run')) { console.log('\ndry run — nothing uploaded'); process.exit(0); }

let shown = -1;
const res = await yt.videos.insert(
  {
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: meta.title,
        description: meta.description || '',
        tags: meta.tags || [],
        categoryId: CATEGORY_EDUCATION,
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en',
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,   // these are not children's content
        embeddable: true,
      },
    },
    media: { body: createReadStream(video) },
  },
  {
    onUploadProgress: (e) => {
      const pct = Math.round((e.bytesRead / size) * 100);
      if (pct >= shown + 10) { shown = pct; process.stdout.write(`\r  uploading ${pct}%`); }
    },
  },
);

const id = res.data.id;
const url = `https://www.youtube.com/watch?v=${id}`;
console.log(`\n${url}`);
console.log(`status: ${res.data.status?.privacyStatus}${res.data.status?.uploadStatus ? ' / ' + res.data.status.uploadStatus : ''}`);

// Record it, so catalog.json and episode.json stay the source of truth.
ep.status = 'published';
ep.publish.youtube.videoId = id;
ep.publish.youtube.url = url;
ep.publish.youtube.uploadedAt = new Date().toISOString().slice(0, 10);
writeFileSync(at('episode.json'), JSON.stringify(ep, null, 2) + '\n');

const catalogPath = resolve(epDir, '../../../catalog.json');
if (existsSync(catalogPath)) {
  const cat = JSON.parse(readFileSync(catalogPath, 'utf8'));
  for (const s of cat.sets || []) {
    for (const e of s.episodes || []) {
      if (e.slug === ep.slug) { e.status = 'published'; e.url = url; }
    }
  }
  writeFileSync(catalogPath, JSON.stringify(cat, null, 2) + '\n');
}
console.log('episode.json and catalog.json updated — commit them.');
