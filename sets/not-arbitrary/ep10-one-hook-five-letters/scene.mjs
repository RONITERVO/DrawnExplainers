// Not Arbitrary, episode 10 — five letters that are one letter.
//
// One Phoenician letter, named after a hook and drawn like a forked stick, is
// the ancestor of F, U, V, W and Y. The film follows it through every split
// in order, and each split has the same cause: a language needed a sound it
// had no letter for, and reached for the nearest one it already had.
//
// The page is a family tree from the moment the Greeks take the letter twice:
// the parent sits at the top and its copies travel down and out, so the recap
// is the same picture, finished. Every mark comes from strip-letters.mjs, and
// every state in it is traced from an attested form.

import {
  P, ink, text, createFilm, travel, lerp, ramp, clamp01, easeInOut, easeOut,
  INK, INK_SOFT, RED, GOLD,
} from '../../../lib/scene-kit.mjs';
import { fork, upsilon, epsilon, double, hook } from './strip-letters.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', waw: 's02.waw', twice: 's03.twice', split: 's04.split', square: 's05.square',
  f: 's06.f', v: 's07.v', twojobs: 's08.twojobs', u: 's09.u', w: 's10.w',
  y: 's11.y', yReveal: 's12.y.reveal', recap: 's13.recap', close: 's14.close',
};

const Y = 540;
// Copies fade up out of their source over the first 18% of a move, so no move
// opens on the same letter drawn twice (see travel() in lib/scene-kit.mjs).
const EMERGE = 0.18;

const label = (t, from, name, x, y = 820, size = 42) =>
  text(name, { x, y, size, color: RED, p: ramp(t, from, 440) });
const caption = (t, from, name, x, y = 820, size = 34) =>
  text(name, { x, y, size, color: INK_SOFT, p: ramp(t, from, 560) });
const tie = (x0, y0, x1, y1, p, opacity = 0.55) =>
  ink(new P().M(x0, y0).L(x1, y1), p, { w: 3, color: INK_SOFT, dash: '12 10', opacity });

/** The five, as they are now. `which` is F U V W Y; all share one call shape. */
const LETTERS = {
  F: o => fork(3, o),
  U: o => upsilon(2, o),
  V: o => upsilon(1, o),
  W: o => double(1, { ...o, R: o.R * 0.9 }),
  Y: o => upsilon(0, o),
};
const ROW = [['F', 440], ['U', 690], ['V', 940], ['W', 1230], ['Y', 1520]];

// ---------------------------------------------------------------- the hook
function stageHook(t) {
  const open = shotStart(S.hook);
  const rowY = 670;
  const tied = ramp(t, beat(S.hook, 'same'), 1200);
  const parent = ramp(t, beat(S.hook, 'years'), 1200);
  return ROW.map(([k, x], i) => LETTERS[k]({ cx: x, cy: rowY, R: 0.85, draw: ramp(t, open + 200 + i * 380, 900) })).join('')
    + ROW.map(([, x]) => tie(960, 400, x, rowY - 110, tied, 0.5)).join('')
    + fork(0, { cx: 960, cy: 300, R: 0.75, draw: parent, color: RED });
}

// ------------------------------------------------ the hook letter, split twice
const T = { parent: [960, 300], left: 690, right: 1330, low: 610, eps: 450 };

