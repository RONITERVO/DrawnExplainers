// Not Arbitrary, episode 7 — Roman numerals are not letters.
//
// One move carries the whole film: a mark cut in half is the mark for half the
// number. It happens four times, at four sizes, and each time the letter the
// result later got mistaken for arrives afterwards.
//
// Every mark here comes from the strip modules beside this file. Those are the
// working drawings — iterated with lib/glyph.mjs before a frame of film was
// rendered — and scene.mjs imports the generators rather than copying their
// coordinates, so a mark can be reopened on a strip at any time and the two
// can never drift apart.

import {
  P, ink, text, createFilm, smooth, travel, detach, lerp, ramp, clamp01, easeInOut,
  INK, INK_SOFT, RED,
} from '../../../lib/scene-kit.mjs';
import { plank, notch, fifthCut, tenthCut, cross } from './strip-tally.mjs';
import { star } from './strip-star.mjs';
import { thousand, fiveHundred, cutLine, leftStates } from './strip-thousand.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', stick: 's02.stick', notch: 's03.notch', ten: 's04.ten',
  half: 's05.half', star: 's06.star', fifty: 's07.fifty',
  thousand: 's08.thousand', m: 's09.m', d: 's10.d',
  turn: 's11.turn', words: 's12.words', recap: 's13.recap', close: 's14.close',
};

const HOME = 660;    // where a source settles once its copy has left
const AWAY = 1320;   // where the mark it became ends up
const Y = 560;
/** A source's caption travels with it, centre -> HOME. */
const capX = (morph, home = HOME) => 960 + (home - 960) * easeInOut(clamp01(morph));

const label = (t, from, name, x) =>
  text(name, { x, y: 892, size: 44, color: RED, p: ramp(t, from, 440) });
const caption = (t, from, name, x, y = 892) =>
  text(name, { x, y, size: 38, color: INK_SOFT, p: ramp(t, from, 560) });

// ---------------------------------------------------------------- the stick
const PLANK = { cx: 960, cy: 500, half: 400, h: 54 };
const PITCH = 72;
/** The stick holds the page centre while it is alone, and slides left as the
 *  crossed notch leaves it — craft §9, which detach() leaves to the caller
 *  because it is the parent, not the detail, that has to make the room. */
const plankAt = (lift) => 960 + (760 - 960) * easeInOut(clamp01(lift));
const notchesAt = (lift) => ({ cx: plankAt(lift), cy: PLANK.cy, pitch: PITCH, n: 11, h: PLANK.h });
const tenthX = (lift) => plankAt(lift) + 4 * PITCH;   // the cross-cut notch, i = 9

/** The plank and its plain notches, minus whichever ones are special. */
function stick(t, lift, opacity) {
  const N = notchesAt(lift);
  const cut = ramp(t, beat(S.stick, 'Count'), 4200);
  const out = [ink(plank({ ...PLANK, cx: N.cx }), ramp(t, beat(S.stick, 'Start'), 1100),
    { w: 7, color: INK_SOFT, opacity })];
  for (let i = 0; i < N.n; i += 1) {
    if (i === 4) out.push(ink(fifthCut(i, N), ramp(t, beat(S.notch, 'fifth'), 700), { w: 7, color: INK, opacity }));
    else if (i === 9) { /* drawn by tenth(), so it can be lifted off */ }
    else out.push(ink(notch(i, N), clamp01(cut * N.n - i), { w: 7, color: INK, opacity }));
  }
  return out.join('');
}

/**
 * The crossed notch, at t=0 cut into the stick and at t=1 standing on the page.
 * Only its size and place change: it is the same cut throughout, which is the
 * entire claim of the shot.
 */
function tenth(t, cx, cy, opacity) {
  const r = lerp(44, 132, t);
  const w = lerp(7, 16, t);
  return cross(0, { cx, cy, r })
    .map(stroke => ink(smooth(stroke, { tension: 0.2 }), 1, { w, color: INK, opacity }))
    .join('');
}

