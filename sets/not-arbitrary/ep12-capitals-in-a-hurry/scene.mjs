// Not Arbitrary, episode 12 — lowercase is a capital in a hurry.
//
// Four capitals are written faster and faster until they are small letters,
// and two habits of a hurrying pen do all the work: a curve is quicker than a
// corner, and one stroke is quicker than two. Each letter is a chain of the
// attested stages - capital, uncial or handwritten, half-uncial - side by
// side, so the page holds the whole history of a letter at the end of its
// shot. Then the turn: the evidence that it started in the first century, and
// the accident that saved it - Renaissance scholars who took ninth-century
// books for ancient Roman ones.
//
// Every letter comes from strip-letters.mjs; nothing here draws a letterform.

import {
  P, ink, text, createFilm, travel, triptych as kitTriptych, lerp, ramp, clamp01, easeInOut, easeOut,
  INK, INK_SOFT, RED, GOLD,
} from '../../../lib/scene-kit.mjs';
import { letter, serifs } from './strip-letters.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', stone: 's02.stone', rules: 's03.rules', m: 's04.m',
  eRound: 's05.e.round', eClose: 's06.e.close', r: 's07.r', herc: 's08.herculaneum',
  dFlick: 's09.d.flick', dGrow: 's10.d.grow', charl: 's11.charlemagne', mistake: 's12.mistake',
  cases: 's13.case', recap: 's14.recap', close: 's15.close',
};

const Y = 520;                       // letter centre line; the baseline sits 120R below
// Copies fade up out of their source (lib travel()). 0.35 rather than the
// 0.18 of episodes 9-10: these letters travel a shorter way than a horse or a
// family tree, so at 0.18 a copy was at full strength while still overlapping
// its source, and every move opened on a doubled letter - EE, RR, DD.
const EMERGE = 0.35;
const STONE = 'hsl(35, 8%, 80%)';
const PAPYRUS = 'hsl(42, 46%, 80%)';
const VELLUM = 'hsl(40, 42%, 91%)';
const CHAR = 'hsl(20, 18%, 22%)';

const label = (t, from, name, x, y, size = 40) =>
  text(name, { x, y, size, color: RED, p: ramp(t, from, 440) });
const caption = (t, from, name, x, y, size = 32) =>
  text(name, { x, y, size, color: INK_SOFT, p: ramp(t, from, 560) });
