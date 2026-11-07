// Working drawings: one Phoenician letter and the five Latin letters it became.
//   node lib/glyph.mjs sets/not-arbitrary/ep10-one-hook-five-letters/strip-letters.mjs strip.png 7
//
// Every state here is traced from an attested form, not invented: the
// Phoenician waw, the archaic Cretan digamma and the oblique digamma are the
// Wikimedia Commons glyphs that Wikipedia's Digamma article walks through
// ("Phoenician waw.svg", "Greek Digamma 02.svg", "Greek Digamma oblique.svg"),
// with coordinates read off their path data and rescaled.
//
// FORK, the digamma line - four states, three strokes throughout:
//
//   0  waw: a stem and two arms, a Y
//   1  Crete: both arms swung a quarter-turn clockwise about the top of the
//      stem, one pointing up-right and one down-right
//   2  the oblique digamma: the stem has grown up past the lower arm, and the
//      arms run parallel, sloping down from it like a flag
//   3  F: the arms squared off, "a development parallel to that of epsilon"
//
//   stem (3)  bottom -> lower root -> upper root   (the two roots coincide
//             until the stem grows up between them)
//   upper (3) root -> tip   the Y's left arm, then the top bar of F
//   lower (3) root -> tip   the Y's right arm, then the middle bar of F
//
// The first leg is a rotation by angle, not a blend (see episode 9's
// strip-horse.mjs for why a blend of a turn collapses the shape).
//
// FORK is also upsilon: the Greeks kept the same Y for their vowel. The
// upsilon line - three states:
//
//   0  Y
//   1  V: the stem shrinks into the fork until the arms meet at the foot -
//      "a stemless variant shape of the upsilon was borrowed"
//   2  U: the pointed foot rounds
//
//   left (4), right (4)  tip -> foot    stem (2) collapses onto the foot
//
// EPSILON, the neighbour that squared off first: archaic E, arms sloping
// down from a slanted stem whose lower end runs on past the bottom arm, to E.
//
// DOUBLE: two of the V side by side, pushed together until they share an apex.

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const J = -43;                                     // the fork's junction height

// ---------------------------------------------------------------- the fork
const FORK = [
  { // 0 waw
    stem: [[0, 110], [0, J], [0, J]],
    upper: [[0, J], [-40, -77], [-79, -110]],
    lower: [[0, J], [40, -77], [79, -110]],
  },
  { // 1 Crete: arms rotated +90 about the junction
    stem: [[0, 108], [0, -40], [0, -40]],
    upper: [[0, -40], [37, -76], [73, -111]],
    lower: [[0, -40], [35, -5], [70, 31]],
  },
  { // 2 oblique digamma
    stem: [[0, 110], [0, -12], [0, -110]],
    upper: [[0, -110], [50, -90], [100, -70]],
    lower: [[0, -12], [50, 6], [100, 24]],
  },
  { // 3 F
    stem: [[0, 110], [0, -6], [0, -110]],
    upper: [[0, -110], [42, -110], [84, -110]],
    lower: [[0, -6], [34, -6], [68, -6]],
  },
];

const rot = ([x, y], [ox, oy], a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c];
};

function forkRun(name, x) {
  const u = clamp01(x / 3) * 3;
  if (u <= 1) {
    // Swing both arms a quarter-turn about the junction, and blend in only
    // the small residual between the waw turned and the traced Cretan form.
    const turn = p => (name === 'stem' ? p : rot(p, [0, J], (Math.PI / 2) * u));
    const full = p => (name === 'stem' ? p : rot(p, [0, J], Math.PI / 2));
    const end = FORK[1][name];
    return FORK[0][name].map((p, k) => {
      const r = turn(p), f = full(p);
      return [r[0] + (end[k][0] - f[0]) * u, r[1] + (end[k][1] - f[1]) * u];
    });
  }
  const i = Math.min(Math.floor(u), 2);
  return blend(FORK[i][name], FORK[i + 1][name], u - i);
}

