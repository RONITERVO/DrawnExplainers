// Not Arbitrary, episode 11 — the peace sign is two letters.
//
// Three signs designed in the last seventy years, each of them two letters
// written one on top of the other: the peace sign is the flag signals for N
// and D laid over each other; the Bluetooth logo is a king's initials in
// runes, sharing one stem; and the rupee sign is a Roman R that has lost its
// upright, which is also the Devanagari letter for the same sound.
//
// Every thread ends the same way - two sources on the page, ghosted where they
// stood, tied to the one mark they became - so the recap is the same picture
// three times. Every mark comes from the strip modules beside this file.

import {
  P, ink, text, createFilm, lerp, ramp, clamp01, easeInOut, easeOut,
  INK, INK_SOFT, RED, GOLD,
} from '../../../lib/scene-kit.mjs';
import { signal, peaceSign, PEACE_R } from './strip-peace.mjs';
import { stone, glyphAt, logoRune, bind, logo } from './strip-rune.mjs';
import { latin, devanagari, rupee } from './strip-rupee.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', holtom: 's02.holtom', flags: 's03.flags', circle: 's04.circle',
  folk: 's05.folk', despair: 's06.despair',
  harald: 's07.harald', stone: 's08.stone', bind: 's09.bind', phone: 's10.phone',
  rupee: 's11.rupee', ra: 's12.ra', recap: 's13.recap', close: 's14.close',
};

// Copies fade up out of their sources over the first 18% of a move, so no
// move opens on the same drawing twice (see travel() in lib/scene-kit.mjs).
const EMERGE = 0.18;
const GHOST = 0.42;
// A source that is converging with another thins to its ghost over the first
// 28% of the move, not the whole of it. Thinned on the move's own curve, the
// source is still at 86% when its copy has fully emerged beside it, and the
// page shows the same drawing twice - two N signallers, two Rs - for half a
// second (seen at 36.8s in the first render). Handing over early makes it a
// copy walking out of a ghost instead.
const THIN = 0.28;
const thinning = e => clamp01(e / THIN);

const label = (t, from, name, x, y, size = 44) =>
  text(name, { x, y, size, color: RED, p: ramp(t, from, 440) });
const caption = (t, from, name, x, y, size = 32) =>
  text(name, { x, y, size, color: INK_SOFT, p: ramp(t, from, 560) });
const tie = (x0, y0, x1, y1, p, opacity = 0.55) =>
  ink(new P().M(x0, y0).L(x1, y1), p, { w: 3, color: INK_SOFT, dash: '12 10', opacity });
const fade = (o, inner) => (o <= 0.001 ? '' : `<g opacity="${clamp01(o).toFixed(3)}">${inner}</g>`);
/** A label that is on from one beat and off from another - faded on beats, never on a tween. */
const between = (t, on, off, inner) => fade(ramp(t, on, 500) * (1 - ramp(t, off, 500)), inner);

/** A claim put up so it can be taken down (as in episode 8). */
function struck(t, from, cross, words, x, y, gone = 0) {
  const half = words.length * 9.2;
  return fade(1 - gone, text(words, { x, y, size: 34, color: INK_SOFT, p: ramp(t, from, 500) })
    + ink(new P().M(x - half, y - 11).L(x + half, y - 13), cross, { w: 4, color: RED }));
}

/**
 * Two sources become one mark: the reverse of a split. A copy of each source
 * travels to `to`, fading up out of it over the first EMERGE of the move, with
 * a dashed tie following. This draws only the copies and their ties: the
 * caller draws each source where it stands, thinning it with thinning(e), and
 * draws the finished mark once the copies have arrived, since two identical
 * drawings on top of each other are one drawing.
 *
 *   sources: [{ x, inset }]    where each source stands, and how far from its
 *                              centre its tie starts (its edge nearest the mark)
 *   copy(i, cx, opacity)       source i's copy, at cx
 *   arrive                     how far short of `to` the ties stop: the mark's
 *                              half-width, so they meet the finished mark
 *                              exactly where the caller's settled ties will
 */
