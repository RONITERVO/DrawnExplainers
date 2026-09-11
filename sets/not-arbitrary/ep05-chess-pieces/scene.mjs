// Not Arbitrary, episode 5 — the pieces on a chessboard.
//
// The other films in this set morph a picture into a mark on a page. This one
// morphs a picture into a carved object, so every mark here is a closed ring of
// anchors, inked on and then flooded solid: a drawn animal is an outline, a
// carved piece is a filled silhouette, and the difference between the two is
// the whole subject.
//
// Each derivation is one ring walked through its documented states, never two
// drawings cross-faded:
//
//   elephant -> alfil -> bishop
//       The elephant is a line drawing and it is NOT in the ring — what a
//       carver under an image prohibition kept was the tusks, so the tusks are
//       two strokes that morph into the two nubs on top of the abstract block,
//       and only then does the block flood in beneath them. Block -> bishop is
//       then a true 26-anchor morph: the nubs rise and close into the peaks of
//       the mitre, the notch between them deepens into the cleft every bishop
//       still carries, and the squat sides pull in into a collar and a stem.
//
//   chariot -> rook block -> tower
//       28 anchors walked through three states with along(). Anchors 2..7 lie
//       flat along the top of the block and separate into merlons on the way to
//       the tower — the ep03 trick of making the source's part count already
//       match, so nothing has to split. The V the carver cut stays put and
//       becomes the middle gap in the battlement. Tension falls from 0.85 to
//       0.3 across the walk: a basket is round, masonry is not.
//
//   horse -> knight
//       Deliberately not a morph. It is the piece nobody had to guess at, and
//       the shot only works if the two shapes sit there being the same shape.
//
//   vizier -> queen
//       A morph, but the argument of that shot is the move, not the outline,
//       so the weight is on the board beside it: one diagonal step, then eight
//       rays to the edge.

import {
  P, ink, fill, flood, text, createFilm,
  smooth, morph, blend, along, mirrorRing, ring,
  ramp, easeOut, easeInOut, lerp, clamp01,
  INK, INK_SOFT, PAPER, RED, GOLD, GREEN, BLUE, EDGE,
} from '../../../lib/scene-kit.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  open: 's01.open', army: 's02.army', eleph: 's03.elephant', abstract: 's04.abstract',
  block: 's05.block', europe: 's06.europe', reveal: 's07.reveal', chariot: 's08.chariot',
  rook: 's09.rook', horse: 's10.horse', turn: 's11.turn', vizier: 's12.vizier',
  queen: 's13.queen', recap: 's14.recap', close: 's15.close',
};

// ---------------------------------------------------------------- helpers
const place = (inner, x, y, s) =>
  `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})">${inner}</g>`;
const ghost = (inner, o) => (o <= 0.005 ? '' : `<g opacity="${o.toFixed(3)}">${inner}</g>`);
// ring() hands back anchors, not a path, so anything that wants to be filled
// has to be smoothed first.
const dot = (x, y, r) => smooth(ring(x, y, r, 8), { closed: true });
const tie = (x0, y0, x1, y1, p, { color = INK_SOFT, w = 3 } = {}) =>
  ink(new P().M(x0, y0).L(x1, y1), p, { w, color, dash: '12 10', opacity: 0.75 });

// Every piece is drawn in one local box: the base sits on y = 0 and the piece
// rises to about y = -260, so any two of them can be swapped into the same
// place() without re-measuring.
const BOX = { x: -200, y: -300, w: 400, h: 312 };

/** Outline drawn on, then ink flooding it solid. A carved object, not a sketch. */
function carve(anchors, drawP, floodP, { w = 6, color = INK, tension = 1 } = {}) {
  const path = smooth(anchors, { closed: true, tension });
  return ink(path, drawP, { w, color }) + flood([path], floodP, { color, ...BOX });
}

// ------------------------------------------------------------ the elephant
// A drawing, not a piece: outline only, so it reads as the animal beside the
// object it became.
const ELEPHANT = [
  [-104, -232], [ -56, -218], [  -4, -222], [  48, -212], [  86, -178],
  [  90, -126], [  84,  -62], [  80,  -10], [  48,  -10], [  50,  -76],
  [  16,  -88], [ -14,  -84], [ -16,  -10], [ -50,  -10], [ -54,  -86],
  [ -74, -116], [ -96, -134], [-112, -116], [-118,  -76], [-122,  -38],
  [-128,  -14], [-148,  -22], [-146,  -72], [-148, -132], [-140, -190],
];
const EAR = [[-98, -216], [-52, -206], [-38, -168], [-52, -128], [-86, -118], [-100, -142]];
const RIDER_HEAD = ring(18, -268, 15, 10);
const RIDER = new P().M(14, -252).L(6, -222);
const RIDER_ARM = new P().M(12, -244).L(46, -256);

/** The two tusks, which are the only part of the animal the carver kept. */
const TUSK_NEAR = [[-118, -124], [-140, -116], [-162, -110], [-178, -122]];
const TUSK_FAR = [[-110, -138], [-132, -130], [-154, -124], [-170, -138]];
/** ...and where they end up: the two nubs on top of the abstract block. */
const NUB_R = [[13, -112], [21, -130], [31, -141], [44, -129]];
const NUB_L = NUB_R.map(([x, y]) => [-x, y]);

