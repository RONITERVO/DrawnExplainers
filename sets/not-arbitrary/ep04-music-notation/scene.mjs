// Not Arbitrary, episode 4 — the marks at the head of a stave.
//
// Every morph in this film is one pen stroke that never lifts. So instead of
// hand-placing bezier controls per shape, each mark is a list of ANCHORS and
// the controls are derived (Catmull-Rom). Two marks that share an anchor count
// can then be lerped anchor-for-anchor and the in-between is always a single
// connected stroke — which is the whole claim: the letter did not turn into a
// symbol, it kept going.
//
//   G -> treble clef : anchors 0-4 are the letter's crossbar tightening into
//                      the spiral eye; 5-10 the bowl opening into the belly and
//                      the loop; 11-15 the letter's short right-hand terminal,
//                      the only part that grows — it straightens into the spine
//                      and runs on below the stave as the tail.
//   F -> bass clef   : the top arm and the upright are one stroke that rolls
//                      into the curl. The middle arm is a second stroke and it
//                      fades — element subtraction, not a cross-fade. The two
//                      dots are new marks placed on the line, NOT the arms.
//                      The sourced account is that a scribe flanked the line to
//                      make it unmistakable, and this film claims no more.
//   b -> flat        : arc tension. The round bowl's widest point rides up and
//                      its lower join pulls to a point. Barely a change, which
//                      is the point of that shot.
//   b -> square b -> natural -> sharp : one parameter walked along four states.
//                      The four sides let out past their corners; the letter's
//                      ascender IS the left vertical, so the mark never splits
//                      and nothing is ever bolted on.

import {
  P, ink, fill, text, createFilm,
  ramp, easeInOut, lerp, clamp01,
  INK, INK_SOFT, RED, GOLD, GREEN,
} from '../../../lib/scene-kit.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  open: 's01.opening', stave: 's02.stave', letters: 's03.letters', clavis: 's04.clavis',
  gdraw: 's05.gdraw', gmorph: 's06.gmorph', greveal: 's07.greveal', fclef: 's08.fclef',
  turn: 's09.turn', roundb: 's10.roundb', flat: 's11.flat', squareb: 's12.squareb',
  sharp: 's13.sharp', recap: 's14.recap', close: 's15.closing',
};

// ------------------------------------------------------------------ layout
const WORK_X = 960, WORK_Y = 290;
const STAVE_X0 = 300, STAVE_X1 = 1640, SP = 30;
// While there is one stave it holds the middle of the page. When the second is
// ruled underneath it, the first slides up to make room — RISE is how far.
const US = 620;                 // upper stave, middle line
const LS = 720;                 // lower stave, middle line
const RISE = 120;
const lineY = (cy, i) => cy + (i - 2) * SP;   // i = 0 top .. 4 bottom
const G_LINE = lineY(US, 3);
const F_LINE_U = lineY(US, 1);  // the red line, while it is still up here
const F_LINE_L = lineY(LS, 1);  // and after the second stave arrives
const HEAD_X = 350;
const CLEF_X = 470;

const place = (inner, x, y, s) =>
  `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})">${inner}</g>`;

const ghost = (inner, o) => (o <= 0.005 ? '' : `<g opacity="${o.toFixed(3)}">${inner}</g>`);

// ------------------------------------------------------- anchors -> stroke
/**
 * Catmull-Rom through the anchors, emitted as cubics so P.len() stays exact —
 * stroke-dashoffset draw-on needs a real length. Tension under 1 tightens the
 * corners, which is what stops a quill's join from ballooning.
 */
function smooth(pts, tension = 0.86) {
  const p = new P().M(pts[0][0], pts[0][1]);
  const n = pts.length;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, n - 1)];
    const k = tension / 6;
    p.C(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  return p;
}

const blend = (a, b, m) => a.map((pt, i) => [lerp(pt[0], b[i][0], m), lerp(pt[1], b[i][1], m)]);
const morph = (a, b, m, tension) => smooth(blend(a, b, m), tension);

