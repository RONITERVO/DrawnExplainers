"""Word-level alignment for the narration WAVs.

SyncVoice's own cues are either fragment-arrival artifacts (default) or a
uniform spread across the duration (--normalize-cues). Neither is a true word
onset, and beats anchored to them drift or stutter. Whisper large-v3-turbo on
the local GPU gives real onsets, and doubles as the QA pass: the transcript it
returns is diffed against the script text.

Writes timing.json: { externalId: { durationMs, words: [{word, startMs, endMs}], heard } }
"""
import json
import pathlib
import sys

import whisper

ROOT = pathlib.Path(__file__).parent
MODEL_PATH = r"D:\AI\ComfyUI\models\stt\whisper\large-v3-turbo.pt"

manifest = json.loads((ROOT / "assets/syncvoice/manifest.json").read_text(encoding="utf-8"))
model = whisper.load_model(MODEL_PATH, device="cuda")

out = {}
for entry in manifest["entries"]:
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

(ROOT / "timing.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
print("wrote timing.json")
