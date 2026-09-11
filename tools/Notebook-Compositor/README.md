# Notebook Vertical Compositor — 3.0.0

A complete, self-contained Node.js / FFmpeg compositor for the notebook explainers discussed in this conversation. The drawing and its original audio remain authoritative. The narrator and transcript are adapted to the drawing kit's visual identity.

**Entry point:** `tools/make-vertical-notebook.mjs` — one module, no npm dependencies, no network calls, no imported `scene-kit.mjs`, no model downloads. The optional launcher and tests are separate. This is a replacement, not a patch to the earlier v2 tool. It deliberately uses a new configuration filename and output directory.

## Start on Windows

Install Node.js 22 or newer and a versioned FFmpeg 7.1-or-newer build containing libass, libx264, and the filters checked at startup. Put the real `ffmpeg.exe` and `ffprobe.exe` on PATH, or pass their complete executable paths. The executable options do not accept `.cmd` or `.bat` wrappers.

Unzip this package anywhere. **Double-click `Render Notebook.cmd`**. It asks for the episode directory, asks for missing input directories, and offers a three-clip preview or a full render. It does not guess between narrator generations. Enter the directory that belongs to the exact cuts in your `clip-index.json`.

On Windows the tool uses the installed **Segoe Print** font (`C:/Windows/Fonts/segoepr.ttf`), matching the drawing kit. A missing font is an error, not an unnoticed switch to Arial. No font files or FFmpeg binaries are included. On Linux/macOS the tool uses a documented, warned fallback unless an explicit font is supplied. Typography in the supplied Linux preview therefore is not proof of the Windows Segoe Print rendering.

### Command-line route: episode 1

From the extracted package directory:

```powershell
$Tool = ".\tools\make-vertical-notebook.mjs"
$Ep1 = "D:\Projects\Apps\DrawnExplainers\sets\not-arbitrary\ep01-chinese-characters"
$Narrators = Read-Host "Full path to narrator clips paired with this episode's clip-index.json"

node --version
ffmpeg -version
ffprobe -version
node $Tool --episode $Ep1 --check-data
node $Tool --episode $Ep1 --narrator-dir $Narrators --dry-run
node $Tool --episode $Ep1 --narrator-dir $Narrators --limit 3 --preset veryfast --output-dir "vertical-notebook-preview"
```

Watch `vertical-notebook-preview/vertical-selection.mp4`, with sound, on a phone. Then:

```powershell
node $Tool --episode $Ep1 --narrator-dir $Narrators
```

This creates `vertical-notebook/001__top.mp4`, `002__bottom.mp4`, etc., and `vertical-full.mp4`.

**Your screenshot showed a v3 original-cut manifest and v2-named narrator folders.** The name alone neither proves nor disproves compatibility. Use the exact paired cut set. A narrator index sidecar, described below, can detect declared timing mismatches. It cannot visually recognize a wrongly named clip.

### Episode 2 and future episodes

No episode-2 media or directory name was supplied. These commands ask for the real directories, not an invented episode title:

```powershell
$Ep2 = Read-Host "Full path to episode 2"
$Narrators2 = Read-Host "Full path to its paired narrator clips"
node $Tool --episode $Ep2 --narrator-dir $Narrators2 --check-data
node $Tool --episode $Ep2 --narrator-dir $Narrators2 --dry-run
node $Tool --episode $Ep2 --narrator-dir $Narrators2 --limit 3 --preset veryfast --output-dir "vertical-notebook-preview"
node $Tool --episode $Ep2 --narrator-dir $Narrators2
```

Change `--original-dir` when the manifest lives somewhere other than `out-clips-talking-face-v3`. Paths may be absolute or relative to the episode. No episode-specific changes to the module are needed.

## Required inputs

```text
episode/
  out.mp4                         Full authoritative drawing video WITH original audio
  timing.json                     Authored script and word timings, UTF-8 JSON
  vertical-notebook.json           Optional v3 configuration
  out-clips-talking-face-v3/
    clip-index.json               Contiguous cut plan; see below
    001__original.mp4              Only required in explicit sourceMode=clips
    002__original.mp4
  narrator-clips/
    001__narrator.mp4
    002__narrator.mp4
    narrator-index.json           Recommended cut-correspondence sidecar
  narrator-masks/                  Only needed in external-mask mode
    001.png
    002.mp4
```