function stageStick(t) {
  const lift = ramp(t, beat(S.ten, 'Lift'), 2300);
  const shown = ramp(t, beat(S.notch, 'tenth'), 700);
  return detach(
    (u, cx, cy, o) => (u > 0 ? tenth(u, cx, cy, o) : tenthCut(9, notchesAt(lift))
      .map(p2 => ink(p2, shown, { w: 7, color: INK, opacity: o })).join('')),
    lift,
    { from: tenthX(lift), to: 1430, fromY: PLANK.cy, toY: 700, parent: o => stick(t, lift, o) },
  )
    + caption(t, beat(S.stick, 'flock'), 'one notch, one animal', plankAt(lift) - 250, 790)
    + (lift > 0.05 ? label(t, beat(S.ten, 'changed'), 'ten', 1430) : '');
}

// ------------------------------------------------------------- X cut in half
const halve = (t, cx, opacity) => cross(t, { cx, cy: Y, r: 182 })
  .map(stroke => ink(smooth(stroke, { tension: 0.2 }), 1, { w: 16, color: INK, opacity }))
  .join('');

function stageHalf(t) {
  const morph = ramp(t, beat(S.half, 'half'), 2600);
  return travel(halve, morph, { from: 620, to: AWAY, y: Y, inset: 210 })
    + caption(t, shotStart(S.half), 'ten', capX(morph, 620))
    + (morph > 0.05 ? label(t, beat(S.half, 'once'), 'five', AWAY) : '');
}

// ------------------------------------------------ the hundred, cut and pressed
const hundred = (t, cx, opacity) => star(t * 3, { cx, cy: Y, R: 164, w: 16, opacity });

function stageStar(t) {
  const drawn = ramp(t, beat(S.star, 'Rome'), 1600);
  const morph = ramp(t, beat(S.star, 'half'), 7600);
  return (drawn <= 0 ? '' : travel(hundred, morph, { from: HOME, to: AWAY, y: Y }))
    + caption(t, beat(S.star, '100'), 'one hundred', capX(morph))
    + (morph > 0.05 ? label(t, beat(S.fifty, 'end'), 'fifty', AWAY) : '');
}

// ------------------------------------------------------- the thousand opened
const thou = (t, cx, opacity) => thousand(t * 2, { cx, cy: Y, R: 150, w: 16, opacity });

function stageThousand(t) {
  const drawn = ramp(t, beat(S.thousand, 'large'), 3600);
  const morph = ramp(t, beat(S.m, 'Push'), 8600);
  return (drawn <= 0 ? '' : travel(thou, morph, { from: 560, to: 1400, y: Y, inset: 310 }))
    + caption(t, beat(S.thousand, 'thousand'), 'a thousand', capX(morph, 560))
    + (morph > 0.05 ? label(t, beat(S.m, 'hurry'), 'still a thousand', 1400) : '');
}

// -------------------------------------------------------- the thousand halved
const halfThou = (t, cx, opacity) => (t > 0.015
  ? cutLine(Math.min(1, t * 5), { cx, cy: Y, R: 146 }) : '')
  + fiveHundred(t, { cx, cy: Y, R: 146, w: 16, opacity });

function stageD(t) {
  const morph = ramp(t, beat(S.d, 'halved'), 4800);
  return travel(halfThou, morph, { from: HOME, to: AWAY, y: Y })
    + caption(t, shotStart(S.d), 'a thousand', capX(morph))
    + (morph > 0.05 ? label(t, beat(S.d, 'half'), 'five hundred', AWAY) : '');
}

// --------------------------------------------------------------- the turn
const struck = (t, from, word, x) => text(word, { x, y: 820, size: 40, color: INK_SOFT, p: ramp(t, from, 440) })
  + ink(new P().M(x - word.length * 11, 806).L(x + word.length * 11, 806), ramp(t, from + 420, 420),
    { w: 4, color: RED });

