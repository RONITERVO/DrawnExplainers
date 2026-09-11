// Working drawing: the tally stick, and the crossed notch halved.
//   node lib/glyph.mjs sets/not-arbitrary/ep07-roman-numerals/strip-tally.mjs strip.png 5
//
// The whole film runs on one move: a mark cut in half is the mark for half the
// number. Here it is in its simplest form. The tenth notch is cut clean across
// the stick, which is an X; take the top of that cut and it is a V.
//
// Topology: two strokes, two anchors each, throughout. Each stroke holds its
// outer end and walks its inner end to the crossing point, so the anchor count
// and the direction of travel can never change. This is the safest morph in
// the episode and it is deliberately the first one the viewer sees.

import { P, smooth, ink, lerp, clamp01, INK, INK_SOFT } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

/** The stick itself: a split plank, drawn not filled. */
export function plank({ cx = 300, cy = 150, half = 270, h = 34 } = {}) {
  return new P()
    .M(cx - half, cy - h).L(cx + half, cy - h)
    .L(cx + half, cy + h).L(cx - half, cy + h).Z();
}

/** A plain notch: one cut across the top edge of the plank. */
export function notch(i, { cx = 300, cy = 150, pitch = 44, n = 11, h = 34, depth = 26 } = {}) {
  const x = cx - ((n - 1) / 2) * pitch + i * pitch;
  return new P().M(x, cy - h - 6).L(x, cy - h + depth);
}

/** The fifth notch, cut differently: a small wedge rather than a single line. */
export function fifthCut(i, opts = {}) {
  const { cx = 300, cy = 150, pitch = 44, n = 11, h = 34 } = opts;
  const x = cx - ((n - 1) / 2) * pitch + i * pitch;
  const w = pitch * 0.34;
  return new P().M(x - w, cy - h - 8).L(x, cy - h + 24).L(x + w, cy - h - 8);
}

/** The tenth notch, cut clean across: a full cross through the plank. */
export function tenthCut(i, opts = {}) {
  const { cx = 300, cy = 150, pitch = 44, n = 11, h = 34 } = opts;
  const x = cx - ((n - 1) / 2) * pitch + i * pitch;
  const w = pitch * 0.42;
  return [
    new P().M(x - w, cy - h - 8).L(x + w, cy + h + 8),
    new P().M(x + w, cy - h - 8).L(x - w, cy + h + 8),
  ];
}

/**
 * The crossed cut, halved. t=0 is the full X; t=1 is its top half, which is V.
 *
 * Both strokes keep the anchor they started from and drag the other one to the
 * crossing point. The arms draw in a little and the whole mark settles down the
 * page as it goes, so the V ends up sitting on the line rather than floating in
 * the upper half of the box where the geometry leaves it.
 */
export function cross(t, { cx = 300, cy = 340, r = 118 } = {}) {
  const e = clamp01(t);
  const dy = lerp(0, r * 0.5, e);
  const ax = lerp(r, r * 0.78, e);
  const top = cy - r + dy;
  const foot = lerp(cy + r, cy, e) + dy;
  return [
    [[cx - ax, top], [lerp(cx + r, cx, e), foot]],
    [[cx + ax, top], [lerp(cx - r, cx, e), foot]],
  ];
}

export const anchors = (t) => cross(t).flat();

export function render(t) {
  const opts = { cx: 300, cy: 130, pitch: 44, n: 11, h: 30 };
  const out = [ink(plank(opts), 1, { w: 5, color: INK_SOFT })];
  for (let i = 0; i < 11; i += 1) {
    if (i === 4) out.push(ink(fifthCut(i, opts), 1, { w: 5, color: INK }));
    else if (i === 9) tenthCut(i, opts).forEach(p => out.push(ink(p, 1, { w: 5, color: INK })));
    else out.push(ink(notch(i, opts), 1, { w: 5, color: INK }));
  }
  for (const stroke of cross(t, { cx: 300, cy: 360, r: 118 })) {
    out.push(ink(smooth(stroke, { tension: 0.2 }), 1, { w: 13, color: INK }));
  }
  return out.join('');
}
