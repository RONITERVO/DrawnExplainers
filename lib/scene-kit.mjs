// Shared drawing kit for every episode.
//
// An episode supplies pictograms and a stage schedule. Everything here — the
// paper, the ruling, the tremble, the draw-on, the two-column reveal — is the
// house style, and lives in one place so episodes stay short and consistent.

import { readFileSync } from 'node:fs';

// Palette lifted from MaestroTutor's public/artifact-loading-scene.svg, so the
// films and the app read as the same hand.
export const INK = 'hsl(25, 15%, 25%)';
export const INK_SOFT = 'hsl(25, 14%, 42%)';
export const PAPER = 'hsl(39, 40%, 96%)';
export const DESK = 'hsl(35, 28%, 89%)';
export const EDGE = 'hsl(30, 24%, 78%)';
export const RED = 'hsl(18, 60%, 55%)';
export const GREEN = 'hsl(120, 30%, 40%)';
export const BLUE = 'hsl(205, 45%, 52%)';
export const GOLD = 'hsl(43, 62%, 66%)';
const TAPE = 'hsla(38, 45%, 70%, 0.55)';

export const HAND = 'Segoe Print';
export const CJK = 'HYSWLongFangSong';
export const FONT_FILES = [
  'C:/Windows/Fonts/segoepr.ttf',
  'C:/Windows/Fonts/segoeprb.ttf',
  'C:/Windows/Fonts/hyswlongfangsong.ttf',
];

export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const HEAD_MS = 900;
export const GAP_MS = 520;
export const TAIL_MS = 1500;

// ---------------------------------------------------------------- easing
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOut = p => 1 - Math.pow(1 - clamp01(p), 3);
export const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * clamp01(p) + 2, 3) / 2);
export const lerp = (a, b, p) => a + (b - a) * p;
export const ramp = (t, from, dur) => clamp01((t - from) / dur);

// ---------------------------------------------------------------- boil
// Set once per frame from the frame index. renderFrame stays deterministic in
// (t, frameIndex), which is all the pipeline relies on; every worker thread
// holds its own copy of this module, so parallel rendering is safe.
let JITTER = { seed: 0, amt: 1.9 };
export const setBoil = (frameIndex) => {
  JITTER = { seed: (Math.floor(frameIndex / 3) * 7919) % 997, amt: 1.9 };
};
function jog(i) {
  const x = Math.sin(i * 127.1 + JITTER.seed * 311.7) * 43758.5453;
  return ((x - Math.floor(x)) * 2 - 1) * JITTER.amt;
}

// ---------------------------------------------------------------- geometry
/**
 * Paths are built rather than parsed so their length is exactly computable —
 * stroke-dashoffset draw-on needs a real length or strokes finish early or
 * never complete.
 *
 * The hand tremble is baked into the emitted geometry rather than painted on
 * with feTurbulence + feDisplacementMap. A displacement filter evaluates noise
 * per pixel over its whole region every frame; at 1920x1080 that cost more
 * than everything else in the pipeline put together. Nudged control points are
 * free, and straight runs bowed through a jittered midpoint read more like a
 * hand than the filter did.
 */
export class P {
  constructor() { this.seg = []; }
  M(x, y) { this.seg.push(['M', x, y]); return this; }
  L(x, y) { this.seg.push(['L', x, y]); return this; }
  Q(cx, cy, x, y) { this.seg.push(['Q', cx, cy, x, y]); return this; }
  C(a, b, c, d, x, y) { this.seg.push(['C', a, b, c, d, x, y]); return this; }
  Z() { this.seg.push(['Z']); return this; }

