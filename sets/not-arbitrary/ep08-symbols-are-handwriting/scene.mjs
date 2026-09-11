// Not Arbitrary, episode 8 — four symbols that are just handwriting.
//
// One move carries the film: a word is written out in full, by somebody who
// has to write it again in a minute, and the letters give way. It happens four
// times, in four trades, seventeen centuries apart, and the last one is close
// enough to us that the page it happened on still exists.
//
// Every mark here comes from the strip modules beside this file. Those are the
// working drawings — iterated with lib/glyph.mjs before a frame of film was
// rendered — and scene.mjs imports the generators rather than copying their
// coordinates, so a mark can be reopened on a strip at any time and the two
// can never drift apart.

import {
  P, ink, text, createFilm, travel, detach, lerp, ramp, clamp01, easeInOut, easeOut,
  INK, INK_SOFT, RED, GOLD,
} from '../../../lib/scene-kit.mjs';
import { et } from './strip-et.mjs';
import { capitulum } from './strip-capitulum.mjs';
import { percent } from './strip-percent.mjs';
import { peso } from './strip-peso.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', et: 's02.et', and: 's03.and', amp: 's04.amp',
  capitulum: 's05.capitulum', pilcrow: 's06.pilcrow',
  percento: 's07.percento', percent: 's08.percent',
  turn: 's09.turn', peso: 's10.peso', dollar: 's11.dollar', refuse: 's12.refuse',
  recap: 's13.recap', close: 's14.close',
};

const Y = 560;
/** A source's caption travels with it, centre -> wherever it settles. */
const capX = (morph, home) => 960 + (home - 960) * easeInOut(clamp01(morph));

const label = (t, from, name, x, y = 892) =>
  text(name, { x, y, size: 46, color: RED, p: ramp(t, from, 440) });
const caption = (t, from, name, x, y = 892) =>
  text(name, { x, y, size: 38, color: INK_SOFT, p: ramp(t, from, 560) });

/**
 * A page somebody is already writing on — a monk's column, a merchant's
 * ledger. Two of these four marks were made in the margin of work that was
 * going on anyway, and an empty sheet says the opposite of that.
 *
 * Deliberately illegible: real words would be read, and craft §4 says the
 * voice is the caption, not the page.
 */
function pageOfWriting(p, { cx, cy, rows = 8, w = 560, gap = 54, seed = 1 }) {
  const out = [];
  const prog = clamp01(p);
  for (let r = 0; r < rows; r += 1) {
    const on = clamp01(prog * rows - r * 0.7);
    if (on <= 0.01) continue;
    const y = cy + (r - (rows - 1) / 2) * gap;
    const frac = 0.62 + 0.34 * Math.abs(Math.sin((r + seed) * 2.39));
    let x = cx - w / 2;
    const end = cx - w / 2 + w * frac;
    let i = 0;
    while (x < end) {
      const run = 26 + 44 * Math.abs(Math.sin((r * 7 + i) * 1.7));
      const to = Math.min(x + run, end);
      out.push(ink(new P().M(x, y).L(to, y), on, { w: 5, color: INK_SOFT, opacity: 0.44 }));
      x = to + 16;
      i += 1;
    }
  }
  return out.join('');
}

// ---------------------------------------------------------------- the hook
const HOOK = [
  [500, '1st century', (x, y) => et(2, { cx: x, cy: y, R: 0.82, w: 11 })],
  [810, '12th', (x, y) => capitulum(1, { cx: x, cy: y, R: 0.62, w: 11, paint: 1 })],
  [1120, '15th', (x, y) => percent(2, { cx: x, cy: y, R: 0.72, w: 11 })],
  [1430, '18th', (x, y) => peso(1, { cx: x, cy: y, R: 0.78, w: 11 })],
];

