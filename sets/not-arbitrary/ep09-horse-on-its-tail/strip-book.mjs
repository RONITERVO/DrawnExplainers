// Working drawing: a book of bamboo strips, becoming 冊.
//   node lib/glyph.mjs sets/not-arbitrary/ep09-horse-on-its-tail/strip-book.mjs strip.png 7
//
// Three states, five strokes throughout:
//
//   0  four strips of bamboo, long and short, with a cord looped through them
//   1  the oracle-bone graph: each strip pressed to a single line, long and
//      short alternating, the cord still looping round the ends - drawn from
//      the oracle form on Wikimedia Commons (冊-oracle.svg)
//   2  冊, two 冂 side by side on a crossbar
//
// Each strip is one open run, drawn the way a pen goes round a narrow card:
//
//   [bottom-left, top-left, top-right, bottom-right, back toward bottom-left]
//
// which is what lets strips 2 and 4 become the ㇆ strokes of 冊 without a
// split. Their left edge collapses to nothing, their top edge stretches left
// to reach over the neighbouring strip, their right edge is the upright, and
// the last leg of the run turns into the hook at its foot. Strips 1 and 3 just
// press flat onto their own left edge. The cord's loops pull out straight and
// it becomes the crossbar, still sticking out past the strips on both sides.

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const XS = [-105, -35, 35, 105];
const HALF = 22;
const LEN = [[-150, 150], [-118, 122], [-150, 150], [-118, 122]];

const card = (x, [top, bot], half) =>
  [[x - half, bot], [x - half, top], [x + half, top], [x + half, bot], [x - half + 4, bot]];

const CORD_BUNDLE = [[-140, 16], [-160, 6], [-156, -12], [-134, -10], [-60, -2], [0, 2],
  [60, -2], [134, -10], [156, -12], [160, 6], [140, 16]];
const CORD_GRAPH = [[-128, 14], [-146, 8], [-142, -10], [-120, -6], [-60, 0], [0, 0],
  [60, 0], [120, -6], [142, -10], [146, 8], [128, 14]];
const CORD_CE = CORD_GRAPH.map((_, i) => [lerp(-156, 156, i / 10), 14]);

const STATES = [
  {
    strips: XS.map((x, i) => card(x, LEN[i], HALF)),
    cord: CORD_BUNDLE,
  },
  {
    strips: XS.map((x, i) => card(x, LEN[i], 0.5)),
    cord: CORD_GRAPH,
  },
  {
    // Strips 1 and 3 are a single upright traced up and back down over
    // itself, with the anchors kept on the line so the run cannot bow.
    strips: [
      [[-112, 140], [-112, -120], [-112, -118], [-112, 20], [-112, 140]],
      [[-110, -120], [-108, -120], [-40, -120], [-40, 134], [-52, 124]],
      [[40, 140], [40, -120], [40, -118], [40, 20], [40, 140]],
      [[40, -120], [42, -120], [112, -120], [112, 134], [100, 124]],
    ],
    cord: CORD_CE,
  },
];

/** Anchors of strip r (0..3) or the cord (r = 'cord') at chain position x. */
export function runAt(r, x, { cx = 300, cy = 300, R = 1 } = {}) {
  const u = clamp01(x / 2) * 2;
  const i = Math.min(Math.floor(u), 1);
  const pick = s => (r === 'cord' ? STATES[s].cord : STATES[s].strips[r]);
  return blend(pick(i), pick(i + 1), u - i).map(([px, py]) => [cx + px * R, cy + py * R]);
}

/**
 * The book at chain position x: 0 bamboo, 1 the graph, 2 冊.
 * `draw` writes the strips on left to right, then the cord.
 * `cordRed` lays the binding over in red, 0..1, so a shot can point at it in
 * every state at once. `tint` fills the strips as bamboo while they are still
 * strips, and fades as they press down into lines.
 */
export function book(x, {
  cx = 300, cy = 300, R = 1, w = null, opacity = 1, draw = 1, color = INK, cordRed = 0, tint = null,
} = {}) {
  const at = { cx, cy, R };
  const k = clamp01(x / 2);
  const width = (w ?? lerp(6, 13, clamp01(x - 0.6))) * Math.max(0.5, R);
  const tension = lerp(0.12, 0.3, k);
  const on = i => clamp01(clamp01(draw) * 5 - i);
  const flat = 1 - clamp01(x * 1.5);
  const fills = tint && flat > 0.01
    ? [0, 1, 2, 3].map(r => {
      const p = smooth(runAt(r, x, at), { tension });
      return `<path d="${p.d()}" fill="${tint}" opacity="${(opacity * flat * 0.5 * on(r)).toFixed(3)}"/>`;
    }).join('')
    : '';
  const strips = [0, 1, 2, 3].map(r => ink(smooth(runAt(r, x, at), { tension }), on(r), { w: width, color, opacity }));
  const cordPath = smooth(runAt('cord', x, at), { tension: lerp(0.9, 0.4, k) });
  const cordW = width * lerp(0.7, 1, k);
  const cord = ink(cordPath, on(4), { w: cordW, color, opacity })
    + (cordRed > 0.01 ? ink(cordPath, on(4), { w: cordW, color: RED, opacity: opacity * cordRed }) : '');
  return fills + strips.join('') + cord;
}

export function anchors(t) {
  const x = clamp01(t) * 2;
  return [...runAt(1, x, { cx: 300, cy: 280, R: 1.2 }), ...runAt('cord', x, { cx: 300, cy: 280, R: 1.2 })];
}

export function render(t) {
  return book(clamp01(t) * 2, { cx: 300, cy: 280, R: 1.2 })
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="18" fill="${INK_SOFT}">bamboo -&gt; graph -&gt; ce</text>`;
}
