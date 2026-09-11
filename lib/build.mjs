// Shared pipeline for every episode.
//
//   node lib/build.mjs <episode-dir> [--preview] [--audio] [--no-music]
//
// Frames rasterise across a worker pool and are reassembled in order before
// reaching ffmpeg's stdin, so nothing touches the disk on the way through.

import { Resvg } from '@resvg/resvg-js';
import { Worker } from 'node:worker_threads';
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FONT_FILES, FPS } from './scene-kit.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const epDir = resolve(args.find(a => !a.startsWith('--')) || '.');
const at = (...p) => join(epDir, ...p);

const { renderFrame, TOTAL_MS, SHOTS } = await import(pathToFileURL(at('scene.mjs')).href);

// ------------------------------------------------------------------ audio
function buildAudio() {
  const manifest = JSON.parse(readFileSync(at('assets/syncvoice/manifest.json'), 'utf8'));
  const byId = new Map(manifest.entries.map(e => [e.externalId, e]));
  const inputs = [];
  const filters = [];
  SHOTS.forEach((shot, i) => {
    inputs.push('-i', at('assets/syncvoice', byId.get(shot.id).audio));
    filters.push(`[${i}]adelay=${Math.round(shot.start)}[a${i}]`);
  });
  const mix = SHOTS.map((_, i) => `[a${i}]`).join('');
  const total = (TOTAL_MS / 1000).toFixed(3);
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', `${filters.join(';')};${mix}amix=inputs=${SHOTS.length}:normalize=0,apad=whole_dur=${total}[out]`,
    '-map', '[out]', '-ar', '48000', '-ac', '1', at('narration.wav'),
  ], { stdio: 'inherit' });

  const music = at('music.wav');
  if (flags.has('--no-music') || !existsSync(music)) {
    console.log('narration.wav built (no music bed)');
    return at('narration.wav');
  }
  // The bed is ducked by the narration rather than merely set quiet: sidechain
  // compression keyed on the voice keeps the music present in the gaps between
  // shots and out of the way under every spoken line.
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', at('narration.wav'), '-i', music,
    '-filter_complex', [
      `[1:a]aformat=channel_layouts=stereo,atrim=0:${total},volume=0.34,`,
      `afade=t=in:st=0:d=2.5,afade=t=out:st=${(TOTAL_MS / 1000 - 3).toFixed(2)}:d=3[bed];`,
      '[0:a]aformat=channel_layouts=stereo[voice];',
      '[voice]asplit=2[key][dry];',
      '[bed][key]sidechaincompress=threshold=0.06:ratio=9:attack=12:release=420[ducked];',
      // YouTube and TikTok normalise to about -14 LUFS, and both only turn loud
      // content down - they never lift a quiet upload. Landing on target here
      // is the difference between playing at the same volume as everything
      // else in the feed and playing noticeably under it.
      '[dry][ducked]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.97[out]',
    ].join(''),
    '-map', '[out]', '-ar', '48000', '-ac', '2', at('mixed.wav'),
  ], { stdio: 'inherit' });
  console.log('narration + Lyria bed mixed');
  return at('mixed.wav');
}

// ---------------------------------------------------------------- preview
//
//   --preview             one frame late in each shot, named by shot id
//   --at=12,45.5,88       exactly these timestamps, in seconds
//
// Sampling by shot rather than at fixed percentages of the runtime is the
// difference between checking the beats you wrote and checking wherever the
// arithmetic happened to land. Fixed percentages catch mid-draw-on transients
// that look broken but are fine in motion, and miss settled beats entirely.
if (flags.has('--preview') || args.some(a => a.startsWith('--at='))) {
  mkdirSync(at('preview'), { recursive: true });
  const raster = svg => new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Segoe Print' },
  }).render().asPng();

  const explicit = (args.find(a => a.startsWith('--at=')) || '').slice(5);
  // Two frames per shot. 0.82 is late enough that the beats a shot triggered
  // have settled; 0.15 catches the other failure, which is a stage whose first
  // beat fires several seconds in and leaves the page bare until it does. One
  // sample point cannot see both, and the early gap is the one that hides.
  const shots = explicit
    ? explicit.split(',').filter(Boolean).map(s => ({ label: `at-${s}s`, t: Math.round(Number(s) * 1000) }))
    : SHOTS.flatMap(s => [
      { label: `${s.id}-early`, t: Math.round(s.start + s.dur * 0.15) },
      { label: s.id, t: Math.round(s.start + s.dur * 0.82) },
    ]);

  for (const { label, t } of shots) {
    const name = at('preview', `${label}.png`);
    writeFileSync(name, raster(renderFrame(t, Math.round((t / 1000) * FPS))));
    console.log(`${name}  t=${(t / 1000).toFixed(1)}s`);
  }
  process.exit(0);
}

const audioTrack = buildAudio();
if (flags.has('--audio')) process.exit(0);

// ------------------------------------------------------------------ build
const totalFrames = Math.ceil((TOTAL_MS / 1000) * FPS);
const poolSize = Math.max(1, Math.min(cpus().length - 2, 24));
console.log(`rendering ${totalFrames} frames across ${poolSize} workers`);

const ff = spawn('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-i', audioTrack,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
  at('out.mp4'),
], { stdio: ['pipe', 'inherit', 'inherit'] });

const started = Date.now();
const done = new Map();
let next = 0;
let dispatched = 0;
let draining = false;
const LEAD = poolSize * 6;   // cap how far the pool may run ahead of the encoder
const workers = [];

function flush() {
  if (draining) return;
  while (done.has(next)) {
    const png = done.get(next);
    done.delete(next);
    next += 1;
    if (next % 900 === 0) {
      const rate = next / ((Date.now() - started) / 1000);
      console.log(`  ${next}/${totalFrames}  ${rate.toFixed(0)} fps`);
    }
    if (!ff.stdin.write(png)) {
      draining = true;
      ff.stdin.once('drain', () => { draining = false; flush(); });
      return;
    }
  }
  if (next >= totalFrames) ff.stdin.end();
}

function feed(worker) {
  if (dispatched < totalFrames && dispatched - next < LEAD) {
    worker.postMessage(dispatched);
    dispatched += 1;
    return;
  }
  if (dispatched >= totalFrames) worker.postMessage(null);
}

for (let i = 0; i < poolSize; i += 1) {
  const worker = new Worker(new URL('./worker.mjs', import.meta.url), {
    workerData: { fonts: FONT_FILES, scene: pathToFileURL(at('scene.mjs')).href },
  });
  worker.on('message', ({ frame, png }) => {
    done.set(frame, Buffer.from(png));
    flush();
    if (dispatched - next >= LEAD) setTimeout(() => feed(worker), 12);
    else feed(worker);
  });
  worker.on('error', (e) => { console.error('worker failed:', e); process.exit(1); });
  workers.push(worker);
}
workers.forEach(feed);

ff.on('close', (code) => {
  workers.forEach(w => w.terminate());
  console.log(code === 0
    ? `done in ${((Date.now() - started) / 1000).toFixed(0)}s -> ${at('out.mp4')}`
    : `ffmpeg exited ${code}`);
});