function elephant(p, { w = 5, color = INK, body = 1 } = {}) {
  if (body <= 0.005) return '';
  return ghost(
    ink(smooth(ELEPHANT, { closed: true }), p, { w, color })
    + ink(smooth(EAR), Math.max(0, p * 1.5 - 0.5), { w: w - 1, color })
    + fill(dot(-128, -176, 5), Math.max(0, p * 2 - 1.2), { color })
    + ink(smooth(RIDER_HEAD, { closed: true }), Math.max(0, p * 1.6 - 0.6), { w: w - 1, color })
    + ink(RIDER, Math.max(0, p * 1.7 - 0.7), { w, color })
    + ink(RIDER_ARM, Math.max(0, p * 1.9 - 0.9), { w: w - 1, color }), body);
}

/** m: 0 on the animal's face, 1 sitting on the block as its two points. */
const tusks = (p, m, { w = 6, color = INK } = {}) =>
  ink(morph(TUSK_NEAR, NUB_R, m), p, { w, color })
  + ink(morph(TUSK_FAR, NUB_L, m), p, { w, color });

// ------------------------------------------------- alfil -> bishop, 26 anchors
// 0 is the notch between the two points; 13 is the middle of the base. Both
// rings run clockwise from the notch, so every corresponding run travels the
// same way round and nothing folds through itself mid-morph.
const ALFIL = mirrorRing([0, -104], [
  [ 14, -110], [ 30, -142], [ 46, -128], [ 56, -118], [ 68, -110],
  [ 72,  -92], [ 74,  -72], [ 74,  -54], [ 74,  -36], [ 78,  -22],
  [ 86,  -10], [ 92,    4],
], [0, 9]);
// The slit is narrow on purpose. A wide notch here does not read as a cut in a
// hat, it reads as two horns — which is the one thing this shape must not look
// like, because horns are what the shape stopped being. The alfil's 28-wide gap
// between its two nubs closing into a 12-wide slit is the morph.
const BISHOP = mirrorRing([0, -206], [
  [  6, -234], [ 16, -253], [ 38, -238], [ 52, -202], [ 58, -162],
  [ 46, -146], [ 52, -132], [ 32, -112], [ 25,  -76], [ 40,  -34],
  [ 76,  -10], [ 88,    4],
], [0, 9]);
export const bishopAt = m => blend(ALFIL, BISHOP, m);
const bishopPiece = (drawP, floodP, m, o = {}) =>
  carve(bishopAt(m), drawP, floodP, { tension: lerp(0.45, 0.95, clamp01(m)), ...o });

// ------------------------------------------ chariot -> block -> tower, 28 anchors
const CHARIOT_BODY = mirrorRing([0, -150], [
  [ 26, -152], [ 50, -154], [ 74, -156], [ 96, -156], [116, -154],
  [132, -150], [140, -136], [140, -116], [134,  -98], [120,  -86],
  [ 96,  -80], [ 56,  -78], [ 22,  -76],
], [0, -74]);
const ROOK_BLOCK = mirrorRing([0, -112], [
  [ 13, -140], [ 24, -143], [ 33, -143], [ 41, -143], [ 49, -143],
  [ 57, -143], [ 64, -142], [ 66, -126], [ 66, -100], [ 64,  -58],
  [ 66,  -26], [ 78,   -6], [ 90,    4],
], [0, 9]);
const TOWER = mirrorRing([0, -150], [
  [ 16, -152], [ 18, -194], [ 42, -194], [ 44, -152], [ 64, -152],
  [ 66, -194], [ 90, -192], [ 88, -150], [ 70, -138], [ 58,  -96],
  [ 56,  -52], [ 74,  -20], [ 92,    4],
], [0, 9]);
const ROOK_STATES = [CHARIOT_BODY, ROOK_BLOCK, TOWER];
/** x: 0 the chariot's basket, 1 the block a carver left of it, 2 the tower. */
function rookPiece(drawP, floodP, x, { w = 6, color = INK } = {}) {
  const path = along(ROOK_STATES, x, { closed: true, tension: lerp(0.85, 0.3, clamp01(x / 2)) });
  return ink(path, drawP, { w, color }) + flood([path], floodP, { color, ...BOX });
}

// The rest of the chariot, which does not survive the crossing.
const WHEEL = ring(34, -46, 56, 16);
const POLE = new P().M(-198, -34).Q(-116, -70, -16, -92);
const YOKE = new P().M(-198, -58).L(-196, -12);
function chariot(p, { w = 5, color = INK, rest = 1 } = {}) {
  if (rest <= 0.005) return '';
  let out = ink(smooth(WHEEL, { closed: true }), p, { w, color });
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI;
    out += ink(new P().M(34 - Math.cos(a) * 52, -46 - Math.sin(a) * 52)
      .L(34 + Math.cos(a) * 52, -46 + Math.sin(a) * 52),
    Math.max(0, p * 1.6 - 0.5 - i * 0.03), { w: w - 2, color, opacity: 0.85 });
  }
  out += ink(POLE, Math.max(0, p * 1.4 - 0.4), { w, color })
    + ink(YOKE, Math.max(0, p * 1.8 - 0.8), { w: w - 1, color });
  return ghost(out, rest);
}