  d() {
    let k = 0;
    const jx = () => jog(k++);
    const jy = () => jog(k++ + 5000);
    const n = v => v.toFixed(1);
    const out = [];
    let cx = 0, cy = 0;
    for (const s of this.seg) {
      if (s[0] === 'M') { [, cx, cy] = s; out.push(`M ${n(cx + jx())} ${n(cy + jy())}`); continue; }
      if (s[0] === 'Z') { out.push('Z'); continue; }
      if (s[0] === 'L') {
        const [, x, y] = s;
        const mx = (cx + x) / 2 + jog(k++) * 1.7;
        const my = (cy + y) / 2 + jog(k++ + 5000) * 1.7;
        out.push(`Q ${n(mx)} ${n(my)} ${n(x + jx())} ${n(y + jy())}`);
        cx = x; cy = y; continue;
      }
      if (s[0] === 'Q') {
        const [, qx, qy, x, y] = s;
        out.push(`Q ${n(qx + jx())} ${n(qy + jy())} ${n(x + jx())} ${n(y + jy())}`);
        cx = x; cy = y; continue;
      }
      const [, a, b, c, dd, x, y] = s;
      out.push(`C ${n(a + jx())} ${n(b + jy())} ${n(c + jx())} ${n(dd + jy())} ${n(x + jx())} ${n(y + jy())}`);
      cx = x; cy = y;
    }
    return out.join(' ');
  }