function stageSplit(t) {
  const drawn = ramp(t, beat(S.waw, 'Phoenicia'), 1600);
  const named = ramp(t, beat(S.waw, 'hook'), 1400);
  // The letter holds the centre while it is alone, then climbs to the top of
  // the page to become the parent as the Greeks take it up.
  // It waits for 'took', so the page is never a small letter at the top of an
  // empty sheet while the voice sets the split up.
  const rise = easeInOut(ramp(t, beat(S.twice, 'took') - 500, 1500));
  const aside = easeInOut(named) * (1 - rise);
  const px = lerp(lerp(960, 820, aside), T.parent[0], rise);
  const py = lerp(Y, T.parent[1], rise);
  const pR = lerp(1.5, 0.8, rise);
  // Up and out to the right once risen, clear of the path the right-hand copy
  // takes down to its place.
  const hx = lerp(1300, T.parent[0] + 380, rise), hy = lerp(Y, T.parent[1] - 30, rise), hR = lerp(1.25, 0.65, rise);

  const take = easeInOut(ramp(t, beat(S.twice, 'twice'), 2200));
  const squares = ramp(t, beat(S.square, 'arms'), 8000);       // Y -> Crete -> oblique -> square
  const epsAt = ramp(t, beat(S.square, 'same'), 900);
  const epsSquare = ramp(t, beat(S.square, 'until'), 2600);
  const out = [];

  out.push(fork(0, { cx: px, cy: py, R: pR, draw: drawn, opacity: lerp(1, 0.5, take) }));
  out.push(hook({ cx: hx, cy: hy, R: hR, draw: named }));
  // Below the hook while it is big, beside it once it has climbed: below, it
  // would sit on the tie to the right-hand copy.
  out.push(caption(t, beat(S.waw, 'hook') + 300, 'its name: hook', lerp(hx, hx + 150, rise), lerp(hy + 150 * hR + 40, hy + 10, rise), lerp(34, 28, rise)));
  if (rise < 0.5) out.push(caption(t, beat(S.waw, 'years'), 'Phoenician, about 1000 BC', px, 800));

  if (take > 0.01) {
    const o = clamp01(take / EMERGE);
    const [x0, y0] = T.parent;
    const lx = lerp(x0, T.left, easeOut(take)), ly = lerp(y0, T.low, take);
    const rx = lerp(x0, T.right, easeOut(take)), ry = lerp(y0, T.low, take);
    const R = lerp(0.8, 1.1, take);
    out.push(tie(x0 - 40, y0 + 90, lx, ly - 130 * R, clamp01(take * 2)));
    out.push(tie(x0 + 40, y0 + 90, rx, ry - 130 * R, clamp01(take * 2)));
    out.push(fork(squares * 3, { cx: lx, cy: ly, R, opacity: o }));
    out.push(upsilon(0, { cx: rx, cy: ry, R, opacity: o }));
  }
  // The letter next to it, squaring off first: epsilon, which the digamma sat
  // beside in the alphabet and followed into right angles.
  if (epsAt > 0) out.push(epsilon(epsSquare, { cx: T.eps, cy: T.low, R: 1.0, draw: epsAt }));

  return out.join('')
    + caption(t, beat(S.split, 'added'), 'kept its shape, moved to the end', T.right, 800, 30)
    + caption(t, beat(S.split, 'other'), 'kept its place, sixth', T.left + 60, 800, 30)
    + (epsAt > 0 ? caption(t, beat(S.square, 'standing'), 'its neighbour', T.eps, 440, 28) : '')
    + label(t, beat(S.f, 'letter'), 'A  B  C  D  E  F', 560, 875, 40)
    + caption(t, beat(S.f, 'sixth'), 'sixth, where the hook stood', 560, 925, 28);
}

// ------------------------------------------------------ upsilon -> the V
function stageV(t) {
  const drawn = ramp(t, shotStart(S.v) - 200, 900);
  const go = ramp(t, beat(S.v, 'reached'), 2200);
  return travel((u, cx, o) => upsilon(u, { cx, cy: Y, R: 1.25, opacity: o, draw: u > 0 ? 1 : drawn }),
    go, { from: 620, to: 1300, y: Y, inset: 200, ghost: 0.45, emerge: EMERGE })
    + caption(t, shotStart(S.v), 'Greek', lerp(960, 620, easeInOut(go)), 800)
    + (go > 0.05 ? label(t, beat(S.v, 'spelled'), 'VINVM', 1300, 800) : '')
    + caption(t, beat(S.v, 'spelled') + 500, 'said "weenum" - wine', 1300, 860, 32);
}

// ------------------------------------------------- one letter, two shapes
function stageTwoShapes(t) {
  const drawn = ramp(t, shotStart(S.twojobs) - 200, 800);
  const split = ramp(t, beat(S.u, 'rounded'), 1800);
  // ghost: 1 - the pointed shape does not fade, it is still a letter.
  return travel((u, cx, o) => upsilon(1 + u, { cx, cy: 430, R: 1.1, opacity: o, draw: u > 0 ? 1 : drawn }),
    split, { from: 700, to: 1220, y: 430, inset: 180, ghost: 1, emerge: EMERGE })
    + text('vpon', { x: 700, y: 780, size: 72, color: INK, p: ramp(t, beat(S.twojobs, 'pointed'), 700) })
    + caption(t, beat(S.twojobs, 'pointed') + 400, 'upon', 700, 840, 30)
    + text('haue', { x: 1220, y: 780, size: 72, color: INK, p: ramp(t, beat(S.twojobs, 'rounded'), 700) })
    + caption(t, beat(S.twojobs, 'rounded') + 400, 'have', 1220, 840, 30)
    + label(t, beat(S.u, 'pointed'), 'consonant', 700, 900, 34)
    + label(t, beat(S.u, 'rounded'), 'vowel', 1220, 900, 34);
}

