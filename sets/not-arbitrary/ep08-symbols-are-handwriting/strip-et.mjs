// Working drawing: the Latin word et, joined up until it stops being letters.
//   node lib/glyph.mjs sets/not-arbitrary/ep08-symbols-are-handwriting/strip-et.mjs strip.png 7
//
// Two strokes throughout, and only two: the e and the t. That is the whole
// topology argument of the shot. A cursive hand writes the e as one loop and
// exits from its foot across the t at x-height, and that exit stroke IS the
// t's crossbar - which is why the ligature saves a pen lift, and why the
// finished ampersand has no crossbar of its own to account for.
//
//   e (9 anchors)  loop  ->  the double bowl on the left of the &
//   t (5 anchors)  stem  ->  the diagonal leaning back through it
//
// Both runs are indexed the same way round the page in every state - the e
// walks top-right, top, left, bottom, bottom-right in all three; the t walks
// top to foot in all three - so neither can fold through itself. The e's waist
// (index 4) is the only anchor that changes side: it starts at the far left of
// the loop and is pulled right of centre, which is the pinch that turns a
// closed e into the epsilon the & is built on.

import { smooth, ink, along, blend, clamp01, lerp, INK, INK_SOFT } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const rad = d => (d * Math.PI) / 180;

/** The e, in its three states: cursive loop, leaning into the t, the &'s E. */
export function eStates({ cx = 300, cy = 300, R = 1 } = {}) {
  const s = (x, y) => [cx + x * R, cy + y * R];
  return [
    // the cursive e: the eye tucked inside, round the loop, then an exit
    // stroke that rises to the right and crosses the t at x-height. That exit
    // is the t's crossbar - which is the pen lift the ligature saves.
    [s(-40, -14), s(2, -46), s(-48, -68), s(-104, -46), s(-126, 4),
      s(-108, 54), s(-58, 76), s(-6, 56), s(150, -26)],
    // half way: the loop pinches at the waist and the exit is pulled back in.
    [s(-6, -56), s(-16, -88), s(-70, -88), s(-100, -50), s(-64, -6),
      s(-104, 40), s(-116, 96), s(-54, 140), s(96, 52)],
    // the ampersand's E: a small bowl over a larger one, pinched at the waist.
    [s(26, -92), s(-24, -126), s(-86, -104), s(-94, -50), s(-24, -12),
      s(-98, 22), s(-114, 96), s(-30, 146), s(86, 106)],
  ];
}

/** The t: an upright stem that leans back through the e and becomes the slash. */
export function tStates({ cx = 300, cy = 300, R = 1 } = {}) {
  const s = (x, y) => [cx + x * R, cy + y * R];
  return [
    [s(100, -112), s(98, -50), s(96, 12), s(94, 74), s(128, 116)],
    [s(110, -114), s(86, -52), s(56, 10), s(26, 72), s(18, 126)],
    [s(118, -116), s(70, -54), s(14, 6), s(-40, 70), s(-88, 142)],
  ];
}

/**
 * The word at chain position x, 0..2.
 *
 * Tension eases off as it goes: a cursive loop wants a relaxed Catmull-Rom and
 * the finished mark wants its waist to come to something like a corner.
 *
 * `draw` writes it on, e first and then the t, the way a hand puts it down.
 */
export function et(x, { cx = 300, cy = 300, R = 1, w = 13, opacity = 1, color = INK, draw = 1 } = {}) {
  const o = { cx, cy, R };
  const p = clamp01(x / 2);
  const on = i => clamp01(clamp01(draw) * 2 - i);
  return ink(along(eStates(o), x, { tension: lerp(1, 0.72, p) }), on(0), { w, color, opacity })
    + ink(along(tStates(o), x, { tension: lerp(0.9, 0.55, p) }), on(1), { w, color, opacity });
}

export const anchors = (t) => {
  const st = eStates({ cx: 300, cy: 300 });
  const x = clamp01(t) * 2;
  const i = Math.min(Math.floor(x), 1);
  return blend(st[i], st[i + 1], x - i);
};

export function render(t) {
  return et(t * 2, { cx: 300, cy: 300, R: 1.15, w: 14 })
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="18" fill="${INK_SOFT}">et joined -&gt; ligature -&gt; &amp;</text>`;
}
