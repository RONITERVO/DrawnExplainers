# Publishing

How an episode gets from `out.mp4` onto YouTube and TikTok.

## The channel

| | |
| --- | --- |
| Name | DrawnExplainers |
| Handle | [@drawnexplainers](https://www.youtube.com/@drawnexplainers) |
| Channel ID | `UCOrC3gouhHOFmPBIEzWEzoQ` |
| Studio | https://studio.youtube.com/channel/UCOrC3gouhHOFmPBIEzWEzoQ |
| Google account | `<the channel owner>` |
| Created | 2018-11-17 |
| State as of 2026-09-11 | 2 subscribers, 1 video, 24 views, description and keywords both empty |

**The branding question is settled:** the films get their own channel. The other
channel — MaestroChatAndLearn, `UCGpGSO3QL9pCkjcpw45wemg` — belongs to the
language app and stays as it is. Nothing in this repo publishes there.

Because the channel is an old one, check two things in Studio before the first
upload: that its **default language** is English (an old account may carry a
different one, which affects how titles are treated), and that **"Made for kids"
is set to No** at the channel level — the default depends on when the account
was created, and getting it wrong disables comments and suppresses recommendations.

## What is wired up

- **`youtube` skill** at `~/.claude/skills/youtube/` — 14 commands (`/youtube
  audit`, `seo`, `script`, `hook`, `thumbnail`, `strategy`, `calendar`,
  `shorts`, `analyze`, `repurpose`, `monetize`, `competitor`, `metadata`,
  `ideate`). Advisory only; it writes recommendations, it does not touch the
  channel.
- **Read-only API key** as `YOUTUBE_API_KEY` in `~/.claude/settings.json`, same
  value as `EXPLAIN_YOUTUBE` in `D:/Projects/tempTestKeys/.env`. It lives in two
  places, so rotate both.
  The key was created under the *other* Google account, which does not matter:
  an API key authenticates the calling project, not a user, and public reads work
  against any channel. Verified against @DrawnExplainers on 2026-09-11.

## What is NOT wired up

**Nothing here can upload.** An `AIza…` key is read-only on the YouTube Data
API. Uploading needs OAuth 2.0 with the `youtube.upload` scope, which
authenticates a *user* — and that user must be **`<the channel owner>`**, since
that is who owns this channel. Consenting with the wrong account is the one
mistake that silently uploads to the wrong channel.

Until that exists, uploads are manual in Studio. See "Automating uploads" below.

## Per-episode checklist

Publish copy is already written in each episode's `episode.json` under `publish`
— YouTube title, description and tags; TikTok caption and hook. Copy it from
there rather than retyping in Studio, so the file stays the record.

1. `sets/<set>/<ep>/out.mp4` — 1080p30, −14 LUFS, platform-ready as rendered.
   If it is missing, `node lib/build.mjs <ep>` rebuilds it in about 40 seconds
   (it is gitignored precisely because it is reproducible).
2. Upload in Studio. Title, description, tags from `publish.youtube`.
3. Thumbnail: pull a frame with `node lib/build.mjs <ep> --at=<seconds>`, or run
   `/youtube thumbnail` for a brief.
4. Set the video language to English, and add it to the set's playlist.
5. TikTok: same file. It is 16:9 and TikTok is 9:16 — see below.
6. Update `status` in `episode.json` and `catalog.json` from `rendered` to
   `published`, and record the URL. Commit that.

## Channel description

Currently empty. Paste into Studio → Customisation → Basic info.

> Short hand-drawn films about things that look arbitrary and turn out to be
> pictures. Chinese characters, the alphabet, the card suits, the marks at the
> head of a stave — each one drawn from what it used to be and moved, on paper,
> until it becomes the mark you already know.
>
> No filler, no intro music, under three minutes.

Keywords: `etymology, writing systems, hand drawn animation, explainer,
language, history, chinese characters, alphabet, design history, typography,
music notation, playing cards`

Avatar: `brand/avatar-800.png` (SVG source alongside it). Temporary — deliberately
no wordmark.

## Automating uploads

Worth doing when uploading by hand stops being a five-minute job. It needs one
step only you can do, and one decision:

1. In Google Cloud Console, **signed in as `<the channel owner>`**, create a
   project (or reuse one), enable the **YouTube Data API v3**, and create an
   **OAuth client ID** of type *Desktop app*. Download the client secret JSON.
2. On the OAuth consent screen, add `<the channel owner>` as a **test user**.
   Without this, an unverified app refuses consent after a few days.
3. Hand me the client secret path. I write an uploader that opens one browser
   consent, stores the refresh token, and never needs the browser again.

The scope to request is `https://www.googleapis.com/auth/youtube.upload`. Note
that uploads from an unverified app land as **private** and stay that way until
the app is verified — so the realistic automated flow is *upload privately, then
flip to public in Studio*, which is still most of the work saved.

## Open items

**Vertical crops for TikTok.** The films are composed for 16:9 with generous
margins, and a centre crop to 9:16 would cut the two-column reveals in half.
Cheap fix: letterbox on paper-coloured background. Better fix: a `--vertical`
render mode that restacks the two columns. Worth building only once there is
evidence TikTok is working.

**Captions.** `timing.json` holds a Whisper transcript with word onsets for every
shot — an accurate caption source, better than YouTube's auto-captions, and
already on disk. Converting it to SRT is a small job whenever you want it.
