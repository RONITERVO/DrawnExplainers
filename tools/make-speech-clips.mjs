#!/usr/bin/env node

/*
 * Make editing clips whose boundaries respect the narration.
 *
 * The source video stays untouched.  Boundaries are chosen at sentence ends
 * first, then at comma/colon/semicolon clause ends only when a sentence would
 * exceed the configured maximum.  A failed plan is safer than a hard split:
 * the tool refuses to cut through a sentence when no natural pause fits.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { GAP_MS, HEAD_MS, FPS } from '../lib/scene-kit.mjs';

const DEFAULTS = {
  maxSeconds: 10,
  minSeconds: 1,
  pauseFill: 0.75,
  encoderSafetyMs: 100,
  outputDir: 'out-clips-speech',
};

function usage() {
  console.log(`Usage:
  node tools/make-speech-clips.mjs --episode <episode-directory> [options]

Options:
  --video <path>             Source video (default: <episode>/out.mp4)
  --timing <path>            Timing file (default: <episode>/timing.json)
  --output-dir <path>        Output folder (default: <episode>/out-clips-speech)
  --max-seconds <number>     Hard maximum for measured output (default: 10)
  --min-seconds <number>     Minimum preferred clip length (default: 1)
  --pause-fill <0..1>        Portion of a pause kept before a cut (default: 0.75)
  --encoder-safety-ms <n>    Reserve for AAC/container padding (default: 100)
  --overwrite                Replace same-named generated files, never delete others
  --dry-run                  Print the plan without rendering video files
`);
}

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--overwrite') {
      args.overwrite = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    const key = arg.startsWith('--') ? arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null;
    if (!key || i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
    args[key] = argv[++i];
  }
  if (!args.episode) throw new Error('--episode is required');
  for (const key of ['maxSeconds', 'minSeconds', 'pauseFill', 'encoderSafetyMs']) {
    args[key] = Number(args[key]);
    if (!Number.isFinite(args[key])) throw new Error(`Invalid number for --${key}`);
  }
  if (args.maxSeconds <= 0 || args.minSeconds <= 0 || args.minSeconds > args.maxSeconds) {
    throw new Error('Require 0 < min-seconds <= max-seconds');
  }
  if (args.pauseFill < 0 || args.pauseFill > 1) throw new Error('--pause-fill must be between 0 and 1');
  if (args.encoderSafetyMs < 0) throw new Error('--encoder-safety-ms cannot be negative');
  return args;
}

function run(command, argv, { quiet = false } = {}) {
  const result = spawnSync(command, argv, {
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = quiet ? `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim() : '';
    throw new Error(`${command} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout?.trim() ?? '';
}

function probeDuration(file) {
  const value = run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { quiet: true });
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not read duration from ${file}`);
  return duration;
}

function scriptTokens(text) {
  return String(text ?? '').match(/\S+/g) ?? [];
}

function joinTokens(tokens) {
  return tokens.join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+-/g, '-')
    .trim();
}

function safeLabel(text) {
  const label = String(text ?? '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 84)
    .replace(/-+$/g, '');
  return label || 'no-narration';
}

function stamp(ms) {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const millis = totalMs % 1_000;
  return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildTimeline(timing, sourceDurationMs) {
  const sections = [];
  const words = [];
  let cursorMs = HEAD_MS;

  for (const [id, entry] of Object.entries(timing)) {
    const durationMs = Number(entry.durationMs);
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error(`${id}: invalid durationMs`);
    const tokens = scriptTokens(entry.script || entry.heard);
    if (tokens.length !== entry.words.length) {
      throw new Error(`${id}: script has ${tokens.length} tokens but timing has ${entry.words.length} words`);
    }
    const startMs = cursorMs;
    const endMs = startMs + durationMs;
    const sectionWords = entry.words.map((word, index) => ({
      section: id,
      index,
      token: tokens[index],
      startMs: startMs + Number(word.startMs),
      endMs: startMs + Number(word.endMs),
    }));
    sections.push({ id, startMs, endMs, words: sectionWords });
    words.push(...sectionWords);
    cursorMs = endMs + GAP_MS;
  }

  const finalTimingEndMs = cursorMs - GAP_MS;
  if (finalTimingEndMs > sourceDurationMs + 250) {
    throw new Error(`timing.json timeline (${finalTimingEndMs}ms) is beyond video duration (${sourceDurationMs}ms)`);
  }
  return { sections, words };
}

function buildCandidates(words, sourceDurationMs, pauseFill) {
  const candidates = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const next = words[index + 1];
    const sentence = /[.!?]["”’)]?$/u.test(word.token);
    const clause = /[,;:]["”’)]?$/u.test(word.token);
    if (!sentence && !clause) continue;

    const nextStartMs = next ? next.startMs : sourceDurationMs;
    const pauseMs = Math.max(0, nextStartMs - word.endMs);
    const cutMs = next
      ? Math.min(nextStartMs, word.endMs + pauseMs * pauseFill)
      : sourceDurationMs;
    candidates.push({
      index,
      cutMs,
      pauseMs,
      kind: sentence ? 'sentence' : 'clause',
      after: word.token,
    });
  }

  const finalWord = words.at(-1);
  if (finalWord && !/[.!?]["”’)]?$/u.test(finalWord.token)) {
    candidates.push({
      index: words.length - 1,
      cutMs: sourceDurationMs,
      pauseMs: Math.max(0, sourceDurationMs - finalWord.endMs),
      kind: 'episode-end',
      after: finalWord.token,
    });
  }
  return candidates;
}

function choosePlan(words, candidates, sourceDurationMs, options) {
  const maxLogicalMs = options.maxSeconds * 1_000 - options.encoderSafetyMs;
  const minMs = options.minSeconds * 1_000;
  if (maxLogicalMs < minMs) throw new Error('Encoder safety leaves no room for the minimum clip length');

  const plan = [];
  let startMs = 0;
  let previousWordIndex = -1;
  while (startMs < sourceDurationMs - 1) {
    const remainingMs = sourceDurationMs - startMs;
    if (remainingMs <= maxLogicalMs) {
      plan.push({ startMs, endMs: sourceDurationMs, candidate: { kind: 'episode-end', index: words.length - 1, pauseMs: 0 } });
      break;
    }

    const available = candidates.filter(candidate => (
      candidate.index > previousWordIndex
      && candidate.cutMs > startMs + minMs
      && candidate.cutMs <= startMs + maxLogicalMs + 0.001
    ));
    const sentence = available.find(candidate => candidate.kind === 'sentence');
    const clause = available
      .filter(candidate => candidate.kind === 'clause')
      .sort((a, b) => b.pauseMs - a.pauseMs || a.cutMs - b.cutMs)[0];
    const candidate = sentence || clause;

    if (!candidate) {
      const nextSentence = candidates.find(item => item.index > previousWordIndex && item.kind === 'sentence');
      const nextDescription = nextSentence
        ? `next sentence boundary is ${((nextSentence.cutMs - startMs) / 1000).toFixed(3)}s away`
        : 'no later sentence boundary exists';
      throw new Error(`Cannot keep a complete sentence under ${options.maxSeconds}s from ${stamp(startMs)}; ${nextDescription}. Add a clause pause or increase --max-seconds.`);
    }

    plan.push({ startMs, endMs: candidate.cutMs, candidate });
    startMs = candidate.cutMs;
    previousWordIndex = candidate.index;
  }
  return plan;
}

function materializePlan(plan, words, sections, sourceDurationMs, options) {
  return plan.map((item, index) => {
    const rangeWords = words.filter(word => word.startMs < item.endMs - 0.001 && word.endMs > item.startMs + 0.001);
    const text = joinTokens(rangeWords.map(word => word.token));
    const sourceSections = sections
      .filter(section => section.endMs > item.startMs && section.startMs < item.endMs)
      .map(section => section.id);
    const durationMs = item.endMs - item.startMs;
    if (durationMs < options.minSeconds * 1_000) throw new Error(`Planned clip ${index + 1} is shorter than ${options.minSeconds}s`);
    if (item.endMs > sourceDurationMs + 1) throw new Error(`Planned clip ${index + 1} exceeds source duration`);
    return {
      index: index + 1,
      startMs: item.startMs,
      endMs: Math.min(item.endMs, sourceDurationMs),
      durationMs,
      boundaryType: item.candidate.kind,
      pauseAfterLastWordMs: item.candidate.pauseMs,
      sourceSections,
      text,
      label: safeLabel(text),
    };
  });
}

function renderClip(source, destination, clip) {
  const start = (clip.startMs / 1_000).toFixed(3);
  const duration = (clip.durationMs / 1_000).toFixed(3);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', source,
    '-ss', start,
    '-t', duration,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-avoid_negative_ts', 'make_zero',
    '-shortest',
    destination,
  ]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const episodeDir = resolve(args.episode);
  const source = resolve(episodeDir, args.video || 'out.mp4');
  const timingPath = resolve(episodeDir, args.timing || 'timing.json');
  const outputDir = resolve(episodeDir, args.outputDir || DEFAULTS.outputDir);
  if (!existsSync(source)) throw new Error(`Source video not found: ${source}`);
  if (!existsSync(timingPath)) throw new Error(`Timing file not found: ${timingPath}`);

  const existing = existsSync(outputDir) ? readdirSync(outputDir) : [];
  if (existing.length && !args.overwrite) {
    throw new Error(`Output directory is not empty: ${outputDir}. Use a new folder or --overwrite.`);
  }
  if (!args.dryRun) mkdirSync(outputDir, { recursive: true });

  const sourceDurationSeconds = probeDuration(source);
  const sourceDurationMs = sourceDurationSeconds * 1_000;
  const timing = JSON.parse(readFileSync(timingPath, 'utf8'));
  const timeline = buildTimeline(timing, sourceDurationMs);
  const candidates = buildCandidates(timeline.words, sourceDurationMs, args.pauseFill);
  const rawPlan = choosePlan(timeline.words, candidates, sourceDurationMs, args);
  const clips = materializePlan(rawPlan, timeline.words, timeline.sections, sourceDurationMs, args);

  console.log(`Source: ${source}`);
  console.log(`Duration: ${sourceDurationSeconds.toFixed(3)}s | FPS: ${FPS} | clips: ${clips.length}`);
  console.log(`Boundary policy: sentence first, clause fallback; max measured target ${args.maxSeconds}s`);
  for (const clip of clips) {
    const name = `${String(clip.index).padStart(3, '0')}__${stamp(clip.startMs)}-${stamp(clip.endMs)}__${clip.label}.mp4`;
    clip.filename = name;
    console.log(`${String(clip.index).padStart(3, '0')} ${stamp(clip.startMs)}-${stamp(clip.endMs)} ${clip.boundaryType} ${clip.text}`);
  }

  if (args.dryRun) return;

  for (const clip of clips) {
    const destination = join(outputDir, clip.filename);
    if (existsSync(destination) && !args.overwrite) {
      throw new Error(`Output already exists: ${destination}`);
    }
    renderClip(source, destination, clip);
    clip.actualDurationSeconds = probeDuration(destination);
    if (clip.actualDurationSeconds > args.maxSeconds + 0.0001) {
      throw new Error(`Rendered clip exceeds hard max: ${clip.filename} is ${clip.actualDurationSeconds.toFixed(3)}s`);
    }
  }

  const manifest = {
    source: basename(source),
    timing: basename(timingPath),
    sourceDurationSeconds,
    settings: {
      maxSeconds: args.maxSeconds,
      minSeconds: args.minSeconds,
      pauseFill: args.pauseFill,
      encoderSafetyMs: args.encoderSafetyMs,
      headMs: HEAD_MS,
      gapMs: GAP_MS,
      fps: FPS,
      textSource: 'timing.json script aligned to timing.json words',
    },
    clips,
  };
  const jsonPath = join(outputDir, 'clip-index.json');
  const csvPath = join(outputDir, 'clip-index.csv');
  if (!args.overwrite && (existsSync(jsonPath) || existsSync(csvPath))) {
    throw new Error('Index file already exists; use --overwrite or choose a new output folder.');
  }
  writeFileSync(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const columns = ['index', 'filename', 'start', 'end', 'duration', 'actual_duration', 'boundary_type', 'pause_after_last_word', 'source_sections', 'spoken_text'];
  const rows = [columns.join(',')];
  for (const clip of clips) {
    rows.push([
      clip.index,
      clip.filename,
      stamp(clip.startMs),
      stamp(clip.endMs),
      `${(clip.durationMs / 1_000).toFixed(3)}s`,
      `${clip.actualDurationSeconds.toFixed(3)}s`,
      clip.boundaryType,
      `${(clip.pauseAfterLastWordMs / 1_000).toFixed(3)}s`,
      clip.sourceSections.join(';'),
      clip.text,
    ].map(csvCell).join(','));
  }
  writeFileSync(csvPath, `${rows.join('\n')}\n`, 'utf8');
  console.log(`\nWrote ${clips.length} clips and indexes to ${outputDir}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