/** Walk one shape along a list of states. x runs 0 .. states.length - 1. */
function along(states, x) {
  const n = states.length - 1;
  const u = clamp01(x / n) * n;
  const i = Math.min(Math.floor(u), n - 1);
  return blend(states[i], states[i + 1], u - i);
}

// ------------------------------------------------------------ G and clef
// 0-4 the letter's inner terminal becoming the eye and the first turn of the
// spiral; 5-10 the bowl opening out into the belly and the left bulge; 11-15
// the letter's short right-hand terminal, which is the only part that grows —
// straightening into the spine and running on below the stave as the tail.
const LETTER_G = [
  [  6,  18], [ 34,  18], [ 58,  22], [ 74,  42], [ 74,  66], [ 40,  92],
  [-16,  98], [-66,  66], [-88,   4], [-72, -60], [-22, -92], [ 34, -82],
  [ 66, -60], [ 82, -38], [ 86, -24], [ 84, -14],
];
const TREBLE = [
  [-10,   4], [ -2,  16], [-16,  24], [-28,  10], [-16, -12], [ 38, -44],
  [ 60,  18], [ 12,  66], [-56,  18], [-44, -66], [ -4,-166], [ 24,-138],
  [ 20, -34], [ 24,  70], [ 10, 138], [-26, 132],
];
const gStroke = (p, m, { w = 9, color = INK } = {}) =>
  ink(morph(LETTER_G, TREBLE, m), p, { w, color });

// ------------------------------------------------------------ F and clef
const LETTER_F = [
  [ 60, -96], [ 30, -98], [  2,-100], [-28,-100], [-36, -86],
  [-36, -44], [-36,   4], [-36,  52], [-36, 100],
];
const BASS = [
  [ 26,   4], [ 54,  -8], [ 36, -38], [ -2, -36], [-22,  -4],
  [-18,  36], [-30,  74], [-40, 104], [-70, 112],
];
const DOT_DY = 22;
const F_ARM = new P().M(-36, -18).L(30, -22);
const bassDot = (dy) => {
  const x = 80, r = 12, k = 0.5523 * r;
  return new P().M(x, dy - r)
    .C(x + k, dy - r, x + r, dy - k, x + r, dy)
    .C(x + r, dy + k, x + k, dy + r, x, dy + r)
    .C(x - k, dy + r, x - r, dy + k, x - r, dy)
    .C(x - r, dy - k, x - k, dy - r, x, dy - r).Z();
};
const fStroke = (p, m, { w = 9, color = INK, arm = 1 } = {}) =>
  ink(morph(LETTER_F, BASS, m), p, { w, color })
  + (arm > 0.01 ? ink(F_ARM, Math.min(1, p * 1.6), { w, color, opacity: arm }) : '');

// ------------------------------------------------------------ b and flat
// The stem is one stroke; the bowl is another that begins and ends on it, so
// the union is one connected mark at every value of m.
const bStem = (m) => new P().M(-32, lerp(-152, -134, m)).L(-32, 66);
const BOWL_ROUND = [[-32, -6], [ 10, -18], [ 44,   6], [ 46, 38], [ 18, 60], [-32, 66]];
const BOWL_FLAT = [[-32, -24], [  8, -30], [ 34, -10], [ 26, 22], [  0, 48], [-32, 66]];
const roundB = (p, m, { w = 9, color = INK } = {}) =>
  ink(bStem(m), p, { w, color })
  + ink(morph(BOWL_ROUND, BOWL_FLAT, m), Math.max(0, p * 1.5 - 0.5), { w, color });

