// Not Arbitrary, episode 6 — Circuit diagrams are a museum.
//
// Every stage runs the same figure: the object is drawn, a copy detaches and
// travels across the page while it morphs, and the object itself stays where
// it was at a quarter opacity with a dashed tie to what it became. The source
// never leaves, and the morph is never a cut.
//
// The marks come from the strip modules beside this file — those are the
// working drawings, iterated with lib/glyph.mjs before any of this was written.

import {
  P, ink, text, arrow, createFilm, smooth, lerp, clamp01, ramp, easeInOut,
  INK, INK_SOFT, RED, GOLD,
} from '../../../lib/scene-kit.mjs';
import { disc, discColour, N as PILE_N, ZINC } from './strip-battery.mjs';
import { turn, fold, TURNS } from './strip-coil-resistor.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', pile: 's02.pile.draw', name: 's03.pile.name',
  bmorph: 's04.battery.morph', breveal: 's05.battery.reveal',
  coil: 's06.coil.draw', coilrev: 's07.coil.reveal',
  res: 's08.resistor.draw', resrev: 's09.resistor.reveal',
  cap: 's10.capacitor', turn: 's11.turn', obs: 's12.obsolete',
  persist: 's13.persist', recap: 's14.recap', close: 's15.close',
};

const HOME = 660;    // where an object is drawn and where it stays
const AWAY = 1320;   // where its symbol ends up

/** Object at HOME, ghosted once its copy has left; symbol travelling to AWAY. */
function travel(drawObject, p) {
  const e = easeInOut(clamp01(p));
  const ghost = drawObject(0, HOME, lerp(1, 0.34, e));
  if (e <= 0.01) return ghost;
  const tie = ink(new P().M(HOME + 250, 560).L(AWAY - 250, 560), Math.min(1, e * 2),
    { w: 3, color: INK_SOFT, dash: '12 10', opacity: 0.55 });
  return ghost + tie + drawObject(e, lerp(HOME, AWAY, e), 1);
}

// ---------------------------------------------------------------- marks
function pile(t, cx, opacity) {
  const out = [];
  for (let i = 0; i < PILE_N; i += 1) {
    const path = smooth(disc(i, t, { cx, cy: 560, scale: 2.1 }), { closed: true, tension: 0.45 });
    out.push(`<path d="${path.d()}" fill="${discColour(i, t)}" opacity="${opacity.toFixed(2)}"/>`);
  }
  if (t > 0.6) {
    const o = ((t - 0.6) / 0.4) * opacity;
    out.push(`<path d="M ${cx} 300 L ${cx} 392 M ${cx} 728 L ${cx} 820" stroke="${INK}" stroke-width="7" stroke-linecap="round" opacity="${o.toFixed(2)}"/>`);
  }
  return out.join('');
}

function coil(t, cx, opacity) {
  const opts = { x0: cx - 315, span: 158, base: 620, scale: 1.5 };
  const out = [];
  if (t < 0.55) {
    out.push(`<rect x="${cx - 340}" y="${500}" width="680" height="138" rx="69" fill="hsl(30,24%,78%)" opacity="${((1 - t / 0.55) * 0.5 * opacity).toFixed(2)}"/>`);
  }
  for (let i = 0; i < TURNS; i += 1) {
    out.push(ink(smooth(turn(i, t, opts), { tension: 0.9 }), 1, { w: 11, color: INK, opacity }));
  }
  if (t > 0.5) {
    const o = ((t - 0.5) / 0.5) * opacity;
    out.push(ink(new P().M(cx - 400, 620).L(cx - 315, 620), 1, { w: 10, color: INK, opacity: o }));
    out.push(ink(new P().M(cx + 317, 620).L(cx + 400, 620), 1, { w: 10, color: INK, opacity: o }));
  }
  return out.join('');
}

function resistor(t, cx, opacity) {
  const opts = { x0: cx - 300, span: 150, mid: 560, amp: 104, scale: 1 };
  const out = [];
  for (let i = 0; i < TURNS; i += 1) {
    out.push(ink(smooth(fold(i, t, opts), { tension: lerp(1, 0.12, t) }), 1, { w: 11, color: INK, opacity }));
  }
  if (t > 0.5) {
    const o = ((t - 0.5) / 0.5) * opacity;
    out.push(ink(new P().M(cx - 385, 560).L(cx - 300, 560), 1, { w: 10, color: INK, opacity: o }));
    out.push(ink(new P().M(cx + 300, 560).L(cx + 385, 560), 1, { w: 10, color: INK, opacity: o }));
  }
  return out.join('');
}