// ---------------------------------------------------------- two V, one W
function stageW(t) {
  const drawn = ramp(t, shotStart(S.w) - 200, 1000);
  const join = ramp(t, beat(S.w, 'twice'), 2000);
  return travel((u, cx, o) => double(u, { cx, cy: Y, R: lerp(0.8, 1.0, u), opacity: o, draw: u > 0 ? 1 : drawn }),
    join, { from: 600, to: 1330, y: Y, inset: 230, ghost: 0.45, emerge: EMERGE })
    + caption(t, beat(S.w, 'scribes'), 'English and German scribes, 7th and 8th centuries', 960, 250, 30)
    + (join > 0.05 ? label(t, beat(S.w, 'name'), 'double u', 1330, 800) : '');
}

// ---------------------------------------------------- upsilon, borrowed again
function stageY(t) {
  const drawn = ramp(t, shotStart(S.y) - 200, 900);
  const again = ramp(t, beat(S.y, 'second'), 2400);
  return travel((u, cx, o) => upsilon(0, { cx, cy: Y, R: 1.25, opacity: o, draw: u > 0 ? 1 : drawn }),
    again, { from: 620, to: 1300, y: Y, inset: 200, ghost: 0.45, emerge: EMERGE })
    + caption(t, shotStart(S.y), 'Greek', lerp(960, 620, easeInOut(again)), 800)
    + (again > 0.05 ? caption(t, beat(S.y, 'second') + 600, 'Latin, first century BC', 1300, 800) : '')
    // 'Looks most like the original': the original comes back to prove it.
    + fork(0, { cx: 960, cy: 270, R: 0.62, color: RED, draw: ramp(t, beat(S.yReveal, 'looks'), 1000) })
    + caption(t, beat(S.yReveal, 'looks') + 300, 'Phoenician', 960, 390, 28)
    + tie(900, 330, 700, 400, ramp(t, beat(S.yReveal, 'original'), 700), 0.45)
    + tie(1020, 330, 1220, 400, ramp(t, beat(S.yReveal, 'original'), 700), 0.45)
    + label(t, beat(S.yReveal, 'original'), 'i grec  ·  i griega', 1300, 870, 36)
    + caption(t, beat(S.yReveal, 'original') + 300, '"the Greek i"', 1300, 920, 28);
}

// --------------------------------------------------------------- the recap
function stageRecap(t) {
  const row = ramp(t, shotStart(S.recap) - 300, 900);
  const g = o => `<g opacity="${row.toFixed(3)}">${o}</g>`;
  const top = [960, 240], dig = [560, 470], ups = [1260, 470], low = 760;
  return g([
    fork(0, { cx: top[0], cy: top[1], R: 0.6, color: RED }),
    hook({ cx: top[0] + 170, cy: top[1], R: 0.5 }),
    tie(top[0] - 40, top[1] + 70, dig[0], dig[1] - 80, 1),
    tie(top[0] + 40, top[1] + 70, ups[0], ups[1] - 80, 1),
    fork(2, { cx: dig[0], cy: dig[1], R: 0.6 }),
    upsilon(0, { cx: ups[0], cy: ups[1], R: 0.6 }),
    ...ROW.map(([k, x]) => tie(k === 'F' ? dig[0] : ups[0], dig[1] + 80, x, low - 100, 1, 0.4)),
    ...ROW.map(([k, x]) => LETTERS[k]({ cx: x, cy: low, R: 0.72 })),
  ].join(''))
    + caption(t, shotStart(S.recap) + 300, 'Phoenician', top[0] - 190, top[1] + 12, 28)
    + caption(t, shotStart(S.recap) + 400, 'Greek', 960, dig[1] + 12, 28)
    + caption(t, shotStart(S.recap) + 500, 'Latin, and after', 960, 900, 28);
}

// ---------------------------------------------------------------- the close
function stageClose(t) {
  const show = ramp(t, shotStart(S.close) - 300, 800);
  const rowY = 650;
  return `<g opacity="${show.toFixed(3)}">${hook({ cx: 960, cy: 300, R: 0.8, color: INK })}`
    + ROW.map(([k, x]) => LETTERS[k]({ cx: x, cy: rowY, R: 0.85 }) + tie(960, 390, x, rowY - 110, 1, 0.45)).join('')
    + '</g>'
    + text('Not Arbitrary', { x: 960, y: 900, size: 46, color: GOLD, p: ramp(t, beat(S.close, 'five'), 900) });
}

const EDGES = [S.waw, S.v, S.twojobs, S.w, S.y, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.waw) - 260) return stageHook(t);
  if (t < shotStart(S.v) - 260) return stageSplit(t);
  if (t < shotStart(S.twojobs) - 260) return stageV(t);
  if (t < shotStart(S.w) - 260) return stageTwoShapes(t);
  if (t < shotStart(S.y) - 260) return stageW(t);
  if (t < shotStart(S.recap) - 260) return stageY(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
