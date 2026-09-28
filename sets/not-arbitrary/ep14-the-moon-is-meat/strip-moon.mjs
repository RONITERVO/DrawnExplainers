// Working drawings: three pictures that became the same four strokes.
//   node lib/glyph.mjs sets/not-arbitrary/ep14-the-moon-is-meat/strip-moon.mjs strip.png 5
//
// 月 is written in four strokes, and every picture here is drawn in the same
// four runs, in the same order and the same direction:
//   a  the left side, top to bottom                 (丿)
//   b  the top and the right side, ending in a hook  (𠃌)
//   c  the upper bar inside, left to right
//   d  the lower bar inside, left to right
//
// The three sources are traced from the Commons files Wikipedia's radical
// articles walk through (300-unit boxes, re-centred and scaled here):
//   moon  月-oracle.svg   a crescent: the heavy arc is b, the straight chord
//                         inside it is a. It has no bars; they are drawn in
//                         as the curve squares off, which is what the bronze
//                         and seal forms show happening.
//   meat  肉 bronze form  (from the Commons file for 胾, whose left part it
//                         is): a slice, leaning, with two lines across it -
//                         already four runs.
//   boat  舟-oracle.svg   a long hull stood on end: two sides, two bars.
//
// Wiktionary's glyph origin for 月 lists what else the shape stands for: a
// boat in 前 and 朕, meat in 有 and most body parts (肉: "stylized into 月 when
// next to a phonetic component"; 舟: "later sometimes written as 月").

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

// ---------------------------------------------------------------- 月 today
// The corner at the top right is two coincident anchors, so the frame gets a
// real corner while every source keeps the same anchor count.
export const YUE = {
  a: [[-58, -108], [-58, -46], [-59, 14], [-66, 72], [-94, 120]],
  b: [[-58, -108], [2, -108], [62, -108], [62, -108], [62, 0], [61, 106], [40, 100]],
  c: [[-58, -44], [2, -44], [62, -44]],
  d: [[-58, 20], [2, 20], [62, 20]],
};

// ---------------------------------------------------------------- sources
// fit(): raw 300-box coordinates -> centred glyph units.
const fit = (runs, cx, cy, s) => Object.fromEntries(Object.entries(runs).map(
  ([k, pts]) => [k, pts && pts.map(([x, y]) => [Math.round((x - cx) * s), Math.round((y - cy) * s)])]));

export const SRC = {
  moon: fit({
    a: [[151, 66], [151, 110], [152, 150], [154, 190], [156, 228]],
    b: [[108, 18], [141, 50], [188, 100], [192, 132], [192, 160], [178, 212], [104, 280]],
    c: null,
    d: null,
  }, 150, 150, 0.9),
  meat: fit({
    a: [[127, 124], [110, 142], [92, 160], [72, 180], [54, 201]],
    b: [[131, 122], [140, 142], [145, 172], [145, 186], [140, 212], [118, 250], [80, 277]],
    c: [[98, 165], [120, 170], [137, 177]],
    d: [[82, 185], [106, 196], [130, 206]],
  }, 100, 200, 1.45),
  boat: fit({
    a: [[126, 53], [90, 130], [92, 195], [112, 248], [144, 286]],
    b: [[176, 76], [166, 105], [158, 140], [158, 160], [160, 200], [180, 245], [214, 280]],
    c: [[95, 128], [123, 128], [152, 128]],
    d: [[104, 241], [135, 241], [166, 241]],
  }, 149, 170, 0.98),
};

export const NAMES = Object.keys(SRC);
const RUNS = ['a', 'b', 'c', 'd'];

/**
 * Picture `name` moved `u` of the way to 月. u = 0 is the picture, 1 the character.
 * A run the picture does not have (the moon's bars) is drawn in over the last
 * part of the move, in place, as the frame it sits in settles.
 * `draw` brings the whole mark in stroke by stroke; `hi` colours runs by key.
 */
