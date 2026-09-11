# Publishing

How an episode gets from `out.mp4` onto YouTube and TikTok, and what is wired up
to help.

## The channel

| | |
| --- | --- |
| Name | MaestroChatAndLearn |
| Handle | [@maestrochatandlearn](https://www.youtube.com/@maestrochatandlearn) |
| Channel ID | `UCGpGSO3QL9pCkjcpw45wemg` |
| Studio | https://studio.youtube.com/channel/UCGpGSO3QL9pCkjcpw45wemg |
| Created | 2026-03-03 |
| State as of 2026-09-10 | 0 subscribers, 1 video, 10 views, **description empty** |

The one existing video is titled `3. maaliskuuta 2026` with no description — an
untitled test upload. So the channel is effectively a clean slate.

## What is wired up

- **`youtube` skill** installed at `~/.claude/skills/youtube/` (from
  [AgriciDaniel/claude-youtube](https://github.com/AgriciDaniel/claude-youtube)).
  14 commands: `/youtube audit`, `seo`, `script`, `hook`, `thumbnail`,
  `strategy`, `calendar`, `shorts`, `analyze`, `repurpose`, `monetize`,
  `competitor`, `metadata`, `ideate`. A bare `git clone` puts the skill one
  directory too deep — the contents of `skills/claude-youtube/` belong at
  `~/.claude/skills/youtube/`, which is what `install.sh` does.
- **API key** wired as `YOUTUBE_API_KEY` in `~/.claude/settings.json` `env`
  (the skill's Python reads `os.environ["YOUTUBE_API_KEY"]`). Same value as
  `EXPLAIN_YOUTUBE` in `D:/Projects/tempTestKeys/.env`; it now lives in two
  places, so rotate both.
- Verified working against the channel on 2026-09-10.

## What is NOT wired up, and why

**Nothing here can upload a video.** The key is a Google API key (`AIza…`), which
authenticates the *application* and is read-only for the YouTube Data API. Upload
requires OAuth 2.0 with the `youtube.upload` scope, which authenticates *a user*
and needs a browser consent step. The `youtube` skill is a consulting skill and
does not upload either — by design, it writes recommendations and metadata for a
human to apply.

So today the flow is: this repo produces the file and the metadata; the upload
itself is manual in Studio.

If that becomes the bottleneck, the fix is an OAuth uploader — an installed-app
client created in Google Cloud Console, one browser consent, and a stored refresh
token that makes every later upload non-interactive. It is maybe an hour of work
and needs one manual step from you (creating the client). Worth doing at roughly
the point where uploading by hand stops being a five-minute job.

## Per-episode checklist

Publish copy is already written and lives in each episode's `episode.json` under
`publish` — YouTube title, description and tags, TikTok caption and hook. Do not
rewrite it in Studio; copy it from there so the file stays the record.

1. `sets/<set>/<ep>/out.mp4` — 1080p30, −14 LUFS, already platform-ready.
2. Upload in Studio. Title and description from `episode.json` → `publish.youtube`.
3. Tags from the same block.
4. Thumbnail: pull a frame with `node lib/build.mjs <ep> --at=<seconds>` and
   screenshot it, or design one — `/youtube thumbnail` will write a brief.
5. Set the language to English and add the episode to a playlist per set.
6. TikTok: same `out.mp4`. It is 16:9 and TikTok is 9:16, so it will letterbox —
   see below.
7. Update `status` in `episode.json` and `catalog.json` from `rendered` to
   `published`, and add the URL.

## Open decisions

**The channel name does not match the content.** MaestroChatAndLearn reads as the
language app's channel; the films are *Not Arbitrary*, which is a different
thing that happens to share a house style. Three options, and this is a call
only you can make:

- Rename the channel to the series and treat Maestro as one topic among many.
- Keep the app channel and publish the films as a playlist on it.
- Leave this channel to the app and start a second one for the films.

Nothing below this line should be actioned until that is decided, because the
channel description depends on it.

**Vertical crops for TikTok.** The films are composed for 16:9 with a card that
already has generous margins. A 9:16 crop of the centre would cut the two-column
reveals in half. The cheap fix is letterboxing on a paper-coloured background;
the better fix is a `--vertical` render mode that restacks the two columns
vertically. Worth doing only once there is evidence TikTok is working.

## Draft channel description

For the "publish the films here" path. Paste into Studio → Customisation → Basic
info. Currently empty, so anything is an improvement.

> Short hand-drawn films about things that look arbitrary and turn out to be
> pictures. Chinese characters, the alphabet, the card suits — each one drawn
> from what it used to be and moved, on paper, until it becomes the mark you
> already know.
>
> New episode every so often. No filler, no intro music, under three minutes.

Keywords: `etymology, writing systems, hand drawn animation, explainer, language,
history, chinese characters, alphabet, design history, typography`

## Notes

- `catalog.json` and each `episode.json` are the source of truth for what exists
  and what state it is in. Keep them current or the record rots.
- The Whisper QA transcript in `timing.json` doubles as an accurate caption
  source if you ever want to upload subtitles rather than rely on auto-captions.
