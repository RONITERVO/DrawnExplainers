#!/usr/bin/env node
/**
 * Notebook vertical compositor, v3.0.0.
 * Node >= 22; FFmpeg >= 7.1 with libass, libx264 and the filters checked below.
 * No npm packages, network access, scene-kit imports, or shell commands.
 *
 * Design invariants:
 * - One global rational frame grid; sample boundaries derive from that grid.
 * - The opaque central drawing/matte is the LAST visual layer.
 * - Narrator audio is NEVER mapped. Master/clip audio is decoded to PCM once.
 * - Video-only caches are joined; AAC files are NOT concatenated.
 * - Text is an ASS track with fixed full-page layout and hidden unrevealed text.
 * - Validated files are published by rename; success receipts contain SHA-256.
 *
 * See --help and the accompanying README for supported input conventions and
 * limitations. "Preserve" means uncropped content, not bit-identical pixels.
 */
import { spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync,
  renameSync, unlinkSync, copyFileSync, openSync, closeSync, createReadStream,
  createWriteStream, realpathSync, lstatSync,
} from 'node:fs';
import { resolve, join, basename, dirname, extname, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { cpus, hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

export const VERSION = '3.0.0';
const SELF = fileURLToPath(import.meta.url);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi']);
const STILL_EXT = new Set(['.png', '.pgm', '.jpg', '.jpeg', '.webp']);
const CHECK_FILTERS = ['ass', 'overlay', 'scale', 'pad', 'fps', 'trim', 'setpts',
  'format', 'color', 'tpad', 'split', 'alphaextract', 'alphamerge', 'blend',
  'geq', 'aresample', 'apad', 'atrim', 'asetpts', 'colorkey', 'unpremultiply', 'premultiply', 'setsar', 'lut3d'];
const CHILDREN = new Set();
let interrupted = false;
export const DEFAULTS = {
  version: 3,
  originalDir: 'out-clips-talking-face-v3',
  narratorDir: 'narrator-clips',
  maskDir: 'narrator-masks',
  outputDir: 'vertical-notebook',
  timing: 'timing.json',
  master: 'out.mp4',
  sourceMode: 'master',
  fps: null,                         // From manifest.settings.fps; no hidden FPS.
  canvas: { width: 1080, height: 1920, centerHeight: null, paperColor: '#ebe4db' },
  paper: { color: '#f9f6f1', edgeColor: '#d4c7b9', marginColor: '#d17147',
    ruling: true, ruleOpacity: 0.16, grain: 0.35 },
  timingOptions: { headMs: null, gapMs: null, sectionOrder: null },
  pattern: ['top', 'bottom'],
  narrator: {
    mode: 'opaque',                  // opaque | alpha | colorkey | mask
    alphaType: 'straight',           // straight | premultiplied (alpha mode)
    durationPolicy: 'freeze',        // freeze | loop | error; never stretch audio
    offsetSeconds: 0,
    panelMargin: 48,
    widthFraction: 0.88,
    maxFreezeSeconds: 1,
    card: { enabled: true, mat: 12, aspect: 16 / 9, edgeOpacity: 0.55 },
    grade: { mode: 'notebook', colorRetention: 0.18, strength: 1, gamma: 1,
      autoLevels: true, sampleFrames: 5, maxBlackPoint: 0.06, minWhitePoint: 0.88,
      blackPoint: null, whitePoint: null, inkColor: '#493e36', paperColor: '#f9f6f1' },
    keyColor: '#ffffff', keySimilarity: 0.12, keyBlend: 0.08,
    invertMask: false,
  },
  transition: { kind: 'paper-edge', seconds: 0.6, seed: 11939,
    feather: 14, irregularity: 4 }, // edge-only opacity; never fade the whole face
  text: {
    source: 'script',                // script | words; mismatched token counts fail
    locale: 'en', fontFile: null, fontName: null,
    fontSize: 60, margin: 96, color: '#493e36',
    anchor: 'center-facing', phraseAware: true, maxHeightFraction: 0.80,
    minPageSeconds: 1.2, fallbackFonts: [],
    maxTokensPerPage: 40, maxGraphemesPerClip: 4000,
  },
  audio: { sampleRate: 48000, channels: 2, stream: 0, codec: 'aac', bitrate: '192k',
    maxTailPadSeconds: 0.12 },
  encode: { preset: 'medium', crf: 18, threads: Math.min(8, cpus().length),
    filterThreads: 2 },
  verify: 'decode',                 // decode | probe; new outputs always frame-counted
  processTimeoutSeconds: 1800,
  maxClipSeconds: 600,
  clips: {},                        // Per-clip overrides, documented in README.
};

// ---------- Configuration and data validation (pure, exported for tests) ----------
function fail(message) { throw new Error(message); }
function assert(test, message) { if (!test) fail(message); }
function plain(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
function finite(v, name, min = 0, max = Infinity) {
  assert(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max,
    `${name} must be a finite number in [${min}, ${max}]`);
  return v;
}
function integer(v, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  finite(v, name, min, max); assert(Number.isSafeInteger(v), `${name} must be an integer`);
  return v;
}
function oneOf(v, choices, name) { assert(choices.includes(v), `${name}: expected ${choices.join(' | ')}`); }
function bool(v, name) { assert(typeof v === 'boolean', `${name} must be true or false`); }
function color(v, name) { assert(/^#[0-9a-fA-F]{6}$/.test(v), `${name} must be #RRGGBB`); return v; }
function safeText(s, name) {
  assert(typeof s === 'string', `${name} must be a string`);
  // Deliberately reject ASS control syntax, not silently change the transcript.
  assert(!/[{}\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(s),
    `${name}: braces, backslashes and control characters are unsupported in transcript text`);
  return s;
}
function requireFile(p) { assert(existsSync(p) && statSync(p).isFile(), `File not found: ${p}`); return p; }
function json(p) {
  try { return JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) { fail(`Cannot read JSON ${p}: ${e.message}`); }
}
function safeFilename(s, name = 'filename') {
  assert(typeof s === 'string' && s.length > 0 && s !== '.' && s !== '..' &&
    !/[\\/\u0000-\u001f]/u.test(s) && !isAbsolute(s), `${name} must be a filename, not a path`);
  return s;
}
export function mergeConfig(base, patch, prefix = '') {
  assert(plain(patch), `${prefix || 'Configuration'} must be an object`);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    assert(Object.hasOwn(base, key), `Unknown configuration key: ${prefix}${key}`);
    if (key === 'clips' && !prefix) { assert(plain(value), 'clips must be an object'); out[key] = value; }
    else if (plain(base[key])) out[key] = mergeConfig(base[key], value, `${prefix}${key}.`);
    else out[key] = value;
  }
  return out;
}
export function rate(value) {
  const m = String(value).match(/^(\d+)(?:\/(\d+))?$/);
  assert(m, `FPS must be an integer or rational string such as 30000/1001: ${value}`);
  let n = Number(m[1]), d = Number(m[2] ?? 1);
  integer(n, 'FPS numerator', 1, 240000); integer(d, 'FPS denominator', 1, 100000);
  const g = gcd(n, d); n /= g; d /= g;
  assert(n / d >= 1 && n / d <= 60, 'Supported output FPS range is 1..60');
  return { n, d, value: n / d, text: `${n}/${d}`, timeScale: n };
}
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
export function validateConfig(c) {
  assert(c.version === 3, 'Configuration version must be 3; use the accompanying notebook preset, not a v2 config');
  for (const k of ['originalDir', 'narratorDir', 'maskDir', 'outputDir', 'timing', 'master'])
    assert(typeof c[k] === 'string' && c[k].length > 0, `${k} must be a nonempty path`);
  oneOf(c.sourceMode, ['master', 'clips'], 'sourceMode');
  integer(c.canvas.width, 'canvas.width', 256, 4320);
  integer(c.canvas.height, 'canvas.height', 256, 7680);
  assert(!(c.canvas.width % 2 || c.canvas.height % 2), 'Canvas dimensions must be even');
  if (c.canvas.centerHeight !== null) integer(c.canvas.centerHeight, 'canvas.centerHeight', 32, c.canvas.height - 64);
  color(c.canvas.paperColor, 'canvas.paperColor');
  for (const k of ['color', 'edgeColor', 'marginColor']) color(c.paper[k], `paper.${k}`);
  bool(c.paper.ruling, 'paper.ruling'); finite(c.paper.ruleOpacity, 'paper.ruleOpacity', 0, 0.5);
  finite(c.paper.grain, 'paper.grain', 0, 2);
  assert(Array.isArray(c.pattern) && c.pattern.length > 0, 'pattern must be a nonempty array');
  c.pattern.forEach(x => oneOf(x, ['top', 'bottom'], 'pattern'));
  for (const k of ['headMs', 'gapMs']) if (c.timingOptions[k] !== null) finite(c.timingOptions[k], `timingOptions.${k}`);
  if (c.timingOptions.sectionOrder !== null)
    assert(Array.isArray(c.timingOptions.sectionOrder), 'timingOptions.sectionOrder must be an array');
  validateNarrator(c.narrator);
  oneOf(c.transition.kind, ['slide', 'paper-edge'], 'transition.kind');
  finite(c.transition.feather, 'transition.feather', 1, 96);
  finite(c.transition.irregularity, 'transition.irregularity', 0, 32);
  finite(c.transition.seconds, 'transition.seconds', 0, 10);
  integer(c.transition.seed, 'transition.seed', 0, 0xffffffff);
  oneOf(c.text.source, ['script', 'words'], 'text.source');
  integer(c.text.fontSize, 'text.fontSize', 12, 256);
  integer(c.text.margin, 'text.margin', 0, Math.floor(c.canvas.width / 3));
  color(c.text.color, 'text.color');
  oneOf(c.text.anchor, ['center-facing', 'center', 'top'], 'text.anchor');
  bool(c.text.phraseAware, 'text.phraseAware');
  finite(c.text.maxHeightFraction, 'text.maxHeightFraction', 0.2, 1);
  finite(c.text.minPageSeconds, 'text.minPageSeconds', 0, 10);
  assert(Array.isArray(c.text.fallbackFonts) && c.text.fallbackFonts.every(x => typeof x === 'string' && x.length), 'text.fallbackFonts must be an array of font paths');
  integer(c.text.maxTokensPerPage, 'text.maxTokensPerPage', 1, 300);
  integer(c.text.maxGraphemesPerClip, 'text.maxGraphemesPerClip', 1, 50000);
  new Intl.Segmenter(c.text.locale, { granularity: 'grapheme' });
  integer(c.audio.sampleRate, 'audio.sampleRate', 8000, 192000);
  oneOf(c.audio.channels, [1, 2], 'audio.channels'); integer(c.audio.stream, 'audio.stream', 0, 31);
  oneOf(c.audio.codec, ['aac', 'alac'], 'audio.codec');
  assert(/^\d+k$/.test(c.audio.bitrate), 'audio.bitrate must look like 192k');
  finite(c.audio.maxTailPadSeconds, 'audio.maxTailPadSeconds', 0, 10);
  oneOf(c.encode.preset, ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'], 'encode.preset');
  integer(c.encode.crf, 'encode.crf', 0, 51);
  integer(c.encode.threads, 'encode.threads', 1, 64); integer(c.encode.filterThreads, 'encode.filterThreads', 1, 16);
  oneOf(c.verify, ['probe', 'decode'], 'verify');
  finite(c.processTimeoutSeconds, 'processTimeoutSeconds', 1, 86400);
  finite(c.maxClipSeconds, 'maxClipSeconds', 0.1, 86400);
  for (const [id, p] of Object.entries(c.clips)) {
    assert(/^\d+$/.test(id) && Number(id) >= 1 && String(Number(id)) === id, `Invalid clips key ${id}; use canonical indices such as 1, not 001`);
    assert(plain(p), `clips.${id} must be an object`);
    for (const k of Object.keys(p)) assert(['narratorFilename', 'maskFilename', 'position', 'narrator'].includes(k), `Unknown clips.${id}.${k}`);
    for (const k of ['narratorFilename', 'maskFilename']) if (p[k] !== undefined) safeFilename(p[k], `clips.${id}.${k}`);
    if (p.position !== undefined) oneOf(p.position, ['top', 'bottom'], `clips.${id}.position`);
    if (p.narrator) validateNarrator(mergeConfig(c.narrator, p.narrator, `clips.${id}.narrator.`));
  }
  return c;
}
function validateNarrator(n) {
  oneOf(n.mode, ['opaque', 'alpha', 'colorkey', 'mask'], 'narrator.mode');
  oneOf(n.alphaType, ['straight', 'premultiplied'], 'narrator.alphaType');
  oneOf(n.durationPolicy, ['freeze', 'loop', 'error'], 'narrator.durationPolicy');
  finite(n.offsetSeconds, 'narrator.offsetSeconds', 0, 86400);
  integer(n.panelMargin, 'narrator.panelMargin', 0, 512);
  finite(n.widthFraction, 'narrator.widthFraction', 0.1, 1);
  finite(n.maxFreezeSeconds, 'narrator.maxFreezeSeconds', 0, 600);
  bool(n.card.enabled, 'narrator.card.enabled');
  integer(n.card.mat, 'narrator.card.mat', 0, 128);
  finite(n.card.aspect, 'narrator.card.aspect', 0.5, 4);
  finite(n.card.edgeOpacity, 'narrator.card.edgeOpacity', 0, 1);
  const g = n.grade;
  oneOf(g.mode, ['notebook', 'off'], 'narrator.grade.mode');
  finite(g.colorRetention, 'narrator.grade.colorRetention', 0, 1);
  finite(g.strength, 'narrator.grade.strength', 0, 1);
  finite(g.gamma, 'narrator.grade.gamma', 0.5, 2);
  bool(g.autoLevels, 'narrator.grade.autoLevels');
  integer(g.sampleFrames, 'narrator.grade.sampleFrames', 1, 11);
  finite(g.maxBlackPoint, 'narrator.grade.maxBlackPoint', 0, 0.2);
  finite(g.minWhitePoint, 'narrator.grade.minWhitePoint', 0.7, 1);
  if (g.blackPoint !== null) finite(g.blackPoint, 'narrator.grade.blackPoint', 0, 0.3);
  if (g.whitePoint !== null) finite(g.whitePoint, 'narrator.grade.whitePoint', 0.6, 1);
  color(g.inkColor, 'narrator.grade.inkColor'); color(g.paperColor, 'narrator.grade.paperColor');
  color(n.keyColor, 'narrator.keyColor');
  finite(n.keySimilarity, 'narrator.keySimilarity', 0.01, 1);
  finite(n.keyBlend, 'narrator.keyBlend', 0, 1); bool(n.invertMask, 'narrator.invertMask');
}
export function geometry(c) {
  const { width: w, height: h } = c.canvas;
  const ch = c.canvas.centerHeight ?? Math.ceil(w * 9 / 16 / 2) * 2;
  assert(ch % 2 === 0 && ch < h, 'Center height must be even and smaller than the canvas');
  const cy = (h - ch) / 2;
  assert(cy > 2 * c.text.margin + c.text.fontSize, 'Text panel is too short for the configured font/margins');
  return { w, h, ch, cy, panelHeight: cy, bottomY: cy + ch };
}
/** Exact rational aspect when possible (16:9 => 1056x594 at 1080 width).
 * Nonstandard coprime source dimensions fall back to even-pixel containment.
 */
export function contain(sw, sh, maxW, maxH) {
  assert(sw > 0 && sh > 0 && maxW >= 2 && maxH >= 2, 'Invalid containment geometry');
  const g = gcd(sw, sh), a = sw / g, b = sh / g;
  let k = Math.floor(Math.min(maxW / a, maxH / b));
  if ((a % 2 || b % 2) && k % 2) k--;
  if (k >= 1) return { w: a * k, h: b * k, exactAspect: true };
  const s = Math.min(maxW / sw, maxH / sh);
  return { w: Math.max(2, Math.floor(sw * s / 2) * 2),
    h: Math.max(2, Math.floor(sh * s / 2) * 2), exactAspect: false };
}
export function buildWords(timing, manifest, c) {
  assert(plain(timing), 'timing.json must be an object of named sections');
  const keys = Object.keys(timing), order = c.timingOptions.sectionOrder ?? keys;
  assert(order.length === keys.length && new Set(order).size === keys.length && order.every(k => keys.includes(k)),
    'sectionOrder must name every timing section exactly once');
  const head = c.timingOptions.headMs ?? manifest.settings?.headMs;
  const gap = c.timingOptions.gapMs ?? manifest.settings?.gapMs;
  finite(head, 'headMs (manifest.settings or timingOptions)');
  finite(gap, 'gapMs (manifest.settings or timingOptions)');
  const words = [], corrections = [];
  let cursor = head, previousEnd = -Infinity;
  for (const section of order) {
    const e = timing[section]; assert(plain(e), `${section}: expected an object`);
    const duration = finite(e.durationMs, `${section}.durationMs`, 0.001);
    const base = e.timelineStartMs === undefined ? cursor : finite(e.timelineStartMs, `${section}.timelineStartMs`);
    assert(base >= previousEnd - 0.001, `${section}: overlapping/out-of-order sections`);
    assert(Array.isArray(e.words), `${section}.words must be an array`);
    let tokens;
    if (e.displayTokens !== undefined) {
      assert(Array.isArray(e.displayTokens), `${section}.displayTokens must be an array`);
      tokens = e.displayTokens;
    } else if (c.text.source === 'script') {
      assert(typeof e.script === 'string', `${section}: script missing; explicitly choose text.source=words to use recognized words`);
      tokens = e.script.match(/\S+/gu) ?? [];
    } else tokens = e.words.map(w => w.word);
    assert(tokens.length === e.words.length,
      `${section}: ${tokens.length} display tokens vs ${e.words.length} timed words. Supply displayTokens aligned one-to-one; no automatic retiming is attempted.`);
    let last = -Infinity;
    e.words.forEach((word, i) => {
      assert(plain(word), `${section}.words[${i}] must be an object`);
      const s = finite(word.startMs, `${section}[${i}].startMs`);
      const t = finite(word.endMs, `${section}[${i}].endMs`);
      assert(t >= s && t <= duration + 0.001, `${section}[${i}]: word is outside section duration`);
      assert(s >= last - 0.001, `${section}[${i}]: overlapping/out-of-order word timings`);
      last = t;
      const token = safeText(tokens[i], `${section} display token ${i}`).replace(/\s+/gu, ' ').trim();
      assert(token.length > 0, `${section}: empty display token ${i}`);
      if (token !== String(word.word ?? '').trim()) corrections.push({ section, index: i,
        recognized: word.word ?? null, displayed: token });
      words.push({ section, index: i, token, startMs: base + s, endMs: base + t });
    });
    previousEnd = base + duration; cursor = previousEnd + gap;
  }
  return { words, corrections, headMs: head, gapMs: gap, sectionOrder: order, endMs: previousEnd };
}
export function planClips(manifest, c) {
  assert(Array.isArray(manifest.clips) && manifest.clips.length, 'clip-index.json must have a nonempty clips array');
  const fps = rate(c.fps ?? manifest.settings?.fps);
  const sorted = [...manifest.clips].sort((a, b) => a.index - b.index), ids = new Set();
  let prev = null;
  const clips = sorted.map((clip, ordinal) => {
    integer(clip.index, 'clip.index', 1, 99999);
    assert(!ids.has(clip.index), `Duplicate clip index ${clip.index}`); ids.add(clip.index);
    finite(clip.startMs, `Clip ${clip.index} startMs`);
    finite(clip.endMs, `Clip ${clip.index} endMs`, clip.startMs + 0.001);
    finite(clip.durationMs, `Clip ${clip.index} durationMs`, 0.001, c.maxClipSeconds * 1000);
    assert(Math.abs(clip.durationMs - (clip.endMs - clip.startMs)) < 0.05, `Clip ${clip.index}: inconsistent durationMs`);
    if (prev) assert(Math.abs(clip.startMs - prev.endMs) < 0.05,
      `Gap/overlap before clip ${clip.index}; supply a contiguous manifest, not silently skipped time`);
    const startFrame = Math.round(clip.startMs * fps.n / (1000 * fps.d));
    const endFrame = Math.round(clip.endMs * fps.n / (1000 * fps.d));
    assert(endFrame > startFrame, `Clip ${clip.index} has no output frames`);
    const startSample = Math.round(startFrame * fps.d * c.audio.sampleRate / fps.n);
    const endSample = Math.round(endFrame * fps.d * c.audio.sampleRate / fps.n);
    const override = c.clips[String(clip.index)] ?? {};
    const p = { ...clip, filename: safeFilename(clip.filename), ordinal,
      startFrame, endFrame, frames: endFrame - startFrame,
      startSeconds: startFrame * fps.d / fps.n, endSeconds: endFrame * fps.d / fps.n,
      seconds: (endFrame - startFrame) * fps.d / fps.n,
      startSample, endSample, samples: endSample - startSample,
      position: override.position ?? c.pattern[ordinal % c.pattern.length],
      narrator: mergeConfig(c.narrator, override.narrator ?? {}, 'narrator.'),
      narratorFilename: override.narratorFilename ?? clip.narratorFilename,
      maskFilename: override.maskFilename ?? clip.maskFilename,
    };
    prev = clip; return p;
  });
  for (const id of Object.keys(c.clips)) assert(ids.has(Number(id)), `Configuration overrides nonexistent clip ${id}`);
  return { clips, fps };
}
export function selectClips(clips, cli) {
  let selected = clips;
  if (cli.only !== undefined) {
    assert(/^\d+(,\d+)*$/.test(cli.only), '--only expects comma-separated clip indices');
    const ids = cli.only.split(',').map(Number);
    assert(new Set(ids).size === ids.length, '--only contains duplicates');
    assert(ids.every(id => clips.some(c => c.index === id)), '--only contains a missing clip index');
    selected = clips.filter(p => ids.includes(p.index));
  }
  if (cli.limit !== undefined) { integer(Number(cli.limit), '--limit', 1); selected = selected.slice(0, Number(cli.limit)); }
  if (!cli.noJoin) for (let i = 1; i < selected.length; i++) assert(selected[i - 1].endFrame === selected[i].startFrame,
    'Noncontiguous --only selection cannot be joined; add --no-join');
  return selected;
}
export function matchFile(dir, id, allowed = VIDEO_EXT, explicit) {
  assert(existsSync(dir) && statSync(dir).isDirectory(), `Directory not found: ${dir}`);
  if (explicit) return requireFile(join(dir, safeFilename(explicit)));
  const n = String(id).padStart(3, '0');
  const matches = readdirSync(dir).filter(f => allowed.has(extname(f).toLowerCase()) &&
    (f.startsWith(`${n}__`) || f.slice(0, -extname(f).length) === n) && statSync(join(dir, f)).isFile());
  assert(matches.length === 1, matches.length ?
    `Ambiguous clip ${n} in ${dir}: ${matches.join(', ')}. Use a per-clip filename override.` :
    `Missing clip ${n} in ${dir}; expected ${n}__name.mp4 or ${n}.mp4`);
  return join(dir, matches[0]);
}

// ---------- Shell-free processes, bounded logs, hashes, receipts, output locks ----------
async function run(exe, args, { cwd, log, timeout = 1800000, cap = 2 * 1024 * 1024,
  progress = false, binary = false } = {}) {
  assert(!interrupted, 'Interrupted');
  if (log) mkdirSync(dirname(log), { recursive: true });
  return await new Promise((accept, reject) => {
    const stream = log ? createWriteStream(log) : null;
    stream?.write(`Executable: ${exe}\nArguments (JSON, not shell syntax): ${JSON.stringify(args)}\n\n`);
    let child;
    try { child = spawn(exe, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { stream?.end(); reject(e); return; }
    CHILDREN.add(child);
    let size = 0, chunks = [], tail = '', error = null, lastProgress = 0;
    const timer = setTimeout(() => { error = new Error(`Process timeout after ${timeout / 1000}s; log: ${log ?? '(none)'}`); child.kill('SIGKILL'); }, timeout);
    stream?.on('error', e => { error = e; child.kill('SIGKILL'); });
    child.stdout.on('data', b => {
      if (progress) {
        const m = b.toString().match(/out_time=([^\r\n]+)/);
        if (m && Date.now() - lastProgress > 10000) { console.log(`    rendered ${m[1]}`); lastProgress = Date.now(); }
      } else {
        size += b.length;
        if (size > cap) { error = new Error(`Process stdout exceeded ${cap} bytes`); child.kill('SIGKILL'); }
        else chunks.push(b);
      }
    });
    child.stderr.on('data', b => {
      if (stream && !stream.write(b)) { child.stderr.pause(); stream.once('drain', () => child.stderr.resume()); }
      tail = (tail + b.toString()).slice(-32768);
    });
    child.once('error', e => { error = new Error(`Cannot run ${exe}: ${e.message}`); });
    child.once('close', (code, signal) => {
      clearTimeout(timer); CHILDREN.delete(child); stream?.end();
      if (error || code !== 0 || interrupted) reject(error ?? new Error(`${basename(exe)} failed (${code ?? signal})${log ? `; log: ${log}` : ''}\n${tail}`));
      else accept({ stdout: binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8'), stderr: tail });
    });
  });
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function digest(value) { return createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex'); }
async function hashFile(p) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(requireFile(p))) { assert(!interrupted, 'Interrupted'); hash.update(chunk); }
  return hash.digest('hex');
}
async function replaceFile(from, to) {
  for (let attempt = 0; ; attempt++) {
    try { renameSync(from, to); return; }
    catch (e) {
      if (attempt >= 6 || !['EACCES', 'EPERM', 'EBUSY'].includes(e.code)) throw e;
      await sleep(80 * (attempt + 1));
    }
  }
}
async function atomicJSON(p, value) {
  mkdirSync(dirname(p), { recursive: true });
  const temp = `${p}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await replaceFile(temp, p);
}
async function reusable(p, fingerprint) {
  if (!existsSync(p) || !existsSync(`${p}.receipt.json`)) return false;
  let r; try { r = json(`${p}.receipt.json`); } catch { return false; }
  return r.fingerprint === fingerprint && r.sha256 === await hashFile(p);
}
async function publish(temp, path, fingerprint, details = {}) {
  const sha256 = await hashFile(temp);
  await replaceFile(temp, path);
  await atomicJSON(`${path}.receipt.json`, { version: VERSION, fingerprint, sha256, ...details });
  return sha256;
}
function acquireLock(outputDir) {
  const lock = join(outputDir, 'render.lock.json'), token = randomUUID();
  mkdirSync(outputDir, { recursive: true });
  if (existsSync(lock)) {
    // Serialize stale-lock reclamation so two starters cannot delete each other's new lock.
    const guard = `${lock}.reclaim`;
    let guardFD;
    try { guardFD = openSync(guard, 'wx'); }
    catch { fail(`Output lock is being reclaimed: ${guard}. Inspect a persistent guard before removing it.`); }
    try {
      if (existsSync(lock)) {
        let old; try { old = json(lock); } catch { fail(`Unreadable lock ${lock}; inspect it before removing it`); }
        let active = true;
        if (old.host === hostname() && Number.isSafeInteger(old.pid) && old.pid > 0) {
          try { process.kill(old.pid, 0); } catch (e) { if (e.code === 'ESRCH') active = false; }
        }
        assert(!active, `Output is locked: ${lock}. Do not remove a lock belonging to a running renderer.`);
        unlinkSync(lock); // Only a dead PID on this host is automatically reclaimed.
      }
    } finally { closeSync(guardFD); unlinkSync(guard); }
  }
  const fd = openSync(lock, 'wx');
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid, host: hostname(), token, created: new Date().toISOString() })); }
  finally { closeSync(fd); }
  return () => { try { if (json(lock).token === token) unlinkSync(lock); } catch { /* Do not remove someone else's lock. */ } };
}
function canonicalPath(p) {
  const full = resolve(p);
  if (existsSync(full)) return realpathSync(full);
  const parent = dirname(full); assert(parent !== full, `Cannot resolve path ${p}`);
  return join(canonicalPath(parent), basename(full));
}
function comparablePath(p) { const s = canonicalPath(p).replace(/\\/g, '/').replace(/\/$/, ''); return process.platform === 'win32' ? s.toLowerCase() : s; }
function protectInputs(ctx) {
  const root = comparablePath(ctx.outputDir);
  const paths = [join(ctx.originalDir, 'clip-index.json'), resolve(ctx.episode, ctx.c.timing), ctx.fontFile,
    ...ctx.c.text.fallbackFonts, ...ctx.selected.flatMap(p => [p.originalPath, p.narratorPath, p.maskPath].filter(Boolean))];
  for (const p of paths) {
    const input = comparablePath(p);
    assert(input !== root && !input.startsWith(`${root}/`), `Output directory contains an input (including symlink aliases): ${p}. Choose a separate output folder.`);
  }
  for (const p of [ctx.work, ...ctx.selected.map(c => join(ctx.work, `clip${String(c.index).padStart(5, '0')}`))])
    if (existsSync(p)) assert(!lstatSync(p).isSymbolicLink() && statSync(p).isDirectory(), `Generated work directory may not be a symlink or file: ${p}`);
}
function ffArgs(c) {
  return ['-hide_banner', '-nostdin', '-loglevel', 'info', '-xerror', '-y',
    '-filter_threads', String(c.encode.filterThreads), '-filter_complex_threads', String(c.encode.filterThreads)];
}
async function ff(ctx, args, opts = {}) {
  return await run(ctx.ffmpeg, [...ffArgs(ctx.c), ...args], {
    cwd: opts.cwd ?? ctx.work, timeout: ctx.c.processTimeoutSeconds * 1000, ...opts,
  });
}
async function probe(ctx, p, count = false) {
  const r = await run(ctx.ffprobe, ['-v', 'error', ...(count ? ['-count_frames'] : []),
    '-show_streams', '-show_format', '-show_data_hash', 'sha256', '-of', 'json', p],
  { timeout: ctx.c.processTimeoutSeconds * 1000, cap: 4 * 1024 * 1024 });
  return JSON.parse(r.stdout);
}
function videoStream(p) { return p.streams?.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic); }
function audioStream(p, n) { return p.streams?.filter(s => s.codec_type === 'audio')[n]; }
function streamDuration(s, p) {
  if (Number.isFinite(Number(s?.duration)) && Number(s.duration) > 0) return Number(s.duration);
  return Number(p.format?.duration);
}
function validateVideo(p, name, { original = false } = {}) {
  const v = videoStream(p); assert(v, `${name}: no video stream`);
  integer(v.width, `${name} width`, 1); integer(v.height, `${name} height`, 1);
  assert(!v.sample_aspect_ratio || ['1:1', '0:1', 'N/A'].includes(v.sample_aspect_ratio),
    `${name}: anamorphic video is not supported; normalize display geometry explicitly first`);
  const rotation = Number(v.tags?.rotate ?? v.side_data_list?.find(x => x.rotation !== undefined)?.rotation ?? 0);
  assert(rotation % 360 === 0, `${name}: rotation metadata is unsupported; bake rotation into pixels first`);
  assert(!v.field_order || ['unknown', 'progressive'].includes(v.field_order), `${name}: deinterlace the input first`);
  assert(!['smpte2084', 'arib-std-b67'].includes(v.color_transfer), `${name}: HDR is unsupported; supply a deliberate SDR grade`);
  assert(!v.color_primaries || ['unknown', 'bt709'].includes(v.color_primaries), `${name}: only BT.709/untagged SDR input is supported`);
  if (original) {
    assert(Math.abs(Number(p.format?.start_time ?? 0)) < 0.002,
      `${name}: nonzero container start time is unsupported; normalize timestamps before using this tool`);
    assert(Math.abs(Number(v.start_time ?? 0)) < 0.002,
      `${name}: the drawing video must begin at timeline zero`);
  }
  const d = streamDuration(v, p); finite(d, `${name} video duration`, 0.001);
  return { ...v, measuredDuration: d };
}
function validateAudio(p, name, c, requiredEnd) {
  const a = audioStream(p, c.audio.stream);
  assert(a, `${name}: required original audio stream ${c.audio.stream} is missing (not replaced with silence)`);
  const d = streamDuration(a, p), start = Number(a.start_time ?? 0);
  assert(Number.isFinite(d) && d > 0 && Number.isFinite(start), `${name}: cannot determine audio duration/start`);
  assert(start >= -0.1, `${name}: audio begins substantially before timeline zero`);
  assert(start + d + c.audio.maxTailPadSeconds >= requiredEnd - 0.001,
    `${name}: audio ends at ${start + d}s, needed ${requiredEnd}s; refusing substantial silent tail padding`);
  return a;
}
async function validateOutput(ctx, p, frames, samples, withAudio) {
  const info = await probe(ctx, p, true), v = videoStream(info), a = audioStream(info, 0);
  assert(v?.width === ctx.g.w && v?.height === ctx.g.h && v?.pix_fmt === 'yuv420p', `${p}: incorrect output geometry/pixel format`);
  assert(v.codec_name === 'h264', `${p}: expected H.264`);
  assert(Number(v.nb_read_frames) === frames, `${p}: got ${v.nb_read_frames} frames, expected ${frames}`);
  const actualRate = String(v.avg_frame_rate).split('/').map(Number);
  assert(Math.abs(actualRate[0] / actualRate[1] - ctx.fps.value) < 1e-6, `${p}: incorrect frame rate`);
  assert(Math.abs(Number(v.start_time ?? 0)) < 0.002, `${p}: nonzero video start`);
  assert(Math.abs(Number(v.duration) - frames / ctx.fps.value) < 0.002, `${p}: incorrect video duration`);
  if (withAudio) {
    assert(a && a.codec_name === ctx.c.audio.codec && a.channels === ctx.c.audio.channels &&
      Number(a.sample_rate) === ctx.c.audio.sampleRate, `${p}: audio stream/configuration mismatch`);
    // AAC packet framing/edit lists can differ from the exact PCM length by one access unit.
    const tolerance = ctx.c.audio.codec === 'aac' ? 2048 / ctx.c.audio.sampleRate + 0.003 : 0.003;
    assert(Math.abs(Number(a.duration) - samples / ctx.c.audio.sampleRate) < tolerance, `${p}: unexpected encoded audio duration`);
    assert(Math.abs(Number(a.start_time ?? 0)) < 0.003, `${p}: encoded audio starts late`);
  } else assert(!a, `${p}: video cache must not contain audio`);
  if (ctx.c.verify === 'decode') await ff(ctx, ['-v', 'error', '-i', p, '-map', '0:v:0',
    ...(withAudio ? ['-map', '0:a:0'] : []), '-f', 'null', '-'], { log: `${p}.verify.log` });
  return info;
}
/** ffconcat durations are parsed in microseconds. Quantize CUMULATIVE endpoints,
 * not every file duration independently, then rescale onto the frame/sample timebase.
 * Video MP4 timescale is the reduced FPS numerator: one frame is exactly d ticks.
 */
export function concatDurations(counts, unitsPerSecond) {
  let units = 0, previousUs = 0;
  return counts.map(count => {
    units += count;
    const endUs = Math.round(units * 1000000 / unitsPerSecond);
    const duration = (endUs - previousUs) / 1000000; previousUs = endUs;
    return duration;
  });
}
function signature(info) {
  const v = videoStream(info);
  return Object.fromEntries(['codec_name', 'profile', 'level', 'width', 'height', 'pix_fmt',
    'sample_aspect_ratio', 'time_base', 'r_frame_rate', 'color_range', 'color_space',
    'color_transfer', 'color_primaries', 'extradata_hash'].map(k => [k, v[k] ?? null]));
}

// ---------- ASS text, measured using the actual libass/font renderer ----------
export function graphemes(s, locale = 'en') {
  return [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(s)].map(x => x.segment);
}
function tokenGap(previous, next, source) {
  if (!previous) return '';
  if (source === 'words' && (/^[,.;:!?，。！？、：；)\]”’]/u.test(next) || /^-\p{L}/u.test(next) || /[(\[“‘]$/u.test(previous))) return '';
  return ' ';
}
export function pageText(words, source = 'script') {
  let out = '', prev = '';
  for (const w of words) { out += tokenGap(prev, w.token, source) + w.token; prev = w.token; }
  return out;
}
function assColor(hex) { return `&H00${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`.toUpperCase(); }
function assHeader(c, width, height, marginL, marginR, marginV, white = false) {
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.709\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Main,${c.text.fontName},${c.text.fontSize},${white ? '&H00FFFFFF' : assColor(c.text.color)},&HFF000000,&HFF000000,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,7,${marginL},${marginR},${marginV},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
}
function csTime(cs) {
  const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}
export function frameBoundaryCS(frame, fps) {
  // Put the ASS boundary BETWEEN sampled frames, not on an ambiguously rounded frame timestamp.
  return frame <= 0 ? 0 : Math.max(0, Math.round((frame - 0.5) * 100 / fps.value));
}
function dialogue(start, end, text) { return `Dialogue: 0,${csTime(start)},${csTime(end)},Main,,0,0,0,,${text}\n`; }
async function installFont(ctx, dir) {
  mkdirSync(join(dir, 'fonts'), { recursive: true });
  // Isolate this run's supplied faces. Never load stale fallback fonts from an older config.
  for (const f of readdirSync(join(dir, 'fonts'))) if (/^(primary|fallback\d+)\.(ttf|otf|ttc)$/i.test(f)) unlinkSync(join(dir, 'fonts', f));
  copyFileSync(ctx.fontFile, join(dir, 'fonts', `primary${extname(ctx.fontFile).toLowerCase()}`));
  ctx.c.text.fallbackFonts.forEach((f, i) => copyFileSync(f, join(dir, 'fonts', `fallback${i}${extname(f).toLowerCase()}`)));
}
async function measureText(ctx, text) {
  if (ctx.measureCache.has(text)) return ctx.measureCache.get(text);
  const guard = 256, w = ctx.g.w + guard * 2, h = Math.ceil((2048 + ctx.g.panelHeight) / 2) * 2;
  const dir = join(ctx.work, 'measure'); mkdirSync(dir, { recursive: true });
  const margin = ctx.c.text.margin;
  writeFileSync(join(dir, 'probe.ass'), assHeader(ctx.c, w, h, margin + guard, margin + guard, 64, true) +
    dialogue(0, 100, `{\\q0}${text}`), 'utf8');
  const result = await ff(ctx, ['-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=1:d=1`,
    '-vf', 'ass=filename=probe.ass:fontsdir=fonts,format=gray', '-frames:v', '1',
    '-c:v', 'rawvideo', '-threads:v', '1', '-f', 'rawvideo', 'pipe:1'],
  { cwd: dir, log: join(dir, 'font-measure.log'), binary: true, cap: w * h + 4096 });
  assert(result.stdout.length === w * h, 'Unexpected font measurement raster size');
  assert(!/Glyph 0x[0-9A-F]+ not found/iu.test(result.stderr), 'Font is missing a transcript glyph; inspect work/measure/font-measure.log');
  const b = result.stdout;
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0, row = y * w; x < w; x++) if (b[row + x] > 12) {
    if (x < left) left = x; if (x > right) right = x;
    if (y < top) top = y; if (y > bottom) bottom = y;
  }
  assert(right >= left, 'Font measurement produced no visible glyphs');
  const fits = left >= guard + margin - 2 && right < guard + ctx.g.w - margin + 2 &&
    bottom - 64 < (ctx.g.panelHeight - 2 * margin - 4) * ctx.c.text.maxHeightFraction && bottom < h - 2;
  const measured = { fits, left: left - guard, right: right - guard, top: top - 64, bottom: bottom - 64 };
  ctx.measureCache.set(text, measured); return measured;
}
export function wordsForClip(words, p) {
  // Word membership follows the planned cut, not sub-frame boundary snapping.
  // Otherwise a word ending at 90.340s would be repeated after a 90.333s cut.
  const start = p.startMs ?? p.startSeconds * 1000, end = p.endMs ?? p.endSeconds * 1000;
  return words.filter(w => w.startMs < end && (w.endMs > start || (w.endMs === w.startMs && w.startMs >= start)));
}
export function phraseBreak(words, maxTake, source = 'script') {
  // Only reconsider a break when the complete remainder does not fit. Avoid
  // replacing one natural full-page sentence with several tiny flashing pages.
  if (maxTake >= words.length || maxTake < 3) return maxTake;
  let best = maxTake, bestScore = 0;
  for (let take = Math.max(2, Math.ceil(maxTake * 0.60)); take <= maxTake; take++) {
    if (words.length - take === 1) continue;
    const a = words[take - 1], b = words[take];
    const text = a.token;
    const punctuation = /[.!?。！？]["'”’)]*$/u.test(text) ? 1 : /[,;:，；：]["'”’)]*$/u.test(text) ? 0.35 : 0;
    const pause = Math.min(0.35, Math.max(0, (b.startMs - a.endMs) / 1500));
    const section = a.section !== b.section ? 0.25 : 0;
    const score = punctuation + pause + section + 0.6 * take / maxTake;
    if (score > bestScore) { bestScore = score; best = take; }
  }
  return best;
}
async function paginate(ctx, words) {
  const pages = []; let cursor = 0;
  while (cursor < words.length) {
    const rest = words.slice(cursor);
    const max = Math.min(ctx.c.text.maxTokensPerPage, rest.length);
    let take = max, bounds = await measureText(ctx, pageText(rest.slice(0, max), ctx.c.text.source));
    if (!bounds.fits) {
      // Binary search conserves actual raster-measurement subprocesses.
      let lo = 1, hi = max - 1, found = 0;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const b = await measureText(ctx, pageText(rest.slice(0, mid), ctx.c.text.source));
        if (b.fits) { found = mid; lo = mid + 1; } else hi = mid - 1;
      }
      assert(found, `A single display token cannot fit at font size ${ctx.c.text.fontSize}: ${rest[0].token}. Change font/margins or displayTokens explicitly.`);
      take = found;
    }
    if (ctx.c.text.phraseAware) take = phraseBreak(rest, take, ctx.c.text.source);
    // Exact final bounds are checked even if a line-breaking engine is non-monotonic.
    bounds = await measureText(ctx, pageText(rest.slice(0, take), ctx.c.text.source));
    while (!bounds.fits && take > 1) bounds = await measureText(ctx, pageText(rest.slice(0, --take), ctx.c.text.source));
    assert(bounds.fits, 'Final text page does not fit');
    pages.push({ words: rest.slice(0, take), bounds }); cursor += take;
  }
  return pages;
}
export function captionOrigin(c, g, position, bounds) {
  const panelY = position === 'top' ? g.bottomY : 0;
  if (c.text.anchor === 'center') return Math.round(panelY + (g.panelHeight - (bounds.bottom - bounds.top + 1)) / 2 - bounds.top);
  if (c.text.anchor === 'center-facing' && position === 'bottom') return Math.floor(panelY + g.panelHeight - c.text.margin - bounds.bottom - 1);
  return Math.round(panelY + c.text.margin - bounds.top);
}
export function revealPage(words, p, c, fps) {
  const glyphs = [], charFrames = []; let previous = '';
  for (const w of words) {
    const chars = graphemes(w.token, c.text.locale);
    const gap = tokenGap(previous, w.token, c.text.source);
    const firstFrame = Math.max(0, Math.min(p.frames - 1, Math.round((w.startMs / 1000 - p.startSeconds) * fps.value)));
    for (const ch of graphemes(gap, c.text.locale)) { glyphs.push(ch); charFrames.push(firstFrame); }
    chars.forEach((ch, i) => {
      const absoluteSeconds = (w.startMs + (w.endMs - w.startMs) * i / chars.length) / 1000;
      // Do not compress a word's duration when a clip cuts through its middle.
      let frame = Math.round((absoluteSeconds - p.startSeconds) * fps.value);
      if (absoluteSeconds < p.endSeconds) frame = Math.min(frame, p.frames - 1);
      glyphs.push(ch); charFrames.push(Math.max(0, frame));
    });
    previous = w.token;
  }
  const changes = new Map();
  charFrames.forEach((f, i) => { if (f < p.frames) changes.set(f, i + 1); });
  return { glyphs, changes: [...changes.entries()].sort((a, b) => a[0] - b[0]) };
}
async function makeSubtitles(ctx, p, dir) {
  const words = wordsForClip(ctx.wordData.words, p);
  const count = graphemes(pageText(words, ctx.c.text.source), ctx.c.text.locale).length;
  assert(count <= ctx.c.text.maxGraphemesPerClip, `Clip ${p.index}: transcript exceeds maxGraphemesPerClip`);
  const pages = await paginate(ctx, words);
  const panelY = p.position === 'top' ? ctx.g.bottomY : 0;
  const y = panelY + ctx.c.text.margin;
  let ass = assHeader(ctx.c, ctx.g.w, ctx.g.h, ctx.c.text.margin, ctx.c.text.margin, y);
  const prepared = pages.map(page => ({ ...page, reveal: revealPage(page.words, p, ctx.c, ctx.fps) }));
  const report = [];
  for (let i = 0; i < prepared.length; i++) {
    const { words: ws, bounds, reveal: r } = prepared[i];
    const originY = captionOrigin(ctx.c, ctx.g, p.position, bounds);
    const next = prepared[i + 1]?.reveal.changes[0]?.[0] ?? p.frames;
    report.push({ text: pageText(ws, ctx.c.text.source), bounds, originX: ctx.c.text.margin, originY,
      firstFrame: r.changes[0]?.[0] ?? 0, endFrame: next, updates: r.changes.length });
    const pageSeconds = (next - (r.changes[0]?.[0] ?? 0)) / ctx.fps.value;
    if (pageSeconds < ctx.c.text.minPageSeconds) ctx.warnings.push(`Clip ${p.index} page ${i + 1}: only ${num(pageSeconds)}s on screen; inspect readability.`);
    r.changes.forEach(([frame, count], j) => {
      const endFrame = Math.min(next, r.changes[j + 1]?.[0] ?? next);
      if (endFrame <= frame) return;
      const visible = r.glyphs.slice(0, count).join(''), hidden = r.glyphs.slice(count).join('');
      // Hidden suffix remains in the SAME dialogue, keeping the page's geometry fixed.
      const text = `{\\q0\\pos(${ctx.c.text.margin},${originY})\\clip(0,${panelY},${ctx.g.w},${panelY + ctx.g.panelHeight})\\alpha&H00&}${visible}{\\alpha&HFF&}${hidden}`;
      ass += dialogue(frameBoundaryCS(frame, ctx.fps), frameBoundaryCS(endFrame, ctx.fps), text);
    });
  }
  writeFileSync(join(dir, 'text.ass'), ass, 'utf8');
  await atomicJSON(join(dir, 'text-layout.json'), { pages: report, corrections: ctx.wordData.corrections.filter(x => words.some(w => w.section === x.section && w.index === x.index)) });
  return report;
}

// ---------- Deterministic motion/masks and the bounded-size FFmpeg graph ----------
export function smootherstep(u) { u = Math.max(0, Math.min(1, u)); return u * u * u * (u * (u * 6 - 15) + 10); }
export function motion(p, fps, seconds) {
  const frames = Math.min(Math.round(seconds * fps.value), Math.floor((p.frames - 1) / 3));
  return { transitionFrames: frames, transitionSeconds: frames / fps.value,
    lastTime: (p.frames - 1) / fps.value };
}
function num(n) { return Number(n.toFixed(9)).toString(); }
function envelopeExpr(p, fps, seconds, variable) {
  const m = motion(p, fps, seconds);
  if (!m.transitionFrames) return '1';
  const u = `clip(min(${variable}/${num(m.transitionSeconds)},(${num(m.lastTime)}-${variable})/${num(m.transitionSeconds)}),0,1)`;
  return `(${u})*(${u})*(${u})*((${u})*(6*(${u})-15)+10)`;
}
export function dustPGM(w, h, seed) {
  // Smooth multi-scale deterministic value noise; no RNG state in FFmpeg threads.
  function hash(x, y, octave) {
    let v = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263) ^ seed ^ Math.imul(octave, 2246822519);
    v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, scale, octave) {
    x /= scale; y /= scale;
    const ix = Math.floor(x), iy = Math.floor(y), fx = smootherstep(x - ix), fy = smootherstep(y - iy);
    const a = hash(ix, iy, octave) * (1 - fx) + hash(ix + 1, iy, octave) * fx;
    const b = hash(ix, iy + 1, octave) * (1 - fx) + hash(ix + 1, iy + 1, octave) * fx;
    return a * (1 - fy) + b * fy;
  }
  const data = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    data[y * w + x] = Math.round(255 * (0.55 * noise(x, y, 19, 1) + 0.3 * noise(x, y, 7, 2) + 0.15 * noise(x, y, 2, 3)));
  return Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`), data]);
}
function isAlpha(v) {
  return /^(?:yuva|gbrap|rgba|bgra|argb|abgr|ya\d|ayuv|vuya)/.test(v.pix_fmt ?? '') || String(v.tags?.alpha_mode) === '1';
}
function narratorDecoder(p) {
  return p.narrator.mode === 'alpha' && String(p.narratorVideo.tags?.alpha_mode) === '1' && p.narratorVideo.codec_name === 'vp9'
    ? ['-c:v', 'libvpx-vp9'] : [];
}
// ---------- House palette, still paper assets and clip-locked narrator grading ----------
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function ppm(w, h, pixels) { return Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), pixels]); }
/** Parameters named in pixels for the art treatment scale from a 1080-wide canvas.
 * Caption font/margins remain explicit output pixels, as in the v2 tool. */
export function narratorGeometry(g, narrator, sw, sh) {
  const mat = narrator.card.enabled ? Math.max(0, Math.round(narrator.card.mat * g.w / 1080)) : 0;
  const maxW = Math.floor(g.w * narrator.widthFraction / 2) * 2;
  const maxH = Math.floor(Math.min(g.panelHeight - 2 * narrator.panelMargin, g.ch - 4) / 2) * 2;
  assert(maxW > 2 * mat + 4 && maxH > 2 * mat + 4, 'Narrator card/mat cannot fit the assigned panel and center occluder');
  let cw, ch, nw, nh;
  if (narrator.card.enabled) {
    const scale = Math.min(maxW - 2 * mat, (maxH - 2 * mat) * narrator.card.aspect);
    cw = Math.floor(scale / 2) * 2 + 2 * mat;
    ch = Math.floor((scale / narrator.card.aspect) / 2) * 2 + 2 * mat;
    const f = Math.min((cw - 2 * mat) / sw, (ch - 2 * mat) / sh);
    nw = Math.max(2, Math.floor(sw * f / 2) * 2);
    nh = Math.max(2, Math.floor(sh * f / 2) * 2);
  } else {
    const f = Math.min(maxW / sw, maxH / sh);
    cw = nw = Math.max(2, Math.floor(sw * f / 2) * 2);
    ch = nh = Math.max(2, Math.floor(sh * f / 2) * 2);
  }
  assert(cw <= g.w && ch < g.ch && ch < g.panelHeight, 'Narrator must fit fully behind the protected center');
  return { narratorFit: { w: nw, h: nh }, cardFit: { w: cw, h: ch, mat },
    narratorInset: { x: (cw - nw) / 2, y: (ch - nh) / 2 } };
}
function canvasRaster(w, h, fill) {
  const data = Buffer.alloc(w * h * 3), c = rgb(fill);
  for (let i = 0; i < data.length; i += 3) { data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; }
  function point(x, y, color, alpha) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 3;
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(data[i + k] * (1 - alpha) + color[k] * alpha);
  }
  function rect(x, y, rw, rh, radius, color, opacity = 1) {
    const r = Math.min(radius, rw / 2, rh / 2), c = rgb(color);
    for (let py = Math.max(0, Math.floor(y - 1)); py < Math.min(h, Math.ceil(y + rh + 1)); py++)
      for (let px = Math.max(0, Math.floor(x - 1)); px < Math.min(w, Math.ceil(x + rw + 1)); px++) {
        const dx = Math.abs(px + 0.5 - x - rw / 2) - rw / 2 + r;
        const dy = Math.abs(py + 0.5 - y - rh / 2) - rh / 2 + r;
        const sd = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
        const coverage = clamp(0.5 - sd);
        if (coverage) point(px, py, c, opacity * coverage);
      }
  }
  return { data, point, rect };
}
export function paperPPM(c, g) {
  const r = canvasRaster(g.w, g.h, c.canvas.paperColor), s = g.w / 1080;
  const x = Math.round(54 * s), y = Math.round(36 * s), w = g.w - 2 * x, h = g.h - 2 * y;
  r.rect(x + 2 * s, y + 5 * s, w, h, 20 * s, '#493e36', 0.045);
  r.rect(x, y, w, h, 20 * s, c.paper.edgeColor, 0.65);
  r.rect(x + s, y + s, w - 2 * s, h - 2 * s, 19 * s, c.paper.color);
  if (c.paper.ruling) {
    // Unmoving page furniture, shared by both layouts. No extra wobble on top of the drawing's own motion.
    for (const origin of [0, g.bottomY]) {
      for (let ly = Math.round(100 * s); ly < g.panelHeight - 50 * s; ly += Math.max(12, Math.round(84 * s)))
        r.rect(82 * s, origin + ly, g.w - 164 * s, Math.max(0.7, s), 0, c.paper.edgeColor, c.paper.ruleOpacity);
      r.rect(84 * s, origin + 54 * s, Math.max(0.7, s), g.panelHeight - 108 * s, 0, c.paper.marginColor, 0.12);
    }
  }
  if (c.paper.grain > 0) for (let py = Math.ceil(y + 20 * s); py < y + h - 20 * s; py++)
    for (let px = Math.ceil(x + 2 * s); px < x + w - 2 * s; px++) {
      let hash = Math.imul(px + 11, 374761393) ^ Math.imul(py + 7, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      const noise = (((hash ^ (hash >>> 16)) >>> 0) / 4294967295 - 0.5) * 2 * c.paper.grain;
      const i = (py * g.w + px) * 3;
      for (let k = 0; k < 3; k++) r.data[i + k] = clamp(Math.round(r.data[i + k] + noise), 0, 255);
    }
  return ppm(g.w, g.h, r.data);
}
export function cardPPM(c, p) {
  const { w, h } = p.cardFit, r = canvasRaster(w, h, c.paper.color);
  const opacity = p.narrator.card.edgeOpacity, edge = rgb(c.paper.edgeColor);
  for (let x = 0; x < w; x++) { r.point(x, 0, edge, opacity); r.point(x, h - 1, edge, opacity); }
  for (let y = 1; y < h - 1; y++) { r.point(0, y, edge, opacity); r.point(w - 1, y, edge, opacity); }
  return ppm(w, h, r.data);
}
export function gradeRGB(input, grade, levels = { black: 0, white: 1 }) {
  if (grade.mode === 'off' || grade.strength === 0) return [...input];
  const l = 0.2126 * input[0] + 0.7152 * input[1] + 0.0722 * input[2];
  const tone = Math.pow(clamp((l - levels.black) / (levels.white - levels.black)), 1 / grade.gamma);
  const ink = rgb(grade.inkColor).map(x => x / 255), paper = rgb(grade.paperColor).map(x => x / 255);
  const chroma = grade.colorRetention * 4 * tone * (1 - tone);
  return input.map((v, k) => clamp(v * (1 - grade.strength) + grade.strength *
    (ink[k] + (paper[k] - ink[k]) * tone + chroma * (v - l))));
}
export function lutCube(grade, levels, size = 33) {
  const lines = ['TITLE "Notebook narrator only"', `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  // .cube uses red as the fastest-changing axis. Alpha is carried separately.
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++)
    lines.push(gradeRGB([r, g, b].map(x => x / (size - 1)), grade, levels).map(x => x.toFixed(7)).join(' '));
  return `${lines.join('\n')}\n`;
}
function percentile(hist, q) {
  const count = hist.reduce((a, b) => a + b, 0); if (!count) return null;
  let n = 0; for (let i = 0; i < hist.length; i++) { n += hist[i]; if (n >= q * count) return i / (hist.length - 1); }
  return 1;
}
export function lockedLevels(samples, grade) {
  const median = values => { const a = values.filter(x => x !== null).sort((a, b) => a - b); return a.length ? a[Math.floor(a.length / 2)] : null; };
  const lo = median(samples.map(x => x.black)), hi = median(samples.map(x => x.white));
  return { black: grade.blackPoint ?? (grade.autoLevels ? clamp(lo ?? 0, 0, grade.maxBlackPoint) : 0),
    white: grade.whitePoint ?? (grade.autoLevels ? clamp(hi ?? 1, grade.minWhitePoint, 1) : 1) };
}
async function analyzeGrade(ctx, p, dir) {
  const grade = p.narrator.grade, samples = [];
  if (grade.mode !== 'off' && grade.strength > 0 && grade.autoLevels && (grade.blackPoint === null || grade.whitePoint === null)) {
    const duration = Math.min(p.seconds, p.narratorVideo.measuredDuration - p.narrator.offsetSeconds);
    const f = Math.min(192 / p.narratorVideo.width, 108 / p.narratorVideo.height);
    const w = Math.max(2, Math.floor(p.narratorVideo.width * f / 2) * 2), h = Math.max(2, Math.floor(p.narratorVideo.height * f / 2) * 2);
    const sourceRate = String(p.narratorVideo.avg_frame_rate ?? '30/1').split('/').map(Number);
    const frameSeconds = 1 / (sourceRate[0] / (sourceRate[1] || 1) || 30);
    for (let i = 0; i < grade.sampleFrames; i++) {
      const at = Math.max(0, p.narrator.offsetSeconds + Math.min(duration * (i + 0.5) / grade.sampleFrames, Math.max(0, duration - 2 * frameSeconds)));
      const args = ['-ss', num(at), ...narratorDecoder(p), '-threads', String(ctx.c.encode.threads), '-i', p.narratorPath];
      let filter = '[0:v:0]format=rgba';
      if (p.narrator.mode === 'alpha' && p.narrator.alphaType === 'premultiplied') filter += ',unpremultiply=inplace=1';
      if (p.narrator.mode === 'colorkey') filter += `,colorkey=color=${p.narrator.keyColor}:similarity=${p.narrator.keySimilarity}:blend=${p.narrator.keyBlend}`;
      filter += `,scale=${w}:${h}:flags=area,setsar=1`;
      if (p.maskPath) {
        if (!p.maskIsStill) args.push('-ss', num(at));
        args.push('-threads', String(ctx.c.encode.threads), '-i', p.maskPath);
        filter += `[c];[1:v:0]scale=${w}:${h}:flags=area,format=gray${p.narrator.invertMask ? ',negate' : ''}[a];[c][a]alphamerge`;
      }
      filter += ',format=rgba[sample]';
      const result = await ff(ctx, [...args, '-filter_complex', filter, '-map', '[sample]', '-frames:v', '1',
        '-an', '-c:v', 'rawvideo', '-threads:v', '1', '-f', 'rawvideo', 'pipe:1'],
      { cwd: dir, log: join(dir, `grade-sample-${i}.log`), binary: true, cap: w * h * 4 + 4096 });
      if (result.stdout.length === 0) { samples.push({ time: at, black: null, white: null, empty: true }); continue; }
      assert(result.stdout.length === w * h * 4, 'Unexpected grade sample raster size');
      const hist = Array(256).fill(0), raw = result.stdout;
      for (let k = 0; k < raw.length; k += 4) if (raw[k + 3] > 230)
        hist[Math.round(0.2126 * raw[k] + 0.7152 * raw[k + 1] + 0.0722 * raw[k + 2])]++;
      samples.push({ time: at, black: percentile(hist, 0.02), white: percentile(hist, 0.98), opaquePixels: hist.reduce((a, b) => a + b, 0) });
    }
  }
  const levels = lockedLevels(samples, grade);
  assert(levels.white > levels.black, 'Grade white point must exceed black point');
  const report = { mode: grade.mode, grade, levels, samples, temporalPolicy: 'One fixed LUT for the entire clip; never frame-by-frame auto-exposure.',
    card: p.cardFit, image: p.narratorFit, transition: ctx.c.transition,
    note: 'Color/style harmonization only; no segmentation, face tracking, denoising or re-drawing.' };
  if (grade.mode !== 'off' && grade.strength > 0 && grade.autoLevels && samples.length && samples.every(x => x.black === null))
    ctx.warnings.push(`Clip ${p.index}: no opaque grade samples; using fixed level endpoints.`);
  if (grade.mode !== 'off' && grade.strength > 0) writeFileSync(join(dir, 'narrator.cube'), lutCube(grade, levels), 'utf8');
  await atomicJSON(join(dir, 'style-report.json'), report);
  return report;
}
// Sample the same motion in overlay and in the low-resolution edge-mask renderer.
export function narratorY(g, card, position, envelope) {
  const hidden = g.cy + (g.ch - card.h) / 2;
  const shown = (position === 'top' ? 0 : g.bottomY) + (g.panelHeight - card.h) / 2;
  return Math.floor(hidden + (shown - hidden) * envelope);
}
export function edgeOpacity(distance, noise, feather, irregularity) {
  return clamp((distance - noise * irregularity) / feather);
}
export function makeGraph(ctx, p, { maskInput, edgeInput, backgroundInput, cardInput, drawingFit, narratorFit, text = true }) {
  const { c, g, fps } = ctx, f = fps.text, n = p.frames, d = num(p.seconds), nf = narratorFit;
  const card = p.cardFit ?? nf;
  const hiddenY = g.cy + (g.ch - card.h) / 2;
  const shownY = (p.position === 'top' ? 0 : g.bottomY) + (g.panelHeight - card.h) / 2;
  const yExpr = variable => `floor(${num(hiddenY)}+(${num(shownY - hiddenY)})*(${envelopeExpr(p, fps, c.transition.seconds, variable)}))`;
  const parts = [];
  if (backgroundInput !== undefined) parts.push(`[${backgroundInput}:v:0]format=rgb24,trim=end_frame=${n},setpts=N/(${f}*TB)[paper]`);
  else parts.push(`color=c=${c.canvas.paperColor}:s=${g.w}x${g.h}:r=${f}:d=${d},format=rgb24[paper]`);
  // AUTHORITATIVE DRAWING: no grade, mask, frame, texture, sharpening or cropping here.
  parts.push(`[0:${p.originalVideo?.index ?? 'v:0'}]fps=fps=${f}:start_time=0:round=near,tpad=stop_mode=clone:stop_duration=${num(2 / fps.value)},trim=end_frame=${n},setpts=N/(${f}*TB),format=rgb24,scale=${drawingFit.w}:${drawingFit.h}:flags=lanczos,setsar=1,pad=${g.w}:${g.ch}:${(g.w - drawingFit.w) / 2}:${(g.ch - drawingFit.h) / 2}:color=${c.canvas.paperColor}[drawing]`);
  const timing = `trim=start=${num(p.narrator.offsetSeconds)},setpts=PTS-STARTPTS,fps=fps=${f}:start_time=0,tpad=stop_mode=clone:stop_duration=${d},trim=end_frame=${n},setpts=N/(${f}*TB)`;
  let np = `[1:${p.narratorVideo?.index ?? 'v:0'}]${timing}`;
  if (p.narrator.mode === 'alpha') {
    np += ',format=rgba';
    if (p.narrator.alphaType === 'premultiplied') np += ',unpremultiply=inplace=1';
  } else np += ',format=rgb24,format=rgba';
  // Key before grading: the key is a source-space color, not a post-LUT color.
  if (p.narrator.mode === 'colorkey') np += `,colorkey=color=${p.narrator.keyColor}:similarity=${p.narrator.keySimilarity}:blend=${p.narrator.keyBlend}`;
  np += '[nRaw]'; parts.push(np);
  let label = 'nRaw';
  if (maskInput !== undefined) {
    // A still mask has no temporal origin. Apply the matte before resampling RGB.
    const maskTiming = p.maskIsStill ? `trim=end_frame=${n},setpts=N/(${f}*TB)` : timing;
    parts.push(`[${maskInput}:${p.maskVideoIndex ?? 'v:0'}]${maskTiming},setsar=1,format=gray${p.narrator.invertMask ? ',negate' : ''}[externalmask]`);
    parts.push('[nRaw]format=rgb24[nrgb0]');
    parts.push('[nrgb0][externalmask]alphamerge[nmasked]'); label = 'nmasked';
  }
  if (p.narrator.mode !== 'opaque') {
    // Resample premultiplied color with alpha, then return to straight alpha for LUT/overlay.
    // Otherwise the RGB in fully transparent pixels can produce dark/colored fringes.
    parts.push(`[${label}]format=gbrap,premultiply=inplace=1,scale=${nf.w}:${nf.h}:flags=lanczos,format=gbrap,unpremultiply=inplace=1,setsar=1,format=rgba[n0]`);
  } else parts.push(`[${label}]scale=${nf.w}:${nf.h}:flags=lanczos,setsar=1,format=rgba[n0]`);
  label = 'n0';
  if (p.narrator.grade.mode !== 'off' && p.narrator.grade.strength > 0) {
    parts.push(`[${label}]format=rgba,split[nGradeColor][nGradeAlpha]`);
    parts.push('[nGradeAlpha]format=rgba,alphaextract[nSavedAlpha]');
    parts.push('[nGradeColor]format=rgb24,lut3d=file=narrator.cube:interp=tetrahedral[nGradedRGB]');
    parts.push('[nGradedRGB][nSavedAlpha]alphamerge[nGraded]'); label = 'nGraded';
  }
  if (cardInput !== undefined) {
    parts.push(`[${cardInput}:v:0]format=rgb24,trim=end_frame=${n},setpts=N/(${f}*TB)[cardBase]`);
    parts.push(`[cardBase][${label}]overlay=x=${(card.w - nf.w) / 2}:y=${(card.h - nf.h) / 2}:format=rgb:alpha=straight:eof_action=repeat:shortest=0,format=rgba[nCard]`);
    label = 'nCard';
  }
  if (edgeInput !== undefined) {
    // Opacity varies ONLY in a thin strip immediately outside the protected center.
    // p(X,0) is a fixed 1D deckle profile. Revealed face/ink stays fully opaque.
    const globalY = `(Y*${num(card.h)}/H+${yExpr('T')})`;
    const distance = p.position === 'top' ? `${num(g.cy)}-${globalY}` : `${globalY}-${num(g.bottomY)}`;
    const scale = g.w / 1080;
    parts.push(`[${edgeInput}:v:0]format=gray,trim=end_frame=${n},setpts=N/(${f}*TB),geq=lum='255*clip(((${distance})-${num(c.transition.irregularity * scale)}*p(X,0)/255)/${num(c.transition.feather * scale)},0,1)',scale=${card.w}:${card.h}:flags=bilinear[edgeMask]`);
    parts.push(`[${label}]format=rgba,split[nEdgeColor][nEdgeAlpha]`);
    parts.push('[nEdgeAlpha]format=rgba,alphaextract[nSourceAlpha]');
    parts.push('[nSourceAlpha][edgeMask]blend=all_mode=multiply[nEdgeOpacity]');
    parts.push('[nEdgeColor][nEdgeOpacity]alphamerge[nReady]'); label = 'nReady';
  }
  parts.push(`[paper][${label}]overlay=x=${(g.w - card.w) / 2}:y='${yExpr('t')}':eval=frame:format=rgb:alpha=straight:eof_action=repeat:repeatlast=1:shortest=0[withNarrator]`);
  if (text) parts.push('[withNarrator]ass=filename=text.ass:fontsdir=fonts[withText]');
  // The drawing AND its full-width opaque backing cover ALL other artwork in this band.
  parts.push(`[${text ? 'withText' : 'withNarrator'}][drawing]overlay=x=0:y=${g.cy}:format=rgb:alpha=straight:eof_action=repeat:repeatlast=1:shortest=0[composite]`);
  parts.push(`[composite]trim=end_frame=${n},setpts=N/(${f}*TB),scale=iw:ih:in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p,setsar=1[vout]`);
  return parts.join(';\n');
}

// ---------- Inputs, preflight, rendering, sample-accurate audio, safe joining ----------
async function capabilities(ctx) {
  const a = await run(ctx.ffmpeg, ['-version']), b = await run(ctx.ffprobe, ['-version']);
  const ver = a.stdout.match(/ffmpeg version\s+(?:n)?(\d+)\.(\d+)/);
  assert(ver && (Number(ver[1]) > 7 || (Number(ver[1]) === 7 && Number(ver[2]) >= 1)), 'FFmpeg >= 7.1 required (a versioned build, not an unidentified wrapper)');
  const filters = (await run(ctx.ffmpeg, ['-hide_banner', '-filters'])).stdout;
  for (const filter of CHECK_FILTERS) assert(new RegExp(`\\b${filter}\\s`).test(filters), `FFmpeg filter missing: ${filter}`);
  const encoders = (await run(ctx.ffmpeg, ['-hide_banner', '-encoders'])).stdout;
  for (const enc of ['libx264', ctx.c.audio.codec, 'pcm_s32le']) assert(new RegExp(`\\b${enc}\\s`).test(encoders), `FFmpeg encoder missing: ${enc}`);
  ctx.decoders = (await run(ctx.ffmpeg, ['-hide_banner', '-decoders'])).stdout;
  ctx.build = { ffmpeg: a.stdout, ffprobe: b.stdout, node: process.version };
}
function resolveFont(c, episode) {
  if (c.text.fontFile) {
    assert(c.text.fontName, 'Set text.fontName / --font-name to the internal font family when supplying a font file');
    c.text.fontFile = resolve(episode, c.text.fontFile);
  } else if (process.platform === 'win32') {
    c.text.fontFile = join(process.env.WINDIR ?? 'C:/Windows', 'Fonts', 'segoepr.ttf');
    c.text.fontName ??= 'Segoe Print';
    assert(existsSync(c.text.fontFile), 'Segoe Print not found. Supply --font-file and --font-name explicitly; no silent font substitution.');
  } else {
    const found = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/Library/Fonts/Arial.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf'].find(existsSync);
    assert(found, 'No default font found; set --font-file and --font-name');
    c.text.fontFile = found; c.text.fontName ??= found.includes('DejaVu') ? 'DejaVu Sans' : 'Arial';
  }
  requireFile(c.text.fontFile);
  c.text.fallbackFonts = c.text.fallbackFonts.map(f => requireFile(resolve(episode, f)));
  for (const f of c.text.fallbackFonts) assert(['.ttf', '.otf', '.ttc'].includes(extname(f).toLowerCase()), 'Fallback must be a font file');
  assert(['.ttf', '.otf', '.ttc'].includes(extname(c.text.fontFile).toLowerCase()), 'Font must be TTF, OTF or TTC');
  assert(typeof c.text.fontName === 'string' && c.text.fontName.length > 0 && !/[,{}\\\r\n]/.test(c.text.fontName), 'Invalid font family name');
  return c.text.fontFile;
}
async function readInputs(ctx) {
  const { c } = ctx;
  let masterInfo;
  if (c.sourceMode === 'master') {
    ctx.masterPath = requireFile(resolve(ctx.episode, c.master));
    masterInfo = await probe(ctx, ctx.masterPath);
    ctx.masterVideo = validateVideo(masterInfo, 'Master', { original: true });
    const end = ctx.selected.at(-1).endSeconds;
    assert(ctx.masterVideo.measuredDuration + 1 / ctx.fps.value >= end, 'Master video is shorter than the selected timeline');
    validateAudio(masterInfo, 'Master', c, end);
    ctx.masterInfo = masterInfo;
  } else ctx.warnings.push('CLIPS mode: upstream cut offsets/duplicate frames cannot be reconstructed. Prefer the continuous master out.mp4.');
  const sidecar = join(ctx.narratorDir, 'narrator-index.json');
  let narrIndex = null;
  if (existsSync(sidecar)) {
    narrIndex = json(sidecar); assert(Array.isArray(narrIndex.clips), 'narrator-index.json needs a clips array');
  } else ctx.warnings.push('No narrator-index.json: numeric filename pairing cannot prove that narrator clip 001 corresponds to source clip 001. Check v2/v3 cut compatibility.');
  for (const p of ctx.selected) {
    p.originalPath = c.sourceMode === 'master' ? ctx.masterPath : requireFile(join(ctx.originalDir, p.filename));
    const oi = masterInfo ?? await probe(ctx, p.originalPath);
    p.originalVideo = validateVideo(oi, `Original ${p.index}`, { original: true });
    if (c.sourceMode === 'clips') {
      assert(p.originalVideo.measuredDuration + 1 / ctx.fps.value >= p.seconds, `Original ${p.index} is too short`);
      validateAudio(oi, `Original ${p.index}`, c, p.seconds);
    }
    const meta = narrIndex?.clips.filter(x => x.index === p.index);
    if (meta) {
      assert(meta.length === 1, `narrator-index.json must contain clip ${p.index} exactly once`);
      assert(Math.abs(Number(meta[0].startMs) - p.startMs) < 0.05 && Math.abs(Number(meta[0].endMs) - p.endMs) < 0.05,
        `Narrator ${p.index} belongs to a different source cut; startMs/endMs do not match`);
      p.narratorFilename ??= meta[0].filename;
    }
    p.narratorPath = matchFile(ctx.narratorDir, p.index, VIDEO_EXT, p.narratorFilename);
    const ni = await probe(ctx, p.narratorPath);
    p.narratorVideo = validateVideo(ni, `Narrator ${p.index}`);
    const available = p.narratorVideo.measuredDuration - p.narrator.offsetSeconds;
    assert(available > 0, `Narrator ${p.index}: offset consumes the entire clip`);
    if (p.narrator.durationPolicy === 'error') assert(Math.abs(available - p.seconds) <= 1 / ctx.fps.value + 0.001, `Narrator ${p.index}: duration mismatch under error policy`);
    if (p.narrator.durationPolicy === 'freeze') assert(p.seconds - available <= p.narrator.maxFreezeSeconds + 1 / ctx.fps.value,
      `Narrator ${p.index}: would freeze more than ${p.narrator.maxFreezeSeconds}s; check clip pairing or explicitly increase narrator.maxFreezeSeconds`);
    if (available < p.seconds - 1 / ctx.fps.value)
      ctx.warnings.push(`Narrator ${p.index}: ${num(p.seconds - available)}s short; ${p.narrator.durationPolicy === 'loop' ? 'looping visual input' : 'freezing last visual frame'}. Original audio is not changed.`);
    if (available > p.seconds + 1 / ctx.fps.value)
      ctx.warnings.push(`Narrator ${p.index}: ${num(available - p.seconds)}s excess visual duration will be trimmed. Check that this is the correct source cut.`);
    if (p.narrator.mode === 'alpha') {
      assert(isAlpha(p.narratorVideo), `Narrator ${p.index}: alpha mode requested but no alpha-capable pixel format/alpha_mode tag found`);
      if (String(p.narratorVideo.tags?.alpha_mode) === '1') {
        assert(p.narratorVideo.codec_name === 'vp9', 'Alpha WebM is supported only through libvpx-vp9 in this version');
        assert(/\blibvpx-vp9\s/.test(ctx.decoders), 'Alpha WebM requires FFmpeg decoder libvpx-vp9');
      }
    }
    if (p.narrator.mode === 'mask') {
      p.maskPath = matchFile(ctx.maskDir, p.index, new Set([...VIDEO_EXT, ...STILL_EXT]), p.maskFilename);
      const mi = await probe(ctx, p.maskPath), mv = videoStream(mi);
      assert(mv && mv.width === p.narratorVideo.width && mv.height === p.narratorVideo.height,
        `Mask ${p.index} must have the narrator's source pixel dimensions`);
      p.maskVideoIndex = mv.index;
      p.maskIsStill = STILL_EXT.has(extname(p.maskPath).toLowerCase());
      if (!p.maskIsStill) {
        validateVideo(mi, `Mask ${p.index}`);
        assert(Math.abs(streamDuration(mv, mi) - p.narratorVideo.measuredDuration) <= 1 / ctx.fps.value + 0.001,
          `Mask ${p.index} and narrator duration differ; synchronize the mask first`);
      }
    }
    p.drawingFit = contain(p.originalVideo.width, p.originalVideo.height, ctx.g.w, ctx.g.ch);
    Object.assign(p, narratorGeometry(ctx.g, p.narrator, p.narratorVideo.width, p.narratorVideo.height));
    if (!p.drawingFit.exactAspect) ctx.warnings.push(`Original ${p.index}: nonstandard aspect fitted to even pixels; tiny aspect rounding is unavoidable.`);
  }
}
async function sourceFingerprint(ctx, path) {
  if (!ctx.sourceHashes.has(path)) ctx.sourceHashes.set(path, await hashFile(path));
  return ctx.sourceHashes.get(path);
}
async function preparePCM(ctx, source, destination, samples, expectedSeconds) {
  const fp = digest({ kind: 'pcm', source: await sourceFingerprint(ctx, source), samples,
    audio: ctx.c.audio, build: ctx.build, implementation: ctx.selfHash });
  if (await reusable(destination, fp)) return { path: destination, fingerprint: fp };
  const temp = `${destination}.partial.wav`;
  mkdirSync(dirname(temp), { recursive: true });
  await ff(ctx, ['-threads', String(ctx.c.encode.threads), '-i', source,
    '-map', `0:a:${ctx.c.audio.stream}`, '-vn', '-sn', '-dn',
    '-af', `aresample=${ctx.c.audio.sampleRate}:async=0:first_pts=0,atrim=end_sample=${samples},asetpts=N/SR/TB`,
    '-ac', String(ctx.c.audio.channels), '-ar', String(ctx.c.audio.sampleRate),
    '-c:a', 'pcm_s32le', '-rf64', 'auto', '-map_metadata', '-1', temp],
  { log: `${destination}.log` });
  let info = await probe(ctx, temp), a = audioStream(info, 0);
  assert(a && a.time_base === `1/${ctx.c.audio.sampleRate}` && Number.isSafeInteger(Number(a.duration_ts)),
    'PCM normalization did not return an exact sample count');
  const decodedSamples = Number(a.duration_ts), shortage = samples - decodedSamples;
  assert(shortage <= Math.round(ctx.c.audio.maxTailPadSeconds * ctx.c.audio.sampleRate),
    `Decoded original audio is ${shortage / ctx.c.audio.sampleRate}s short; refusing excessive silence even if container metadata claims enough audio`);
  if (shortage > 0) {
    ctx.warnings.push(`PCM ${basename(source)}: appended ${shortage} silent tail samples to reach the video frame boundary.`);
    const padded = `${destination}.padded.partial.wav`;
    await ff(ctx, ['-i', temp, '-map', '0:a:0',
      '-af', `apad=whole_len=${samples},atrim=end_sample=${samples},asetpts=N/SR/TB`,
      '-c:a', 'pcm_s32le', '-rf64', 'auto', '-map_metadata', '-1', padded],
    { log: `${destination}.pad.log` });
    await replaceFile(padded, temp); info = await probe(ctx, temp); a = audioStream(info, 0);
  }
  assert(Number(a.duration_ts) === samples, `PCM normalization failed: expected ${samples} samples for ${expectedSeconds}s`);
  await publish(temp, destination, fp, { samples, decodedSamples, paddedSamples: Math.max(0, shortage) });
  return { path: destination, fingerprint: fp };
}
async function renderVideo(ctx, p, dir, fp) {
  const dest = join(dir, 'video.mp4');
  if (await reusable(dest, fp)) {
    console.log(`  ${String(p.index).padStart(3, '0')}: verified video cache`);
    return { path: dest, info: await probe(ctx, dest), reused: true };
  }
  await installFont(ctx, dir);
  const textLayout = await makeSubtitles(ctx, p, dir);
  await analyzeGrade(ctx, p, dir);
  const args = [];
  if (ctx.c.sourceMode === 'master' && p.startSeconds > 0) args.push('-ss', num(p.startSeconds));
  args.push('-threads', String(ctx.c.encode.threads), '-i', p.originalPath);
  if (p.narrator.durationPolicy === 'loop') args.push('-stream_loop', '-1');
  args.push(...narratorDecoder(p), '-threads', String(ctx.c.encode.threads), '-i', p.narratorPath);
  let nextInput = 2, maskInput, edgeInput, backgroundInput, cardInput;
  if (p.maskPath) {
    maskInput = nextInput++;
    if (p.maskIsStill) args.push('-loop', '1', '-framerate', ctx.fps.text);
    else if (p.narrator.durationPolicy === 'loop') args.push('-stream_loop', '-1');
    args.push('-threads', String(ctx.c.encode.threads), '-i', p.maskPath);
  }
  if (ctx.c.transition.kind === 'paper-edge' && motion(p, ctx.fps, ctx.c.transition.seconds).transitionFrames > 0) {
    edgeInput = nextInput++;
    const w = Math.max(16, Math.ceil(p.cardFit.w / 3)), h = Math.max(16, Math.ceil(p.cardFit.h / 3));
    writeFileSync(join(dir, 'edge.pgm'), dustPGM(w, h, ctx.c.transition.seed));
    args.push('-loop', '1', '-framerate', ctx.fps.text, '-i', 'edge.pgm');
  }
  backgroundInput = nextInput++;
  args.push('-loop', '1', '-framerate', ctx.fps.text, '-i', '../paper.ppm');
  if (p.narrator.card.enabled) {
    cardInput = nextInput++;
    writeFileSync(join(dir, 'card.ppm'), cardPPM(ctx.c, p));
    args.push('-loop', '1', '-framerate', ctx.fps.text, '-i', 'card.ppm');
  }
  const graph = makeGraph(ctx, p, { maskInput, edgeInput, backgroundInput, cardInput, drawingFit: p.drawingFit, narratorFit: p.narratorFit });
  writeFileSync(join(dir, 'graph.ffgraph'), graph, 'utf8');
  // File-loaded filtergraph: avoids both Windows command-line size and path escaping.
  args.push('-/filter_complex', 'graph.ffgraph', '-map', '[vout]', '-an', '-sn', '-dn',
    '-frames:v', String(p.frames), '-r', ctx.fps.text, '-fps_mode', 'cfr', '-c:v', 'libx264',
    '-preset', ctx.c.encode.preset, '-crf', String(ctx.c.encode.crf),
    '-threads:v', String(ctx.c.encode.threads), '-pix_fmt', 'yuv420p',
    '-g', String(Math.max(1, Math.round(ctx.fps.value * 2))),
    '-video_track_timescale', String(ctx.fps.timeScale),
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart',
    '-progress', 'pipe:1', 'video.partial.mp4');
  console.log(`  ${String(p.index).padStart(3, '0')}: ${p.position}, ${p.frames} frames, ${textLayout.length} text page(s)`);
  await ff(ctx, args, { cwd: dir, log: join(dir, 'render.log'), progress: true });
  const info = await validateOutput(ctx, join(dir, 'video.partial.mp4'), p.frames, 0, false);
  await publish(join(dir, 'video.partial.mp4'), dest, fp, { frames: p.frames, textLayout });
  return { path: dest, info, reused: false };
}
async function mux(ctx, videoArgs, pcmArgs, dest, frames, samples, fp) {
  if (await reusable(dest, fp)) { console.log(`  verified output: ${basename(dest)}`); return; }
  assert(!existsSync(dest) || ctx.cli.overwrite, `Output exists with changed/missing receipt: ${dest}. Use --overwrite, or another output directory.`);
  const temp = join(dirname(dest), `${basename(dest, '.mp4')}.partial.mp4`);
  await ff(ctx, [...videoArgs, ...pcmArgs, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
    '-af', `atrim=end_sample=${samples},asetpts=N/SR/TB`,
    '-c:a', ctx.c.audio.codec, ...(ctx.c.audio.codec === 'aac' ? ['-b:a', ctx.c.audio.bitrate] : []),
    '-ar', String(ctx.c.audio.sampleRate), '-ac', String(ctx.c.audio.channels),
    '-map_metadata', '-1', '-map_chapters', '-1', '-video_track_timescale', String(ctx.fps.timeScale),
    '-movflags', '+faststart', temp], { log: `${dest}.mux.log` });
  await validateOutput(ctx, temp, frames, samples, true);
  await publish(temp, dest, fp, { frames, samples });
}
async function renderAll(ctx) {
  await installFont(ctx, join(ctx.work, 'measure'));
  writeFileSync(join(ctx.work, 'paper.ppm'), paperPPM(ctx.c, ctx.g));
  ctx.selfHash = await hashFile(SELF);
  const renderConfig = structuredClone(ctx.c);
  ctx.baseFingerprint = digest({ config: renderConfig, timing: ctx.timing, manifest: ctx.manifest,
    font: await hashFile(ctx.fontFile), fallbackFonts: await Promise.all(ctx.c.text.fallbackFonts.map(hashFile)), build: ctx.build, implementation: ctx.selfHash });
  const statePath = join(ctx.outputDir, 'vertical-index.json');
  // Never present a previous complete join as current while rebuilding changed clips.
  const state = { tool: basename(SELF), version: VERSION, status: 'rendering',
    episode: ctx.episode, sourceMode: ctx.c.sourceMode, settings: ctx.c, builds: ctx.build,
    globalFingerprint: ctx.baseFingerprint, canvas: ctx.g, fps: ctx.fps,
    timing: { headMs: ctx.wordData.headMs, gapMs: ctx.wordData.gapMs, sectionOrder: ctx.wordData.sectionOrder },
    warnings: ctx.warnings, selectedClipIndices: ctx.selected.map(p => p.index),
    clips: [], fullVideo: null,
    note: 'Consult status/receipts: a pre-existing vertical-full.mp4 is not current until status is complete.' };
  await atomicJSON(statePath, state);
  let masterPCM;
  const videos = [], pcms = [];
  try {
    if (ctx.c.sourceMode === 'master') {
      const last = ctx.selected.at(-1);
      masterPCM = await preparePCM(ctx, ctx.masterPath, join(ctx.work, 'master.wav'), last.endSample, last.endSeconds);
    }
    for (const p of ctx.selected) {
      const dir = join(ctx.work, `clip${String(p.index).padStart(5, '0')}`); mkdirSync(dir, { recursive: true });
      const fp = digest({ base: ctx.baseFingerprint, clip: p,
        originalHash: await sourceFingerprint(ctx, p.originalPath),
        narratorHash: await sourceFingerprint(ctx, p.narratorPath),
        maskHash: p.maskPath ? await sourceFingerprint(ctx, p.maskPath) : null });
      const outputName = `${String(p.index).padStart(3, '0')}__${p.position}.mp4`, dest = join(ctx.outputDir, outputName);
      // Check before the expensive video encode, not only at publish time.
      const outputFingerprint = digest({ fp, stage: 'standalone', audio: ctx.c.audio });
      if (existsSync(dest) && !ctx.cli.overwrite && !(await reusable(dest, outputFingerprint)))
        fail(`Refusing to overwrite changed/unverified output ${dest}; use --overwrite`);
      const v = await renderVideo(ctx, p, dir, fp); videos.push({ ...v, p, fp });
      const pcm = masterPCM ?? await preparePCM(ctx, p.originalPath, join(dir, 'audio.wav'), p.samples, p.seconds);
      pcms.push(pcm);
      const audioArgs = masterPCM ? ['-ss', num(p.startSample / ctx.c.audio.sampleRate), '-i', pcm.path] : ['-i', pcm.path];
      await mux(ctx, ['-i', v.path], audioArgs, dest, p.frames, p.samples, outputFingerprint);
      state.clips.push({ index: p.index, filename: outputName, originalFilename: p.filename,
        narratorFilename: basename(p.narratorPath), maskFilename: p.maskPath ? basename(p.maskPath) : null,
        position: p.position, startMs: p.startMs, endMs: p.endMs,
        renderStartSeconds: p.startSeconds, renderEndSeconds: p.endSeconds,
        frames: p.frames, samples: p.samples, durationSeconds: p.seconds,
        drawingFit: p.drawingFit, narratorFit: p.narratorFit, cardFit: p.cardFit,
        styleReport: `work/clip${String(p.index).padStart(5, '0')}/style-report.json`,
        fingerprint: outputFingerprint, text: p.text ?? null });
      await atomicJSON(statePath, state);
    }
    if (!ctx.cli.noJoin) {
      const expectedSignature = stable(signature(videos[0].info));
      for (const v of videos) assert(stable(signature(v.info)) === expectedSignature,
        `Clip ${v.p.index} has incompatible H.264 parameters/extradata. Rerender all selected clips with the same configuration/build.`);
      // The concat file has generated ASCII relative paths only; no drive letters,
      // quoting helpers, transcript text, or user filenames enter its syntax.
      const videoDurations = concatDurations(videos.map(v => v.p.frames), ctx.fps.value);
      const list = 'ffconcat version 1.0\n' + videos.map((v, i) =>
        `file 'clip${String(v.p.index).padStart(5, '0')}/video.mp4'\nduration ${num(videoDurations[i])}`).join('\n') + '\n';
      writeFileSync(join(ctx.work, 'join-video.ffconcat'), list, 'utf8');
      let audioArgs;
      if (masterPCM) audioArgs = ['-ss', num(ctx.selected[0].startSample / ctx.c.audio.sampleRate), '-i', masterPCM.path];
      else {
        const audioDurations = concatDurations(videos.map(v => v.p.samples), ctx.c.audio.sampleRate);
        writeFileSync(join(ctx.work, 'join-audio.ffconcat'), 'ffconcat version 1.0\n' +
          videos.map((v, i) => `file 'clip${String(v.p.index).padStart(5, '0')}/audio.wav'\nduration ${num(audioDurations[i])}`).join('\n') + '\n');
        audioArgs = ['-f', 'concat', '-safe', '1', '-i', 'join-audio.ffconcat'];
      }
      const frames = ctx.selected.reduce((n, p) => n + p.frames, 0), samples = ctx.selected.reduce((n, p) => n + p.samples, 0);
      const fp = digest({ kind: 'join', videos: videos.map(v => v.fp), audio: pcms.map(p => p.fingerprint), frames, samples });
      const name = ctx.selected.length === ctx.allClips.length ? 'vertical-full.mp4' : 'vertical-selection.mp4';
      await mux(ctx, ['-f', 'concat', '-safe', '1', '-i', 'join-video.ffconcat'], audioArgs,
        join(ctx.outputDir, name), frames, samples, fp);
      state.fullVideo = { filename: name, frames, samples, durationSeconds: frames / ctx.fps.value, fingerprint: fp };
    }
    state.status = 'complete'; await atomicJSON(statePath, state);
    ctx.warnings.slice(ctx.reportedWarnings ?? 0).forEach(w => console.warn(`WARNING: ${w}`));
    console.log(`Complete: ${ctx.selected.length} clip(s)${state.fullVideo ? ` + ${state.fullVideo.filename}` : ''}\n${ctx.outputDir}`);
  } catch (e) {
    state.status = interrupted ? 'interrupted' : 'failed'; state.error = e.message;
    await atomicJSON(statePath, state); throw e;
  }
}

// ---------- Command line ----------
export function parseArgs(argv) {
  const flags = new Set(['help', 'version', 'print-defaults', 'dry-run', 'check-data', 'no-join', 'overwrite']);
  const values = new Set(['episode', 'config', 'original-dir', 'narrator-dir', 'mask-dir', 'output-dir',
    'timing', 'master', 'source-mode', 'fps', 'font-file', 'font-name', 'font-size', 'margin',
    'transition-seconds', 'narrator-mode', 'narrator-policy', 'pattern', 'limit', 'only', 'preset',
    'crf', 'threads', 'filter-threads', 'verify', 'ffmpeg', 'ffprobe', 'canvas-width', 'canvas-height']);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] === '-h' ? '--help' : argv[i];
    assert(arg.startsWith('--'), `Unexpected argument ${arg}`);
    const key = arg.slice(2), camel = key.replace(/-([a-z])/g, (_, x) => x.toUpperCase());
    assert(!Object.hasOwn(out, camel), `Duplicate option --${key}`);
    if (flags.has(key)) out[camel] = true;
    else {
      assert(values.has(key), `Unknown option --${key}`);
      assert(i + 1 < argv.length && !argv[i + 1].startsWith('--'), `Missing value for --${key}`);
      out[camel] = argv[++i];
    }
  }
  return out;
}
function help() {
  console.log(`Notebook vertical compositor ${VERSION}\n\nUsage:\n  node tools/make-vertical-notebook.mjs --episode <directory> [options]\n\nDefaults: master out.mp4; timing.json; out-clips-talking-face-v3/clip-index.json;\n          narrator-clips/001__*.mp4; output vertical-notebook/.\n\n  --config <file>          JSON config relative to episode; otherwise auto-load\n                          episode/vertical-notebook.json when it exists\n  --check-data            Validate only the JSON/timeline; needs no media or FFmpeg\n  --dry-run               Also check media, FFmpeg capabilities and pairing; no render\n  --original-dir <dir>    Directory containing clip-index.json (and originals in clips mode)\n  --narrator-dir <dir>    Exactly one matching narrator per selected clip\n  --mask-dir <dir>        Masks for narrator-mode=mask; white=visible\n  --master <file>         Continuous authoritative original video+audio\n  --source-mode <mode>    master (recommended) | clips (explicit fallback)\n  --output-dir <dir>      Separate output/cache/log directory\n  --timing <file>         Section timing JSON, relative to episode\n  --font-file <file>      TTF/OTF/TTC; requires --font-name <family>\n  --font-name <family>    Actual internal font family, e.g. Segoe Print\n  --font-size <px>        Default 60; uses actual libass measurement, not character counts\n  --margin <px>          Default 96\n  --fps <rational>        Otherwise manifest.settings.fps; up to 60\n  --pattern top,bottom   Alternation in manifest order; --only does not re-index it\n  --narrator-mode <mode>  opaque | alpha | colorkey | mask\n  --narrator-policy <p>   freeze (default) | loop | error\n  --transition-seconds N Default .6; 0 disables movement/edge feather\n  --limit N              First N selected clips\n  --only 2,3             Specific indices; noncontiguous selection requires --no-join\n  --no-join              Individual clips only\n  --overwrite            Replace changed generated files; never clear directories\n  --preset <x264 preset> Default medium\n  --crf N                Default 18 (H.264 is lossy)\n  --threads N            Encoder/decoder threads (default up to 8)\n  --filter-threads N     Default 2\n  --verify decode|probe  Default decode; hashes protect cached-file reuse\n  --ffmpeg <executable>  Path to real ffmpeg[.exe], not a .cmd/.bat wrapper\n  --ffprobe <executable> Path to real ffprobe[.exe]\n  --canvas-width N      Default 1080\n  --canvas-height N     Default 1920\n\nRe-running identical inputs resumes automatically. Changed inputs require\n--overwrite for existing public MP4s. There is intentionally no automatic\nbackground removal, arbitrary transcript realignment, or audio stretching.\n`);
}
function applyCLI(c, a) {
  for (const k of ['originalDir', 'narratorDir', 'maskDir', 'outputDir', 'timing', 'master', 'sourceMode', 'fps', 'verify']) if (a[k] !== undefined) c[k] = a[k];
  for (const [src, dst, key] of [
    ['fontFile', c.text, 'fontFile'], ['fontName', c.text, 'fontName'],
    ['narratorMode', c.narrator, 'mode'], ['narratorPolicy', c.narrator, 'durationPolicy'], ['preset', c.encode, 'preset'],
  ]) if (a[src] !== undefined) dst[key] = a[src];
  for (const [src, dst, key] of [
    ['fontSize', c.text, 'fontSize'], ['margin', c.text, 'margin'],
    ['transitionSeconds', c.transition, 'seconds'], ['crf', c.encode, 'crf'],
    ['threads', c.encode, 'threads'], ['filterThreads', c.encode, 'filterThreads'],
    ['canvasWidth', c.canvas, 'width'], ['canvasHeight', c.canvas, 'height'],
  ]) if (a[src] !== undefined) dst[key] = Number(a[src]);
  if (a.pattern !== undefined) c.pattern = a.pattern.split(',').map(x => x.trim());
  return c;
}
function jsonOptionalFont(p) { return existsSync(p) && json(p).text?.fontFile; }
function executable(value) {
  assert(!/\.(?:cmd|bat)$/i.test(value), 'Use a real executable, not a .cmd/.bat wrapper');
  return /[\\/]/.test(value) ? resolve(value) : value;
}
export async function main(argv = process.argv.slice(2)) {
  assert(Number(process.versions.node.split('.')[0]) >= 22, 'Node.js 22 or newer is required');
  const cli = parseArgs(argv); if (cli.help) { help(); return; }
  if (cli.version) { console.log(VERSION); return; }
  if (cli.printDefaults) { console.log(JSON.stringify(DEFAULTS, null, 2)); return; }
  assert(cli.episode, '--episode is required');
  const episode = resolve(cli.episode), configPath = resolve(episode, cli.config ?? 'vertical-notebook.json');
  if (cli.config) requireFile(configPath);
  const c = validateConfig(applyCLI(mergeConfig(DEFAULTS, existsSync(configPath) ? json(configPath) : {}), cli));
  const originalDir = resolve(episode, c.originalDir), narratorDir = resolve(episode, c.narratorDir),
    maskDir = resolve(episode, c.maskDir), outputDir = resolve(episode, c.outputDir);
  assert(![episode, originalDir, narratorDir, maskDir].includes(outputDir), 'Output directory must be distinct from episode/input directories');
  const manifest = json(requireFile(join(originalDir, 'clip-index.json'))), timing = json(requireFile(resolve(episode, c.timing)));
  const wordData = buildWords(timing, manifest, c), planned = planClips(manifest, c);
  const selected = selectClips(planned.clips, cli), g = geometry(c);
  const warnings = [];
  console.log(`Episode: ${episode}\nSource mode: ${c.sourceMode}\nCanvas: ${g.w}x${g.h}; center matte ${g.w}x${g.ch} at y=${g.cy}\nFPS: ${planned.fps.text}; head=${wordData.headMs}ms, gap=${wordData.gapMs}ms\n${selected.length}/${planned.clips.length} clips; ${wordData.words.length} timed words; ${wordData.corrections.length} scripted display corrections`);
  for (const p of selected) console.log(`  ${String(p.index).padStart(3, '0')} ${p.position}: ${num(p.startSeconds)}..${num(p.endSeconds)}s (${p.frames} frames / ${p.samples} audio samples)`);
  if (cli.checkData) {
    console.log('JSON/timeline checks passed. No media, font, filter, or alignment-by-listening checks were performed.'); return;
  }
  const ctx = { c, cli, episode, originalDir, narratorDir, maskDir, outputDir, work: join(outputDir, 'work'),
    manifest, timing, wordData, allClips: planned.clips, selected, fps: planned.fps, g, warnings,
    ffmpeg: executable(cli.ffmpeg ?? 'ffmpeg'), ffprobe: executable(cli.ffprobe ?? 'ffprobe'),
    fontFile: resolveFont(c, episode), sourceHashes: new Map(), measureCache: new Map() };
  if (process.platform !== 'win32' && !cli.fontFile && !jsonOptionalFont(configPath))
    warnings.push(`Using ${c.text.fontName} on this platform. Supply your licensed Segoe Print font to match the Windows house typography.`);
  await capabilities(ctx); await readInputs(ctx);
  protectInputs(ctx);
  for (const p of selected) console.log(`  pair ${p.index}: ${basename(p.narratorPath)} [${p.narrator.mode}], drawing ${p.drawingFit.w}x${p.drawingFit.h}, narrator ${p.narratorFit.w}x${p.narratorFit.h}`);
  warnings.forEach(w => console.warn(`WARNING: ${w}`)); ctx.reportedWarnings = warnings.length;
  if (cli.dryRun) { console.log('Media/capability checks passed. Text bounds and full decodes are checked during render.'); return; }
  const release = acquireLock(outputDir);
  try { mkdirSync(ctx.work, { recursive: true }); await renderAll(ctx); }
  finally { release(); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  const stop = () => { interrupted = true; for (const c of CHILDREN) c.kill('SIGKILL'); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  main().catch(error => { console.error(`ERROR: ${error.message}`); process.exitCode = interrupted ? 130 : 1; });
}