/** Two plates across a gap. The one mark in the film that does not change. */
function plates(t, cx, opacity) {
  const thick = lerp(26, 11, t);
  const out = [];
  for (const side of [-1, 1]) {
    const y = 560 + side * 46;
    out.push(`<rect x="${cx - 150}" y="${(y - thick / 2).toFixed(1)}" width="300" height="${thick.toFixed(1)}" rx="${(thick / 2).toFixed(1)}" fill="${INK}" opacity="${opacity.toFixed(2)}"/>`);
    out.push(ink(new P().M(cx, y + side * thick / 2).L(cx, y + side * 120), 1, { w: 9, color: INK, opacity }));
  }
  return out.join('');
}

const nameplate = (t, from, label, sub, x = AWAY) =>
  text(label, { x, y: 880, size: 46, color: RED, p: ramp(t, from, 420) })
  + text(sub, { x, y: 936, size: 32, color: INK_SOFT, p: ramp(t, from + 220, 420) });

// ---------------------------------------------------------------- stages
function stageHook(t) {
  return text('Every circuit diagram', { x: 960, y: 430, size: 76, p: ramp(t, beat(S.hook, 'Open'), 900) })
    + text('is a drawing of something', { x: 960, y: 520, size: 76, p: ramp(t, beat(S.hook, 'drawings'), 900) })
    + text('that no longer exists.', { x: 960, y: 610, size: 76, color: RED, p: ramp(t, beat(S.hook, 'stopped'), 900) });
}

function stageBattery(t) {
  const draw = ramp(t, beat(S.pile, 'stacked'), 2400);
  const morph = ramp(t, beat(S.bmorph, 'draw'), 2600);
  // Before the copy leaves, the pile is simply drawn in place.
  const front = morph <= 0.01 ? pile(0, HOME, 1) : travel((p, cx, o) => pile(p, cx, o), morph);
  return (draw <= 0 ? '' : front)
    + text("Volta's pile, 1799", { x: HOME, y: 880, size: 38, color: INK_SOFT, p: ramp(t, beat(S.name, 'pile'), 600) })
    + (morph > 0.05 ? nameplate(t, beat(S.breveal, 'Copper'), 'a battery', 'long copper, short zinc') : '');
}

function stageCoil(t) {
  const draw = ramp(t, beat(S.coil, 'Wind'), 1800);
  const morph = ramp(t, beat(S.coilrev, 'Press'), 2200);
  const front = morph <= 0.01 ? coil(0, HOME, draw > 0 ? 1 : 0) : travel((p, cx, o) => coil(p, cx, o), morph);
  return (draw <= 0 ? '' : front)
    + text('wire wound round a finger', { x: HOME, y: 880, size: 38, color: INK_SOFT, p: ramp(t, beat(S.coil, 'finger'), 600) })
    + (morph > 0.05 ? nameplate(t, beat(S.coilrev, 'object'), 'an inductor', 'the turns that face you') : '');
}

function stageResistor(t) {
  const draw = ramp(t, beat(S.res, 'folded'), 2000);
  const morph = ramp(t, beat(S.resrev, 'Draw'), 2200);
  const front = morph <= 0.01 ? resistor(0, HOME, draw > 0 ? 1 : 0) : travel((p, cx, o) => resistor(p, cx, o), morph);
  return (draw <= 0 ? '' : front)
    + text('a wire folded to fit', { x: HOME, y: 880, size: 38, color: INK_SOFT, p: ramp(t, beat(S.res, 'wire'), 600) })
    + (morph > 0.05 ? nameplate(t, beat(S.resrev, 'peak'), 'a resistor', 'one peak per fold') : '');
}

/** The deliberate non-morph: the argument is that nothing happened. */
function stageCapacitor(t) {
  const draw = ramp(t, beat(S.cap, 'plates'), 1600);
  const second = ramp(t, beat(S.cap, 'centuries'), 1400);
  return plates(0, HOME, draw)
    + text('two plates, a gap', { x: HOME, y: 880, size: 38, color: INK_SOFT, p: draw })
    + (second > 0.02
      ? ink(new P().M(HOME + 230, 560).L(AWAY - 230, 560), Math.min(1, second * 2), { w: 3, color: INK_SOFT, dash: '12 10', opacity: 0.55 })
        + plates(1, AWAY, second)
        + text('two plates, a gap', { x: AWAY, y: 880, size: 38, color: RED, p: ramp(t, beat(S.cap, 'lines'), 500) })
      : '');
}

function stageTurn(t) {
  return text('Almost none of those', { x: 960, y: 470, size: 80, p: ramp(t, beat(S.turn, 'Here'), 800) })
    + text('objects still exist.', { x: 960, y: 570, size: 80, color: RED, p: ramp(t, beat(S.turn, 'Almost'), 900) });
}

