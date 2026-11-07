// Working drawing: a horse, stood on its tail, then worn down into 馬.
//   node lib/glyph.mjs sets/not-arbitrary/ep09-horse-on-its-tail/strip-horse.mjs strip.png 7
//
// Three states, one drawing:
//
//   0  a horse as anyone would draw it: side on, facing left
//   1  the same drawing turned 90 degrees clockwise - the oracle-bone pose,
//      nose up, mane streaming right, legs out to the left, tail at the foot
//   2  馬, where the body has swung back to horizontal and the legs hang
//      underneath again, but the neck is still upright and the mane still
//      streams sideways
//
// State 1 is computed from state 0 by rotation, not drawn: the claim of the
// shot is that nothing changed but the angle, so nothing else is allowed to.
//
// Nine parts that survive and three that do not:
//
//   throat (3)    the front of the neck      ->  the left upright
//   crest  (3)    the back of the neck       ->  the short middle upright
//   mane   (3x3)  three hairs off the crest  ->  the three crossbars
//   back   (6)    withers, rump, tail        ->  the bottom stroke and its hook
//   legs   (4x3)  front to back              ->  the four dots
//   head, eye, belly                         ->  gone (element subtraction)
//
// Every surviving run keeps its direction of travel in all three states: the
// throat and crest run head-to-body, each hair runs root-to-tip, the back runs
// withers-to-tail, each leg runs body-to-hoof. The mane is the whole argument:
// in state 0 the hairs point up, in state 1 they point right, and in 馬 they
// still point right. The body came back down; the mane never did.

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

// ---------------------------------------------------------------- state 0
const NATURAL = {
  head: [[-100, -92], [-108, -124], [-120, -100], [-142, -80], [-164, -54],
    [-170, -38], [-154, -28], [-128, -38], [-110, -50]],
  eye: [[-133, -70], [-129, -67]],
  throat: [[-110, -50], [-102, -20], [-90, 10]],
  crest: [[-100, -92], [-76, -68], [-50, -44]],
  mane: [
    [[-92, -84], [-84, -102], [-72, -116]],
    [[-78, -70], [-68, -88], [-54, -100]],
    [[-64, -56], [-52, -72], [-38, -84]],
  ],
  back: [[-50, -44], [22, -48], [96, -40], [116, -28], [130, 10], [124, 54]],
  belly: [[-90, 10], [-58, 30], [0, 34], [58, 30], [92, 4]],
  legs: [
    [[-80, 22], [-88, 66], [-84, 112]],
    [[-58, 30], [-50, 70], [-56, 112]],
    [[62, 30], [56, 72], [66, 112]],
    [[86, 16], [98, 64], [92, 110]],
  ],
};

// ---------------------------------------------------------------- state 1
// Ninety degrees clockwise on a page whose y runs down: left becomes up.
const turn = ([x, y]) => [-y, x];
const mapParts = (parts, f) => Object.fromEntries(Object.entries(parts).map(([k, v]) =>
  [k, Array.isArray(v[0][0]) ? v.map(run => run.map(f)) : v.map(f)]));
const STANDING = mapParts(NATURAL, turn);

// ---------------------------------------------------------------- state 2
// 馬, as a brush writes it. The head, eye and belly have nowhere to go, so
// they shrink onto the top of the neck and onto the body line as they fade.
const MA = {
  head: Array.from({ length: 9 }, (_, i) => [-80 + i * 1.5, -120 + i * 0.5]),
  eye: [[-78, -116], [-77, -115]],
  throat: [[-80, -120], [-80, -34], [-80, 52]],
  crest: [[-10, -120], [-10, -70], [-10, -22]],
  mane: [
    [[-80, -120], [4, -120], [86, -120]],
    [[-80, -72], [-4, -72], [70, -72]],
    [[-80, -24], [-4, -24], [70, -24]],
  ],
  back: [[-80, 52], [12, 52], [100, 52], [102, 86], [100, 124], [74, 112]],
  belly: [[-78, 52], [-40, 52], [0, 52], [40, 52], [80, 52]],
  legs: [
    [[-64, 80], [-70, 92], [-78, 104]],
    [[-28, 80], [-27, 92], [-26, 104]],
    [[10, 80], [13, 92], [16, 104]],
    [[46, 80], [53, 91], [60, 102]],
  ],
};

const STATES = [NATURAL, STANDING, MA];

