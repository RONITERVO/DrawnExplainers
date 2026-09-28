// Not Arbitrary, episode 13 — worn down, or cut in pieces.
//
// Japan's two syllabaries are Chinese characters written two ways. Buddhist
// monks glossing sutras needed a shorthand and cut each character down to one
// piece: katakana. At court the same characters were written whole, with a
// brush and at speed, until each wore down to one flowing shape: hiragana.
// Three characters carry the film - 加 'add', 宇 'roof', 利 'profit' - and
// each gives both, so the page is a family tree with every source at the top
// and both of its children beneath it, which is also the recap.
//
// Every character and kana comes from strip-kana.mjs. The only glyphs set in
// a font are the ones the argument does not depend on: the seven characters
// the Man'yōshū used for one sound, and the closing sentence.

import {
  P, ink, text, createFilm, lerp, ramp, clamp01, easeInOut, easeOut,
  INK, INK_SOFT, RED, BLUE, GOLD, CJK,
} from '../../../lib/scene-kit.mjs';
import { kana, kanji } from './strip-kana.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', borrow: 's02.borrow', twenty: 's03.twenty', monks: 's04.monks',
  kKa: 's05.kata.ka', kU: 's06.kata.u', kRi: 's07.kata.ri', turn: 's08.turn',
  hKa: 's09.hira.ka', hU: 's10.hira.u', hRi: 's11.hira.ri', genji: 's12.genji',
  recap: 's13.recap', close: 's14.close',
};

// Copies fade up out of their source over this much of their move (see
// travel() in lib/scene-kit.mjs); these moves are short, as in episode 12.
const EMERGE = 0.35;
const NAMES = ['ka', 'u', 'ri'];

const label = (t, from, s, x, y, size = 36) => text(s, { x, y, size, color: RED, p: ramp(t, from, 440) });
const caption = (t, from, s, x, y, size = 30) => text(s, { x, y, size, color: INK_SOFT, p: ramp(t, from, 560) });
const tie = (x0, y0, x1, y1, p, opacity = 0.5) =>
  ink(new P().M(x0, y0).L(x1, y1), p, { w: 3, color: INK_SOFT, dash: '10 9', opacity });
const fade = (o, inner) => (o <= 0.001 ? '' : `<g opacity="${clamp01(o).toFixed(3)}">${inner}</g>`);

// ---------------------------------------------------------------- the hook
const HX = [560, 960, 1360];

function stageHook(t) {
  const hira = ramp(t, beat(S.hook, 'syllables'), 2400);
  const kata = ramp(t, beat(S.hook, 'sets'), 2400);
  const chars = ramp(t, beat(S.hook, 'Chinese'), 1600);
  return NAMES.map((n, i) => kana(n, 'worn', 1, { cx: HX[i], cy: 320, R: 0.72, draw: clamp01(hira * 3 - i) })
    + kana(n, 'cut', 1, { cx: HX[i], cy: 760, R: 0.72, draw: clamp01(kata * 3 - i) })
    + fade(chars * 0.55, kanji(n, { cx: HX[i], cy: 540, R: 0.62, color: INK_SOFT, draw: chars })
      + tie(HX[i], 462, HX[i], 408, chars) + tie(HX[i], 618, HX[i], 672, chars))).join('')
    + label(t, beat(S.hook, 'written'), 'written fast', 290, 332, 32)
    + label(t, beat(S.hook, 'cut'), 'cut', 290, 772, 32);
}

// ---------------------------------------------------- borrowed for the sound
function eye(cx, cy, p) {
  const lid = new P().M(cx - 60, cy).Q(cx, cy - 46, cx + 60, cy).Q(cx, cy + 46, cx - 60, cy);
  const k = 0.5523 * 16;
  const iris = new P().M(cx, cy - 16).C(cx + k, cy - 16, cx + 16, cy - k, cx + 16, cy)
    .C(cx + 16, cy + k, cx + k, cy + 16, cx, cy + 16).C(cx - k, cy + 16, cx - 16, cy + k, cx - 16, cy)
    .C(cx - 16, cy - k, cx - k, cy - 16, cx, cy - 16);
  return ink(lid, p, { w: 5 }) + ink(iris, clamp01(p * 2 - 1), { w: 5 });
}
function tinCan(cx, cy, p) {
  const top = new P().M(cx - 38, cy - 44).Q(cx, cy - 58, cx + 38, cy - 44).Q(cx, cy - 30, cx - 38, cy - 44);
  const body = new P().M(cx - 38, cy - 44).L(cx - 38, cy + 40).Q(cx, cy + 56, cx + 38, cy + 40).L(cx + 38, cy - 44);
  return ink(top, p, { w: 5 }) + ink(body, clamp01(p * 1.6 - 0.6), { w: 5 });
}
function sea(cx, cy, p) {
  const wave = dy => new P().M(cx - 70, cy + dy).Q(cx - 52, cy + dy - 18, cx - 35, cy + dy)
    .Q(cx - 17, cy + dy + 18, cx, cy + dy).Q(cx + 17, cy + dy - 18, cx + 35, cy + dy)
    .Q(cx + 52, cy + dy + 18, cx + 70, cy + dy);
  return ink(wave(-14), p, { w: 5, color: BLUE }) + ink(wave(18), clamp01(p * 1.6 - 0.6), { w: 5, color: BLUE });
}