The input videos are real media files, **not screenshots with a media-player interface**. The compositor does not identify or remove playback controls, watermarks, or text baked into a generated narrator.

The clip manifest needs a nonempty `clips` array. Each clip has a unique positive integer `index`, `filename`, `startMs`, `endMs`, and `durationMs`. Durations must equal end minus start, and clips must be contiguous in index order. `settings.fps`, `settings.headMs`, and `settings.gapMs` supply the clock unless explicitly overridden. The supplied episode-1 fixture demonstrates the existing accepted format.

Narrator names must be `001.mp4` or `001__description.mp4`, etc. Supported video filename extensions: MP4, MOV, MKV, WEBM, M4V, AVI. The container must actually contain supported decodable media. Multiple matches fail. An explicit per-clip filename resolves ambiguity. Original filenames come from the manifest.

Recommended narrator sidecar:

```json
{
  "clips": [
    { "index": 1, "filename": "001__narrator.mp4", "startMs": 0, "endMs": 6775 },
    { "index": 2, "filename": "002__narrator.mp4", "startMs": 6775, "endMs": 14505 }
  ]
}
```

These two numbers are episode-1 examples. Include every selected clip, with that episode's actual original cut bounds. Indices in per-clip configuration use `"1"`, not `"001"`.

## What the notebook treatment actually does

### Stable house palette

The outer desk is `#ebe4db`, paper `#f9f6f1`, ink `#493e36`, and the soft paper edge `#d4c7b9`. These are rounded RGB conversions of the supplied drawing kit's HSL palette. A still, very lightly ruled page unifies the upper and lower panels. A subtle paper mat frames the narrator illustration. No new page wobble, animated grain, or grade is applied over the original drawing.

### Narrator-only warm-ink grade

A generated 33×33×33 RGB LUT maps neutral darks and lights to the house ink and paper. It retains a small, configurable amount of source chroma. The default color-retention coefficient is 0.18; this is a coefficient in the documented tone/chroma transform, **not a promise of perceptually identical saturation between pictures**.

With `autoLevels: true`, five small frames are sampled across the portion of each narrator used. The median of their 2nd and 98th luminance percentiles is used to select a conservative black and white point. Automatic black is constrained to 0–0.06 and white to 0.88–1. Nonopaque pixels are excluded when measuring alpha/masked inputs. Empty samples are reported and fall back to fixed endpoints.

**One fixed LUT is used for the whole clip.** No per-frame exposure adjustment, temporal recoloring, or brightness pumping is introduced. Source flicker or source palette changes within a clip can still remain. The color pass cannot change hatching, line thickness, identity, pose, scenery, composition, or an incorrect performance.

Useful controls:

```json
{
  "version": 3,
  "narrator": {
    "grade": {
      "mode": "notebook",
      "colorRetention": 0.18,
      "strength": 1,
      "gamma": 1,
      "autoLevels": true
    }
  }
}
```

`colorRetention: 0` produces warm monochrome. Raising it keeps more of the original hue differences. `mode: "off"` bypasses grading. `strength: 0` also bypasses it. Gamma above 1 brightens midtones. Setting `autoLevels: false` uses fixed 0–1 levels; `blackPoint` / `whitePoint` can override either endpoint. These are RGB signal-space artistic controls, not an HDR or scene-referred color-management pipeline.

Every rendered clip has `work/clip00001/style-report.json`, its sampling statistics, actual levels, geometry, and the generated `narrator.cube`. Editing a cached `.cube` is not a supported customization method; use the configuration, which participates in the render fingerprint.

### Framing and actual occlusion

Opaque narrator videos remain complete illustrated scenes. The whole scene is fitted inside a consistent 16:9 paper-card aperture, without an automatic person crop. Different narrator aspect ratios may leave paper padding, but do not change the default card footprint. The narrator's even-pixel scaling can have small aspect-rounding differences; the standard 16:9 original has the exact-aspect fit described below.

The card moves behind the center drawing, and reappears in the other panel on the next clip. The backing around the center drawing is fully opaque and placed last. Narrator and transcript cannot paint on top of it. The paper card must be small enough to fit entirely behind this protected band; invalid geometry fails early.

