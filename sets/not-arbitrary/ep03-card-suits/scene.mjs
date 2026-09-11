// Not Arbitrary, episode 3 — the four suits on a playing card.
//
// Episode 2 rotated one shape into another. This one puts a stencil on the
// page and lets the stencil do the argument: the acorn does not simplify
// because time passed, it simplifies because a hole in a sheet of card cannot
// pass a hatched cup. So every mark here is one shape with a morph parameter
// m — 0 is the German woodcut, 1 is the French suit sign — and the stencil
// aperture is a real clip, not a picture of one.

import {
  P, ink, text, flood, clipTo, createFilm,
  ramp, easeOut, easeInOut, lerp, clamp01,
  INK, INK_SOFT, PAPER, RED,
} from '../../../lib/scene-kit.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  open: 's01.opening', acornDraw: 's02.acorn.draw', acornName: 's03.acorn.name',
  stencil: 's04.stencil', club: 's05.club.reveal', leaf: 's06.leaf.draw',
  spade: 's07.spade.reveal', bell: 's08.bell.draw', diamond: 's09.diamond.reveal',
  heart: 's10.heart', turn: 's11.turn', italian: 's12.italian',
  recap: 's13.recap', close: 's14.closing',
};

const CX = 960;
const CY = 520;

const place = (inner, x, y, s) =>
  `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)}) translate(${-CX} ${-CY})">${inner}</g>`;

const label = (str, p, { y = 880, size = 40, color = INK_SOFT, x = CX } = {}) =>
  text(str, { x, y, size, color, p });

/** Closed ellipse. Dropping k from the circle constant toward zero squares it. */
const ellipse = (cx, cy, rx, ry, k = 0.5523) => new P()
  .M(cx, cy - ry)
  .C(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy)
  .C(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry)
  .C(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy)
  .C(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry)
  .Z();

/** A stalk that widens into the little foot every black suit still carries. */
const stalk = (flare, top, bot, waist = 12) => new P()
  .M(CX - flare, bot).L(CX - waist, top).L(CX + waist, top).L(CX + flare, bot).Z();

// ------------------------------------------------------------------ acorn
// The German Eichel hangs nut upward with its cup below and the stalk trailing
// down, which is already the club's topology: the nut is the top lobe, the cup
// splits into the two lower ones, and the stalk never goes anywhere. m runs
// acorn (0) to club (1).
function acornClubShapes(m) {
  const nut = ellipse(CX, lerp(CY - 112, CY - 92, m), lerp(74, 78, m), lerp(100, 78, m));
  const loY = lerp(CY + 56, CY + 42, m);
  // At m = 0 the two lobes sit almost on top of each other, so the pair reads
  // as one cup drawn with a doubled pencil line rather than as two rings; at
  // m = 1 they walk apart into the club's lower circles. The topology never
  // changes, which is the only reason this can be one continuous move.
  const loDx = lerp(4, 74, m);
  const loRx = lerp(122, 78, m);
  const loRy = lerp(68, 78, m);
  const left = ellipse(CX - loDx, loY, loRx, loRy);
  const right = ellipse(CX + loDx, loY, loRx, loRy);
  // The printed mark needs its stalk to run up inside the lobes or the fill
  // comes out as a blob with a triangle floating under it. The drawn outline
  // wants the opposite, so acornArt carries a shorter one of its own.
  const stem = stalk(lerp(13, 58, m), lerp(CY + 112, CY + 56, m), lerp(CY + 206, CY + 190, m), lerp(11, 12, m));
  return [nut, left, right, stem];
}

/** The hole is cut wider than the mark it has to pass. */
const apertureShapes = () => [
  ellipse(CX, CY - 92, 92, 92),
  ellipse(CX - 74, CY + 42, 92, 92),
  ellipse(CX + 74, CY + 42, 92, 92),
  stalk(78, CY + 80, CY + 212, 34),
];

