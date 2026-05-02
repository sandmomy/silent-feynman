# FV Exploration Radar

Self-hosted scout for new creative-content models & repos. Skips the noise
(LLMs, embeddings, robotics, chatbots) and surfaces only what could fit the
Frequency Vibes / BookVoice / Eugene work pipeline.

## Run it

Double-click `start.bat`, or from a terminal:

```bash
python scout.py            # full scan (~30s) + auto-opens radar.html in browser
python scout.py --quick    # smaller per-tag limit (~10s)
python scout.py --quiet    # write radar.html, don't open browser
```

Output: `radar.html` — editorial dark theme, two sections:
- **📡 Trending**: discovered this scan, sorted by recency × popularity
- **👁 Watchlist**: pinned references (Wan, FLUX, Cosmos, LTX, Higgs, ComfyUI, etc.)

Filter buttons up top: all / HF only / GH only / fresh (≤14d) / recent (≤60d).

## What it scans

**HuggingFace pipeline tags** — every model carries a `pipeline_tag`. We pull
top-downloads in each, drop entries whose name/desc matches our LLM/robot/etc.
exclusion list, dedupe across tags.

```
text-to-video · image-to-video · text-to-image · image-to-image
video-to-video · text-to-audio · audio-to-audio
automatic-speech-recognition · text-to-speech
```

**GitHub topics** — `topic:<name> pushed:>90d ago`, sort by stars, drop noise.

```
text-to-video · image-to-video · video-generation · stable-diffusion
comfyui · comfyui-nodes · diffusion-models · text-to-speech
voice-cloning · ai-video
```

## What it filters OUT

Substring match on name + description. Anything containing one of these is
skipped (case-insensitive):

```
llama qwen mistral phi-3 phi3 gemma instruct chatbot rag- agent tool-use
conversational robot gr00t dexcap manipulation humanoid isaac embedding
embed- rerank sentence-transformer dataset
```

This is intentionally aggressive. If something legit gets dropped, edit
`DROP_SIGNALS` in `scout.py`.

## Watchlist

Curated list of references we always want surfaced regardless of recency,
defined at the top of `scout.py`:

- HF: `WATCHLIST_HF` — Wan, FLUX-dev, FLUX-Redux, Cosmos-Predict, Parakeet,
  LTX-Video, HunyuanVideo, Mochi, SVD-1.1, Higgs Audio
- GH: `WATCHLIST_GH` — ComfyUI, Stability generative-models, LTX-Video,
  GPT-SoVITS, fish-speech, ComfyUI-GGUF, ComfyUI-WanVideoWrapper, x-flux-comfyui

Add or remove items by editing those lists.

## Rate limits

- HF API: no auth, generous (no token needed)
- GitHub anonymous: **60 req/h** — we use ~10 topic queries + ~8 watchlist
  lookups = ~18 req per scan. That's fine for a few runs/hour.
- For heavy use: `set GITHUB_TOKEN=ghp_xxxxxxx` (a personal access token with
  no scopes — even read-only is enough) → 5000 req/h.

## Cadence

Suggest running every 2-3 weeks. Big labs publish weekly but the noise/signal
ratio at that frequency is bad — biweekly catches everything that mattered.

## Files

```
scout.py        # the script
start.bat       # one-click launch
radar.html      # generated output (gitignored)
README.md       # this file
```
