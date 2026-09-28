// Not Arbitrary, episode 9 — the horse is standing on its tail.
//
// One move carries the first half: a picture turned a quarter-turn. A horse
// drawn the way anyone would, stood on its tail, then worn down into 馬 - and
// four more animals that were stood up the same way. The second half is the
// reason, and the reason is a thing nobody alive has seen: the bamboo book,
// strips a finger wide, which rotted three thousand years ago and survives
// only as the character that names it.
//
// Every mark comes from the strip modules beside this file. They are the
// working drawings, iterated with lib/glyph.mjs before a frame of film was
// rendered, and scene.mjs imports their generators rather than copying a
// single coordinate.

import {
  P, ink, smooth, text, createFilm, travel, detach, lerp, ramp, clamp01, easeInOut, easeOut,
  INK, INK_SOFT, RED, GOLD,
} from '../../../lib/scene-kit.mjs';
import { horse } from './strip-horse.mjs';
import { animal, KINDS } from './strip-animals.mjs';
import { book } from './strip-book.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', draw: 's02.horse.draw', stand: 's03.horse.stand', legs: 's04.horse.legs',
  reveal: 's05.horse.reveal', gallery: 's06.gallery', lie: 's07.gallery.lie',
  turn: 's08.turn', fit: 's09.fit', columns: 's10.columns',
  lost: 's11.lost', book: 's12.book', recap: 's13.recap', close: 's14.close',
};

const Y = 540;
const BAMBOO = 'hsl(46, 48%, 74%)';
const BONE = 'hsl(40, 38%, 88%)';
// Every copy fades up out of its source over the first 18% of its move, so no
// move opens on the same drawing twice (see travel() in lib/scene-kit.mjs).
const EMERGE = 0.18;

const label = (t, from, name, x, y = 800) =>
  text(name, { x, y, size: 44, color: RED, p: ramp(t, from, 440) });
const caption = (t, from, name, x, y = 800, size = 36) =>
  text(name, { x, y, size, color: INK_SOFT, p: ramp(t, from, 560) });
const tie = (x0, y0, x1, y1, p, opacity = 0.55) =>
  ink(new P().M(x0, y0).L(x1, y1), p, { w: 3, color: INK_SOFT, dash: '12 10', opacity });
const fade = (o, inner) => `<g opacity="${clamp01(o).toFixed(3)}">${inner}</g>`;

// ------------------------------------------------------------ page props
/** One bamboo strip, outlined and tinted. It inks on; the tint follows. */
function strip(x, top, bot, w, p, opacity = 1) {
  const path = new P().M(x - w / 2, bot).L(x - w / 2, top).L(x + w / 2, top).L(x + w / 2, bot).Z();
  const tint = clamp01((p - 0.4) / 0.6);
  return (tint > 0.01 ? `<path d="${path.d()}" fill="${BAMBOO}" opacity="${(0.5 * tint * opacity).toFixed(3)}"/>` : '')
    + ink(path, p, { w: 4, color: INK_SOFT, opacity });
}

/**
 * A made-up character, three brush strokes. Deliberately illegible: real
 * characters would be read, and the voice is the caption, not the page.
 */
