// Working drawings: Harald's runestone, the two runes of his initials, and the
// logo they make when they share a stem.
//   node lib/glyph.mjs sets/not-arbitrary/ep11-two-letters-at-once/strip-rune.mjs strip.png 7
//
// The logo is traced from Wikimedia Commons' "Bluetooth.svg" (the file the
// Bluetooth article displays). Its whole mark is one path -
//
//   m157 330 305 307-147 178V179l147 170-305 299        (in a 640 x 976 pill)
//
// - which, read as absolute points, is: upper-left arm end (157,330), down to
// the lower-right vertex (462,637), in to the foot of the stem (315,815), up
// the stem to (315,179), out to the upper-right vertex (462,349), and down
// across to the lower-left arm end (157,648). Both diagonals cross the stem at
// y ~ 490, its middle. So the logo is exactly two runes on one stem:
//
//   ᛒ (Bjarkan, b)   stem, top -> upper vertex -> middle -> lower vertex -> foot
//   ᚼ (Hagall, h)    stem, and an X crossing it at the middle, whose right-hand
//                    arms end on ᛒ's vertices
//
// Coordinates below are that path, centred on the stem and scaled to a stem
// half-height of 1, then made symmetric about the middle (the file's
// asymmetry is under 3%).
//
// The morph is a superposition: the two runes slide together until their
// stems coincide. Nothing is added or taken away, and each rune keeps every
// stroke - which is the claim. ᚼ's right-hand arms land on ᛒ's inner edges.
//
// The stone is the larger Jelling stone (DR 42), raised by Harald. Its
// inscription (Rundata, via Wikipedia's "Jelling stones") begins
//   ᚼᛅᚱᛅᛚᛏᚱ ᛬ ᚴᚢᚾᚢᚴᛦ ᛬ ᛒᛅᚦ ᛬ ᚴᛅᚢᚱᚢᛅ ᛬ ᚴᚢᛒᛚ ᛬ ᚦᛅᚢᛋᛁ ᛬ ᛅᚠᛏ ᛬ ᚴᚢᚱᛘ
//   "King Harald ordered these monuments made, in memory of Gorm..."
// and the drawing carries those words in order, re-wrapped into three bands to
// fit the page (the stone breaks its lines elsewhere). Rune shapes follow the
// long-branch forms of the Younger Futhark as Segoe UI Historic draws them.

import { smooth, ink, clamp01, lerp, easeInOut, clipTo, flood, P, INK, INK_SOFT, RED, BLUE, PAPER } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

// ------------------------------------------------------------ the two runes
// Half-height units: the stem runs from y -1 to 1.
const V = [0.46, 0.47];                              // ᛒ's vertices, and ᚼ's right arm ends
const L = [-0.48, 0.49];                             // ᚼ's left arm ends
export const HAGALL = [
  [[0, -1], [0, 0], [0, 1]],
  [[L[0], -L[1]], [0, 0], [V[0], V[1]]],
  [[L[0], L[1]], [0, 0], [V[0], -V[1]]],
];
export const BJARKAN = [
  [[0, -1], [0, 0], [0, 1]],
  [[0, -1], [V[0], -V[1]], [0, 0]],
  [[0, 0], [V[0], V[1]], [0, 1]],
];

function strokes(runs, { cx, cy, R, w, color, opacity, draw, tension = 0.05 }) {
  const on = i => clamp01(clamp01(draw) * runs.length - i);
  return runs.map((run, i) => ink(smooth(run.map(([x, y]) => [cx + x * R, cy + y * R]), { tension }), on(i),
    { w, color, opacity })).join('');
}

/** One of the two logo runes, 'h' or 'b', at logo proportions. R is px per half-height. */
export function logoRune(which, { cx = 300, cy = 300, R = 100, w = null, color = INK, opacity = 1, draw = 1 } = {}) {
  return strokes(which === 'h' ? HAGALL : BJARKAN, { cx, cy, R, w: w ?? R * 0.12, color, opacity, draw });
}

/**
 * The bind: ᚼ on the left and ᛒ on the right at x = 0, one rune on one stem at
 * x = 1. `gap` is the distance between the stems at x = 0, in half-heights.
 */
export function bind(x, { cx = 300, cy = 300, R = 100, gap = 1.9, w = null, color = INK, opacity = 1, draw = 1 } = {}) {
  const e = easeInOut(clamp01(x));
  const off = (gap / 2) * (1 - e) * R;
  return logoRune('h', { cx: cx - off, cy, R, w, color, opacity, draw })
    + logoRune('b', { cx: cx + off, cy, R, w, color, opacity, draw });
}

// ---------------------------------------------------------- the blue pill
// Bluetooth.svg's backing: a 640 x 976 rect with corner radius 291, around a
// stem 636 tall. In half-heights: 2.01 wide, 3.07 tall, corners 0.915.
const PILL = { w: 2.01, h: 3.07, r: 0.915 };

