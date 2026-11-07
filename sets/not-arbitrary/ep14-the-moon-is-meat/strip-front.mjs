// Working drawing: 前 'in front', a foot standing in a boat.
//   node lib/glyph.mjs sets/not-arbitrary/ep14-the-moon-is-meat/strip-front.mjs strip.png 5
//
// Traced from 前-seal.svg on Commons (small seal, 300-unit box): 止 'foot'
// above 舟 'boat' - "a foot on a boat moving forward" (Wiktionary, 前). During
// libian, "止 was reduced to 䒑, as was 舟 to 月" (Wikipedia, Libian); the
// knife 刂 beside them came from the character for 'to cut', 𣦃, which took
// over the job, so it is drawn in afterwards as an addition, not morphed.
//
// Runs, each kept in its seal direction:
//   foot  f1 left upright           -> the left tick of 䒑
//         f2 middle upright         -> dropped: thins away where it stands
//         f3 the branch, from its tip -> the right tick (indexed tip-first,
//                                     the way the tick is written)
//         f4 the base line          -> the long bar of 䒑
//   boat  a  left side              -> 丿
//         b  top and right side      -> 𠃌
//         c  first bar               -> upper bar
//         d  second bar              -> lower bar
//         e  third bar               -> dropped

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const fit = (pts, cx = 151, cy = 150, s = 0.9) => pts.map(([x, y]) => [Math.round((x - cx) * s), Math.round((y - cy) * s)]);

// [seal, modern]; modern null = dropped
const RUNS = {
  f1: [fit([[84, 24], [86, 55], [89, 88]]), [[-62, -118], [-52, -103], [-42, -88]]],
  f2: [fit([[137, 20], [137, 55], [137, 92]]), null],
  f3: [fit([[186, 23], [180, 62], [141, 67]]), [[60, -120], [52, -104], [40, -88]]],
  f4: [fit([[95, 96], [160, 99], [218, 110]]), [[-112, -72], [0, -72], [112, -72]]],
  a: [fit([[115, 145], [114, 185], [106, 225], [92, 252], [84, 266]]),
    [[-76, -44], [-76, 4], [-77, 46], [-82, 86], [-100, 116]]],
  b: [fit([[118, 104], [122, 130], [150, 136], [178, 150], [182, 200], [172, 245], [154, 282]]),
    [[-76, -44], [-24, -44], [24, -44], [24, -44], [24, 30], [23, 108], [6, 102]]],
  c: [fit([[118, 158], [140, 157], [163, 158]]), [[-76, -8], [-26, -8], [24, -8]]],
  d: [fit([[117, 187], [145, 190], [172, 191]]), [[-76, 30], [-26, 30], [24, 30]]],
  e: [fit([[114, 215], [135, 219], [153, 222]]), null],
};
export const FOOT = ['f1', 'f2', 'f3', 'f4'];
export const BOAT = ['a', 'b', 'c', 'd', 'e'];
const ORDER = [...FOOT, ...BOAT];

// 刂, drawn in after the morph.
const KNIFE = [[[62, -40], [62, 8], [62, 54]], [[100, -52], [100, 30], [100, 110], [82, 100]]];

/**
 * 前 moved `u` of the way from its seal form to today's. `knife` draws 刂 in.
 * `hi` colours runs by key (e.g. the boat's runs in red).
 */
export function front(u, {
  cx = 300, cy = 300, R = 1, w = 11, opacity = 1, draw = 1, knife = 0, color = INK, hi = {},
} = {}) {
  const e = clamp01(u);
  const tension = lerp(1, 0.55, e);
  const on = i => clamp01(clamp01(draw) * ORDER.length - i);
  const place = pts => pts.map(([x, y]) => [cx + x * R, cy + y * R]);
  const body = ORDER.map((k, i) => {
    const [seal, today] = RUNS[k];
    let pts, o = opacity;
    if (today) pts = blend(seal, today, e);
    else {
      const fade = clamp01(e * 1.6);
      if (fade >= 0.999) return '';
      const mx = seal.reduce((s, p) => s + p[0], 0) / seal.length;
      const my = seal.reduce((s, p) => s + p[1], 0) / seal.length;
      pts = seal.map(([x, y]) => [lerp(x, mx, fade * 0.3), lerp(y, my, fade * 0.3)]);
      o = opacity * (1 - fade);
    }
    return ink(smooth(place(pts), { tension }), on(i), { w: w * Math.max(0.5, R), color: hi[k] || color, opacity: o });
  }).join('');
  const k = clamp01(knife);
  const blade = KNIFE.map((pts, i) => ink(smooth(place(pts), { tension: 0.55 }), clamp01(k * 2 - i),
    { w: w * Math.max(0.5, R), color, opacity })).join('');
  return body + (k > 0 ? blade : '');
}

// ---------------------------------------------------------------- strip
export function render(t) {
  const u = clamp01(t);
  return front(u, { cx: 300, cy: 290, R: 1.6, w: 11, knife: u >= 1 ? 1 : 0, hi: { a: RED, b: RED, c: RED, d: RED, e: RED } })
    + `<text x="16" y="${CELL - 16}" font-family="monospace" font-size="16" fill="${INK_SOFT}">前: seal (foot over boat) -> today (knife added after)</text>`;
}

export function anchors(t) {
  const u = clamp01(t);
  return ORDER.flatMap(k => {
    const [seal, today] = RUNS[k];
    return (today ? blend(seal, today, u) : seal).map(([x, y]) => [300 + x * 1.6, 290 + y * 1.6]);
  });
}
