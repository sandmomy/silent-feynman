"""Reels Controller — local server + proxy.

Serves the controller HTML and proxies calls to:
  - Higgs at  http://127.0.0.1:5757
  - ComfyUI at http://127.0.0.1:8188

Routes:
  GET  /                         → index.html
  GET  /<path>                   → static file from controller/ or ../reelN_*/
  GET  /api/specs                → list spec.json for all reels
  GET  /api/spec/<reel_id>       → that reel's spec.json
  POST /api/spec/<reel_id>       → overwrite spec.json
  POST /api/voice/<reel_id>      → generate voice via Higgs, save voice.wav, return JSON {duration, sr}
  GET  /api/voice/<reel_id>      → stream voice.wav
  POST /api/image/<reel_id>/<shot_id>  → run ComfyUI workflow with the shot prompt; saves image to <reel>/shot_N.png
  GET  /api/image/<reel_id>/<shot_id>  → stream the saved image
  GET  /api/health               → simple status of Higgs + ComfyUI

Run via start.bat. Port: 8766 (8765 is taken by branding/studio).
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import soundfile as sf

PORT = 8766
HIGGS_URL = "http://127.0.0.1:5757"
VOICEBOX_URL = "http://127.0.0.1:17493"  # voicebox_lab backend — handles instruct/normalize/text_prep
COMFY_URL = "http://127.0.0.1:8188"

# Audiobook-validated instruct prompt — keeps Higgs from improvising/adding words.
# Sourced from config_higgs_audiobook.json `instruct_for_voicebox`.
EUGENE_INSTRUCT = (
    "Read exactly the provided text in calm natural audiobook English. "
    "Do not add any extra words before, during, or after the text."
)

CONTROLLER_DIR = Path(__file__).parent.resolve()
REELS_DIR = CONTROLLER_DIR.parent.resolve()
PROFILES_DIR = Path(
    r"C:\Users\Usuario\Desktop\bussines model\voicebox_lab\data\profiles"
)
WORKFLOW_PATH = CONTROLLER_DIR / "workflow.json"
CLIENT_PHOTOS_DIR = Path(r"C:\Users\Usuario\Desktop\video imagen istaram")

# Eugene voice reference — same files used by the audiobook generation that produced
# the BookVoice 8 chapters. CRITICAL: ref_text must be the actual transcript of ref_audio,
# otherwise Higgs misaligns the clone and generates garbage.
EUGENE_REF_AUDIO = Path(
    r"C:\Users\Usuario\Desktop\bussines model\voicebox_lab\experiments\higgs_audio_quantized\examples\voice_prompts\tascam_pack.wav"
)
EUGENE_REF_TEXT_FILE = Path(
    r"C:\Users\Usuario\Desktop\bussines model\voicebox_lab\experiments\higgs_audio_quantized\examples\voice_prompts\tascam_pack.txt"
)

# Higgs generation params from the audiobook config — validated to produce coherent narration.
HIGGS_TEMPERATURE = 0.25
HIGGS_TOP_P = 0.95
HIGGS_TOP_K = 50
HIGGS_CHUNK_MAX_WORD_NUM = 72
HIGGS_BUFFER_SIZE = 2


def _reel_dir(reel_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_]", "", reel_id)
    p = REELS_DIR / safe
    if not p.is_dir():
        raise FileNotFoundError(f"Reel directory not found: {safe}")
    return p


def _load_spec(reel_id: str) -> dict:
    spec_path = _reel_dir(reel_id) / "spec.json"
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    rdir = _reel_dir(reel_id)
    voice_path = rdir / spec.get("voice", {}).get("wav_filename", "voice.wav")
    spec.setdefault("voice", {})["exists"] = voice_path.is_file()
    # Overlays: list per-reel image overlays (logo / SBDI seal / etc.)
    overlays = spec.setdefault("overlays", [])
    odir = rdir / OVERLAY_DIRNAME
    for ov in overlays:
        defaults = _overlay_defaults(ov.get("filename", ""))
        for k, v in defaults.items():
            ov.setdefault(k, v)
        ov["exists"] = bool(ov.get("filename") and (odir / ov["filename"]).is_file())
        ov["url"] = f"/api/overlay/{reel_id}/{ov['id']}/file" if ov["exists"] else None
    for shot in spec.get("shots", []):
        fname = shot.get("image_filename")
        shot["image_exists"] = bool(fname and (rdir / fname).is_file())
        shot.setdefault("voice_filename", f"shot_{shot['id']}_voice.wav")
        shot.setdefault("pause_after_sec", 0.3)
        shot.setdefault("image_seed", None)
        shot.setdefault("image_seed_history", [])
        shot.setdefault("voice_seed", None)
        shot.setdefault("motion_filename", f"shot_{shot['id']}_motion.mp4")
        shot.setdefault("motion_prompt", None)
        shot.setdefault("motion_seed", None)
        shot.setdefault("motion_length_sec", None)
        mfile = rdir / shot["motion_filename"]
        shot["motion_exists"] = mfile.is_file()
        vfile = rdir / shot["voice_filename"]
        shot["voice_exists"] = vfile.is_file()
        if shot["voice_exists"]:
            try:
                info = sf.info(str(vfile))
                shot["voice_duration_sec"] = round(info.frames / info.samplerate, 2)
            except Exception:
                shot["voice_duration_sec"] = None
        else:
            shot["voice_duration_sec"] = None
    return spec


def _save_spec(reel_id: str, data: dict) -> None:
    clean = json.loads(json.dumps(data))
    if "voice" in clean and isinstance(clean["voice"], dict):
        clean["voice"].pop("exists", None)
    for shot in clean.get("shots", []) or []:
        shot.pop("image_exists", None)
        shot.pop("voice_exists", None)
        shot.pop("voice_duration_sec", None)
        shot.pop("motion_exists", None)
        # keep image_seed and image_seed_history persisted
    for ov in clean.get("overlays", []) or []:
        ov.pop("exists", None)
        ov.pop("url", None)
    spec_path = _reel_dir(reel_id) / "spec.json"
    spec_path.write_text(json.dumps(clean, indent=2, ensure_ascii=False), encoding="utf-8")


OVERLAY_DIRNAME = "overlays"
ALLOWED_OVERLAY_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
OVERLAY_POSITIONS = (
    "top-left", "top-center", "top-right",
    "center-left", "center", "center-right",
    "bottom-left", "bottom-center", "bottom-right",
    "custom",
)


def _overlay_dir(reel_id: str) -> Path:
    d = _reel_dir(reel_id) / OVERLAY_DIRNAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def _new_overlay_id() -> str:
    import uuid
    return uuid.uuid4().hex[:12]


def _overlay_defaults(filename: str, label: str = "") -> dict:
    return {
        "id": _new_overlay_id(),
        "filename": filename,
        "label": label or filename,
        "start_sec": 0.0,
        "end_sec": 5.0,
        "fade_in_sec": 0.4,
        "fade_out_sec": 0.4,
        "position": "top-right",
        "x_pct": 50,           # only used when position == "custom"
        "y_pct": 50,           # only used when position == "custom"
        "scale_pct": 30,       # width as % of video width
        "opacity": 1.0,
    }


def _overlay_position_xy(position: str, x_pct: float, y_pct: float, edge_margin: int = 60) -> "tuple[str, str]":
    """Return ffmpeg overlay x= / y= expressions for a position keyword.
    W/H are base video dims, w/h are overlay dims (ffmpeg auto-substitutes)."""
    pos = (position or "top-right").strip()
    if pos == "custom":
        # Map % to pixel anchor on base video (W, H), centered on the overlay
        # so x_pct=50,y_pct=50 = perfectly centered overlay.
        return (
            f"(W-w)*{max(0, min(100, x_pct))/100:.3f}",
            f"(H-h)*{max(0, min(100, y_pct))/100:.3f}",
        )
    em = max(0, int(edge_margin))
    presets = {
        "top-left":      (f"{em}",        f"{em}"),
        "top-center":    ("(W-w)/2",      f"{em}"),
        "top-right":     (f"W-w-{em}",    f"{em}"),
        "center-left":   (f"{em}",        "(H-h)/2"),
        "center":        ("(W-w)/2",      "(H-h)/2"),
        "center-right":  (f"W-w-{em}",    "(H-h)/2"),
        "bottom-left":   (f"{em}",        f"H-h-{em}"),
        "bottom-center": ("(W-w)/2",      f"H-h-{em}"),
        "bottom-right":  (f"W-w-{em}",    f"H-h-{em}"),
    }
    return presets.get(pos, presets["top-right"])


def _new_shot_defaults(new_id: int) -> dict:
    return {
        "id": new_id,
        "start_sec": 0.0,
        "end_sec": 3.0,
        "voice_line": "",
        "image_prompt": "",
        "caption": "",
        "image_filename": f"shot_{new_id}.png",
        "voice_filename": f"shot_{new_id}_voice.wav",
        "motion_filename": f"shot_{new_id}_motion.mp4",
        "pause_after_sec": 0.3,
        "image_seed": None,
        "image_seed_history": [],
        "voice_seed": None,
        "motion_prompt": None,
        "motion_seed": None,
        "motion_length_sec": None,
    }


def _add_overlay(reel_id: str, filename: str, data_b64: str, label: str = "") -> dict:
    """Save uploaded overlay asset under <reel>/overlays/, register a new entry
    in spec.overlays, return the created entry."""
    if not filename:
        raise RuntimeError("filename required")
    safe = re.sub(r"[^A-Za-z0-9_.\-]", "_", filename)
    ext = Path(safe).suffix.lower()
    if ext not in ALLOWED_OVERLAY_EXTS:
        raise RuntimeError(f"unsupported overlay extension: {ext} (allowed: {sorted(ALLOWED_OVERLAY_EXTS)})")
    if not data_b64:
        raise RuntimeError("data_b64 required (base64-encoded file bytes)")
    raw = base64.b64decode(data_b64)
    if not raw:
        raise RuntimeError("decoded payload is empty")
    odir = _overlay_dir(reel_id)
    # avoid collision with existing files: append (-N) before extension
    target = odir / safe
    if target.exists():
        stem, ext_ = target.stem, target.suffix
        n = 2
        while (odir / f"{stem}-{n}{ext_}").exists():
            n += 1
        target = odir / f"{stem}-{n}{ext_}"
    target.write_bytes(raw)
    spec = _load_spec(reel_id)
    entry = _overlay_defaults(target.name, label=label)
    spec.setdefault("overlays", []).append(entry)
    _save_spec(reel_id, spec)
    # Re-load so the returned entry has the computed exists/url fields
    refreshed = next(o for o in _load_spec(reel_id)["overlays"] if o["id"] == entry["id"])
    return {"ok": True, "overlay": refreshed, "size_bytes": target.stat().st_size}


def _update_overlay(reel_id: str, overlay_id: str, props: dict) -> dict:
    spec = _load_spec(reel_id)
    overlays = spec.get("overlays", [])
    for ov in overlays:
        if ov.get("id") == overlay_id:
            allowed = {
                "label", "start_sec", "end_sec", "fade_in_sec", "fade_out_sec",
                "position", "x_pct", "y_pct", "scale_pct", "opacity",
            }
            for k, v in (props or {}).items():
                if k not in allowed:
                    continue
                if k == "position" and v not in OVERLAY_POSITIONS:
                    continue
                ov[k] = v
            _save_spec(reel_id, spec)
            refreshed = next(o for o in _load_spec(reel_id)["overlays"] if o["id"] == overlay_id)
            return {"ok": True, "overlay": refreshed}
    raise RuntimeError(f"overlay {overlay_id} not found in {reel_id}")


def _delete_overlay(reel_id: str, overlay_id: str) -> dict:
    spec = _load_spec(reel_id)
    overlays = spec.get("overlays", [])
    for i, ov in enumerate(overlays):
        if ov.get("id") == overlay_id:
            fname = ov.get("filename")
            if fname:
                try:
                    (_overlay_dir(reel_id) / fname).unlink(missing_ok=True)
                except Exception:
                    pass
            overlays.pop(i)
            spec["overlays"] = overlays
            _save_spec(reel_id, spec)
            return {"ok": True, "deleted_id": overlay_id, "remaining": len(overlays)}
    raise RuntimeError(f"overlay {overlay_id} not found in {reel_id}")


def _serve_overlay_file(handler, reel_id: str, overlay_id: str) -> None:
    spec = _load_spec(reel_id)
    for ov in spec.get("overlays", []):
        if ov.get("id") == overlay_id:
            path = _overlay_dir(reel_id) / ov.get("filename", "")
            if not path.is_file():
                handler.send_error(404, "overlay file missing")
                return
            ext = path.suffix.lower()
            mime = {
                ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".webp": "image/webp", ".svg": "image/svg+xml",
            }.get(ext, "application/octet-stream")
            data = path.read_bytes()
            handler.send_response(200)
            handler.send_header("Content-Type", mime)
            handler.send_header("Content-Length", str(len(data)))
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            handler.wfile.write(data)
            return
    handler.send_error(404, "overlay not found")


PRESETS_PATH = CONTROLLER_DIR / "motion_presets.json"


def _load_presets() -> dict:
    if not PRESETS_PATH.is_file():
        return {"presets": []}
    try:
        return json.loads(PRESETS_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        return {"presets": [], "error": str(e)}


def _save_preset(name: str, motion_prompt: str, motion_length_sec: "float | None", description: str = "") -> dict:
    name = (name or "").strip()
    if not name:
        raise RuntimeError("preset name required")
    data = _load_presets()
    presets = data.get("presets", [])
    new_preset = {
        "name": name,
        "description": description or f"Saved preset {name}",
        "motion_prompt": (motion_prompt or "").strip(),
        "motion_length_sec": float(motion_length_sec) if motion_length_sec not in (None, "", 0) else 8.4,
    }
    # Replace if same name exists, else append
    for i, p in enumerate(presets):
        if p.get("name") == name:
            presets[i] = new_preset
            break
    else:
        presets.append(new_preset)
    data["presets"] = presets
    PRESETS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "preset": new_preset, "total": len(presets)}


def _create_reel(reel_id: str, title: str = "", target_sec: int = 30) -> dict:
    """Scaffold a new empty reel with 1 placeholder shot. Defaults voice profile
    to Eugene's clone (matches existing FV reels). Returns the new spec."""
    rid = re.sub(r"[^a-z0-9_]", "_", (reel_id or "").lower().strip())
    if not rid:
        raise RuntimeError("reel_id required (lowercase_with_underscores)")
    rdir = REELS_DIR / rid
    if rdir.exists():
        raise RuntimeError(f"reel {rid!r} already exists")
    rdir.mkdir(parents=True)
    # Inherit voice profile from any existing reel (or fall back to Eugene clone)
    default_profile = "09b98354-e421-4724-a665-f76c9708e186"
    default_seed = 12345
    for existing_id in _list_reel_ids():
        try:
            existing = json.loads((REELS_DIR / existing_id / "spec.json").read_text(encoding="utf-8"))
            v = existing.get("voice", {})
            if v.get("ref_profile"):
                default_profile = v["ref_profile"]
                default_seed = int(v.get("seed", 12345))
                break
        except Exception:
            continue
    spec = {
        "reel_id": rid,
        "title": (title or rid).strip(),
        "duration_target_sec": int(target_sec) if target_sec else 30,
        "duration_estimate_sec": 0,
        "subtitles": "both",
        "voice": {
            "ref_profile": default_profile,
            "seed": default_seed,
            "wav_filename": "voice.wav",
            "sample_rate": 24000,
        },
        "shots": [_new_shot_defaults(1)],
        "color_grade": "warm gold to cool teal cinematic gradient with ethereal mist transitions",
        "music": None,
        "approval": {
            "voice_generated": False,
            "images_generated": False,
            "edited": False,
            "rendered": False,
            "zak_approved": False,
            "eugene_approved": False,
        },
    }
    (rdir / "spec.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "reel_id": rid, "spec": spec}


def _delete_reel(reel_id: str) -> dict:
    """Permanently delete a reel directory and ALL its assets. Hard delete."""
    rdir = REELS_DIR / reel_id
    if not rdir.exists() or not rdir.is_dir():
        raise RuntimeError(f"reel {reel_id!r} not found")
    if not (rdir / "spec.json").is_file():
        raise RuntimeError(f"refusing to delete {reel_id!r}: not a valid reel directory (no spec.json)")
    import shutil
    files_count = sum(1 for f in rdir.rglob("*") if f.is_file())
    shutil.rmtree(rdir)
    return {"ok": True, "deleted": reel_id, "files_removed": files_count}


def _delete_preset(name: str) -> dict:
    data = _load_presets()
    presets = data.get("presets", [])
    before = len(presets)
    data["presets"] = [p for p in presets if p.get("name") != name]
    if len(data["presets"]) == before:
        raise RuntimeError(f"preset {name!r} not found")
    PRESETS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "deleted": name, "remaining": len(data["presets"])}