// -------------------------------------------------- round b -> ... -> sharp
// Four elements, each a three-anchor stroke so it can bow, walked along four
// states. Every element keeps its direction across all four, which is what
// stops a side from flipping through itself mid-morph.
const HARD = {
  stem: [
    [[-32, -152], [-32, -43], [-32,  66]],   // the letter's whole ascender
    [[-32, -152], [-32, -43], [-32,  66]],
    [[-18,  -66], [-18, -20], [-18,  26]],
    [[-18,  -70], [-18, -10], [-18,  50]],
  ],
  top: [
    [[-32,   -6], [ 10, -18], [ 44,   6]],
    [[-32,   -6], [  1,  -6], [ 34,  -6]],
    [[-18,  -20], [  1, -25], [ 20, -30]],
    [[-46,  -14], [  1, -22], [ 48, -30]],
  ],
  right: [
    [[ 44,    6], [ 49,  26], [ 44,  46]],
    [[ 34,   -6], [ 34,  23], [ 34,  52]],
    [[ 20,  -30], [ 20,  18], [ 20,  66]],
    [[ 20,  -50], [ 20,  10], [ 20,  70]],
  ],
  bot: [
    [[-32,   66], [ 16,  62], [ 44,  46]],
    [[-32,   52], [  1,  52], [ 34,  52]],
    [[-18,   26], [  1,  21], [ 20,  16]],
    [[-46,   32], [  1,  24], [ 48,  16]],
  ],
};
/** x: 0 round b, 1 square b, 2 natural, 3 sharp. */
function hardB(p, x, { w = 9, color = INK } = {}) {
  const tension = lerp(0.86, 0.1, clamp01(x));
  const el = (k, q) => ink(smooth(along(HARD[k], x), tension), q, { w, color });
  return el('stem', p)
    + el('top', Math.max(0, p * 1.7 - 0.7))
    + el('right', Math.max(0, p * 2 - 1))
    + el('bot', Math.max(0, p * 2.4 - 1.4));
}

// ---------------------------------------------------------------- the page
function stave(cy, p, { red = 0, gold = 0, redLine = 1, goldLine = 3 } = {}) {
  let out = '';
  for (let i = 0; i < 5; i += 1) {
    const y = lineY(cy, i);
    const q = clamp01(p * 1.6 - i * 0.11);
    const tint = i === redLine ? red : i === goldLine ? gold : 0;
    out += ink(new P().M(STAVE_X0, y).L(STAVE_X1, y), q, { w: 3, color: INK_SOFT, opacity: 0.92 });
    if (tint > 0.01) {
      out += ink(new P().M(STAVE_X0, y).L(STAVE_X1, y), q,
        { w: 4.2, color: i === redLine ? RED : GOLD, opacity: tint * 0.9 });
    }
  }
  return out;
}

const noteHead = (x, y, p, { r = 13, color = INK } = {}) => {
  const k = 0.5523, ry = r * 0.72;
  const e = new P().M(x, y - ry)
    .C(x + r * k, y - ry, x + r, y - ry * k, x + r, y)
    .C(x + r, y + ry * k, x + r * k, y + ry, x, y + ry)
    .C(x - r * k, y + ry, x - r, y + ry * k, x - r, y)
    .C(x - r, y - ry * k, x - r * k, y - ry, x, y - ry).Z();
  return `<g transform="rotate(-16 ${x} ${y})">${fill(e, p, { color })}</g>`;
};

/** A word of plainsong text, as a hand sees it from across a room. */
function scribbleWord(x, y, w, p) {
  let out = '';
  const n = Math.max(2, Math.round(w / 30));
  for (let i = 0; i < n; i += 1) {
    const cx = x + i * (w / n);
    const q = clamp01(p * 2 - i * 0.04);
    out += ink(new P().M(cx, y).Q(cx + 9, y - 17, cx + 19, y), q, { w: 4.4, color: INK_SOFT, opacity: 0.8 });
  }
  return out;
}

/** A neume: the shape of a melody, drawn in the air over the words. */
function neume(x, y, p, kind) {
  const s = new P().M(x, y);
  if (kind === 0) s.Q(x + 12, y - 26, x + 26, y - 8);
  else if (kind === 1) s.Q(x + 10, y + 18, x + 22, y - 14).Q(x + 30, y - 28, x + 38, y - 6);
  else s.Q(x + 14, y - 20, x + 20, y + 6).Q(x + 26, y + 18, x + 34, y - 4);
  return ink(s, p, { w: 4, color: INK_SOFT });
}