const fade = (o, inner) => (o <= 0.001 ? '' : `<g opacity="${clamp01(o).toFixed(3)}">${inner}</g>`);
const ring = (cx, cy, r, p, opacity = 1) => {
  const k = 0.5523 * r;
  const path = new P().M(cx, cy - r).C(cx + k, cy - r, cx + r, cy - k, cx + r, cy)
    .C(cx + r, cy + k, cx + k, cy + r, cx, cy + r).C(cx - k, cy + r, cx - r, cy + k, cx - r, cy)
    .C(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
  return ink(path, p, { w: 4, color: RED, opacity });
};

// The final small letter of each chain, and the chain length.
const CHAIN = { M: 1, E: 2, R: 2, D: 2 };
// The film takes the letters in this order, but it never shows them in a row
// that way: M E R D reads as a word, and not one to put on screen.
const ORDER = ['M', 'E', 'R', 'D'];
const SHOW = ['D', 'E', 'M', 'R'];
const COLS = [520, 820, 1120, 1420];

/** The kit's triptych(), at this film's centre line and emerge. */
const triptych = (draw, p1, p2, opts = {}) => kitTriptych(draw, p1, p2, { y: Y, emerge: EMERGE, ...opts });

// ---------------------------------------------------------------- props
function slab(cx, cy, w, h, p) {
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const path = new P().M(x0 + 14, y0).L(x0 + w - 10, y0 + 6).L(x0 + w, y0 + h - 12).L(x0 + 8, y0 + h).Z();
  const tint = clamp01((p - 0.3) / 0.7);
  return (tint > 0.01 ? `<path d="${path.d()}" fill="${STONE}" opacity="${(0.75 * tint).toFixed(3)}"/>` : '')
    + ink(path, p, { w: 4, color: INK_SOFT });
}

function sheet(cx, cy, w, h, p, color, ragged = 0) {
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const j = i => (ragged ? Math.sin(i * 12.9898) * ragged : 0);
  const path = new P().M(x0 + j(1), y0 + j(2)).L(x0 + w * 0.5 + j(3), y0 + j(4)).L(x0 + w + j(5), y0 + j(6))
    .L(x0 + w + j(7), y0 + h * 0.5 + j(8)).L(x0 + w + j(9), y0 + h + j(10)).L(x0 + w * 0.5 + j(11), y0 + h + j(12))
    .L(x0 + j(13), y0 + h + j(14)).L(x0 + j(15), y0 + h * 0.5 + j(16)).Z();
  const tint = clamp01((p - 0.3) / 0.7);
  return (tint > 0.01 ? `<path d="${path.d()}" fill="${color}" opacity="${(0.85 * tint).toFixed(3)}"/>` : '')
    + ink(path, p, { w: 3, color: INK_SOFT, opacity: 0.8 });
}

/** A carbonised scroll: what the Herculaneum books look like now. */
function scroll(cx, cy, p) {
  const body = new P().M(cx - 170, cy - 46).C(cx - 60, cy - 60, cx + 80, cy - 52, cx + 170, cy - 40)
    .L(cx + 176, cy + 44).C(cx + 80, cy + 58, cx - 60, cy + 60, cx - 172, cy + 46).Z();
  const end = new P().M(cx + 172, cy - 40).C(cx + 200, cy - 36, cx + 204, cy + 40, cx + 176, cy + 44)
    .C(cx + 150, cy + 40, cx + 150, cy - 34, cx + 172, cy - 40);
  const curl = new P().M(cx + 176, cy).C(cx + 186, cy - 14, cx + 168, cy - 18, cx + 166, cy - 2)
    .C(cx + 166, cy + 12, cx + 182, cy + 14, cx + 186, cy);
  const tint = clamp01((p - 0.3) / 0.7);
  return (tint > 0.01 ? `<path d="${body.d()}" fill="${CHAR}" opacity="${(0.9 * tint).toFixed(3)}"/>` : '')
    + ink(body, p, { w: 4, color: INK })
    + ink(end, clamp01(p * 1.4 - 0.4), { w: 4, color: INK })
    + ink(curl, clamp01(p * 2 - 1), { w: 3, color: INK_SOFT });
}

/** A line of writing in the small letters the film has just made. */
function writtenLine(x0, y, n, size, seed, p, opacity = 1) {
  const names = ['M', 'E', 'R', 'D', 'h', 'E', 'R'];
  let x = x0;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const r = Math.abs(Math.sin((seed * 31 + i) * 12.9898));
    const name = names[Math.floor(r * names.length) % names.length];
    const on = clamp01(p * n - i);
    if (on > 0) {
      out.push(letter(name, name === 'h' ? 0 : CHAIN[name], { cx: x, cy: y - 120 * size + 60 * size, R: size, w: 9, opacity, draw: on }));
    }
    x += (name === 'M' ? 210 : 150) * size + (r > 0.82 ? 60 * size : 0);
  }
  return out.join('');
}

/** Blackletter, as a picket fence: tall narrow strokes with diamond feet. */
function gothicLine(x0, y, n, p, opacity = 1) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const on = clamp01(p * n - i);
    if (on <= 0) continue;
    const x = x0 + i * 19 + (i % 5 === 4 ? 10 : 0);
    out.push(ink(new P().M(x, y - 30).L(x, y + 2), on, { w: 6, color: INK, opacity }));
    out.push(ink(new P().M(x - 4, y + 4).L(x + 1, y + 9).L(x + 5, y + 4), on, { w: 3, color: INK, opacity }));
  }
  return out.join('');
}

function tray(cx, cy, w, h, cols, p) {
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const out = [ink(new P().M(x0, y0).L(x0 + w, y0).L(x0 + w, y0 + h).L(x0, y0 + h).Z(), p, { w: 5, color: INK_SOFT })];
  for (let c = 1; c < cols; c += 1) {
    const x = x0 + (w / cols) * c;
    out.push(ink(new P().M(x, y0).L(x, y0 + h), clamp01(p * 1.5 - 0.5), { w: 3, color: INK_SOFT, opacity: 0.8 }));
  }
  const tint = clamp01((p - 0.3) / 0.7);
  const box = new P().M(x0, y0).L(x0 + w, y0).L(x0 + w, y0 + h).L(x0, y0 + h).Z();
  return (tint > 0.01 ? `<path d="${box.d()}" fill="hsl(30, 35%, 72%)" opacity="${(0.35 * tint).toFixed(3)}"/>` : '') + out.join('');
}

