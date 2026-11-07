// DrawnExplainers Studio & Sync Dashboard Frontend

let episodes = [];
let syncState = { isRunning: false };

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = 1;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function loadChannel() {
  try {
    const res = await fetch('/api/channel');
    const data = await res.json();
    const pill = document.getElementById('ytChannel');
    const dot = document.getElementById('ytDot');
    if (data.ok) {
      pill.textContent = `${data.title} (${data.customUrl || ''})`;
      dot.className = 'pulse-dot active';
    } else {
      pill.textContent = 'Disconnected';
      dot.className = 'pulse-dot';
    }
  } catch (e) {
    document.getElementById('ytChannel').textContent = 'Error';
  }
}

async function loadEpisodes() {
  try {
    const res = await fetch('/api/episodes');
    const data = await res.json();
    if (data.ok && data.episodes) {
      episodes = data.episodes;
      renderKPIs();
      renderEpisodesTable();
    }
  } catch (err) {
    console.error('Failed to load episodes:', err);
  }
}

function renderKPIs() {
  const total = episodes.length;
  document.getElementById('statTotalEps').textContent = total;

  const ytCount = episodes.filter(e => e.youtube.filmStatus === 'published' && e.youtube.shortStatus === 'published').length;
  document.getElementById('statYtPublished').textContent = `${ytCount} / ${total}`;

  const backedCount = episodes.filter(e => e.drive.status === 'synced').length;
  document.getElementById('statDriveBacked').textContent = `${backedCount} / ${total}`;

  const totalDriveBytes = episodes.reduce((acc, e) => acc + (e.drive.backedUpBytes || 0), 0);
  document.getElementById('statDriveBytes').textContent = `${fmtBytes(totalDriveBytes)} in cloud`;

  const totalLocalBytes = episodes.reduce((acc, e) => acc + (e.local.totalBytes || 0), 0);
  const totalLocalFiles = episodes.reduce((acc, e) => acc + (e.local.fileCount || 0), 0);
  document.getElementById('statLocalBytes').textContent = fmtBytes(totalLocalBytes);
  document.getElementById('statLocalFiles').textContent = `${totalLocalFiles} media files on disk`;

  // Disable "Sync All" button if sync is running
  const btnSyncAll = document.getElementById('btnSyncAll');
  if (btnSyncAll) {
    btnSyncAll.disabled = syncState.isRunning;
  }
}