The transition is a quintic-eased slide, with a narrow, softly irregular mask next to the center edge. Default feather is 14 output pixels at 1080-wide scale, irregularity 4 pixels, and duration 0.6 seconds at each clip edge. **The already-revealed face is not globally faded.** There is no smoke simulation or automatic character segmentation. A short clip shortens the transitions to at most roughly one-third of its duration per edge; extremely short clips can disable them. `transition.seconds: 0` disables movement and feathering; `kind: "slide"` keeps the slide without the feather.

### Text

Authored `script` is the default displayed text. Recognized words supply timing, not authority to rewrite punctuation. Display-token counts must match timed-word counts. Different counts fail rather than inventing an alignment. Same-count substitution is positional, not proof that every word was recognized correctly. Review the recorded corrections.

For reviewed segmentations, provide one `displayTokens` item per timed word:

```json
{
  "section.example": {
    "durationMs": 1200,
    "script": "Three thousand years.",
    "displayTokens": ["Three thousand", "years."],
    "words": [
      { "word": "3000", "startMs": 0, "endMs": 700 },
      { "word": "years.", "startMs": 700, "endMs": 1100 }
    ]
  }
}
```

An explicit `text.source: "words"` uses recognized text instead. The tool does not translate or rewrite it. Sections are read in JSON insertion order by default; `timingOptions.sectionOrder` must list all sections exactly once when a different order is required. Per-section `timelineStartMs` is supported for explicit absolute placement. Ensure this order agrees with the audio-generation schedule; the module does not import any unseen episode module or infer ordering from spoken content.

Type-on uses Unicode graphemes interpolated within each word interval, then quantizes events to the output frame grid. This is **not phoneme/letter alignment**. At 30 fps, several graphemes can reveal on the same frame. Clips do not compress the timing of a word crossing a cut.

The full text layout is rendered with libass using the actual configured font. Unrevealed text remains transparent in the same dialogue so the page's layout stays stable. Oversized paragraphs are paginated; a natural sentence/clause break is preferred when a split is necessary. Font size is not silently reduced. Pages are left aligned and placed toward the center drawing, inside the opposite panel. The complete measured paragraph determines its position, not the currently visible prefix. Fast pages are warned about in the output manifest and console.

Font size defaults to 60 output pixels and margin to 96. `maxHeightFraction: 0.8` reserves some vertical breathing room. `anchor` can be `center-facing`, `center`, or `top`. `phraseAware` can be disabled. A single unbreakable display token that will not fit fails with guidance.

ASS command characters (braces/backslashes) and unsupported control characters in transcript tokens are deliberately rejected. Complex shaping, right-to-left languages, and every font/glyph combination have not been exhaustively visually verified. Missing-glyph errors are checked during measurement; system fallback availability can still differ across machines. For reproducible multilingual work, explicitly supply your licensed fallback files:

```json
{
  "version": 3,
  "text": {
    "fontFile": "C:/Windows/Fonts/segoepr.ttf",
    "fontName": "Segoe Print",
    "fallbackFonts": ["C:/Windows/Fonts/hyswlongfangsong.ttf"]
  }
}
```

Only add paths to fonts you actually have. Font files are not distributed with this tool. Private runtime `work/*/fonts` directories contain copies of your local fonts; do not include those directories when sharing outputs or code.

## Drawing preservation and audio

Default output: 1080×1920, with a 1080×608 protected center band at y=656. A 1920×1080 original is fitted at **1056×594**, x=12, y=663. This keeps the full original 16:9 image without crop or geometric stretching. A full-width exact 16:9 image at 1080 pixels wide would be 607.5 pixels high; the small backing border avoids pretending that is an integer-pixel raster.

No narrator grade, notebook decoration, text, feathering, or additional animation is applied to the drawing branch. Scaling, color-space conversion and H.264 encoding still change pixels. **This does not mean bit-identical preservation.** Small text embedded in the horizontal drawing may become difficult to read on a phone; the tool does not rewrite, enlarge, or invent those original labels.

`sourceMode: "master"` is the default. The master supplies the center frames and original audio; the clip manifest supplies cut bounds. Global frame boundaries are rounded once, and audio-sample boundaries derive from those frames. Output intervals are contiguous; no narrator transition extends, overlaps or shortens the authoritative episode. Narrator audio is never mapped, even when present.

