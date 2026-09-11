# Drawn Explainers

Short hand-drawn explainer films, rendered entirely in code. Pencil-on-paper
look, 1080p, 1.5–3 minutes, built for YouTube and TikTok.

Each **set** is one model's lane. A set has a subject it is good at, a charter
in its own `SET.md`, and its own episodes. Sets do not compete — they cover
different ground and borrow whatever the others work out.

## Sets

| Set | Author | Lane | Episodes |
| --- | --- | --- | --- |
| [not-arbitrary](sets/not-arbitrary/SET.md) | Claude Opus 5 | Things that look like arbitrary convention, shown to be pictures | 8 |
| _(open)_ | — | joining next month | — |

Machine-readable index: [`catalog.json`](catalog.json). Every episode also
carries its own `episode.json` recording who made it, what prompts and models
produced its voice and music, what the QA pass found, and the exact command to
rebuild it. **If you want to know what made something, look there first.**

## Layout

```
lib/                        shared pipeline — every set uses this
  scene-kit.mjs             paper, ruling, ink, draw-on, boil, timeline, frame wrapper
  build.mjs                 audio bed -> worker pool -> ffmpeg
  worker.mjs                one rasteriser per core
  music.mjs                 Lyria RealTime backing track
  align.py                  Whisper word alignment + QA transcript (all shots, or a subset)
  glyph.mjs                 morph strip for designing a mark, outside the film
sets/<set>/
  SET.md                    the lane, the rules, the author
  <epNN-slug>/
    episode.json            provenance, QA, publish copy, rebuild command
    .syncvoice/project.json the script (also the TTS manifest)
    scene.mjs               this episode's drawings and stage schedule
    timing.json             Whisper word onsets + heard-vs-script for QA
    assets/syncvoice/       generated narration WAVs + transcripts
    music.wav               Lyria bed
    narration.wav           voice only
    mixed.wav               voice + ducked bed, loudness-normalised
    out.mp4                 the film
```

## Starting from a clone

This repository is **text only** — 216 files, under a megabyte. Every binary
lives in the media store, indexed by each episode's `media.json`.

```bash
git clone https://github.com/RONITERVO/DrawnExplainers.git
cd DrawnExplainers
npm install
git config core.hooksPath tools/hooks      # refuses binary commits; not automatic on clone

node tools/media-sync.mjs status           # what is missing
node tools/media-sync.mjs pull sets/not-arbitrary/ep01-chinese-characters
```

`pull` fetches the archives named in `media.json`, checks each against the
SHA-256 recorded at upload, and refuses to extract anything that does not match.

You do not need the media to work on a film. `scene.mjs`, the script, the
Whisper timings and `lib/` are all here, so the scene renders as soon as the
`audio` group is pulled; `out.mp4` and everything downstream of it rebuilds
locally.

### What is kept where, and why

| | Where | Why |
| --- | --- | --- |
| scenes, scripts, timings, tools, episode records | git | text, diffable, the actual work |
| `music.wav`, `assets/syncvoice/` | media store, `audio` group | **irreplaceable** — Lyria has no seed, Gemini TTS is not deterministic, so regenerating changes the film |
| `out-clips-talking-face-only-video/` | media store, `veo` group | **irreplaceable** — Google video generation, costs money, never identical twice |
| `out.mp4`, `narration.wav`, `mixed.wav` | media store, `render` group | rebuilt by `node lib/build.mjs <ep>` in ~45s |
| clips, `vertical-notebook/` | media store, `clips` / `vertical` | rebuilt by `tools/make-speech-clips-v3.mjs` and `tools/Notebook-Compositor` |

The repository reached 1.6GB before this split. A binary committed to git can
never be pruned again without rewriting history, which is why `tools/hooks/pre-commit`
refuses them.

## Making an episode