export function yue(name, u, {
  cx = 300, cy = 300, R = 1, w = 11, opacity = 1, draw = 1, color = INK, hi = {},
} = {}) {
  const e = clamp01(u);
  const src = SRC[name];
  const tension = lerp(1, 0.55, e);
  const on = i => clamp01(clamp01(draw) * RUNS.length - i);
  return RUNS.map((k, i) => {
    let pts = YUE[k], p = on(i);
    if (src[k]) pts = blend(src[k], YUE[k], e);
    else p = Math.min(p, clamp01((e - 0.62) / 0.33));
    if (p <= 0) return '';
    return ink(smooth(pts.map(([x, y]) => [cx + x * R, cy + y * R]), { tension }), p,
      { w: w * Math.max(0.5, R), color: hi[k] || color, opacity });
  }).join('');
}

// ---------------------------------------------------------------- in print
// The Kangxi Dictionary (1716) prints the three apart (ja.wikipedia 肉部, 月部):
// the moon's bars stop short of the right side, the meat's reach it, the boat
// has two dots. China's and Japan's twentieth-century standards made all three
// the meat's shape; Taiwan's and Hong Kong's keep the meat apart, its inner
// strokes tilted into a > that meets the right side (as Microsoft JhengHei
// draws Taiwan's standard form).
const BARS = {
  moon: { c: [[-58, -44], [-8, -44], [42, -44]], d: [[-58, 20], [-8, 20], [42, 20]] },
  meat: { c: YUE.c, d: YUE.d },
  boat: { c: [[-8, -58], [2, -46], [10, -34]], d: [[-8, 2], [2, 14], [10, 26]] },
  taiwan: { c: [[-58, -67], [2, -43], [62, -19]], d: [[-58, 45], [2, 21], [62, -3]] },
};
BARS.modern = BARS.meat;
export const PRINTS = Object.keys(BARS);

/** 月 as printed: kind in moon | meat | boat | modern | taiwan. only: 'bars' draws the inner two. */
export function printed(kind, {
  cx = 300, cy = 300, R = 1, w = 11, opacity = 1, draw = 1, color = INK, barColor = null, barP = 1, only = null,
} = {}) {
  const runs = { a: YUE.a, b: YUE.b, ...BARS[kind] };
  const keys = only === 'bars' ? ['c', 'd'] : RUNS;
  const on = i => clamp01(clamp01(draw) * RUNS.length - i);
  return keys.map(k => {
    const i = RUNS.indexOf(k);
    const p = k === 'c' || k === 'd' ? Math.min(on(i), barP) : on(i);
    if (p <= 0) return '';
    return ink(smooth(runs[k].map(([x, y]) => [cx + x * R, cy + y * R]), { tension: 0.55 }), p,
      { w: w * Math.max(0.5, R), color: (k === 'c' || k === 'd') && barColor ? barColor : color, opacity });
  }).join('');
}

// ---------------------------------------------------------------- strip
export function render(t) {
  const u = clamp01(t);
  const row = NAMES.map((n, i) => yue(n, u, { cx: 110 + i * 190, cy: 170, R: 0.62, w: 9 })).join('');
  const prints = PRINTS.map((k, i) => printed(k, { cx: 70 + i * 115, cy: 430, R: 0.42, w: 8, barColor: RED })).join('');
  return row + prints
    + `<text x="16" y="${CELL - 16}" font-family="monospace" font-size="15" fill="${INK_SOFT}">moon | meat | boat -> 月     printed: moon meat boat modern taiwan</text>`;
}

export function anchors(t) {
  const u = clamp01(t);
  return NAMES.flatMap((n, i) => RUNS.flatMap(k => {
    const s = SRC[n][k];
    const pts = s ? blend(s, YUE[k], u) : YUE[k];
    return pts.map(([x, y]) => [110 + i * 190 + x * 0.62, 170 + y * 0.62]);
  }));
}
