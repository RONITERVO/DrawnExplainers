// Working drawings: four capitals, and the small letters they wore down into.
//   node lib/glyph.mjs sets/not-arbitrary/ep12-capitals-in-a-hurry/strip-letters.mjs strip.png 7
//
// Every letter sits on one baseline (y = 120). Capitals stand 240 high; the
// small letters have an x-height of 120 and ascend back to the cap line.
// The stages are the attested ones, in the order the sources give them:
// Roman capitals; uncial (rounded capitals, 4th-8th century); half-uncial,
// "the ancestor of our lower-case scripts" (Marcos, Fonts for Latin
// Paleography, 2024, pp. 10-20; Wikipedia, Letter case / Uncial / D / R).
//
// M  one stroke, 9 anchors, 2 states
//    [foot L, top L, (on left diagonal), (near valley), valley, (near
//    valley), (on right diagonal), top R, foot R]
//    The M's middle V narrows until its two sides lie on one line: that is
//    the retraced middle stem of m. Its outer corners round into shoulders.
//
// E  body (5) + bar (2), 3 states: E -> uncial e -> e
//    body [top-right, top, left, bottom, bottom-right]; bar [left, right]
//    Uncial: "formed with a curved stroke, and its arm does not connect with
//    the top curve". Half-uncial: "whose top has now been closed" - the
//    body's first anchor drops onto the bar's right end.
//
// R  stem (3) + loop-and-leg (5), 3 states: R -> cursive R -> r
//    loop [stem top, top-right, right, return, leg foot]
//    Wikipedia, R: "it was common not to close the bottom of the loop but
//    continue into the leg, saving an extra pen stroke. The loop-leg stroke
//    shortened into the simple arc". The return anchor stops short of the
//    stem in state 1; in state 2 the whole run shrinks to the shoulder.
//
// D  old stem (4) + arc (5), 3 states: D -> uncial d -> d
//    arc [overshoot, top, right, bottom, foot]
//    Wikipedia, D: "it was common to start the arc to the left of the
//    vertical stroke, resulting in a serif at the top of the arc. This serif
//    was extended while the rest of the letter was reduced, resulting in an
//    angled stroke and loop. The angled stroke slowly developed into a
//    vertical stroke." So the arc's first anchor - the overshoot - becomes
//    the tip of the ascender, and the capital's stem becomes the upper-left
//    of the bowl. The tall stroke of d is not D's stem; that is the claim.
//
// Every run keeps its direction in every state.

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT, RED } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const L = {
  M: {
    runs: {
      stroke: [
        [[-112, 120], [-86, -120], [-60, -48], [-17, 72], [0, 120], [17, 72], [60, -48], [86, -120], [112, 120]],
        [[-92, 120], [-92, 22], [-46, -2], [0, 26], [0, 120], [0, 28], [46, -2], [92, 22], [92, 120]],
      ],
    },
    tension: [0.18, 0.85],
  },
  E: {
    runs: {
      body: [
        [[72, -120], [-62, -120], [-62, 0], [-62, 120], [72, 120]],
        [[62, -92], [2, -121], [-80, -4], [2, 121], [66, 86]],
        [[57, 58], [0, 1], [-60, 60], [2, 121], [54, 100]],
      ],
      bar: [
        [[-62, 0], [48, 0]],
        [[-76, -6], [40, -6]],
        [[-58, 58], [57, 58]],
      ],
    },
    tension: [0.12, 0.9, 0.95],
  },
  R: {
    runs: {
      stem: [
        [[-62, -120], [-62, 0], [-62, 120]],
        [[-58, -120], [-60, 0], [-62, 120]],
        [[-40, 2], [-40, 60], [-40, 120]],
      ],
      loop: [
        [[-62, -120], [38, -118], [66, -62], [-60, 0], [72, 120]],
        [[-58, -120], [40, -118], [66, -60], [8, -6], [74, 120]],
        [[-40, 24], [-16, 3], [12, -1], [36, 8], [50, 24]],
      ],
    },
    tension: [0.3, 0.6, 0.9],
  },
  D: {
    runs: {
      stem: [
        [[-70, -120], [-70, -40], [-70, 40], [-70, 120]],
        [[22, -5], [-18, 4], [-60, 66], [-44, 110]],
        [[56, 20], [0, 2], [-58, 64], [-44, 110]],
      ],
      arc: [
        [[-90, -116], [14, -120], [88, 0], [14, 120], [-70, 120]],
        [[-62, -116], [46, 26], [60, 76], [2, 122], [-44, 110]],
        [[56, -120], [56, 20], [56, 88], [8, 122], [-44, 110]],
      ],
    },
    tension: [0.35, 0.8, 0.8],
  },
  // Not morphed in the film: the early h the Herculaneum scrolls show, beside
  // the early d and r, and a plain h for the recap.
  h: {
    runs: {
      stem: [[[-40, -120], [-40, 0], [-40, 120]]],
      arch: [[[-40, 40], [-6, 4], [34, 22], [40, 120]]],
    },
    tension: [0.85],
  },
};

