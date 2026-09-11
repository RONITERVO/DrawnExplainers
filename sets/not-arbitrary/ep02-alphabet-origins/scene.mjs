// Not Arbitrary, episode 2 — Where our letters came from.
//
// Episode 1 put the picture beside the character. This one transforms in
// place, because the claim is stronger: A is not *like* an ox head, it is an
// ox head, rotated. Showing them side by side would weaken that.

import {
  P, ink, fill, text, write, createFilm,
  ramp, easeInOut, lerp, clamp01, INK, INK_SOFT, RED, BLUE, GOLD,
} from '../../../lib/scene-kit.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  open: 's01.opening', oxDraw: 's02.ox.draw', oxName: 's03.ox.name',
  oxRot: 's04.ox.rotate', aRev: 's05.a.reveal', house: 's06.house',
  bRev: 's07.b.reveal', water: 's08.water.draw', rhyme: 's09.water.rhyme',
  mRev: 's10.m.reveal', eye: 's11.eye', oRev: 's12.o.reveal',
  recap: 's13.recap', close: 's14.closing',
};

const CX = 960;
const CY = 520;

const label = (str, p, { y = 830, size = 40, color = INK_SOFT } = {}) =>
  text(str, { x: CX, y, size, color, p });

// ---------------------------------------------------------------- aleph
// The skeleton is the letter A. Rotated 180 degrees it is a muzzle with two
// horns above it, which is what the Sinai scribes actually drew. One shape,
// one angle parameter, and the whole episode's argument is on screen.
function aleph(p, angle, horns) {
  const body = new P().M(CX - 112, CY + 152).L(CX, CY - 156).L(CX + 112, CY + 152);
  const bar = new P().M(CX - 62, CY + 42).L(CX + 62, CY + 42);
  const hornL = new P().M(CX - 112, CY + 152).C(CX - 196, CY + 196, CX - 208, CY + 278, CX - 132, CY + 296);
  const hornR = new P().M(CX + 112, CY + 152).C(CX + 196, CY + 196, CX + 208, CY + 278, CX + 132, CY + 296);
  const h = clamp01(horns);
  return `<g transform="rotate(${angle.toFixed(2)} ${CX} ${CY})">`
    + ink(body, p, { w: 10 })
    + ink(bar, Math.max(0, p * 1.5 - 0.5), { w: 9 })
    + (h > 0.01 ? ink(hornL, Math.min(1, p * 1.6), { w: 8, opacity: h }) + ink(hornR, Math.min(1, p * 1.8), { w: 8, opacity: h }) : '')
    + '</g>';
}

// ---------------------------------------------------------------- house
function house(p, { angle = 0, round = 0 } = {}) {
  const b = lerp(0, 96, round);   // straight wall bulges into a bowl
  const wall = new P().M(CX - 104, CY + 150).L(CX - 104, CY - 150);
  const top = new P().M(CX - 104, CY - 150).C(CX - 104 + b, CY - 150, CX + 104, CY - 132, CX + 104, CY - 22);
  const mid = new P().M(CX + 104, CY - 22).C(CX + 104, CY + 6, CX - 40, CY + 4, CX - 104, CY + 2);
  const low = new P().M(CX - 104, CY + 150).C(CX - 104 + b, CY + 150, CX + 112, CY + 140, CX + 108, CY + 42);
  const door = new P().M(CX - 104, CY + 150).L(CX - 30, CY + 150);
  return `<g transform="rotate(${angle.toFixed(2)} ${CX} ${CY})">`
    + ink(wall, p, { w: 10 })
    + ink(top, Math.max(0, p * 1.25 - 0.25), { w: 9 })
    + ink(low, Math.max(0, p * 1.5 - 0.5), { w: 9 })
    + ink(mid, Math.max(0, p * 1.75 - 0.75), { w: 9 })
    + (round < 0.4 ? ink(door, Math.max(0, p * 1.9 - 0.9), { w: 9, color: RED, opacity: 1 - round * 2.5 }) : '')
    + '</g>';
}

// ---------------------------------------------------------------- wave
// Three crests lying down; stand them on end and the zigzag is already M.
// Proportioned so that standing it on end lands on M's footprint: the span
// becomes M's height and the crest amplitude becomes its width. A long shallow
// wave rotates into a thin squiggle that reads as nothing.
function wave(p, { angle = 0, straighten = 0, x = CX, scale = 1 } = {}) {
  const s = v => v * scale;
  const amp = lerp(122, 150, straighten);
  const path = new P()
    .M(x - s(150), CY + s(4))
    .Q(x - s(112), CY - s(amp), x - s(75), CY + s(4))
    .Q(x - s(37), CY + s(amp), x, CY + s(4))
    .Q(x + s(37), CY - s(amp), x + s(75), CY + s(4))
    .Q(x + s(112), CY + s(amp), x + s(150), CY + s(4));
  return `<g transform="rotate(${angle.toFixed(2)} ${x} ${CY})">${ink(path, p, { w: s(11), color: BLUE })}</g>`;
}

