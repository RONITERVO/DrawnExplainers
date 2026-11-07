// Working drawings: the tiger, dog, pig and elephant of the oldest Chinese
// writing, each drawn lying down as an animal would stand, facing left.
//   node lib/glyph.mjs sets/not-arbitrary/ep09-horse-on-its-tail/strip-animals.mjs strip.png 5
//
// The only move these make in the film is a quarter-turn, so each is one
// drawing and a rotation. They follow the oracle-bone graphs in what they keep
// - two legs rather than four, one feature that names the animal - because
// turned upright they have to read as the graphs in Wikipedia's figure of
// rotated forms, and laid down they have to read as animals at a glance:
//
//   tiger     open jaws and stripes
//   dog       lean body, tail curled up over the back
//   pig       round belly, short legs, snout
//   elephant  the trunk
//
// Rotation is by angle about the drawing's own centre, never a blend of the
// two orientations (see partAt in strip-horse.mjs for why).

import { smooth, ink, clamp01, INK, INK_SOFT } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const ANIMALS = {
  tiger: [
    [[-70, -30], [-78, -60], [-92, -44], [-120, -40], [-128, -24]],
    [[-128, -24], [-120, -16], [-114, -25], [-106, -15], [-100, -24]],
    [[-126, -2], [-100, 2], [-74, -8]],
    [[-70, -30], [-20, -38], [40, -36], [88, -26], [120, -40], [134, -72], [122, -96]],
    [[-74, -8], [-30, 8], [30, 8], [84, -4]],
    [[-34, -34], [-30, 4]], [[-4, -36], [0, 6]], [[26, -35], [30, 6]],
    [[-50, 4], [-56, 44], [-76, 54]],
    [[64, 2], [70, 44], [52, 54]],
  ],
  dog: [
    [[-66, -40], [-70, -80], [-86, -52], [-122, -44], [-130, -30], [-98, -24], [-72, -18]],
    [[-66, -40], [0, -34], [70, -34], [96, -62], [86, -94], [60, -82]],
    [[-72, -18], [-40, -8], [20, -16], [68, -20]],
    [[-54, -10], [-58, 50], [-74, 58]],
    [[56, -22], [66, 48], [50, 58]],
    [[-100, -38], [-97, -36]],
  ],
  pig: [
    [[-58, -36], [-70, -58], [-86, -36], [-110, -26], [-114, -6], [-96, 2], [-72, 10]],
    [[-114, -30], [-122, -16], [-115, -2]],
    [[-58, -36], [-10, -70], [52, -64], [96, -20], [116, -24], [120, -6], [106, -6], [110, -18]],
    [[-72, 10], [-30, 52], [40, 56], [94, 12]],
    [[-40, 44], [-42, 74]],
    [[56, 46], [58, 74]],
    [[-88, -24], [-85, -22]],
  ],
  elephant: [
    [[-36, -62], [-80, -66], [-106, -40], [-112, 0], [-114, 42], [-104, 70], [-88, 64]],
    [[-54, -50], [-26, -22], [-40, 12], [-68, -2]],
    [[-96, 4], [-124, 16], [-134, 2]],
    [[-36, -62], [20, -74], [82, -52], [102, -12], [114, 10], [108, 32]],
    [[-88, 14], [-50, 32], [20, 34], [92, 16]],
    [[-56, 28], [-58, 80]], [[-36, 32], [-34, 80]],
    [[58, 30], [60, 80]], [[80, 24], [84, 80]],
    [[-84, -44], [-81, -42]],
  ],
};

export const KINDS = Object.keys(ANIMALS);

/**
 * One animal, turned by `angle` degrees clockwise about its own centre:
 * 0 is lying down (the animal), 90 is standing on its tail (the graph).
 * `draw` inks the strokes on in order.
 */
export function animal(kind, angle, { cx = 300, cy = 300, R = 1, w = 7, opacity = 1, draw = 1, color = INK } = {}) {
  const strokes = ANIMALS[kind];
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const place = ([x, y]) => [cx + (x * c - y * s) * R, cy + (x * s + y * c) * R];
  const n = strokes.length;
  return strokes.map((run, i) => {
    const on = clamp01(clamp01(draw) * n - i * 0.8);
    const dot = run.length === 2 && Math.hypot(run[0][0] - run[1][0], run[0][1] - run[1][1]) < 6;
    return ink(smooth(run.map(place), { tension: 0.9 }), on,
      { w: w * Math.max(0.6, R) * (dot ? 1.6 : 1), color, opacity });
  }).join('');
}

export function render(t) {
  const angle = 90 * (1 - clamp01(t));
  return KINDS.map((k, i) => animal(k, angle, { cx: 150 + (i % 2) * 300, cy: 150 + Math.floor(i / 2) * 280, R: 0.9, w: 6 })).join('')
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="18" fill="${INK_SOFT}">standing (graph) -&gt; lying (animal)</text>`;
}