def _add_shot(reel_id: str) -> dict:
    spec = _load_spec(reel_id)
    existing_ids = [int(s["id"]) for s in spec.get("shots", [])]
    new_id = (max(existing_ids) + 1) if existing_ids else 1
    new_shot = _new_shot_defaults(new_id)
    spec.setdefault("shots", []).append(new_shot)
    _save_spec(reel_id, spec)
    return {"ok": True, "shot_id": new_id, "shot": new_shot}


def _duplicate_shot(reel_id: str, shot_id: int) -> dict:
    spec = _load_spec(reel_id)
    shots = spec.get("shots", [])
    src_idx = next((i for i, s in enumerate(shots) if int(s["id"]) == shot_id), None)
    if src_idx is None:
        raise RuntimeError(f"shot {shot_id} not found")
    src = shots[src_idx]
    existing_ids = [int(s["id"]) for s in shots]
    new_id = max(existing_ids) + 1
    dup = json.loads(json.dumps(src))  # deep copy
    dup["id"] = new_id
    dup["image_filename"] = f"shot_{new_id}.png"
    dup["voice_filename"] = f"shot_{new_id}_voice.wav"
    dup["motion_filename"] = f"shot_{new_id}_motion.mp4"
    # New shot has no rendered assets yet — clear the seed history but KEEP the
    # current seeds so user can re-roll deterministically if they want.
    dup["image_seed_history"] = [dup["image_seed"]] if dup.get("image_seed") else []
    # Strip ephemeral *_exists flags that _load_spec injects
    for k in ("image_exists", "voice_exists", "motion_exists", "voice_duration_sec"):
        dup.pop(k, None)
    shots.insert(src_idx + 1, dup)
    _save_spec(reel_id, spec)
    return {"ok": True, "shot_id": new_id, "shot": dup}