function pseudo(cx, cy, s, seed, p, opacity = 1) {
  const r = i => Math.sin((seed * 7.31 + i) * 12.9898) * 0.5 + 0.5;
  // Brush-stroke vocabulary, in unit coordinates; each character takes three
  // to five of them, so the columns read as writing rather than a pattern.
  const kit = [
    u => new P().M(-0.45, -0.3 + u * 0.2).L(0.45, -0.34 + u * 0.2),            // horizontal
    u => new P().M(-0.4, 0.1 + u * 0.3).L(0.4, 0.06 + u * 0.3),                 // lower horizontal
    u => new P().M(-0.05 + u * 0.3, -0.5).L(-0.08 + u * 0.3, 0.5),              // upright
    u => new P().M(0.05, -0.1 + u * 0.2).Q(-0.1, 0.25, -0.45, 0.45),            // left-falling
    u => new P().M(0, 0 + u * 0.1).Q(0.15, 0.3, 0.45, 0.45),                    // right-falling
    u => new P().M(-0.3 + u * 0.4, -0.5).L(-0.22 + u * 0.4, -0.36),             // dot
    u => new P().M(-0.3, -0.15).L(0.3, -0.15).L(0.28, 0.3).L(-0.3, 0.3).Z(),    // small box
    u => new P().M(-0.4, -0.4).L(0.4, -0.4).L(0.36, 0.1 + u * 0.3),             // turn
  ];
  const n = 3 + Math.floor(r(0) * 3);
  const strokes = Array.from({ length: n }, (_, i) =>
    kit[Math.floor(r(i * 3 + 1) * kit.length) % kit.length](r(i * 3 + 2)));
  const place = path => {
    const out = new P();
    for (const sg of path.seg) {
      if (sg[0] === 'Z') { out.Z(); continue; }
      const pts = sg.slice(1).map((v, j) => (j % 2 === 0 ? cx + v * s : cy + v * s));
      out[sg[0]](...pts);
    }
    return out;
  };
  return strokes.map((st, i) => ink(place(st), clamp01(p * n - i), { w: 4.5, color: INK, opacity: 0.8 * opacity })).join('');
}

/** An ox shoulder blade: the thing the oldest Chinese writing is carved on. */
function scapula(cx, cy, R, p, opacity = 1) {
  const s = (x, y) => [cx + x * R, cy + y * R];
  // Lopsided on purpose: one border almost straight, the other flaring, and
  // the far edge cut on a slant. Drawn symmetric it read as a bell, and with
  // a round knob on top as a bottle. The heat cracks are what make it a bone
  // somebody asked a question of.
  const pts = [s(-20, -270), s(30, -276), s(52, -250), s(40, -214), s(72, -120),
    s(124, 20), s(168, 160), s(186, 234), s(60, 250), s(-80, 240), s(-150, 226),
    s(-112, 100), s(-70, -40), s(-40, -160), s(-30, -210), s(-46, -246)];
  const path = smooth(pts, { closed: true, tension: 0.96 });
  // 卜-shaped cracks, away from where the graph will be carved.
  const cracks = [[-92, 150], [104, 160], [40, -150]].map(([x, y]) =>
    new P().M(...s(x, y - 34)).L(...s(x + 2, y + 34)).M(...s(x + 1, y - 4)).L(...s(x + 22, y + 8)));
  const tint = clamp01((p - 0.5) / 0.5);
  return (tint > 0.01 ? `<path d="${path.d()}" fill="${BONE}" opacity="${(tint * opacity).toFixed(3)}"/>` : '')
    + ink(path, p, { w: 4, color: INK_SOFT, opacity })
    + cracks.map(c => ink(c, clamp01(p * 2 - 1), { w: 3, color: INK_SOFT, opacity: 0.8 * opacity })).join('');
}

// ---------------------------------------------------------------- the hook
function stageHook(t) {
  const drawn = ramp(t, beat(S.hook, 'Chinese'), 2600);
  const part = easeInOut(ramp(t, beat(S.hook, 'because'), 1100));
  const stood = ramp(t, beat(S.hook, 'because') + 300, 2600);
  const maX = lerp(960, 620, part);
  return horse(2, { cx: maX, cy: Y, R: lerp(1.3, 1.0, part), draw: drawn })
    + horse(1, { cx: 1300, cy: Y, R: 1.05, draw: stood })
    + tie(760, Y, 1150, Y, ramp(t, beat(S.hook, 'stood'), 900))
    + caption(t, beat(S.hook, 'because') + 600, 'today', maX)
    + caption(t, beat(S.hook, 'because') + 900, '3,000 years ago', 1300);
}

// ------------------------------------------------------- horse -> 馬, twice
// Three states side by side at the end, each tied to the next: the claim is a
// chain, and the page should show the whole chain while the voice pays it off.
const H = { from: 470, mid: 980, to: 1450, R: 1.6, shrink: 0.72, pairFrom: 640, pairMid: 1240 };