Audio is decoded to 48 kHz stereo PCM by default, preserving the original timeline rather than changing speed. Channel/sample-rate conversion is deliberate, and output AAC is lossy. `audio.codec: "alac"` encodes the normalized PCM losslessly, with player compatibility depending on your destination. It does not promise preservation of the source compressed bitstream or original format. Large missing audio tails fail; at most the configured small tail pad (0.12 seconds by default) is allowed and recorded. A positive original-audio timestamp offset is preserved as initial silence.

Individual MP4s have their own AAC encodes. A joined MP4 uses compatible **video-only** caches and a single continuous master-audio encode, not a chain of standalone AAC clips. Joined video compatibility, frame counts, start times, duration, and audio configuration are checked. Fractional frame rates use cumulative microsecond concat bounds, avoiding independent rounding accumulation.

`--source-mode clips` is an explicit fallback for originals edited after cutting. It decodes each original clip's audio to PCM before joining. It cannot repair upstream duplicate frames, bad trims, encoder offsets, or continuity already lost in those inputs. Prefer the original full master for an unchanged coded drawing episode.

## Opaque, alpha, keyed and masked narrators

| Mode | Behavior |
| --- | --- |
| `opaque` | Default. Preserves the full narrator scene and presents it as an illustration card. |
| `alpha` | Uses real decoded alpha. `alphaType` is `straight` or `premultiplied`. Tagged alpha VP9 WebM explicitly uses libvpx-vp9. |
| `mask` | Uses a separate same-dimension grayscale mask. White visible, black transparent. Still PNG/PGM/JPEG/WEBP and synchronized mask videos are supported. |
| `colorkey` | Explicit source-color key before grading. White-keying pencil pictures can remove wanted white clothing/face details; it is not the recommended mode for these examples. |

Alpha/masked/keyed color is resampled in premultiplied form and converted back before grading/overlay to reduce edge-fringe problems. The saved alpha is carried separately from the RGB LUT. With the default `card.enabled: true`, transparent areas show the card's paper. Set `narrator.card.enabled: false` for a floating cutout instead; frame consistency is then no longer the default art direction.

A short narrator defaults to freezing its last picture for up to `maxFreezeSeconds: 1`. This never changes original audio duration. Larger shortfalls fail unless explicitly permitted. A long narrator is trimmed with a warning. Alternative policies are `loop` and `error`; loop repeats the visual input, **not** a semantically lip-synchronized performance. Incorrectly paired or poorly lip-synchronized source clips cannot be repaired by these policies. `offsetSeconds` is a visual alignment control for already-reviewed inputs, not automatic sync detection.

## Configuration and operation

Copy `examples/vertical-notebook.json` to the episode as `vertical-notebook.json`, edit paths as needed, then use the same render command for that episode. `examples/all-settings.json` lists every accepted setting. It is a snapshot of defaults; normal small per-episode overrides are easier to maintain. Unknown keys fail, rather than being silently ignored. CLI options override the JSON.

`examples/per-clip-overrides.example.json` shows an artistic correction for clip 10 and alpha input for clip 12. It is illustrative, not an assertion about your media. Only reference indices present in the episode. Per-clip overrides can set `narratorFilename`, `maskFilename`, `position`, and any nested `narrator` setting.

```powershell
# Full CLI help and defaults
node $Tool --help
node $Tool --version
node $Tool --print-defaults

# Data-only check against the included episode-1 fixture
node $Tool --episode ".\examples\episode-1-data" --original-dir "." --check-data

# Render separate selected clips, retaining original top/bottom assignment
node $Tool --episode $Ep1 --narrator-dir $Narrators --only "1,10,12" --no-join --output-dir "vertical-art-check"

# Existing identical output resumes automatically; changed public output requires explicit replacement
node $Tool --episode $Ep1 --narrator-dir $Narrators --overwrite

# Individual clips only
node $Tool --episode $Ep1 --narrator-dir $Narrators --no-join

# Explicit executable paths, independent of PATH
node $Tool --episode $Ep1 --narrator-dir $Narrators --ffmpeg "C:\ffmpeg\bin\ffmpeg.exe" --ffprobe "C:\ffmpeg\bin\ffprobe.exe"
```