// ---------------------------------------------------------- horse and knight
const HORSE = [
  [-118, -246], [ -96, -238], [ -64, -222], [ -26, -198], [  20, -196],
  [  62, -200], [  92, -186], [ 112, -158], [ 106, -112], [  98,  -62],
  [  96,  -10], [  70,  -10], [  74,  -74], [  50, -110], [  10, -118],
  [ -22, -116], [ -22,  -62], [ -20,  -10], [ -44,  -10], [ -42,  -70],
  [ -50, -120], [ -68, -156], [ -92, -186], [-116, -206], [-142, -212],
  [-158, -222], [-150, -236], [-134, -244],
];
const HORSE_MANE = [[-116, -240], [-88, -228], [-56, -212], [-24, -196]];
const HORSE_TAIL = [[106, -176], [128, -148], [132, -98], [120, -52]];
/**
 * solid 0 draws the animal, solid 1 carves the piece. The mane has to swap
 * colour between the two: a line cut into a flooded silhouette has to be the
 * paper showing through, and the same line on an outline drawing has to be ink.
 */
function horse(p, { w = 5, color = INK, solid = 0 } = {}) {
  const f = solid * Math.max(0, p * 1.7 - 0.7);
  return carve(HORSE, p, f, { w, color, tension: 0.95 })
    + ink(smooth(HORSE_TAIL), Math.max(0, p * 1.4 - 0.4), { w: solid ? 16 : w, color })
    + ink(smooth(HORSE_MANE), Math.max(0, p * 1.5 - 0.5), { w: solid ? 5 : w - 1, color: solid ? PAPER : color, opacity: solid ? f : 0.9 });
}
const KNIGHT = [
  [   2, -232], [  30, -224], [  48, -196], [  54, -160], [  50, -130],
  [  46, -110], [  60,  -96], [  74,  -70], [  80,  -40], [  86,  -12],
  [  92,    4], [   0,    8], [ -92,    4], [ -84,  -18], [ -70,  -46],
  [ -52,  -74], [ -44, -100], [ -58, -116], [ -80, -130], [ -96, -152],
  [ -92, -180], [ -74, -190], [ -62, -210], [ -44, -230], [ -20, -240],
];
const KNIGHT_MANE = [[-4, -226], [16, -204], [26, -170], [26, -132]];
const knightPiece = (drawP, floodP, { w = 6, color = INK } = {}) =>
  carve(KNIGHT, drawP, floodP, { w, color, tension: 0.95 })
  + ink(smooth(KNIGHT_MANE), Math.max(0, drawP * 1.4 - 0.4), { w: 5, color: PAPER, opacity: floodP });

// --------------------------------------------------------- vizier -> queen
const VIZIER = mirrorRing([0, -138], [
  [ 15, -132], [ 25, -120], [ 29, -108], [ 31,  -98], [ 35,  -84],
  [ 39,  -66], [ 43,  -46], [ 51,  -28], [ 63,  -14], [ 75,   -2],
  [ 82,    5],
], [0, 9]);
const QUEEN = mirrorRing([0, -234], [
  [ 14, -226], [ 20, -202], [ 32, -214], [ 38, -188], [ 54, -198],
  [ 58, -166], [ 37, -132], [ 29,  -84], [ 46,  -40], [ 72,  -12],
  [ 88,    5],
], [0, 9]);
export const queenAt = m => blend(VIZIER, QUEEN, m);
const queenPiece = (drawP, floodP, m, o = {}) =>
  carve(queenAt(m), drawP, floodP, { tension: lerp(1, 0.55, clamp01(m)), ...o });

// ------------------------------------------------------------ pawn and king
const PAWN = mirrorRing([0, -196], [
  [ 18, -188], [ 26, -170], [ 22, -152], [ 12, -142], [ 26, -132],
  [ 22, -112], [ 18,  -74], [ 30,  -38], [ 56,  -14], [ 70,    4],
], [0, 8]);
const KING_CROSS = [
  new P().M(0, -282).L(0, -236),
  new P().M(-17, -264).L(17, -264),
];
const kingPiece = (drawP, floodP, o = {}) =>
  carve(queenAt(1), drawP, floodP, { tension: 0.55, ...o })
  + KING_CROSS.map(c => ink(c, Math.max(0, drawP * 1.4 - 0.4), { w: 8, color: o.color || INK })).join('');

// ------------------------------------------------------------ foot soldier
const SOLDIER = [
  new P().M(-4, -196).Q(16, -196, 16, -174).Q(16, -154, -4, -154).Q(-24, -154, -24, -174).Q(-24, -196, -4, -196),
  new P().M(-4, -150).L(-4, -72),
  new P().M(-4, -72).L(-30, -8),
  new P().M(-4, -72).L(24, -8),
  new P().M(-4, -134).L(40, -150),
  new P().M(52, -200).L(44, -24),        // the spear
];
const soldier = (p, { w = 5, color = INK } = {}) =>
  SOLDIER.map((s, i) => ink(s, clamp01(p * 1.9 - i * 0.13), { w, color })).join('');