function stageHorse(t) {
  const drawn = ramp(t, beat(S.draw, 'horse'), 7000);
  const turn = ramp(t, beat(S.stand, 'this'), 3400);
  const wear = ramp(t, beat(S.legs, 'legs'), 5600);
  const red = { maneRed: ramp(t, beat(S.reveal, 'three'), 500), legRed: ramp(t, beat(S.reveal, 'four'), 500) };
  const R1 = H.R * H.shrink;

  // First move: the lying horse makes room and a copy turns upright as it goes.
  // Once the second move starts, the copy's job passes to the second travel(),
  // which holds the upright horse where this one left it.
  // Two on the page hold the centre between them; they only make room on the
  // left once the third state is on its way, so the right third is never
  // sitting empty while the voice talks about scribes.
  const room = easeInOut(clamp01(wear * 1.6));
  const fromX = lerp(H.pairFrom, H.from, room), midX = lerp(H.pairMid, H.mid, room);
  const first = travel((u, cx, o) => {
    if (u > 0.999 && wear > 0) return '';
    return horse(u, { cx, cy: Y, R: H.R, opacity: o, draw: u > 0 ? 1 : drawn, ...red });
  }, turn, { from: fromX, to: midX, y: Y, inset: 185, shrink: H.shrink, ghost: 0.5, emerge: EMERGE });

  const second = wear <= 0 ? '' : travel(
    (u, cx, o) => horse(1 + u, { cx, cy: Y, R: R1, opacity: o, ...red }),
    wear, { alone: midX, from: midX, to: H.to, y: Y, inset: 175, ghost: 0.5, emerge: EMERGE },
  );

  return first + second
    + (turn > 0.05 ? caption(t, beat(S.stand, 'standing'), 'carved on bone, 1200 BC', midX, 800, 32) : '')
    + (wear > 0.05 ? label(t, beat(S.reveal, 'character'), 'horse', H.to) : '')
    + caption(t, beat(S.reveal, 'still'), 'still written this way in Taiwan, Hong Kong and Japan', 960, 900, 30);
}

// ------------------------------------------------------------ the gallery
// The horse stays on the page and leads the row: "it was never only the
// horse" is said over the horse, and the four that join it are put down in
// the first two seconds rather than on their names, which come late enough to
// leave the page bare.
const G = {
  xs: [340, 650, 960, 1270, 1580], R: 0.88, horseR: 0.74, low: 730,
  names: ['horse', 'tiger', 'dog', 'pig', 'elephant'],
};

/** Row member i at angle a (90 standing, 0 lying): the horse, then the four. */
const member = (i, a, opts) => (i === 0
  ? horse(a / 90, { ...opts, R: G.horseR, w: 6.5 })
  : animal(KINDS[i - 1], a, { ...opts, R: G.R }));

function stageGallery(t) {
  const open = shotStart(S.gallery);
  return G.xs.map((x, i) => {
    const drawn = ramp(t, i === 0 ? open - 300 : open + 250 + i * 420, 1000);
    const e = easeInOut(ramp(t, beat(S.lie, 'lay') + i * 200, 2200));
    const standY = lerp(Y, 390, e);
    const held = member(i, 90, { cx: x, cy: standY, draw: drawn, opacity: lerp(1, 0.42, e) });
    if (e <= 0.01) return held;
    const y = lerp(standY, G.low, easeOut(e));
    return held
      + tie(x, standY + 135, x, y - 80, clamp01(e * 2 - 0.6), 0.5)
      + member(i, 90 * (1 - e), { cx: x, cy: y, opacity: clamp01(e / EMERGE) });
  }).join('')
    + G.names.map((n, i) => label(t, beat(S.lie, 'plainly') + i * 150, n, G.xs[i], 860)).join('');
}