def _delete_shot(reel_id: str, shot_id: int) -> dict:
    spec = _load_spec(reel_id)
    shots = spec.get("shots", [])
    src_idx = next((i for i, s in enumerate(shots) if int(s["id"]) == shot_id), None)
    if src_idx is None:
        raise RuntimeError(f"shot {shot_id} not found")
    if len(shots) <= 1:
        raise RuntimeError("cannot delete the last remaining shot")
    src = shots[src_idx]
    rdir = _reel_dir(reel_id)
    deleted_files = []
    for key in ("image_filename", "voice_filename", "motion_filename"):
        fname = src.get(key)
        if fname:
            fp = rdir / fname
            if fp.is_file():
                try:
                    fp.unlink()
                    deleted_files.append(fname)
                except Exception:
                    pass
    shots.pop(src_idx)
    _save_spec(reel_id, spec)
    return {"ok": True, "deleted_shot_id": shot_id, "deleted_files": deleted_files}


def _http_get(url: str, timeout: int = 30) -> bytes:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.read()


def _http_post_json(url: str, payload: dict, timeout: int = 600) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _is_silence_line(line: str) -> bool:
    s = (line or "").strip()
    return s.startswith("(") and s.endswith(")")


def _split_into_segments(text: str, max_words: int = 46) -> list[str]:
    """Audiobook-style splitter: split text into segments of <= max_words words each,
    breaking on sentence boundaries (.!?). Same logic as render_chapter1_*_tascam_split.py."""
    import re
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if not sentences:
        return [text]
    segments: list[str] = []
    current: list[str] = []
    current_words = 0
    for sentence in sentences:
        words = len(sentence.split())
        if current and current_words + words > max_words:
            segments.append(" ".join(current).strip())
            current = [sentence]
            current_words = words
        else:
            current.append(sentence)
            current_words += words
    if current:
        segments.append(" ".join(current).strip())
    return segments