// ------------------------------------------------------- pages and boards
/** A crenellated wall, which is what an Italian carver saw in a notch. */
function wall(p, { w = 4, color = INK_SOFT } = {}) {
  const merlons = [];
  for (let i = 0; i < 4; i += 1) {
    const x = -108 + i * 58;
    merlons.push(new P().M(x, -30).L(x, -70).L(x + 34, -70).L(x + 34, -30));
  }
  let out = ink(new P().M(-118, -30).L(124, -30), p, { w, color });
  merlons.forEach((m, i) => { out += ink(m, clamp01(p * 2.2 - 0.4 - i * 0.14), { w, color }); });
  for (let i = 0; i < 3; i += 1) {
    out += ink(new P().M(-118, -12 + i * 16).L(124, -12 + i * 16), clamp01(p * 1.6 - 0.5 - i * 0.12),
      { w: 2, color, opacity: 0.55 });
  }
  return out;
}

const CELL = 76;
const BX = 1128, BY = 438, BN = 7;
const sq = (c, r) => [BX + c * CELL + CELL / 2, BY + r * CELL + CELL / 2];
function board(p) {
  let out = '';
  for (let r = 0; r < BN; r += 1) {
    for (let c = 0; c < BN; c += 1) {
      if ((r + c) % 2) continue;
      const q = clamp01(p * 2 - (r + c) * 0.055);
      if (q <= 0.01) continue;
      out += `<rect x="${BX + c * CELL}" y="${BY + r * CELL}" width="${CELL}" height="${CELL}" fill="${INK_SOFT}" opacity="${(q * 0.13).toFixed(3)}"/>`;
    }
  }
  for (let i = 0; i <= BN; i += 1) {
    const q = clamp01(p * 1.8 - i * 0.08);
    out += ink(new P().M(BX, BY + i * CELL).L(BX + BN * CELL, BY + i * CELL), q, { w: 2.4, color: INK_SOFT, opacity: 0.8 })
      + ink(new P().M(BX + i * CELL, BY).L(BX + i * CELL, BY + BN * CELL), q, { w: 2.4, color: INK_SOFT, opacity: 0.8 });
  }
  return out;
}
/** A move, shown as a dashed run out of a square with a dot where it lands. */
function move(c0, r0, c1, r1, p, color = RED) {
  const [x0, y0] = sq(c0, r0);
  const [x1, y1] = sq(c1, r1);
  const e = easeOut(clamp01(p));
  return ink(new P().M(x0, y0).L(lerp(x0, x1, e), lerp(y0, y1, e)), 1, { w: 3.4, color, dash: '11 9', opacity: 0.9 })
    + fill(dot(x1, y1, 9), Math.max(0, p * 3 - 2), { color });
}

// ---------------------------------------------------------------- stage A
/** The back rank, and then the one piece the film is about lifted out of it. */
const RANK = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
function rankPiece(kind, drawP, floodP, color) {
  if (kind === 'rook') return rookPiece(drawP, floodP, 2, { color });
  if (kind === 'knight') return knightPiece(drawP, floodP, { color });
  if (kind === 'queen') return queenPiece(drawP, floodP, 1, { color });
  if (kind === 'king') return kingPiece(drawP, floodP, { color });
  return bishopPiece(drawP, floodP, 1, { color });
}

function stageOpen(t) {
  const rankIn = ramp(t, beat(S.open, 'chessboard'), 1500);
  const lift = easeInOut(ramp(t, beat(S.open, 'years'), 1500));
  const named = ramp(t, beat(S.open, 'call'), 700);

  let page = '';
  for (let i = 0; i < 8; i += 1) {
    if (i === 2) continue;                       // the one that gets lifted out
    const q = clamp01(rankIn * 2.1 - i * 0.13);
    page += ghost(place(rankPiece(RANK[i], q, Math.max(0, q * 1.8 - 0.8)),
      328 + i * 182, 840, 0.44), 1 - lift * 0.72);
  }
  page += ink(new P().M(268, 856).L(1652, 856), clamp01(rankIn * 1.4), { w: 2.6, color: INK_SOFT, opacity: 0.7 });

  const q = clamp01(rankIn * 2.1 - 2 * 0.13);
  page += place(bishopPiece(q, Math.max(0, q * 1.8 - 0.8), 1),
    lerp(692, 960, lift), lerp(840, 806, lift), lerp(0.44, 1.34, lift));
  if (named > 0.01) page += text('bishop', { x: 960, y: 886, size: 48, color: RED, p: named });
  return page;
}

// ---------------------------------------------------------------- stage B
// s02 to s07 on one page: the four arms of an Indian army are drawn in a row,
// the elephant is lifted out of the row the way the bishop was lifted out of
// the rank, and it is then taken apart and rebuilt as the piece.
const ARMY_X = [430, 790, 1150, 1510];
const SOURCE_X = 512, MARK_X = 1052, BASE = 828;

