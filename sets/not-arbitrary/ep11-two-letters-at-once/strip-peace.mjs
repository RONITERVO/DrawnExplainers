// Working drawing: two flag signals, laid one over the other, become the peace sign.
//   node lib/glyph.mjs sets/not-arbitrary/ep11-two-letters-at-once/strip-peace.mjs strip.png 7
//
// Flag semaphore, as the Wikimedia Commons charts draw it ("Semaphore
// November.svg", "Semaphore Delta.svg"), facing the signaller:
//
//   N  both flags held low and out, 45 degrees below the shoulders
//   D  one flag straight up, the other straight down
//
// Gerald Holtom laid N over D and set them in a circle (CND, "History of the
// Symbol"; BBC News, 20 March 2008). The geometry is exact: the four arms of
// N-over-D are the four radii of the sign, at 12, 6, 7:30 and 4:30. Commons'
// "Peace symbol.svg" draws the same thing - a diameter, and two radii rotated
// 135 and 225 degrees from the top.
//
// Parts of one signaller, in figure units, the shoulder line's centre at 0,0:
//
//   head, neck-and-spine, shoulders, two legs    the person
//   two arms, root -> hand -> tip                 each arm and its pole as one run
//   two flags                                     a square at each tip
//
// The formalising morph (x = 0 figure, 1 sign) keeps only the arms: each run
// slides its root onto the centre and its tip onto the circle, keeping its
// direction of travel (centre outward) the whole way. Everything else is
// element subtraction - it thins where it stands and leaves the draw order
// once it is gone. The circle is the one new stroke, which is what Holtom
// said he did: "put a circle round it".
//
// `flags` (1 held, 0 dropped) retracts each pole into its hand and fades the
// cloth, which is how the N signaller becomes Holtom's other account of the
// same shape: himself, "with hands palm outstretched outwards and downwards".

import { smooth, ink, clamp01, lerp, P, INK, INK_SOFT, RED, GOLD } from '../../../lib/scene-kit.mjs';

export const CELL = 600;
export const PEACE_R = 150;
const SQ = Math.SQRT1_2;
const ARM = 80, POLE = 70, FLAG = 40;           // ARM + POLE = PEACE_R: the tips land on the rim

const HEAD = { c: [0, -34], r: 17 };
const SHOULDER = 28;
const BODY = {
  spine: [[0, -17], [0, 40], [0, 100]],
  shoulders: [[-SHOULDER, 0], [0, 0], [SHOULDER, 0]],
  legs: [
    [[0, 100], [-12, 148], [-24, 196]],
    [[0, 100], [12, 148], [24, 196]],
  ],
};

/** Each pose is two arms: where the arm leaves the shoulders, which way it points, which side its flag flies. */
export const POSES = {
  N: [
    { root: [-SHOULDER, 0], dir: [-SQ, SQ], side: [SQ, SQ] },
    { root: [SHOULDER, 0], dir: [SQ, SQ], side: [-SQ, SQ] },
  ],
  D: [
    { root: [-SHOULDER, 0], dir: [0, -1], side: [-1, 0] },
    { root: [SHOULDER, 0], dir: [0, 1], side: [1, 0] },
  ],
};

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];

/** One arm and its pole, root to tip, at formalising position f and flag hold `flags`. */
function armRun(arm, f, flags) {
  const len = ARM + POLE * flags;
  const fig = [arm.root, add(arm.root, arm.dir, len / 2), add(arm.root, arm.dir, len)];
  const sign = [[0, 0], add([0, 0], arm.dir, PEACE_R / 2), add([0, 0], arm.dir, PEACE_R)];
  return fig.map((p, k) => [lerp(p[0], sign[k][0], f), lerp(p[1], sign[k][1], f)]);
}

function flagCorners(arm, f) {
  const tip = armRun(arm, f, 1)[2];
  const back = add(tip, arm.dir, -FLAG);
  return [tip, back, add(back, arm.side, FLAG), add(tip, arm.side, FLAG)];
}

const headRing = (c, r) => Array.from({ length: 8 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
  return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
});

/**
 * The flag signallers, overlaid, at formalising position f (0 figures, 1 the
 * sign). `poses` is any of 'N', 'D' or both: one pose draws one signaller,
 * both draws them standing in the same place - one body, four arms - which is
 * the moment the morph starts from.
 *
 * `draw` writes it on: body, then arms, then flags, then the circle.
 * `flags` drops the flags (see the header). `circle` inks the ring, 0..1,
 * and defaults to following f. `red` lays one pose's arms over in red,
 * { N: 0..1, D: 0..1 } - an overlay on a beat, not a colour tween, so the
 * same arms can be lit in a signaller and in the sign at once.
 */