function stageHook(t) {
  const cues = [beat(S.hook, 'These'), beat(S.hook, 'symbols'), beat(S.hook, 'one'), beat(S.hook, 'word')];
  const rule = ramp(t, beat(S.hook, 'full'), 900);
  return HOOK.map(([x, , draw], i) => `<g opacity="${easeOut(ramp(t, cues[i], 800)).toFixed(3)}">${draw(x, 470)}</g>`).join('')
    + ink(new P().M(360, 700).L(1570, 706), rule, { w: 4, color: RED, opacity: 0.7 })
    // Four dates the narration never gives: the span is the hook, not the list.
    + HOOK.map(([x, when]) => caption(t, beat(S.hook, 'somebody'), when, x, 776)).join('');
}

// ------------------------------------------------------------------ et -> &
const amp = (u, cx, opacity, draw = 1) => et(u * 2, { cx, cy: Y, R: 1.45, w: 15, opacity, draw });

function stageEt(t) {
  const drawn = ramp(t, beat(S.et, 'Pompeii'), 3400);
  const morph = ramp(t, beat(S.and, 'lifting'), 6800);
  // The source is 410px across at this scale. travel()'s trajectory keeps the
  // copy near the source through the first half of the move, so the usual
  // 660/1320 put the two marks shoulder to shoulder at e≈0.45 and the page
  // read "etEt". Wider from/to plus a firmer shrink opens a real gap.
  return (drawn <= 0 ? '' : travel(
    (u, cx, o) => amp(u, cx, o, u > 0 ? 1 : drawn),
    morph, { from: 540, to: 1420, y: Y, inset: 290, shrink: 0.8 },
  ))
    + caption(t, beat(S.et, 'and'), 'et', capX(morph, 540), 888)
    + (morph > 0.05 ? label(t, beat(S.amp, 'et'), 'and', 1420, 888) : '');
}

// ----------------------------------------------------- capitulum -> pilcrow
const COL = { rows: 8, w: 520, gap: 56 };
const colX = lift => lerp(960, 720, easeInOut(clamp01(lift)));
const capX0 = lift => colX(lift) - 300;

/**
 * The letter is in the margin of a page that is already being written, so it
 * cannot slide sideways to make room and it does not start at page scale.
 * That is detach() rather than travel(): the copy grows out of the margin and
 * goes diagonally, and the column thins where it stands.
 */
function stageCapitulum(t) {
  const written = ramp(t, shotStart(S.capitulum), 3800);
  const drawn = ramp(t, beat(S.capitulum, 'chapter'), 900);
  const ruled = ramp(t, beat(S.capitulum, 'rules'), 800);
  const lift = ramp(t, beat(S.capitulum, 'rules') + 1400, 3000);
  const close = ramp(t, beat(S.pilcrow, 'fills'), 2600);
  const paint = ramp(t, beat(S.pilcrow, 'bowl'), 2400);

  // u = 0 is the letter still in the margin, at the margin's size, and never
  // closing: the source stays exactly what the scribe wrote (craft §7).
  const detail = (u, cx, cy, o) => capitulum(u > 0 ? close : 0, {
    cx, cy, R: lerp(0.56, 1.32, u), w: lerp(8, 15, u), opacity: o,
    paint: u > 0 ? paint : 0, letterP: drawn, ruleP: ruled,
  });

  return detach(detail, lift, {
    from: capX0(lift), to: 1390, fromY: 620, toY: 500, ghost: 0.42,
    parent: o => `<g opacity="${o.toFixed(3)}">${pageOfWriting(written, { cx: colX(lift), cy: 566, ...COL })}</g>`,
  })
    + caption(t, beat(S.capitulum, 'capitulum'), 'capitulum', capX0(lift), 856)
    + (lift > 0.05 ? label(t, beat(S.pilcrow, 'closes'), 'a new chapter', 1390, 856) : '');
}

// ---------------------------------------------------------- per cento -> %
const pct = (u, cx, opacity, draw = 1) => percent(u * 2, { cx, cy: Y, R: 1.28, w: 15, opacity, draw });