const tie = (x0, x1, y, p, color = INK_SOFT, w = 3) =>
  ink(new P().M(x0, y).L(x1, y), p, { w, color, dash: '12 10', opacity: 0.85 });

const link = (x0, y0, x1, y1, p, color = INK_SOFT) =>
  ink(new P().M(x0, y0).L(x1, y1), p, { w: 3, color, dash: '12 10', opacity: 0.7 });

// ---------------------------------------------------------------- stage A
/** The hook. One mark, large, and nine hundred copies of it behind. */
function stageOpen(t) {
  const drawn = ramp(t, beat(S.open, 'curl'), 1900);
  const copies = ramp(t, beat(S.open, '900'), 1500);
  let back = '';
  for (let i = 0; i < 6; i += 1) {
    const q = clamp01(copies * 2.2 - i * 0.24);
    if (q <= 0.01) continue;
    const dx = (i - 2.5) * 52;
    const rot = (i - 2.5) * 2.8;
    back += ghost(`<g transform="rotate(${rot.toFixed(2)} ${WORK_X} 520)">`
      + place(gStroke(1, 1, { w: 8, color: INK_SOFT }), WORK_X + dx, 520, 1.34) + '</g>', q * 0.15);
  }
  return back + place(gStroke(drawn, 1, { w: 11 }), WORK_X, 520, 1.44);
}

// ---------------------------------------------------------------- stage B
/**
 * s02 to s09 on one page: the stave is ruled, the key letters are put at the
 * head of two lines, and both are then walked into the marks they became.
 * One page evolving, rather than eight slides.
 */