def _trim_higgs_warmup(audio, sr, head_trim_sec: float = 0.2, rms_threshold: float = 0.06,
                       window_ms: int = 1500, min_density: float = 0.4):
    """Apply head trim + density-based speech onset detection (rejects warmup bursts)."""
    import numpy as np
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if head_trim_sec > 0:
        audio = audio[min(len(audio), int(head_trim_sec * sr)):]
    frame = int(0.05 * sr)
    if frame <= 0 or len(audio) <= frame * 4:
        return audio
    n_frames = len(audio) // frame
    rms = np.sqrt(np.mean(audio[: n_frames * frame].reshape(n_frames, frame) ** 2, axis=1))
    loud = rms > rms_threshold
    window = max(4, window_ms // 50)
    min_loud = int(window * min_density)
    onset_frame = None
    for i in range(n_frames - window + 1):
        if loud[i] and int(loud[i:i+window].sum()) >= min_loud:
            onset_frame = i
            break
    if onset_frame is not None:
        onset = max(0, int(onset_frame * frame) - int(0.03 * sr))
        audio = audio[onset:]
    # tail trim
    silence_threshold = 0.0025
    mask = np.abs(audio) > silence_threshold
    if np.any(mask):
        last = int(len(mask) - np.argmax(mask[::-1]))
        last = min(len(audio), last + int(0.08 * sr))
        audio = audio[:last]
    return audio


_WHISPER_MODEL = None
_WHISPER_LOCK = None


def _whisper_transcribe_words(wav_path: Path) -> list[dict]:
    """Transcribe wav with Whisper word-level timestamps. Returns [{start, end, word}, ...]."""
    global _WHISPER_MODEL, _WHISPER_LOCK
    try:
        import whisper as _w
    except Exception:
        return []
    if _WHISPER_LOCK is None:
        import threading
        _WHISPER_LOCK = threading.Lock()
    with _WHISPER_LOCK:
        if _WHISPER_MODEL is None:
            try:
                _WHISPER_MODEL = _w.load_model("base")
            except Exception:
                return []
        try:
            result = _WHISPER_MODEL.transcribe(
                str(wav_path),
                language="en",
                fp16=False,
                word_timestamps=True,
                condition_on_previous_text=False,
            )
        except Exception:
            return []
    out = []
    for seg in result.get("segments", []) or []:
        for w in seg.get("words", []) or []:
            s = w.get("start"); e = w.get("end"); txt = (w.get("word") or "").strip()
            if s is not None and e is not None and txt:
                out.append({"start": float(s), "end": float(e), "word": txt})
    return out


def _whisper_first_word_start(wav_path: Path) -> "float | None":
    """Returns timestamp (seconds) of the first transcribed word, or None on failure.
    Lazy-loads whisper 'base' model (cached). Used to detect residual mumble that survived RMS trim.
    """
    global _WHISPER_MODEL, _WHISPER_LOCK
    try:
        import whisper as _w
    except Exception:
        return None
    if _WHISPER_LOCK is None:
        import threading
        _WHISPER_LOCK = threading.Lock()
    with _WHISPER_LOCK:
        if _WHISPER_MODEL is None:
            try:
                _WHISPER_MODEL = _w.load_model("base")
            except Exception:
                return None
        try:
            result = _WHISPER_MODEL.transcribe(
                str(wav_path),
                language="en",
                fp16=False,
                word_timestamps=True,
                condition_on_previous_text=False,
                no_speech_threshold=0.4,
            )
        except Exception:
            return None
    for seg in result.get("segments", []) or []:
        for w in seg.get("words", []) or []:
            t = w.get("start")
            if t is not None and float(t) >= 0:
                return float(t)
        s = seg.get("start")
        if s is not None:
            return float(s)
    return None


def _voicebox_generate(text: str, profile_id: str, seed: int):
    """Single call to voicebox_lab/generate/stream. Returns (audio np.ndarray, sample_rate)."""
    payload = {
        "profile_id": profile_id,
        "text": text,
        "language": "en",
        "engine": "higgs",
        "text_prep_mode": "narration",
        "normalize": True,
        "instruct": EUGENE_INSTRUCT,
        "max_chunk_chars": 800,
        "crossfade_ms": 50,
        "seed": seed,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{VOICEBOX_URL}/generate/stream",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as response:
            wav_bytes = response.read()
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"voicebox_lab backend not reachable at {VOICEBOX_URL} — "
            f"start it via run_voicebox_backend.bat. {e}"
        )
    audio, sr = sf.read(io.BytesIO(wav_bytes), dtype="float32")
    return audio, sr


def _ref_audio_for(profile_id: str) -> str:
    """Return the validated audiobook ref_audio path (tascam_pack.wav)."""
    if EUGENE_REF_AUDIO.is_file():
        return str(EUGENE_REF_AUDIO)
    # fallback: first sample of the profile (less reliable — ref_text mismatch)
    profile_dir = PROFILES_DIR / profile_id
    samples = sorted(f for f in os.listdir(profile_dir) if f.endswith(".wav"))
    if not samples:
        raise RuntimeError(f"No reference samples and tascam_pack.wav not found")
    return str(profile_dir / samples[0])


def _ref_text_for_audio(ref_audio_path: str) -> str:
    """Return the matching transcript for the ref audio. CRITICAL for Higgs alignment."""
    if Path(ref_audio_path) == EUGENE_REF_AUDIO and EUGENE_REF_TEXT_FILE.is_file():
        return " ".join(EUGENE_REF_TEXT_FILE.read_text(encoding="utf-8").split())
    return ""  # empty ref_text is safer than wrong ref_text


def _generate_shot_voice(reel_id: str, shot_id: int) -> dict:
    """Generate voice for ONE shot's voice_line. Saves to shot_<id>_voice.wav.
    Uses voicebox_lab backend at 17493 (same path the audiobook generation uses)
    which applies instruct, text_prep_mode='narration', normalize, max_chunk_chars,
    and resolves the right ref_audio + ref_text for the profile internally.
    """
    spec = _load_spec(reel_id)
    shot = next((s for s in spec["shots"] if s["id"] == shot_id), None)
    if not shot:
        raise RuntimeError(f"Shot {shot_id} not found in {reel_id}")

    text = (shot.get("voice_line") or "").strip()
    if _is_silence_line(text):
        raise RuntimeError(f"Shot {shot_id} is a silence shot — no voice to generate")
    if not text:
        raise RuntimeError(f"Shot {shot_id} has empty voice_line")

    import numpy as np
    profile_id = spec["voice"]["ref_profile"]
    # Per-shot seed override beats the global one. None or empty → use global default.
    shot_seed = shot.get("voice_seed")
    if shot_seed is not None and str(shot_seed).strip() != "":
        seed = int(shot_seed) & 0x7FFFFFFF
    else:
        seed = int(spec["voice"].get("seed", 12345))
    # Default 20: shorter segments → cleaner Higgs output (each chunk gets fresh context).
    # Audiobook used 46 because blocks were 100-300 words; reels shots are 20-30 words so
    # 20-word target splits most shots into 2 sentence-aligned segments.
    max_segment_words = int(spec["voice"].get("max_segment_words", 20))
    crossfade_ms = int(spec["voice"].get("segment_crossfade_ms", 35))
    head_trim_sec = float(spec["voice"].get("head_trim_sec", 0.2))
    rms_threshold = float(spec["voice"].get("rms_threshold", 0.06))
    window_ms = int(spec["voice"].get("density_window_ms", 1500))
    min_density = float(spec["voice"].get("min_density", 0.4))

    # Audiobook split strategy: break long voice_line into <=46-word sentence-aligned
    # segments, generate each separately, then concat with small crossfade.
    segments_text = _split_into_segments(text, max_words=max_segment_words)

    pieces = []
    sample_rate = None
    raw_total = 0.0
    seg_durations = []
    for seg_text in segments_text:
        audio, sr = _voicebox_generate(seg_text, profile_id, seed)
        if sample_rate is None:
            sample_rate = sr
        raw_total += len(audio) / sr
        clean = _trim_higgs_warmup(
            audio, sr,
            head_trim_sec=head_trim_sec,
            rms_threshold=rms_threshold,
            window_ms=window_ms,
            min_density=min_density,
        )
        seg_durations.append(round(len(clean) / sr, 2))
        pieces.append(clean)

    if not pieces:
        raise RuntimeError("no audio segments produced")

    # Concatenate with crossfade (audiobook used 35ms between segments).
    crossfade_samples = max(0, int(crossfade_ms * sample_rate / 1000))
    if len(pieces) == 1 or crossfade_samples == 0:
        final = np.concatenate(pieces)
    else:
        final = pieces[0]
        for nxt in pieces[1:]:
            if crossfade_samples > 0 and len(final) > crossfade_samples and len(nxt) > crossfade_samples:
                fade = np.linspace(0.0, 1.0, crossfade_samples, dtype=np.float32)
                tail = final[-crossfade_samples:] * (1.0 - fade) + nxt[:crossfade_samples] * fade
                final = np.concatenate([final[:-crossfade_samples], tail, nxt[crossfade_samples:]])
            else:
                final = np.concatenate([final, nxt])

    out_path = _reel_dir(reel_id) / shot["voice_filename"]
    sf.write(str(out_path), final, sample_rate)

    # Whisper post-validation: detect residual mumble at start that survived RMS trim.
    # If Whisper says the first real word doesn't start until > 0.15s, trim down to it.
    whisper_used = False
    whisper_first_word = None
    use_whisper = bool(spec["voice"].get("use_whisper_trim", True))
    if use_whisper:
        ts = _whisper_first_word_start(out_path)
        whisper_first_word = ts
        if ts is not None and ts > 0.15:
            cut = min(len(final), int(max(0, ts - 0.05) * sample_rate))  # 50ms lead-in
            final = final[cut:]
            sf.write(str(out_path), final, sample_rate)
            whisper_used = True
    final_dur = round(len(final) / sample_rate, 2)

    return {
        "ok": True,
        "shot_id": shot_id,
        "duration_sec": final_dur,
        "raw_duration_sec": round(raw_total, 2),
        "trimmed_sec": round(raw_total - final_dur, 2),
        "sample_rate": int(sample_rate),
        "voice_path": str(out_path),
        "seed_used": seed,
        "segments": len(segments_text),
        "segment_durations": seg_durations,
        "whisper_first_word_sec": whisper_first_word,
        "whisper_extra_trim": whisper_used,
    }


def _compose_reel_voice(reel_id: str) -> dict:
    """Concatenate per-shot voice WAVs (with pauses + silence shots) into voice.wav.
    Re-stamps shot.start_sec/end_sec to the actual composed timeline.
    """
    import numpy as np

    spec = _load_spec(reel_id)
    rdir = _reel_dir(reel_id)
    target_sr = 24000
    pieces: list[np.ndarray] = []
    cursor = 0.0

    for shot in spec["shots"]:
        text = (shot.get("voice_line") or "").strip()
        is_silence = _is_silence_line(text)

        if is_silence:
            # Silent hook shot — fixed 3s pacing window.
            duration = 3.0
            audio = np.zeros(int(duration * target_sr), dtype=np.float32)
        else:
            vfile = rdir / shot["voice_filename"]
            if not vfile.is_file():
                raise RuntimeError(
                    f"Shot {shot['id']} voice not generated yet (expected {shot['voice_filename']})"
                )
            audio, sr = sf.read(str(vfile), dtype="float32")
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            if sr != target_sr:
                # cheap resample by linear interp
                ratio = target_sr / sr
                idx = np.arange(0, len(audio), 1.0 / ratio)
                idx = idx[idx < len(audio) - 1]
                base = idx.astype(int)
                frac = idx - base
                audio = (1 - frac) * audio[base] + frac * audio[base + 1]
                audio = audio.astype(np.float32)
            duration = len(audio) / target_sr

        # Apply fade-in (120ms) + fade-out (60ms) per shot voice to avoid clicks
        # and give a natural breath at start. Skip for silence shots.
        if not is_silence and len(audio) > int(0.2 * target_sr):
            fi = int(0.12 * target_sr)
            fo = int(0.06 * target_sr)
            audio = audio.copy()
            audio[:fi] *= np.linspace(0, 1, fi).astype(np.float32)
            audio[-fo:] *= np.linspace(1, 0, fo).astype(np.float32)

        # Non-silent shots: pad voice with a consistent 1.5s tail of silence.
        # Gives the last word breathing room and the visual more dwell time —
        # avoids the "lots of changes happening" feeling on dense-text shots.
        if not is_silence:
            tail_silence = 1.5
            silence_pad = np.zeros(int(tail_silence * target_sr), dtype=np.float32)
            audio = np.concatenate([audio, silence_pad])
            duration = duration + tail_silence

        pieces.append(audio)

        new_start = round(cursor, 2)
        new_end = round(cursor + duration, 2)
        shot["start_sec"] = new_start
        shot["end_sec"] = new_end
        cursor = new_end

        # Inter-shot gap (consumed by xfade dissolve in the video chain so it's invisible)
        pause = float(shot.get("pause_after_sec", 0.4) or 0)
        if pause > 0 and shot is not spec["shots"][-1]:
            pieces.append(np.zeros(int(pause * target_sr), dtype=np.float32))
            cursor += pause

    composed = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)
    out_path = rdir / spec["voice"]["wav_filename"]
    sf.write(str(out_path), composed, target_sr)

    total_duration = round(len(composed) / target_sr, 2)
    spec["voice"]["duration_sec"] = total_duration
    spec["voice"]["sample_rate"] = target_sr
    spec["duration_estimate_sec"] = total_duration
    spec["approval"]["voice_generated"] = True
    _save_spec(reel_id, spec)

    return {
        "ok": True,
        "duration_sec": total_duration,
        "sample_rate": target_sr,
        "wav_path": str(out_path),
        "shots_timeline": [
            {"id": s["id"], "start_sec": s["start_sec"], "end_sec": s["end_sec"]}
            for s in spec["shots"]
        ],
    }


