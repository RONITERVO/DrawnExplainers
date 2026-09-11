#!/usr/bin/env node

/*
 * v3 wrapper around make-speech-clips-v2.mjs.
 *
 * v2 remains the planner/renderer, so the video behavior and optimized
 * boundaries stay identical.  v3 additionally extracts a standalone WAV for
 * every rendered MP4 while leaving the MP4's embedded audio intact.
 *
 * The source video and all existing files are preserved.  --overwrite only
 * replaces same-named generated files; it never deletes stale files.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const V2_TOOL = resolve(import.meta.dirname, 'make-speech-clips-v2.mjs');
const DEFAULT_OUTPUT_DIR = 'out-clips-talking-face-v3';

function usage() {
  console.log(`Usage:
  node tools/make-speech-clips-v3.mjs --episode <episode-directory> [options]

v3 keeps all v2 options and adds one standalone WAV beside every MP4.
The MP4 still retains its embedded audio.

Options forwarded to v2:
  --video <path>                    Source video (default: <episode>/out.mp4)
  --timing <path>                   Timing file (default: <episode>/timing.json)
  --output-dir <path>               Output folder (default: <episode>/${DEFAULT_OUTPUT_DIR})
  --max-seconds <number>            Hard maximum for measured output (default: 10)
  --min-seconds <number>            Minimum clip length (default: 1)
  --target-seconds <number>         Optimization target (default: 10)
  --extreme-short-seconds <number>  Penalized short-clip threshold (default: 2)
  --pause-fill <0..1>               Portion of a pause kept before a cut (default: 0.75)
  --encoder-safety-ms <n>            Reserve for AAC/container padding (default: 100)
  --overwrite                       Replace same-named generated files, never delete others
  --dry-run                         Print the plan without rendering or extracting files
`);
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

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function extractAudio(videoPath, audioPath, overwrite) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    overwrite ? '-y' : '-n',
    '-i', videoPath,
    '-map', '0:a:0',
    '-vn',
    '-c:a', 'pcm_s16le',
    '-ar', '48000',
    '-ac', '2',
    audioPath,
  ]);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    return;
  }

  const episodeValue = optionValue(argv, '--episode');
  if (!episodeValue) throw new Error('--episode is required');
  const episodeDir = resolve(episodeValue);
  const outputValue = optionValue(argv, '--output-dir');
  const outputDir = resolve(episodeDir, outputValue || DEFAULT_OUTPUT_DIR);
  const overwrite = argv.includes('--overwrite');
  const dryRun = argv.includes('--dry-run');

  const forwarded = [...argv];
  if (!outputValue) forwarded.push('--output-dir', DEFAULT_OUTPUT_DIR);

  console.log('Running v2 video planner/renderer, then extracting matching standalone WAV files.');
  run(process.execPath, [V2_TOOL, ...forwarded]);
  if (dryRun) return;

  const jsonPath = join(outputDir, 'clip-index.json');
  const csvPath = join(outputDir, 'clip-index.csv');
  if (!existsSync(jsonPath)) throw new Error(`v2 did not produce an index: ${jsonPath}`);
  const manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));

  let totalAudioSeconds = 0;
  for (const clip of manifest.clips) {
    const videoPath = join(outputDir, clip.filename);
    if (!existsSync(videoPath)) throw new Error(`Video clip missing: ${videoPath}`);
    const audioFilename = clip.filename.replace(/\.mp4$/iu, '.wav');
    const audioPath = join(outputDir, audioFilename);
    if (existsSync(audioPath) && !overwrite) {
      throw new Error(`Audio clip already exists: ${audioPath}. Use --overwrite or choose a new folder.`);
    }
    extractAudio(videoPath, audioPath, overwrite);
    const audioDurationSeconds = probeDuration(audioPath);
    if (audioDurationSeconds > 10.0001) {
      throw new Error(`Extracted audio exceeds the hard max: ${audioFilename} is ${audioDurationSeconds.toFixed(3)}s`);
    }
    clip.audioFilename = audioFilename;
    clip.audioDurationSeconds = audioDurationSeconds;
    totalAudioSeconds += audioDurationSeconds;
  }

  manifest.tool = 'make-speech-clips-v3.mjs';
  manifest.version = 3;
  manifest.audio = {
    separateFiles: true,
    format: 'WAV PCM signed 16-bit little-endian',
    sampleRateHz: 48000,
    channels: 2,
    embeddedInVideoPreserved: true,
    measuredAverageSeconds: totalAudioSeconds / manifest.clips.length,
  };
  writeFileSync(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const columns = ['index', 'filename', 'audio_filename', 'start', 'end', 'duration', 'actual_duration', 'audio_duration', 'boundary_type', 'pause_after_last_word', 'source_sections', 'spoken_text'];
  const rows = [columns.join(',')];
  for (const clip of manifest.clips) {
    const stamp = value => {
      const totalMs = Math.max(0, Math.round(value));
      const hours = Math.floor(totalMs / 3_600_000);
      const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
      const seconds = Math.floor((totalMs % 60_000) / 1_000);
      const millis = totalMs % 1_000;
      return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    };
    rows.push([
      clip.index,
      clip.filename,
      clip.audioFilename,
      stamp(clip.startMs),
      stamp(clip.endMs),
      `${(clip.durationMs / 1_000).toFixed(3)}s`,
      `${clip.actualDurationSeconds.toFixed(3)}s`,
      `${clip.audioDurationSeconds.toFixed(3)}s`,
      clip.boundaryType,
      `${(clip.pauseAfterLastWordMs / 1_000).toFixed(3)}s`,
      clip.sourceSections.join(';'),
      clip.text,
    ].map(csvCell).join(','));
  }
  writeFileSync(csvPath, `${rows.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${manifest.clips.length} MP4 clips plus ${manifest.clips.length} standalone WAV files to ${outputDir}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