// ---------------------------------------------------------------- the hook
/** Capitals above, their small letters below, tied: the hook and the close. */
function pairs(t, { caps = 1, small = 1, ties = 1, stagger = true } = {}) {
  return SHOW.map((k, i) => {
    const x = COLS[i];
    const c = stagger ? clamp01(caps * 4 - i) : caps, m = stagger ? clamp01(small * 4 - i) : small;
    return letter(k, 0, { cx: x, cy: 380, R: 0.72, draw: c })
      + ink(new P().M(x, 490).L(x, 560), ties, { w: 3, color: INK_SOFT, dash: '9 8', opacity: 0.6 })
      + letter(k, CHAIN[k], { cx: x, cy: 620, R: 0.72, draw: m });
  }).join('');
}

function stageHook(t) {
  return pairs(t, {
    caps: ramp(t, shotStart(S.hook) + 100, 2000),
    small: ramp(t, beat(S.hook, 'written'), 1800),
    ties: ramp(t, beat(S.hook, 'cut'), 900),
  });
}

// ---------------------------------------------------- carved, then written
function stageStone(t) {
  const carved = ramp(t, beat(S.stone, 'carved'), 2600);
  const penned = ramp(t, beat(S.rules, 'pen'), 3000);
  const xs = [600, 840, 1080, 1320];
  return slab(960, 380, 1000, 330, ramp(t, shotStart(S.stone) - 200, 1200))
    + SHOW.map((k, i) => {
      const on = clamp01(carved * 4 - i);
      return letter(k, 0, { cx: xs[i], cy: 380, R: 0.82, w: 15, color: INK_SOFT, draw: on })
        + (on > 0.9 ? serifs(k, { cx: xs[i], cy: 380, R: 0.82, draw: ramp(t, beat(S.stone, 'carved') + 700 * i + 900, 400) }) : '');
    }).join('')
    + caption(t, beat(S.stone, 'capitals'), 'carved in stone', 960, 610, 30)
    + SHOW.map((k, i) => letter(k, 0, { cx: xs[i], cy: 790, R: 0.62, w: 11, draw: clamp01(penned * 4 - i) })).join('')
    + caption(t, beat(S.rules, 'pen') + 600, 'written with a pen', 960, 930, 30);
}

// ---------------------------------------------------------- M: corners off
function stageM(t) {
  const drawn = ramp(t, shotStart(S.m) - 200, 700);
  const go = ramp(t, beat(S.m, 'pen'), 2200);
  const corners = ramp(t, beat(S.m, 'three'), 500);
  const e = easeInOut(go);
  const heldX = lerp(960, 640, e);
  const R = 1.05;
  const dots = [[-86, -120], [0, 120], [86, -120]]
    .map(([x, y], i) => ring(heldX + x * R, Y + y * R, 22, clamp01(corners * 3 - i), lerp(1, 0.4, e))).join('');
  return travel((u, cx, o) => letter('M', u, { cx, cy: Y, R, opacity: o, draw: u > 0 ? 1 : drawn }),
    go, { from: 640, to: 1290, y: Y, inset: 190, ghost: 0.5, emerge: EMERGE })
    + dots
    + caption(t, shotStart(S.m), 'capital', heldX, 800)
    + (go > 0.05 ? caption(t, beat(S.m, 'hurry'), 'minuscule', 1290, 800) : '');
}

// ------------------------------------------------ E: rounded, then closed
function stageE(t) {
  const drawn = ramp(t, shotStart(S.eRound) - 200, 800);
  const p1 = ramp(t, beat(S.eRound, 'rounded'), 2800);
  const p2 = ramp(t, beat(S.eClose, 'ran'), 2400);
  const barRed = ramp(t, beat(S.eRound, 'bar'), 500);
  const draw = (u, cx, o) => letter('E', u, {
    cx, cy: Y, R: 1.0, opacity: o, draw: u > 0 ? 1 : drawn,
    colors: u > 0.9 && barRed > 0 ? { bar: RED } : {},
  });
  const tri = triptych(draw, p1, p2);
  return tri.svg
    + caption(t, shotStart(S.eRound), 'capital', tri.fromX, 800)
    + (p1 > 0.05 ? caption(t, beat(S.eRound, 'few'), 'uncial, 4th to 8th century', tri.midX, 800, 28) : '')
    + (p2 > 0.05 ? caption(t, beat(S.eClose, 'loop'), 'half-uncial', tri.toX, 800) : '');
}