export function signal(poses, f = 0, {
  cx = 300, cy = 300, R = 1, w = 7, opacity = 1, draw = 1, flags = 1, circle = null,
  color = INK, flagOpacity = 1, bodyOpacity = 1, red = {},
} = {}) {
  const place = ([x, y]) => [cx + x * R, cy + y * R];
  const arms = [...poses].flatMap(k => POSES[k].map(a => ({ ...a, pose: k })));
  const k = clamp01(f);
  const body = (1 - clamp01(k * 1.8)) * bodyOpacity;
  const cloth = (1 - clamp01(k * 2.2)) * clamp01(flags) * flagOpacity;
  const ring = circle ?? clamp01((k - 0.45) / 0.55);
  // Parts that have gone leave the draw order, or writing the sign on would
  // spend its first half drawing nothing (episode 9's blank opening).
  const order = [];
  if (body > 0.01) order.push('head', 'spine', 'shoulders', 'legs');
  order.push('arms');
  if (cloth > 0.01) order.push('flags');
  if (ring > 0.001 && k > 0.5) order.push('ring');
  const on = name => clamp01(clamp01(draw) * order.length - order.indexOf(name));
  const width = w * Math.max(0.5, R) * lerp(1, 1.75, k);
  const out = [];

  if (body > 0.01) {
    const bw = w * Math.max(0.5, R);
    out.push(ink(smooth(headRing(HEAD.c, HEAD.r).map(place), { closed: true, tension: 1 }), on('head'), { w: bw * 0.85, color, opacity: opacity * body }));
    out.push(ink(smooth(BODY.spine.map(place), { tension: 0.3 }), on('spine'), { w: bw, color, opacity: opacity * body }));
    out.push(ink(smooth(BODY.shoulders.map(place), { tension: 0.3 }), on('shoulders'), { w: bw, color, opacity: opacity * body }));
    BODY.legs.forEach(l => out.push(ink(smooth(l.map(place), { tension: 0.3 }), on('legs'), { w: bw, color, opacity: opacity * body })));
  }
  if (cloth > 0.01) {
    for (const arm of arms) {
      const c = flagCorners(arm, k).map(place);
      const tri = (a, b, d) => `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} L ${b[0].toFixed(1)} ${b[1].toFixed(1)} L ${d[0].toFixed(1)} ${d[1].toFixed(1)} Z`;
      const p = on('flags');
      if (p > 0.3) {
        const o = (opacity * cloth * clamp01((p - 0.3) / 0.7)).toFixed(3);
        out.push(`<path d="${tri(c[0], c[1], c[2])}" fill="${RED}" opacity="${(o * 0.85).toFixed(3)}"/>`);
        out.push(`<path d="${tri(c[0], c[2], c[3])}" fill="${GOLD}" opacity="${(o * 0.9).toFixed(3)}"/>`);
      }
      out.push(ink(new P().M(...c[1]).L(...c[2]).L(...c[3]).L(...c[0]), p, { w: 3.5 * Math.max(0.6, R), color: INK_SOFT, opacity: opacity * cloth }));
      out.push(ink(new P().M(...c[0]).L(...c[2]), p, { w: 2.5 * Math.max(0.6, R), color: INK_SOFT, opacity: opacity * cloth * 0.8 }));
    }
  }
  const armP = on('arms');
  arms.forEach(arm => {
    const path = smooth(armRun(arm, k, flags).map(place), { tension: 0.2 });
    out.push(ink(path, armP, { w: width, color, opacity }));
    const r = red[arm.pose] ?? 0;
    if (r > 0.01) out.push(ink(path, armP, { w: width, color: RED, opacity: opacity * r }));
  });
  if (order.includes('ring')) {
    // Drawn from the top, clockwise, the way a hand goes round a coin.
    const pts = Array.from({ length: 12 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
      return [Math.cos(a) * PEACE_R, Math.sin(a) * PEACE_R];
    }).map(place);
    out.push(ink(smooth(pts, { closed: true, tension: 1 }), Math.min(ring, on('ring')), { w: width, color, opacity }));
  }
  return out.join('');
}

/** The finished sign on its own, written on as a hand would: ring, upright, then the two legs. */
export function peaceSign({ cx = 300, cy = 300, R = 1, w = 7, opacity = 1, draw = 1, color = INK } = {}) {
  const place = ([x, y]) => [cx + x * R, cy + y * R];
  const width = w * Math.max(0.5, R) * 1.75;
  const on = i => clamp01(clamp01(draw) * 4 - i);
  const ringPts = Array.from({ length: 12 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    return [Math.cos(a) * PEACE_R, Math.sin(a) * PEACE_R];
  }).map(place);
  const radius = d => smooth([[0, 0], add([0, 0], d, PEACE_R / 2), add([0, 0], d, PEACE_R)].map(place), { tension: 0.2 });
  return ink(smooth(ringPts, { closed: true, tension: 1 }), on(0), { w: width, color, opacity })
    + ink(smooth([[0, -PEACE_R], [0, 0], [0, PEACE_R]].map(place), { tension: 0.2 }), on(1), { w: width, color, opacity })
    + ink(radius([-SQ, SQ]), on(2), { w: width, color, opacity })
    + ink(radius([SQ, SQ]), on(3), { w: width, color, opacity });
}

// ---------------------------------------------------------------- strip
export function anchors(t) {
  const f = clamp01(t * 1.25 - 0.25);
  return [...POSES.N, ...POSES.D].flatMap(a => armRun(a, f, 1)).map(([x, y]) => [300 + x * 1.2, 280 + y * 1.2]);
}

export function render(t) {
  // First fifth: N and D slide together; then the formalising morph.
  const slide = clamp01(t * 5);
  const f = clamp01(t * 1.25 - 0.25);
  const out = [];
  if (slide < 1) {
    out.push(signal('N', 0, { cx: lerp(150, 300, slide), cy: 280, R: 1.2 }));
    out.push(signal('D', 0, { cx: lerp(450, 300, slide), cy: 280, R: 1.2 }));
  } else {
    out.push(signal('ND', f, { cx: 300, cy: 280, R: 1.2 }));
  }
  if (t < 0.01) out.push(signal('N', 0, { cx: 100, cy: 480, R: 0.45, flags: 0 }));
  if (t > 0.99) out.push(peaceSign({ cx: 520, cy: 520, R: 0.4 }));
  return out.join('')
    + `<text x="16" y="${CELL - 40}" font-family="monospace" font-size="16" fill="${INK_SOFT}">N + D, overlaid, formalised</text>`;
}