def _load_workflow_template() -> dict:
    if not WORKFLOW_PATH.exists():
        raise RuntimeError(
            f"Workflow template not found at {WORKFLOW_PATH}. "
            "Drop a ComfyUI API-format workflow.json there. "
            "Use 'PROMPT_PLACEHOLDER' and 'SEED_PLACEHOLDER' tokens."
        )
    return json.loads(WORKFLOW_PATH.read_text(encoding="utf-8"))


def _substitute_workflow(wf: dict, prompt: str, seed: int) -> dict:
    def walk(node):
        if isinstance(node, dict):
            return {k: walk(v) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(x) for x in node]
        if isinstance(node, str):
            return node.replace("PROMPT_PLACEHOLDER", prompt)
        return node

    wf = walk(wf)

    def walk_seed(node):
        if isinstance(node, dict):
            for k, v in list(node.items()):
                if isinstance(v, str) and v == "SEED_PLACEHOLDER":
                    node[k] = seed
                else:
                    walk_seed(v)
        elif isinstance(node, list):
            for x in node:
                walk_seed(x)

    walk_seed(wf)
    return wf


def _generate_image(reel_id: str, shot_id: int) -> dict:
    spec = _load_spec(reel_id)
    shot = next((s for s in spec["shots"] if s["id"] == shot_id), None)
    if not shot:
        raise RuntimeError(f"Shot {shot_id} not found in {reel_id}")

    prompt = shot["image_prompt"]
    # Use the shot's saved seed if set; else generate a new one (and save it).
    if shot.get("image_seed") is not None:
        seed = int(shot["image_seed"]) & 0x7FFFFFFF
    else:
        seed = int(time.time() * 1000) & 0x7FFFFFFF

    template = _load_workflow_template()
    wf = _substitute_workflow(template, prompt, seed)
    wf = {k: v for k, v in wf.items() if not k.startswith("_")}

    queued = _http_post_json(f"{COMFY_URL}/prompt", {"prompt": wf}, timeout=30)
    prompt_id = queued.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI did not return prompt_id: {queued}")

    deadline = time.time() + 900  # 15 min — first FLUX load from SSD takes ~5-7 min, subsequent gens ~10-15s
    history = None
    while time.time() < deadline:
        try:
            raw = _http_get(f"{COMFY_URL}/history/{prompt_id}", timeout=10)
            data = json.loads(raw.decode("utf-8"))
            if prompt_id in data and data[prompt_id].get("outputs"):
                history = data[prompt_id]
                break
        except Exception:
            pass
        time.sleep(1.5)

    if not history:
        raise RuntimeError(f"ComfyUI generation timed out for shot {shot_id}")

    image_meta = None
    for node_id, output in history["outputs"].items():
        for img in output.get("images", []) or []:
            image_meta = img
            break
        if image_meta:
            break
    if not image_meta:
        raise RuntimeError(f"ComfyUI returned no image for shot {shot_id}: {history}")

    qs = urllib.parse.urlencode(
        {
            "filename": image_meta["filename"],
            "subfolder": image_meta.get("subfolder", ""),
            "type": image_meta.get("type", "output"),
        }
    )
    img_bytes = _http_get(f"{COMFY_URL}/view?{qs}", timeout=30)

    out_path = _reel_dir(reel_id) / shot["image_filename"]
    out_path.write_bytes(img_bytes)

    # persist the seed used + history
    history = list(shot.get("image_seed_history") or [])
    history.append(seed)
    history = history[-10:]  # keep last 10
    for s in spec["shots"]:
        if s["id"] == shot_id:
            s["image_seed"] = seed
            s["image_seed_history"] = history
    if all(s.get("image_filename") and (_reel_dir(reel_id) / s["image_filename"]).exists() for s in spec["shots"]):
        spec["approval"]["images_generated"] = True
    _save_spec(reel_id, spec)

    return {"ok": True, "shot_id": shot_id, "image_path": str(out_path), "seed": seed}


DEFAULT_MOTION_PROMPT = (
    "Subtle gentle camera movement, ethereal mist drifting softly, particles floating slowly, "
    "divine light pulsing gently, contemplative spiritual atmosphere, no abrupt motion, "
    "cinematic Kodak Portra 400 aesthetic"
)