function converge(sources, copy, p, { to, y, arrive = 150 }) {
  const e = easeInOut(clamp01(p));
  if (e <= 0.01) return '';
  const o = clamp01(e / EMERGE);
  return sources.map((s, i) => {
    const cx = lerp(s.x, to, easeOut(e));
    const dir = Math.sign(to - s.x);
    const from = s.x + dir * s.inset, reach = cx - dir * arrive;
    const tieP = dir * (reach - from) > 20 ? clamp01(e * 2) : 0;
    return tie(from, y, dir * (reach - from) > 20 ? reach : from, y, tieP) + copy(i, cx, o);
  }).join('');
}

// ---------------------------------------------------------------- the hook
const ROW = { y: 520, peace: 540, logo: 960, rupee: 1380, pR: 0.95, lR: 112, rR: 150 };

function row(t, { peaceP, runeP, printP, rupeeP }) {
  return peaceSign({ cx: ROW.peace, cy: ROW.y, R: ROW.pR, draw: peaceP })
    + (printP > 0 ? logo({ cx: ROW.logo, cy: ROW.y, R: ROW.lR, print: printP, draw: runeP })
      : bind(1, { cx: ROW.logo, cy: ROW.y, R: ROW.lR, draw: runeP }))
    + rupee({ cx: ROW.rupee, cy: ROW.y, R: ROW.rR, draw: rupeeP, bar2: rupeeP });
}

function stageHook(t) {
  const at = beat(S.hook, 'three');
  return row(t, {
    peaceP: ramp(t, at - 500, 1500),
    runeP: ramp(t, at + 300, 1000),
    printP: ramp(t, at + 1100, 1400),
    rupeeP: ramp(t, at + 900, 1400),
  });
}

// ---------------------------------------------------- the peace sign
// One page for five shots: the N signaller alone, then N and D side by side,
// then copies of both walking into the middle, where they are one body with
// four arms until everything but the arms leaves and a circle goes round.
// nEdge / dEdge: how far each signaller reaches toward the middle - N's
// lower flag tip, D's raised flag - so the ties start at the drawing's edge.
const PZ = {
  y: 490, alone: 960, pairN: 700, pairD: 1220, n: 470, d: 1450, c: 960,
  soloR: 1.5, figR: 1.22, signR: 1.42, nEdge: 175, dEdge: 95,
};