Noncontiguous selected clips cannot be joined accidentally; use `--no-join`. A contiguous subset joins to `vertical-selection.mp4`, while the complete selection creates `vertical-full.mp4`.

No recursive directory deletion is performed. Output directories containing inputs, including detected path aliases, are rejected. Output publication uses temporary files, validation, rename and SHA-256 receipts. Same-input reruns check receipt hashes before reusing completed caches. Changed/unverified public MP4s require `--overwrite`; incomplete private caches can be rebuilt. A PID/host lock prevents ordinary concurrent writers to one output directory. Dead local PID locks can be reclaimed; unfamiliar/active locks require inspection.

`vertical-index.json` records `rendering`, `failed`, `interrupted`, or `complete`. **An old MP4 in the directory is not proof that the latest run succeeded.** Check the manifest status and receipts. Original assets must not change during rendering. Neither these checks nor file renames are a full multi-file database transaction or a promise of immunity to power loss, hostile filesystem changes, antivirus locks, or network-volume semantics.

Processing is sequential and thread-bounded. Frames stay in FFmpeg, not in a Node array containing an entire episode. Paper assets, masks, PCM, LUTs and video caches use disk space. At default audio settings, PCM is 384,000 bytes per second, about 47.7 MB for episode 1, plus its WAV header. Video caches and standalone/joined files add further space. FFmpeg still uses multiple full-frame buffers. No absolute memory or render-time ceiling is promised. CPU libx264 is the supported encoder; there is no hidden GPU or model dependency. `--preset veryfast` trades file size/efficiency for speed without changing the composition.

The tool is deliberately conservative about source formats: bake rotation into pixels, use square pixels and progressive BT.709/untagged SDR, and normalize unsupported timestamp origins before supplying a master. HDR, interlacing, anamorphic video and several alternate color-primary tags are rejected rather than silently graded. A differing or variable input frame rate may require output-frame duplication or dropping. Pin your tested FFmpeg build and fonts for long-term use.

## Verification

From the extracted package directory:

```powershell
node --test .\tests\unit.test.mjs
node --test .\tests\integration.test.mjs

ffprobe -v error -show_entries "stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels,duration:format=duration" -of json "$Ep1\vertical-notebook\vertical-full.mp4"
ffmpeg -v error -xerror -i "$Ep1\vertical-notebook\vertical-full.mp4" -f null -
```

The integration suite creates synthetic media in a fresh temporary directory and never needs your private episode videos. Test paths include spaces, an apostrophe and Unicode. This exercises shell-free/path handling on the host where the tests run, **not** actual Windows execution when run on Linux. Synthetic artifacts are retained for inspection. Environment variables `FFMPEG`, `FFPROBE`, and `VERTICAL_TEST_DIR` can specify test executables/location. Use a new test directory; avoid your real project/input directories.

Read `TEST-RESULTS.md` for the actual measured test status, runtime environment, and remaining acceptance checks. First watch three real clips, with sound, including top/bottom swaps and your strongest style changes. Then render the full episode. The tool cannot certify subjective audience comfort from still references alone.

## Reference preview

`preview/notebook-style-preview.mp4`, when included, is a silent 1080×1920 demonstration rendered by this same tool from the supplied **still images**, a deliberately synthetic center drawing, and synthetic word timings. It is not the user's completed episode, not generated lip-sync, and not a speech-alignment test. One narrator reference was a player screenshot: playback-interface regions were cropped **only while preparing this demonstration input**. The compositor does not perform that crop on real videos. See `preview/README.md` for the exact preparation notes.

## Technical reference

Implementation choices were checked against FFmpeg's official filter/CLI/format documentation and the installed FFmpeg 7.1.5 filter help. Relevant references: `https://ffmpeg.org/ffmpeg-filters.html` (lut3d, overlay, premultiply, unpremultiply, geq, ass), `https://ffmpeg.org/ffmpeg.html` (file-loaded filter options and input seeking), and `https://ffmpeg.org/ffmpeg-formats.html` (concat demuxer). The online manuals evolve; the test suite is the practical acceptance gate for your pinned binary.