function renderEpisodesTable() {
  const tbody = document.getElementById('episodesTbody');
  if (!tbody) return;

  tbody.innerHTML = episodes.map(ep => {
    // YouTube Links
    let ytLinks = '';
    if (ep.youtube.filmUrl) {
      ytLinks += `<a href="${ep.youtube.filmUrl}" target="_blank" class="vid-link film" title="${ep.youtube.filmTitle || 'Film'}">▶ Film (16:9)</a>`;
    }
    if (ep.youtube.shortUrl) {
      ytLinks += `<a href="${ep.youtube.shortUrl}" target="_blank" class="vid-link short" title="${ep.youtube.shortTitle || 'Short'}">⚡ 3x Short (9:16)</a>`;
    }
    if (!ytLinks) {
      ytLinks = '<span class="tag">Unpublished</span>';
    }

    // Local Assets
    const localTags = [
      ep.local.hasOutMp4 ? `<span class="tag ok" title="16:9 Master Film (${fmtBytes(ep.local.outMp4Size)})">Film ✓</span>` : `<span class="tag">No Film</span>`,
      ep.local.hasVert3x ? `<span class="tag ok" title="Vertical 3x Short (${fmtBytes(ep.local.vert3xSize)})">3x Short ✓</span>` : `<span class="tag">No Short</span>`,
      ep.local.veoClipsCount > 0 ? `<span class="tag ok" title="${ep.local.veoClipsCount} Veo Clips">${ep.local.veoClipsCount} Veo</span>` : '',
      ep.local.totalBytes > 0 ? `<span class="tag" title="Local files footprint">${fmtBytes(ep.local.totalBytes)}</span>` : ''
    ].filter(Boolean).join(' ');

    // Drive status badge
    let driveBadge = '';
    let driveSub = '';
    if (ep.drive.status === 'synced') {
      driveBadge = `<span class="drive-status-badge synced">● Backed Up</span>`;
      driveSub = `Pushed ${ep.drive.updated || 'recently'} (${fmtBytes(ep.drive.backedUpBytes)})`;
    } else if (ep.drive.status === 'needs_push') {
      driveBadge = `<span class="drive-status-badge needs_push">▲ Needs Push</span>`;
      driveSub = ep.drive.unbackedCount > 0 ? `${ep.drive.unbackedCount} unbacked files` : 'Pending sync';
    } else if (ep.drive.status === 'remote_only') {
      driveBadge = `<span class="drive-status-badge remote_only">☁ Remote Only</span>`;
      driveSub = `${fmtBytes(ep.drive.backedUpBytes)} on Drive (0 on disk)`;
    } else {
      driveBadge = `<span class="drive-status-badge">No Media</span>`;
      driveSub = 'Empty';
    }

    // Action buttons
    const isThisSyncing = syncState.isRunning && syncState.currentSlug === ep.slug;
    const pushDisabled = syncState.isRunning;
    const pullDisabled = syncState.isRunning || !ep.drive.hasManifest;

    return `
      <tr>
        <td><span class="ep-badge">${String(ep.num).padStart(2, '0')}</span></td>
        <td>
          <div class="ep-meta">
            <span class="ep-title">${ep.title}</span>
            <span class="ep-slug">${ep.slug}</span>
          </div>
        </td>
        <td><div class="video-pills">${ytLinks}</div></td>
        <td><div class="asset-tags">${localTags}</div></td>
        <td>
          <div>${driveBadge}</div>
          <div class="drive-subtext">${driveSub}</div>
        </td>
        <td style="text-align: right;">
          <div class="action-buttons">
            <button class="btn btn-xs ${ep.drive.status === 'needs_push' ? 'btn-primary' : 'btn-outline'}" 
              onclick="syncEpisode('${ep.slug}')" 
              ${pushDisabled ? 'disabled' : ''}>
              ${isThisSyncing ? 'Syncing...' : '⬆ Push'}
            </button>
            <button class="btn btn-xs btn-outline" 
              onclick="pullEpisode('${ep.slug}')" 
              ${pullDisabled ? 'disabled' : ''}>
              ⬇ Pull
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Sync Actions
async function syncEpisode(slug) {
  try {
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
  } catch (e) {
    alert('Failed to start sync: ' + e.message);
  }
}

async function pullEpisode(slug) {
  if (!confirm(`Restore episode media for ${slug} from Google Drive?`)) return;
  try {
    const res = await fetch('/api/sync/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
  } catch (e) {
    alert('Failed to start pull: ' + e.message);
  }
}

async function syncAllNeeded() {
  const needed = episodes.filter(e => e.drive.status === 'needs_push');
  if (needed.length === 0) {
    if (!confirm('All episodes are already marked as backed up. Force sync all anyway?')) return;
  }
  try {
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
  } catch (e) {
    alert('Failed to trigger sync: ' + e.message);
  }
}

async function stopActiveSync() {
  if (!confirm('Stop the active sync?')) return;
  try {
    await fetch('/api/sync/stop', { method: 'POST' });
  } catch (e) {
    console.error(e);
  }
}

// Terminal logs
function addLogLine(entry) {
  const body = document.getElementById('consoleLogs');
  if (!body) return;

  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `
    <span class="log-time">${entry.time}</span>
    <span class="log-text ${entry.type || 'info'}">${entry.text}</span>
  `;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function clearLogs() {
  const body = document.getElementById('consoleLogs');
  if (body) body.innerHTML = '';
}

// Server-Sent Events (SSE) stream
function initSSE() {
  const ev = new EventSource('/api/events');

  ev.addEventListener('init', e => {
    const data = JSON.parse(e.data);
    if (data.sync) updateSyncCard(data.sync);
    if (data.logs) {
      data.logs.forEach(addLogLine);
    }
  });

  ev.addEventListener('log', e => {
    addLogLine(JSON.parse(e.data));
  });

  ev.addEventListener('sync_status', e => {
    const data = JSON.parse(e.data);
    updateSyncCard(data);
    renderEpisodesTable();
  });

  ev.addEventListener('sync_progress', e => {
    const data = JSON.parse(e.data);
    updateSyncCard(data);
  });

  ev.addEventListener('state', e => {
    episodes = JSON.parse(e.data);
    renderKPIs();
    renderEpisodesTable();
  });
}

function updateSyncCard(sync) {
  syncState = sync;
  const card = document.getElementById('activeSyncCard');
  if (!card) return;

  if (sync.isRunning) {
    card.style.display = 'flex';
    document.getElementById('syncTargetTitle').textContent = `${sync.isPull ? 'Downloading' : 'Uploading'} ${sync.currentSlug || ''}`;
    document.getElementById('syncTargetSub').textContent = `Archive: ${sync.currentGroup || ''}.tar (${sync.groupIndex || 0} / ${sync.totalGroups || 0}) • Queue remaining: ${sync.queueRemaining || 0}`;
    document.getElementById('syncSpeed').textContent = sync.speed || '0 B/s';
    document.getElementById('syncEta').textContent = `ETA: ${sync.eta || '--'}`;
    document.getElementById('syncProgressBar').style.width = `${sync.percent || 0}%`;
    document.getElementById('syncTransferredText').textContent = `${sync.transferred || '0 B'} / ${sync.total || '0 B'}`;
    document.getElementById('syncPercentText').textContent = `${sync.percent || 0}%`;
  } else {
    card.style.display = 'none';
  }

  renderKPIs();
}

// Initialize on boot
window.addEventListener('DOMContentLoaded', () => {
  loadChannel();
  loadEpisodes();
  initSSE();
});

