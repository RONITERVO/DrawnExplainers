// Working drawing: the Etruscan hundred, halved, flattened, and read as a letter.
//   node lib/glyph.mjs sets/not-arbitrary/ep07-roman-numerals/strip-star.mjs strip.png 7
//
// Four states, one chain, driven by along():
//
//   0  the star          three crossed lines, six spokes
//   1  the half          the top three spokes only - the fifty sign
//   2  the flattened     the two diagonals pressed down to horizontal, an up tack
//   3  the letter        the stem slid out to the left end of the bar
//
// Topology: three strokes of two anchors each, the whole way. Every stroke
// holds one anchor and moves the other, so nothing can split, merge or reverse.
// The halving is the same move as the crossed notch in strip-tally, one size up,
// which is the argument of the film made twice with different numbers.

import { smooth, ink, along, INK } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

/**
 * The three strokes, each as a list of four states.
 * Index 0 of every stroke is the anchor that is held; index 1 does the moving.
 */
export function strokes({ cx = 300, cy = 320, R = 118 } = {}) {
  const BAR = R * 0.72;    // half-width of the flattened bar
  const TALL = R * 1.52;   // stem height once it is a written letter
  // Halving keeps the top half where it was, so every state after the star
  // hangs above the baseline and reads as floating high in its column. Each
  // state carries an offset that re-centres it on cy. It is a translation, so
  // the argument is untouched and only the mark settles onto the page - the
  // same correction cross() makes after the crossed notch loses its lower half.
  const drop = [0, R / 2, TALL / 2, TALL / 2];
  const stem = [
    [[cx, cy - R], [cx, cy + R]],            // full vertical spoke
    [[cx, cy - R], [cx, cy]],                // top half only
    [[cx, cy - TALL], [cx, cy]],             // drawn taller as a written stem
    [[cx - BAR, cy - TALL], [cx - BAR, cy]], // slid out to the end of the bar
  ];
  const left = [
    [[cx - R, cy - R], [cx + R, cy + R]],
    [[cx - R, cy - R], [cx, cy]],
    [[cx - BAR, cy], [cx, cy]],
    [[cx - BAR, cy], [cx, cy]],
  ];
  const right = [
    [[cx + R, cy - R], [cx - R, cy + R]],
    [[cx + R, cy - R], [cx, cy]],
    [[cx + BAR, cy], [cx, cy]],
    [[cx + BAR, cy], [cx, cy]],
  ];
  const settle = (states) => states.map((pair, i) => pair.map(([x, y]) => [x, y + drop[i]]));
  return [stem, left, right].map(settle);
}

/** Render the mark at chain position x, which runs 0..3. */
export function star(x, { cx = 300, cy = 320, R = 118, w = 13, opacity = 1, color = INK } = {}) {
  return strokes({ cx, cy, R })
    .map(states => ink(along(states, x, { tension: 0.2 }), 1, { w, color, opacity }))
    .join('');
}

export const anchors = (x) => strokes().flatMap((states) => {
  const n = states.length - 1;
  const u = Math.max(0, Math.min(n, x * n)) / 1;
  const i = Math.min(Math.floor(u), n - 1);
  const f = u - i;
  return states[i].map((p, k) => [
    p[0] + (states[i + 1][k][0] - p[0]) * f,
    p[1] + (states[i + 1][k][1] - p[1]) * f,
  ]);
});

export const render = (t) => star(t * 3);
