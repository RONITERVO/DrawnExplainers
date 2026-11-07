import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, rmSync, readdirSync, createReadStream } from 'node:fs';
import { resolve, join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3456;

const REMOTE = process.env.MEDIA_REMOTE || 'gdrive:DrawnExplainers';
const RCLONE = process.env.RCLONE
  || 'C:/Users/ronit/AppData/Local/Microsoft/WinGet/Packages/Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe/rclone-v1.75.1-windows-amd64/rclone.exe';

const CLIENT_FILE = process.env.YT_OAUTH_CLIENT || 'D:/Projects/tempTestKeys/youtube-oauth-client.json';
const TOKEN_FILE = process.env.YT_OAUTH_TOKEN || 'D:/Projects/tempTestKeys/youtube-token.json';

// Group definitions aligned with tools/media-sync.mjs
const isVeo = f => /face-only-video/.test(f) && !/-muted\//.test(f);
const GROUPS = [
  { name: 'audio', match: f => f === 'music.wav' || f.startsWith('assets/syncvoice/audio/'), why: 'irreplaceable Lyria / Gemini TTS audio' },
  { name: 'render', match: f => ['out.mp4', 'narration.wav', 'mixed.wav'].includes(f), why: 'original full 16:9 film renders' },
  { name: 'veo', match: isVeo, why: 'irreplaceable Google Veo generated clips' },
  { name: 'clips', match: f => f.startsWith('out-clips-talking-face') && !isVeo(f), why: 'speech clips and derivative cuts' },
  { name: 'vertical', match: f => f.startsWith('vertical-notebook/'), why: 'vertical notebook composites and 3x cuts' },
];

const TRANSIENT = f => f.startsWith('.media-tmp/') || f.endsWith('.syncvoice/generation-state.json') || f.startsWith('preview/');

function listLocal(epDir) {
  try {
    const out = execSync('git ls-files --others --ignored --exclude-standard', { cwd: epDir, encoding: 'utf8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean)
      .filter(f => !TRANSIENT(f))
      .filter(f => existsSync(join(epDir, f)));
  } catch {
    return [];
  }
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 32);
}

// Global active sync state
let activeSync = {
  isRunning: false,
  isPull: false,
  queue: [],
  currentSlug: null,
  currentGroup: null,
  groupIndex: 0,
  totalGroups: 0,
  percent: 0,
  speed: '0 B/s',
  eta: '--',
  bytesTransferredStr: '0 B',
  totalBytesStr: '0 B',
  error: null,
  childProcess: null,
  cancelRequested: false,
};

let logs = [];
const sseClients = new Set();

function addLog(msg, type = 'info') {
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    time: new Date().toLocaleTimeString(),
    type,
    text: msg
  };
  logs.push(entry);
  if (logs.length > 500) logs.shift();
  broadcast('log', entry);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// Scan all 14 episodes and gather metadata, local file stats, and Drive backup state
function getEpisodesData() {
  const catPath = join(ROOT, 'catalog.json');
  let catalogSets = [];
  if (existsSync(catPath)) {
    try {
      const cat = JSON.parse(readFileSync(catPath, 'utf8'));
      catalogSets = cat.sets || [];
    } catch {}
  }
  const notArbitrary = catalogSets.find(s => s.slug === 'not-arbitrary') || { episodes: [] };

  const epDirs = readdirSync(join(ROOT, 'sets/not-arbitrary'), { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('ep'))
    .map(d => d.name)
    .sort((a, b) => {
      const numA = parseInt(a.slice(2), 10) || 0;
      const numB = parseInt(b.slice(2), 10) || 0;
      return numA - numB;
    });

  const results = [];

  for (const dirName of epDirs) {
    const epDir = join(ROOT, 'sets/not-arbitrary', dirName);
    const num = parseInt(dirName.slice(2), 10) || 0;
    const catEntry = notArbitrary.episodes.find(e => e.slug === dirName || e.episode === num) || {};

    let epJson = {};
    const epJsonPath = join(epDir, 'episode.json');
    if (existsSync(epJsonPath)) {
      try { epJson = JSON.parse(readFileSync(epJsonPath, 'utf8')); } catch {}
    }

    const title = epJson.title || catEntry.title || dirName;
    const thesis = epJson.thesis || '';
    const runtime = epJson.runtimeSeconds || catEntry.runtimeSeconds || 0;

    // YouTube publish info
    const youtube = {
      filmStatus: catEntry.status === 'published' ? 'published' : (epJson.publish?.youtube?.videoId ? 'published' : 'draft'),
      filmUrl: catEntry.url || epJson.publish?.youtube?.url || (epJson.publish?.youtube?.videoId ? `https://www.youtube.com/watch?v=${epJson.publish.youtube.videoId}` : null),
      filmId: epJson.publish?.youtube?.videoId || (catEntry.url ? catEntry.url.split('v=')[1] : null),
      filmTitle: epJson.publish?.youtube?.title || '',
      shortStatus: catEntry.shortsUrl ? 'published' : (epJson.publish?.shorts?.videoId ? 'published' : 'draft'),
      shortUrl: catEntry.shortsUrl || epJson.publish?.shorts?.url || (epJson.publish?.shorts?.videoId ? `https://www.youtube.com/watch?v=${epJson.publish.shorts.videoId}` : null),
      shortId: epJson.publish?.shorts?.videoId || (catEntry.shortsUrl ? catEntry.shortsUrl.split('v=')[1] : null),
      shortTitle: epJson.publish?.shorts?.title || '',
    };

    // Local Disk Asset Checks
    const outMp4Path = join(epDir, 'out.mp4');
    const outMp4Exists = existsSync(outMp4Path);
    const outMp4Size = outMp4Exists ? statSync(outMp4Path).size : 0;

    const vert3xPath = join(epDir, 'vertical-notebook/vertical-full-3x.mp4');
    const vert3xExists = existsSync(vert3xPath);
    const vert3xSize = vert3xExists ? statSync(vert3xPath).size : 0;

    const veoDir = join(epDir, 'out-clips-talking-face-only-video');
    const veoClipsCount = existsSync(veoDir) ? readdirSync(veoDir).filter(f => f.endsWith('.mp4')).length : 0;

    const speechClipsDir = join(epDir, 'out-clips-talking-face-v3');
    const speechClipsCount = existsSync(speechClipsDir) ? readdirSync(speechClipsDir).filter(f => f.endsWith('.mp4')).length : 0;

    const localFiles = listLocal(epDir);
    let totalLocalBytes = 0;
    for (const f of localFiles) {
      try { totalLocalBytes += statSync(join(epDir, f)).size; } catch {}
    }

    // Google Drive Media Sync info
    const mediaJsonPath = join(epDir, 'media.json');
    const hasMediaJson = existsSync(mediaJsonPath);
    let manifest = null;
    let driveStatus = 'no_media';
    let backedUpBytes = 0;
    let backedUpFiles = 0;
    let missingFromDiskCount = 0;
    let unbackedCount = 0;

    if (hasMediaJson) {
      try {
        manifest = JSON.parse(readFileSync(mediaJsonPath, 'utf8'));
        const listedFiles = Object.values(manifest.groups || {}).flatMap(g => g.files || []);
        backedUpFiles = listedFiles.length;
        backedUpBytes = Object.values(manifest.groups || {}).reduce((acc, g) => acc + (g.bytes || 0), 0);

        const listedSet = new Set(listedFiles);
        const missing = listedFiles.filter(f => !existsSync(join(epDir, f)));
        missingFromDiskCount = missing.length;
        const unlisted = localFiles.filter(f => !listedSet.has(f));
        unbackedCount = unlisted.length;

        if (localFiles.length === 0 && listedFiles.length > 0) {
          driveStatus = 'remote_only';
        } else if (unbackedCount > 0) {
          driveStatus = 'needs_push';
        } else if (missing.length === 0) {
          driveStatus = 'synced';
        } else {
          driveStatus = 'partial_local';
        }
      } catch {}
    } else {
      if (localFiles.length > 0) {
        driveStatus = 'needs_push';
        unbackedCount = localFiles.length;
      }
    }

    results.push({
      num,
      slug: dirName,
      title,
      thesis,
      runtime,
      youtube,
      local: {
        hasOutMp4: outMp4Exists,
        outMp4Size,
        hasVert3x: vert3xExists,
        vert3xSize,
        veoClipsCount,
        speechClipsCount,
        fileCount: localFiles.length,
        totalBytes: totalLocalBytes,
      },
      drive: {
        status: driveStatus,
        hasManifest: !!manifest,
        updated: manifest?.updated || null,
        remotePath: `${REMOTE}/${dirName}`,
        backedUpBytes,
        backedUpFiles,
        missingFromDiskCount,
        unbackedCount,
        groups: manifest?.groups ? Object.keys(manifest.groups) : []
      }
    });
  }

  return results;
}

// Drive Sync Worker (sequential queue runner)
async function startSyncQueue(queue, isPull = false) {
  if (activeSync.isRunning) {
    if (activeSync.isPull !== isPull) return { error: `Cannot queue ${isPull ? 'pull' : 'push'} while ${activeSync.isPull ? 'pull' : 'push'} is active` };
    activeSync.queue.push(...queue);
    addLog(`Enqueued ${queue.length} episode(s) to active sync...`, 'info');
    broadcast('sync_status', getSyncPayload());
    return { ok: true, count: queue.length, totalQueue: activeSync.queue.length };
  }
  activeSync.isRunning = true;
  activeSync.isPull = isPull;
  activeSync.queue = [...queue];
  activeSync.cancelRequested = false;
  activeSync.error = null;

  (async () => {
    try {
      addLog(`Starting ${isPull ? 'pull' : 'push'} queue for ${queue.length} episode(s)...`, 'info');
      while (activeSync.queue.length > 0 && !activeSync.cancelRequested) {
        const slug = activeSync.queue.shift();
        activeSync.currentSlug = slug;
        broadcast('sync_status', getSyncPayload());

        const epDir = join(ROOT, 'sets/not-arbitrary', slug);
        if (isPull) {
          await runPullEpisode(slug, epDir);
        } else {
          await runPushEpisode(slug, epDir);
        }
      }
      if (activeSync.cancelRequested) {
        addLog('Sync queue cancelled by user.', 'warning');
      } else {
        addLog(`Completed all sync tasks successfully!`, 'success');
      }
    } catch (err) {
      activeSync.error = err.message;
      addLog(`Sync error: ${err.message}`, 'error');
    } finally {
      activeSync.isRunning = false;
      activeSync.currentSlug = null;
      activeSync.currentGroup = null;
      activeSync.percent = 0;
      activeSync.speed = '0 B/s';
      activeSync.eta = '--';
      activeSync.childProcess = null;
      broadcast('sync_status', getSyncPayload());
      broadcast('state', getEpisodesData());
    }
  })();

  return { ok: true, count: queue.length };
}

async function runPushEpisode(slug, epDir) {
  addLog(`[${slug}] Starting Google Drive push...`, 'info');
  const files = listLocal(epDir);
  if (!files.length) {
    addLog(`[${slug}] No local files to push. Skipping.`, 'warning');
    return;
  }

  const tmp = join(epDir, '.media-tmp');
  mkdirSync(tmp, { recursive: true });

  const manifest = {
    slug,
    remote: `${REMOTE}/${slug}`,
    updated: new Date().toISOString().slice(0, 10),
    groups: {}
  };

  const matchingGroups = GROUPS.filter(g => files.some(g.match));
  activeSync.totalGroups = matchingGroups.length;
  activeSync.groupIndex = 0;

  for (let i = 0; i < matchingGroups.length; i++) {
    if (activeSync.cancelRequested) break;
    const g = matchingGroups[i];
    activeSync.groupIndex = i + 1;
    activeSync.currentGroup = g.name;
    const members = files.filter(g.match);
    if (!members.length) continue;

    const rel = `.media-tmp/${g.name}.tar`;
    const tarPath = join(epDir, rel);
    const listRel = `.media-tmp/${g.name}.files`;
    writeFileSync(join(epDir, listRel), members.map(m => m + '\n').join(''));
    
    addLog(`[${slug}] Creating ${g.name}.tar (${members.length} files)...`);
    execSync(`tar -cf "${rel}" -T "${listRel}"`, { cwd: epDir });
    const size = statSync(tarPath).size;
    const sizeMb = (size / 1024 / 1024).toFixed(1);

    addLog(`[${slug}] Uploading ${g.name}.tar (${sizeMb} MB) to ${REMOTE}/${slug}/${g.name}.tar...`);
    
    const rcloneArgs = [
      'copyto',
      tarPath,
      `${REMOTE}/${slug}/${g.name}.tar`,
      '--stats', '1s',
      '--stats-one-line',
      '--drive-chunk-size', '16M',
      '--timeout', '60s',
      '--contimeout', '30s',
      '--retries', '3',
      '--low-level-retries', '10',
      '-v'
    ];

    await runRcloneCommand(rcloneArgs);

    if (activeSync.cancelRequested) break;

    manifest.groups[g.name] = {
      why: g.why,
      archive: `${g.name}.tar`,
      bytes: size,
      sha256: sha256(tarPath),
      files: members.sort()
    };
    addLog(`[${slug}] ${g.name}.tar uploaded & verified (sha256: ${manifest.groups[g.name].sha256.slice(0, 8)}...)`, 'success');
  }

  rmSync(tmp, { recursive: true, force: true });

  if (!activeSync.cancelRequested) {
    writeFileSync(join(epDir, 'media.json'), JSON.stringify(manifest, null, 2) + '\n');
    const totalBytes = Object.values(manifest.groups).reduce((acc, g) => acc + g.bytes, 0);
    const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
    addLog(`[${slug}] media.json written (${totalMb} MB total across ${Object.keys(manifest.groups).length} archives)`, 'success');
  }
}

async function runPullEpisode(slug, epDir) {
  addLog(`[${slug}] Starting Google Drive pull...`, 'info');
  const mPath = join(epDir, 'media.json');
  if (!existsSync(mPath)) {
    throw new Error(`[${slug}] No media.json found to pull from.`);
  }
  const manifest = JSON.parse(readFileSync(mPath, 'utf8'));
  const tmp = join(epDir, '.media-tmp');
  mkdirSync(tmp, { recursive: true });

  const groupKeys = Object.keys(manifest.groups || {});
  activeSync.totalGroups = groupKeys.length;
  activeSync.groupIndex = 0;

  for (let i = 0; i < groupKeys.length; i++) {
    if (activeSync.cancelRequested) break;
    const name = groupKeys[i];
    const g = manifest.groups[name];
    activeSync.groupIndex = i + 1;
    activeSync.currentGroup = name;

    const rel = `.media-tmp/${g.archive}`;
    const tarPath = join(epDir, rel);
    addLog(`[${slug}] Downloading ${g.archive} (${(g.bytes / 1024 / 1024).toFixed(1)} MB)...`);

    const rcloneArgs = [
      'copyto',
      `${manifest.remote}/${g.archive}`,
      tarPath,
      '--stats', '1s',
      '--stats-one-line',
      '--drive-chunk-size', '16M',
      '--timeout', '60s',
      '--contimeout', '30s',
      '--retries', '3',
      '--low-level-retries', '10',
      '-v'
    ];

    await runRcloneCommand(rcloneArgs);
    if (activeSync.cancelRequested) break;

    const gotSha = sha256(tarPath);
    if (gotSha !== g.sha256) {
      throw new Error(`Checksum mismatch on ${name}: expected ${g.sha256}, got ${gotSha}`);
    }

    addLog(`[${slug}] Extracting ${g.archive}...`);
    execSync(`tar -xf "${rel}"`, { cwd: epDir });
    addLog(`[${slug}] ${name}: ${g.files.length} files restored & checksum verified.`, 'success');
  }

  rmSync(tmp, { recursive: true, force: true });
}

function runRcloneCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(RCLONE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    activeSync.childProcess = child;

    const parseLine = line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      // Parse rclone one-line progress e.g. "15.2 MiB / 35.0 MiB, 43%, 2.1 MiB/s, ETA 9s"
      const m = trimmed.match(/INFO\s*:\s*([\d\.]+\s*[KMGT]?i?B)\s*\/\s*([\d\.]+\s*[KMGT]?i?B),\s*(\d+)%,\s*([\d\.]+\s*[KMGT]?i?B\/s),\s*ETA\s*([^\s]+)/i);
      if (m) {
        activeSync.bytesTransferredStr = m[1];
        activeSync.totalBytesStr = m[2];
        activeSync.percent = Number(m[3]);
        activeSync.speed = m[4];
        activeSync.eta = m[5];
        broadcast('sync_progress', getSyncPayload());
      } else if (trimmed.includes('NOTICE') || trimmed.includes('INFO') || trimmed.includes('ERROR')) {
        addLog(trimmed, trimmed.includes('ERROR') ? 'error' : 'info');
      }
    };

    child.stdout.on('data', d => d.toString().split(/[\r\n]+/).forEach(parseLine));
    child.stderr.on('data', d => d.toString().split(/[\r\n]+/).forEach(parseLine));

    child.on('close', code => {
      activeSync.childProcess = null;
      if (activeSync.cancelRequested) {
        resolve();
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`rclone exited with code ${code}`));
      }
    });

    child.on('error', err => {
      activeSync.childProcess = null;
      reject(err);
    });
  });
}