def _comfy_upload_image(local_path: Path, name_hint: str) -> str:
    """Upload an image to ComfyUI's input dir via /upload/image. Returns the filename used."""
    import mimetypes
    boundary = "----fvreel" + str(int(time.time() * 1000))
    mime = mimetypes.guess_type(str(local_path))[0] or "image/png"
    safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", name_hint)
    body_parts = []
    body_parts.append(f"--{boundary}\r\n".encode())
    body_parts.append(f'Content-Disposition: form-data; name="image"; filename="{safe_name}"\r\n'.encode())
    body_parts.append(f"Content-Type: {mime}\r\n\r\n".encode())
    body_parts.append(local_path.read_bytes())
    body_parts.append(b"\r\n")
    body_parts.append(f"--{boundary}\r\n".encode())
    body_parts.append(b'Content-Disposition: form-data; name="type"\r\n\r\ninput\r\n')
    body_parts.append(f"--{boundary}\r\n".encode())
    body_parts.append(b'Content-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n')
    body_parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(body_parts)
    req = urllib.request.Request(
        f"{COMFY_URL}/upload/image",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        result = json.loads(r.read().decode("utf-8"))
    return result.get("name") or safe_name


def _animate_shot(reel_id: str, shot_id: int) -> dict:
    """Run Wan 2.1 i2v on the shot's still image. Saves shot_<id>_motion.mp4.
    Pipeline: shot_N.png (768x1344) → resize 480x832 → upload to ComfyUI → run workflow →
              poll history → retrieve mp4 → save to reel folder.
    """
    from PIL import Image as PILImage

    spec = _load_spec(reel_id)
    shot = next((s for s in spec["shots"] if s["id"] == shot_id), None)
    if not shot:
        raise RuntimeError(f"Shot {shot_id} not found in {reel_id}")

    img_path = _reel_dir(reel_id) / shot["image_filename"]
    if not img_path.is_file():
        raise RuntimeError(f"Source image not generated yet: {img_path}")

    # 1) Resize 768x1344 → 480x832 (Wan 2.1 480p i2v requirement)
    rdir = _reel_dir(reel_id)
    work = rdir / ".animate_work"
    work.mkdir(exist_ok=True)
    resized = work / f"shot_{shot_id}_480x832.png"
    with PILImage.open(img_path) as im:
        im_rgb = im.convert("RGB").resize((480, 832), PILImage.LANCZOS)
        im_rgb.save(resized, "PNG")

    # 2) Upload to ComfyUI input
    upload_name_hint = f"fv_{reel_id}_shot{shot_id}_input.png"
    comfy_image_name = _comfy_upload_image(resized, upload_name_hint)

    # 3) Resolve prompt + seed
    motion_prompt = (shot.get("motion_prompt") or "").strip() or DEFAULT_MOTION_PROMPT
    if shot.get("motion_seed") is not None and str(shot["motion_seed"]).strip() != "":
        seed = int(shot["motion_seed"]) & 0x7FFFFFFF
    else:
        seed = int(time.time() * 1000) & 0x7FFFFFFF

    filename_prefix = f"fv_anim_{reel_id}_shot{shot_id}_{int(time.time())}"

    # 4) Build workflow with substitutions
    wf_template = json.loads((CONTROLLER_DIR / "workflow_animate.json").read_text(encoding="utf-8"))

    def walk(node):
        if isinstance(node, dict):
            return {k: walk(v) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(x) for x in node]
        if isinstance(node, str):
            if node == "SEED_PLACEHOLDER":
                return seed
            return (
                node.replace("PROMPT_PLACEHOLDER", motion_prompt)
                .replace("IMAGE_NAME_PLACEHOLDER", comfy_image_name)
                .replace("FILENAME_PREFIX_PLACEHOLDER", filename_prefix)
            )
        return node

    wf = walk(wf_template)
    wf = {k: v for k, v in wf.items() if not k.startswith("_")}

    # 4b) Per-shot motion length override.  motion_length_sec=null → use the
    # workflow default (length 201 = 8.4s @ 24fps).  Wan 2.1 distribution is
    # trained around length 81; values 49..401 work, beyond degrades.
    requested_len_sec = shot.get("motion_length_sec")
    if requested_len_sec not in (None, "", 0):
        try:
            requested_frames = int(round(float(requested_len_sec) * 24))
            requested_frames = max(33, min(401, requested_frames))
            for nid, node in wf.items():
                if isinstance(node, dict) and node.get("class_type") == "WanImageToVideo":
                    node.setdefault("inputs", {})["length"] = requested_frames
                    print(f"  motion length override: shot {shot_id} → {requested_frames} frames ({requested_frames/24:.1f}s)")
                    break
        except (TypeError, ValueError):
            pass

    # 5) Queue prompt
    queued = _http_post_json(f"{COMFY_URL}/prompt", {"prompt": wf}, timeout=30)
    prompt_id = queued.get("prompt_id")
    if not prompt_id:
        raise RuntimeError(f"ComfyUI did not return prompt_id: {queued}")

    # 6) Poll history (Wan 2.1 + RIFE: ~60-180s on RTX 5080)
    deadline = time.time() + 1200  # 20 min
    history = None
    while time.time() < deadline:
        try:
            raw = _http_get(f"{COMFY_URL}/history/{prompt_id}", timeout=10)
            data = json.loads(raw.decode("utf-8"))
            if prompt_id in data and data[prompt_id].get("outputs"):
                history = data[prompt_id]
                break
        except Exception:
            pass
        time.sleep(2.0)

    if not history:
        raise RuntimeError(f"Wan animation timed out for shot {shot_id} (>20 min)")

    # 7) Find the output mp4 (VHS_VideoCombine puts it under 'gifs' or 'videos' key)
    out_meta = None
    for node_id, output in (history.get("outputs") or {}).items():
        for key in ("gifs", "videos", "images"):
            for item in (output.get(key) or []):
                fname = item.get("filename", "")
                if fname.endswith(".mp4"):
                    out_meta = item
                    break
            if out_meta:
                break
        if out_meta:
            break

    if not out_meta:
        # fallback: scan ComfyUI output dir for our prefix
        comfy_output = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output")
        candidates = sorted(comfy_output.glob(f"{filename_prefix}*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not candidates:
            raise RuntimeError(f"No mp4 output found for prompt {prompt_id}. History: {history}")
        src = candidates[0]
    else:
        qs = urllib.parse.urlencode({
            "filename": out_meta["filename"],
            "subfolder": out_meta.get("subfolder", ""),
            "type": out_meta.get("type", "output"),
        })
        # Try fetching via /view; if it fails, fall back to direct file copy
        try:
            mp4_bytes = _http_get(f"{COMFY_URL}/view?{qs}", timeout=120)
            out_path = rdir / shot["motion_filename"]
            out_path.write_bytes(mp4_bytes)
            duration = None
            try:
                import subprocess as _sp
                ffprobe = shutil_which("ffprobe")
                if ffprobe:
                    r = _sp.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out_path)], capture_output=True, text=True, timeout=10)
                    duration = float(r.stdout.strip())
            except Exception:
                pass
            for s in spec["shots"]:
                if s["id"] == shot_id:
                    s["motion_seed"] = seed
            _save_spec(reel_id, spec)
            return {"ok": True, "shot_id": shot_id, "motion_path": str(out_path), "size_mb": round(out_path.stat().st_size / 1024 / 1024, 2), "duration_sec": duration, "seed": seed}
        except Exception:
            comfy_output = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output")
            sub = out_meta.get("subfolder", "")
            src = comfy_output / sub / out_meta["filename"] if sub else comfy_output / out_meta["filename"]

    out_path = rdir / shot["motion_filename"]
    out_path.write_bytes(src.read_bytes())
    for s in spec["shots"]:
        if s["id"] == shot_id:
            s["motion_seed"] = seed
    _save_spec(reel_id, spec)
    return {"ok": True, "shot_id": shot_id, "motion_path": str(out_path), "size_mb": round(out_path.stat().st_size / 1024 / 1024, 2), "seed": seed}


def shutil_which(cmd):
    import shutil as _s
    p = _s.which(cmd)
    if p: return p
    fallback = r"C:\Users\Usuario\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"
    cand = Path(fallback) / f"{cmd}.exe"
    return str(cand) if cand.is_file() else None


def _list_reel_ids() -> list[str]:
    out = []
    for d in sorted(REELS_DIR.iterdir()):
        if d.is_dir() and (d / "spec.json").exists():
            out.append(d.name)
    return out


def _ensure_higgs_loaded() -> None:
    """Make sure Higgs has the model in VRAM. Idempotent. Silent on failure."""
    try:
        raw = _http_get(f"{HIGGS_URL}/health", timeout=2)
        try:
            payload = json.loads(raw.decode("utf-8"))
            if payload.get("model_loaded") is True:
                return
        except Exception:
            return
        _http_post_json(f"{HIGGS_URL}/reload", {}, timeout=120)
        sys.stderr.write("[reels-controller] auto-reloaded Higgs (audio request)\n")
    except Exception as e:
        sys.stderr.write(f"[reels-controller] Higgs auto-reload skipped: {e}\n")


def _ensure_higgs_unloaded() -> None:
    """Make sure Higgs has freed its VRAM. Idempotent. Silent on failure."""
    try:
        raw = _http_get(f"{HIGGS_URL}/health", timeout=2)
        try:
            payload = json.loads(raw.decode("utf-8"))
            if payload.get("model_loaded") is False:
                return
        except Exception:
            return
        _http_post_json(f"{HIGGS_URL}/unload", {}, timeout=15)
        sys.stderr.write("[reels-controller] auto-unloaded Higgs (comfy request)\n")
    except Exception as e:
        sys.stderr.write(f"[reels-controller] Higgs auto-unload skipped: {e}\n")


def _check_health() -> dict:
    higgs_ok = False
    higgs_loaded = False
    higgs_vram = None
    voicebox_ok = False
    comfy_ok = False
    higgs_err = None
    voicebox_err = None
    comfy_err = None
    try:
        raw = _http_get(f"{HIGGS_URL}/health", timeout=2)
        higgs_ok = True
        try:
            payload = json.loads(raw.decode("utf-8"))
            higgs_loaded = bool(payload.get("model_loaded", True))
            higgs_vram = payload.get("vram_allocated_gb")
        except Exception:
            higgs_loaded = True
    except Exception as e:
        higgs_err = str(e)
    try:
        _http_get(f"{VOICEBOX_URL}/health", timeout=2)
        voicebox_ok = True
    except Exception as e:
        voicebox_err = str(e)
    try:
        _http_get(f"{COMFY_URL}/system_stats", timeout=2)
        comfy_ok = True
    except Exception as e:
        comfy_err = str(e)
    return {
        "higgs": {
            "ok": higgs_ok,
            "loaded": higgs_loaded,
            "vram_gb": higgs_vram,
            "url": HIGGS_URL,
            "error": higgs_err,
        },
        "voicebox": {"ok": voicebox_ok, "url": VOICEBOX_URL, "error": voicebox_err},
        "comfyui": {"ok": comfy_ok, "url": COMFY_URL, "error": comfy_err},
    }