function stagePercento(t) {
  const ledger = ramp(t, shotStart(S.percento), 2800);
  const drawn = ramp(t, beat(S.percento, 'Interest'), 3400);
  const morph = ramp(t, beat(S.percent, 'dropped'), 6600);
  const away = easeInOut(clamp01(morph));
  return `<g opacity="${(1 - away * 0.72).toFixed(3)}">${pageOfWriting(ledger, { cx: lerp(960, 600, away), cy: 560, rows: 9, w: 520, gap: 52, seed: 4 })}</g>`
    + (drawn <= 0 ? '' : travel(
      (u, cx, o) => pct(u, cx, o, u > 0 ? 1 : drawn),
      morph, { from: 560, to: 1410, y: Y, inset: 290, shrink: 0.8 },
    ))
    + caption(t, beat(S.percento, 'Far'), 'per cento', capX(morph, 560), 872)
    + (morph > 0.05 ? label(t, beat(S.percent, 'job'), 'per hundred', 1410, 872) : '');
}

// ---------------------------------------------------------------- the turn
function stageTurn(t) {
  const row = ramp(t, shotStart(S.turn) - 400, 900);
  const marks = [
    [560, (x, y) => et(2, { cx: x, cy: y, R: 0.72, w: 10 })],
    [860, (x, y) => capitulum(1, { cx: x, cy: y, R: 0.54, w: 10, paint: 1 })],
    [1160, (x, y) => percent(2, { cx: x, cy: y, R: 0.64, w: 10 })],
  ];
  const found = ramp(t, beat(S.turn, 'fourth'), 900);
  return text('reconstructed', { x: 860, y: 250, size: 46, color: INK_SOFT, p: ramp(t, beat(S.turn, 'reconstructed'), 800) })
    + `<g opacity="${(row * 0.5).toFixed(2)}">${marks.map(([x, d]) => d(x, 470)).join('')}</g>`
    + ink(new P().M(430, 640).L(1290, 646), row, { w: 3, color: INK_SOFT, dash: '11 9', opacity: 0.6 })
    + `<g opacity="${found.toFixed(3)}">${peso(1, { cx: 1520, cy: 470, R: 0.78, w: 12 })}</g>`
    + text('1778', { x: 1520, y: 646, size: 52, color: RED, p: ramp(t, beat(S.turn, 'watched'), 700) })
    // The archive slip, which the voice never reads out.
    + text('Draper Collection 38J, Wisconsin Historical Society', {
      x: 960, y: 846, size: 30, color: INK_SOFT, p: ramp(t, beat(S.turn, 'dated'), 800),
    });
}

// ------------------------------------------------------------ pesos -> $
const dollar = (u, cx, opacity, draw = 1) => peso(u, { cx, cy: Y, R: 1.5, w: 15, opacity, draw });

function stagePeso(t) {
  const ledger = ramp(t, shotStart(S.peso), 2400);
  const drawn = ramp(t, beat(S.peso, 'coin'), 2800);
  const morph = ramp(t, beat(S.dollar, 'twice'), 5200);
  const away = easeInOut(clamp01(morph));
  const struckAt = ramp(t, beat(S.refuse, 'never'), 900);
  return `<g opacity="${(1 - away * 0.74).toFixed(3)}">${pageOfWriting(ledger, { cx: lerp(960, 560, away), cy: 540, rows: 8, w: 470, gap: 54, seed: 9 })}</g>`
    + (drawn <= 0 ? '' : travel(
      (u, cx, o) => dollar(u, cx, o, u > 0 ? 1 : drawn),
      morph, { from: 660, to: 1330, y: Y, inset: 250 },
    ))
    + caption(t, beat(S.peso, 'first'), 'pesos', capX(morph, 660), 856)
    + (morph > 0.05 ? label(t, beat(S.dollar, 'this'), '1778', 1330, 856) : '')
    // The claims go at the top of the page, not the bottom: at 34pt a second
    // line under the captions runs off the card, and this shot is the one
    // place the film puts something up in order to take it down again.
    + struck(t, beat(S.refuse, 'initials'), struckAt, 'U over S', 960, 232)
    + struck(t, beat(S.refuse, 'other'), struckAt, 'the pillars of Hercules', 960, 296)
    + text('Florian Cajori, 1912', {
      x: 960, y: 372, size: 30, color: INK_SOFT, p: ramp(t, beat(S.refuse, 'Cajori'), 800),
    });
}