function acornArt(p, m, { detail = 1, extra = 0, color = INK, w = 9 } = {}) {
  const [nut, left, right] = acornClubShapes(m);
  const stem = stalk(lerp(13, 58, m), lerp(CY + 116, CY + 88, m), lerp(CY + 210, CY + 190, m), lerp(11, 12, m));
  const nub = new P().M(CX, CY - 212).L(CX, CY - 236);
  const hatch = [];
  for (let i = -2; i <= 2; i += 1) {
    const x = CX + i * 44;
    hatch.push(new P().M(x, CY + 2).Q(x + 6, CY + 54, x, CY + 106));
  }
  const fine = [];
  for (let i = -3; i <= 3; i += 1) {
    const x = CX + i * 30 + 15;
    fine.push(new P().M(x, CY + 14).Q(x + 4, CY + 54, x, CY + 94));
  }
  const d = clamp01(detail);
  return ink(nut, p, { w: w + 1, color })
    + ink(left, Math.max(0, p * 1.4 - 0.4), { w, color })
    + ink(right, Math.max(0, p * 1.6 - 0.6), { w, color })
    + ink(stem, Math.max(0, p * 1.8 - 0.8), { w, color })
    + (d > 0.01
      ? ink(nub, Math.min(1, p * 1.5), { w: 5, color: INK_SOFT, opacity: d })
        + hatch.map((h, i) => ink(h, Math.min(1, p * 1.6 - i * 0.02), { w: 3.4, color: INK_SOFT, opacity: d })).join('')
      : '')
    + (extra > 0.01
      ? fine.map((h, i) => ink(h, Math.min(1, extra * 1.4 - i * 0.05), { w: 2.4, color: INK_SOFT, opacity: extra * d * 0.85 })).join('')
      : '');
}

// ------------------------------------------------------------------- leaf
// One outline. The widest point slides down, the bottom tip lifts into a
// notch, and the sides swing out past it — a leaf grows two lobes and becomes
// a pike. Nothing crossfades; the veins simply are not on the stencil.
function leafSpadeShapes(m) {
  const top = CY - 172;
  const rx = lerp(104, 164, m);
  const ry = lerp(CY - 4, CY + 58, m);
  const notch = lerp(CY + 158, CY + 44, m);
  const c1x = lerp(CX + 26, CX + 58, m), c1y = lerp(CY - 156, CY - 130, m);
  const c2x = lerp(CX + 104, CX + 130, m), c2y = lerp(CY - 96, CY - 42, m);
  const c3x = lerp(CX + 104, CX + 190, m), c3y = lerp(CY + 74, CY + 156, m);
  const c4x = lerp(CX + 56, CX + 52, m), c4y = lerp(CY + 142, CY + 118, m);
  const mx = v => 2 * CX - v;
  const outline = new P()
    .M(CX, top)
    .C(c1x, c1y, c2x, c2y, CX + rx, ry)
    .C(c3x, c3y, c4x, c4y, CX, notch)
    .C(mx(c4x), c4y, mx(c3x), c3y, CX - rx, ry)
    .C(mx(c2x), c2y, mx(c1x), c1y, CX, top)
    .Z();
  // The spade's stem has to start above the notch or the printed mark comes
  // out as a blob with a triangle floating under it.
  const stem = stalk(lerp(11, 48, m), lerp(CY + 150, CY + 26, m), lerp(CY + 244, CY + 194, m), lerp(11, 13, m));
  return [outline, stem];
}

function leafArt(p, m, { veins = 1, color = INK } = {}) {
  const [outline] = leafSpadeShapes(m);
  const stem = stalk(lerp(11, 48, m), lerp(CY + 150, CY + 112, m), lerp(CY + 244, CY + 194, m), lerp(11, 13, m));
  const rib = new P().M(CX, CY - 150).Q(CX + 6, CY, CX, CY + 140);
  const side = [];
  for (let i = 0; i < 3; i += 1) {
    const y = CY - 88 + i * 66;
    side.push(new P().M(CX, y).Q(CX + 44, y + 6, CX + 78, y + 40));
    side.push(new P().M(CX, y).Q(CX - 44, y + 6, CX - 78, y + 40));
  }
  const v = clamp01(veins);
  return ink(outline, p, { w: 10, color })
    + ink(stem, Math.max(0, p * 1.5 - 0.5), { w: 9, color })
    + (v > 0.01
      ? ink(rib, Math.min(1, p * 1.4), { w: 4.5, color: INK_SOFT, opacity: v })
        + side.map((s, i) => ink(s, Math.min(1, p * 1.5 - i * 0.03), { w: 3.2, color: INK_SOFT, opacity: v })).join('')
      : '');
}

// ------------------------------------------------------------------- bell
// A hawking bell is a sphere. Pull the circle constant to nothing and the four
// anchor points are already north, east, south and west — the corners arrive
// without anything being rotated.
function bellDiamondShapes(m) {
  return [ellipse(CX, CY, lerp(128, 108, m), lerp(128, 152, m), lerp(0.5523, 0.03, m))];
}