  len() {
    let total = 0;
    let cx = 0, cy = 0, sx = 0, sy = 0;
    const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
    for (const s of this.seg) {
      if (s[0] === 'M') { [, cx, cy] = s; sx = cx; sy = cy; continue; }
      if (s[0] === 'L') { total += dist(cx, cy, s[1], s[2]); [, cx, cy] = s; continue; }
      if (s[0] === 'Z') { total += dist(cx, cy, sx, sy); cx = sx; cy = sy; continue; }
      const steps = 24;
      let px = cx, py = cy;
      for (let i = 1; i <= steps; i += 1) {
        const u = i / steps;
        const m = 1 - u;
        let x, y;
        if (s[0] === 'Q') {
          const [, qx, qy, ex, ey] = s;
          x = m * m * cx + 2 * m * u * qx + u * u * ex;
          y = m * m * cy + 2 * m * u * qy + u * u * ey;
        } else {
          const [, a, b, c, d, ex, ey] = s;
          x = m ** 3 * cx + 3 * m * m * u * a + 3 * m * u * u * c + u ** 3 * ex;
          y = m ** 3 * cy + 3 * m * m * u * b + 3 * m * u * u * d + u ** 3 * ey;
        }
        total += dist(px, py, x, y);
        px = x; py = y;
      }
      cx = px; cy = py;
    }
    return total;
  }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A stroke that draws itself on. Nothing in these films pops in. */
export function ink(path, p, { w = 5, color = INK, opacity = 1, dash = null } = {}) {
  const prog = clamp01(p);
  if (prog <= 0.001) return '';
  const base = `d="${path.d()}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  if (dash) return `<path ${base} stroke-dasharray="${dash}" opacity="${(opacity * prog).toFixed(3)}"/>`;
  if (prog >= 0.999) return `<path ${base} opacity="${opacity.toFixed(3)}"/>`;
  const L = path.len();
  return `<path ${base} stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${(L * (1 - prog)).toFixed(1)}" opacity="${opacity.toFixed(3)}"/>`;
}

export function fill(path, p, { color = INK, opacity = 1 } = {}) {
  const o = easeOut(p) * opacity;
  return o <= 0.001 ? '' : `<path d="${path.d()}" fill="${color}" opacity="${o.toFixed(3)}"/>`;
}

/**
 * Ink flooding into a shape, rising from the bottom.
 *
 * A drawn outline becoming a solid printed mark is a different event from a
 * shape fading up, and `fill()` cannot do it: a mark built from several
 * overlapping paths goes blotchy at partial opacity, because every overlap
 * doubles. A clip wipe keeps the paint at full opacity throughout and only
 * moves the waterline, so a union of paths floods as one shape.
 *
 * Pass the box the shape actually occupies; the wipe takes `p` to cross it.
 */
export function flood(paths, p, { color = INK, x = 0, y = 0, w = W, h = H } = {}) {
  const prog = easeInOut(clamp01(p));
  if (prog <= 0.001) return '';
  const body = paths.map(path => `<path d="${path.d()}" fill="${color}"/>`).join('');
  if (prog >= 0.999) return body;
  const id = `flood${clipSeq += 1}`;
  const rise = h * prog;
  return `<clipPath id="${id}"><rect x="${x.toFixed(1)}" y="${(y + h - rise).toFixed(1)}" width="${w.toFixed(1)}" height="${rise.toFixed(1)}"/></clipPath><g clip-path="url(#${id})">${body}</g>`;
}

/**
 * Show `inner` only where it falls inside `paths`. Several paths in one
 * clipPath union, which is what makes a stencil aperture out of a mark that is
 * built from overlapping pieces.
 */
export function clipTo(paths, inner) {
  const id = `cut${clipSeq += 1}`;
  const shape = paths.map(path => `<path d="${path.d()}"/>`).join('');
  return `<clipPath id="${id}">${shape}</clipPath><g clip-path="url(#${id})">${inner}</g>`;
}

export function text(str, { x, y, size, family = HAND, color = INK, p = 1, anchor = 'middle', weight = 'normal', rise = 12 }) {
  const o = easeOut(p);
  if (o <= 0.001) return '';
  return `<text x="${x.toFixed(1)}" y="${(y + (1 - o) * rise).toFixed(1)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" opacity="${o.toFixed(3)}">${esc(str)}</text>`;
}

/** A glyph written on top-to-bottom, the way a hand would put it down. */
let clipSeq = 0;
export function write(str, { x, y, size, family = CJK, color = INK, p = 1, weight = 'normal' }) {
  const prog = clamp01(p);
  if (prog <= 0.001) return '';
  const body = `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="middle">${esc(str)}</text>`;
  if (prog >= 0.999) return body;
  const id = `wipe${clipSeq += 1}`;
  return `<clipPath id="${id}"><rect x="${(x - size * 2.6).toFixed(1)}" y="${(y - size * 0.95).toFixed(1)}" width="${(size * 5.2).toFixed(1)}" height="${(size * 1.2 * easeInOut(prog)).toFixed(1)}"/></clipPath><g clip-path="url(#${id})">${body}</g>`;
}

export function arrow(p, { x0 = 950, x1 = 1120, y = 560 } = {}) {
  return ink(new P().M(x0, y).L(x1, y), p, { w: 4, color: INK_SOFT })
    + ink(new P().M(x1 - 22, y - 16).L(x1, y).L(x1 - 22, y + 16), Math.max(0, p * 2 - 1), { w: 4, color: INK_SOFT });
}

/** The name block under a revealed glyph. */
export function nameplate(t, from, { sound, gloss, x = 1330 }) {
  return text(sound, { x, y: 790, size: 46, color: RED, p: ramp(t, from, 420) })
    + text(gloss, { x, y: 848, size: 34, color: INK_SOFT, p: ramp(t, from + 220, 420) });
}

/**
 * The picture holds the centre of the page while it is the only thing on it,
 * then slides left and settles smaller as the glyph arrives beside it. Without
 * this the drawing sits marooned in one corner of a very empty page.
 */
export function twoColumn(picture, reveal, revealP) {
  const e = easeInOut(clamp01(revealP));
  return `<g transform="translate(${lerp(300, 0, e).toFixed(1)} ${lerp(-96, -44, e).toFixed(1)}) translate(655 560) scale(${lerp(1.42, 1.06, e).toFixed(3)}) translate(-655 -560)">${picture}</g>${reveal}`;
}

// ---------------------------------------------------------------- timeline
/**
 * Builds the shot schedule from the generated audio and the Whisper alignment,
 * and returns the frame wrapper. Word onsets come from Whisper: SyncVoice's own
 * cues are either fragment-arrival artifacts or a uniform spread, and neither
 * is a real onset.
 */
export function createFilm(dirUrl) {
  const at = (rel) => JSON.parse(readFileSync(new URL(rel, dirUrl), 'utf8'));
  const timing = at('./timing.json');
  const manifest = at('./assets/syncvoice/manifest.json');

  const SHOTS = [];
  let cursor = HEAD_MS;
  for (const entry of manifest.entries) {
    SHOTS.push({
      id: entry.externalId,
      start: cursor,
      dur: entry.durationMs,
      end: cursor + entry.durationMs,
      words: timing[entry.externalId].words,
    });
    cursor += entry.durationMs + GAP_MS;
  }
  const TOTAL_MS = cursor - GAP_MS + TAIL_MS;
  const byId = new Map(SHOTS.map(s => [s.id, s]));
  const clean = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  /** Absolute ms at which a given word is spoken. The whole point of aligning. */
  function beat(shotId, word, nth = 0) {
    const shot = byId.get(shotId);
    const target = clean(word);
    let seen = 0;
    for (const w of shot.words) {
      if (clean(w.word) === target) {
        if (seen === nth) return shot.start + w.startMs;
        seen += 1;
      }
    }
    return shot.start;
  }

  const shotStart = id => byId.get(id).start;

  /** Cross-fade the page turn so stages do not cut abruptly. */
  function stageOpacity(t, edges) {
    for (const id of edges) {
      const cut = shotStart(id) - 260;
      if (Math.abs(t - cut) < 240) return 0.15 + 0.85 * (Math.abs(t - cut) / 240);
    }
    return 1;
  }

  function chrome(cardIn) {
    const cardX = 96, cardY = 56, cardW = W - 192, cardH = H - 112;
    const border = new P()
      .M(cardX + 26, cardY + 12).L(cardX + cardW - 26, cardY + 16)
      .L(cardX + cardW - 14, cardY + cardH - 22).L(cardX + 20, cardY + cardH - 14).Z();
    const ruling = [];
    for (let y = cardY + 148; y < cardY + cardH - 60; y += 64) {
      ruling.push(`<line x1="${cardX + 70}" y1="${y}" x2="${cardX + cardW - 70}" y2="${y}" stroke="${EDGE}" stroke-width="1.7"/>`);
    }
    ruling.push(`<line x1="${cardX + 168}" y1="${cardY + 52}" x2="${cardX + 162}" y2="${cardY + cardH - 46}" stroke="${RED}" stroke-width="2.4" opacity="0.55"/>`);
    // Two stacked translucent rects stand in for a drop shadow. A real
    // feDropShadow is a Gaussian blur across the whole card, every frame, for a
    // result nobody can tell apart at 1080p.
    return `<rect x="${cardX + 5}" y="${cardY + 12}" width="${cardW}" height="${cardH}" rx="26" fill="hsl(25, 30%, 20%)" opacity="${(cardIn * 0.07).toFixed(3)}"/>
  <rect x="${cardX + 2}" y="${cardY + 6}" width="${cardW}" height="${cardH}" rx="26" fill="hsl(25, 30%, 20%)" opacity="${(cardIn * 0.07).toFixed(3)}"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="26" fill="${PAPER}" stroke="${EDGE}" stroke-width="2" opacity="${cardIn.toFixed(3)}"/>
  <g opacity="0.5">${ink(border, cardIn, { w: 2.5, color: EDGE, dash: '14 9' })}</g>
  <g opacity="${(cardIn * 0.34).toFixed(3)}">${ruling.join('')}</g>
  <rect x="${W / 2 - 92}" y="${cardY - 14}" width="184" height="34" rx="3" fill="${TAPE}" transform="rotate(-1.4 ${W / 2} ${cardY})" opacity="${cardIn.toFixed(3)}"/>`;
  }

  /** Wrap an episode's stage schedule into the frame function the pipeline calls. */
  function wrap(stageFor, edges) {
    return function renderFrame(t, frameIndex) {
      clipSeq = 0;
      setBoil(frameIndex);
      const floatY = Math.sin((t / 5200) * Math.PI * 2) * 4.5;
      const floatR = Math.sin((t / 6800) * Math.PI * 2) * 0.45;
      const cardIn = easeOut(ramp(t, 120, 700));
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${DESK}"/>
<g transform="translate(0 ${floatY.toFixed(2)}) rotate(${floatR.toFixed(3)} ${W / 2} ${H / 2})">
  ${chrome(cardIn)}
  <g opacity="${stageOpacity(t, edges).toFixed(3)}">${stageFor(t)}</g>
</g>
</svg>`;
    };
  }

  return { SHOTS, TOTAL_MS, FPS, beat, shotStart, wrap };
}
