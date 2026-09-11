// Working drawing: Volta's pile -> the battery symbol.
//   node lib/glyph.mjs sets/not-arbitrary/ep06-circuit-symbols/strip-battery.mjs strip.png 5
//
// Six discs become six lines. Same six shapes throughout, same 8 anchors each,
// same direction of travel — the only things that move are height, spacing and
// width, so the topology can never break.

import { smooth, lerp, INK, GOLD } from '../../../lib/scene-kit.mjs';

export const CELL = 600;
export const ZINC = 'hsl(25, 8%, 55%)';   // zinc reads grey against the copper
export const N = 6;

/** A lozenge as 8 anchors, clockwise from the left tip. */
export function bar(cx, cy, w, h) {
  const r = Math.min(h * 0.5, w * 0.22);
  return [
    [cx - w / 2, cy],
    [cx - w / 2 + r, cy - h / 2],
    [cx, cy - h / 2],
    [cx + w / 2 - r, cy - h / 2],
    [cx + w / 2, cy],
    [cx + w / 2 - r, cy + h / 2],
    [cx, cy + h / 2],
    [cx - w / 2 + r, cy + h / 2],
  ];
}

/** Disc i of the pile at morph position t. Even i is copper, odd is zinc. */
export function disc(i, t, { cx = 300, cy = 300, scale = 1 } = {}) {
  const h = lerp(40, 9, t) * scale;
  const pitch = (lerp(40, 9, t) + lerp(4, 30, t)) * scale;
  const copper = i % 2 === 0;
  const w = (copper ? lerp(168, 196, t) : lerp(120, 96, t)) * scale;
  return bar(cx, cy + (i - (N - 1) / 2) * pitch, w, h);
}

export const discColour = (i, t) => (i % 2 === 0
  ? (t > 0.75 ? INK : GOLD)
  : (t > 0.75 ? INK : ZINC));

export const anchors = (t) => disc(0, t).concat(disc(1, t));

export function render(t) {
  const out = [];
  for (let i = 0; i < N; i += 1) {
    const path = smooth(disc(i, t), { closed: true, tension: 0.45 });
    out.push(`<path d="${path.d()}" fill="${discColour(i, t)}"/>`);
  }
  // The lead wires only exist once it is a symbol.
  if (t > 0.6) {
    const o = ((t - 0.6) / 0.4).toFixed(2);
    out.push(`<path d="M 300 120 L 300 168 M 300 432 L 300 480" stroke="${INK}" stroke-width="6" stroke-linecap="round" opacity="${o}"/>`);
  }
  return out.join('');
}