function bellArt(p, m, { detail = 1, color = INK } = {}) {
  const [body] = bellDiamondShapes(m);
  // One slit, low. A slit plus a hole higher up turns the bell into a face.
  const slit = new P().M(CX - 78, CY + 56).Q(CX, CY + 72, CX + 78, CY + 56);
  const seam = new P().M(CX - 104, CY + 8).Q(CX, CY + 20, CX + 104, CY + 8);
  const loop = new P().M(CX - 24, CY - 126).C(CX - 24, CY - 172, CX + 24, CY - 172, CX + 24, CY - 126);
  const d = clamp01(detail);
  return ink(body, p, { w: 10, color })
    + (d > 0.01
      ? ink(loop, Math.min(1, p * 1.5), { w: 7, color, opacity: d })
        + ink(seam, Math.max(0, p * 1.4 - 0.4), { w: 3.4, color: INK_SOFT, opacity: d * 0.8 })
        + ink(slit, Math.max(0, p * 1.6 - 0.6), { w: 6, color: INK_SOFT, opacity: d })
      : '');
}

// ------------------------------------------------------------------ heart
const heartShapes = () => [new P()
  .M(CX, CY + 152)
  .C(CX - 152, CY + 22, CX - 142, CY - 132, CX - 62, CY - 132)
  .C(CX - 20, CY - 132, CX - 4, CY - 92, CX, CY - 64)
  .C(CX + 4, CY - 92, CX + 20, CY - 132, CX + 62, CY - 132)
  .C(CX + 142, CY - 132, CX + 152, CY + 22, CX, CY + 152)
  .Z()];

const heartArt = (p, { color = INK } = {}) => ink(heartShapes()[0], p, { w: 10, color });

// ------------------------------------------------- the suits, printed solid
const SHAPES = {
  club: () => acornClubShapes(1),
  spade: () => leafSpadeShapes(1),
  diamond: () => bellDiamondShapes(1),
  heart: heartShapes,
};
const SUIT_INK = { club: INK, spade: INK, diamond: RED, heart: RED };

const suit = (name, p, { x = CX, y = CY, s = 1 } = {}) =>
  place(flood(SHAPES[name](), p, { color: SUIT_INK[name], x: CX - 300, y: CY - 260, w: 600, h: 520 }), x, y, s);

const SOURCE = {
  club: (p, o) => acornArt(p, 0, o),
  spade: (p, o) => leafArt(p, 0, o),
  diamond: (p, o) => bellArt(p, 0, o),
  heart: (p, o) => heartArt(p, o),
};

// ----------------------------------------------------- the Italian pack
function sword(p, { color = INK } = {}) {
  const blade = new P().M(CX - 15, CY + 44).L(CX - 15, CY - 118).L(CX, CY - 168)
    .L(CX + 15, CY - 118).L(CX + 15, CY + 44).Z();
  const guard = new P().M(CX - 58, CY + 52).Q(CX, CY + 66, CX + 58, CY + 52);
  const grip = new P().M(CX - 10, CY + 56).L(CX - 10, CY + 116).L(CX + 10, CY + 116).L(CX + 10, CY + 56);
  const pommel = ellipse(CX, CY + 132, 19, 19);
  const fuller = new P().M(CX, CY + 30).L(CX, CY - 112);
  return ink(blade, p, { w: 8, color })
    + ink(fuller, Math.max(0, p * 1.3 - 0.3), { w: 3, color: INK_SOFT })
    + ink(guard, Math.max(0, p * 1.5 - 0.5), { w: 8, color })
    + ink(grip, Math.max(0, p * 1.7 - 0.7), { w: 8, color })
    + ink(pommel, Math.max(0, p * 1.9 - 0.9), { w: 7, color });
}