function pillPath(cx, cy, R) {
  const hw = (PILL.w / 2) * R, hh = (PILL.h / 2) * R, r = PILL.r * R, k = 0.5523 * r;
  const x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh;
  return new P().M(cx, y0).L(x1 - r, y0).C(x1 - r + k, y0, x1, y0 + r - k, x1, y0 + r)
    .L(x1, y1 - r).C(x1, y1 - r + k, x1 - r + k, y1, x1 - r, y1)
    .L(x0 + r, y1).C(x0 + r - k, y1, x0, y1 - r + k, x0, y1 - r)
    .L(x0, y0 + r).C(x0, y0 + r - k, x0 + r - k, y0, x0 + r, y0).Z();
}

/**
 * The logo as the object on your phone: the pill inks round, floods blue from
 * the bottom, and the rune turns white exactly where the blue has reached, so
 * it is never missing. `print` runs 0..1 over all of that.
 */
export function logo({ cx = 300, cy = 300, R = 100, print = 1, opacity = 1, draw = 1, w = null } = {}) {
  const outline = clamp01(print * 2.5);
  const water = clamp01((print - 0.3) / 0.7);
  const pill = pillPath(cx, cy, R);
  const hh = (PILL.h / 2) * R, hw = (PILL.w / 2) * R;
  const box = { x: cx - hw - 4, y: cy - hh - 4, w: 2 * hw + 8, h: 2 * hh + 8 };
  const out = [ink(pill, outline, { w: Math.max(3, R * 0.03), color: INK_SOFT, opacity: opacity * (1 - water * 0.6) })];
  if (water > 0.001) out.push(`<g opacity="${opacity.toFixed(3)}">${flood([pill], water, { color: BLUE, ...box })}</g>`);
  out.push(bind(1, { cx, cy, R, w, opacity, draw }));
  if (water > 0.001) {
    const rise = box.h * easeInOut(water);
    const wet = new P().M(box.x, box.y + box.h - rise).L(box.x + box.w, box.y + box.h - rise)
      .L(box.x + box.w, box.y + box.h).L(box.x, box.y + box.h).Z();
    out.push(clipTo([wet], bind(1, { cx, cy, R, w, color: PAPER, opacity })));
  }
  return out.join('');
}

// ------------------------------------------------------------ the stone
// Rune strokes in glyph units: height 1, y from -0.5 (top) to 0.5.
const STEM = [[0, -0.5], [0, 0.5]];
const RUNES = {
  'ᛁ': [STEM],
  'ᚼ': [STEM, [[-0.22, -0.24], [0.22, 0.24]], [[-0.22, 0.24], [0.22, -0.24]]],
  'ᛅ': [STEM, [[-0.17, 0.14], [0.17, -0.14]]],
  'ᚾ': [STEM, [[-0.17, -0.14], [0.17, 0.14]]],
  'ᚱ': [[[-0.14, -0.5], [-0.14, 0.5]], [[-0.14, -0.5], [0.18, -0.24], [-0.14, 0]], [[-0.14, 0], [0.2, 0.5]]],
  'ᛚ': [STEM, [[0, -0.5], [0.24, -0.22]]],
  'ᛏ': [STEM, [[0, -0.5], [-0.22, -0.24]], [[0, -0.5], [0.22, -0.24]]],
  'ᚴ': [[[-0.1, -0.5], [-0.1, 0.5]], [[-0.1, 0.02], [0.22, -0.36]]],
  'ᚢ': [[[-0.18, 0.5], [-0.18, -0.5], [0.18, -0.2], [0.18, 0.5]]],
  'ᛦ': [STEM, [[0, 0.18], [-0.2, 0.5]], [[0, 0.18], [0.2, 0.5]]],
  'ᛒ': [[[-0.14, -0.5], [-0.14, 0.5]], [[-0.14, -0.5], [0.18, -0.25], [-0.14, 0], [0.18, 0.25], [-0.14, 0.5]]],
  'ᚦ': [[[-0.12, -0.5], [-0.12, 0.5]], [[-0.12, -0.2], [0.2, 0], [-0.12, 0.2]]],
  'ᛋ': [[[-0.16, -0.5], [-0.16, -0.08], [0.16, 0.08], [0.16, 0.5]]],
  'ᚠ': [STEM, [[0, -0.28], [0.24, -0.5]], [[0, -0.02], [0.24, -0.26]]],
  'ᛘ': [STEM, [[0, -0.22], [-0.22, -0.5]], [[0, -0.22], [0.22, -0.5]]],
  '᛬': [[[0, -0.14], [0.001, -0.13]], [[0, 0.14], [0.001, 0.15]]],
};

// The opening of the inscription, in order, in three bands.
export const BANDS = [
  'ᚼᛅᚱᛅᛚᛏᚱ᛬ᚴᚢᚾᚢᚴᛦ',
  'ᛒᛅᚦ᛬ᚴᛅᚢᚱᚢᛅ᛬ᚴᚢᛒᛚ',
  'ᚦᛅᚢᛋᛁ᛬ᛅᚠᛏ᛬ᚴᚢᚱᛘ',
];
const GLYPH = { h: 46, pitch: 26 };
const BAND_Y = [-112, -2, 108];                      // band centres in stone units
const NAME_LEN = 7;                                  // ᚼᛅᚱᛅᛚᛏᚱ, Harald's name

