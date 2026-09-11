// Not Arbitrary, episode 1 — How Chinese characters began as pictures.

import {
  P, ink, fill, text, write, arrow, nameplate, twoColumn, createFilm,
  ramp, easeInOut, lerp, clamp01, INK_SOFT, RED, GREEN, BLUE, GOLD,
} from '../../../lib/scene-kit.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  open: 's01.opening', mDraw: 's02.mountain.draw', mStr: 's03.mountain.straighten',
  mRev: 's04.mountain.reveal', wDraw: 's05.water.draw', wRev: 's06.water.reveal',
  sDraw: 's07.sun.draw', sRev: 's08.sun.reveal', moon: 's09.moon', turn: 's10.turn',
  person: 's11.person', follow: 's12.follow', forest: 's13.forest', close: 's14.closing',
};

// ---------------------------------------------------------------- pictograms
function mountain(p, straight = 0) {
  const base = 690;
  // A cubic whose control points collapse onto the apex comes to a point, so
  // one parameter takes each hump from round hill to brush stroke.
  const hump = (x0, x1, apexY) => {
    const mid = (x0 + x1) / 2;
    const spread = lerp(0.42, 0.02, straight);
    return new P().M(x0, base).C(
      lerp(x0, mid, 1.5 - spread * 2), lerp(base, apexY, 0.55 + straight * 0.4),
      lerp(mid, x1, spread * 2), lerp(base, apexY, 0.55 + straight * 0.4),
      x1, base,
    );
  };
  return [
    ink(hump(430, 590, lerp(548, 566, straight)), p, { w: 6 }),
    ink(hump(560, 760, lerp(408, 400, straight)), Math.max(0, p * 1.15 - 0.15), { w: 6 }),
    ink(hump(730, 880, lerp(560, 578, straight)), Math.max(0, p * 1.3 - 0.3), { w: 6 }),
    ink(new P().M(390, base).L(920, base), Math.max(0, p * 1.4 - 0.4), { w: 5, color: INK_SOFT }),
  ].join('');
}

function water(p, straight = 0) {
  const amp = lerp(46, 4, straight);
  const stream = new P().M(655, 430)
    .C(655 + amp, 500, 655 - amp, 570, 655 + amp * 0.5, 640)
    .C(655 + amp * 0.9, 680, 655, 700, 650, 712);
  const drop = (x0, y0, x1, y1, cx, cy) => new P().M(x0, y0).Q(cx, cy, x1, y1);
  return [
    ink(stream, p, { w: 7, color: BLUE }),
    ink(drop(590, 505, 548, 575, lerp(556, 570, straight), lerp(528, 536, straight)), Math.max(0, p * 1.3 - 0.3), { w: 5, color: BLUE }),
    ink(drop(722, 495, 764, 560, lerp(762, 748, straight), lerp(518, 524, straight)), Math.max(0, p * 1.45 - 0.45), { w: 5, color: BLUE }),
    ink(drop(586, 610, 552, 668, lerp(556, 566, straight), lerp(632, 640, straight)), Math.max(0, p * 1.6 - 0.6), { w: 5, color: BLUE }),
    ink(drop(726, 600, 766, 660, lerp(760, 748, straight), lerp(624, 630, straight)), Math.max(0, p * 1.75 - 0.75), { w: 5, color: BLUE }),
  ].join('');
}

