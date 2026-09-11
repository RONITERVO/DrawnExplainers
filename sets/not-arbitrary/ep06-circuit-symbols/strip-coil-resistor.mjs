// Working drawings: the coil and the folded wire.
//   node lib/glyph.mjs sets/not-arbitrary/ep06-circuit-symbols/strip-coil-resistor.mjs strip.png 5
//
// Coil: wire wound round a finger. The turns that face you are already the
// inductor symbol — take the finger away and flatten them and nothing else has
// to happen. Resistor: a wire folded back on itself, U-turns tightening into
// the V-turns of a zigzag. Both keep their anchor count and direction fixed.

import { smooth, ink, lerp, INK, INK_SOFT } from '../../../lib/scene-kit.mjs';

export const CELL = 600;
export const TURNS = 4;

/** One turn of the coil: an arc from baseline up and over, back to baseline. */
export function turn(i, t, { x0 = 90, span = 105, base = 240, scale = 1 } = {}) {
  const x = x0 + i * span * scale;
  const w = span * scale;
  // Wrapped round a finger the turn is a tall slanted ellipse; pressed flat it
  // is a plain semicircle. Only the height, slant and depth change.
  const rise = lerp(86, 62, t) * scale;
  const slant = lerp(20, 0, t) * scale;
  const belly = lerp(26, 0, t) * scale;
  return [
    [x, base + belly],
    [x + w * 0.18 - slant, base - rise * 0.72],
    [x + w * 0.5 - slant * 0.4, base - rise],
    [x + w * 0.82, base - rise * 0.72],
    [x + w, base + belly],
  ];
}

/** The finger the wire is wound around; gone by the time it is a symbol. */
function finger(t) {
  if (t > 0.55) return '';
  const o = (1 - t / 0.55).toFixed(2);
  return `<rect x="70" y="212" width="460" height="92" rx="46" fill="hsl(30,24%,78%)" opacity="${(o * 0.55).toFixed(2)}"/>`;
}

/** A folded wire: out, 180 degrees round, back. Tightens into a zigzag. */
export function fold(i, t, { x0 = 80, span = 110, mid = 430, amp = 78, scale = 1 } = {}) {
  const x = x0 + i * span * scale;
  const w = span * scale;
  const up = i % 2 === 0 ? -1 : 1;
  // The cap of a U-turn is two anchors set apart; pull them together and the
  // U becomes the V of a zigzag. Same anchors throughout.
  const capHalf = lerp(w * 0.3, 0, t);
  return [
    [x, mid - up * amp * scale],
    [x + w * 0.5 - capHalf, mid + up * amp * scale],
    [x + w * 0.5 + capHalf, mid + up * amp * scale],
    [x + w, mid - up * amp * scale],
  ];
}

export const anchors = (t) => turn(0, t).concat(fold(0, t));

export function render(t) {
  const out = [finger(t)];

  // coil
  for (let i = 0; i < TURNS; i += 1) {
    out.push(ink(smooth(turn(i, t), { tension: 0.9 }), 1, { w: 9, color: INK }));
  }
  if (t > 0.5) {
    const o = ((t - 0.5) / 0.5).toFixed(2);
    out.push(`<path d="M 40 240 L 90 240 M 510 240 L 560 240" stroke="${INK}" stroke-width="8" stroke-linecap="round" opacity="${o}"/>`);
  }

  // folded wire -> zigzag
  for (let i = 0; i < TURNS; i += 1) {
    out.push(ink(smooth(fold(i, t), { tension: lerp(1, 0.12, t) }), 1, { w: 9, color: INK_SOFT }));
  }
  return out.join('');
}
