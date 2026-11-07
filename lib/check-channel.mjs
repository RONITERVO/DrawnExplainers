import { google } from 'googleapis';
import { readFileSync, existsSync } from 'node:fs';

const CLIENT = process.env.YT_OAUTH_CLIENT || 'D:/Projects/tempTestKeys/youtube-oauth-client.json';
const TOKEN = process.env.YT_OAUTH_TOKEN || 'D:/Projects/tempTestKeys/youtube-token.json';

if (!existsSync(CLIENT)) {
  console.log(JSON.stringify({ ok: false, error: 'No client file' }));
  process.exit(0);
}
if (!existsSync(TOKEN)) {
  console.log(JSON.stringify({ ok: false, error: 'No token file' }));
  process.exit(0);
}

try {
  const { installed } = JSON.parse(readFileSync(CLIENT, 'utf8'));
  const tokens = JSON.parse(readFileSync(TOKEN, 'utf8'));
  const oauth = new google.auth.OAuth2(installed.client_id, installed.client_secret, 'http://127.0.0.1');
  oauth.setCredentials(tokens);
  const yt = google.youtube({ version: 'v3', auth: oauth });
  const res = await yt.channels.list({ part: ['snippet'], mine: true });
  const ch = res.data.items?.[0];
  console.log(JSON.stringify({
    ok: true,
    channelId: ch?.id,
    title: ch?.snippet?.title,
    customUrl: ch?.snippet?.customUrl
  }));
} catch (err) {
  console.log(JSON.stringify({
    ok: false,
    error: err.message,
    code: err.code
  }));
}