function baton(p, { color = INK } = {}) {
  const body = new P().M(CX - 13, CY - 156)
    .C(CX - 20, CY - 40, CX - 32, CY + 50, CX - 42, CY + 150)
    .L(CX + 42, CY + 150)
    .C(CX + 32, CY + 50, CX + 20, CY - 40, CX + 13, CY - 156).Z();
  const knots = [
    new P().M(CX - 21, CY - 46).Q(CX, CY - 30, CX + 21, CY - 46),
    new P().M(CX - 31, CY + 52).Q(CX, CY + 68, CX + 31, CY + 52),
  ];
  const cap = new P().M(CX - 13, CY - 156).Q(CX, CY - 176, CX + 13, CY - 156);
  return ink(body, p, { w: 8, color })
    + ink(cap, Math.max(0, p * 1.4 - 0.4), { w: 7, color })
    + knots.map((k, i) => ink(k, Math.max(0, p * 1.6 - 0.6 - i * 0.1), { w: 4, color: INK_SOFT })).join('');
}

/** Three cards overlapped: you only ever see a corner of the one underneath. */
function fanOfCards(p) {
  const card = (dx, rot, i) => {
    const r = new P().M(-56, -84).L(56, -84).L(56, 84).L(-56, 84).Z();
    const q = Math.max(0, p * 1.5 - i * 0.22);
    // Opaque, so the fan overlaps like paper instead of reading as wireframe.
    const back = q > 0.4 ? `<path d="${r.d()}" fill="${PAPER}" opacity="${clamp01(q * 2 - 0.8).toFixed(3)}"/>` : '';
    return `<g transform="translate(${dx} 0) rotate(${rot})">${back}${ink(r, q, { w: 4, color: INK_SOFT })}</g>`;
  };
  return `<g transform="translate(1520 320) scale(0.9)">${card(-46, -16, 0)}${card(0, 0, 1)}${card(46, 16, 2)}</g>`;
}

// ------------------------------------------------------------------ stages
/**
 * One shape from the first word to the last: the club is drawn, rolled back
 * into the acorn it came from, cut and hatched like a woodcut, then pushed
 * through a real stencil aperture until only the suit sign is left.
 */
function stageAcorn(t) {
  const drawn = ramp(t, beat(S.open, 'club'), 1200);
  const toAcorn = easeInOut(ramp(t, beat(S.open, 'acorn'), 1500));
  const cut = easeInOut(ramp(t, beat(S.stencil, 'stencil'), 2400));
  const m = clamp01(1 - toAcorn + cut);
  const detail = toAcorn * (1 - easeInOut(ramp(t, beat(S.stencil, 'stencil') + 300, 1800)));
  const extra = ramp(t, beat(S.acornName, 'woodcut'), 1400);

  const sheetIn = easeOut(ramp(t, beat(S.stencil, 'lay'), 900));
  const sheetOut = easeInOut(ramp(t, beat(S.club, 'club'), 800));
  const sheet = clamp01(sheetIn - sheetOut);
  const printed = ramp(t, beat(S.club, 'club') + 260, 900);
  const ghost = ramp(t, beat(S.club, 'acorn'), 800) * 0.34;

  const art = acornArt(drawn, m, { detail, extra });
  const aperture = apertureShapes();
  const wash = `<rect x="${CX - 340}" y="${CY - 300}" width="680" height="620" rx="10" fill="${PAPER}" opacity="${(sheet * 0.86).toFixed(3)}"/>`
    + ink(new P().M(CX - 340, CY - 300).L(CX + 340, CY - 300).L(CX + 340, CY + 320).L(CX - 340, CY + 320).Z(),
      sheet, { w: 3.5, color: INK_SOFT, opacity: sheet * 0.8 });

  const stencilLayer = sheet > 0.01
    ? wash + clipTo(aperture, art)
      + aperture.map(sh => ink(sh, sheet, { w: 3, color: INK_SOFT, dash: '13 10', opacity: 0.5 })).join('')
    : '';

  const ghostArt = ghost > 0.01 ? `<g opacity="${ghost.toFixed(3)}">${acornArt(1, 0, { detail: 1, color: INK_SOFT, w: 6 })}</g>` : '';

  return ghostArt + art + stencilLayer + (printed > 0.01 ? suit('club', printed) : '')
    + label('a club', ramp(t, beat(S.open, 'club'), 700) * (1 - toAcorn))
    + label('an acorn', ramp(t, beat(S.acornDraw, 'acorn'), 700) * (1 - ramp(t, beat(S.acornName, 'Eichel'), 500)))
    + label('Eichel  ·  acorn', ramp(t, beat(S.acornName, 'Eichel'), 600) * (1 - sheetIn), { size: 46, color: RED })
    + label('one hole, one colour', sheetIn * (1 - sheetOut), { size: 42, color: INK_SOFT })
    + label('club', printed, { y: 890, size: 60, color: RED });
}