function stageStave(t) {
  // --- s02: what a scribe had before the stave, and then the stave
  const wordsIn = ramp(t, beat(S.stave, 'scribe'), 1100);
  const neumesIn = ramp(t, beat(S.stave, 'melody'), 1200);
  const rise = ramp(t, beat(S.stave, 'up'), 700);
  const query = ramp(t, beat(S.stave, 'far'), 700);
  const oldOut = easeInOut(ramp(t, beat(S.stave, 'ruled'), 900));
  const staveIn = ramp(t, beat(S.stave, 'ruled') + 200, 1500);

  // --- s03 / s04: the key letters
  const fIn = ramp(t, beat(S.letters, 'letter'), 900);
  const redIn = ramp(t, beat(S.letters, 'red'), 800);
  const goldIn = ramp(t, beat(S.letters, 'yellow'), 800);
  const cIn = ramp(t, beat(S.letters, 'yellow') - 300, 900);
  const latin = ramp(t, beat(S.clavis, 'literae'), 700);
  const clefWord = ramp(t, beat(S.clavis, 'clef'), 700);
  const latinOut = easeInOut(ramp(t, shotStart(S.gdraw) + 300, 900));

  // --- s05 / s06 / s07: the G
  const gAt = beat(S.gdraw, 'capital');
  const gIn = ramp(t, gAt, 900);
  const cOut = easeInOut(ramp(t, gAt - 400, 900));
  const climb = ramp(t, beat(S.gdraw, 'climbing'), 1400);
  const lift = easeInOut(ramp(t, beat(S.gmorph, 'wrote'), 1200));
  const stack = ramp(t, beat(S.gmorph, 'times'), 1500);
  const gm = easeInOut(ramp(t, beat(S.gmorph, 'lifting'), 5400));
  const seat = easeInOut(ramp(t, beat(S.greveal, 'winds'), 1500));
  const named = ramp(t, beat(S.greveal, 'name'), 800);

  // --- s08: the F
  const fLift = easeInOut(ramp(t, beat(S.fclef, 'letter'), 1200));
  const lowIn = ramp(t, beat(S.fclef, 'red'), 1400);
  const redMove = easeInOut(ramp(t, beat(S.fclef, 'red'), 1000));
  const fm = easeInOut(ramp(t, beat(S.fclef, 'unrecognizable') + 500, 2600));
  const armOut = 1 - easeInOut(ramp(t, beat(S.fclef, 'arms'), 900));
  const fSeat = easeInOut(ramp(t, beat(S.fclef, 'replaced'), 1300));
  const dot1 = ramp(t, beat(S.fclef, 'dot'), 500);
  const dot2 = ramp(t, beat(S.fclef, 'dot', 1), 500);
  const noMistake = ramp(t, beat(S.fclef, 'mistake'), 700);

  // --- s09: the turn
  const marks = ramp(t, beat(S.turn, 'marks'), 700);
  const accIn = ramp(t, beat(S.turn, 'play'), 900);
  const sameIn = ramp(t, beat(S.turn, 'same'), 900);

  // The upper stave holds the middle of the page while it is alone, and slides
  // up to make room the moment the second one is ruled underneath it.
  const dy = -RISE * easeInOut(lowIn);
  const UY = US + dy;
  const GY = G_LINE + dy;
  const FYU = F_LINE_U + dy;
  const bandY = lineY(UY, 0) - 48;

  let page = stave(UY, staveIn, { red: clamp01(redIn - redMove), gold: clamp01(goldIn - cOut) })
    + (lowIn > 0.01 ? stave(LS, lowIn, { red: redMove }) : '');

  // ---- what a scribe had before the stave, drawn where the stave will be
  if (oldOut < 0.995) {
    const o = 1 - oldOut;
    for (let i = 0; i < 6; i += 1) {
      page += ghost(scribbleWord(470 + i * 162, 662, 122, wordsIn), o);
      page += ghost(place(neume(0, 0, clamp01(neumesIn * 1.8 - i * 0.13), i % 3),
        478 + i * 162, 592 - i * 12, 1.7), o);
    }
    page += ghost(ink(new P().M(1418, 600).L(1462, 536), rise, { w: 3.8, color: RED })
      + ink(new P().M(1438, 536).L(1462, 536).L(1462, 562), Math.max(0, rise * 2 - 1), { w: 3.8, color: RED }), o);
    page += ghost(text('?', { x: 1540, y: 604, size: 84, color: RED, p: query }), o);
  }

  // ---- notes climbing off the top of the stave, s05
  if (climb > 0.01 && cOut < 0.995) {
    for (let i = 0; i < 6; i += 1) {
      page += ghost(noteHead(880 + i * 88, lineY(UY, 4) - i * 56, clamp01(climb * 2.4 - i * 0.3),
        { color: INK_SOFT }), 1 - cOut);
    }
  }

  // ---- the letter C, only ever a bystander
  if (cIn > 0.01 && cOut < 0.995) {
    const cPath = smooth([[26, -30], [4, -40], [-24, -22], [-24, 22], [4, 40], [26, 30]]);
    page += ghost(place(ink(cPath, cIn, { w: 9, color: GOLD }), HEAD_X, lineY(UY, 3), 0.62), 1 - cOut);
  }

  // ---- the letter G, wherever it currently is
  if (gIn > 0.01) {
    const gx = lerp(lerp(HEAD_X, WORK_X, lift), CLEF_X, seat);
    const gy = lerp(lerp(GY, WORK_Y, lift), GY, seat);
    const gs = lerp(lerp(0.32, lerp(1.72, 1.00, gm), lift), 0.68, seat);
    if (stack > 0.01 && seat < 0.6) {
      for (let i = 0; i < 5; i += 1) {
        page += ghost(place(gStroke(1, gm, { w: 8, color: INK_SOFT }),
          gx + (i - 2) * 44, gy + (i - 2) * 10, gs),
        clamp01(stack * 2.2 - i * 0.26) * 0.17 * (1 - seat));
      }
    }
    page += place(gStroke(gIn, gm, { w: lerp(9, 6.6, seat) }), gx, gy, gs);
  }
  // The letter it came from stays on the page behind it, copied and copied, so
  // the reveal is not one mark alone on an empty sheet.
  const gRelic = seat * (1 - easeInOut(ramp(t, beat(S.fclef, 'letter') - 500, 900)));
  if (gRelic > 0.01) {
    for (let i = 0; i < 5; i += 1) {
      page += ghost(place(gStroke(1, 0, { w: 8, color: INK_SOFT }),
        WORK_X + (i - 2) * 118, WORK_Y + (i - 2) * 12, 0.9), gRelic * 0.15);
    }
    page += ghost(place(gStroke(1, 0, { w: 9, color: INK_SOFT }), WORK_X, WORK_Y, 0.98), gRelic * 0.44)
      + link(WORK_X - 128, WORK_Y + 108, CLEF_X + 96, GY - 136, gRelic);
  }
  if (named > 0.01) {
    page += tie(CLEF_X + 44, 1500, GY, named, GREEN, 4.2)
      + text('G', { x: 1562, y: GY + 17, size: 54, color: GREEN, p: named });
  }

  // ---- the letter F, wherever it currently is
  if (fIn > 0.01) {
    const fx = lerp(lerp(HEAD_X, WORK_X, fLift), CLEF_X, fSeat);
    const fy = lerp(lerp(FYU, WORK_Y, fLift), F_LINE_L, fSeat);
    const fs = lerp(lerp(0.32, lerp(1.45, 1.10, fm), fLift), 0.68, fSeat);
    page += place(fStroke(fIn, fm, { w: lerp(9, 7.6, fSeat), arm: armOut }), fx, fy, fs);
  }
  const fRelic = fSeat * (1 - easeInOut(ramp(t, shotStart(S.turn) - 700, 900)));
  if (fRelic > 0.01) {
    page += ghost(place(fStroke(1, 0, { w: 9, color: INK_SOFT }), WORK_X, WORK_Y, 0.98), fRelic * 0.44)
      + link(WORK_X - 120, WORK_Y + 104, CLEF_X + 110, F_LINE_L - 92, fRelic);
  }
  if (dot1 > 0.01) page += place(fill(bassDot(-DOT_DY), dot1), CLEF_X, F_LINE_L, 0.68);
  if (dot2 > 0.01) page += place(fill(bassDot(DOT_DY), dot2), CLEF_X, F_LINE_L, 0.68);
  if (noMistake > 0.01) {
    page += tie(CLEF_X + 96, 1500, F_LINE_L, noMistake, GREEN, 4.2)
      + text('F', { x: 1562, y: F_LINE_L + 17, size: 54, color: GREEN, p: noMistake });
  }

  // ---- s04 text, in the half of the page the stave does not use
  if (latin > 0.01 && latinOut < 0.995) {
    page += ghost(
      text('litterae clavis', { x: 760, y: 300, size: 60, color: RED, p: latin })
      + tie(1000, 1132, 284, clefWord)
      + ink(new P().M(1112, 272).L(1132, 284).L(1112, 296), Math.max(0, clefWord * 2 - 1), { w: 3, color: INK_SOFT })
      + text('clef', { x: 1230, y: 300, size: 60, color: RED, p: clefWord }), 1 - latinOut);
  }

  // ---- s09: what the marks at the front are actually for
  if (marks > 0.01) {
    page += tie(320, 566, bandY, marks)
      + text('which line', { x: 440, y: bandY - 18, size: 38, color: RED, p: marks });
  }
  if (accIn > 0.01) {
    const late = Math.max(0, accIn * 1.5 - 0.5);
    page += ghost(place(roundB(1, 0, { w: 9, color: INK_SOFT }), 662, GY + 4, 0.42), sameIn * 0.32)
      + ghost(place(hardB(1, 1, { w: 9, color: INK_SOFT }), 806, GY + 4, 0.42), sameIn * 0.32)
      + place(roundB(accIn, 1, { w: 7 }), 662, GY + 4, 0.42)
      + place(hardB(late, 3, { w: 7 }), 806, GY + 4, 0.42)
      + tie(614, 858, bandY, late)
      + text('which note', { x: 736, y: bandY - 18, size: 38, color: RED, p: late });
  }
  return page;
}