export const LETTERS = Object.keys(L);
export const states = name => L[name].tension.length;

function runAt(name, run, x) {
  const st = L[name].runs[run];
  const n = st.length - 1;
  if (n === 0) return st[0];
  const u = clamp01(x / n) * n;
  const i = Math.min(Math.floor(u), n - 1);
  return blend(st[i], st[i + 1], u - i);
}

function tensionAt(name, x) {
  const t = L[name].tension;
  const n = t.length - 1;
  if (n === 0) return t[0];
  const u = clamp01(x / n) * n;
  const i = Math.min(Math.floor(u), n - 1);
  return lerp(t[i], t[i + 1], u - i);
}

/**
 * Letter `name` at chain position x (0 .. states - 1), baseline at cy + 120R.
 * `draw` writes its runs on in order; `color` per run via `colors`.
 */
export function letter(name, x, {
  cx = 300, cy = 300, R = 1, w = 12, opacity = 1, draw = 1, color = INK, colors = {},
} = {}) {
  const runs = Object.keys(L[name].runs);
  const tension = tensionAt(name, x);
  const on = i => clamp01(clamp01(draw) * runs.length - i);
  return runs.map((run, i) => {
    const pts = runAt(name, run, x).map(([px, py]) => [cx + px * R, cy + py * R]);
    return ink(smooth(pts, { tension }), on(i), { w: w * Math.max(0.5, R), color: colors[run] || color, opacity });
  }).join('');
}

/** Short carved-in serifs for the capitals on the stone - a prop, not a morph. */
export function serifs(name, { cx = 300, cy = 300, R = 1, w = 7, opacity = 1, draw = 1, color = INK_SOFT } = {}) {
  const feet = {
    M: [[-112, 120], [112, 120], [-86, -120], [86, -120]],
    E: [[-62, -120], [-62, 120], [72, -120], [72, 120]],
    R: [[-62, -120], [-62, 120], [72, 120]],
    D: [[-70, -120], [-70, 120]],
  }[name] || [];
  return feet.map(([x, y]) => {
    const up = y < 0 ? -1 : 1;
    const a = [cx + (x - 16) * R, cy + y * R], b = [cx + (x + 16) * R, cy + y * R];
    return ink(smooth([a, [cx + x * R, cy + (y + up * 2) * R], b], { tension: 0.3 }), draw, { w: w * Math.max(0.5, R), color, opacity });
  }).join('');
}

// ---------------------------------------------------------------- strip
export function anchors(t) {
  const x = clamp01(t) * 2;
  return ['stem', 'arc'].flatMap(r => runAt('D', r, x)).map(([px, py]) => [150 + px * 0.9, 190 + py * 0.9]);
}

export function render(t) {
  const u = clamp01(t);
  return letter('D', u * 2, { cx: 150, cy: 190, R: 0.9, w: 11 })
    + letter('R', u * 2, { cx: 450, cy: 190, R: 0.9, w: 11 })
    + letter('E', u * 2, { cx: 150, cy: 440, R: 0.75, w: 10 })
    + letter('M', u, { cx: 450, cy: 440, R: 0.75, w: 10 })
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="16" fill="${INK_SOFT}">D-uncial-d  R-cursive-r  E-uncial-e  M-m</text>`;
}
