#!/usr/bin/env node

/*
 * Create a 9:16 vertical explainer from paired original and narrator clips.
 *
 * Layout:
 *   - the original drawing is centered in the vertical canvas;
 *   - the narrator occupies the top or bottom panel, alternating by clip;
 *   - transcript text occupies the opposite panel and types on from the
 *     timing.json word timings;
 *   - the narrator slides behind the centered drawing at the beginning/end
 *     of each clip, with a soft ink-wash band over the center.
 *
 * This is intentionally v1: deterministic, repeatable, and FFmpeg-only.
 * The original clip audio is retained in every output MP4.  The narrator
 * input is treated as visual-only and may be silent.
 *
 * Expected narrator files: any video whose filename begins with the matching
 * three-digit clip number, e.g. 001__...mp4 in --narrator-dir.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { GAP_MS, HEAD_MS, FPS } from '../lib/scene-kit.mjs';

const DEFAULTS = {
  originalDir: 'out-clips-talking-face-v3',
  narratorDir: 'narrator-clips',
  outputDir: 'vertical-narrator-v1',
  timing: 'timing.json',
  canvasWidth: 1080,
  canvasHeight: 1920,
  fontSize: 54,
  margin: 64,
  transitionSeconds: 0.85,
  backgroundColor: '0xf3e4cf',
  panelColor: '0xf3e4cf@0.92',
  textColor: '0x2f261f',
  washColor: '0xe9c69f@0.50',
  fontFile: 'C:/Windows/Fonts/arial.ttf',
};

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);

function usage() {
  console.log(`Usage:
  node tools/make-vertical-narrator-v1.mjs --episode <episode-directory> [options]

Options:
  --original-dir <path>       Original clips + clip-index.json (default: ${DEFAULTS.originalDir})
  --narrator-dir <path>       Silent narrator clips, matched by 001/002/... prefix (default: ${DEFAULTS.narratorDir})
  --output-dir <path>         Output folder (default: ${DEFAULTS.outputDir})
  --timing <path>             timing.json path, relative to episode by default (default: ${DEFAULTS.timing})
  --font-file <path>          Font file (default: ${DEFAULTS.fontFile})
  --font-size <number>        Transcript font size (default: ${DEFAULTS.fontSize})
  --margin <number>           Panel text margin in pixels (default: ${DEFAULTS.margin})
  --transition-seconds <n>    Slide/wash duration at clip edges (default: ${DEFAULTS.transitionSeconds})
  --canvas-width <number>     Vertical canvas width (default: ${DEFAULTS.canvasWidth})
  --canvas-height <number>    Vertical canvas height (default: ${DEFAULTS.canvasHeight})
  --pattern <top,bottom>      Narrator placement pattern (default: top,bottom)
  --limit <number>            Render only the first N pairs for a quick test
  --no-join                   Do not also create vertical-full.mp4
  --overwrite                 Replace same-named generated files, never delete others
  --dry-run                   Print the pairing/layout plan without rendering
`);
}

function parseArgs(argv) {
  const args = { ...DEFAULTS, pattern: 'top,bottom', join: true };
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
    if (arg === '--no-join') {
      args.join = false;
      continue;
    }
    const key = arg.startsWith('--') ? arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null;
    if (!key || i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
    args[key] = argv[++i];
  }
  if (!args.episode) throw new Error('--episode is required');
  for (const key of ['canvasWidth', 'canvasHeight', 'fontSize', 'margin', 'transitionSeconds']) {
    args[key] = Number(args[key]);
    if (!Number.isFinite(args[key]) || args[key] <= 0) throw new Error(`Invalid number for --${key}`);
  }
  if (args.limit !== undefined) {
    args.limit = Number(args.limit);
    if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error('--limit must be a positive integer');
  }
  if (args.canvasWidth % 2 || args.canvasHeight % 2) throw new Error('Canvas dimensions must be even');
  if (!args.pattern.split(',').filter(Boolean).every(value => ['top', 'bottom'].includes(value))) {
    throw new Error('--pattern may contain only top and bottom');
  }
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

function probe(file, selector) {
  const value = run('ffprobe', [
    '-v', 'error',
    ...(selector ? ['-select_streams', selector] : []),
    '-show_entries', 'format=duration:stream=width,height,r_frame_rate,codec_type',
    '-of', 'json',
    file,
  ], { quiet: true });
  return JSON.parse(value);
}

function durationSeconds(file) {
  const data = probe(file);
  const duration = Number(data.format?.duration);
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

function buildWords(timing) {
  const words = [];
  let cursorMs = HEAD_MS;
  for (const [section, entry] of Object.entries(timing)) {
    const durationMs = Number(entry.durationMs);
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error(`${section}: invalid durationMs`);
    const tokens = timingTokens(entry);
    if (tokens.length !== entry.words.length) {
      throw new Error(`${section}: script has ${tokens.length} tokens but timing has ${entry.words.length} words`);
    }
    for (let index = 0; index < entry.words.length; index += 1) {
      const word = entry.words[index];
      words.push({
        section,
        index,
        token: tokens[index],
        startMs: cursorMs + Number(word.startMs),
        endMs: cursorMs + Number(word.endMs),
      });
    }
    cursorMs += durationMs + GAP_MS;
  }
  return words;
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function escapeFilterValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/%/g, '\\%')
    .replace(/\r?\n/g, '\\n');
}

function escapeConcatPath(file) {
  return file.replace(/'/g, "'\\''");
}

function findClipIndex(originalDir) {
  const indexPath = join(originalDir, 'clip-index.json');
  if (!existsSync(indexPath)) throw new Error(`clip-index.json not found in ${originalDir}`);
  return JSON.parse(readFileSync(indexPath, 'utf8'));
}

function findNarratorClip(narratorDir, index) {
  if (!existsSync(narratorDir)) return null;
  const prefix = `${String(index).padStart(3, '0')}__`;
  const files = readdirSync(narratorDir)
    .filter(file => VIDEO_EXTENSIONS.has(extname(file).toLowerCase()))
    .filter(file => file.startsWith(prefix))
    .sort();
  return files[0] ? join(narratorDir, files[0]) : null;
}

function clipWords(words, clip) {
  return words.filter(word => word.startMs < clip.endMs - 0.001 && word.endMs > clip.startMs + 0.001);
}

function revealEvents(words, clip, maxChars) {
  const events = [];
  let prefix = '';
  for (const word of clipWords(words, clip)) {
    const token = String(word.token);
    const start = Math.max(0, (word.startMs - clip.startMs) / 1_000);
    const end = Math.min(clip.durationMs / 1_000, Math.max(start, (word.endMs - clip.startMs) / 1_000));
    if (prefix) prefix += ' ';
    const step = token.length ? (end - start) / token.length : 0;
    for (let i = 0; i < token.length; i += 1) {
      prefix += token[i];
      events.push({
        time: Math.max(0, start + step * (i + 1)),
        text: wrapText(prefix, maxChars),
      });
    }
  }
  if (!events.length && clip.text) events.push({ time: 0, text: wrapText(clip.text, maxChars) });
  return events;
}

function drawTranscriptChain(inputLabel, outputLabel, events, options, textPosition, durationSeconds) {
  if (!events.length) return { chain: '', finalLabel: inputLabel };
  const maxTextChars = Math.max(12, Math.floor((options.canvasWidth - options.margin * 2) / (options.fontSize * 0.52)));
  let current = inputLabel;
  let chain = '';
  const textY = textPosition === 'top'
    ? String(options.margin)
    : `H-text_h-${options.margin}`;
  const fontFile = escapeFilterValue(resolve(options.fontFile).replace(/\\/g, '/'));
  const endTimes = events.slice(1).map(event => event.time);
  endTimes.push(durationSeconds);

  events.forEach((event, index) => {
    const nextLabel = `${outputLabel}${index}]`;
    const start = event.time.toFixed(3);
    const end = Math.max(event.time + 0.001, endTimes[index]).toFixed(3);
    const text = escapeFilterValue(event.text);
    chain += `${current}drawtext=fontfile='${fontFile}':text='${text}':fontcolor=${options.textColor}:fontsize=${options.fontSize}:line_spacing=10:box=1:boxcolor=${options.panelColor}:boxborderw=22:x=(w-text_w)/2:y=${textY}:enable='between(t,${start},${end})'${nextLabel};`;
    current = nextLabel;
  });
  return { chain, finalLabel: current };
}

function makeFilter(clip, narratorPath, words, options, position, originalDuration) {
  const width = options.canvasWidth;
  const height = options.canvasHeight;
  const centralHeight = Math.round(width * 9 / 16);
  const centralY = Math.round((height - centralHeight) / 2);
  const panelY = position === 'top' ? 24 : height - centralHeight - 24;
  const hiddenY = centralY;
  const transition = Math.min(options.transitionSeconds, originalDuration / 3);
  const endStart = Math.max(transition, originalDuration - transition);
  const yExpression = `if(lt(t,${transition.toFixed(3)}),${hiddenY}+(${panelY}-${hiddenY})*t/${transition.toFixed(3)},if(gt(t,${endStart.toFixed(3)}),${panelY}+(${hiddenY}-${panelY})*(t-${endStart.toFixed(3)})/${transition.toFixed(3)},${panelY}))`;
  const maxTextChars = Math.max(12, Math.floor((width - options.margin * 2) / (options.fontSize * 0.52)));
  const textPosition = position === 'top' ? 'bottom' : 'top';
  const events = revealEvents(words, clip, maxTextChars);

  let filter = `color=c=${options.backgroundColor}:s=${width}x${height}:r=${FPS}:d=${originalDuration.toFixed(3)}[paper];`;
  filter += `[1:v]fps=${FPS},scale=${width}:${centralHeight}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${centralHeight}:0:(oh-ih)/2:color=${options.backgroundColor}[narr];`;
  filter += `[paper][narr]overlay=x=0:y='${yExpression}':eof_action=pass:shortest=1:eval=frame[withNarrator];`;
  filter += `[withNarrator]drawbox=x=0:y='h/2-150':w=iw:h=300:color=${options.washColor}:t=fill:enable='between(t,0,${transition.toFixed(3)})+between(t,${endStart.toFixed(3)},${originalDuration.toFixed(3)})'[washed];`;
  filter += `[washed]drawbox=x=0:y='h/2-75':w=iw:h=150:color=${options.washColor}:t=fill:enable='between(t,0,${transition.toFixed(3)})+between(t,${endStart.toFixed(3)},${originalDuration.toFixed(3)})'[withWash];`;
  filter += `[0:v]fps=${FPS},scale=${width}:${centralHeight}:force_original_aspect_ratio=decrease:flags=lanczos[orig];`;
  filter += `[withWash][orig]overlay=x=0:y=${centralY}:eof_action=endall:shortest=1[centered];`;
  const transcript = drawTranscriptChain('[centered]', '[text', events, options, textPosition, originalDuration);
  filter += transcript.chain;
  return { filter, finalLabel: transcript.finalLabel };
}

function renderClip(originalPath, narratorPath, destination, clip, words, options, position) {
  const originalDuration = durationSeconds(originalPath);
  const narratorDuration = durationSeconds(narratorPath);
  if (Math.abs(originalDuration - narratorDuration) > 0.35) {
    throw new Error(`Clip ${clip.index}: narrator duration ${narratorDuration.toFixed(3)}s differs from original ${originalDuration.toFixed(3)}s by more than 0.35s`);
  }
  const { filter, finalLabel } = makeFilter(clip, narratorPath, words, options, position, originalDuration);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-y',
    '-i', originalPath,
    '-i', narratorPath,
    '-filter_complex', filter,
    '-map', finalLabel,
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    destination,
  ]);
  const renderedDuration = durationSeconds(destination);
  if (renderedDuration > 10.0001) throw new Error(`Rendered vertical clip exceeds 10s: ${basename(destination)} is ${renderedDuration.toFixed(3)}s`);
  return renderedDuration;
}

function concatVideos(files, destination, overwrite) {
  const listPath = `${destination}.concat.txt`;
  const lines = files.map(file => `file '${escapeConcatPath(file)}'`);
  writeFileSync(listPath, `${lines.join('\n')}\n`, 'utf8');
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    overwrite ? '-y' : '-n',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    '-movflags', '+faststart',
    destination,
  ]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const episodeDir = resolve(args.episode);
  const originalDir = resolve(episodeDir, args.originalDir);
  const narratorDir = resolve(episodeDir, args.narratorDir);
  const outputDir = resolve(episodeDir, args.outputDir);
  const timingPath = resolve(episodeDir, args.timing);
  const fontPath = resolve(args.fontFile);
  if (!existsSync(originalDir)) throw new Error(`Original clip folder not found: ${originalDir}`);
  if (!existsSync(timingPath)) throw new Error(`Timing file not found: ${timingPath}`);
  if (!existsSync(fontPath)) throw new Error(`Font file not found: ${fontPath}`);

  const manifest = findClipIndex(originalDir);
  const timing = JSON.parse(readFileSync(timingPath, 'utf8'));
  const words = buildWords(timing);
  const pattern = args.pattern.split(',').filter(Boolean);
  const allPairs = manifest.clips.map((clip, index) => ({
    clip,
    originalPath: join(originalDir, clip.filename),
    narratorPath: findNarratorClip(narratorDir, clip.index),
    position: pattern[index % pattern.length],
  }));
  const pairs = args.limit ? allPairs.slice(0, args.limit) : allPairs;

  console.log(`Episode: ${episodeDir}`);
  console.log(`Canvas: ${args.canvasWidth}x${args.canvasHeight} | narrator/text pattern: ${args.pattern}`);
  console.log(`Transcript: letter reveal from timing.json word timings | transition: ${args.transitionSeconds}s`);
  for (const pair of pairs) {
    console.log(`${String(pair.clip.index).padStart(3, '0')} ${pair.position} original=${basename(pair.originalPath)} narrator=${pair.narratorPath ? basename(pair.narratorPath) : 'MISSING'} text=${pair.clip.text}`);
  }

  if (args.dryRun) return;
  const missing = pairs.filter(pair => !pair.narratorPath);
  if (missing.length) {
    throw new Error(`Missing ${missing.length} narrator clip(s) in ${narratorDir}; use --dry-run to inspect expected matching names.`);
  }
  if (existsSync(outputDir) && readdirSync(outputDir).length && !args.overwrite) {
    throw new Error(`Output directory is not empty: ${outputDir}. Use a new folder or --overwrite.`);
  }
  mkdirSync(outputDir, { recursive: true });

  const rendered = [];
  for (const pair of pairs) {
    const outputName = `${String(pair.clip.index).padStart(3, '0')}__${pair.position}__${basename(pair.clip.filename)}`;
    const destination = join(outputDir, outputName);
    const actualDurationSeconds = renderClip(pair.originalPath, pair.narratorPath, destination, pair.clip, words, args, pair.position);
    rendered.push({
      index: pair.clip.index,
      filename: outputName,
      originalFilename: pair.clip.filename,
      narratorFilename: basename(pair.narratorPath),
      position: pair.position,
      startMs: pair.clip.startMs,
      endMs: pair.clip.endMs,
      plannedDurationSeconds: pair.clip.durationMs / 1_000,
      actualDurationSeconds,
      text: pair.clip.text,
    });
  }

  let fullVideo = null;
  if (args.join) {
    fullVideo = join(outputDir, 'vertical-full.mp4');
    concatVideos(rendered.map(item => join(outputDir, item.filename)), fullVideo, args.overwrite);
  }
  const outputManifest = {
    tool: 'make-vertical-narrator-v1.mjs',
    version: 1,
    sourceManifest: join(originalDir, 'clip-index.json'),
    timing: timingPath,
    canvas: { width: args.canvasWidth, height: args.canvasHeight, fps: FPS },
    layout: {
      original: 'centered 16:9 drawing layer',
      narrator: 'top/bottom alternating panel sliding behind centered drawing',
      transcript: 'opposite panel, cumulative letter reveal using timing.json word timings',
      transition: 'soft centered ink-wash bands over narrator slide',
    },
    settings: {
      originalDir,
      narratorDir,
      pattern: args.pattern,
      fontFile: fontPath,
      fontSize: args.fontSize,
      margin: args.margin,
      transitionSeconds: args.transitionSeconds,
      backgroundColor: args.backgroundColor,
      panelColor: args.panelColor,
      textColor: args.textColor,
      washColor: args.washColor,
    },
    fullVideo: fullVideo ? basename(fullVideo) : null,
    clips: rendered,
  };
  writeFileSync(join(outputDir, 'vertical-index.json'), `${JSON.stringify(outputManifest, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${rendered.length} vertical clips${fullVideo ? ' and vertical-full.mp4' : ''} to ${outputDir}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