// ----------------------------------------------- R: run on, then shrink
function stageR(t) {
  const drawn = ramp(t, shotStart(S.r) - 200, 800);
  const lift = ramp(t, beat(S.r, 'closing'), 500);
  const p1 = ramp(t, beat(S.r, 'pen'), 2600);
  const p2 = ramp(t, beat(S.r, 'Then'), 2000);
  const draw = (u, cx, o) => letter('R', u, { cx, cy: Y, R: 1.0, opacity: o, draw: u > 0 ? 1 : drawn });
  const tri = triptych(draw, p1, p2);
  // Where the capital's pen came off the page to start the leg.
  const heldX = tri.fromX;
  const e1 = easeInOut(p1);
  const liftX = lerp(960, heldX, e1) - 60;
  return tri.svg
    + ring(liftX, Y, 24, lift, lerp(1, 0.45, e1))
    + caption(t, shotStart(S.r), 'capital', lerp(960, heldX, e1), 800)
    + (p1 > 0.05 ? caption(t, beat(S.r, 'pen') + 400, 'handwritten', tri.midX, 800) : '')
    + (p2 > 0.05 ? caption(t, beat(S.r, 'flick'), 'minuscule', tri.toX, 800) : '');
}

// --------------------------------------------------------- Herculaneum
function stageHerc(t) {
  const scrolled = ramp(t, shotStart(S.herc) - 200, 1800);
  const frag = ramp(t, beat(S.herc, 'buried'), 1400);
  const shown = ramp(t, beat(S.herc, 'already'), 1600);
  const fx = 1260, fy = 520;
  return scroll(620, 520, scrolled)
    + caption(t, beat(S.herc, 'Scrolls'), 'Herculaneum, buried AD 79', 620, 680, 32)
    + sheet(fx, fy, 470, 330, frag, PAPYRUS, 10)
    + ink(new P().M(800, 520).L(1015, 520), frag, { w: 3, color: INK_SOFT, dash: '12 10', opacity: 0.55 })
    + letter('D', 1, { cx: fx - 140, cy: fy + 10, R: 0.62, w: 11, draw: clamp01(shown * 3) })
    + letter('h', 0, { cx: fx, cy: fy + 10, R: 0.62, w: 11, draw: clamp01(shown * 3 - 1) })
    + letter('R', 1.7, { cx: fx + 140, cy: fy + 10, R: 0.62, w: 11, draw: clamp01(shown * 3 - 2) })
    + label(t, beat(S.herc, 'already') + 700, 'early d, h and r', fx, 760, 36);
}

// ------------------------------------------------- D: the overshoot grows
function stageD(t) {
  const drawn = ramp(t, shotStart(S.dFlick) - 200, 900);
  const notStem = ramp(t, beat(S.dFlick, 'never'), 600);
  const struck = ramp(t, beat(S.dFlick, 'stem'), 500);
  const tip = ramp(t, beat(S.dFlick, 'overshoot'), 600);
  const p1 = ramp(t, beat(S.dGrow, 'grow'), 4200);
  const p2 = ramp(t, beat(S.dGrow, 'stood'), 1800);
  const draw = (u, cx, o) => letter('D', u, {
    cx, cy: Y, R: 1.05, opacity: o, draw: u > 0 ? 1 : drawn,
    colors: u > 0 || notStem < 0.5 || p1 > 0.02 ? {} : { stem: RED },
  });
  const tri = triptych(draw, p1, p2, { pair: [640, 1280] });
  const e1 = easeInOut(p1);
  const hx = lerp(960, tri.fromX, e1);
  const R = 1.05;
  // Before anything moves: the obvious guess, struck out, and the real start.
  const guess = fade(1 - e1 * 1.5, label(t, beat(S.dFlick, 'never'), 'stem', hx - 170, Y, 36)
    + ink(new P().M(hx - 215, Y - 12).L(hx - 125, Y - 16), struck, { w: 5, color: RED }));
  return tri.svg
    + guess
    + ring(hx - 90 * R, Y - 116 * R, 26, tip, lerp(1, 0.5, e1))
    + (tip > 0 ? label(t, beat(S.dFlick, 'overshoot') + 200, 'overshoot', hx - 90 * R - 20, Y - 116 * R - 44, 32) : '')
    + (p1 > 0.05 ? caption(t, beat(S.dGrow, 'shrink'), 'uncial', tri.midX, 800) : '')
    + (p2 > 0.05 ? caption(t, beat(S.dGrow, 'straight'), 'half-uncial', tri.toX, 800) : '');
}