// ------------------------------------------------- the page: bamboo strips
const B = { n: 5, w: 150, gap: 10, top: 240, bot: 880, cords: [330, 790] };
const slot = 2;                     // the strip the horse is written on
const HORSE_Y = 480, HORSE_R = 0.6;
// Rows of writing stop short of the cords, as a scribe's did: the binding went
// on first and the text was written in the spaces between.
const ROWS = [395, 485, 575, 665, 745];
const ROWS_UNDER_HORSE = [640, 735];

function stageStrips(t) {
  const move = easeInOut(ramp(t, shotStart(S.fit) - 300, 1000));
  const bx = lerp(960, 1150, move);
  const xs = Array.from({ length: B.n }, (_, i) => bx + (i - (B.n - 1) / 2) * (B.w + B.gap));
  const laid = ramp(t, shotStart(S.turn) + 100, 3600);
  const tied = ramp(t, beat(S.turn, 'tied'), 1200);
  const out = [];

  xs.forEach((x, i) => out.push(strip(x, B.top, B.bot, B.w, clamp01(laid * B.n - i * 0.8))));
  const half = (B.n * (B.w + B.gap)) / 2 + 24;
  B.cords.forEach((cy, j) => out.push(ink(
    new P().M(bx - half, cy - 4).Q(bx, cy + 10, bx + half, cy - 4), clamp01(tied * 2 - j), { w: 5, color: INK },
  )));

  // The horse: drawn lying beside the book, carried onto one strip still lying
  // down - where it hangs off both edges - and only then turned to fit.
  const shown = ramp(t, beat(S.fit, 'horse'), 1100);
  const carry = easeInOut(ramp(t, beat(S.fit, 'lying'), 1500));
  const turn = easeInOut(ramp(t, beat(S.fit, 'turned'), 1400));
  const src = { x: 430, y: Y, R: 0.8 };
  if (shown > 0) {
    out.push(horse(0, { cx: src.x, cy: src.y, R: src.R, draw: shown, opacity: lerp(1, 0.45, carry) }));
    if (carry > 0.01) {
      const cx = lerp(src.x, xs[slot], carry), cy = lerp(src.y, HORSE_Y, carry);
      out.push(tie(src.x + 150, src.y, cx - 110 * lerp(1, 0.6, carry), cy, clamp01(carry * 2), 0.45));
      out.push(horse(turn, { cx, cy, R: lerp(src.R, HORSE_R, carry), w: 6, opacity: clamp01(carry / EMERGE) }));
    }
  }

  // The second mark the strips left: writing in columns, top to bottom,
  // right to left, one column to a strip.
  const cols = ramp(t, shotStart(S.columns) + 300, 7600);
  xs.forEach((x, i) => {
    const order = B.n - 1 - i;                         // rightmost strip first
    const rows = i === slot ? ROWS_UNDER_HORSE : ROWS;
    rows.forEach((y, r) => {
      const p = clamp01((cols * B.n - order) * rows.length - r);
      if (p > 0) out.push(pseudo(x, y, 34, i * 11 + r, p));
    });
  });
  return out.join('');
}

// ---------------------------------------------------- bamboo -> bone -> 冊
const K = { from: 480, mid: 1010, to: 1480, y: 560, pairFrom: 700, pairMid: 1230 };