function stageTurn(t) {
  const row = ramp(t, shotStart(S.words) - 500, 800);
  const R = 66;
  const marks = [
    [560, star(3, { cx: 560, cy: 640, R, w: 9 })],
    [900, ink(smooth(leftStates({ cx: 900 + R * 0.5, cy: 640, R })[1], { tension: 1 }), 1, { w: 9, color: INK })],
    [1240, fiveHundred(1, { cx: 1240, cy: 640, R, w: 9 })],
    [1580, thousand(2, { cx: 1580, cy: 640, R, w: 9 })],
  ];
  return text('The shapes came first.', { x: 960, y: 300, size: 68, p: ramp(t, beat(S.turn, 'here'), 800) })
    + text('The letters arrived late.', { x: 960, y: 392, size: 68, color: RED, p: ramp(t, beat(S.turn, 'happened'), 900) })
    + `<g opacity="${row.toFixed(2)}">${marks.map(([, m]) => m).join('')}</g>`
    + struck(t, beat(S.words, 'kentum'), 'centum', 900)
    + struck(t, beat(S.words, 'mille'), 'mille', 1580)
    + text('our letters went the other way', { x: 960, y: 960, size: 30, color: INK_SOFT, p: ramp(t, beat(S.words, 'Neither'), 700) });
}

// --------------------------------------------------------------- the recap
const RECAP = [
  ['ten', 'five', 480, (m, x, R, w) => cross(m, { cx: x, cy: 0, r: R })
    .map(s2 => ink(smooth(s2, { tension: 0.2 }), 1, { w, color: INK })).join('')],
  ['one hundred', 'fifty', 840, (m, x, R, w) => star(m * 3, { cx: x, cy: 0, R, w })],
  ['a thousand', 'a thousand', 1200, (m, x, R, w) => thousand(m * 2, { cx: x, cy: 0, R: R * 0.84, w })],
  ['a thousand', 'five hundred', 1560, (m, x, R, w) => fiveHundred(m, { cx: x, cy: 0, R, w })],
];

/** Source above, mark below, tied — the claim four times at once. */
function stageRecap(t) {
  // The whole grid lands in the opening second; nothing waits on a narration
  // cue, because the cues in this shot are spread far too unevenly to build on.
  const row = ramp(t, shotStart(S.recap) - 200, 800);
  const at = (y, inner) => `<g transform="translate(0 ${y})">${inner}</g>`;
  return RECAP.flatMap(([was, is, x, draw]) => [
    text(was, { x, y: 250, size: 30, color: INK_SOFT, p: row }),
    `<g opacity="${(row * 0.52).toFixed(2)}">${at(390, draw(0, x, 62, 8))}</g>`,
    ink(new P().M(x, 500).L(x, 588), row, { w: 3, color: INK_SOFT, dash: '9 8' }),
    `<g opacity="${row.toFixed(2)}">${at(700, draw(1, x, 62, 9))}</g>`,
    text(is, { x, y: 858, size: 36, color: RED, p: ramp(t, shotStart(S.recap) + 300, 600) }),
  ]).join('');
}

// ---------------------------------------------------------------- top and tail
function stageHook(t) {
  return text('Roman numerals', { x: 960, y: 430, size: 82, p: ramp(t, beat(S.hook, 'Roman'), 900) })
    + text('are not letters.', { x: 960, y: 530, size: 82, color: RED, p: ramp(t, beat(S.hook, 'letters'), 900) })
    + text('They were shapes first.', { x: 960, y: 660, size: 56, color: INK_SOFT, p: ramp(t, beat(S.hook, 'shape'), 900) });
}

function stageClose(t) {
  return text('It is not Latin.', { x: 960, y: 440, size: 72, p: ramp(t, beat(S.close, 'when'), 900) })
    + text('It is a stick with cuts in it.', { x: 960, y: 560, size: 72, color: RED, p: ramp(t, beat(S.close, 'Latin'), 900) })
    + text('Not Arbitrary', { x: 960, y: 880, size: 46, color: INK_SOFT, p: ramp(t, beat(S.close, 'cuts'), 900) });
}

const EDGES = [S.stick, S.half, S.star, S.thousand, S.d, S.turn, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.stick) - 260) return stageHook(t);
  if (t < shotStart(S.half) - 260) return stageStick(t);
  if (t < shotStart(S.star) - 260) return stageHalf(t);
  if (t < shotStart(S.thousand) - 260) return stageStar(t);
  if (t < shotStart(S.d) - 260) return stageThousand(t);
  if (t < shotStart(S.turn) - 260) return stageD(t);
  if (t < shotStart(S.recap) - 260) return stageTurn(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