def _comfy_inventory() -> dict:
    """Query ComfyUI /object_info and extract installed checkpoints, loras, samplers, etc."""
    try:
        raw = _http_get(f"{COMFY_URL}/object_info", timeout=10)
        info = json.loads(raw.decode("utf-8"))
    except Exception as e:
        return {"ok": False, "error": str(e)}

    def first_array(node_class: str, field: str) -> list:
        node = info.get(node_class)
        if not node:
            return []
        try:
            field_def = node["input"]["required"].get(field) or node["input"].get("optional", {}).get(field)
            if not field_def:
                return []
            opts = field_def[0]
            if isinstance(opts, list):
                return opts
        except Exception:
            return []
        return []

    checkpoints = first_array("CheckpointLoaderSimple", "ckpt_name")
    unet_models = first_array("UNETLoader", "unet_name")
    loras = first_array("LoraLoader", "lora_name")
    vae = first_array("VAELoader", "vae_name")
    clip = first_array("DualCLIPLoader", "clip_name1") or first_array("CLIPLoader", "clip_name")
    samplers = first_array("KSampler", "sampler_name")
    schedulers = first_array("KSampler", "scheduler")

    def detect_flux(names):
        return [n for n in names if "flux" in n.lower()]

    flux_in_ckpt = detect_flux(checkpoints)
    flux_in_unet = detect_flux(unet_models)
    has_flux = bool(flux_in_ckpt or flux_in_unet)

    return {
        "ok": True,
        "checkpoints": checkpoints,
        "unet_models": unet_models,
        "loras": loras,
        "vae": vae,
        "clip": clip,
        "samplers": samplers,
        "schedulers": schedulers,
        "flux": {
            "detected": has_flux,
            "in_checkpoints": flux_in_ckpt,
            "in_unet_models": flux_in_unet,
        },
    }


def _higgs_profile_info() -> dict:
    """Inspect the Eugene voice profile dir."""
    profile_id = "09b98354-e421-4724-a665-f76c9708e186"
    profile_dir = PROFILES_DIR / profile_id
    if not profile_dir.is_dir():
        return {"ok": False, "error": f"Profile dir not found: {profile_dir}"}
    samples = sorted(f for f in os.listdir(profile_dir) if f.endswith(".wav"))
    return {
        "ok": True,
        "profile_id": profile_id,
        "profile_dir": str(profile_dir),
        "sample_count": len(samples),
        "samples": samples[:10],
    }


def _read_workflow() -> dict:
    if not WORKFLOW_PATH.exists():
        return {"ok": False, "error": "workflow.json missing"}
    raw = WORKFLOW_PATH.read_text(encoding="utf-8")
    try:
        wf = json.loads(raw)
    except Exception as e:
        return {"ok": False, "error": f"Invalid JSON: {e}", "raw": raw}

    used_checkpoint = None
    used_unet = None
    used_sampler = None
    used_scheduler = None
    width = None
    height = None
    has_prompt_placeholder = "PROMPT_PLACEHOLDER" in raw
    has_seed_placeholder = "SEED_PLACEHOLDER" in raw

    for node_id, node in wf.items():
        if not isinstance(node, dict):
            continue
        cls = node.get("class_type")
        inputs = node.get("inputs", {}) or {}
        if cls == "CheckpointLoaderSimple":
            used_checkpoint = inputs.get("ckpt_name")
        elif cls == "UNETLoader":
            used_unet = inputs.get("unet_name")
        elif cls == "KSampler":
            used_sampler = inputs.get("sampler_name")
            used_scheduler = inputs.get("scheduler")
        elif cls in {"EmptyLatentImage", "EmptySD3LatentImage", "EmptyFlux2LatentImage"}:
            width = inputs.get("width")
            height = inputs.get("height")

    return {
        "ok": True,
        "raw": raw,
        "checkpoint": used_checkpoint,
        "unet": used_unet,
        "sampler": used_sampler,
        "scheduler": used_scheduler,
        "width": width,
        "height": height,
        "has_prompt_placeholder": has_prompt_placeholder,
        "has_seed_placeholder": has_seed_placeholder,
    }


def _client_photos() -> dict:
    if not CLIENT_PHOTOS_DIR.is_dir():
        return {"ok": False, "error": f"folder not found: {CLIENT_PHOTOS_DIR}", "photos": []}
    items = []
    for f in sorted(CLIENT_PHOTOS_DIR.iterdir()):
        if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            try:
                items.append({"name": f.name, "size": f.stat().st_size})
            except Exception:
                pass
    return {"ok": True, "folder": str(CLIENT_PHOTOS_DIR), "count": len(items), "photos": items}


def _serve_client_photo(handler, name: str) -> None:
    full = CLIENT_PHOTOS_DIR / name
    if not full.is_file() or not full.resolve().is_relative_to(CLIENT_PHOTOS_DIR.resolve()):
        handler._bad(404, "photo not found")
        return
    data = full.read_bytes()
    ext = full.suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "application/octet-stream")
    handler.send_response(200)
    handler.send_header("Content-Type", mime)
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "public, max-age=3600")
    handler.end_headers()
    handler.wfile.write(data)


