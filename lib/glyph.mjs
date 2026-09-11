// Iterate on a mark without rendering a film.
//
//   node lib/glyph.mjs <strip.mjs> [out.png] [steps]
//
// Run from the project root — an episode directory has no node_modules, so
// @resvg/resvg-js will not resolve from inside one.
//
// `--preview` is the wrong instrument for designing a glyph: it costs a full
// pipeline render per attempt, at film scale, under paper and ruling and hand
// tremble, and shows you one instant. This lays the whole morph out as a strip
// at working scale with the anchors numbered, so a wrong control point is
// visible instead of guessed at. Five iterations take a minute.
//
// The strip module must export:
//   render(t)   -> SVG fragment, drawn inside a 0..CELL box (default 600)
//   anchors(t)  -> optional [[x, y], ...] to dot and number
//   CELL        -> optional box size, default 600

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FONT_FILES, PAPER, INK_SOFT, RED } from './scene-kit.mjs';

const [, , modPath, outArg, stepsArg] = process.argv;
if (!modPath) {
  console.error('usage: node lib/glyph.mjs <strip.mjs> [out.png] [steps]');
  process.exit(2);
}

const mod = await import(pathToFileURL(resolve(modPath)).href);
const CELL = mod.CELL || 600;
const steps = Number(stepsArg) || 5;
const out = outArg || 'glyph-strip.png';
const SCALE = 1.5;
const PAD = 24;

const cells = [];
for (let i = 0; i < steps; i += 1) {
  const t = steps === 1 ? 0 : i / (steps - 1);
  const x = PAD + i * (CELL + PAD);
  const dots = (mod.anchors ? mod.anchors(t) : []).map(([ax, ay], n) => `
      <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="7" fill="${RED}" opacity="0.85"/>
      <text x="${(ax + 12).toFixed(1)}" y="${(ay - 10).toFixed(1)}" font-family="monospace" font-size="20" fill="${RED}">${n}</text>`).join('');
  cells.push(`<g transform="translate(${x} ${PAD})">
    <rect width="${CELL}" height="${CELL}" fill="${PAPER}" stroke="${INK_SOFT}" stroke-width="2" opacity="0.9"/>
    <text x="10" y="${CELL - 12}" font-family="monospace" font-size="22" fill="${INK_SOFT}">t=${t.toFixed(2)}</text>
    ${mod.render(t)}${dots}
  </g>`);
}

const W = PAD + steps * (CELL + PAD);
const H = CELL + PAD * 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="hsl(35, 28%, 89%)"/>
${cells.join('')}
</svg>`;

const png = new Resvg(svg, {
  font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Segoe Print' },
  fitTo: { mode: 'width', value: Math.round(W * SCALE / 2) },
}).render().asPng();
writeFileSync(out, png);
console.log(`${out}  ${steps} steps  ${(png.length / 1024).toFixed(0)}KB`);