```bash
# 1. Write .syncvoice/project.json — one entry per shot, stable externalId.
# 2. Narration (only changed lines re-synthesise; hashing covers text+voice+direction)
cd D:/Projects/Utilities/textToSpeechUsingRateLimitlessTTS
node agent/generate.mjs --manifest <ep>/.syncvoice/project.json --env D:/Projects/tempTestKeys/.env

# 3. Align + QA — writes timing.json, and its `heard` vs `script` fields are the QA
#    Run from a copy inside the episode; delete it afterwards.
cd <ep> && cp ../../../lib/align.py . && D:/AI/ComfyUI/.venv/Scripts/python.exe align.py && rm align.py

# 4. Read the QA before drawing anything. Fix defects in the script, regenerate.
# 5. Write scene.mjs, anchoring beats to words with beat(shotId, 'word').
node lib/build.mjs <ep> --preview        # two frames per shot (15% and 82%), named by shot id
node lib/build.mjs <ep> --at=62,138      # or exactly these timestamps

# 6. Music, then the film
node lib/music.mjs 126 <ep>/music.wav "<prompt>"
node lib/build.mjs <ep>
```

## Things worth knowing before you change the pipeline

- **Never use SyncVoice's `cues` as word timing.** Neither mode is a real onset:
  the default preserves Gemini's transcription-fragment arrival times, and
  `--normalize-cues` spreads words uniformly across the duration. Whisper's
  alignment is the authority, and the same pass doubles as QA.
- **Read the QA output before drawing.** Gemini native audio silently drops
  isolated single letters and short standalone words — episode 2 lost five
  before this caught them. It also carries a foreign word's accent into the next
  English one. When you cannot tell a defect from a mishearing, check the same
  word in other shots: right in three and wrong in one is bad audio.
- **Outline to solid is `flood()`, never `fill()`.** Overlapping paths double at
  partial opacity and go blotchy mid-fade.
- **Budget runtime as words / 2.4**, not 2.2 — Kore measures 2.26-2.58 w/s
  across episodes 1-5. Re-check against manifest.json durationMs after
  synthesis, which is exact.
- **Marks that morph are defined as anchors, not control points.** `smooth()`
  derives the beziers and `morph()` lerps anchor-for-anchor, refusing unequal
  counts. Equal counts are not enough: corresponding runs must also travel the
  same direction, or the shape folds through itself mid-morph. `mirrorRing()`
  builds a symmetric ring from one half, which makes that half of the rule free.
- **Pass `{ closed: true }` to `morph()` for anything object-shaped, and drop
  `tension` below about 0.4 for anything carved, ruled or printed.** At the
  default a Catmull-Rom balloons at every corner; a rook's battlements are
  unreadable until the tension comes down.
- **`travel()` for a free-standing object, `detach()` for a detail of one.**
  `travel()` assumes the source owns the page centre and makes room by sliding
  sideways; a notch in a stick or a pip on a card can do neither, because it
  starts at its parent's scale and cannot leave its parent. `detach()` grows the
  copy from source scale to page scale, lets it travel diagonally, and thins the
  whole parent in place. Also watch `travel()` with a wide source: its
  trajectory keeps the copy near the source for the first half of the move, so
  anything much over 400px across needs `from`/`to` spread wider than the usual
  660/1320 or the ghost and its own copy collide mid-morph.
- **Never fade a source to zero.** Thin it to about a quarter and leave it where
  it stood. The commonest empty page in these films is the six seconds between a
  mark landing and the narrator finishing, and the commonest cause is having
  removed the thing the mark came from.
- **No filters in the frame SVG.** `feTurbulence` cost more than the entire rest
  of the pipeline; the hand tremble is baked into path geometry instead, and the
  drop shadow is two offset rects. This is the difference between 1 fps and
  15 fps per core.
- **resvg has no GPU backend.** Whisper is on CUDA and the encode could be, but
  rasterising is CPU-only — parallelism across cores is the only lever, hence
  the worker pool.
- **Normalise to -14 LUFS.** YouTube and TikTok only turn loud uploads down;
  they never lift a quiet one.

## Publishing

Channel setup, the per-episode upload checklist, and what is and is not wired up
live in [PUBLISHING.md](PUBLISHING.md). Publish copy for each episode is in its
own `episode.json` under `publish`.

## Adding a new set

Create `sets/<your-set>/SET.md` declaring the author model, the lane, and the
rules the set holds itself to. Add a row to the table above and an entry in
`catalog.json`. Use `lib/` as-is, or extend it — if you add something generally
useful (a new morph primitive, a better ducking chain), put it in `lib/` so the
other sets get it too.
