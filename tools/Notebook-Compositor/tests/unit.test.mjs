import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, mergeConfig, validateConfig, geometry, contain, rate, buildWords,
  planClips, selectClips, revealPage, graphemes, frameBoundaryCS, smootherstep,
  motion, dustPGM, makeGraph, parseArgs, pageText, matchFile, wordsForClip, concatDurations } from '../tools/make-vertical-notebook.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = name => JSON.parse(readFileSync(join(root, 'examples', 'episode-1-data', name), 'utf8'));
const manifest = fixture('clip-index.json'), timing = fixture('timing.json');
const config = patch => validateConfig(mergeConfig(DEFAULTS, patch));
const c = config({}), planned = planClips(manifest, c), wordData = buildWords(timing, manifest, c);

test('episode 1: 15 globally quantized clips, no cumulative duration rounding', () => {
  assert.equal(planned.clips.length, 15);
  assert.equal(planned.clips.reduce((s, p) => s + p.frames, 0), 3728);
  assert.equal(planned.clips.reduce((s, p) => s + p.samples, 0), 5964800);
  for (let i = 1; i < planned.clips.length; i++) assert.equal(planned.clips[i - 1].endFrame, planned.clips[i].startFrame);
});
test('episode 1: head/gap from supplied manifest, not scene-kit', () => {
  assert.equal(wordData.headMs, 900); assert.equal(wordData.gapMs, 520);
  assert.equal(wordData.words.find(w => w.section === 's02.mountain.draw').startMs, 11860);
  assert.equal(wordData.endMs, 122780);
});
test('episode 1: punctuation, numeric spelling and final as are the script, not ASR', () => {
  assert.equal(wordData.words[6].token, 'picture.');
  assert.equal(wordData.words[7].token, 'Not');
  const mountain = wordData.words.filter(w => w.section === 's02.mountain.draw');
  assert.equal(mountain[15].token, 'three'); assert.equal(mountain[16].token, 'thousand');
  assert.equal(wordData.words.at(-1).token, 'as.');
  for (const p of planned.clips) assert.equal(pageText(wordsForClip(wordData.words, p)), p.text);
});
test('explicit words mode retains recognized words rather than silently correcting them', () => {
  const wc = config({ text: { source: 'words' } });
  const result = buildWords(timing, manifest, wc);
  assert.equal(result.words.at(-1).token, 'us.');
  assert.ok(pageText(result.words.filter(w => w.section === 's02.mountain.draw'), 'words').includes('3,000'));
});
test('token mismatch fails rather than stretching arbitrary text over timings', () => {
  const t = structuredClone(timing); t['s01.opening'].script += ' extra';
  assert.throws(() => buildWords(t, manifest, c), /display tokens/);
  t['s01.opening'].displayTokens = timing['s01.opening'].script.split(/\s+/);
  assert.doesNotThrow(() => buildWords(t, manifest, c));
});
test('invalid, overlapping, unordered and out-of-section timings fail', () => {
  for (const patch of [{ startMs: -1 }, { endMs: Infinity }, { endMs: 10441 }]) {
    const t = structuredClone(timing); Object.assign(t['s01.opening'].words[0], patch);
    assert.throws(() => buildWords(t, manifest, c));
  }
  const t = structuredClone(timing); t['s01.opening'].words[1].startMs = 339;
  assert.throws(() => buildWords(t, manifest, c), /overlapping/);
});
test('explicit section order must be complete, unique and chronologically valid', () => {
  assert.throws(() => buildWords(timing, manifest, config({ timingOptions: { sectionOrder: [] } })), /every timing/);
});
test('configuration rejects misspelled keys, zero denominator and empty patterns', () => {
  assert.throws(() => config({ transcript: {} }), /Unknown/);
  assert.throws(() => config({ text: { marginz: 1 } }), /Unknown/);
  assert.throws(() => config({ pattern: [] }), /nonempty/);
  assert.throws(() => rate('30/0'));
  assert.throws(() => rate('29.97'));
  assert.equal(rate('30000/1001').value, 30000 / 1001);
});
test('CLI rejects typos, duplicate arguments and missing values', () => {
  assert.throws(() => parseArgs(['--episoed', 'a']), /Unknown/);
  assert.throws(() => parseArgs(['--episode']), /Missing/);
  assert.throws(() => parseArgs(['--limit', '1', '--limit', '2']), /Duplicate/);
});
test('center geometry is integer; a 16:9 drawing is contained with exact aspect', () => {
  assert.deepEqual(geometry(c), { w: 1080, h: 1920, ch: 608, cy: 656, panelHeight: 656, bottomY: 1264 });
  assert.deepEqual(contain(1920, 1080, 1080, 608), { w: 1056, h: 594, exactAspect: true });
});
test('nonstandard coprime dimensions explicitly report aspect rounding', () => {
  const s = contain(1919, 1079, 1080, 608);
  assert.equal(s.exactAspect, false); assert.ok(s.w <= 1080 && s.h <= 608);
  assert.equal(s.w % 2, 0); assert.equal(s.h % 2, 0);
});
test('subset selection keeps original top/bottom alternation and prevents gap joins', () => {
  assert.equal(selectClips(planned.clips, { only: '2', noJoin: true })[0].position, 'bottom');
  assert.throws(() => selectClips(planned.clips, { only: '1,3' }), /Noncontiguous/);
  assert.equal(selectClips(planned.clips, { only: '1,3', noJoin: true }).length, 2);
});
test('manifest rejects duplicate indices, overlaps and inconsistent durations', () => {
  for (const mutate of [m => { m.clips[1].index = 1; }, m => { m.clips[1].startMs++; },
    m => { m.clips[1].durationMs++; }]) {
    const m = structuredClone(manifest); mutate(m); assert.throws(() => planClips(m, c));
  }
});
test('clips longer than 10 seconds are valid; resource cap is configurable', () => {
  const m = { settings: { fps: 30 }, clips: [{ index: 1, filename: '001.mp4', startMs: 0, endMs: 15000, durationMs: 15000 }] };
  assert.equal(planClips(m, c).clips[0].frames, 450);
});
test('rational FPS sample totals use global boundaries, not per-clip rounding', () => {
  const m = structuredClone(manifest); m.settings.fps = '30000/1001';
  const { clips, fps } = planClips(m, c);
  const frames = clips.reduce((s, p) => s + p.frames, 0);
  assert.equal(clips.reduce((s, p) => s + p.samples, 0), Math.round(frames / fps.value * 48000));
});
test('graphemes do not split decomposed accents, surrogate pairs or ZWJ emoji', () => {
  assert.deepEqual(graphemes('e\u0301👩‍🔬山'), ['e\u0301', '👩‍🔬', '山']);
});
test('word clipped halfway is already partially visible and is not re-timed', () => {
  const p = { startSeconds: 0.5, endSeconds: 1, frames: 15 };
  const r = revealPage([{ token: 'abcd', startMs: 0, endMs: 1000 }], p, c, rate(30));
  assert.equal(r.changes[0][0], 0); assert.equal(r.changes[0][1], 3);
  assert.deepEqual(r.changes.at(-1), [8, 4]);
});
test('ASS boundaries fall strictly between sampled frames for supported rates', () => {
  for (const value of [24, 25, 30, 50, 60, '24000/1001', '30000/1001']) {
    const fps = rate(value);
    for (let frame = 1; frame < 500; frame++) {
      const t = frameBoundaryCS(frame, fps) / 100;
      assert.ok(t > (frame - 1) / fps.value && t <= frame / fps.value);
    }
  }
});
test('motion is continuous, stationary at endpoints, and bounded for short clips', () => {
  assert.equal(smootherstep(0), 0); assert.equal(smootherstep(1), 1);
  assert.ok(smootherstep(1e-5) < 1e-12);
  assert.equal(motion({ frames: 300 }, rate(30), 0.85).transitionFrames, 26);
  assert.equal(motion({ frames: 6 }, rate(30), 0.85).transitionFrames, 1);
  assert.equal(motion({ frames: 1 }, rate(30), 0.85).transitionFrames, 0);
});
test('dust is deterministic, finite-size and seed-sensitive', () => {
  assert.deepEqual(dustPGM(40, 20, 123), dustPGM(40, 20, 123));
  assert.notDeepEqual(dustPGM(40, 20, 123), dustPGM(40, 20, 124));
});
test('filter graph has constant filter count, center last and no shortest truncation', () => {
  const p = planned.clips[0], g = geometry(c), ctx = { c, g, fps: planned.fps };
  const graph = makeGraph(ctx, p, { drawingFit: contain(1920, 1080, g.w, g.ch), narratorFit: { w: 960, h: 540 }, edgeInput: 2 });
  assert.ok(graph.indexOf('[withText][drawing]overlay') > graph.indexOf('ass=filename='));
  assert.ok(graph.includes('shortest=0')); assert.ok(!graph.includes('shortest=1'));
  assert.ok(!graph.includes('drawtext=')); assert.ok(!graph.includes('drawbox='));
});
test('ambiguous numbered filenames fail, and explicit choices are allowed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vertical-pair-'));
  try {
    writeFileSync(join(dir, '001__a.mp4'), ''); writeFileSync(join(dir, '001__b.mov'), '');
    assert.throws(() => matchFile(dir, 1), /Ambiguous/);
    assert.equal(matchFile(dir, 1, undefined, '001__b.mov'), join(dir, '001__b.mov'));
    assert.throws(() => matchFile(dir, 2), /Missing/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('ASS commands in transcript are rejected, ordinary punctuation is not rewritten', () => {
  const t = structuredClone(timing); t['s01.opening'].script = t['s01.opening'].script.replace('Every', '{\\pos(1,1)}Every');
  assert.throws(() => buildWords(t, manifest, c), /unsupported/);
  assert.doesNotThrow(() => buildWords(timing, manifest, c));
});

test('concat duration microseconds use cumulative endpoints and bounded quantization', () => {
  const fps = rate('30000/1001');
  const counts = Array.from({ length: 1000 }, (_, i) => 31 + i % 17);
  const ds = concatDurations(counts, fps.value);
  let frames = 0, seconds = 0;
  ds.forEach((d, i) => {
    frames += counts[i]; seconds += d;
    assert.ok(Math.abs(seconds - frames / fps.value) < 0.00000051);
    assert.equal(Math.round(seconds * fps.timeScale), frames * fps.d);
  });
});
test('padded override indices are rejected instead of being silently ignored', () => {
  assert.throws(() => config({ clips: { '001': { position: 'bottom' } } }), /canonical indices/);
});

const art = await import('../tools/make-vertical-notebook.mjs');
test('house palette derives from the drawing kit; v2 yellow preset is not a hidden fallback', () => {
  assert.equal(c.canvas.paperColor, '#ebe4db'); assert.equal(c.paper.color, '#f9f6f1');
  assert.equal(c.text.color, '#493e36'); assert.equal(c.transition.kind, 'paper-edge');
  assert.equal(c.transition.seconds, 0.6);
  assert.throws(() => config({ version: 2 }), /version must be 3/i);
});
test('one fixed narrator-card footprint contains differently framed illustrations without cropping', () => {
  const g = geometry(c), a = art.narratorGeometry(g, c.narrator, 1376, 768), b = art.narratorGeometry(g, c.narrator, 784, 424);
  assert.deepEqual(a.cardFit, b.cardFit);
  for (const p of [a, b]) {
    assert.ok(p.cardFit.h < g.ch);
    assert.ok(p.narratorFit.w + 2 * p.cardFit.mat <= p.cardFit.w);
    assert.ok(p.narratorFit.h + 2 * p.cardFit.mat <= p.cardFit.h);
  }
});
test('narrator card is entirely behind the drawing at endpoints and inside its panel when settled', () => {
  const g = geometry(c), { cardFit: card } = art.narratorGeometry(g, c.narrator, 1920, 1080);
  for (const position of ['top', 'bottom']) {
    const hidden = art.narratorY(g, card, position, 0), shown = art.narratorY(g, card, position, 1);
    assert.ok(hidden >= g.cy && hidden + card.h <= g.bottomY);
    if (position === 'top') assert.ok(shown >= 0 && shown + card.h <= g.cy);
    else assert.ok(shown >= g.bottomY && shown + card.h <= g.h);
  }
});
test('edge-only dissolve cannot fade the already-visible part of a face far from the center seam', () => {
  for (let noise = 0; noise <= 1; noise += 0.05) {
    assert.equal(art.edgeOpacity(-1, noise, 14, 4), 0);
    assert.equal(art.edgeOpacity(20, noise, 14, 4), 1);
    assert.equal(art.edgeOpacity(300, noise, 14, 4), 1);
  }
  assert.ok(art.edgeOpacity(9, 0.5, 14, 4) > 0 && art.edgeOpacity(9, 0.5, 14, 4) < 1);
});
test('notebook grade maps neutral endpoints to house paper and ink, with a monotone tonal scale', () => {
  const g = c.narrator.grade;
  assert.deepEqual(art.gradeRGB([0, 0, 0], g).map(x => Math.round(x * 255)), [73, 62, 54]);
  assert.deepEqual(art.gradeRGB([1, 1, 1], g).map(x => Math.round(x * 255)), [249, 246, 241]);
  let previous = [0, 0, 0];
  for (let i = 0; i <= 100; i++) {
    const out = art.gradeRGB([i / 100, i / 100, i / 100], g);
    out.forEach((v, k) => assert.ok(v >= previous[k] && v >= 0 && v <= 1)); previous = out;
  }
});
test('grade is deterministic and disabled mode preserves the input RGB exactly', () => {
  const g = c.narrator.grade, input = [0.93, 0.11, 0.37];
  assert.deepEqual(art.gradeRGB(input, { ...g, mode: 'off' }), input);
  assert.deepEqual(art.gradeRGB(input, { ...g, strength: 0 }), input);
  assert.deepEqual(art.gradeRGB(input, g), art.gradeRGB(input, g));
  for (const v of art.gradeRGB(input, g)) assert.ok(v >= 0 && v <= 1);
  assert.equal(art.lutCube(g, { black: 0, white: 1 }, 3).trim().split('\n').length, 31);
});
test('clip-level exposure uses robust, bounded sample statistics, not unrestricted normalization', () => {
  const g = c.narrator.grade;
  assert.deepEqual(art.lockedLevels([{ black: 0.4, white: 0.6 }], g), { black: 0.06, white: 0.88 });
  assert.deepEqual(art.lockedLevels([], g), { black: 0, white: 1 });
  assert.deepEqual(art.lockedLevels([{ black: 0.04, white: 0.99 }, { black: 0.05, white: 0.95 }, { black: 0.5, white: 0.6 }], g), { black: 0.05, white: 0.95 });
  assert.deepEqual(art.lockedLevels([{ black: 0.2, white: 0.8 }], { ...g, blackPoint: 0, whitePoint: 1 }), { black: 0, white: 1 });
});
test('phrase-aware pagination prefers a substantial natural sentence ending over a cut mid-clause', () => {
  const tokens = ['One', 'two', 'three', 'four.', 'Five', 'six', 'seven', 'eight.'];
  const ws = tokens.map((token, i) => ({ token, startMs: i * 300, endMs: (i + 1) * 300, section: 's' }));
  assert.equal(art.phraseBreak(ws, 6), 4);
  assert.equal(art.phraseBreak(ws, 8), 8);
});
test('both caption layouts face the center and are positioned from the complete measured text block', () => {
  const g = geometry(c), b = { top: 12, bottom: 230 };
  const top = art.captionOrigin(c, g, 'bottom', b), bottom = art.captionOrigin(c, g, 'top', b);
  assert.equal(top + b.bottom + 1, g.cy - c.text.margin);
  assert.equal(bottom + b.top, g.bottomY + c.text.margin);
});
test('paper and card raster assets are deterministic and dimensioned, not animated noise', () => {
  const small = config({ canvas: { width: 270, height: 480 }, text: { fontSize: 18, margin: 16 }, narrator: { panelMargin: 8 } });
  const g = geometry(small), p = { narrator: small.narrator, ...art.narratorGeometry(g, small.narrator, 320, 180) };
  const a = art.paperPPM(small, g), b = art.paperPPM(small, g);
  assert.deepEqual(a, b); assert.equal(a.length, Buffer.byteLength('P6\n270 480\n255\n') + 270 * 480 * 3);
  assert.ok(art.cardPPM(small, p).length > p.cardFit.w * p.cardFit.h * 3);
});
test('grade and external masks are separate from the protected drawing branch; key precedes grade', () => {
  const local = config({ narrator: { mode: 'colorkey' } }), g = geometry(local), p = planClips(manifest, local).clips[0];
  Object.assign(p, art.narratorGeometry(g, p.narrator, 320, 180));
  const graph = makeGraph({ c: local, g, fps: rate(30) }, p, { drawingFit: { w: 1056, h: 594 }, narratorFit: p.narratorFit, backgroundInput: 2, edgeInput: 3, cardInput: 4 });
  assert.ok(graph.indexOf('colorkey=') < graph.indexOf('lut3d='));
  const drawing = graph.split(';').find(line => line.includes('[drawing]'));
  assert.ok(!/lut3d|geq|crop=/.test(drawing));
  assert.ok(graph.includes('p(X,0)'));
  assert.ok(graph.includes('format=rgba,alphaextract[nSavedAlpha]'));
});
test('invalid artistic config fails early rather than introducing NaNs or unbounded video operations', () => {
  for (const patch of [{ narrator: { grade: { sampleFrames: 0 } } }, { narrator: { grade: { gamma: 0 } } },
    { transition: { kind: 'paper-dust' } }, { transition: { feather: 0 } }, { text: { anchor: 'auto-magic' } }])
    assert.throws(() => config(patch));
});