function letterM(p) {
  const path = new P()
    .M(CX - 118, CY + 150).L(CX - 118, CY - 150).L(CX, CY + 24)
    .L(CX + 118, CY - 150).L(CX + 118, CY + 150);
  return ink(path, p, { w: 10 });
}

// ---------------------------------------------------------------- eye
function eye(p, { open = 0, pupil = 1 } = {}) {
  // The almond relaxes into a circle by letting its control points swing out
  // to the circle constant. Same trick as the sun in episode one, reversed.
  const r = 138;
  const k = lerp(64, 0.5523 * r, open);
  const lid = new P()
    .M(CX - r, CY)
    .C(CX - r * 0.55, CY - k, CX + r * 0.55, CY - k, CX + r, CY)
    .C(CX + r * 0.55, CY + k, CX - r * 0.55, CY + k, CX - r, CY);
  const pr = 34;
  const iris = new P().M(CX, CY - pr)
    .C(CX + pr * 0.55, CY - pr, CX + pr, CY - pr * 0.55, CX + pr, CY)
    .C(CX + pr, CY + pr * 0.55, CX + pr * 0.55, CY + pr, CX, CY + pr)
    .C(CX - pr * 0.55, CY + pr, CX - pr, CY + pr * 0.55, CX - pr, CY)
    .C(CX - pr, CY - pr * 0.55, CX - pr * 0.55, CY - pr, CX, CY - pr);
  return ink(lid, p, { w: 10 })
    + (pupil > 0.01 ? fill(iris, Math.max(0, p * 1.6 - 0.6), { color: INK, opacity: pupil }) : '');
}

// ---------------------------------------------------------------- stages
function stageOpening(t) {
  const flip = easeInOut(ramp(t, beat(S.open, 'upside'), 1400));
  return aleph(ramp(t, beat(S.open, 'Look'), 900), 180 * flip, 0)
    + label('the letter A', ramp(t, beat(S.open, 'letter'), 600), { y: 880 });
}

function stageOx(t) {
  // Held from the ox drawing all the way through the reveal: one continuous
  // shape, three changes of state.
  const drawn = ramp(t, beat(S.open, 'Look'), 900);
  const horns = ramp(t, beat(S.oxDraw, 'horns'), 900);
  const back = easeInOut(ramp(t, beat(S.oxRot, 'turned'), 1600));
  const hornsGone = 1 - easeInOut(ramp(t, beat(S.oxRot, 'horns'), 1200));
  const named = ramp(t, beat(S.oxName, 'aleph'), 700);
  const revealed = ramp(t, beat(S.aRev, 'letter'), 700);
  return aleph(drawn, 180 * (1 - back), horns * hornsGone)
    + label('an ox, seen from the front', ramp(t, beat(S.oxDraw, 'ox'), 700) * (1 - named), { y: 880 })
    + label('aleph  ·  ox', named * (1 - revealed), { y: 880, size: 46, color: RED })
    + label('A', revealed, { y: 890, size: 64, color: RED });
}

function stageHouse(t) {
  const drawn = ramp(t, beat(S.house, 'house'), 1800);
  const turn = easeInOut(ramp(t, beat(S.bRev, 'Turn'), 1300));
  const round = easeInOut(ramp(t, beat(S.bRev, 'corners'), 1300));
  const revealed = ramp(t, beat(S.bRev, 'letter'), 700);
  return house(drawn, { angle: lerp(90, 0, turn), round })
    + label('a floor plan, with a doorway', ramp(t, beat(S.house, 'plan'), 700) * (1 - turn), { y: 880 })
    + label('beth  ·  house', ramp(t, beat(S.bRev, 'Beth'), 600) * (1 - revealed), { y: 880, size: 46, color: RED })
    + label('B', revealed, { y: 890, size: 64, color: RED });
}

