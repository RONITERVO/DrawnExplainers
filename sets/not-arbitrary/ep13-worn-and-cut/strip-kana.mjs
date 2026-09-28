// Working drawings: three Chinese characters, each written two ways.
//   node lib/glyph.mjs sets/not-arbitrary/ep13-worn-and-cut/strip-kana.mjs strip.png 5
//
// Every stroke of the character is a run, and each run has three states:
// the character (traced from Yu Gothic, in a 240 box), the katakana it was
// cut down to, and the hiragana it was worn down to. A run that a branch
// does not keep has no state there: it thins away where it stands.
//
//   加 'add'     -> カ  the left side, 力, kept      (Wiktionary: "taken from the
//                   か  written in the cursive        left part of the character";
//                       style: 力 flows, 口 becomes    "derived ... from writing
//                       the flick at the upper right   加 in the cursive sōsho style")
//   宇 'roof'    -> ウ  the roof, 宀, kept             ("taken from the top part")
//                   う  the dot of the roof becomes
//                       the tick; the roof's cross
//                       stroke and 于's hook run
//                       together into one curve
//   利 'profit'  -> リ  the knife, 刂, kept            (the right part)
//                   り  禾's upright is the left
//                       stroke, 刂's hook the right
//
// Where the cursive joins two strokes into one - う's curve - it is drawn
// as two runs that meet end to end, so the part count never changes; the
// pen lift closes, it does not merge anything.
//
// Every kept run keeps its direction: top to bottom, left to right, as a
// brush writes it.

import { smooth, ink, blend, clamp01, lerp, INK, INK_SOFT } from '../../../lib/scene-kit.mjs';

export const CELL = 600;

const CHARS = {
  ka: [
    { k: [[-104, -44], [-24, -44], [-26, 40], [-30, 92], [-48, 78]],
      c: [[-80, -48], [66, -48], [58, 30], [40, 100], [18, 86]],
      h: [[-94, -36], [8, -52], [34, -4], [12, 90], [-12, 78]] },
    { k: [[-66, -104], [-72, -20], [-90, 50], [-112, 96]],
      c: [[-14, -106], [-18, -30], [-40, 40], [-84, 104]],
      h: [[-38, -104], [-48, -12], [-68, 50], [-92, 92]] },
    { k: [[8, -34], [8, 70]] },
    { k: [[8, -34], [104, -34], [104, 70]],
      h: [[60, -72], [78, -42], [92, -4]] },
    { k: [[8, 64], [104, 64]] },
  ],
  u: [
    { k: [[0, -118], [6, -96]], c: [[0, -110], [4, -80]], h: [[-18, -112], [26, -88]] },
    { k: [[-92, -84], [-94, -56]], c: [[-78, -66], [-80, -8]] },
    { k: [[-92, -84], [0, -84], [92, -84], [86, -70], [80, -58]],
      c: [[-78, -66], [0, -66], [74, -66], [64, 30], [10, 104]],
      h: [[-66, -22], [-10, -40], [40, -36], [60, -6], [58, 26]] },
    { k: [[-62, -30], [62, -30]] },
    { k: [[-104, 18], [104, 18]] },
    { k: [[0, -30], [0, 20], [0, 64], [0, 104], [-22, 88]],
      h: [[58, 26], [48, 62], [18, 90], [-18, 103], [-40, 104]] },
  ],
  ri: [
    { k: [[-30, -112], [-96, -92]] },
    { k: [[-110, -62], [-22, -62]] },
    { k: [[-66, -100], [-66, 40], [-66, 110]],
      h: [[-52, -74], [-56, 10], [-44, 34]] },
    { k: [[-66, -50], [-90, -4], [-112, 36]] },
    { k: [[-60, -46], [-38, -20], [-22, 10]] },
    { k: [[22, -78], [22, 44]], c: [[-40, -80], [-40, 40]] },
    { k: [[86, -110], [86, 0], [86, 104], [64, 88]],
      c: [[46, -104], [46, -10], [30, 70], [-6, 106]],
      h: [[40, -96], [46, -20], [30, 60], [-20, 108]] },
  ],
};

export const NAMES = Object.keys(CHARS);

/**
 * Character `name` moved `u` of the way down one branch: 'cut' (katakana)
 * or 'worn' (hiragana). u = 0 is the character itself.
 * Runs the branch drops thin out over the first two thirds of the move and
 * shrink a little toward where they stood, so nothing flies across the page.
 */
export function kana(name, branch, u, {
  cx = 300, cy = 300, R = 1, w = 11, opacity = 1, draw = 1, color = INK, dropColor = null,
} = {}) {
  const key = branch === 'cut' ? 'c' : 'h';
  const e = clamp01(u);
  const runs = CHARS[name];
  const on = i => clamp01(clamp01(draw) * runs.length - i);
  const tension = branch === 'cut' ? lerp(0.5, 0.35, e) : lerp(0.5, 0.95, e);
  return runs.map((run, i) => {
    const kept = run[key];
    let pts, o = opacity;
    if (kept) {
      pts = blend(run.k, kept, e);
    } else {
      const fade = clamp01(e * 1.5);
      if (fade >= 0.999) return '';
      const mx = run.k.reduce((s, p) => s + p[0], 0) / run.k.length;
      const my = run.k.reduce((s, p) => s + p[1], 0) / run.k.length;
      pts = run.k.map(([x, y]) => [lerp(x, mx, fade * 0.3), lerp(y, my, fade * 0.3)]);
      o = opacity * (1 - fade);
    }
    const col = !kept && dropColor ? dropColor : color;
    return ink(smooth(pts.map(([x, y]) => [cx + x * R, cy + y * R]), { tension }), on(i), { w: w * Math.max(0.5, R), color: col, opacity: o });
  }).join('');
}

/** The character alone. */
export const kanji = (name, opts) => kana(name, 'cut', 0, opts);

// ---------------------------------------------------------------- strip
export function render(t) {
  const u = clamp01(t);
  return NAMES.map((n, i) => {
    const y = 110 + i * 190;
    return kana(n, 'worn', u, { cx: 150, cy: y, R: 0.62, w: 9 })
      + kanji(n, { cx: 300, cy: y, R: 0.62, w: 9, color: INK_SOFT })
      + kana(n, 'cut', u, { cx: 450, cy: y, R: 0.62, w: 9 });
  }).join('')
    + `<text x="16" y="${CELL - 16}" font-family="monospace" font-size="16" fill="${INK_SOFT}">worn (hiragana) | character | cut (katakana)</text>`;
}