/** Centre each state on its own bounds, so none of them hangs off the old one. */
function centred(parts, scale) {
  const pts = Object.values(parts).flatMap(v => (Array.isArray(v[0][0]) ? v.flat() : v));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const ox = (Math.min(...xs) + Math.max(...xs)) / 2;
  const oy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return mapParts(parts, ([x, y]) => [(x - ox) * scale, (y - oy) * scale]);
}
// 馬 is a compact square; the horse is long. Scale 馬 up so the two carry the
// same visual weight on the page.
const NORM = [centred(NATURAL, 1), centred(STANDING, 1), centred(MA, 1.28)];

/**
 * Anchors of one part at chain position x (0..2), placed at cx, cy, scale R.
 *
 * The first half is a true rotation, by angle, not a blend. Lerping anchors
 * between a shape and its own 90-degree turn drags every point along the chord
 * instead of the arc, and the horse shrinks to 70% and shears at 45 degrees -
 * the one move in this film that has to look like nothing but a turn.
 * NORM[1] is exactly NORM[0] turned, because centring commutes with a
 * quarter-turn, so the second half picks up where the first leaves off.
 */
export function partAt(name, x, { cx = 300, cy = 300, R = 1 } = {}, run = null) {
  const u = clamp01(x / 2) * 2;
  const pick = s => (run === null ? NORM[s][name] : NORM[s][name][run]);
  let pts;
  if (u <= 1) {
    const a = (u * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    pts = pick(0).map(([px, py]) => [px * c - py * s, px * s + py * c]);
  } else {
    pts = blend(pick(1), pick(2), u - 1);
  }
  return pts.map(([px, py]) => [cx + px * R, cy + py * R]);
}

/** The order a hand puts the horse down in: outline first, mane and legs last. */
export const DRAW_ORDER = ['head', 'eye', 'throat', 'crest', 'back', 'belly', 'mane', 'legs'];

/**
 * The horse at chain position x: 0 lying, 1 standing, 2 馬.
 *
 * `draw` writes it on part by part in DRAW_ORDER, so the mane and legs arrive
 * on the words that name them. `maneRed` and `legRed` lay the survivors over
 * in red, 0..1 - an overlay on a beat rather than a colour tween, so the reveal
 * can light the same parts up in every state on the page at once.
 */
export function horse(x, {
  cx = 300, cy = 300, R = 1, w = null, opacity = 1, draw = 1,
  color = INK, maneRed = 0, legRed = 0,
} = {}) {
  const at = { cx, cy, R };
  const k = clamp01(x - 1);                         // 0 until the second morph
  const width = (w ?? lerp(7, 13, k)) * Math.max(0.5, R);
  const tension = lerp(0.95, 0.32, k);
  const gone = 1 - clamp01(k * 1.6);                // head, eye, belly fade out early
  // Once the head, eye and belly are gone they must not keep their slots in
  // the draw order, or writing 馬 on spends its first quarter drawing nothing.
  const order = gone > 0.01 ? DRAW_ORDER : DRAW_ORDER.filter(n => !['head', 'eye', 'belly'].includes(n));
  const on = name => clamp01(clamp01(draw) * order.length - order.indexOf(name));
  const line = (name, run, opts) => ink(smooth(partAt(name, x, at, run), { tension }), on(name), opts);
  const out = [];
  if (gone > 0.01) {
    out.push(line('head', null, { w: width * 0.85, color, opacity: opacity * gone }));
    out.push(line('eye', null, { w: width * 1.3, color, opacity: opacity * gone }));
    out.push(line('belly', null, { w: width * 0.85, color, opacity: opacity * gone }));
  }
  out.push(line('throat', null, { w: width, color, opacity }));
  out.push(line('crest', null, { w: width, color, opacity }));
  out.push(line('back', null, { w: width, color, opacity }));
  const legW = width * lerp(1, 1.25, k), maneW = width * lerp(0.8, 1, k);
  for (let r = 0; r < 4; r += 1) {
    out.push(line('legs', r, { w: legW, color, opacity }));
    if (legRed > 0.01) out.push(line('legs', r, { w: legW, color: RED, opacity: opacity * legRed }));
  }
  for (let r = 0; r < 3; r += 1) {
    out.push(line('mane', r, { w: maneW, color, opacity }));
    if (maneRed > 0.01) out.push(line('mane', r, { w: maneW, color: RED, opacity: opacity * maneRed }));
  }
  return out.join('');
}

// ---------------------------------------------------------------- strip
export function anchors(t) {
  const x = clamp01(t) * 2;
  return ['throat', 'crest', 'back'].flatMap(n => partAt(n, x, { cx: 300, cy: 290, R: 1.3 }));
}

export function render(t) {
  const x = clamp01(t) * 2;
  return horse(x, { cx: 300, cy: 290, R: 1.3, maneRed: 1 })
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="18" fill="${INK_SOFT}">horse -&gt; stood on its tail -&gt; ma</text>`;
}