const KA_CHARS = ['可', '何', '加', '架', '香', '蚊', '迦'];

function stageBorrow(t) {
  // From the top of the shot: cued on 'borrowed', the page sat blank for the
  // first second and a half after the hook cleared.
  const drawn = ramp(t, shotStart(S.borrow) - 150, 2000);
  const up = easeInOut(ramp(t, shotStart(S.twenty) - 200, 1200));
  const kx = 960, ky = lerp(420, 330, up), kR = lerp(1.25, 0.95, up);
  const meaning = ramp(t, beat(S.borrow, 'characters'), 600);
  const struck = ramp(t, beat(S.borrow, 'sounds'), 500);
  const icons = 1 - up;
  const row = ramp(t, beat(S.twenty, 'uses'), 1800);
  return kanji('ka', { cx: kx, cy: ky, R: kR, draw: drawn })
    + text("'add'", { x: kx + 250 * kR / 1.25, y: ky + 10, size: 40, color: INK_SOFT, p: meaning })
    + ink(new P().M(kx + 196 * kR / 1.25, ky - 4).L(kx + 304 * kR / 1.25, ky - 8), struck, { w: 5, color: RED })
    + fade(icons, text('I can see', { x: 960, y: 690, size: 40, color: INK_SOFT, p: ramp(t, beat(S.borrow, 'write'), 600) })
      + eye(760, 800, ramp(t, beat(S.borrow, 'eye'), 700))
      + tinCan(960, 800, ramp(t, beat(S.borrow, 'can'), 700))
      + sea(1160, 800, ramp(t, beat(S.borrow, 'sea'), 700)))
    // One sound, many characters: seven of the Man'yōshū's spellings of it.
    + KA_CHARS.map((c, i) => text(c, {
      x: 540 + i * 140, y: 700, size: 96, family: CJK, color: c === '加' ? RED : INK, p: clamp01(row * 7 - i),
    })).join('')
    + caption(t, beat(S.twenty, 'poems'), "Man'yōshū, after 759: all seven for one sound", 960, 800, 30);
}

// ------------------------------------------------ the family: cut, then worn
const COLS = [500, 960, 1420];
const TOP = 360, LOW = 740, OFF = 125;

/** A child leaving its character diagonally, tied back to it. */
function child(draw, p, x0, x1) {
  const e = easeInOut(clamp01(p));
  if (e <= 0.01) return '';
  const cx = lerp(x0, x1, easeOut(e)), cy = lerp(TOP, LOW, e);
  return tie(x0, TOP + 110, cx, cy - 96, clamp01(e * 2))
    + draw(e, cx, cy, clamp01(e / EMERGE));
}