function stageLeaf(t) {
  const drawn = ramp(t, beat(S.leaf, 'leaf'), 1500);
  const m = easeInOut(ramp(t, beat(S.spade, 'inside'), 1900));
  const veins = 1 - easeInOut(ramp(t, beat(S.spade, 'inside'), 1300));
  const printed = ramp(t, beat(S.spade, 'spade'), 900);
  const footP = ramp(t, beat(S.spade, 'foot'), 700);
  const foot = footP > 0.01
    ? ink(ellipse(CX, CY + 178, 84, 58), footP, { w: 3.4, color: RED, dash: '12 10', opacity: 0.9 })
    : '';
  return leafArt(drawn, m, { veins })
    + (printed > 0.01 ? suit('spade', printed) : '')
    + foot
    + label('a leaf, on its stalk', ramp(t, beat(S.leaf, 'leaf'), 700) * (1 - ramp(t, beat(S.leaf, 'laub'), 500)))
    + label('Laub  ·  leaves', ramp(t, beat(S.leaf, 'laub'), 600) * (1 - m), { size: 46, color: RED })
    + label('spade', printed * (1 - footP), { y: 890, size: 60, color: RED })
    + label('still a stem', ramp(t, beat(S.spade, 'stem'), 700), { y: 890, size: 54, color: RED });
}

function stageBell(t) {
  const drawn = ramp(t, beat(S.bell, 'bell'), 1500);
  const pair = easeInOut(ramp(t, beat(S.diamond, 'heart'), 900));
  const m = easeInOut(ramp(t, beat(S.diamond, 'corners'), 1500));
  const detail = 1 - easeInOut(ramp(t, beat(S.diamond, 'corners'), 1100));
  const printed = ramp(t, beat(S.diamond, 'corners') + 900, 900);
  const bellX = lerp(CX, 720, pair);
  const bellS = lerp(1, 0.82, pair);
  const body = place(bellArt(drawn, m, { detail }), bellX, CY, bellS)
    + (printed > 0.01 ? suit('diamond', printed, { x: bellX, y: CY, s: bellS }) : '');
  return body
    + (pair > 0.01
      ? place(heartArt(ramp(t, beat(S.diamond, 'heart'), 620), { color: INK }), 1210, CY, 0.75)
      : '')
    + fanOfCards(ramp(t, beat(S.diamond, 'fan'), 900))
    + label('Schelle  ·  a hawking bell',
      ramp(t, beat(S.bell, 'hawking'), 700) * (1 - ramp(t, beat(S.diamond, 'card'), 600)), { size: 44 })
    + label('both just round', pair * (1 - m), { size: 44, color: INK_SOFT })
    + label('diamond', printed, { y: 890, size: 60, color: RED });
}

/** The one that arrived already printable. */
function stageHeart(t) {
  const drawn = ramp(t, beat(S.heart, 'heart'), 1300);
  const printed = ramp(t, beat(S.heart, 'stencil'), 1000);
  const row = ['club', 'spade', 'diamond'].map((name, i) =>
    suit(name, ramp(t, beat(S.heart, 'four') + i * 260, 700), { x: 800 + i * 160, y: 252, s: 0.26 })).join('');
  const heartBody = heartArt(drawn)
    + (printed > 0.01 ? flood(heartShapes(), printed, { color: RED, x: CX - 300, y: CY - 260, w: 600, h: 520 }) : '');
  return row
    + place(heartBody, CX, 640, 0.84)
    + label('Herz  ·  heart', ramp(t, beat(S.heart, 'heart'), 700), { size: 46, color: RED, x: CX, y: 930 });
}

/**
 * The turn. Two of the three questions get answered out loud; the third is
 * only ever a question mark on the page, and the next shot is the answer.
 */
function stageTurn(t) {
  const suits = ['club', 'spade', 'diamond', 'heart'];
  const row = suits.map((name, i) =>
    suit(name, ramp(t, beat(S.turn, 'pictures') + i * 180, 600), { x: 690 + i * 180, y: 300, s: 0.3 })).join('');
  const col = (x, cap, ans, from, color) =>
    ink(new P().M(x - 92, 512).L(x + 92, 512), ramp(t, from, 500), { w: 3, color: INK_SOFT, dash: '10 9' })
    + text(cap, { x, y: 588, size: 34, color: INK_SOFT, p: ramp(t, from, 600) })
    + text(ans, { x, y: 690, size: 62, color, p: ramp(t, from + 260, 700) });
  return row
    + col(600, 'the drawings', 'Germany', beat(S.turn, 'German'), INK)
    + col(960, 'the printing', 'France', beat(S.turn, 'French'), INK)
    + col(1330, 'the names', '?', beat(S.turn, 'names'), RED);
}

