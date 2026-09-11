// Working drawing: the Roman thousand, and the five hundred hiding inside it.
//   node lib/glyph.mjs sets/not-arbitrary/ep07-roman-numerals/strip-thousand.mjs strip.png 7
//
// A thousand was written as three marks - an arc, a stroke, and a second arc
// turned back the other way. Pushed together they fuse into a ring with a bar
// through it; opened out again by a hand in a hurry they straighten into the
// letter we still use. Cut the same ring down the middle and the right-hand
// half, stroke and all, is already a D.
//
// Topology: three paths throughout, 5 / 2 / 5 anchors, never changing count.
// The two arcs are the same generator mirrored, so the right one cannot drift
// from the left. Both arcs are indexed counter-clockwise on screen in every
// state - the C runs 300 -> 60 degrees and the ring half runs 270 -> 90, both
// decreasing - which is the half of the topology rule morph() cannot check.
//
// The M limb puts an anchor *on* the corner, not near it. Spreading the five
// anchors evenly by arc length along the limb looks like the careful thing to
// do and is wrong: the corner then falls between two anchors and smooth()
// rounds straight through it, so the finished M has bowed shoulders. The
// correspondence that matters is the far point of the arc becoming the corner
// of the limb, and the two midpoints either side of it staying midpoints.

import { P, smooth, ink, blend, along, lerp, clamp01, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const rad = (d) => (d * Math.PI) / 180;
const arcPoints = (cx, cy, rx, ry, degs) =>
  degs.map(d => [cx + Math.cos(rad(d)) * rx, cy + Math.sin(rad(d)) * ry]);

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * The left arc in each of its three states.
 *   0  the C of C I Ɔ, standing clear of the stroke
 *   1  the left half of the closed ring
 *   2  the left limb of M, traced vertex -> top left -> foot
 */
export function leftStates({ cx = 300, cy = 300, R = 118 } = {}) {
  const gap = R * 1.0;
  const mw = R * 1.14;
  const mh = R * 1.12;
  const vertex = [cx, cy + mh];
  const corner = [cx - mw, cy - mh];
  const foot = [cx - mw, cy + mh];
  return [
    arcPoints(cx - gap, cy, R, R, [300, 240, 180, 120, 60]),
    arcPoints(cx, cy, R, R, [270, 225, 180, 135, 90]),
    [vertex, mid(vertex, corner), corner, mid(corner, foot), foot],
  ];
}

/** The right arc is the left arc mirrored, which keeps the two halves identical. */
export const rightStates = (opts = {}) => {
  const cx = opts.cx ?? 300;
  return leftStates(opts).map(s => s.map(([x, y]) => [2 * cx - x, y]));
};

/** The stroke between them: the I of C I Ɔ, then the ring's bar, then M's vertex. */
export function barStates({ cx = 300, cy = 300, R = 118 } = {}) {
  const mh = R * 1.12;
  return [
    [[cx, cy - R], [cx, cy + R]],
    [[cx, cy - R], [cx, cy + R]],
    [[cx, cy + mh - R * 0.08], [cx, cy + mh]],
  ];
}

/** The five hundred: the ring's right half and its bar, closed up into a D. */
export function dStates({ cx = 300, cy = 300, R = 118 } = {}) {
  const dx = cx - R * 0.2;
  const dw = R * 1.08;
  const dh = R * 1.1;
  return {
    bowl: [
      rightStates({ cx, cy, R })[1],
      [
        [dx, cy - dh],
        [dx + dw * 0.86, cy - dh * 0.72],
        [dx + dw, cy],
        [dx + dw * 0.86, cy + dh * 0.72],
        [dx, cy + dh],
      ],
    ],
    stem: [
      barStates({ cx, cy, R })[1],
      [[dx, cy - dh], [dx, cy + dh]],
    ],
  };
}

/**
 * The thousand at chain position x, 0..2.
 *
 * Tension falls as it goes: the arcs are drawn round and the letter is drawn
 * with corners, and a relaxed Catmull-Rom balloons at every corner of an M.
 */
export function thousand(x, { cx = 300, cy = 300, R = 118, w = 14, opacity = 1, color = INK } = {}) {
  const o = { cx, cy, R };
  const p = clamp01(x / 2);
  const tension = lerp(1, 0.16, p);
  const barFade = 1 - clamp01((x - 1.55) / 0.45);
  return ink(along(leftStates(o), x, { tension }), 1, { w, color, opacity })
    + ink(along(rightStates(o), x, { tension }), 1, { w, color, opacity })
    + ink(along(barStates(o), x, { tension: 0.1 }), 1, { w, color, opacity: opacity * barFade });
}

/** The five hundred at u, 0..1: the ring on the left, a D on the right. */
export function fiveHundred(u, { cx = 300, cy = 300, R = 118, w = 14, opacity = 1, color = INK, ghost = 1 } = {}) {
  const o = { cx, cy, R };
  const e = clamp01(u);
  const { bowl, stem } = dStates(o);
  const gone = leftStates(o)[1].map(([x, y]) => [x - e * R * 1.5, y]);
  const left = ink(smooth(gone, { tension: 1 }), 1,
    { w, color, opacity: opacity * ghost * (1 - e) });
  return left
    + ink(smooth(blend(bowl[0], bowl[1], e), { tension: lerp(1, 0.95, e) }), 1, { w, color, opacity })
    + ink(smooth(blend(stem[0], stem[1], e), { tension: 0.1 }), 1, { w, color, opacity });
}

/** The knife: a rule drawn straight down the middle of the ring. */
export const cutLine = (p, { cx = 300, cy = 300, R = 118 } = {}) =>
  ink(new P().M(cx, cy - R * 1.7).L(cx, cy + R * 1.7), p, { w: 4, color: RED, dash: '14 11', opacity: 0.9 });

export const anchors = (t) => {
  const o = { cx: 300, cy: 190, R: 78 };
  const x = t * 2;
  const n = 2;
  const i = Math.min(Math.floor(x), n - 1);
  return blend(leftStates(o)[i], leftStates(o)[i + 1], x - i);
};

export function render(t) {
  const top = { cx: 300, cy: 190, R: 78, w: 10 };
  const bot = { cx: 300, cy: 440, R: 78, w: 10 };
  return thousand(t * 2, top)
    + `<text x="16" y="300" font-family="monospace" font-size="18" fill="${INK_SOFT}">C I O -&gt; ring -&gt; M</text>`
    + cutLine(t < 0.5 ? t * 2 : 1, bot)
    + fiveHundred(clamp01((t - 0.45) / 0.55), bot)
    + `<text x="16" y="556" font-family="monospace" font-size="18" fill="${INK_SOFT}">ring cut in half -&gt; D</text>`;
}