def _swap_workflow_checkpoint(ckpt_name: str) -> dict:
    """Swap CheckpointLoaderSimple.ckpt_name in workflow.json for a quick model change."""
    if not WORKFLOW_PATH.exists():
        raise RuntimeError("workflow.json missing")
    wf = json.loads(WORKFLOW_PATH.read_text(encoding="utf-8"))
    swapped = False
    for node_id, node in wf.items():
        if not isinstance(node, dict):
            continue
        if node.get("class_type") == "CheckpointLoaderSimple":
            node.setdefault("inputs", {})["ckpt_name"] = ckpt_name
            swapped = True
    if not swapped:
        raise RuntimeError("No CheckpointLoaderSimple node in workflow.json")
    WORKFLOW_PATH.write_text(json.dumps(wf, indent=2), encoding="utf-8")
    return {"ok": True, "checkpoint": ckpt_name}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(CONTROLLER_DIR), **kw)

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _bad(self, status: int, msg: str) -> None:
        self._json(status, {"ok": False, "error": msg})

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0) or 0)
        return self.rfile.read(length) if length else b""

    def _maybe_serve_reel_asset(self, path: str) -> bool:
        m = re.match(r"^/reels?_assets/([^/]+)/(.+)$", path)
        if not m:
            return False
        reel_id, fname = m.group(1), m.group(2)
        try:
            full = _reel_dir(reel_id) / fname
            if full.is_file():
                self.send_response(200)
                ext = full.suffix.lower()
                mime = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".wav": "audio/wav",
                    ".mp3": "audio/mpeg",
                    ".json": "application/json",
                    ".txt": "text/plain",
                }.get(ext, "application/octet-stream")
                self.send_header("Content-Type", mime)
                data = full.read_bytes()
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return True
        except Exception:
            pass
        return False

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        try:
            if path == "/api/health":
                return self._json(200, _check_health())
            if path == "/api/system":
                return self._json(200, {
                    "health": _check_health(),
                    "comfy_inventory": _comfy_inventory(),
                    "higgs_profile": _higgs_profile_info(),
                    "workflow": _read_workflow(),
                })
            if path == "/api/comfy/inventory":
                return self._json(200, _comfy_inventory())
            if path == "/api/workflow":
                return self._json(200, _read_workflow())
            if path == "/api/client_photos":
                return self._json(200, _client_photos())
            m = re.match(r"^/api/client_photo$", path)
            if m:
                qs = urllib.parse.parse_qs(self.path.split("?", 1)[1] if "?" in self.path else "")
                names = qs.get("name") or []
                if not names:
                    return self._bad(400, "name= required")
                return _serve_client_photo(self, names[0])
            if path == "/api/specs":
                ids = _list_reel_ids()
                return self._json(200, {"reels": [_load_spec(r) for r in ids]})
            if path == "/api/presets":
                return self._json(200, _load_presets())
            m = re.match(r"^/api/spec/([^/]+)$", path)
            if m:
                return self._json(200, _load_spec(m.group(1)))
            m = re.match(r"^/api/voice/([^/]+)/(\d+)$", path)
            if m:
                reel_id, shot_id = m.group(1), int(m.group(2))
                spec = _load_spec(reel_id)
                shot = next((s for s in spec["shots"] if s["id"] == shot_id), None)
                if not shot:
                    return self._bad(404, "shot not found")
                wav_path = _reel_dir(reel_id) / shot["voice_filename"]
                if not wav_path.exists():
                    return self._bad(404, "shot voice not generated yet")
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                data = wav_path.read_bytes()
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return
            m = re.match(r"^/api/voice/([^/]+)$", path)
            if m:
                spec = _load_spec(m.group(1))
                wav_path = _reel_dir(m.group(1)) / spec["voice"]["wav_filename"]
                if not wav_path.exists():
                    return self._bad(404, "voice.wav not composed yet")
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                data = wav_path.read_bytes()
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return
            m = re.match(r"^/api/image/([^/]+)/(\d+)$", path)
            if m:
                reel_id, shot_id = m.group(1), int(m.group(2))
                spec = _load_spec(reel_id)
                shot = next((s for s in spec["shots"] if s["id"] == shot_id), None)
                if not shot:
                    return self._bad(404, "shot not found")
                img_path = _reel_dir(reel_id) / shot["image_filename"]
                if not img_path.exists():
                    return self._bad(404, "image not generated yet")
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                data = img_path.read_bytes()
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return
            m = re.match(r"^/api/render/([^/]+)$", path)
            if m:
                render_path = _reel_dir(m.group(1)) / "render.mp4"
                if not render_path.exists():
                    return self._bad(404, "render.mp4 not built yet")
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                data = render_path.read_bytes()
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return
            m = re.match(r"^/api/overlay/([^/]+)/([A-Za-z0-9]+)/file$", path)
            if m:
                return _serve_overlay_file(self, m.group(1), m.group(2))
            m = re.match(r"^/api/motion/([^/]+)/(\d+)$", path)
            if m:
                reel_id, shot_id = m.group(1), int(m.group(2))
                spec = _load_spec(reel_id)
                shot = next((s for s in spec["shots"] if s["id"] == shot_id), None)
                if not shot:
                    return self._bad(404, "shot not found")
                mp4_path = _reel_dir(reel_id) / shot["motion_filename"]
                if not mp4_path.exists():
                    return self._bad(404, "motion mp4 not generated yet")
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                data = mp4_path.read_bytes()
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return
            if self._maybe_serve_reel_asset(path):
                return
            return super().do_GET()
        except Exception as e:
            return self._bad(500, str(e))

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        try:
            # Auto-manage Higgs VRAM so user never has to think about it.
            # Audio routes need Higgs loaded; ComfyUI routes need it unloaded.
            # Idempotent on both ends — safe to call repeatedly in batch.
            if re.match(r"^/api/voice/", path) or re.match(r"^/api/build/", path):
                _ensure_higgs_loaded()
            elif re.match(r"^/api/(image|animate)/", path):
                _ensure_higgs_unloaded()

            m = re.match(r"^/api/spec/([^/]+)$", path)
            if m:
                body = self._read_body()
                data = json.loads(body.decode("utf-8") or "{}")
                _save_spec(m.group(1), data)
                return self._json(200, {"ok": True})
            m = re.match(r"^/api/voice/([^/]+)/(\d+)$", path)
            if m:
                return self._json(200, _generate_shot_voice(m.group(1), int(m.group(2))))
            m = re.match(r"^/api/voice/([^/]+)/compose$", path)
            if m:
                return self._json(200, _compose_reel_voice(m.group(1)))
            m = re.match(r"^/api/image/([^/]+)/(\d+)$", path)
            if m:
                return self._json(200, _generate_image(m.group(1), int(m.group(2))))
            m = re.match(r"^/api/image/([^/]+)/(\d+)/reroll$", path)
            if m:
                # clear the saved seed → next gen uses a new random one
                reel_id, shot_id = m.group(1), int(m.group(2))
                spec = _load_spec(reel_id)
                for s in spec["shots"]:
                    if s["id"] == shot_id:
                        s["image_seed"] = None
                _save_spec(reel_id, spec)
                return self._json(200, _generate_image(reel_id, shot_id))
            m = re.match(r"^/api/animate/([^/]+)/(\d+)$", path)
            if m:
                return self._json(200, _animate_shot(m.group(1), int(m.group(2))))
            if path == "/api/reel/new":
                body = self._read_body()
                data = json.loads(body.decode("utf-8") or "{}")
                return self._json(200, _create_reel(
                    reel_id=data.get("reel_id", ""),
                    title=data.get("title", ""),
                    target_sec=data.get("duration_target_sec", 30),
                ))
            m = re.match(r"^/api/reel/([^/]+)/delete$", path)
            if m:
                return self._json(200, _delete_reel(m.group(1)))
            m = re.match(r"^/api/shot/([^/]+)/add$", path)
            if m:
                return self._json(200, _add_shot(m.group(1)))
            m = re.match(r"^/api/shot/([^/]+)/(\d+)/duplicate$", path)
            if m:
                return self._json(200, _duplicate_shot(m.group(1), int(m.group(2))))
            m = re.match(r"^/api/shot/([^/]+)/(\d+)/delete$", path)
            if m:
                return self._json(200, _delete_shot(m.group(1), int(m.group(2))))
            if path == "/api/presets/save":
                body = self._read_body()
                data = json.loads(body.decode("utf-8") or "{}")
                return self._json(200, _save_preset(
                    name=data.get("name", ""),
                    motion_prompt=data.get("motion_prompt", ""),
                    motion_length_sec=data.get("motion_length_sec"),
                    description=data.get("description", ""),
                ))
            if path == "/api/presets/delete":
                body = self._read_body()
                data = json.loads(body.decode("utf-8") or "{}")
                return self._json(200, _delete_preset(data.get("name", "")))
            m = re.match(r"^/api/render/([^/]+)$", path)
            if m:
                reel_id = m.group(1)
                import compose_video as cv
                out = cv.compose(reel_id)
                return self._json(200, {"ok": True, "render_path": str(out), "size_mb": round(out.stat().st_size / 1024 / 1024, 2)})
            m = re.match(r"^/api/overlay/([^/]+)/upload$", path)
            if m:
                body = self._read_body()
                data = json.loads(body.decode("utf-8") or "{}")
                return self._json(200, _add_overlay(
                    reel_id=m.group(1),
                    filename=data.get("filename", ""),
                    data_b64=data.get("data_b64", ""),
                    label=data.get("label", ""),
                ))
            m = re.match(r"^/api/overlay/([^/]+)/([A-Za-z0-9]+)/update$", path)
            if m:
                body = self._read_body()
                data = json.loads(body.decode("utf-8") or "{}")
                return self._json(200, _update_overlay(m.group(1), m.group(2), data))
            m = re.match(r"^/api/overlay/([^/]+)/([A-Za-z0-9]+)/delete$", path)
            if m:
                return self._json(200, _delete_overlay(m.group(1), m.group(2)))
            m = re.match(r"^/api/build/([^/]+)$", path)
            if m:
                reel_id = m.group(1)
                # 1) compose voice from shots
                voice = _compose_reel_voice(reel_id)
                # 2) render video (Ken Burns + ASS captions + voice)
                import compose_video as cv
                render_path = cv.compose(reel_id)
                size_mb = round(render_path.stat().st_size / 1024 / 1024, 2)
                return self._json(200, {
                    "ok": True,
                    "voice_duration_sec": voice["duration_sec"],
                    "render_path": str(render_path),
                    "size_mb": size_mb,
                })
            if path == "/api/workflow/checkpoint":
                body = self._read_body()
                data = json.loads(body.decode("utf-8") or "{}")
                ckpt = (data.get("ckpt_name") or "").strip()
                if not ckpt:
                    return self._bad(400, "ckpt_name required")
                return self._json(200, _swap_workflow_checkpoint(ckpt))
            if path == "/api/higgs/unload":
                try:
                    result = _http_post_json(f"{HIGGS_URL}/unload", {}, timeout=15)
                    return self._json(200, {"ok": True, **result})
                except Exception as e:
                    return self._bad(502, f"Higgs unload failed: {e}")
            if path == "/api/higgs/reload":
                try:
                    result = _http_post_json(f"{HIGGS_URL}/reload", {}, timeout=120)
                    return self._json(200, {"ok": True, **result})
                except Exception as e:
                    return self._bad(502, f"Higgs reload failed: {e}")
            return self._bad(404, "unknown POST route")
        except Exception as e:
            return self._bad(500, str(e))

    def log_message(self, format, *args):
        sys.stderr.write("[reels-controller] " + (format % args) + "\n")


def main():
    print(f"Reels controller serving on http://127.0.0.1:{PORT}/")
    print(f"  controller dir : {CONTROLLER_DIR}")
    print(f"  reels dir      : {REELS_DIR}")
    print(f"  Higgs target   : {HIGGS_URL}")
    print(f"  ComfyUI target : {COMFY_URL}")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    # Prevent zombie binds — if another instance is running, this one will fail loudly
    # instead of silently sharing the port (Windows behavior with SO_REUSEADDR=True).
    server.allow_reuse_address = False
    server.serve_forever()


if __name__ == "__main__":
    main()