function stagePeace(t) {
  const nDraw = ramp(t, shotStart(S.holtom) + 300, 3400);
  const pair = easeInOut(ramp(t, beat(S.flags, 'One') - 900, 1300));
  const dDraw = ramp(t, beat(S.flags, 'One') - 250, 1900);
  const go = ramp(t, beat(S.circle, 'laid') - 150, 2600);
  const e = easeInOut(go);
  const formal = ramp(t, beat(S.circle, 'set'), 3200);
  const R = lerp(PZ.figR, PZ.signR, easeInOut(formal));
  // "It is two flags": the ghosts come back up. Then the D signaller settles
  // again while the N signaller drops its flags and becomes a man in despair.
  const flagsBack = ramp(t, beat(S.folk, 'two'), 600);
  const despairOn = ramp(t, beat(S.despair, 'meaning'), 700);
  const dropFlags = ramp(t, beat(S.despair, 'himself'), 1600);
  const armsRed = ramp(t, beat(S.despair, 'arms'), 500);
  const nLevel = lerp(lerp(lerp(1, GHOST, thinning(e)), 0.8, flagsBack), 1, despairOn);
  const dLevel = lerp(lerp(lerp(1, GHOST, thinning(e)), 0.8, flagsBack), GHOST, despairOn);

  const nx = lerp(lerp(PZ.alone, PZ.pairN, pair), PZ.n, e);
  const nR = lerp(PZ.soloR, PZ.figR, pair);
  const dx = lerp(PZ.pairD, PZ.d, e);
  const out = [];

  out.push(signal('N', 0, {
    cx: nx, cy: PZ.y, R: nR, draw: nDraw, opacity: nLevel,
    flags: 1 - easeInOut(dropFlags), red: { N: armsRed },
  }));
  if (dDraw > 0) out.push(signal('D', 0, { cx: dx, cy: PZ.y, R: PZ.figR, draw: dDraw, opacity: dLevel }));

  if (go >= 0.999) {
    out.push(signal('ND', formal, { cx: PZ.c, cy: PZ.y, R, red: { N: armsRed } }));
    out.push(tie(PZ.n + PZ.nEdge, PZ.y, PZ.c - PEACE_R * R - 24, PZ.y, 1));
    out.push(tie(PZ.d - PZ.dEdge, PZ.y, PZ.c + PEACE_R * R + 24, PZ.y, 1));
  } else {
    out.push(converge(
      [{ x: nx, inset: PZ.nEdge }, { x: dx, inset: PZ.dEdge }],
      (i, cx, o) => signal(i === 0 ? 'N' : 'D', 0, { cx, cy: PZ.y, R: PZ.figR, opacity: o }),
      go, { to: PZ.c, y: PZ.y, arrive: PEACE_R * PZ.figR + 24 },
    ));
  }

  // Labels travel with their signallers.
  const top = 1 - ramp(t, shotStart(S.folk) - 200, 500);
  out.push(fade(top, caption(t, beat(S.holtom, 'designer'), 'Gerald Holtom, 1958', 960, 250, 34)));
  out.push(label(t, beat(S.flags, 'Both'), 'N', nx, 850, 56));
  out.push(caption(t, beat(S.flags, 'held'), 'nuclear', nx, 905));
  out.push(label(t, beat(S.flags, 'One') + 300, 'D', dx, 850, 56));
  out.push(caption(t, beat(S.flags, 'down'), 'disarmament', dx, 905));
  out.push(between(t, beat(S.circle, 'set') + 700, beat(S.despair, 'wrote'),
    caption(t, beat(S.circle, 'set') + 700, 'the march to Aldermaston, Easter 1958', PZ.c, 840, 30)));
  out.push(caption(t, beat(S.despair, 'wrote') + 550, 'Holtom, in a letter to Peace News', PZ.c, 840, 30));

  // The folk readings, put up and struck out, at the top of the page.
  const cross = ramp(t, beat(S.folk, 'never'), 900);
  const gone = ramp(t, shotStart(S.despair) + 200, 700);
  out.push(struck(t, beat(S.folk, 'broken'), cross, 'a broken cross', 740, 238, gone));
  out.push(struck(t, beat(S.folk, "witch's"), cross, "a witch's foot", 1180, 238, gone));
  return out.join('');
}

// --------------------------------------------------------------- the runes
// Harald's stone holds the centre while the voice finds him, then steps aside
// as his two initials come out of it and share a stem.
const RN = { y: 540, sR0: 0.92, sR1: 0.72, sx1: 540, h: 1150, b: 1430, logo: 1290, lR: 112 };