// ---------------------------------------------------------------- stage C
/** One note that could go two ways, and the two letters it was written with. */
function stageAccidentals(t) {
  const barIn = ramp(t, beat(S.roundb, 'medieval'), 1000);
  const noteIn = ramp(t, beat(S.roundb, 'note'), 700);
  const twoIn = ramp(t, beat(S.roundb, 'ways'), 800);
  const bIn = ramp(t, beat(S.roundb, 'lower'), 2000);
  const rotund = ramp(t, beat(S.roundb, 'rotundum'), 700);

  const fm = easeInOut(ramp(t, beat(S.flat, 'barely'), 2200));
  const slide = easeInOut(ramp(t, shotStart(S.squareb) - 1100, 1300));
  const eq = ramp(t, beat(S.flat, 'b'), 700);

  const sqIn = ramp(t, beat(S.squareb, 'higher'), 1600);
  const sq = easeInOut(ramp(t, beat(S.squareb, 'squared'), 1500));
  const quad = ramp(t, beat(S.squareb, 'quadratum'), 700);

  const sharpM = easeInOut(ramp(t, beat(S.sharp, 'sharp'), 2100));
  const natIn = ramp(t, beat(S.sharp, 'natural'), 1200);

  // the one note in the whole scale that had two lives
  const y0 = 208;
  let page = '';
  for (let i = 0; i < 5; i += 1) {
    page += ink(new P().M(700, y0 + (i - 2) * 24).L(1220, y0 + (i - 2) * 24),
      clamp01(barIn * 1.6 - i * 0.1), { w: 2.4, color: INK_SOFT, opacity: 0.8 });
  }
  page += noteHead(950, y0 - 12, noteIn, { r: 12 });
  page += ghost(noteHead(1010, y0 - 30, twoIn, { color: RED })
    + noteHead(1010, y0 + 6, twoIn, { color: RED }), twoIn * 0.55);

  // the round b, and the flat it barely had to become
  const bx = lerp(950, 660, slide);
  const bs = lerp(1.48, 1.02, slide);
  page += place(roundB(bIn, fm), bx, 500, bs);
  page += text('b rotundum', { x: bx, y: 764, size: lerp(52, 42, slide), color: RED, p: clamp01(rotund - fm * 2) })
    + text('flat', { x: bx, y: 764, size: 46, color: RED, p: clamp01(fm * 2 - 1) });
  if (eq > 0.01) {
    page += text('B', { x: bx - 258, y: 518, size: 68, color: RED, p: eq })
      + text('=', { x: bx - 178, y: 512, size: 46, color: INK_SOFT, p: eq });
  }

  // the same letter again, squared off, then let out into the other two marks
  if (sqIn > 0.01) {
    const x = sharpM > 0.001 ? lerp(1, 3, sharpM) : sq;
    page += place(hardB(sqIn, x), 1092, 500, 1.34)
      + text('b quadratum', { x: 1092, y: 764, size: 52, color: RED, p: clamp01(quad - sharpM * 2) })
      + text('sharp', { x: 1092, y: 764, size: 46, color: RED, p: clamp01(sharpM * 2 - 1) });
  }
  if (natIn > 0.01) {
    page += place(hardB(natIn, 2), 1470, 500, 1.0)
      + text('natural', { x: 1470, y: 764, size: 46, color: RED, p: clamp01(natIn * 1.4 - 0.4) });
  }
  return page;
}

