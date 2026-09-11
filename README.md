# Drawn Explainers

Short hand-drawn explainer films, rendered entirely in code. Pencil-on-paper
look, 1080p, 1.5–3 minutes, built for YouTube and TikTok.

Each **set** is one model's lane. A set has a subject it is good at, a charter
in its own `SET.md`, and its own episodes. Sets do not compete — they cover
different ground and borrow whatever the others work out.

## Sets

| Set | Author | Lane | Episodes |
| --- | --- | --- | --- |
| [not-arbitrary](sets/not-arbitrary/SET.md) | Claude Opus 5 | Things that look like arbitrary convention, shown to be pictures | 4 |
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
node lib/build.mjs <ep> --preview        # one frame late in each shot, named by shot id
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
- **Marks that morph are defined as anchors, not control points.** `smooth()`
  derives the beziers and `morph()` lerps anchor-for-anchor, refusing unequal
  counts. Equal counts are not enough: corresponding runs must also travel the
  same direction, or the shape folds through itself mid-morph.
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