function stageArmy(t) {
  const indiaIn = ramp(t, beat(S.army, 'india'), 700);
  const cue = [
    ramp(t, beat(S.army, 'foot'), 800),
    ramp(t, beat(S.army, 'horses'), 800),
    ramp(t, beat(S.army, 'chariots'), 800),
    ramp(t, beat(S.army, 'elephants'), 800),
  ];
  const lift = easeInOut(ramp(t, beat(S.eleph, 'carved'), 1400));
  const rowOut = easeInOut(ramp(t, beat(S.abstract, 'lands'), 1100));
  const riderIn = ramp(t, beat(S.eleph, 'rider'), 900);

  // --- s03 / s04: the animal comes apart
  const pil = ramp(t, beat(S.eleph, 'peel'), 700);
  const alfil = ramp(t, beat(S.eleph, 'feel'), 700);
  const bodyOut = lerp(1, 0.24, easeInOut(ramp(t, beat(S.abstract, 'carver'), 1800)));
  const tuskM = easeInOut(ramp(t, beat(S.abstract, 'tusks'), 2200));

  // --- s05 / s06 / s07: the block, and what Europe made of it
  const blockIn = ramp(t, beat(S.block, 'block'), 1300);
  const relic = ramp(t, beat(S.block, 'points'), 1200);
  const cards = ramp(t, beat(S.block, 'deck'), 900)
    * (1 - easeInOut(ramp(t, shotStart(S.europe) + 400, 900)));
  const bm = easeInOut(ramp(t, beat(S.europe, 'guesses'), 3200));
  const england = ramp(t, beat(S.europe, 'england'), 800);
  const france = ramp(t, beat(S.europe, 'france'), 800);
  const russia = ramp(t, beat(S.reveal, 'elephant'), 900);

  let page = '';

  // ---- the four arms, in a row across the top
  // While the row is the only thing on the page it sits in the middle of it and
  // is large; it rises and shrinks into a header the moment the elephant is
  // lifted out, which is the only point at which the page needs the room.
  const rowY = lerp(650, 388, lift);
  const rowS = lerp(0.78, 0.5, lift);
  if (rowOut < 0.995) {
    const o = 1 - rowOut;
    page += ghost(text('India', { x: 960, y: lerp(300, 214, lift), size: 46, color: RED, p: indiaIn }), o);
    page += ghost(place(soldier(cue[0], { w: 4 }), ARMY_X[0], rowY, rowS * 1.24), o);
    page += ghost(place(horse(cue[1], { w: 4 }), ARMY_X[1], rowY, rowS * 1.12), o);
    page += ghost(place(chariot(cue[2], { w: 4 })
      + rookPiece(cue[2], 0, 0, { w: 4 }), ARMY_X[2], rowY, rowS * 1.04), o);
    page += ghost(place(elephant(cue[3], { w: 4 }), ARMY_X[3], rowY, rowS), o * (1 - lift));
  }

  // ---- the elephant, lifted out of the row and taken apart
  // twoColumn, by hand: alone on the page the animal is large and central, and
  // it moves aside and settles smaller only when the block turns up beside it.
  // The animal steps aside on the same beat its tusks set off the other way —
  // tying this to the block instead left the tusks crossing the elephant's own
  // body for two seconds, reading as a smudge rather than as a journey.
  const settle = easeInOut(clamp01(Math.max(tuskM, blockIn * 1.3)));
  const ex = lerp(ARMY_X[3], lerp(892, SOURCE_X, settle), lift);
  const ey = lerp(rowY, BASE, lift);
  const es = lerp(rowS, lerp(1.36, 1.16, settle), lift);
  if (lift > 0.005) page += place(elephant(1, { body: clamp01(bodyOut * (1 + russia * 1.4)) }), ex, ey, es);
  // The tusks are the one part that survives, so they have to carry across the
  // page as one object: the anchors morph into the block's two nubs while the
  // group travels to where the block will stand. Redrawing them at the far side
  // would be a cut, and a cut is exactly the claim this shot has to avoid.
  if (tuskM > 0.002 || lift > 0.005) {
    page += ghost(place(tusks(1, tuskM), lerp(ex, MARK_X, tuskM), lerp(ey, BASE, tuskM),
      lerp(es, 1.16, tuskM)), 1 - clamp01(blockIn * 3 - 2));
  }
  if (pil > 0.01) {
    page += ghost(text('pil', { x: SOURCE_X, y: 918, size: 56, color: RED, p: pil })
      + text('al fil', { x: SOURCE_X, y: 918, size: 56, color: RED, p: alfil }), clamp01(1 - alfil + pil * 0));
  }
  if (alfil > 0.01) page += text('al fil', { x: SOURCE_X, y: 918, size: 56, color: RED, p: alfil });

  // ---- the block, with the tusks already sitting on top of it as its points
  if (blockIn > 0.01) {
    const drawn = clamp01(blockIn * 1.6);
    page += place(bishopPiece(drawn, Math.max(0, blockIn * 1.7 - 0.7), bm), MARK_X, BASE, 1.16);
  }
  // §7: the animal is already still there — it only has to be tied to what it
  // turned into, and to come back up when Russia turns out to be the one that
  // never stopped calling it that.
  if (relic > 0.01) {
    page += tie(SOURCE_X + 118, BASE - 132, MARK_X - 112, BASE - 132, relic,
      { color: russia > 0.02 ? GREEN : INK_SOFT });
  }
  if (russia > 0.01) {
    page += text('Russia', { x: 782, y: BASE - 168, size: 38, color: GREEN, p: russia });
  }

  // ---- the aside about a deck of cards
  if (cards > 0.01) {
    const cx = 1590, cy = 760;
    const card = new P().M(cx - 54, cy - 78).L(cx + 54, cy - 74).L(cx + 50, cy + 78).L(cx - 58, cy + 74).Z();
    page += ghost(ink(card, cards, { w: 4, color: INK_SOFT })
      + ink(new P().M(cx - 34, cy - 44).L(cx + 34, cy - 40), Math.max(0, cards * 1.8 - 0.8), { w: 3, color: INK_SOFT })
      + ink(new P().M(cx - 32, cy + 44).L(cx + 36, cy + 48), Math.max(0, cards * 2 - 1), { w: 3, color: INK_SOFT }),
    cards * 0.42);
  }

  // ---- what each country decided the two points were
  if (england > 0.01) {
    page += text('England: a bishop', { x: 1452, y: 402, size: 40, color: RED, p: england })
      + tie(1402, 388, MARK_X + 86, BASE - 268, england, { color: RED });
  }
  if (france > 0.01) {
    page += text('France: le fou', { x: 1462, y: 472, size: 40, color: RED, p: france })
      + text('the jester', { x: 1462, y: 522, size: 32, color: INK_SOFT, p: Math.max(0, france * 1.4 - 0.4) });
  }
  return page;
}