// ---------------------------------------------------------------- stage D
const RECAP = [
  { kind: 'g', name: 'treble clef', x: 470 },
  { kind: 'f', name: 'bass clef', x: 810 },
  { kind: 'flat', name: 'flat', x: 1150 },
  { kind: 'sharp', name: 'sharp', x: 1470 },
];

/** The whole row goes down first, then each mark lands on its cue word. */
function stageRecap(t) {
  const open = beat(S.recap, 'nothing');
  const cues = [
    beat(S.recap, 'mark'), beat(S.recap, 'handwriting'),
    beat(S.recap, 'thousand'), beat(S.recap, 'copying'),
  ];
  const wasPicture = ramp(t, beat(S.recap, 'pictures'), 800);
  const col = wasPicture > 0.02 ? RED : INK_SOFT;
  return RECAP.map((item, i) => {
    const drew = ramp(t, open + i * 280, 800);
    const p = ramp(t, cues[i], 700);
    const top = item.kind === 'g' ? place(gStroke(drew, 0, { w: 7, color: col }), item.x, 296, 0.62)
      : item.kind === 'f' ? place(fStroke(drew, 0, { w: 7, color: col }), item.x, 296, 0.54)
        : item.kind === 'flat' ? place(roundB(drew, 0, { w: 7, color: col }), item.x, 306, 0.52)
          : place(hardB(drew, 1, { w: 7, color: col }), item.x, 306, 0.52);
    const bot = item.kind === 'g' ? place(gStroke(p, 1, { w: 8 }), item.x, 620, 0.5)
      : item.kind === 'f' ? place(fStroke(p, 1, { w: 8, arm: 0 })
        + fill(bassDot(-DOT_DY), Math.max(0, p * 1.5 - 0.5))
        + fill(bassDot(DOT_DY), Math.max(0, p * 1.6 - 0.6)), item.x, 606, 0.62)
        : item.kind === 'flat' ? place(roundB(p, 1, { w: 8 }), item.x, 612, 0.62)
          : place(hardB(p, 3, { w: 8 }), item.x, 618, 0.7);
    return top
      + ink(new P().M(item.x, 396).L(item.x, 486), p, { w: 3, color: INK_SOFT, dash: '10 9' })
      + bot
      + text(item.name, { x: item.x, y: 836, size: 40, color: RED, p: clamp01(p * 1.4 - 0.4) });
  }).join('');
}