function stageItalian(t) {
  const sw = ramp(t, beat(S.italian, 'swords'), 1100);
  const bt = ramp(t, beat(S.italian, 'sticks'), 1100);
  const eng = ramp(t, beat(S.italian, 'England'), 800);
  const tie = ramp(t, beat(S.italian, 'Italian'), 900);
  const dash = (y, p) => ink(new P().M(880, y).L(1150, y), p, { w: 3, color: RED, dash: '13 11', opacity: 0.85 });
  return place(sword(sw), 600, 500, 0.86)
    + place(baton(bt), 810, 500, 0.86)
    + suit('spade', eng, { x: 1280, y: 440, s: 0.44 })
    + suit('club', ramp(t, beat(S.italian, 'England') + 300, 800), { x: 1280, y: 660, s: 0.44 })
    + dash(440, tie) + dash(660, Math.max(0, tie * 1.3 - 0.3))
    + text('Italy', { x: 705, y: 800, size: 44, color: INK_SOFT, p: Math.max(sw, bt) })
    + text('England', { x: 1280, y: 800, size: 44, color: INK_SOFT, p: eng })
    + text('the words', { x: 705, y: 862, size: 38, color: RED, p: tie })
    + text('the shapes', { x: 1280, y: 862, size: 38, color: RED, p: tie });
}

/** Laid down like cards: what it was, what it became, what it is called. */
const RECAP = [
  ['spade', 'leaf', 'spade', 510],
  ['club', 'acorn', 'club', 810],
  ['diamond', 'bell', 'diamond', 1110],
  ['heart', 'heart', 'heart', 1410],
];

/**
 * The four drawings go down first so the page is never a third full, then each
 * suit and its borrowed name lands on the word that names it.
 */
function stageRecap(t) {
  const open = beat(S.recap, 'holding');
  const cues = [
    beat(S.recap, 'leaf'), beat(S.recap, 'acorn'),
    beat(S.recap, 'bell'), beat(S.recap, 'tell'),
  ];
  const names = [
    beat(S.recap, 'sword'), beat(S.recap, 'stick'),
    beat(S.recap, 'corners'), beat(S.recap, 'heart'),
  ];
  return RECAP.map(([name, , caption, x], i) => {
    const drew = ramp(t, open + i * 240, 700);
    const p = ramp(t, cues[i], 700);
    return place(SOURCE[name](drew, { color: INK_SOFT }), x, 320, 0.3)
      + ink(new P().M(x, 424).L(x, 522), p, { w: 3, color: INK_SOFT, dash: '10 9' })
      + suit(name, p, { x, y: 630, s: 0.34 })
      + text(caption, { x, y: 840, size: 42, color: RED, p: ramp(t, names[i], 600) });
  }).join('');
}

function stageClosing(t) {
  const suits = ['club', 'spade', 'diamond', 'heart'];
  const src = ramp(t, beat(S.close, 'forest'), 900);
  return suits.map((name, i) => {
    const x = 570 + i * 260;
    return `<g opacity="${(src * 0.28).toFixed(3)}">${place(SOURCE[name](src, { color: INK_SOFT }), x, 300, 0.24)}</g>`
      + suit(name, ramp(t, beat(S.close, 'designed') + i * 220, 700), { x, y: 560, s: 0.42 });
  }).join('')
    + text('Not Arbitrary', { x: CX, y: 900, size: 58, color: RED, p: ramp(t, beat(S.close, 'evidence'), 900) });
}

const EDGES = [S.leaf, S.bell, S.heart, S.turn, S.italian, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.leaf) - 260) return stageAcorn(t);
  if (t < shotStart(S.bell) - 260) return stageLeaf(t);
  if (t < shotStart(S.heart) - 260) return stageBell(t);
  if (t < shotStart(S.turn) - 260) return stageHeart(t);
  if (t < shotStart(S.italian) - 260) return stageTurn(t);
  if (t < shotStart(S.recap) - 260) return stageItalian(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClosing(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