/** A modern cell and a modern chip resistor, beside the marks that mean them. */
function stageObsolete(t) {
  const a = ramp(t, beat(S.obs, 'battery'), 900);
  const b = ramp(t, beat(S.obs, 'resistor'), 900);
  const keep = ramp(t, beat(S.persist, 'outlived'), 900);
  const out = [];
  // modern lithium cell
  out.push(`<rect x="380" y="400" width="300" height="170" rx="22" fill="${INK}" opacity="${(a * 0.9).toFixed(2)}"/>`);
  out.push(`<rect x="680" y="452" width="26" height="66" rx="8" fill="${INK}" opacity="${(a * 0.9).toFixed(2)}"/>`);
  out.push(text('a lithium cell', { x: 530, y: 620, size: 34, color: INK_SOFT, p: a }));
  // modern chip resistor
  out.push(`<rect x="400" y="720" width="230" height="96" rx="10" fill="${INK_SOFT}" opacity="${(b * 0.9).toFixed(2)}"/>`);
  out.push(`<rect x="400" y="720" width="42" height="96" rx="10" fill="${INK}" opacity="${(b * 0.9).toFixed(2)}"/>`);
  out.push(`<rect x="588" y="720" width="42" height="96" rx="10" fill="${INK}" opacity="${(b * 0.9).toFixed(2)}"/>`);
  out.push(text('carbon on ceramic', { x: 515, y: 866, size: 34, color: INK_SOFT, p: b }));
  // the marks that still mean them
  out.push(`<g opacity="${keep.toFixed(2)}">${pile(1, 1280, 0.95)}</g>`);
  out.push(`<g opacity="${keep.toFixed(2)}">${arrow(keep, { x0: 760, x1: 1000, y: 485 })}</g>`);
  out.push(text('still drawn as this', { x: 1280, y: 900, size: 36, color: RED, p: ramp(t, beat(S.persist, 'sketches'), 700) }));
  return out.join('');
}

const RECAP = [
  ['battery', 400, (m, x, o) => pile(m, x, o)],
  ['inductor', 800, (m, x, o) => coil(m, x, o)],
  ['resistor', 1180, (m, x, o) => resistor(m, x, o)],
  ['capacitor', 1560, (m, x, o) => plates(m, x, o)],
];

/** Object above, mark below, tied — the set's whole claim, four times over. */
function stageRecap(t) {
  // The whole grid lands in the first moment; only the names arrive on cues, so
  // the page is never two-thirds empty waiting for unevenly spaced narration.
  const row = ramp(t, shotStart(S.recap) - 200, 700);
  const cues = ['tower', 'coil', 'folded', 'plates'];
  const place = (y, x, inner) => `<g transform="translate(0 ${y}) translate(${x} 560) scale(0.30) translate(${-x} -560)">${inner}</g>`;
  return RECAP.flatMap(([name, x, draw], i) => [
    `<g opacity="${(row * 0.6).toFixed(2)}">${place(-140, x, draw(0, x, 1))}</g>`,
    ink(new P().M(x, 520).L(x, 610), row, { w: 3, color: INK_SOFT, dash: '9 8' }),
    `<g opacity="${row.toFixed(2)}">${place(160, x, draw(1, x, 1))}</g>`,
    text(name, { x, y: 860, size: 40, color: RED, p: ramp(t, beat(S.recap, cues[i]), 500) }),
  ]).join('');
}

function stageClose(t) {
  return text('A circuit diagram is not notation.', { x: 960, y: 460, size: 66, p: ramp(t, beat(S.close, 'notation'), 900) })
    + text('It is a museum.', { x: 960, y: 580, size: 80, color: RED, p: ramp(t, beat(S.close, 'museum'), 900) })
    + text('Not Arbitrary', { x: 960, y: 880, size: 46, color: INK_SOFT, p: ramp(t, beat(S.close, 'exhibits'), 900) });
}

const EDGES = [S.pile, S.coil, S.res, S.cap, S.turn, S.obs, S.recap, S.close];

function stageFor(t) {
  if (t < shotStart(S.pile) - 260) return stageHook(t);
  if (t < shotStart(S.coil) - 260) return stageBattery(t);
  if (t < shotStart(S.res) - 260) return stageCoil(t);
  if (t < shotStart(S.cap) - 260) return stageResistor(t);
  if (t < shotStart(S.turn) - 260) return stageCapacitor(t);
  if (t < shotStart(S.obs) - 260) return stageTurn(t);
  if (t < shotStart(S.recap) - 260) return stageObsolete(t);
  if (t < shotStart(S.close) - 260) return stageRecap(t);
  return stageClose(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