function stageWater(t) {
  const drawn = ramp(t, beat(S.water, 'wave'), 1800);
  const stand = easeInOut(ramp(t, beat(S.mRev, 'stand'), 1400));
  const settle = easeInOut(ramp(t, beat(S.mRev, 'end'), 900));
  const revealed = ramp(t, beat(S.mRev, 'M'), 600);
  if (revealed > 0.02) {
    return letterM(Math.min(1, revealed * 1.6))
      + label('mem  ·  water', 1 - revealed, { y: 880, size: 46, color: RED })
      + label('M', revealed, { y: 890, size: 64, color: RED });
  }
  return wave(drawn, { angle: -90 * stand, straighten: settle })
    + label('three crests, one stroke', ramp(t, beat(S.water, 'crests'), 700) * (1 - stand), { y: 880 })
    + label('mem  ·  water', stand, { y: 880, size: 46, color: RED });
}

/** The quiet centre: two civilisations, no contact, the same picture. */
function stageRhyme(t) {
  const china = ramp(t, beat(S.rhyme, 'China'), 900);
  const sinai = ramp(t, beat(S.rhyme, 'Sinai'), 900);
  const join = ramp(t, beat(S.rhyme, 'systems'), 1200);
  return write('水', { x: 590, y: 600, size: 240, p: china })
    + text('China', { x: 590, y: 720, size: 36, color: INK_SOFT, p: china })
    + wave(sinai, { x: 1360, scale: 0.62 })
    + text('Sinai', { x: 1360, y: 720, size: 36, color: INK_SOFT, p: sinai })
    + ink(new P().M(820, 540).L(1140, 540), join, { w: 3, color: INK_SOFT, dash: '12 10' })
    + text('never met', { x: 960, y: 870, size: 42, color: RED, p: ramp(t, beat(S.rhyme, 'never'), 800) });
}

function stageEye(t) {
  const drawn = ramp(t, beat(S.eye, 'eye'), 1600);
  const open = easeInOut(ramp(t, beat(S.oRev, 'outline'), 1400));
  const pupil = 1 - easeInOut(ramp(t, beat(S.oRev, 'pupil'), 900));
  const revealed = ramp(t, beat(S.oRev, 'letter'), 700);
  return eye(drawn, { open, pupil })
    + label('an eye', ramp(t, beat(S.eye, 'outline'), 700) * (1 - open), { y: 880 })
    + label('ayin  ·  eye', ramp(t, beat(S.oRev, 'pupil'), 600) * (1 - revealed), { y: 880, size: 46, color: RED })
    + label('O', revealed, { y: 890, size: 64, color: RED });
}

const RECAP = [
  ['ox', 'A', 620], ['house', 'B', 850], ['water', 'M', 1080], ['eye', 'O', 1310],
];

function stageRecap(t) {
  const from = beat(S.recap, 'ox');
  return RECAP.flatMap(([word, letter, x], i) => {
    const p = ramp(t, from + i * 900, 700);
    return [
      text(word, { x, y: 470, size: 46, color: INK_SOFT, p }),
      ink(new P().M(x, 510).L(x, 560), p, { w: 3, color: INK_SOFT, dash: '9 8' }),
      text(letter, { x, y: 680, size: 128, color: INK, p: ramp(t, from + i * 900 + 350, 600), family: 'Segoe Print', weight: 'bold' }),
    ];
  }).join('') + text('Four drawings you use every single day.', {
    x: 960, y: 850, size: 42, color: RED, p: ramp(t, beat(S.recap, 'Four', 1), 900),
  });
}

function stageClosing(t) {
  return text('You have been reading pictures', { x: 960, y: 470, size: 68, p: ramp(t, beat(S.close, 'reading'), 900) })
    + text('your entire life.', { x: 960, y: 570, size: 68, p: ramp(t, beat(S.close, 'life'), 900) })
    + text('They just stopped looking like anything.', {
      x: 960, y: 720, size: 44, color: INK_SOFT, p: ramp(t, beat(S.close, 'stopped'), 900),
    })
    + text('Not Arbitrary', { x: 960, y: 890, size: 50, color: RED, p: ramp(t, beat(S.close, 'ago'), 900) });
}

const EDGES = [S.oxDraw, S.house, S.water, S.rhyme, S.eye, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.oxDraw) - 260) return stageOpening(t);
  if (t < shotStart(S.house) - 260) return stageOx(t);
  if (t < shotStart(S.water) - 260) return stageHouse(t);
  if (t < shotStart(S.rhyme) - 260) return stageWater(t);
  if (t < shotStart(S.mRev) - 260) return stageRhyme(t);
  if (t < shotStart(S.eye) - 260) return stageWater(t);
  if (t < shotStart(S.recap) - 260) return stageEye(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClosing(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