// ---------------------------------------------------------------- stage C
/** The chariot goes the same way, and the one piece that never had to. */
function stageChariot(t) {
  const drawn = ramp(t, beat(S.chariot, 'chariot'), 1500);
  const restOut = lerp(1, 0.26, easeInOut(ramp(t, beat(S.chariot, 'gone'), 1400)));
  const toBlock = easeInOut(ramp(t, beat(S.chariot, 'notch'), 1800));
  const wallIn = ramp(t, beat(S.chariot, 'italian'), 1200);
  const toTower = easeInOut(ramp(t, beat(S.rook, 'castle'), 2400));
  const relic = ramp(t, beat(S.chariot, 'notch', 1), 1200);
  const castle = ramp(t, beat(S.rook, 'board'), 800);
  const persian = ramp(t, beat(S.rook, 'rook'), 800);

  const horseIn = ramp(t, beat(S.horse, 'horse'), 1200);
  const knightIn = ramp(t, beat(S.horse, 'language'), 1200);
  const sameIn = ramp(t, beat(S.horse, 'guess'), 800);
  const namesOut = easeInOut(ramp(t, beat(S.horse, 'changed'), 900));

  // While the chariot is alone it holds the middle of the page; it settles left
  // as the mark it became arrives beside it.
  const cx = 596, cs = 1.2;

  // The basket is the piece. It squeezes into the block and walks on into the
  // tower as one object, travelling from where the chariot stood to where the
  // mark ends up; the wheel and the pole simply do not come.
  let page = place(chariot(drawn, { rest: restOut }), cx, BASE, cs);
  const travel = easeInOut(toBlock);
  // The basket is a drawing while it is still a chariot and only floods solid
  // as it becomes the carved block, which is the same rule the elephant obeys.
  page += place(rookPiece(drawn, clamp01(toBlock * 1.5), toBlock + toTower),
    lerp(cx, MARK_X, travel), BASE, lerp(cs, 1.16, travel));
  // the basket left, so the ghost has to put one back — otherwise the cart is a
  // wheel and a pole with a hole in the middle of it
  if (relic > 0.01) {
    page += ghost(place(rookPiece(1, 0, 0, { w: 5, color: INK_SOFT }), cx, BASE, cs), relic * 0.3)
      + tie(cx + 186, BASE - 150, MARK_X - 116, BASE - 150, relic);
  }
  if (wallIn > 0.01 && toTower < 0.92) {
    page += ghost(place(wall(wallIn), 1040, 420, 1.12), wallIn * 0.55 * (1 - toTower));
  }
  if (castle > 0.01) {
    page += text('a castle', { x: MARK_X, y: 918, size: 50, color: RED, p: clamp01(castle - persian) })
      + text('rook  =  chariot', { x: MARK_X, y: 918, size: 50, color: RED, p: persian });
  }

  // The same beat the elephant got: everyone looked at the same block and named
  // something different, and the screen carries the list the voice does not.
  if (castle > 0.01 && namesOut < 0.995) {
    const o = 1 - namesOut;
    ['Italy: torre', 'France: la tour', 'Germany: der Turm'].forEach((s2, i) => {
      page += ghost(text(s2, { x: 1486, y: 300 + i * 62, size: 38, color: RED, p: clamp01(castle * 1.6 - i * 0.3) }), o);
    });
    page += ghost(text('England: rook', { x: 1486, y: 512, size: 42, color: GREEN, p: persian }), o);
  }

  // ---- the piece nobody had to guess at
  if (horseIn > 0.01) {
    const hx = 1512;
    page += place(horse(horseIn, { w: 5, solid: 0 }), hx, 470, 0.5);
    if (knightIn > 0.01) {
      page += tie(hx, 498, hx, 600, knightIn)
        + place(knightPiece(knightIn, Math.max(0, knightIn * 1.7 - 0.7), { w: 5 }), hx, 856, 0.54);
    }
    if (sameIn > 0.01) page += text('the same piece', { x: hx, y: 914, size: 34, color: GREEN, p: sameIn });
  }
  return page;
}

