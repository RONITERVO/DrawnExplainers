# Publishing

How an episode gets from a render onto YouTube and TikTok.

## The channel

| | |
| --- | --- |
| Name | DrawnExplainers |
| Handle | [@drawnexplainers](https://www.youtube.com/@drawnexplainers) |
| Channel ID | `UCOrC3gouhHOFmPBIEzWEzoQ` |
| Studio | https://studio.youtube.com/channel/UCOrC3gouhHOFmPBIEzWEzoQ |
| Google account | the channel owner (see `D:/Projects/tempTestKeys/`, not recorded here) |
| Created | 2018-11-17 |
| State as of 2026-09-12 | 10 videos, 2 subscribers, 24 views; description set, keywords still empty |

**The branding question is settled:** the films get their own channel. The other
channel — MaestroChatAndLearn, `UCGpGSO3QL9pCkjcpw45wemg` — belongs to the
language app and stays as it is. Nothing in this repo publishes there.

Because the channel is an old one, check two things in Studio: that its
**default language** is English (still unset as of 2026-09-12 — an old account
may carry a different one, which affects how titles are treated), and that
**"Made for kids" is set to No** at the channel level, because the default
depends on when the account was created and getting it wrong disables comments
and suppresses recommendations.

## Two formats, two listings

Every episode ships twice:

| | file | metadata | shape |
| --- | --- | --- | --- |
| the film | `out.mp4` | `publish.youtube` | 16:9, 90–180s |
| the cut | `vertical-notebook/vertical-full.mp4` | `publish.shorts` | 9:16, the film inset in a notebook with a Veo narrator and a transcript |

**They must not share a title.** Two videos with the same name on one channel are
indistinguishable in search, in the sidebar, and on the channel page — a viewer
cannot tell which one they already watched, and the two compete for the same
query. `publish.shorts.title` states one concrete claim from the film and links
the long version in its description; `publish.youtube.title` states the thesis.
Episode 1's vertical (`tbmFCJL6DAU`) was uploaded before this split existed and
still carries the film's title — retitle it in Studio from
`publish.shorts.title`.

Both are also the TikTok source: the vertical cut is already 9:16, so it goes up
as-is with `publish.tiktok.caption`.

## Uploading

One browser consent, once:

```bash
node lib/youtube-auth.mjs
```

It stores a refresh token at `D:/Projects/tempTestKeys/youtube-token.json` and
**refuses to store one whose channel is not `UCOrC3gouhHOFmPBIEzWEzoQ`** —
consenting with the wrong Google account is the one mistake that silently
uploads somewhere else, so it is checked rather than trusted.

Then, per episode:

```bash
node lib/youtube-upload.mjs sets/not-arbitrary/<ep> --public
node lib/youtube-upload.mjs sets/not-arbitrary/<ep> --vertical --public
```

Both are resumable and both write the resulting video id back into
`episode.json` and `catalog.json` — commit that. Add `--dry-run` to see exactly
what will be sent without sending it.

Uploads land public. The widely repeated claim that an unverified OAuth app has
its uploads forced private is not what happens here: episodes 5 to 8 requested
public and came back public. The default is still `private`, because the upload
is live the instant it succeeds and the metadata is whatever `episode.json`
happened to say at that moment.

## Per-episode checklist

Publish copy is written in `episode.json` under `publish` before anything is
uploaded, so the file stays the record and nothing is retyped into Studio.

1. `out.mp4` — 1080p30, −14 LUFS, platform-ready as rendered. Gitignored because
   it is reproducible: `node lib/build.mjs <ep>` rebuilds it in about 40 seconds.
2. `vertical-notebook/vertical-full.mp4` — built by `tools/Notebook-Compositor`
   from the speech clips. Also gitignored; `node tools/media-sync.mjs pull <ep>`
   restores it from the media store.
3. Upload both, as above.
4. Thumbnail: pull a frame with `node lib/build.mjs <ep> --at=<seconds>`, or run
   `/youtube thumbnail` for a brief.
5. Add the long film to the set's playlist.
6. `node tools/media-sync.mjs push <ep>` so the irreplaceable pieces — the Lyria
   bed, the TTS audio, the Veo clips — are in Drive before anything is deleted.
7. Commit the updated `episode.json`, `catalog.json` and `media.json`.

## Channel description and keywords

The description is set. **Keywords are not, and cannot be set from here.** The
token holds `youtube.upload` + `youtube.readonly`; writing channel branding needs
the full `youtube` scope, and widening a long-lived token that can already upload,
in order to fill one metadata field, is a bad trade. Paste them by hand in
Studio → Customisation → Basic info:

> etymology, writing systems, hand drawn animation, explainer, language, history,
> chinese characters, alphabet, design history, typography, music notation,
> playing cards

The description currently in place:

> Short hand-drawn films about things that look arbitrary and turn out to be
> pictures. Chinese characters, the alphabet, the card suits, the marks at the
> head of a stave — each one drawn from what it used to be and moved, on paper,
> until it becomes the mark you already know.
>
> No filler, no intro music, under three minutes.

Avatar: `brand/avatar-800.png` (SVG source alongside it). Temporary — deliberately
no wordmark.

## Advisory only

Neither of these touches the channel; they write recommendations.

- **`youtube` skill** at `~/.claude/skills/youtube/` — 14 commands (`/youtube
  audit`, `seo`, `script`, `hook`, `thumbnail`, `strategy`, `calendar`,
  `shorts`, `analyze`, `repurpose`, `monetize`, `competitor`, `metadata`,
  `ideate`).
- **Read-only API key** as `YOUTUBE_API_KEY` in `~/.claude/settings.json`, same
  value as `EXPLAIN_YOUTUBE` in `D:/Projects/tempTestKeys/.env`. It lives in two
  places, so rotate both. It was created under the *other* Google account, which
  does not matter: an API key authenticates the calling project, not a user, and
  public reads work against any channel.

## Open items

**Episode 8 has no vertical cut yet** — its speech clips exist, the Veo pass and
the compositor step do not.

**Captions.** `timing.json` holds a Whisper transcript with word onsets for every
shot — an accurate caption source, better than YouTube's auto-captions, and
already on disk. Converting it to SRT is a small job whenever you want it.
