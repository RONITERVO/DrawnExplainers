#!/usr/bin/env node

/*
 * Make longer editing clips whose boundaries respect the narration.
 *
 * v1 is intentionally left untouched.  v2 searches the whole episode for
 * the best sequence of natural boundaries instead of always taking the first
 * sentence that fits.  Its objective is, in order:
 *   1. use the fewest clips (therefore making the average closest to 10s),
 *   2. avoid clips in the extreme-short range,
 *   3. avoid other short or highly uneven clips.
 *
 * Sentence ends are preferred.  Clause ends are available as fallbacks when
 * the next sentence would exceed the hard maximum.  The source video is never
 * deleted or modified.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { GAP_MS, HEAD_MS, FPS } from '../lib/scene-kit.mjs';

const DEFAULTS = {
  maxSeconds: 10,
  minSeconds: 1,
  targetSeconds: 10,
  extremeShortSeconds: 2,
  pauseFill: 0.75,
  encoderSafetyMs: 100,
  outputDir: 'out-clips-talking-face-v2',
};

function usage() {
  console.log(`Usage:
  node tools/make-speech-clips-v2.mjs --episode <episode-directory> [options]

Options:
  --video <path>                    Source video (default: <episode>/out.mp4)
  --timing <path>                   Timing file (default: <episode>/timing.json)
  --output-dir <path>               Output folder (default: <episode>/out-clips-talking-face-v2)
  --max-seconds <number>            Hard maximum for measured output (default: 10)
  --min-seconds <number>            Minimum clip length (default: 1)
  --target-seconds <number>         Optimization target (default: 10)
  --extreme-short-seconds <number>  Penalized short-clip threshold (default: 2)
  --pause-fill <0..1>               Portion of a pause kept before a cut (default: 0.75)
  --encoder-safety-ms <n>            Reserve for AAC/container padding (default: 100)
  --overwrite                       Replace same-named generated files, never delete others
  --dry-run                         Print the optimized plan without rendering video files
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
  for (const key of ['maxSeconds', 'minSeconds', 'targetSeconds', 'extremeShortSeconds', 'pauseFill', 'encoderSafetyMs']) {
    args[key] = Number(args[key]);
    if (!Number.isFinite(args[key])) throw new Error(`Invalid number for --${key}`);
  }
  if (args.maxSeconds <= 0 || args.minSeconds <= 0 || args.minSeconds > args.maxSeconds) {
    throw new Error('Require 0 < min-seconds <= max-seconds');
  }
  if (args.targetSeconds <= 0 || args.targetSeconds > args.maxSeconds) {
    throw new Error('Require 0 < target-seconds <= max-seconds');
  }
  if (args.extremeShortSeconds < args.minSeconds || args.extremeShortSeconds > args.maxSeconds) {
    throw new Error('Require min-seconds <= extreme-short-seconds <= max-seconds');
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

function timingTokens(entry) {
  const wordTokens = entry.words.map(word => String(word.word ?? '').trim());
  return wordTokens.length && wordTokens.every(Boolean)
    ? wordTokens
    : scriptTokens(entry.script || entry.heard);
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
    const tokens = timingTokens(entry);
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
  return candidates;
}

function pathMetrics(durations, options) {
  const extremeLimitMs = options.extremeShortSeconds * 1_000;
  const targetMs = options.targetSeconds * 1_000;
  let extremeShortCount = 0;
  let extremeShortPenalty = 0;
  let shortPenalty = 0;
  let targetDistancePenalty = 0;

  for (const durationMs of durations) {
    if (durationMs < extremeLimitMs) {
      extremeShortCount += 1;
      extremeShortPenalty += (extremeLimitMs - durationMs) ** 2;
    }
    if (durationMs < targetMs) {
      shortPenalty += (targetMs - durationMs) ** 2;
    }
    targetDistancePenalty += (targetMs - durationMs) ** 2;
  }

  return {
    clipCount: durations.length,
    extremeShortCount,
    extremeShortPenalty,
    shortPenalty,
    targetDistancePenalty,
  };
}

function comparePaths(a, b) {
  const keys = [
    ['clipCount', 1],
    ['extremeShortCount', 1],
    ['extremeShortPenalty', 1],
    ['shortPenalty', 1],
    ['targetDistancePenalty', 1],
    ['clauseCount', 1],
  ];
  for (const [key, direction] of keys) {
    if (Math.abs(a.metrics[key] - b.metrics[key]) > 0.0001) {
      return direction * (a.metrics[key] - b.metrics[key]);
    }
  }
  return 0;
}

function chooseOptimizedPlan(words, candidates, sourceDurationMs, options) {
  const maxLogicalMs = options.maxSeconds * 1_000 - options.encoderSafetyMs;
  const minMs = options.minSeconds * 1_000;
  if (maxLogicalMs < minMs) throw new Error('Encoder safety leaves no room for the minimum clip length');

  // A sentence candidate at the exact source end is represented by the final
  // endpoint below, keeping the endpoint chain unambiguous.
  const natural = candidates
    .filter(candidate => candidate.cutMs < sourceDurationMs - 0.001)
    .sort((a, b) => a.cutMs - b.cutMs || a.index - b.index);
  const endpoints = [
    ...natural,
    { index: words.length - 1, cutMs: sourceDurationMs, pauseMs: 0, kind: 'episode-end', after: words.at(-1)?.token ?? '' },
  ];

  const states = [];
  for (const endpoint of endpoints) {
    const predecessors = [];
    const startDuration = endpoint.cutMs;
    if (startDuration >= minMs - 0.001 && startDuration <= maxLogicalMs + 0.001) {
      predecessors.push({
        lastIndex: -1,
        endMs: 0,
        path: [],
        durations: [],
        clauseCount: 0,
      });
    }

    for (const state of states) {
      if (endpoint.index <= state.lastIndex) continue;
      const durationMs = endpoint.cutMs - state.endMs;
      if (durationMs >= minMs - 0.001 && durationMs <= maxLogicalMs + 0.001) {
        predecessors.push({
          lastIndex: state.lastIndex,
          endMs: state.endMs,
          path: state.path,
          durations: state.durations,
          clauseCount: state.clauseCount,
        });
      }
    }

    let best = null;
    for (const predecessor of predecessors) {
      const durationMs = endpoint.cutMs - predecessor.endMs;
      const path = [...predecessor.path, { startMs: predecessor.endMs, endMs: endpoint.cutMs, candidate: endpoint }];
      const durations = [...predecessor.durations, durationMs];
      const candidatePath = {
        lastIndex: endpoint.index,
        endMs: endpoint.cutMs,
        path,
        durations,
        clauseCount: predecessor.clauseCount + (endpoint.kind === 'clause' ? 1 : 0),
      };
      candidatePath.metrics = {
        ...pathMetrics(durations, options),
        clauseCount: candidatePath.clauseCount,
      };
      if (!best || comparePaths(candidatePath, best) < 0) best = candidatePath;
    }
    if (best) states.push(best);
  }

  const finalStates = states.filter(state => Math.abs(state.endMs - sourceDurationMs) < 0.001);
  if (!finalStates.length) {
    const nextSentence = candidates.find(candidate => candidate.kind === 'sentence');
    const nextDescription = nextSentence
      ? `the first sentence boundary is ${((nextSentence.cutMs) / 1000).toFixed(3)}s from the start`
      : 'no sentence boundary exists';
    throw new Error(`Cannot create an optimized complete-narration plan under ${options.maxSeconds}s; ${nextDescription}. Add a clause pause or increase --max-seconds.`);
  }

  const chosen = finalStates.sort(comparePaths)[0];
  return { plan: chosen.path, metrics: chosen.metrics };
}

function materializePlan(plan, words, sections, sourceDurationMs, options) {
  return plan.map((item, index) => {
    const rangeWords = words.filter(word => word.startMs < item.endMs - 0.001 && word.endMs > item.startMs + 0.001);
    const text = joinTokens(rangeWords.map(word => word.token));
    const sourceSections = sections
      .filter(section => section.endMs > item.startMs && section.startMs < item.endMs)
      .map(section => section.id);
    const durationMs = item.endMs - item.startMs;
    if (durationMs < options.minSeconds * 1_000 - 0.001) throw new Error(`Planned clip ${index + 1} is shorter than ${options.minSeconds}s`);
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
  const optimized = chooseOptimizedPlan(timeline.words, candidates, sourceDurationMs, args);
  const clips = materializePlan(optimized.plan, timeline.words, timeline.sections, sourceDurationMs, args);

  console.log(`Source: ${source}`);
  console.log(`Duration: ${sourceDurationSeconds.toFixed(3)}s | FPS: ${FPS} | optimized clips: ${clips.length}`);
  console.log(`Boundary policy: globally optimized sentence first, clause fallback; hard max ${args.maxSeconds}s`);
  console.log(`Score: ${optimized.metrics.clipCount} clips | ${optimized.metrics.extremeShortCount} under ${args.extremeShortSeconds}s | average ${(sourceDurationSeconds / clips.length).toFixed(3)}s`);
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

  const actualDurations = clips.map(clip => clip.actualDurationSeconds);
  const manifest = {
    tool: 'make-speech-clips-v2.mjs',
    version: 2,
    source: basename(source),
    timing: basename(timingPath),
    sourceDurationSeconds,
    optimization: {
      objective: 'fewest clips, then fewest extreme-short clips, then lowest shortness/target-distance penalty',
      targetSeconds: args.targetSeconds,
      extremeShortSeconds: args.extremeShortSeconds,
      plannedAverageSeconds: sourceDurationSeconds / clips.length,
      measuredAverageSeconds: actualDurations.reduce((sum, value) => sum + value, 0) / actualDurations.length,
      metrics: optimized.metrics,
    },
    settings: {
      maxSeconds: args.maxSeconds,
      minSeconds: args.minSeconds,
      pauseFill: args.pauseFill,
      encoderSafetyMs: args.encoderSafetyMs,
      headMs: HEAD_MS,
      gapMs: GAP_MS,
      fps: FPS,
      textSource: 'timing.json words[].word when present; script/heard fallback otherwise',
    },
    clips,
  };
  const jsonPath = join(outputDir, 'clip-index.json');
  const csvPath = join(outputDir, 'clip-index.csv');
  if (!args.overwrite && (existsSync(jsonPath) || existsSync(csvPath))) {
    throw new Error('Index file already exists; use --overwrite or choose a new folder.');
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
  console.log(`\nWrote ${clips.length} optimized clips and indexes to ${outputDir}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
