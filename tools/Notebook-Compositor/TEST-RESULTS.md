# Test results — Notebook Compositor 3.0.0

Execution date: 2026-09-11. These are recorded runs, not proposed tests.

Source SHA-256 (`tools/make-vertical-notebook.mjs`):

```text
550a3a51fb5823c0ae8d4d801a906c84181e23339d016a0f4e037bc27c3bb0ac
```

## Final implementation

| Suite | Result | Recorded wall time |
| --- | --- | --- |
| Unit tests | **37 passed, 0 failed** | 0.164 s |
| FFmpeg integration tests | **25 passed, 0 failed** | 57.055 s |
| Supplied episode-1 JSON/timeline preflight | Passed, 15 planned clips | See log |
| Reference-image preview | Passed, 600 frames / 20.000 s, 1080×1920, 30 fps, stereo AAC | See render log/probe |
| Full decode of reference preview | Passed, no FFmpeg errors | Empty error log is expected |
| Syntax checks of main module and launcher | Passed | Node `--check` |

**62 automated tests passed.** Tests use Node.js v22.16.0 and FFmpeg/ffprobe 7.1.5 on Linux x86_64; exact binary build strings are included in `tests/results/`. Local execution speed is not a promise about a Windows PC or a real episode.

## What was checked

The unit suite covers the supplied episode's original timing, 3,728 total output frames and 5,964,800 normalized audio samples, authored punctuation and number spellings, invalid/overlapping timings, frame/sample quantization, exact-aspect center geometry, clip subset selection, Unicode graphemes, ASS timing boundaries, bounded easing, deterministic masks, manifest validation, duplicate filenames, and unsupported transcript command syntax.

New artistic tests check the actual house palette, fixed card geometry across different source aspect ratios, fully hidden endpoints, edge-only transparency rather than a whole-face fade, monotone neutral grading, bypass modes, bounded clip-level exposure statistics, sentence-aware breaks, center-facing caption coordinates, deterministic static paper assets, separated drawing/grade branches, and invalid artistic configurations.

The FFmpeg suite performs real 1080×1920 renders, not only filter-string assertions. It tests 44+46-frame joining, independent reference comparisons of the center drawing through motion and a join, original 440 Hz audio versus an unwanted 9,000 Hz narrator tone, unchanged-output resuming, corrupted-cache rebuilding, changed-config overwrite protection, alpha/mask/key paths, short-narrator freeze/loop, measured pagination, per-clip-source fallback, missing original audio, active locks, rational 30000/1001 joins, positive original-audio timestamp offsets, stable already-revealed letters, persisted grade reports, actual rendered caption bounds in both panels, opaque revealed narrator pixels during the slide, clean hidden endpoints, static masks with narrator offsets, incorrect narrator sidecar timing, and unframed grade-off alpha.

All public synthetic MP4s created by the suite are fully decoded with `-xerror`.

## Before/after baseline

The previous v2 file was tested before editing: **25 unit tests and 18 integration tests passed**. This explicitly confirms the formerly unconfirmed fractional-frame-rate concat correction on this host. Its logs are included as `baseline-*.tap`. The delivered v3 was then rerun after the new implementation and bug fixes; the final passing logs are `unit.tap` and `integration.tap`.

During implementation, real renders caught alpha-plane format negotiation in the LUT branch. Explicit RGBA/alpha handling was added and the final suite rerun. Alpha-bearing images are now also scaled in premultiplied form before returning to straight alpha. A test fixture that read the intentionally failed-run manifest after the overwrite-protection test was corrected to read the retained per-clip style report; this was a test-state issue, not a successful render being omitted from the final verification.

## Limits of this evidence

- **Not executed on Windows.** Unicode/spaces/apostrophe paths were exercised on Linux. Windows spawning, fonts and filesystem/antivirus behavior still need a local smoke test.
- **Actual episode videos were not supplied.** The supplied JSON was validated, synthetic moving video/audio were tested, and user-supplied still references were rendered. No claim is made that a particular local v2 narrator set matches the v3 cuts or is lip-synchronized correctly.
- **The reference preview is silent and uses a synthetic center diagram.** It cannot establish real speech alignment or judge the generator's temporal flicker.
- The installed Segoe Print / CJK font combinations were not available on the test host. The local Windows font must pass the actual render and phone-readability check.
- Adversarial filesystem races, power loss, network volumes, arbitrary damaged-media formats, all complex-script shaping cases, and prolonged real-world rendering were not exhaustively tested.

## Acceptance on the user's computer

Run the two suites, then render the first three actual paired clips to a new preview folder. Watch with sound at phone size and inspect a stronger color/contrast change. For isolated visual inspection of clips 1, 10 and 12, use `--only 1,10,12 --no-join` (noncontiguous clips deliberately cannot be joined). Confirm that the input narrator generation used the same original cut bounds. Once acceptable, render the full episode and decode the final MP4 as documented in the README.
