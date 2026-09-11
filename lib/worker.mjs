// One rasteriser per core. resvg is a CPU rasteriser with no GPU backend, so
// the only lever on wall-clock is how many cores are working at once.

import { parentPort, workerData } from 'node:worker_threads';
import { Resvg } from '@resvg/resvg-js';
import { FPS } from './scene-kit.mjs';

const { renderFrame } = await import(workerData.scene);

const fontOpts = {
  font: { loadSystemFonts: false, fontFiles: workerData.fonts, defaultFontFamily: 'Segoe Print' },
  fitTo: { mode: 'original' },
};

parentPort.on('message', (frame) => {
  if (frame === null) { parentPort.close(); return; }
  const png = new Resvg(renderFrame((frame / FPS) * 1000, frame), fontOpts).render().asPng();
  // Not transferred: asPng returns a pooled Buffer whose ArrayBuffer is shared
  // with other allocations, so it is not transferable. Structured clone copies
  // ~100KB per frame, which is nothing next to rasterising one.
  parentPort.postMessage({ frame, png });
});
