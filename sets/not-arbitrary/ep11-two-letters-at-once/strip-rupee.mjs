// Working drawing: the Roman R and the Devanagari ra, becoming the rupee sign.
//   node lib/glyph.mjs sets/not-arbitrary/ep11-two-letters-at-once/strip-rupee.mjs strip.png 7
//
// The Government of India's description, as Wikipedia gives it: "a
// combination of the Devanagari letter ra and the Latin capital letter R
// without its vertical bar", with "a double horizontal line at the top".
//
// The target is traced from Wikimedia Commons' "Indian Rupee symbol.svg"
// (viewBox 40 -1 170 250), whose outline was read as centrelines and scaled
// to a half-height of 1 about its centre (125, 125):
//
//   bar 1   y 11.5  ->  -0.908        the Devanagari headline
//   bar 2   y 59.5  ->  -0.524        the headline doubled
//   bowl    hangs from bar 1 on the left, swings out to x 0.19, and comes
//           back to a stub at the left edge, (48..85, 115..137)
//   leg     from the stub down to the foot at (158, 250)
//
// Three runs in each source, and their fates:
//
//   R     stem          -> gone (element subtraction: "without its vertical bar")
//         bowl (8)      -> the bowl, top-left round to the stub, same way round
//         leg (3)       -> the leg
//   ra    headline (2)  -> bar 1
//         body (8)      -> the bowl: its root slides left along the headline and
//                          the little hook at its end flattens into the stub
//         tail (3)      -> the leg
//
// Bar 2 is the one new stroke. Both sources land on the same three strokes,
// which is the claim: without its upright, the R is the ra.

import { smooth, ink, clamp01, lerp, blend, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const RUPEE = {
  bar1: [[-0.62, -0.908], [0.61, -0.908]],
  bar2: [[-0.62, -0.524], [0.61, -0.524]],
  bowl: [[-0.47, -0.908], [0.02, -0.905], [0.16, -0.82], [0.19, -0.6], [0.17, -0.4], [0.03, -0.15], [-0.25, -0.01], [-0.52, 0.0]],
  leg: [[-0.47, 0.06], [-0.1, 0.53], [0.27, 1.0]],
};

const LATIN = {
  stem: [[-0.58, -0.908], [-0.58, 0.05], [-0.58, 1.0]],
  bowl: [[-0.58, -0.908], [0.0, -0.908], [0.2, -0.83], [0.26, -0.62], [0.24, -0.38], [0.08, -0.12], [-0.22, -0.02], [-0.58, -0.02]],
  leg: [[-0.36, -0.02], [-0.02, 0.49], [0.32, 1.0]],
};

// Devanagari ra, traced by eye from Nirmala UI and set in the same frame.
const RA = {
  head: [[-0.62, -0.908], [0.61, -0.908]],
  body: [[0.1, -0.908], [0.22, -0.74], [0.28, -0.5], [0.26, -0.3], [0.14, -0.08], [-0.08, 0.03], [-0.3, 0.0], [-0.44, -0.16]],
  tail: [[-0.11, 0.14], [0.16, 0.55], [0.43, 0.96]],
};

const place = (pts, cx, cy, R) => pts.map(([x, y]) => [cx + x * R, cy + y * R]);
const line = (pts, p, cx, cy, R, o) => ink(smooth(place(pts, cx, cy, R), { tension: o.tension ?? 0.9 }), p, o);

/**
 * The Roman R at x = 0, its stemless remainder on the rupee's strokes at x = 1.
 * `stem` (1 drawn, 0 gone) is separate from x, so the upright can leave
 * before anything moves. R is px per half-height.
 */
export function latin(x, { cx = 300, cy = 300, R = 100, w = null, color = INK, opacity = 1, draw = 1, stem = 1 } = {}) {
  const u = clamp01(x);
  const width = w ?? R * 0.13;
  const order = stem > 0.01 ? ['stem', 'bowl', 'leg'] : ['bowl', 'leg'];
  const on = n => clamp01(clamp01(draw) * order.length - order.indexOf(n));
  const o = { w: width, color };
  return (stem > 0.01 ? line(LATIN.stem, on('stem'), cx, cy, R, { ...o, opacity: opacity * stem, tension: 0.2 }) : '')
    + line(blend(LATIN.bowl, RUPEE.bowl, u), on('bowl'), cx, cy, R, { ...o, opacity })
    + line(blend(LATIN.leg, RUPEE.leg, u), on('leg'), cx, cy, R, { ...o, opacity, tension: 0.2 });
}

/** The Devanagari ra at x = 0, on the rupee's strokes at x = 1. `headRed` lights the headline. */
export function devanagari(x, { cx = 300, cy = 300, R = 100, w = null, color = INK, opacity = 1, draw = 1, headRed = 0 } = {}) {
  const u = clamp01(x);
  const width = w ?? R * 0.13;
  const on = i => clamp01(clamp01(draw) * 3 - i);
  const o = { w: width, color, opacity };
  return line(blend(RA.head, RUPEE.bar1, u), on(0), cx, cy, R, { ...o, tension: 0.2 })
    + (headRed > 0.01 ? line(blend(RA.head, RUPEE.bar1, u), on(0), cx, cy, R, { ...o, color: RED, opacity: opacity * headRed, tension: 0.2 }) : '')
    + line(blend(RA.body, RUPEE.bowl, u), on(1), cx, cy, R, o)
    + line(blend(RA.tail, RUPEE.leg, u), on(2), cx, cy, R, { ...o, tension: 0.2 });
}

/** The rupee sign. `bar2` inks the second line, 0..1; `draw` writes the rest on first; `headRed` lights bar 1. */
export function rupee({ cx = 300, cy = 300, R = 100, w = null, color = INK, opacity = 1, draw = 1, bar2 = 1, headRed = 0 } = {}) {
  const width = w ?? R * 0.13;
  const on = i => clamp01(clamp01(draw) * 3 - i);
  const o = { w: width, color, opacity };
  return line(RUPEE.bar1, on(0), cx, cy, R, { ...o, tension: 0.2 })
    + (headRed > 0.01 ? line(RUPEE.bar1, on(0), cx, cy, R, { ...o, color: RED, opacity: opacity * headRed, tension: 0.2 }) : '')
    + line(RUPEE.bowl, on(1), cx, cy, R, o)
    + line(RUPEE.leg, on(2), cx, cy, R, { ...o, tension: 0.2 })
    + line(RUPEE.bar2, Math.min(clamp01(bar2), on(2)), cx, cy, R, { ...o, tension: 0.2 });
}

// ---------------------------------------------------------------- strip
export function anchors(t) {
  const u = clamp01(t * 1.4 - 0.2);
  return [...blend(RA.body, RUPEE.bowl, u), ...blend(RA.tail, RUPEE.leg, u)].map(([x, y]) => [450 + x * 120, 300 + y * 120]);
}

export function render(t) {
  const stem = 1 - clamp01(t * 5);
  const u = clamp01(t * 1.4 - 0.2);
  const bar2 = clamp01(t * 4 - 3);
  return latin(u, { cx: 150, cy: 300, R: 120, stem })
    + devanagari(u, { cx: 450, cy: 300, R: 120 })
    + (bar2 > 0 ? rupee({ cx: 300, cy: 300, R: 60, bar2 }) : '')
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="16" fill="${INK_SOFT}">R (stem off) | ra -&gt; the rupee's strokes</text>`;
}
