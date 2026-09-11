// One-time YouTube OAuth consent. Stores a refresh token; never needed again.
//
//   node lib/youtube-auth.mjs
//
// Consent MUST be given as the account that owns the target channel. Signing in
// with the wrong Google account is the one mistake that silently uploads
// somewhere else, so this refuses to store a token whose channel is not the
// expected one.

import { google } from 'googleapis';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { spawn } from 'node:child_process';

const CLIENT = process.env.YT_OAUTH_CLIENT || 'D:/Projects/tempTestKeys/youtube-oauth-client.json';
const TOKEN = process.env.YT_OAUTH_TOKEN || 'D:/Projects/tempTestKeys/youtube-token.json';
const EXPECT_CHANNEL = 'UCOrC3gouhHOFmPBIEzWEzoQ';   // @drawnexplainers
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

if (!existsSync(CLIENT)) {
  console.error(`No OAuth client at ${CLIENT}\nCreate a Desktop app client in Google Cloud Console and put the JSON there.`);
  process.exit(2);
}
const { installed } = JSON.parse(readFileSync(CLIENT, 'utf8'));
if (!installed) {
  console.error('That client is not a Desktop app ("installed") client. Recreate it as one.');
  process.exit(2);
}

// Loopback redirect on an ephemeral port. Desktop clients accept any localhost
// port, so nothing has to be pre-registered.
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const redirectUri = `http://127.0.0.1:${port}`;

const oauth = new google.auth.OAuth2(installed.client_id, installed.client_secret, redirectUri);
const url = oauth.generateAuthUrl({
  access_type: 'offline',     // we want a refresh token
  prompt: 'consent',          // force one even if previously granted
  scope: SCOPES,
});

console.log('\nApprove as the account that owns the channel.\nIf a browser did not open, paste this:\n');
console.log(url + '\n');
// rundll32 takes the URL as a single argv element with no shell re-parsing,
// so the query string's & characters survive intact. `cmd /c start` does not.
try { spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref(); } catch {}

const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timed out waiting for consent')), 5 * 60_000);
  server.on('request', (req, res) => {
    const q = new URL(req.url, redirectUri).searchParams;
    const err = q.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<body style="font:16px system-ui;padding:3rem;background:#f5f0e6;color:#4a4038">
      <p>${err ? 'Consent refused: ' + err : 'Done. You can close this tab.'}</p></body>`);
    clearTimeout(timer);
    if (err) reject(new Error(err));
    else resolve(q.get('code'));
  });
});
server.close();

const { tokens } = await oauth.getToken(code);
oauth.setCredentials(tokens);

if (!tokens.refresh_token) {
  console.error('\nGoogle returned no refresh token. Revoke this app at');
  console.error('https://myaccount.google.com/permissions and run this again.');
  process.exit(1);
}

// Confirm which channel this token actually controls before storing it.
const yt = google.youtube({ version: 'v3', auth: oauth });
const me = await yt.channels.list({ part: ['snippet'], mine: true });
const ch = me.data.items?.[0];
if (!ch) {
  console.error('\nThat account has no YouTube channel. Sign in as the channel owner.');
  process.exit(1);
}
console.log(`\nauthorised channel: ${ch.snippet.title}  (${ch.id})`);
if (ch.id !== EXPECT_CHANNEL) {
  console.error(`\nWRONG CHANNEL. Expected ${EXPECT_CHANNEL} (@drawnexplainers).`);
  console.error('Nothing was saved. Sign out of Google, sign in as the channel owner, and retry.');
  process.exit(1);
}

writeFileSync(TOKEN, JSON.stringify({ ...tokens, channelId: ch.id, channelTitle: ch.snippet.title }, null, 2));
try { chmodSync(TOKEN, 0o600); } catch {}
console.log(`token stored at ${TOKEN}\nuploads are now non-interactive.`);