function getSyncPayload() {
  return {
    isRunning: activeSync.isRunning,
    isPull: activeSync.isPull,
    currentSlug: activeSync.currentSlug,
    currentGroup: activeSync.currentGroup,
    groupIndex: activeSync.groupIndex,
    totalGroups: activeSync.totalGroups,
    percent: activeSync.percent,
    speed: activeSync.speed,
    eta: activeSync.eta,
    transferred: activeSync.bytesTransferredStr,
    total: activeSync.totalBytesStr,
    queueRemaining: activeSync.queue.length,
    error: activeSync.error
  };
}

async function getChannelStatus() {
  if (!existsSync(TOKEN_FILE) || !existsSync(CLIENT_FILE)) {
    return { ok: false, error: 'OAuth client or token file not found' };
  }
  try {
    const { installed } = JSON.parse(readFileSync(CLIENT_FILE, 'utf8'));
    const tokens = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
    const oauth = new google.auth.OAuth2(installed.client_id, installed.client_secret, 'http://127.0.0.1');
    oauth.setCredentials(tokens);
    const yt = google.youtube({ version: 'v3', auth: oauth });
    const res = await yt.channels.list({ part: ['snippet'], mine: true });
    const ch = res.data.items?.[0];
    if (!ch) return { ok: false, error: 'No channel found for authorized account' };
    return {
      ok: true,
      channelId: ch.id,
      title: ch.snippet.title,
      customUrl: ch.snippet.customUrl || '@drawnexplainers'
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// HTTP Server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API endpoints
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/api/episodes' && req.method === 'GET') {
      res.end(JSON.stringify({ ok: true, episodes: getEpisodesData() }));
      return;
    }

    if (url.pathname === '/api/channel' && req.method === 'GET') {
      const ch = await getChannelStatus();
      res.end(JSON.stringify(ch));
      return;
    }

    if (url.pathname === '/api/sync/status' && req.method === 'GET') {
      res.end(JSON.stringify(getSyncPayload()));
      return;
    }

    if (url.pathname === '/api/sync/logs' && req.method === 'GET') {
      res.end(JSON.stringify({ ok: true, logs }));
      return;
    }

    if (url.pathname === '/api/sync/push' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          let queue = [];
          if (data.all) {
            const eps = getEpisodesData();
            queue = eps.filter(e => e.drive.status === 'needs_push').map(e => e.slug);
            if (!queue.length) queue = eps.map(e => e.slug);
          } else if (data.slug) {
            queue = [data.slug];
          }
          if (!queue.length) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No episodes specified or needed' }));
            return;
          }
          const result = await startSyncQueue(queue, false);
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === '/api/sync/pull' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          if (!data.slug) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'slug is required' }));
            return;
          }
          const result = await startSyncQueue([data.slug], true);
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (url.pathname === '/api/sync/stop' && req.method === 'POST') {
      activeSync.cancelRequested = true;
      if (activeSync.childProcess) {
        try { activeSync.childProcess.kill(); } catch {}
      }
      addLog('Cancellation requested for active sync...', 'warning');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`event: init\ndata: ${JSON.stringify({ sync: getSyncPayload(), logs })}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Static files
  let p = join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!existsSync(p)) p = join(__dirname, 'public', 'index.html');

  const ext = extname(p).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  };

  try {
    const stream = createReadStream(p);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    stream.pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end('Error loading ' + err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`🎨 DrawnExplainers Dashboard & Drive Sync Server`);
  console.log(`📍 URL: ${url}`);
  console.log(`☁️  Remote: ${REMOTE}`);
  console.log(`======================================================\n`);
  addLog(`DrawnExplainers server listening on ${url}`);
});