function stageFamily(t) {
  const rowIn = ramp(t, shotStart(S.monks) - 200, 1800);
  const cutP = [ramp(t, beat(S.kKa, 'kept'), 2200), ramp(t, beat(S.kU, 'kept'), 2200), ramp(t, beat(S.kRi, 'kept'), 2200)];
  const wornP = [ramp(t, beat(S.hKa, 'left'), 4000), ramp(t, beat(S.hU, 'shrank'), 5500), ramp(t, beat(S.hRi, 'grain'), 3600)];
  const whole = ramp(t, beat(S.turn, 'whole'), 900);
  const redHira = ramp(t, beat(S.genji, 'flowing'), 700);
  const pics = ramp(t, beat(S.kRi, 'pictures'), 900);
  const recap = ramp(t, shotStart(S.recap) - 200, 800);

  const out = [];
  NAMES.forEach((n, i) => {
    const x = COLS[i];
    const eCut = easeInOut(cutP[i]), eWorn = easeInOut(wornP[i]);
    // The character thins as the monks' piece leaves it, is written whole
    // again at court, and thins once more as the brush's version leaves.
    const o = lerp(lerp(1, 0.6, eCut), 1, whole) * lerp(1, 0.6, eWorn);
    out.push(kanji(n, { cx: x, cy: TOP, R: 0.95, draw: clamp01(rowIn * 3 - i), opacity: o }));
    out.push(child((u, cx, cy, op) => kana(n, 'cut', u, { cx, cy, R: lerp(0.95, 0.8, u), opacity: op }),
      cutP[i], x, x + OFF));
    out.push(child((u, cx, cy, op) => kana(n, 'worn', u, { cx, cy, R: lerp(0.95, 0.8, u), opacity: op })
      + (u > 0.99 && redHira > 0 ? kana(n, 'worn', 1, { cx, cy, R: 0.8, color: RED, opacity: redHira }) : ''),
    wornP[i], x, x - OFF));
    out.push(fade(recap, text('worn', { x: x - OFF, y: 880, size: 26, color: RED, p: 1 })
      + text('cut', { x: x + OFF, y: 880, size: 26, color: INK_SOFT, p: 1 })));
  });

  // The two pieces that are still pictures: a roof, and a knife.
  const rx = COLS[1] + OFF, kx = COLS[2] + OFF, iy = 876;
  const roof = new P().M(rx - 58, iy + 12).L(rx, iy - 24).L(rx + 58, iy + 12);
  const eaves = new P().M(rx - 40, iy + 2).L(rx - 40, iy + 26).M(rx + 40, iy + 2).L(rx + 40, iy + 26);
  const handle = new P().M(kx - 64, iy + 4).L(kx - 26, iy + 4);
  const blade = new P().M(kx - 26, iy - 6).L(kx + 44, iy - 2).Q(kx + 58, iy + 4, kx + 44, iy + 12).L(kx - 26, iy + 12).Z();
  out.push(fade(1 - recap, ink(roof, pics, { w: 5, color: RED }) + ink(eaves, clamp01(pics * 2 - 1), { w: 4, color: RED })
    + ink(handle, clamp01(pics * 1.4 - 0.2), { w: 10, color: RED }) + ink(blade, clamp01(pics * 1.4 - 0.4), { w: 4, color: RED })));

  out.push(fade(1 - ramp(t, shotStart(S.turn) - 200, 600),
    caption(t, beat(S.monks, 'monks'), 'Buddhist monks, 800s: notes in the margins of sutras', 960, 215, 30)));
  out.push(fade(1 - ramp(t, shotStart(S.genji) - 200, 600),
    caption(t, beat(S.turn, 'court'), 'at court, with a brush', 960, 215, 30)));
  out.push(caption(t, beat(S.genji, 'thousand'), 'The Tale of Genji, early 1000s', 960, 215, 30));
  out.push(fade(recap, text('worn down: hiragana', { x: 700, y: 940, size: 32, color: RED, p: 1 })
    + text('cut: katakana', { x: 1220, y: 940, size: 32, color: INK_SOFT, p: 1 })));
  return out.join('');
}

// ---------------------------------------------------------------- the close
const SENTENCE = [['カ', 'k'], ['メ', 'k'], ['ラ', 'k'], ['を', 'h'], ['利', 'c'], ['用', 'c'], ['す', 'h'], ['る', 'h']];

function stageClose(t) {
  const show = ramp(t, shotStart(S.close) - 300, 900);
  const x0 = 610, step = 100, y = 520;
  const col = { k: INK, h: RED, c: INK_SOFT };
  const glyphs = SENTENCE.map(([c, kind], i) => text(c, { x: x0 + i * step, y, size: 100, family: CJK, color: col[kind], p: show })).join('');
  const under = (a, b, color, from, name) => {
    const xa = x0 + a * step - 56, xb = x0 + b * step + 56;
    return ink(new P().M(xa + 8, y + 40).L(xb - 8, y + 42), ramp(t, from, 600), { w: 5, color })
      + text(name, { x: (xa + xb) / 2, y: y + 96, size: 30, color, p: ramp(t, from + 200, 500) });
  };
  return glyphs
    + under(4, 5, INK_SOFT, beat(S.close, 'whole'), 'whole')
    + under(3, 3, RED, beat(S.close, 'worn'), 'worn') + under(6, 7, RED, beat(S.close, 'worn'), 'worn')
    + under(0, 2, INK, beat(S.close, 'cut'), 'cut')
    + text('"to use a camera"', { x: 960, y: 330, size: 32, color: INK_SOFT, p: ramp(t, beat(S.close, 'sentence'), 600) })
    + text('Not Arbitrary', { x: 960, y: 880, size: 46, color: GOLD, p: ramp(t, beat(S.close, 'cut'), 900) });
}

const EDGES = [S.borrow, S.monks, S.close];

function stageFor(t) {
  if (t < shotStart(S.borrow) - 260) return stageHook(t);
  if (t < shotStart(S.monks) - 260) return stageBorrow(t);
  if (t < shotStart(S.close) - 260) return stageFamily(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
