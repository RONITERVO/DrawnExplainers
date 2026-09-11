// Working drawing: per cento abbreviated, and the abbreviation becoming %.
//   node lib/glyph.mjs sets/not-arbitrary/ep08-symbols-are-handwriting/strip-percent.mjs strip.png 7
//
// Four strokes throughout, four at every step, nothing added and nothing taken
// away:
//
//   p    (8 anchors)  the p of per   -> lies down along the rule -> the bar
//   rule (2 anchors)  the scribe's abbreviation stroke through its descender
//                                    -> holds still -> the bar of the fraction
//   c    (8 anchors)  the c of cento -> closes into the upper zero
//   o    (8 anchors)  the raised -o  -> drops and grows into the lower one
//
// The p and the rule end up on the same line, which is the point of the shot:
// the letter is dropped and the line that was already ruled through it is left
// doing the same job it was always doing. Nothing fades. The p's anchors
// simply become collinear with the rule's, so the two render as one stroke,
// and then that stroke tilts and opens out into the solidus.
//
// A p with a slashed descender cannot be drawn as one continuous pen path -
// tried, and every ordering of the eight anchors zigzags, because a real hand
// lifts the pen to cross the descender. The rule is therefore its own stroke,
// which is also what makes it available to survive the letter.
//
// Every arc is swept with decreasing angle, so the c, the o and the circles
// they become are indexed the same way round and none can invert. ring() in
// the kit sweeps the other way, so these are built by hand rather than
// borrowed.

import { ink, along, blend, clamp01, lerp, INK, INK_SOFT } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const rad = d => (d * Math.PI) / 180;
/** Eight anchors round an arc, always decreasing in angle. */
const arc = (cx, cy, r, from, to) => Array.from({ length: 8 }, (_, i) => {
  const a = rad(from + ((to - from) * i) / 7);
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
/** n anchors spread along a segment, so a stroke can lie down on it. */
const along2 = (n, [x0, y0], [x1, y1]) => Array.from({ length: n }, (_, i) =>
  [x0 + ((x1 - x0) * i) / (n - 1), y0 + ((y1 - y0) * i) / (n - 1)]);

/** Where the abbreviation stroke sits, and where it ends up. */
const RULE_A = [[-166, 86], [-70, 70]];
const BAR = [[-78, 136], [168, -112]];

/** The p of per: written, laid down on its own rule, then out along the bar. */
export function pStates({ cx = 300, cy = 300, R = 1 } = {}) {
  const s = ([x, y]) => [cx + x * R, cy + y * R];
  const written = [
    [-120, -104], [-120, -20], [-120, 40], [-116, 112],
    [-118, 30], [-120, -56], [-34, -24], [-112, 14],
  ].map(s);
  return [written, along2(8, s(RULE_A[0]), s(RULE_A[1])), along2(8, s(BAR[0]), s(BAR[1]))];
}

/** The rule: unmoved while the letter withdraws onto it, then the fraction bar. */
export function ruleStates({ cx = 300, cy = 300, R = 1 } = {}) {
  const s = ([x, y]) => [cx + x * R, cy + y * R];
  const a = RULE_A.map(s);
  return [a, a, BAR.map(s)];
}

/** The c of cento, closing into the upper zero. */
export const cStates = ({ cx = 300, cy = 300, R = 1 } = {}) => {
  const a = arc(cx + 56 * R, cy, 58 * R, -52, -310);
  const b = arc(cx - 22 * R, cy - 58 * R, 56 * R, -52, -404);
  return [a, blend(a, b, 0.45), b];
};

/** The raised -o ending, dropping and growing into the lower zero. */
export const oStates = ({ cx = 300, cy = 300, R = 1 } = {}) => {
  const a = arc(cx + 134 * R, cy - 62 * R, 20 * R, -52, -404);
  const b = arc(cx + 112 * R, cy + 82 * R, 56 * R, -52, -404);
  return [a, blend(a, b, 0.45), b];
};

/** The mark at chain position x, 0..2. `draw` writes the four strokes on in
 *  the order a hand makes them: the letter, the rule through it, then cento. */
export function percent(x, { cx = 300, cy = 300, R = 1, w = 13, opacity = 1, color = INK, draw = 1 } = {}) {
  const o = { cx, cy, R };
  const p = clamp01(x / 2);
  const pen = { w, color, opacity };
  const on = i => clamp01(clamp01(draw) * 4 - i);
  return ink(along(pStates(o), x, { tension: lerp(1, 0.06, p) }), on(0), pen)
    + ink(along(ruleStates(o), x, { tension: 0.1 }), on(1), pen)
    + ink(along(cStates(o), x, { tension: 1 }), on(2), pen)
    + ink(along(oStates(o), x, { tension: 1 }), on(3), pen);
}

export const anchors = () => {
  return [];
};

export function render(t) {
  return percent(t * 2, { cx: 320, cy: 290, R: 1.05, w: 14 })
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="18" fill="${INK_SOFT}">p-cento -&gt; the p lies down on its rule -&gt; %</text>`;
}
