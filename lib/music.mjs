// Lyria RealTime backing track.
//
//   node music.mjs <seconds> <out.wav> "<prompt>"
//
// Lyria is a streaming model: you connect, set weighted prompts, call play(),
// and PCM arrives until you stop asking for it. Maestro caps a clip at 20s
// because a learner pays per generation; a backing track for a film has no such
// reason to stop, so this collects until the target length is reached.

import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , secondsArg, outPath, ...promptParts] = process.argv;
const TARGET = Number(secondsArg);
const PROMPT = promptParts.join(' ');
if (!TARGET || !outPath || !PROMPT) {
  console.error('usage: node music.mjs <seconds> <out.wav> "<prompt>"');
  process.exit(2);
}

const ENV = 'D:/Projects/tempTestKeys/.env';
const keys = readFileSync(ENV, 'utf8')
  .split(/\r?\n/)
  .map(line => line.match(/^GEMINI_API_KEY\d*\s*=\s*(.+)$/))
  .filter(Boolean)
  .map(m => m[1].trim())
  .filter(Boolean);
if (!keys.length) throw new Error(`No GEMINI_API_KEY* found in ${ENV}`);

const MODEL = 'models/lyria-realtime-exp';
const int16 = (b64) => {
  const bytes = Buffer.from(b64, 'base64');
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
};
const param = (mime, name) => {
  const m = (mime || '').match(new RegExp(`${name}=([0-9]+)`, 'i'));
  return m ? Number(m[1]) : undefined;
};

function wav(pcm, rate, channels) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * channels * 2, 28);
  head.writeUInt16LE(channels * 2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const ai = new GoogleGenAI({ apiKey: keys[0], apiVersion: 'v1alpha' });

const chunks = [];
let rate = 48000;
let channels = 2;
let total = 0;
let settled = false;

const done = new Promise((resolve, reject) => {
  const finish = (session) => {
    if (settled) return;
    settled = true;
    try { session?.stop?.(); } catch {}
    try { session?.close?.(); } catch {}
    resolve();
  };

  const timer = setTimeout(() => {
    if (chunks.length) finish(null);
    else reject(new Error('Lyria produced no audio before the timeout.'));
  }, Math.max(120000, TARGET * 2200));

  ai.live.music.connect({
    model: MODEL,
    callbacks: {
      onmessage: async (msg) => {
        if (settled) return;
        if (msg?.filteredPrompt?.filteredReason && !chunks.length) {
          clearTimeout(timer);
          settled = true;
          reject(new Error(`Prompt filtered: ${msg.filteredPrompt.filteredReason}`));
          return;
        }
        if (msg?.setupComplete) {
          await session.setWeightedPrompts({ weightedPrompts: [{ text: PROMPT, weight: 1 }] });
          await session.setMusicGenerationConfig({
            musicGenerationConfig: { musicGenerationMode: 'QUALITY', temperature: 1.0, guidance: 4.5 },
          });
          session.play();
          return;
        }
        for (const chunk of msg?.serverContent?.audioChunks || []) {
          if (settled || typeof chunk?.data !== 'string') continue;
          rate = param(chunk.mimeType, 'rate') || rate;
          channels = param(chunk.mimeType, 'channels') || channels;
          const pcm = int16(chunk.data);
          const want = Math.max(0, Math.round(TARGET * rate * channels) - total);
          const take = pcm.length > want ? pcm.slice(0, want) : pcm;
          if (!take.length) { clearTimeout(timer); finish(session); return; }
          chunks.push(take);
          total += take.length;
          const secs = total / (rate * channels);
          if (Math.floor(secs) % 15 === 0) process.stdout.write(`\r  ${secs.toFixed(0)}s / ${TARGET}s`);
          if (secs >= TARGET) { clearTimeout(timer); finish(session); return; }
        }
      },
      onerror: (e) => { if (!settled) { clearTimeout(timer); settled = true; reject(new Error(String(e?.message || e))); } },
      onclose: () => { if (chunks.length) { clearTimeout(timer); finish(null); } },
    },
  }).then(s => { session = s; }).catch(reject);
});

let session = null;
await done;

const merged = new Int16Array(total);
let offset = 0;
for (const c of chunks) { merged.set(c, offset); offset += c.length; }
writeFileSync(outPath, wav(merged, rate, channels));
console.log(`\n${outPath}  ${(total / (rate * channels)).toFixed(1)}s  ${rate}Hz ${channels}ch`);