function stageRunes(t) {
  const carve = ramp(t, shotStart(S.harald) + 200, 9500);
  const name = ramp(t, beat(S.stone, 'name'), 700);
  // The stone steps aside only as the first rune comes out of it, so the right
  // half of the page is never empty while the voice reaches "the one for Harald".
  const aside = easeInOut(ramp(t, beat(S.bind, 'one', 0) - 700, 1500));
  const sx = lerp(960, RN.sx1, aside), sR = lerp(RN.sR0, RN.sR1, aside);
  const liftH = ramp(t, beat(S.bind, 'one', 0), 1500);
  const liftB = ramp(t, beat(S.bind, 'one', 1), 1500);
  const join = ramp(t, beat(S.bind, 'single'), 1600);
  const print = ramp(t, beat(S.phone, 'phone'), 2200);
  const thin = lerp(1, 0.5, easeInOut(Math.max(liftH, liftB)));
  const out = [stone({ cx: sx, cy: RN.y, R: sR, draw: carve, name, opacity: thin })];

  // Each initial lifts out of the stone where it is carved and grows to page
  // size; the stone thins where it stands, tied to both. The h is the first
  // rune of his name. The stone never uses his epithet, so the b is the first
  // rune of its third word, baþ ('ordered'): the same letter of the same
  // alphabet, lifted as a letter. The label says what it stands for in the
  // logo, and nothing on screen or in the voice says the stone spells Bluetooth.
  // Once the two have joined, the ties from inside the carving (which cross
  // the other runes) give way to one tie from the stone's edge to the logo.
  const settled = ramp(t, beat(S.bind, 'single') + 1200, 800);
  const src = (b) => { const [gx, gy] = glyphAt(b, 0); return [sx + gx * sR, RN.y + gy * sR]; };
  const small = 23 * sR;                                   // the carved glyph's half-height
  const lifted = (which, p, home) => {
    const u = easeInOut(p);
    if (u <= 0.01) return '';
    const [x0, y0] = src(which === 'h' ? 0 : 1);
    const x = lerp(x0, home, u), y = lerp(y0, RN.y, u);
    return tie(x0, y0, x, y, 1, 0.5 * clamp01(u * 3) * (1 - settled))
      + (join > 0 ? '' : logoRune(which, { cx: x, cy: y, R: lerp(small, RN.lR, u), opacity: clamp01(u / EMERGE) }));
  };
  out.push(lifted('h', liftH, RN.h));
  out.push(lifted('b', liftB, RN.b));
  if (join > 0) {
    const gap = (RN.b - RN.h) / RN.lR;
    out.push(tie(sx + 275 * sR, RN.y, RN.logo - 1.1 * RN.lR - 20, RN.y, settled));
    out.push(print > 0 ? logo({ cx: RN.logo, cy: RN.y, R: RN.lR, print })
      : bind(join, { cx: RN.logo, cy: RN.y, R: RN.lR, gap }));
  }

  return out.join('')
    + caption(t, beat(S.harald, 'engineer'), "Harald's stone at Jelling, Denmark", sx, lerp(880, 820, aside), 30)
    + label(t, beat(S.stone, 'name'), 'Haraldr', sx - 91 * sR, RN.y - 318 * sR - 10, 38)
    + caption(t, beat(S.stone, 'king') + 200, 'king of Denmark, 10th century', sx, lerp(930, 870, aside), 28)
    + label(t, beat(S.bind, 'Harold'), 'h, for Harald', RN.h - 30, 790, 34)
    + label(t, beat(S.bind, 'Bluetooth'), 'b, for Bluetooth', RN.b + 30, 790, 34)
    + caption(t, beat(S.bind, 'Rune'), 'a bind rune: two letters on one stem', RN.logo, 880, 30);
}

// -------------------------------------------------------------- the rupee
const RP = { y: 530, R: 150, latin: 560, ra: 1360, mid: 960, rEdge: 75, raEdge: 115, arrive: 118 };