// ---------------------------------------------------------------- stage D
/** The turn: the pieces came across intact, and one of the names did not. */
function stageQueen(t) {
  const crossed = ramp(t, beat(S.turn, 'pieces'), 1000);
  const struck = ramp(t, beat(S.turn, 'meanings'), 900);
  // the board is page furniture, not a beat — it can be ruled while the voice
  // is still on the sentence before the one that needs it
  const boardIn = ramp(t, beat(S.turn, 'crossed'), 2200);
  const kingIn = ramp(t, beat(S.turn, 'king'), 800);
  const ferzIn = ramp(t, beat(S.turn, 'counselor'), 1000);
  const named = ramp(t, beat(S.turn, 'counselor'), 1200);
  const notQueen = ramp(t, beat(S.turn, 'queen'), 700);
  const crossOut = easeInOut(ramp(t, beat(S.vizier, 'weakest'), 1100));

  const step = ramp(t, beat(S.vizier, 'diagonally'), 1200);
  const weak = ramp(t, beat(S.vizier, 'years'), 900);
  const qm = easeInOut(ramp(t, beat(S.vizier, 'queens'), 1600));
  const crowned = ramp(t, beat(S.queen, 'valencia'), 900);
  const rays = ramp(t, beat(S.queen, 'gave'), 2600);
  const lineA = ramp(t, beat(S.queen, 'chariots'), 800);
  const lineB = ramp(t, beat(S.queen, 'elephants'), 800);

  let page = board(boardIn);

  // ---- "the pieces crossed intact. the meanings did not."
  // The three marks the film has already built, with the thing each one still
  // is written underneath, and then a line drawn through every one of those
  // words. This is the argument of the turn, and it also stops the page being
  // a board in one corner of an empty sheet for the first six seconds.
  if (crossed > 0.01 && crossOut < 0.995) {
    const o = 1 - crossOut;
    const row = [
      { draw: (p) => bishopPiece(p, Math.max(0, p * 1.7 - 0.7), 1, { w: 5 }), was: 'elephant', x: 400 },
      { draw: (p) => rookPiece(p, Math.max(0, p * 1.7 - 0.7), 2, { w: 5 }), was: 'chariot', x: 648 },
      { draw: (p) => knightPiece(p, Math.max(0, p * 1.7 - 0.7), { w: 5 }), was: 'horse', x: 896 },
    ];
    row.forEach((it, i) => {
      const p = clamp01(crossed * 1.7 - i * 0.22);
      const st = clamp01(struck * 1.8 - i * 0.24);
      page += ghost(place(it.draw(p), it.x, 452, 0.52)
        + text(it.was, { x: it.x, y: 516, size: 38, color: GREEN, p })
        + ink(new P().M(it.x - 84, 502).L(it.x + 84, 502), st, { w: 4, color: RED }), o);
    });
  }

  // the piece itself, large, on the left
  if (ferzIn > 0.01) {
    page += place(queenPiece(ferzIn, Math.max(0, ferzIn * 1.7 - 0.7), qm), 588, BASE, 1.28);
    if (named > 0.01) {
      page += text('the vizier', { x: 588, y: 918, size: 52, color: RED, p: clamp01(named - qm * 2) })
        + text('the queen', { x: 588, y: 918, size: 52, color: RED, p: clamp01(qm * 2 - 1) });
    }
    // §7: the piece it was stays on the page beside what it became.
    if (qm > 0.02) {
      page += ghost(place(queenPiece(1, 1, 0, { w: 5, color: INK_SOFT }), 300, BASE, 1.1), qm * 0.3)
        + tie(360, BASE - 96, 500, BASE - 96, qm)
        + ghost(text('the vizier', { x: 300, y: 918, size: 38, color: INK_SOFT, p: qm }), qm * 0.7);
    }
    if (crowned > 0.01) {
      page += text('Valencia, 1475', { x: 588, y: 380, size: 42, color: GREEN, p: crowned })
        + text('mad queen’s chess', { x: 588, y: 434, size: 34, color: INK_SOFT, p: Math.max(0, crowned * 1.4 - 0.4) });
    }
  }
  if (notQueen > 0.01 && qm < 0.5) {
    page += ghost(text('not a queen', { x: 588, y: 594, size: 40, color: INK_SOFT, p: notQueen }), 1 - qm * 2);
  }
  if (weak > 0.01 && qm < 0.5) {
    page += ghost(text('one square, and nothing else', { x: 1394, y: 1000, size: 34, color: INK_SOFT, p: weak }),
      1 - qm * 2);
  }

  // the board beside it: the king, the piece next to him, and what it could do
  if (kingIn > 0.01) page += place(kingPiece(kingIn, Math.max(0, kingIn * 1.8 - 0.8)), ...sq(2, 3), 0.24);
  if (ferzIn > 0.01) {
    page += place(queenPiece(ferzIn, Math.max(0, ferzIn * 1.8 - 0.8), qm), ...sq(3, 3), 0.24);
  }
  if (step > 0.01 && rays < 0.02) {
    const d = [[2, 2], [4, 2], [2, 4], [4, 4]];
    d.forEach(([c, r], i) => { page += move(3, 3, c, r, clamp01(step * 1.6 - i * 0.12)); });
  }
  if (rays > 0.01) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    dirs.forEach(([dc, dr], i) => {
      const straight = dc === 0 || dr === 0;
      const gate = straight ? lineA : lineB;
      if (gate <= 0.01) return;
      let c = 3, r = 3;
      while (c + dc >= 0 && c + dc < BN && r + dr >= 0 && r + dr < BN) { c += dc; r += dr; }
      page += move(3, 3, c, r, clamp01(Math.min(rays, gate) * 1.5 - i * 0.04), straight ? BLUE : RED);
    });
  }
  return page;
}

