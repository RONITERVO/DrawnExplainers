// Working drawing: pesos abbreviated, and the abbreviation collapsing into $.
//   node lib/glyph.mjs sets/not-arbitrary/ep08-symbols-are-handwriting/strip-peso.mjs strip.png 5
//
// Two strokes throughout, which is exactly Cajori's account: the loop of the p
// disappears and its down-stroke is left standing, while the raised s comes
// down over it at full size.
//
//   p (8 anchors)  a written p  ->  the bare vertical of the dollar mark
//   s (7 anchors)  a raised s   ->  the S, dropped and grown to full height
//
// The p is one pen path with no lift: down the stem, through the descender,
// back up the same line, then round the bowl and back onto the stem. Keeping
// the retrace as a real anchor (4, on the stem) is what lets every one of the
// eight land on the vertical at the end without any of them having to cross
// another - and closing the bowl at 7 rather than leaving it hanging is the
// difference between a p and a triangle on a stick.
//
// The s is the same generator at two scales, so its topology is free - the
// only thing that changes is where it is and how big.

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

/** A written p, and the same eight anchors flattened onto a vertical. */
export function pStates({ cx = 300, cy = 300, R = 1 } = {}) {
  const s = (x, y) => [cx + x * R, cy + y * R];
  return [
    [s(-60, -104), s(-60, -20), s(-60, 40), s(-56, 112),
      s(-58, 30), s(-60, -56), s(26, -24), s(-52, 14)],
    [s(0, -150), s(0, -70), s(0, 10), s(0, 150),
      s(0, 60), s(0, -110), s(0, -40), s(0, 20)],
  ];
}

/** One S, anywhere, at any size. */
export const sAt = (cx, cy, w, h) => [
  [cx + 0.72 * w, cy - 0.86 * h], [cx - 0.48 * w, cy - 1.00 * h],
  [cx - 0.86 * w, cy - 0.38 * h], [cx + 0.30 * w, cy - 0.02 * h],
  [cx + 0.86 * w, cy + 0.40 * h], [cx + 0.34 * w, cy + 1.00 * h],
  [cx - 0.82 * w, cy + 0.72 * h],
];

/** Raised and small over the p, then dropped onto it and full height. */
export const sStates = ({ cx = 300, cy = 300, R = 1 } = {}) => [
  sAt(cx + 58 * R, cy - 74 * R, 26 * R, 34 * R),
  sAt(cx, cy, 60 * R, 96 * R),
];

/** The mark at u, 0 the abbreviation and 1 the dollar sign. `draw` writes the
 *  p on and then raises the s over it, in that order. */
export function peso(u, { cx = 300, cy = 300, R = 1, w = 13, opacity = 1, color = INK, draw = 1 } = {}) {
  const o = { cx, cy, R };
  const e = clamp01(u);
  const on = i => clamp01(clamp01(draw) * 2 - i);
  return ink(smooth(blend(...pStates(o), e), { tension: lerp(0.8, 0.12, e) }), on(0), { w, color, opacity })
    + ink(smooth(blend(...sStates(o), e), { tension: 0.95 }), on(1), { w, color, opacity });
}

export const anchors = (t) => blend(...pStates({ cx: 300, cy: 300, R: 1 }), clamp01(t));

export function render(t) {
  return peso(t, { cx: 300, cy: 300, R: 1.1, w: 14 })
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="18" fill="${INK_SOFT}">p with a raised s -&gt; $</text>`;
}
