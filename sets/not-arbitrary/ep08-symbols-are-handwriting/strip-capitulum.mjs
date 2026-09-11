// Working drawing: the letter C for capitulum, closed up into a pilcrow.
//   node lib/glyph.mjs sets/not-arbitrary/ep08-symbols-are-handwriting/strip-capitulum.mjs strip.png 5
//
// Two strokes throughout: the letter, and the line ruled down through it.
//
//   bowl (8 anchors)  the C  ->  a bowl whose two ends land on the rule
//   rule (2 anchors)  a bar through the letter  ->  the pilcrow's stem
//
// The rule barely moves and is not meant to: the shot's argument is that the
// letter closed, not that the bar did anything. The C's ends walk inward onto
// the rule, which is arc tension - the circle constant coming down - rather
// than a fade between two drawings.
//
// Both runs sweep the same way round in both states (top-right, top, left,
// bottom, back to the right), so the bowl cannot fold through itself.
//
// fillPath() returns the same eight anchors closed, for flood(). It is a
// separate closed path rather than the drawn outline because outline geometry
// and fill geometry are not the same geometry: the drawn C wants its ends to
// stop short of the rule so the join reads as two strokes, and the fill wants
// them to run past it so no white wedge is left where they meet.

import { smooth, ink, flood, blend, clamp01, lerp, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const rad = d => (d * Math.PI) / 180;

/** The letter, open then closed. */
export function bowlStates({ cx = 300, cy = 300, R = 1 } = {}) {
  const s = (x, y) => [cx + x * R, cy + y * R];
  const open = [-52, -94, -140, -186, -232, -268, -294, -312]
    .map(a => s(Math.cos(rad(a)) * 122 - 30, Math.sin(rad(a)) * 122 - 6));
  return [
    open,
    [s(38, -132), s(-16, -140), s(-72, -112), s(-98, -62),
      s(-88, -6), s(-44, 26), s(-6, 34), s(38, 34)],
  ];
}

/** The rule down through it, which becomes the stem and grows a descender. */
export const ruleStates = ({ cx = 300, cy = 300, R = 1 } = {}) => [
  [[cx + 38 * R, cy - 148 * R], [cx + 38 * R, cy + 146 * R]],
  [[cx + 38 * R, cy - 140 * R], [cx + 38 * R, cy + 172 * R]],
];

/** The closed version of the bowl, for the red ink to flood into. */
export const fillPath = (u, { cx = 300, cy = 300, R = 1 } = {}) => {
  const a = blend(...bowlStates({ cx, cy, R }), clamp01(u));
  return smooth([...a, [cx + 44 * R, cy + 36 * R], [cx + 44 * R, cy - 140 * R]],
    { closed: true, tension: 0.85 });
};

/** The box the bowl occupies, so flood() knows where its waterline runs. */
export const fillBox = ({ cx = 300, cy = 300, R = 1 } = {}) => ({
  x: cx - 110 * R, y: cy - 150 * R, w: 180 * R, h: 200 * R,
});

/**
 * The mark at u, 0 the ruled letter and 1 the pilcrow. `paint` floods the
 * bowl with the rubricator's red, which is what actually closed it for good.
 *
 * `letterP` and `ruleP` draw the two strokes on separately, because in the
 * film the scribe writes the letter first and rules the line through it a
 * beat later - which is the order the sources describe, and the reason the
 * bar is not part of the letter.
 */
export function capitulum(u, {
  cx = 300, cy = 300, R = 1, w = 13, opacity = 1, color = INK, paint = 0,
  letterP = 1, ruleP = 1,
} = {}) {
  const o = { cx, cy, R };
  const e = clamp01(u);
  return ink(smooth(blend(...bowlStates(o), e), { tension: lerp(1, 0.9, e) }), letterP,
    { w, color, opacity })
    + ink(smooth(blend(...ruleStates(o), e), { tension: 0.1 }), ruleP, { w, color, opacity })
    + (paint > 0.002
      ? `<g opacity="${opacity.toFixed(3)}">${flood([fillPath(e, o)], paint, { color: RED, ...fillBox(o) })}</g>`
      : '');
}

export const anchors = (t) => blend(...bowlStates({ cx: 300, cy: 300, R: 1 }), clamp01(t * 1.6));

export function render(t) {
  return capitulum(clamp01(t * 1.6), { cx: 300, cy: 290, R: 1, w: 14, paint: clamp01((t - 0.6) / 0.4) })
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="18" fill="${INK_SOFT}">C ruled through -&gt; bowl closes -&gt; red ink</text>`;
}