// ------------------------------------ Charlemagne, Gothic, and the mistake
function stageBooks(t) {
  const page = ramp(t, shotStart(S.charl) - 200, 1200);
  const writ = ramp(t, beat(S.charl, 'Around'), 5200);
  const buried = easeInOut(ramp(t, beat(S.mistake, 'buried'), 1800));
  const back = easeInOut(ramp(t, beat(S.mistake, 'came'), 1600));
  const cover = buried * (1 - back);
  const toCases = easeInOut(ramp(t, shotStart(S.cases) - 200, 1400));
  const px = lerp(960, 640, toCases);
  const rows = [360, 440, 520, 600, 680];
  const carol = sheet(px, 520, 700, 470, page, VELLUM)
    + rows.map((y, i) => writtenLine(px - 300, y, 11, 0.24, i + 1, clamp01(writ * 5 - i))).join('');
  const gothic = fade(cover, sheet(px + lerp(420, 0, buried), 520, 700, 470, 1, 'hsl(38, 30%, 86%)')
    + rows.map((y, i) => gothicLine(px - 300 + lerp(420, 0, buried), y + 10, 30, 1)).join(''));
  const antiqua = ramp(t, beat(S.mistake, 'scholars'), 600);
  const strike = ramp(t, beat(S.mistake, 'ones'), 500);
  const cases = ramp(t, beat(S.cases, 'printers'), 1600);
  const ux = 1380;
  return carol + gothic
    + caption(t, beat(S.charl, 'year'), 'Aachen, about 800', px, 830, 32)
    + (buried > 0.05 && back < 0.5 ? caption(t, beat(S.mistake, 'Gothic'), 'Gothic, 1200s to 1400s', px, 250, 30) : '')
    + text('ancient Roman', { x: px, y: 222, size: 36, color: INK_SOFT, p: antiqua })
    + ink(new P().M(px - 120, 210).L(px + 120, 206), strike, { w: 5, color: RED })
    + label(t, beat(S.mistake, 'ones') + 300, 'about 800', px, 268, 32)
    // The printers' two trays: capitals in the upper one, small letters below.
    + (cases > 0 ? tray(ux, 390, 440, 150, 4, cases) + tray(ux, 650, 520, 170, 4, clamp01(cases * 1.2 - 0.2)) : '')
    + (cases > 0.3 ? SHOW.map((k, i) => letter(k, 0, { cx: ux - 165 + i * 110, cy: 390, R: 0.42, w: 10, draw: clamp01(cases * 2 - 0.6) })).join('') : '')
    + (cases > 0.5 ? SHOW.map((k, i) => letter(k, CHAIN[k], { cx: ux - 195 + i * 130, cy: 650, R: 0.5, w: 10, draw: clamp01(cases * 2 - 1) })).join('') : '')
    + (cases > 0 ? caption(t, beat(S.cases, 'capitals'), 'upper case', ux, 290, 30) + label(t, beat(S.cases, 'tray'), 'lower case', ux, 790, 36) : '');
}

// --------------------------------------------------------------- the recap
function stageRecap(t) {
  const row = ramp(t, shotStart(S.recap) - 300, 900);
  const xs = [440, 740, 1040, 1340];
  return fade(row, SHOW.map((k, i) => {
    const x = xs[i];
    const mid = k === 'M' ? 0.5 : 1;
    return letter(k, 0, { cx: x, cy: 300, R: 0.55 })
      + ink(new P().M(x, 400).L(x, 440), 1, { w: 3, color: INK_SOFT, dash: '8 7', opacity: 0.6 })
      + letter(k, mid, { cx: x, cy: 530, R: 0.55, color: INK_SOFT })
      + ink(new P().M(x, 630).L(x, 670), 1, { w: 3, color: INK_SOFT, dash: '8 7', opacity: 0.6 })
      + letter(k, CHAIN[k], { cx: x, cy: 760, R: 0.55 });
  }).join(''))
    + caption(t, shotStart(S.recap) + 200, 'capital', 1600, 312, 30)
    + caption(t, shotStart(S.recap) + 350, 'on the way', 1600, 542, 30)
    + caption(t, shotStart(S.recap) + 500, 'small letter', 1600, 772, 30);
}

// ---------------------------------------------------------------- the close
function stageClose(t) {
  const show = ramp(t, shotStart(S.close) - 300, 800);
  return fade(show, pairs(t, { stagger: false }))
    + text('Not Arbitrary', { x: 960, y: 880, size: 46, color: GOLD, p: ramp(t, beat(S.close, 'still'), 900) });
}

const EDGES = [S.stone, S.m, S.eRound, S.r, S.herc, S.dFlick, S.charl, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.stone) - 260) return stageHook(t);
  if (t < shotStart(S.m) - 260) return stageStone(t);
  if (t < shotStart(S.eRound) - 260) return stageM(t);
  if (t < shotStart(S.r) - 260) return stageE(t);
  if (t < shotStart(S.herc) - 260) return stageR(t);
  if (t < shotStart(S.dFlick) - 260) return stageHerc(t);
  if (t < shotStart(S.charl) - 260) return stageD(t);
  if (t < shotStart(S.recap) - 260) return stageBooks(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