function stageBook(t) {
  const drawn = ramp(t, shotStart(S.lost) + 100, 2600);
  const aside = easeInOut(ramp(t, beat(S.lost, 'rots'), 1400));
  const bone = ramp(t, beat(S.lost, 'bone'), 1600);
  const carve = ramp(t, beat(S.lost, 'know'), 3400);
  const modern = ramp(t, beat(S.book, 'character'), 3200);
  const cordRed = ramp(t, beat(S.book, 'cord'), 500);

  // Bamboo and bone share the page until the third state is on its way.
  const room = easeInOut(clamp01(modern * 1.6));
  const fromX = lerp(K.pairFrom, K.from, room), midX = lerp(K.pairMid, K.mid, room);
  const bx = lerp(960, fromX, aside);
  const R0 = lerp(1.3, 1.0, aside);
  // Bamboo rots: the book thins as it moves aside, before anything leaves it.
  const rot = lerp(1, 0.7, aside);
  const out = [scapula(midX, K.y + 20, 0.95, bone)];

  // Bamboo to bone: the book stays where it is and thins; the graph lifts off
  // it, shrinks to the size of a carving, and lands on the shoulder blade.
  out.push(detach((u, cx, cy, o) => {
    if (u > 0.999 && modern > 0) return '';
    return book(u, {
      cx, cy, R: lerp(R0, 0.62, u), opacity: o * (u > 0 ? 1 : rot), draw: u > 0 ? 1 : drawn,
      tint: BAMBOO, cordRed, w: lerp(6, 9, u),
    });
  }, carve, { from: bx, to: midX, fromY: K.y, toY: K.y + 40, ghost: 0.5, emerge: EMERGE }));

  // Bone to page: the carving stays on the bone; a copy of it is written out
  // as the character in use today.
  if (modern > 0) {
    out.push(travel((u, cx, o) => book(1 + u, {
      cx, cy: lerp(K.y + 40, K.y, u), R: lerp(0.62, 0.95, u), opacity: o, cordRed, w: lerp(9, 13, u),
    }), modern, { alone: midX, from: midX, to: K.to, y: K.y + 40, inset: 150, ghost: 0.6, emerge: EMERGE }));
  }

  return out.join('')
    + caption(t, beat(S.lost, 'bamboo'), 'bamboo', bx, 860)
    + caption(t, beat(S.lost, 'bone'), 'bone', midX, 860)
    + (modern > 0.05 ? label(t, beat(S.book, 'still'), 'a book', K.to, 860) : '');
}

// --------------------------------------------------------------- the recap
function stageRecap(t) {
  // The whole grid lands in the opening second; the voice argues over it
  // rather than reading its labels.
  const row = ramp(t, shotStart(S.recap) - 300, 900);
  const L = 470, Rx = 1450, M = 960;
  return fade(row, [
    horse(0, { cx: L, cy: 380, R: 0.62 }),
    tie(L, 500, L, 590, 1),
    horse(2, { cx: L, cy: 720, R: 0.62 }),
    book(0, { cx: Rx, cy: 380, R: 0.7, tint: BAMBOO }),
    tie(Rx, 500, Rx, 590, 1),
    book(2, { cx: Rx, cy: 720, R: 0.62 }),
    strip(M, 250, 870, 150, 1),
    horse(1, { cx: M, cy: 410, R: 0.52, w: 5.5 }),
    pseudo(M, 600, 34, 3, 1), pseudo(M, 710, 34, 4, 1), pseudo(M, 810, 34, 5, 1),
  ].join(''))
    + label(t, shotStart(S.recap) + 350, 'horse', L, 880)
    + label(t, shotStart(S.recap) + 500, 'book', Rx, 880);
}

// ---------------------------------------------------------------- the close
function stageClose(t) {
  const show = ramp(t, shotStart(S.close) - 300, 900);
  const outline = ramp(t, beat(S.close, 'page'), 1400);
  const slipAt = x => ink(new P().M(x - 125, 820).L(x - 125, 250).L(x + 125, 250).L(x + 125, 820).Z(),
    outline, { w: 3, color: INK_SOFT, dash: '14 10', opacity: 0.7 });
  return fade(show, horse(2, { cx: 780, cy: 530, R: 0.72 }) + book(2, { cx: 1140, cy: 530, R: 0.72 }))
    + slipAt(780) + slipAt(1140)
    + text('Not Arbitrary', { x: 960, y: 915, size: 46, color: GOLD, p: ramp(t, beat(S.close, 'nobody'), 900) });
}

const EDGES = [S.draw, S.gallery, S.turn, S.lost, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.draw) - 260) return stageHook(t);
  if (t < shotStart(S.gallery) - 260) return stageHorse(t);
  if (t < shotStart(S.turn) - 260) return stageGallery(t);
  if (t < shotStart(S.lost) - 260) return stageStrips(t);
  if (t < shotStart(S.recap) - 260) return stageBook(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
