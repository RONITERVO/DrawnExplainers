#!/usr/bin/env node
/** Small interactive launcher. No shell or network, and no input-file changes. */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const rl = createInterface({ input: stdin, output: stdout });
const clean = x => String(x).trim().replace(/^"(.*)"$/, '$1');
try {
  console.log('\nNotebook compositor 3.0.0\n');
  const episode = resolve(clean(process.argv[2] ?? await rl.question('Episode directory (full path): ')));
  const cfgPath = join(episode, 'vertical-notebook.json');
  const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, '')) : {};
  const args = ['--episode', episode];
  const original = cfg.originalDir ?? 'out-clips-talking-face-v3';
  if (!existsSync(join(resolve(episode, original), 'clip-index.json'))) {
    const path = clean(await rl.question('Directory containing clip-index.json (full path): '));
    if (!path) throw new Error('A clip manifest directory is required.');
    args.push('--original-dir', path);
  }
  const narrator = cfg.narratorDir ?? 'narrator-clips';
  if (!existsSync(resolve(episode, narrator))) {
    console.log('Choose the narrator set paired to these exact source cuts, not merely the same episode.');
    const path = clean(await rl.question('Narrator clip directory (full path): '));
    if (!path) throw new Error('A narrator directory is required.');
    args.push('--narrator-dir', path);
  }
  const mode = clean(await rl.question('[P]review first 3 clips or [F]ull episode? [P]: ')).toLowerCase() || 'p';
  if (!['p', 'f'].includes(mode)) throw new Error('Enter P or F.');
  if (mode === 'p') args.push('--limit', '3', '--preset', 'veryfast', '--output-dir', 'vertical-notebook-preview');
  console.log('Existing changed outputs are protected. Use --overwrite in the documented CLI only when replacement is intentional.');
  rl.close();
  const script = join(dirname(fileURLToPath(import.meta.url)), 'make-vertical-notebook.mjs');
  const child = spawn(process.execPath, [script, ...args], { shell: false, stdio: 'inherit' });
  child.on('error', e => { console.error(e.message); process.exitCode = 1; });
  child.on('close', code => { process.exitCode = code ?? 1; });
} catch (e) { rl.close(); console.error(`ERROR: ${e.message}`); process.exitCode = 1; }