/** A claim put up so it can be taken down. */
function struck(t, from, cross, word, x, y) {
  const half = word.length * 9.5;
  return text(word, { x, y, size: 34, color: INK_SOFT, p: ramp(t, from, 500) })
    + ink(new P().M(x - half, y - 11).L(x + half, y - 13), cross, { w: 4, color: RED });
}

// --------------------------------------------------------------- the recap
const RECAP = [
  ['et', 'and', 420, (u, x, y, R, w) => et(u * 2, { cx: x, cy: y, R: R * 0.78, w })],
  ['capitulum', 'a chapter', 780, (u, x, y, R, w) => capitulum(u, { cx: x, cy: y, R: R * 0.6, w, paint: u })],
  ['per cento', 'per hundred', 1140, (u, x, y, R, w) => percent(u * 2, { cx: x, cy: y, R: R * 0.7, w })],
  ['pesos', 'dollars', 1500, (u, x, y, R, w) => peso(u, { cx: x, cy: y, R: R * 0.8, w })],
];

/** Word above, mark below, tied — the claim four times at once. */
function stageRecap(t) {
  // The whole grid lands in the opening second. Narration cues in this shot
  // are spread far too unevenly to build a page on, and the voice is arguing
  // rather than reading the labels, so nothing here waits on a word.
  const row = ramp(t, shotStart(S.recap) - 300, 900);
  return RECAP.flatMap(([was, is, x, draw]) => [
    text(was, { x, y: 232, size: 34, color: INK_SOFT, p: row }),
    `<g opacity="${(row * 0.5).toFixed(2)}">${draw(0, x, 380, 0.68, 8)}</g>`,
    ink(new P().M(x, 496).L(x, 584), row, { w: 3, color: INK_SOFT, dash: '9 8' }),
    `<g opacity="${row.toFixed(2)}">${draw(1, x, 690, 0.68, 9)}</g>`,
    text(is, { x, y: 856, size: 36, color: RED, p: ramp(t, shotStart(S.recap) + 350, 700) }),
  ]).join('')
    + text('a treble clef did the same thing to a letter G', {
      x: 960, y: 952, size: 30, color: INK_SOFT, p: ramp(t, beat(S.recap, 'designed'), 800),
    });
}

// ---------------------------------------------------------------- the close
function stageClose(t) {
  const show = ramp(t, beat(S.close, 'writing'), 900);
  const words = ['et', 'capitulum', 'per cento', 'pesos'];
  return HOOK.map(([x, , draw], i) => `<g opacity="${show.toFixed(3)}">${draw(x, 470)}</g>`
    + text(words[i], { x, y: 690, size: 36, color: RED, p: ramp(t, beat(S.close, 'Latin'), 900) })).join('')
    + text('Not Arbitrary', { x: 960, y: 880, size: 46, color: GOLD, p: ramp(t, beat(S.close, 'stopped'), 900) });
}

const EDGES = [S.et, S.capitulum, S.percento, S.turn, S.peso, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.et) - 260) return stageHook(t);
  if (t < shotStart(S.capitulum) - 260) return stageEt(t);
  if (t < shotStart(S.percento) - 260) return stageCapitulum(t);
  if (t < shotStart(S.turn) - 260) return stagePercento(t);
  if (t < shotStart(S.peso) - 260) return stageTurn(t);
  if (t < shotStart(S.recap) - 260) return stagePeso(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