/** Centre of glyph i in band b, in stone units. */
export function glyphAt(b, i) {
  const n = [...BANDS[b]].length;
  return [(i - (n - 1) / 2) * GLYPH.pitch, BAND_Y[b]];
}

// A granite boulder, not a slab: peak off-centre, one shoulder steeper than
// the other, the base wide and flat where it sits in the ground.
const OUTLINE = [[-70, -292], [-8, -306], [70, -290], [150, -238], [206, -160], [240, -62],
  [262, 52], [280, 168], [276, 262], [190, 294], [40, 300], [-120, 298], [-246, 286],
  [-286, 226], [-282, 110], [-264, -6], [-236, -118], [-194, -210], [-134, -268]];
const STONE_TINT = 'hsl(32, 10%, 80%)';

/**
 * Harald's stone. `draw` inks the outline, then the band rules, then the runes
 * left to right, band by band. `name` lights his name red, 0..1. `lift`
 * thins the ᚼ and ᛒ that the scene lifts out, so a lifted rune is not drawn
 * twice at full strength while its copy leaves.
 */
export function stone({ cx = 300, cy = 300, R = 1, draw = 1, opacity = 1, name = 0, w = null, lift = {} } = {}) {
  const place = ([x, y]) => [cx + x * R, cy + y * R];
  const shape = smooth(OUTLINE.map(place), { closed: true, tension: 0.8 });
  const out = [];
  const outlineP = clamp01(draw * 3);
  const tint = clamp01((draw - 0.25) * 4);
  if (tint > 0.01) out.push(`<path d="${shape.d()}" fill="${STONE_TINT}" opacity="${(0.55 * tint * opacity).toFixed(3)}"/>`);
  out.push(ink(shape, outlineP, { w: 4.5 * Math.max(0.6, R), color: INK_SOFT, opacity }));
  const rules = clamp01(draw * 3 - 1);
  const half = 200;
  BAND_Y.forEach((by, b) => [by - 32, by + 32].forEach((ry, j) => out.push(ink(
    new P().M(...place([-half, ry])).L(...place([half, ry])), clamp01(rules * 6 - b * 2 - j), { w: 2.5 * Math.max(0.6, R), color: INK_SOFT, opacity: opacity * 0.8 },
  ))));
  const runeP = clamp01(draw * 3 - 2);
  const total = BANDS.reduce((s, b) => s + [...b].length, 0);
  let k = 0;
  BANDS.forEach((band, b) => [...band].forEach((ch, i) => {
    const p = clamp01(runeP * total - k);
    k += 1;
    if (p <= 0) return;
    const [gx, gy] = glyphAt(b, i);
    const isName = b === 0 && i < NAME_LEN;
    const dim = (b === 0 && i === 0 ? (lift.h ?? 1) : 1) * (b === 1 && i === 0 ? (lift.b ?? 1) : 1);
    out.push(glyph(ch, {
      cx: cx + gx * R, cy: cy + gy * R, h: GLYPH.h * R, w: (w ?? 4) * Math.max(0.6, R),
      color: INK, opacity: opacity * dim, draw: p,
    }));
    if (isName && name > 0.01) {
      out.push(glyph(ch, { cx: cx + gx * R, cy: cy + gy * R, h: GLYPH.h * R, w: (w ?? 4) * Math.max(0.6, R), color: RED, opacity: opacity * dim * name, draw: p }));
    }
  }));
  return out.join('');
}

/** A rune from the stone's alphabet, `h` px tall. */
export function glyph(ch, { cx = 300, cy = 300, h = 46, w = 4, color = INK, opacity = 1, draw = 1 } = {}) {
  const runs = RUNES[ch];
  const on = i => clamp01(clamp01(draw) * runs.length - i);
  return runs.map((run, i) => ink(smooth(run.map(([x, y]) => [cx + x * h, cy + y * h]), { tension: 0.05 }), on(i),
    { w: ch === '᛬' ? w * 1.6 : w, color, opacity })).join('');
}

// ---------------------------------------------------------------- strip
export function anchors(t) {
  const e = easeInOut(clamp01(t * 2));
  const off = 0.95 * (1 - e) * 110;
  return [...HAGALL.flat().map(([x, y]) => [450 - off + x * 110, 300 + y * 110]),
    ...BJARKAN.flat().map(([x, y]) => [450 + off + x * 110, 300 + y * 110])];
}

export function render(t) {
  const x = clamp01(t * 2);
  const print = clamp01(t * 2 - 1);
  return stone({ cx: 150, cy: 300, R: 0.5, name: 1 })
    + (print > 0 ? logo({ cx: 450, cy: 300, R: 110, print }) : bind(x, { cx: 450, cy: 300, R: 110 }))
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="16" fill="${INK_SOFT}">stone | h + b -&gt; one stem -&gt; printed</text>`;
}
