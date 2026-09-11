"""Word-level alignment for the narration WAVs.

SyncVoice's own cues are either fragment-arrival artifacts (default) or a
uniform spread across the duration (--normalize-cues). Neither is a true word
onset, and beats anchored to them drift or stutter. Whisper large-v3-turbo on
the local GPU gives real onsets, and doubles as the QA pass: the transcript it
returns is diffed against the script text.

Writes timing.json: { externalId: { durationMs, words: [{word, startMs, endMs}], heard } }

Usage:
    python align.py                       align every shot
    python align.py s05.a.reveal,s13.recap  re-align only these, merged in

Narration is content-addressed, so fixing one line re-synthesises one line. The
QA gate had no matching incremental mode, which made every fix-and-recheck loop
cost a full re-transcription of the film. It does now.
"""
import json
import pathlib
import sys

import whisper

ROOT = pathlib.Path(__file__).parent
MODEL_PATH = r"D:\AI\ComfyUI\models\stt\whisper\large-v3-turbo.pt"
TIMING = ROOT / "timing.json"

only = {s.strip() for s in sys.argv[1].split(",") if s.strip()} if len(sys.argv) > 1 else None

manifest = json.loads((ROOT / "assets/syncvoice/manifest.json").read_text(encoding="utf-8"))

# Start from the existing alignment when re-aligning a subset, so untouched
# shots keep their onsets instead of being dropped from timing.json.
out = {}
if only:
    known = {e["externalId"] for e in manifest["entries"]}
    missing = only - known
    if missing:
        sys.exit(f"no such shot(s) in the manifest: {', '.join(sorted(missing))}")
    if TIMING.exists():
        out = json.loads(TIMING.read_text(encoding="utf-8"))

model = whisper.load_model(MODEL_PATH, device="cuda")

for entry in manifest["entries"]:
    if only and entry["externalId"] not in only:
        continue
    wav = ROOT / "assets/syncvoice" / entry["audio"]
    result = model.transcribe(
        str(wav),
        word_timestamps=True,
        language="en",
        condition_on_previous_text=False,
    )
    words = []
    for segment in result["segments"]:
        for word in segment.get("words", []):
            words.append({
                "word": word["word"].strip(),
                "startMs": round(word["start"] * 1000),
                "endMs": round(word["end"] * 1000),
            })
    out[entry["externalId"]] = {
        "durationMs": entry["durationMs"],
        "words": words,
        "heard": result["text"].strip(),
        "script": entry["text"],
    }
    print(f"{entry['externalId']:<24} {len(words):>3} words  {entry['durationMs']/1000:>6.2f}s", flush=True)

TIMING.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote timing.json ({len(only)} shot(s) re-aligned)" if only else "wrote timing.json")