/** Centre the fork on its own bounds at every state, so it never drifts. */
function forkCentre(x) {
  const pts = ['stem', 'upper', 'lower'].flatMap(n => forkRun(n, x));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/**
 * The digamma line at x: 0 waw, 1 Crete, 2 oblique, 3 F.
 * `draw` inks stem, then upper arm, then lower arm.
 */
export function fork(x, { cx = 300, cy = 300, R = 1, w = 13, opacity = 1, draw = 1, color = INK } = {}) {
  const [ox, oy] = forkCentre(x);
  const place = ([px, py]) => [cx + (px - ox) * R, cy + (py - oy) * R];
  const tension = lerp(0.5, 0.2, clamp01(x / 3));
  const on = i => clamp01(clamp01(draw) * 3 - i);
  return ['stem', 'upper', 'lower'].map((n, i) =>
    ink(smooth(forkRun(n, x).map(place), { tension }), on(i), { w: w * Math.max(0.5, R), color, opacity })).join('');
}

// ------------------------------------------------------------- the upsilon
const UPS = [
  { // 0 Y
    left: [[-79, -110], [-53, -88], [-26, -65], [0, J]],
    right: [[79, -110], [53, -88], [26, -65], [0, J]],
    stem: [[0, J], [0, 110]],
  },
  { // 1 V
    left: [[-80, -110], [-53, -37], [-27, 37], [0, 110]],
    right: [[80, -110], [53, -37], [27, 37], [0, 110]],
    stem: [[0, 110], [0, 110]],
  },
  { // 2 U: an anchor near the foot so the two halves meet level, not in a point
    left: [[-74, -110], [-74, 30], [-48, 100], [0, 111]],
    right: [[74, -110], [74, 30], [48, 100], [0, 111]],
    stem: [[0, 110], [0, 110]],
  },
];

function upsRun(name, x) {
  const u = clamp01(x / 2) * 2;
  const i = Math.min(Math.floor(u), 1);
  return blend(UPS[i][name], UPS[i + 1][name], u - i);
}

/** The upsilon line at x: 0 the Greek Y, 1 the Latin V, 2 U. */
export function upsilon(x, { cx = 300, cy = 300, R = 1, w = 13, opacity = 1, draw = 1, color = INK } = {}) {
  const place = ([px, py]) => [cx + px * R, cy + py * R];
  const round = clamp01(x - 1);
  const on = i => clamp01(clamp01(draw) * 3 - i);
  const stemLen = Math.hypot(...[0, 1].map(k => upsRun('stem', x)[0][k] - upsRun('stem', x)[1][k]));
  return [
    ink(smooth(upsRun('left', x).map(place), { tension: lerp(0.2, 1.05, round) }), on(0), { w: w * Math.max(0.5, R), color, opacity }),
    ink(smooth(upsRun('right', x).map(place), { tension: lerp(0.2, 1.05, round) }), on(1), { w: w * Math.max(0.5, R), color, opacity }),
    stemLen > 1 ? ink(smooth(upsRun('stem', x).map(place), { tension: 0.2 }), on(2), { w: w * Math.max(0.5, R), color, opacity }) : '',
  ].join('');
}

// ------------------------------------------------------------- the epsilon
// Archaic epsilon from "Greek Epsilon archaic.svg": a slanted stem whose foot
// runs on below the bottom arm, and three arms sloping down to the right.
const EPS = [
  {
    stem: [[-58, 128], [-44, 18], [-30, -108]],
    arms: [
      [[-30, -104], [36, -72], [100, -40]],
      [[-38, -34], [28, -2], [92, 30]],
      [[-45, 30], [20, 62], [86, 96]],
    ],
  },
  {
    stem: [[-40, 110], [-40, 0], [-40, -110]],
    arms: [
      [[-40, -110], [16, -110], [72, -110]],
      [[-40, 0], [10, 0], [60, 0]],
      [[-40, 110], [16, 110], [72, 110]],
    ],
  },
];

/** Epsilon at x: 0 archaic, 1 the E that squared off first. */
export function epsilon(x, { cx = 300, cy = 300, R = 1, w = 13, opacity = 1, draw = 1, color = INK } = {}) {
  const u = clamp01(x);
  const place = ([px, py]) => [cx + px * R, cy + py * R];
  const on = i => clamp01(clamp01(draw) * 4 - i);
  const line = (a, b, i) => ink(smooth(blend(a, b, u).map(place), { tension: 0.2 }), on(i), { w: w * Math.max(0.5, R), color, opacity });
  return line(EPS[0].stem, EPS[1].stem, 0) + EPS[0].arms.map((a, k) => line(a, EPS[1].arms[k], k + 1)).join('');
}

// ------------------------------------------------------------ double u
/**
 * Two V side by side at x = 0, pushed together into W at x = 1. The inner
 * arms drop a little as they meet, which is the one change the join makes.
 */
export function double(x, { cx = 300, cy = 300, R = 1, w = 13, opacity = 1, draw = 1, color = INK } = {}) {
  const u = clamp01(x);
  const half = lerp(160, 78, u);
  const innerTop = lerp(-110, -58, u);
  const place = ([px, py]) => [cx + px * R, cy + py * R];
  const vee = (ox, innerSide) => {
    const lt = [ox - 80, innerSide === 'left' ? innerTop : -110];
    const rt = [ox + 80, innerSide === 'right' ? innerTop : -110];
    return [[lt, [ox - 40, 0], [ox, 110]], [rt, [ox + 40, 0], [ox, 110]]];
  };
  const runs = [...vee(-half, 'right'), ...vee(half, 'left')];
  const on = i => clamp01(clamp01(draw) * 4 - i);
  return runs.map((r, i) => ink(smooth(r.map(place), { tension: 0.2 }), on(i), { w: w * Math.max(0.5, R), color, opacity })).join('');
}

// ----------------------------------------------------------------- the hook
/** What the letter was named after: an iron hook on a short shank. */
export function hook({ cx = 300, cy = 300, R = 1, w = 8, opacity = 1, draw = 1, color = INK_SOFT } = {}) {
  const s = ([x, y]) => [cx + x * R, cy + y * R];
  const eye = [[0, -118], [14, -104], [0, -90], [-14, -104], [0, -118]];
  const shank = [[0, -90], [0, 30], [6, 70], [34, 84], [58, 64], [60, 34], [44, 22]];
  const on = i => clamp01(clamp01(draw) * 2 - i);
  return ink(smooth(eye.map(s), { tension: 1 }), on(0), { w: w * R, color, opacity })
    + ink(smooth(shank.map(s), { tension: 0.9 }), on(1), { w: w * R, color, opacity });
}

// ---------------------------------------------------------------- strip
export function anchors(t) {
  const x = clamp01(t) * 3;
  const [ox, oy] = forkCentre(x);
  return ['stem', 'upper', 'lower'].flatMap(n => forkRun(n, x)).map(([px, py]) => [150 + (px - ox) * 0.9, 150 + (py - oy) * 0.9]);
}

export function render(t) {
  const u = clamp01(t);
  return fork(u * 3, { cx: 150, cy: 150, R: 0.9, w: 11 })
    + upsilon(u * 2, { cx: 450, cy: 150, R: 0.9, w: 11 })
    + epsilon(u, { cx: 150, cy: 420, R: 0.8, w: 10 })
    + double(u, { cx: 430, cy: 420, R: 0.6, w: 9 })
    + (t < 0.01 ? hook({ cx: 300, cy: 300, R: 0.8 }) : '')
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="16" fill="${INK_SOFT}">fork: waw-crete-oblique-F  ups: Y-V-U  eps  VV-W</text>`;
}