// ---------------------------------------------------------------- stage E
function stageClose(t) {
  const marks = ramp(t, beat(S.close, 'never'), 900);
  const letters = ramp(t, beat(S.close, 'three'), 900);
  const sign = ramp(t, beat(S.close, 'alphabet'), 900);
  const xs = [520, 850, 1170, 1450];
  const bMid = (xs[2] + xs[3]) / 2;
  return place(gStroke(marks, 1, { w: 10 }), xs[0], 450, 0.84)
    + place(fStroke(clamp01(marks * 1.3 - 0.3), 1, { w: 10, arm: 0 })
      + fill(bassDot(-DOT_DY), clamp01(marks * 1.6 - 0.6))
      + fill(bassDot(DOT_DY), clamp01(marks * 1.7 - 0.7)), xs[1], 430, 1.0)
    + place(roundB(clamp01(marks * 1.5 - 0.5), 1, { w: 10 }), xs[2], 440, 1.02)
    + place(hardB(clamp01(marks * 1.7 - 0.7), 3, { w: 10 }), xs[3], 450, 1.12)
    + text('G', { x: xs[0], y: 748, size: 64, color: RED, p: letters })
    + text('F', { x: xs[1], y: 748, size: 64, color: RED, p: clamp01(letters * 1.4 - 0.2) })
    + text('b', { x: bMid, y: 748, size: 64, color: RED, p: clamp01(letters * 1.6 - 0.5) })
    + tie(xs[2], bMid - 38, 730, clamp01(letters * 1.6 - 0.6), RED)
    + tie(bMid + 38, xs[3], 730, clamp01(letters * 1.6 - 0.6), RED)
    + text('Not Arbitrary', { x: 960, y: 896, size: 58, color: RED, p: sign });
}

const EDGES = [S.stave, S.roundb, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.stave) - 260) return stageOpen(t);
  if (t < shotStart(S.roundb) - 260) return stageStave(t);
  if (t < shotStart(S.recap) - 260) return stageAccidentals(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
