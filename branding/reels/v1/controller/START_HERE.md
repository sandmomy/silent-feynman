# FV Reels — pipeline state (2026-04-30)

## How to start

Double-click **`C:\Users\Usuario\Desktop\fv-reels-start.bat`** — launches all 4 servers and opens the browser.

Or manually:
1. ComfyUI :8188 (Wan motion video)
2. Higgs :5757 (`VOICEBOX_HIGGS_PRECISION=bf16` — voice clone, NOT 4bit default)
3. Voicebox :17493 (text prep / audio post)
4. Controller :8766 (HTML UI — `python server.py` in this folder)

## What works (validated tonight)

- **Wan 2.1 i2v plain content animation** with the **scaled** model variant (`wan2.1_i2v_480p_14B_fp8_scaled.safetensors`). The plain `_fp8_e4m3fn` variant HANGS in this torch/cu130 setup — see `WAN_SETUP.md` for the full diagnosis.
- **Length 201 (8.4s clips)** is the sweet spot for quality + speed (~6 min sampling cold, ~1 min warm).
- **Higgs bf16** cloning Eugene profile `09b98354` — seed 12345, fallback 2026.
- **Compose pipeline** does: per-shot voice → voice.wav (with fades + 1.5s tails + 0.3s pauses) → motion clips with crossfade-loop → 0.4s xfade dissolves between shots → ASS subs (Hook + Caption layers) → final mux with loudnorm + fade out.

## Reel 1 state — DELIVERED to Eugene

- `reel1_authority/render.mp4` (50s, 1080×1920, ~50 MB)
- All 6 motion clips at length 201 (8.4s each)
- All 6 voice files regenerated with bf16 Higgs (shot 2 with seed 2026 to fix mumble)
- Spec timings auto-aligned to actual voice durations

## ⚠ Pending for tomorrow

**Subtitle timing in compose**: still not perfect. Issues to revisit:
- First subtitle of dense-text shots can still feel rushed
- Needs further work on chunk pacing for shots 3 and 4 (28-word voices in ~6s)
- Possibly: per-shot chunk strategy, or different word-level alignment using forced alignment library (e.g. `whisper-timestamped`, `aeneas`) instead of vanilla Whisper

Everything else is locked. The compose changes are isolated to `compose_video.py::build_ass()` so iteration is fast.

## Files

- `server.py` — controller HTTP server (port 8766)
- `compose_video.py` — final video mux pipeline
- `workflow_animate.json` — Wan 2.1 i2v workflow (length 201, scaled model)
- `WAN_SETUP.md` — root-cause analysis of the Wan hang + working config
- `spec.json` (per reel) — voice_lines, image_seeds, motion_seeds, timings