// ---------------------------------------------------------------- stage E
// §8: the whole row goes down first, then each mark and name lands on its cue.
const RECAP = [
  { name: 'pawn', x: 400 },
  { name: 'knight', x: 690 },
  { name: 'rook', x: 980 },
  { name: 'bishop', x: 1270 },
  { name: 'queen', x: 1560 },
];
// A source is always the drawing, never the carved object — that is the only
// thing separating the two rows of the recap from being one row of pieces.
function recapSource(i, p) {
  if (i === 0) return place(soldier(p, { w: 4 }), RECAP[0].x, 440, 0.52);
  if (i === 1) return place(horse(p, { w: 4 }), RECAP[1].x, 440, 0.44);
  if (i === 2) return place(chariot(p, { w: 4 }) + rookPiece(p, 0, 0, { w: 4 }), RECAP[2].x, 440, 0.42);
  if (i === 3) return place(elephant(p, { w: 4 }), RECAP[3].x, 440, 0.42);
  return place(queenPiece(p, 0, 0, { w: 4 }), RECAP[4].x, 440, 0.54);
}
function recapMark(i, p) {
  const f = Math.max(0, p * 1.7 - 0.7);
  if (i === 0) return place(carve(PAWN, p, f, { w: 5 }), RECAP[0].x, 876, 0.5);
  if (i === 1) return place(knightPiece(p, f, { w: 5 }), RECAP[1].x, 876, 0.5);
  if (i === 2) return place(rookPiece(p, f, 2, { w: 5 }), RECAP[2].x, 876, 0.5);
  if (i === 3) return place(bishopPiece(p, f, 1, { w: 5 }), RECAP[3].x, 876, 0.5);
  return place(queenPiece(p, f, 1, { w: 5 }), RECAP[4].x, 876, 0.5);
}
function stageRecap(t) {
  const open = beat(S.recap, 'nothing');
  const cues = ['soldier', 'horse', 'chariot', 'elephant', 'crown'].map(w => beat(S.recap, w));
  return RECAP.map((item, i) => {
    const drew = ramp(t, open + i * 260, 800);
    const p = ramp(t, cues[i], 700);
    return ghost(recapSource(i, drew), 0.5 + 0.5 * p)
      + ink(new P().M(item.x, 476).L(item.x, 700), p, { w: 3, color: INK_SOFT, dash: '11 10' })
      + recapMark(i, p)
      + text(item.name, { x: item.x, y: 944, size: 36, color: RED, p: clamp01(p * 1.4 - 0.4) });
  }).join('');
}

// ---------------------------------------------------------------- stage F
function stageClose(t) {
  const marks = ramp(t, beat(S.close, 'never'), 1100);
  const army = ramp(t, beat(S.close, 'army'), 1200);
  const gone = ramp(t, beat(S.close, 'kingdom'), 1000);
  const sign = ramp(t, beat(S.close, 'down'), 900);
  const xs = [400, 690, 980, 1270, 1560];
  return xs.map((x, i) => {
    const p = clamp01(marks * 1.7 - i * 0.14);
    const f = Math.max(0, p * 1.7 - 0.7);
    const piece = i === 0 ? carve(PAWN, p, f, { w: 6 })
      : i === 1 ? knightPiece(p, f, { w: 6 })
        : i === 2 ? rookPiece(p, f, 2, { w: 6 })
          : i === 3 ? bishopPiece(p, f, 1, { w: 6 })
            : queenPiece(p, f, 1, { w: 6 });
    const src = clamp01(army * 1.6 - i * 0.12) * (1 - gone * 0.72);
    return ghost(recapSource(i, clamp01(army * 1.6 - i * 0.12)), src * 0.46)
      + place(piece, x, 812, 0.62);
  }).join('')
    + ink(new P().M(320, 830).L(1640, 830), clamp01(marks * 1.4), { w: 2.6, color: INK_SOFT, opacity: 0.6 })
    + text('Not Arbitrary', { x: 960, y: 946, size: 58, color: RED, p: sign });
}

/** The anchor rings, exported so a lib/glyph.mjs strip can lay a morph out. */
export const RINGS = {
  ELEPHANT, ALFIL, BISHOP, TUSK_NEAR, TUSK_FAR, NUB_R, NUB_L,
  CHARIOT_BODY, ROOK_BLOCK, TOWER, HORSE, KNIGHT, VIZIER, QUEEN, PAWN,
};

// ----------------------------------------------------------------- schedule
const EDGES = [S.army, S.chariot, S.turn, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.army) - 260) return stageOpen(t);
  if (t < shotStart(S.chariot) - 260) return stageArmy(t);
  if (t < shotStart(S.turn) - 260) return stageChariot(t);
  if (t < shotStart(S.recap) - 260) return stageQueen(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