function stageRupee(t) {
  const rDraw = ramp(t, beat(S.rupee, 'joins') - 200, 1300);
  const raDraw = ramp(t, beat(S.rupee, 'alphabets'), 1600);
  const stemOff = ramp(t, beat(S.ra, 'upright'), 1100);
  const go = ramp(t, beat(S.ra, 'left'), 2600);
  const e = easeInOut(go);
  const headRed = ramp(t, beat(S.ra, 'hanging'), 500);
  const bar2 = ramp(t, beat(S.ra, 'line') - 100, 900);
  const out = [
    // The source R keeps a faint upright: it is the one thing taken away, and
    // the page should still show where it was.
    latin(0, { cx: RP.latin, cy: RP.y, R: RP.R, draw: rDraw, stem: lerp(1, 0.16, stemOff), opacity: lerp(1, GHOST + 0.08, thinning(e)) }),
    devanagari(0, { cx: RP.ra, cy: RP.y, R: RP.R, draw: raDraw, opacity: lerp(1, GHOST + 0.08, thinning(e)), headRed }),
  ];
  if (go >= 0.999) {
    out.push(rupee({ cx: RP.mid, cy: RP.y, R: RP.R, bar2, headRed }));
    out.push(tie(RP.latin + RP.rEdge, RP.y, RP.mid - RP.arrive, RP.y, 1));
    out.push(tie(RP.ra - RP.raEdge, RP.y, RP.mid + RP.arrive, RP.y, 1));
  } else {
    out.push(converge(
      [{ x: RP.latin, inset: RP.rEdge }, { x: RP.ra, inset: RP.raEdge }],
      (i, cx, o) => (i === 0
        ? latin(e, { cx, cy: RP.y, R: RP.R, stem: 0, opacity: o })
        : devanagari(e, { cx, cy: RP.y, R: RP.R, opacity: o })),
      go, { to: RP.mid, y: RP.y, arrive: RP.arrive },
    ));
  }
  return out.join('')
    + caption(t, beat(S.rupee, 'alphabets') + 200, 'Latin', RP.latin, 760, 34)
    + caption(t, beat(S.rupee, 'alphabets') + 500, 'Devanagari', RP.ra, 760, 34)
    + caption(t, beat(S.rupee, '2010'), 'D. Udaya Kumar, India, 2010', RP.mid, 890, 30)
    + (go > 0.05 ? label(t, beat(S.ra, 'Readers'), 'the rupee', RP.mid, 790, 40) : '');
}

// --------------------------------------------------------------- the recap
// Sources above, marks below, tied: the whole grid lands in the opening
// second and the voice argues over it rather than reading its labels.
const COL = [470, 960, 1450];

function stageRecap(t) {
  const show = ramp(t, shotStart(S.recap) - 300, 900);
  const up = 330, down = 665;
  const grid = [
    signal('N', 0, { cx: COL[0] - 112, cy: up - 16, R: 0.6 }),
    signal('D', 0, { cx: COL[0] + 112, cy: up - 16, R: 0.6 }),
    peaceSign({ cx: COL[0], cy: down, R: 0.78 }),
    logoRune('h', { cx: COL[1] - 60, cy: up, R: 62 }),
    logoRune('b', { cx: COL[1] + 60, cy: up, R: 62 }),
    logo({ cx: COL[1], cy: down, R: 76 }),
    latin(0, { cx: COL[2] - 75, cy: up, R: 70 }),
    devanagari(0, { cx: COL[2] + 75, cy: up, R: 70 }),
    rupee({ cx: COL[2], cy: down, R: 105 }),
    ...COL.map(x => tie(x, up + 95, x, down - 150, 1, 0.45)),
  ].join('');
  return fade(show, grid)
    + caption(t, shotStart(S.recap) + 300, 'nuclear disarmament', COL[0], 880, 30)
    + caption(t, shotStart(S.recap) + 450, 'Harald Bluetooth', COL[1], 880, 30)
    + caption(t, shotStart(S.recap) + 600, 'Latin and Devanagari', COL[2], 880, 30);
}

// ---------------------------------------------------------------- the close
function stageClose(t) {
  const show = ramp(t, shotStart(S.close) - 300, 800);
  return fade(show, row(t, { peaceP: 1, runeP: 1, printP: 1, rupeeP: 1 }))
    + text('Not Arbitrary', { x: 960, y: 880, size: 46, color: GOLD, p: ramp(t, beat(S.close, 'reading'), 900) });
}

const EDGES = [S.holtom, S.harald, S.rupee, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.holtom) - 260) return stageHook(t);
  if (t < shotStart(S.harald) - 260) return stagePeace(t);
  if (t < shotStart(S.rupee) - 260) return stageRunes(t);
  if (t < shotStart(S.recap) - 260) return stageRupee(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