function sun(p, square = 0) {
  // Circle to rounded square by relaxing the arc tension: 0.5523 is a circle,
  // near zero is a box with soft corners.
  const cx = 655, cy = 560, r = 132;
  const k = lerp(0.5523, 0.075, square) * r;
  const ring = new P().M(cx, cy - r)
    .C(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    .C(cx + r, cy + k, cx + k, cy + r, cx, cy + r)
    .C(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    .C(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
  const markP = Math.max(0, p * 1.9 - 0.9);
  const mark = square > 0.5
    ? ink(new P().M(cx - 62, cy).L(cx + 62, cy), markP, { w: 7, color: RED })
    : fill(new P().M(cx, cy - 15).C(cx + 20, cy - 15, cx + 20, cy + 15, cx, cy + 15).C(cx - 20, cy + 15, cx - 20, cy - 15, cx, cy - 15), markP, { color: RED });
  return ink(ring, p, { w: 7 }) + mark;
}

function moon(p) {
  return fill(new P().M(700, 428).C(608, 470, 604, 652, 700, 694).C(646, 630, 646, 492, 700, 428), p, { color: GOLD, opacity: 0.85 })
    + ink(new P().M(700, 428).C(608, 470, 604, 652, 700, 694), Math.min(1, p * 1.2), { w: 6 })
    + ink(new P().M(700, 694).C(646, 630, 646, 492, 700, 428), Math.max(0, p * 1.5 - 0.5), { w: 6 });
}

function person(p, { fadeExtras = 0, x = 655, scale = 1, thick = 0 } = {}) {
  const s = v => v * scale;
  // The legs are the point: they are what survives into 人, so they are drawn
  // first, longest, and thicken as the rest of the figure leaves.
  const hip = 560, foot = 726, neck = 452;
  const legW = lerp(7, 13, thick);
  const g = [
    ink(new P().M(x, hip).L(x - s(82), foot), p, { w: legW }),
    ink(new P().M(x, hip).L(x + s(78), foot), Math.max(0, p * 1.35 - 0.35), { w: legW }),
  ];
  const extras = 1 - clamp01(fadeExtras);
  if (extras > 0.001) {
    const r = s(46);
    const headY = neck - r - 6;
    g.push(ink(new P().M(x, hip).L(x, neck), p, { w: 7, opacity: extras }));
    g.push(ink(new P().M(x, neck + 34).L(x - s(76), neck + 74), Math.max(0, p * 1.2 - 0.2), { w: 6, opacity: extras }));
    g.push(ink(new P().M(x, neck + 34).L(x + s(76), neck + 62), Math.max(0, p * 1.3 - 0.3), { w: 6, opacity: extras }));
    g.push(ink(new P().M(x, headY - r)
      .C(x + r * 0.55, headY - r, x + r, headY - r * 0.55, x + r, headY)
      .C(x + r, headY + r * 0.55, x + r * 0.55, headY + r, x, headY + r)
      .C(x - r * 0.55, headY + r, x - r, headY + r * 0.55, x - r, headY)
      .C(x - r, headY - r * 0.55, x - r * 0.55, headY - r, x, headY - r), p, { w: 6, opacity: extras }));
  }
  return g.join('');
}

function tree(p, { x = 655, y = 690, scale = 1 } = {}) {
  const s = v => v * scale;
  return [
    ink(new P().M(x, y).L(x, y - s(150)), p, { w: 7 }),
    ink(new P().M(x, y - s(96)).Q(x - s(52), y - s(120), x - s(78), y - s(66)), Math.max(0, p * 1.3 - 0.3), { w: 5.5 }),
    ink(new P().M(x, y - s(96)).Q(x + s(52), y - s(120), x + s(78), y - s(66)), Math.max(0, p * 1.5 - 0.5), { w: 5.5 }),
    fill(new P().M(x - s(30), y - s(170)).C(x - s(70), y - s(210), x - s(10), y - s(250), x + s(6), y - s(206))
      .C(x + s(66), y - s(238), x + s(74), y - s(172), x + s(24), y - s(162)).Z(),
      Math.max(0, p * 1.25 - 0.25), { color: GREEN, opacity: 0.8 }),
  ].join('');
}

// ---------------------------------------------------------------- stages
function stageOpening(t) {
  return text('Every Chinese character', { x: 960, y: 430, size: 76, p: ramp(t, beat(S.open, 'Every'), 900) })
    + text('began as a picture', { x: 960, y: 530, size: 76, p: ramp(t, beat(S.open, 'picture'), 900) })
    + write('汉字', { x: 960, y: 730, size: 130, p: ramp(t, beat(S.open, 'drawing'), 900) })
    + text('hànzì', { x: 960, y: 800, size: 38, color: RED, p: ramp(t, beat(S.open, 'see'), 700) });
}

function stageMountain(t) {
  const rev = ramp(t, beat(S.mRev, 'is'), 900);
  const pic = mountain(ramp(t, beat(S.mDraw, 'three'), 2600), easeInOut(ramp(t, beat(S.mStr, 'curves'), 1700)))
    + text('a mountain', { x: 655, y: 800, size: 38, color: INK_SOFT, p: ramp(t, beat(S.mDraw, 'mountain'), 500) });
  const reveal = rev <= 0 ? '' : arrow(ramp(t, beat(S.mRev, 'there'), 500))
    + write('山', { x: 1330, y: 640, size: 250, p: rev })
    + nameplate(t, beat(S.mRev, 'Mountain'), { sound: 'shān', gloss: 'mountain' });
  return twoColumn(pic, reveal, ramp(t, beat(S.mRev, 'there'), 800));
}

function stageWater(t) {
  const rev = ramp(t, beat(S.wRev, 'character'), 900);
  const pic = water(ramp(t, beat(S.wDraw, 'current'), 2200), easeInOut(ramp(t, beat(S.wRev, 'Straighten'), 1300)))
    + text('a current, and droplets', { x: 655, y: 800, size: 34, color: INK_SOFT, p: ramp(t, beat(S.wDraw, 'droplets'), 500) });
  const reveal = rev <= 0 ? '' : arrow(ramp(t, beat(S.wRev, 'Keep'), 500))
    + write('水', { x: 1330, y: 640, size: 250, p: rev })
    + nameplate(t, beat(S.wRev, 'water'), { sound: 'shuǐ', gloss: 'water' });
  return twoColumn(pic, reveal, ramp(t, beat(S.wRev, 'Keep'), 800));
}

function stageSun(t) {
  const rev = ramp(t, beat(S.sRev, 'this'), 900);
  const pic = sun(ramp(t, beat(S.sDraw, 'circle'), 1500), easeInOut(ramp(t, beat(S.sRev, 'Squares'), 1500)))
    + text('a circle, marked', { x: 655, y: 800, size: 34, color: INK_SOFT, p: ramp(t, beat(S.sDraw, 'middle'), 500) });
  const reveal = rev <= 0 ? '' : arrow(ramp(t, beat(S.sRev, 'So'), 500))
    + write('日', { x: 1330, y: 640, size: 250, p: rev })
    + nameplate(t, beat(S.sRev, 'day'), { sound: 'rì', gloss: 'sun · day' });
  return twoColumn(pic, reveal, ramp(t, beat(S.sRev, 'So'), 800));
}

function stageMoon(t) {
  const rev = ramp(t, beat(S.moon, 'round'), 900);
  const pic = moon(ramp(t, beat(S.moon, 'crescent'), 1800))
    + text('a crescent', { x: 655, y: 800, size: 34, color: INK_SOFT, p: ramp(t, beat(S.moon, 'crescent'), 600) });
  const reveal = rev <= 0 ? '' : arrow(ramp(t, beat(S.moon, 'shape'), 500))
    + write('月', { x: 1330, y: 640, size: 250, p: rev })
    + nameplate(t, beat(S.moon, 'month'), { sound: 'yuè', gloss: 'moon · month' });
  return twoColumn(pic, reveal, ramp(t, beat(S.moon, 'shape'), 800));
}

function stageTurn(t) {
  return text('Once you have pictures,', { x: 960, y: 520, size: 62, p: ramp(t, beat(S.turn, 'Now'), 700) })
    + text('you can put them together.', { x: 960, y: 610, size: 62, p: ramp(t, beat(S.turn, 'pictures'), 700) })
    + ink(new P().M(820, 680).L(1100, 680), ramp(t, beat(S.turn, 'together'), 900), { w: 5, color: RED });
}

function stagePerson(t) {
  const fade = ramp(t, beat(S.person, 'legs'), 900);
  const rev = ramp(t, beat(S.person, 'stride'), 900);
  const pic = person(ramp(t, beat(S.person, 'person'), 1600), { fadeExtras: fade, thick: easeInOut(fade) })
    + text('a person, mid stride', { x: 655, y: 800, size: 34, color: INK_SOFT, p: ramp(t, beat(S.person, 'side'), 500) });
  const reveal = rev <= 0 ? '' : arrow(ramp(t, beat(S.person, 'legs'), 500))
    + write('人', { x: 1330, y: 640, size: 250, p: rev })
    + nameplate(t, beat(S.person, 'stride'), { sound: 'rén', gloss: 'person' });
  return twoColumn(pic, reveal, ramp(t, beat(S.person, 'legs'), 800));
}

function stageFollow(t) {
  const rev = ramp(t, beat(S.follow, 'picture'), 900);
  const pic = person(ramp(t, beat(S.follow, 'Set'), 800), { fadeExtras: 1, thick: 1, x: 560, scale: 0.82 })
    + person(ramp(t, beat(S.follow, 'behind'), 800), { fadeExtras: 1, thick: 1, x: 760, scale: 0.82 })
    + text('one behind another', { x: 655, y: 800, size: 34, color: INK_SOFT, p: ramp(t, beat(S.follow, 'another'), 500) });
  const reveal = rev <= 0 ? '' : arrow(ramp(t, beat(S.follow, 'meaning'), 500))
    + write('从', { x: 1330, y: 640, size: 250, p: rev })
    + nameplate(t, beat(S.follow, 'follow', 1), { sound: 'cóng', gloss: 'to follow' });
  return twoColumn(pic, reveal, ramp(t, beat(S.follow, 'meaning'), 800));
}

function stageForest(t) {
  const cols = [
    ['木', 'mù', 'tree', 1150, ramp(t, beat(S.forest, 'tree'), 700)],
    ['林', 'lín', 'grove', 1350, ramp(t, beat(S.forest, 'grove'), 700)],
    ['森', 'sēn', 'forest', 1560, ramp(t, beat(S.forest, 'forest'), 700)],
  ];
  return [
    tree(ramp(t, beat(S.forest, 'A'), 900), { x: 400, y: 730, scale: 0.8 }),
    tree(ramp(t, beat(S.forest, 'Two'), 800), { x: 620, y: 730, scale: 0.8 }),
    tree(ramp(t, beat(S.forest, 'Three'), 800), { x: 840, y: 730, scale: 0.8 }),
    ...cols.flatMap(([ch, sound, gloss, x, p]) => [
      write(ch, { x, y: 620, size: 170, p }),
      text(sound, { x, y: 700, size: 34, color: RED, p }),
      text(gloss, { x, y: 748, size: 28, color: INK_SOFT, p }),
    ]),
  ].join('');
}

const CLOSING = [['山', 'shān'], ['水', 'shuǐ'], ['日', 'rì'], ['月', 'yuè'], ['人', 'rén'], ['从', 'cóng'], ['木', 'mù'], ['森', 'sēn']];

function stageClosing(t) {
  const from = beat(S.close, 'drawings');
  return CLOSING.flatMap(([ch, sound], i) => {
    const x = 480 + (i % 4) * 320;
    const y = 470 + Math.floor(i / 4) * 250;
    return [
      write(ch, { x, y, size: 150, p: ramp(t, from + i * 150, 700) }),
      text(sound, { x, y: y + 62, size: 32, color: RED, p: ramp(t, from + i * 150 + 200, 500) }),
    ];
  }).join('') + text('Not marks to memorise. Drawings, stacked and simplified.', {
    x: 960, y: 960, size: 40, color: INK_SOFT, p: ramp(t, beat(S.close, 'memorize'), 900),
  });
}

// Stages hold until the next one opens, so a drawing stays on the page while
// the narrator finishes the thought.
const EDGES = [S.mDraw, S.wDraw, S.sDraw, S.moon, S.turn, S.person, S.follow, S.forest, S.close];

function stageFor(t) {
  if (t < shotStart(S.mDraw) - 260) return stageOpening(t);
  if (t < shotStart(S.wDraw) - 260) return stageMountain(t);
  if (t < shotStart(S.sDraw) - 260) return stageWater(t);
  if (t < shotStart(S.moon) - 260) return stageSun(t);
  if (t < shotStart(S.turn) - 260) return stageMoon(t);
  if (t < shotStart(S.person) - 260) return stageTurn(t);
  if (t < shotStart(S.follow) - 260) return stagePerson(t);
  if (t < shotStart(S.forest) - 260) return stageFollow(t);
  if (t < shotStart(S.close) - 260) return stageForest(t);
  return stageClosing(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
