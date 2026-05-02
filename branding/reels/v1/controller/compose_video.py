"""Compose final reel video from spec.json: per-shot Ken Burns + ASS captions (Bahnschrift + karaoke) + voice.wav.
Output: render.mp4 (1080x1920 9:16 H.264 30fps).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

FFMPEG = shutil.which("ffmpeg") or r"C:\Users\Usuario\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
FFPROBE = shutil.which("ffprobe") or FFMPEG.rsplit("\\", 1)[0] + "\\ffprobe.exe"
REELS_DIR = Path(__file__).parent.parent.resolve()

OUT_W, OUT_H, FPS = 1080, 1920, 30

# Cinematic head pad: voice and captions are delayed this many seconds relative to
# video, so the first frame is visible briefly with no sound/text before the audio
# kicks in. Applied to the audio mux (-itsoffset) AND to all Caption timestamps in
# build_ass — keeping captions aligned with what's actually being said.
# Hooks (top editorial titles) align with shot.start_sec/end_sec which already
# reference video segments, so they don't get this offset.
AUDIO_HEAD_OFFSET = 0.5

# Brand colours for ASS subtitles (BGR hex with leading 00 alpha):
WHITE = "&H00FFFFFF"
GOLD = "&H0066A8D4"   # Frequency Vibes / BookVoice gold #D4A866 → BGR 66 A8 D4
BLACK = "&H00000000"
SHADOW = "&H80000000"


def _overlay_xy(position: str, x_pct: float, y_pct: float, edge_margin: int = 60) -> "tuple[str, str]":
    """ffmpeg overlay x= / y= expressions for the supported position keywords.
    Mirror of server._overlay_position_xy — kept inline to avoid the circular
    import compose_video <-> server."""
    pos = (position or "top-right").strip()
    if pos == "custom":
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


def _build_overlay_chain(spec: dict, base_label: str, first_input_idx: int) -> "tuple[list[str], list[str], str]":
    """Build the ffmpeg filter_complex chunks + extra `-i` args for overlays.

    Returns (extra_input_args, filter_parts, last_video_label).
    last_video_label is what the next filter (ASS captions, fade-out) should chain off.
    """
    overlays = spec.get("overlays", []) or []
    rdir = REELS_DIR / spec.get("reel_id", "")
    odir = rdir / "overlays"
    extra_inputs: list[str] = []
    filter_parts: list[str] = []
    current = base_label
    in_idx = first_input_idx
    for i, ov in enumerate(overlays):
        fname = ov.get("filename")
        if not fname:
            continue
        opath = odir / fname
        if not opath.is_file():
            print(f"  overlay {ov.get('id', '?')} skipped — file missing: {opath}")
            continue
        scale_w = max(20, int(OUT_W * (float(ov.get("scale_pct", 30)) / 100.0)))
        fade_in = max(0.0, float(ov.get("fade_in_sec", 0.4)))
        fade_out = max(0.0, float(ov.get("fade_out_sec", 0.4)))
        start = max(0.0, float(ov.get("start_sec", 0.0)))
        end = max(start + 0.1, float(ov.get("end_sec", start + 5.0)))
        opacity = max(0.0, min(1.0, float(ov.get("opacity", 1.0))))
        x_expr, y_expr = _overlay_xy(
            ov.get("position", "top-right"),
            float(ov.get("x_pct", 50)),
            float(ov.get("y_pct", 50)),
        )
        # Each overlay is loop=1 (still image) at the project framerate
        extra_inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{end + fade_out:.2f}", "-i", str(opath)]
        scale_chain = f"[{in_idx}:v]scale={scale_w}:-1,format=yuva420p"
        if opacity < 0.999:
            scale_chain += f",colorchannelmixer=aa={opacity:.3f}"
        if fade_in > 0:
            scale_chain += f",fade=alpha=1:t=in:st={start:.2f}:d={fade_in:.2f}"
        if fade_out > 0:
            fade_out_st = max(start + fade_in, end - fade_out)
            scale_chain += f",fade=alpha=1:t=out:st={fade_out_st:.2f}:d={fade_out:.2f}"
        ov_label = f"ov{i}"
        filter_parts.append(f"{scale_chain}[{ov_label}]")
        next_label = f"vov{i}"
        filter_parts.append(
            f"[{current}][{ov_label}]overlay=x='{x_expr}':y='{y_expr}':enable='between(t,{start:.2f},{end + fade_out:.2f})'[{next_label}]"
        )
        current = next_label
        in_idx += 1
    return extra_inputs, filter_parts, current


def _normalize_inline_punctuation(text: str) -> str:
    """Insert a space after `,;:` when glued to the next word.

    Higgs handles "information,everything" fine for prosody, but the caption
    tokenizer splits by whitespace only — so without this the merged token
    "information,everything" is treated as ONE word, breaks the spec/whisper
    alignment count, and the chunker emits it as a single 22-char super-token
    that displays the comma. After this normalisation tokens are clean and the
    existing rstrip-trailing-punct path removes the comma before display.
    """
    import re as _re_local
    return _re_local.sub(r"([,;:])(?=\S)", r"\1 ", text or "")


def fmt_ass_time(t: float) -> str:
    if t < 0: t = 0
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t - 3600 * h - 60 * m
    return f"{h:d}:{m:02d}:{s:05.2f}"


def ass_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", "\\N")


def _is_silence_line(text: str) -> bool:
    t = (text or "").strip().lower()
    return not t or t.startswith("(silence") or t == "—" or t == "(silence)"


def align_words_to_spec(words: list[dict], spec: dict) -> list[dict]:
    """Replace Whisper-transcribed text with the canonical spec voice_line text,
    preserving Whisper's word-level timing. Applied to ALL non-silent shots so
    transcription errors (e.g. 'pulse' heard as 'balls') never leak into subs.
    Robust to count mismatches via proportional time allocation.
    """
    import re as _re
    aligned: list[dict] = []
    for shot in spec.get("shots", []):
        text = (shot.get("voice_line") or "").strip()
        if _is_silence_line(text):
            continue
        s_start = float(shot["start_sec"])
        s_end = float(shot["end_sec"])
        # Whisper words within this shot's window (small slack on both sides)
        shot_whisper = [w for w in words if (s_start - 0.1) <= float(w["start"]) <= (s_end + 0.1)]
        # Tokenize spec text into words, drop trailing punctuation per word.
        # Pre-normalise inline punctuation so "info,word" splits like "info, word".
        text_norm = _normalize_inline_punctuation(text)
        spec_tokens = [t.rstrip(",.;:!?\"'") for t in _re.findall(r"\S+", text_norm)]
        spec_tokens = [t for t in spec_tokens if t]
        if not spec_tokens:
            continue
        if len(spec_tokens) == len(shot_whisper) and shot_whisper:
            # Perfect 1:1 match — substitute text, keep timing
            for i, tok in enumerate(spec_tokens):
                aligned.append({
                    "start": float(shot_whisper[i]["start"]),
                    "end": float(shot_whisper[i]["end"]),
                    "word": tok,
                })
        elif shot_whisper:
            # Mismatch — proportionally distribute spec tokens across whisper span
            t0 = float(shot_whisper[0]["start"])
            t1 = float(shot_whisper[-1]["end"])
            span = max(0.05, t1 - t0)
            n = len(spec_tokens)
            for i, tok in enumerate(spec_tokens):
                w_start = t0 + span * (i / n)
                w_end = t0 + span * ((i + 1) / n)
                aligned.append({"start": w_start, "end": w_end, "word": tok})
        else:
            # No whisper words at all in this shot's window — fallback to even spread
            n = len(spec_tokens)
            span = max(0.05, s_end - s_start)
            for i, tok in enumerate(spec_tokens):
                w_start = s_start + span * (i / n)
                w_end = s_start + span * ((i + 1) / n)
                aligned.append({"start": w_start, "end": w_end, "word": tok})
    return aligned


def _max_words_for_wpm(wpm: float) -> int:
    """Adaptive chunk word-cap: dense speech → smaller readable groups."""
    if wpm >= 220: return 3
    if wpm <= 140: return 5
    return 4


def chunk_words(words: list[dict], max_chars: int = 28) -> list[list[dict]]:
    """Group whisper words into chunks. Break rules (in priority order):
      1. After hard punctuation (.!?) — always break
      2. After soft punctuation (,;:) when chunk already has >=2 words
      3. When max_words (adaptive by shot wpm) reached
      4. When char-count would exceed max_chars
    Trailing 1-word chunk gets merged back into previous chunk to avoid orphans.
    """
    chunks: list[list[dict]] = []
    cur: list[dict] = []
    cur_chars = 0
    for w in words:
        word = (w.get("word") or "").strip()
        if not word:
            continue
        br = int(w.get("break_after", 0))
        wpm = float(w.get("shot_wpm", 180.0))
        max_words = _max_words_for_wpm(wpm)
        prospective = cur_chars + (1 if cur else 0) + len(word)
        # Soft-cap check: would adding this word violate length limits?
        overflow = cur and (len(cur) >= max_words or prospective > max_chars)
        if overflow:
            chunks.append(cur)
            cur = [w]
            cur_chars = len(word)
        else:
            cur.append(w)
            cur_chars = prospective
        # Force-break after this word if punctuation says so. Soft break only
        # if the chunk already has at least 2 words (avoids 1-word "Atoms,").
        if br == 2 or (br == 1 and len(cur) >= 2):
            chunks.append(cur)
            cur = []
            cur_chars = 0
    if cur:
        chunks.append(cur)
    # Post-pass: merge orphan 1-word chunks backward into previous when shot
    # context matches (same wpm = same shot) and merged result respects char
    # budget +6 slack. Stops the 'OSCILLATES' / 'FREQUENCY' isolated-word effect.
    def _chunk_chars(c: list[dict]) -> int:
        return sum(len((w.get("word") or "").strip()) for w in c) + max(0, len(c) - 1)
    i = 1
    while i < len(chunks):
        if len(chunks[i]) == 1:
            prev = chunks[i - 1]
            same_shot = abs(float(prev[0].get("shot_wpm", 180.0)) - float(chunks[i][0].get("shot_wpm", 180.0))) < 0.5
            merged_words = len(prev) + 1
            merged_chars = _chunk_chars(prev) + 1 + len((chunks[i][0].get("word") or "").strip())
            wpm = float(prev[0].get("shot_wpm", 180.0))
            if same_shot and merged_words <= _max_words_for_wpm(wpm) + 1 and merged_chars <= max_chars + 6:
                prev.extend(chunks[i])
                chunks.pop(i)
                continue
        i += 1
    return chunks


def build_ass(spec: dict, words: list[dict]) -> str:
    """Two-layer subtitle: Hook (top, gold, per-shot.caption) + Caption (bottom, white, karaoke from whisper).

    Per-reel `spec.subtitles` controls which layers emit:
      - "both"    (default): Hook + Caption
      - "hook"   : top Hook only (no transcript)
      - "caption": bottom Caption only (no editorial title)
      - "none"   : no subs at all (pure motion + voice)
    """
    mode = (spec.get("subtitles") or "both").strip().lower()
    if mode not in ("both", "hook", "caption", "none"):
        mode = "both"
    emit_hook = mode in ("both", "hook")
    emit_caption = mode in ("both", "caption")

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {OUT_W}
PlayResY: {OUT_H}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Bahnschrift Condensed,64,{WHITE},{WHITE},{BLACK},{SHADOW},1,0,0,0,100,100,0,0,1,4,2,2,140,140,380,1
Style: Hook,Bahnschrift,48,{GOLD},{GOLD},{BLACK},{SHADOW},1,0,0,0,100,100,0,0,1,3,1,8,140,140,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []

    # Layer 0: per-shot HOOK (top, gold) — uses spec.shots[].caption
    if emit_hook:
        for shot in spec["shots"]:
            cap = (shot.get("caption") or "").strip()
            if not cap:
                continue
            # Hook: fade(300,300) + soft slide-down entry from y-30 → final position
            anim = "{\\fad(300,300)\\fscx96\\fscy96\\t(0,400,\\fscx100\\fscy100)}"
            text = anim + ass_escape(cap)
            s = float(shot["start_sec"])
            e = float(shot["end_sec"])
            events.append(f"Dialogue: 0,{fmt_ass_time(s)},{fmt_ass_time(e)},Hook,,0,0,0,,{text}")

    # Layer 1: karaoke chunks (bottom, white). Adaptive timing per shot:
    #   - 150ms lead-in before first word
    #   - last chunk extends 0.7s past last word
    #   - MIN_DISPLAY scales with shot wpm: dense (>=220wpm)=0.85s, sparse(<=140)=1.5s
    #   - tail extension respects natural gap to next chunk: max 60% of gap or
    #     0.5s, whichever is smaller (prevents stacking 3 chunks in 1s on dense
    #     shots while keeping smooth cross-fade on relaxed pacing)
    chunks = chunk_words(words) if emit_caption else []
    for i, ch in enumerate(chunks):
        raw_start = ch[0]["start"] + AUDIO_HEAD_OFFSET
        raw_end = ch[-1]["end"] + AUDIO_HEAD_OFFSET
        wpm = float(ch[0].get("shot_wpm", 180.0))
        if wpm >= 220: min_display = 0.85
        elif wpm <= 140: min_display = 1.5
        else: min_display = 1.2

        c_start = max(0.0, raw_start - 0.15)

        if i + 1 == len(chunks):
            tail = 0.7
        else:
            next_start = chunks[i + 1][0]["start"] + AUDIO_HEAD_OFFSET
            gap = max(0.0, next_start - raw_end)
            # Take at most 60% of gap (so cross-fade is short on tight pacing)
            # but never extend more than 0.5s into the gap
            tail = min(0.5, gap * 0.6) if gap > 0.05 else 0.15
        c_end = raw_end + tail
        # Ensure minimum readable duration. May still overlap next chunk; the
        # 250ms cross-fade handles transition cleanly.
        if c_end - c_start < min_display:
            c_end = c_start + min_display
        if c_end <= c_start:
            continue
        # Strip residual inline punctuation from displayed text — caption text
        # should never show commas/colons even if a token slipped through.
        text = " ".join(w["word"].strip().rstrip(",;:.!?\"'").replace(",", "").replace(";", "").replace(":", "") for w in ch).upper()
        # Adaptive font size — Bahnschrift Condensed 64pt fits ~22 chars within
        # the 800px usable width (1080 minus 140px L/R margins). Longer clauses
        # downsize a tier so they never touch the frame edges.
        n_chars = len(text)
        if n_chars > 32:
            fs_override = "\\fs48"
        elif n_chars > 27:
            fs_override = "\\fs54"
        elif n_chars > 22:
            fs_override = "\\fs60"
        else:
            fs_override = ""
        # Animation: fade(250in,250out) + scale 94→100% over 280ms (subtle "bloom")
        anim = "{\\fad(250,250)" + fs_override + "\\fscx94\\fscy94\\t(0,280,\\fscx100\\fscy100)}"
        text = anim + ass_escape(text)
        events.append(f"Dialogue: 1,{fmt_ass_time(c_start)},{fmt_ass_time(c_end)},Caption,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


def render_shot_segment_from_motion(motion_path: Path, duration_sec: float, output: Path) -> None:
    """Wan motion clip → 1080x1920 segment of exact duration_sec.
    Wan 2.1 480p output is 480x832. We upscale to 1080x1920 with lanczos.
    If the segment needs more than the clip provides, we crossfade-loop the clip
    onto itself (0.6s overlap) instead of hard-cut looping.
    """
    if duration_sec <= 0.05:
        duration_sec = 0.05

    # Probe motion clip duration
    motion_dur = None
    try:
        r = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(motion_path)], capture_output=True, text=True, timeout=10)
        motion_dur = float(r.stdout.strip())
    except Exception:
        motion_dur = 3.4

    scale = f"scale={OUT_W}:{OUT_H}:flags=lanczos,format=yuv420p,fps={FPS}"

    if motion_dur >= duration_sec - 0.05:
        # Single pass — trim from start
        cmd = [
            FFMPEG, "-y",
            "-i", str(motion_path),
            "-t", f"{duration_sec:.3f}",
            "-vf", scale,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-r", str(FPS), "-an",
            str(output),
        ]
    else:
        # Crossfade-loop. Each subsequent copy contributes (motion_dur - LOOP_XFADE) net seconds.
        import math
        LOOP_XFADE = 0.6
        n_copies = max(2, math.ceil((duration_sec - motion_dur) / (motion_dur - LOOP_XFADE)) + 1)

        cmd = [FFMPEG, "-y"]
        for _ in range(n_copies):
            cmd += ["-i", str(motion_path)]

        filter_parts = []
        # Scale every input first
        for i in range(n_copies):
            filter_parts.append(f"[{i}:v]{scale}[s{i}]")
        prev = "s0"
        cumulative = motion_dur
        for i in range(1, n_copies):
            offset = cumulative - LOOP_XFADE
            out = f"x{i}"
            filter_parts.append(
                f"[{prev}][s{i}]xfade=transition=fade:duration={LOOP_XFADE}:offset={offset:.3f}[{out}]"
            )
            prev = out
            cumulative += motion_dur - LOOP_XFADE

        cmd += [
            "-filter_complex", ";".join(filter_parts),
            "-map", f"[{prev}]",
            "-t", f"{duration_sec:.3f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-r", str(FPS), "-an",
            str(output),
        ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"ffmpeg motion-segment failed:\n{res.stderr[-2000:]}")


def render_shot_segment(image_path: Path, duration_sec: float, output: Path, shot_index: int) -> None:
    if duration_sec <= 0.05:
        duration_sec = 0.05
    n_frames = max(2, int(duration_sec * FPS))

    if shot_index % 2 == 0:
        z_start, z_end = 1.0, 1.08
    else:
        z_start, z_end = 1.08, 1.0
    z_step = (z_end - z_start) / max(1, n_frames - 1)
    if z_step >= 0:
        zoom_expr = f"min(zoom+{z_step:.6f}\\,{z_end})"
    else:
        zoom_expr = f"max(zoom{z_step:.6f}\\,{z_end})"

    vf = (
        f"scale=1296:2304:force_original_aspect_ratio=increase,"
        f"crop=1296:2304,"
        f"zoompan=z='{zoom_expr}':d={n_frames}:s={OUT_W}x{OUT_H}:fps={FPS},"
        f"format=yuv420p"
    )

    cmd = [
        FFMPEG, "-y",
        "-loop", "1",
        "-t", f"{duration_sec:.3f}",
        "-i", str(image_path),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-r", str(FPS),
        "-an",
        "-frames:v", str(n_frames),
        str(output),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"ffmpeg shot render failed:\n{res.stderr[-2000:]}")


def transcribe_voice(voice_path: Path) -> list[dict]:
    """Use whisper to get word-level timestamps for the composed voice.wav."""
    sys.path.insert(0, str(Path(__file__).parent))
    try:
        from server import _whisper_transcribe_words
        return _whisper_transcribe_words(voice_path)
    except Exception as e:
        print(f"  whisper transcription failed: {e}")
        return []


def compose(reel_id: str) -> Path:
    rdir = REELS_DIR / reel_id
    spec = json.loads((rdir / "spec.json").read_text(encoding="utf-8"))
    voice_path = rdir / spec["voice"]["wav_filename"]
    if not voice_path.is_file():
        raise RuntimeError(f"voice.wav missing: {voice_path}")

    work_dir = rdir / ".compose_work"
    work_dir.mkdir(exist_ok=True)

    print(f"Composing {reel_id}: {len(spec['shots'])} shots")

    # Pre-compute audio duration so we can extend the LAST shot enough that
    # the final video is at least as long as voice.wav + buffer. Otherwise the
    # ffmpeg `-shortest` flag clips the audio's last word when xfades shrink the
    # video timeline below voice.wav length.
    import soundfile as _sf_pre
    _audio_dur = _sf_pre.info(str(voice_path)).frames / _sf_pre.info(str(voice_path)).samplerate
    XFADE_DUR = 0.4
    AUDIO_TAIL_BUFFER = 1.0   # seconds of extra video past audio end (cinematic black/fade)
    n_shots = len(spec["shots"])
    base_durs = [float(s["end_sec"]) - float(s["start_sec"]) for s in spec["shots"]]
    sum_after_xfade = sum(base_durs) - max(0, n_shots - 1) * XFADE_DUR
    extra = (_audio_dur + AUDIO_TAIL_BUFFER) - sum_after_xfade
    if extra > 0 and n_shots > 0:
        base_durs[-1] += extra
        print(f"  extending last shot by {extra:.2f}s so video > audio (last word survives)")

    # 1) Render shot segments. Prefer motion mp4 (Wan 2.1) if exists, else Ken Burns on still.
    segments = []
    for i, shot in enumerate(spec["shots"]):
        img = rdir / shot["image_filename"]
        if not img.is_file():
            raise RuntimeError(f"missing image: {img}")
        dur = base_durs[i]
        seg_path = work_dir / f"seg_{i:02d}.mp4"
        cap_safe = (shot.get('caption') or '').encode('ascii', 'replace').decode('ascii')
        motion_path = rdir / shot.get("motion_filename", f"shot_{shot['id']}_motion.mp4")
        if motion_path.is_file():
            print(f"  shot {shot['id']}: {dur:.2f}s '{cap_safe}' -> {seg_path.name}  [motion: {motion_path.name}]")
            render_shot_segment_from_motion(motion_path=motion_path, duration_sec=dur, output=seg_path)
        else:
            print(f"  shot {shot['id']}: {dur:.2f}s '{cap_safe}' -> {seg_path.name}  [Ken Burns]")
            render_shot_segment(image_path=img, duration_sec=dur, output=seg_path, shot_index=i)
        segments.append(seg_path)

    # 2) Concat with 0.4s xfade dissolves between shots (memory: 0.4s dissolves at scene changes)
    silent_concat = work_dir / "concat_silent.mp4"
    XFADE_DUR = 0.4

    # Read each segment's actual duration via ffprobe (motion clip durations after looping)
    seg_durations = []
    for s in segments:
        r = subprocess.run([
            FFPROBE,
            "-v", "error", "-show_entries", "format=duration",
            "-of", "default=nokey=1:noprint_wrappers=1", str(s),
        ], capture_output=True, text=True)
        seg_durations.append(float(r.stdout.strip()))

    if len(segments) == 1:
        # No transitions needed
        res = subprocess.run([
            FFMPEG, "-y", "-i", str(segments[0]),
            "-c:v", "copy", "-an", str(silent_concat),
        ], capture_output=True, text=True)
    else:
        # Build xfade filter chain.
        # Each xfade overlaps the previous tail by XFADE_DUR.
        # offset_n = sum(durations[0..n]) - n * XFADE_DUR
        filter_parts = []
        prev_label = "0:v"
        cumulative = seg_durations[0]
        for i in range(1, len(segments)):
            offset = cumulative - XFADE_DUR
            out_label = f"v{i}"
            filter_parts.append(
                f"[{prev_label}][{i}:v]xfade=transition=fade:duration={XFADE_DUR}:offset={offset:.3f}[{out_label}]"
            )
            prev_label = out_label
            cumulative += seg_durations[i] - XFADE_DUR

        cmd_xfade = [FFMPEG, "-y"]
        for s in segments:
            cmd_xfade += ["-i", str(s)]
        cmd_xfade += [
            "-filter_complex", ";".join(filter_parts),
            "-map", f"[{prev_label}]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-an", str(silent_concat),
        ]
        print(f"Concatenating {len(segments)} shots with {XFADE_DUR}s dissolves...")
        res = subprocess.run(cmd_xfade, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"concat failed:\n{res.stderr[-2000:]}")

    # 3) Per-shot Whisper transcription. Transcribing voice.wav directly causes drift
    #    and cross-shot word leakage. Instead transcribe each shot's individual voice
    #    file and offset by its global start_sec. Text always taken from spec voice_line.
    print("Transcribing per-shot voice files with Whisper...")
    import re as _re
    try:
        from server import _whisper_transcribe_words as _wtw
    except Exception:
        _wtw = None
    words: list[dict] = []
    # Punctuation that should force a chunk break AFTER the word — sentence-ending
    # marks always break, commas/semicolons break softly (allow longer clauses).
    HARD_BREAK = set(".!?")
    SOFT_BREAK = set(",;:")
    def _split_token(raw: str) -> tuple[str, int]:
        """Return (clean_word, break_strength). 2=hard, 1=soft, 0=none."""
        bare = raw.rstrip(",.;:!?\"')]")
        trailing = raw[len(bare):]
        if any(c in HARD_BREAK for c in trailing):
            return bare, 2
        if any(c in SOFT_BREAK for c in trailing):
            return bare, 1
        return bare, 0

    for shot in spec.get("shots", []):
        text = (shot.get("voice_line") or "").strip()
        if _is_silence_line(text):
            continue
        vfile = rdir / shot.get("voice_filename", f"shot_{shot['id']}_voice.wav")
        if not vfile.is_file():
            print(f"  shot {shot['id']}: no voice file, skipping subs")
            continue
        offset = float(shot["start_sec"])
        # Normalise "info,word" → "info, word" so chunker sees a real break.
        text_norm = _normalize_inline_punctuation(text)
        raw_tokens = [t for t in _re.findall(r"\S+", text_norm) if t]
        spec_pairs = [_split_token(t) for t in raw_tokens]
        spec_pairs = [(w, b) for w, b in spec_pairs if w]
        if not spec_pairs:
            continue
        per_shot = _wtw(vfile) if _wtw else []
        # Compute shot-local speech rate (wpm) from whisper word boundaries when
        # available, else from voice file duration. Using shot_dur (includes
        # head/tail silence + pause_after_sec) underestimates wpm by 2-3x and
        # incorrectly classifies dense speech as sparse.
        if per_shot and len(per_shot) >= 2:
            speech_dur = max(0.5, float(per_shot[-1]["end"]) - float(per_shot[0]["start"]))
        else:
            try:
                import soundfile as _sf
                speech_dur = max(0.5, _sf.info(str(vfile)).frames / _sf.info(str(vfile)).samplerate)
            except Exception:
                speech_dur = max(0.5, float(shot["end_sec"]) - float(shot["start_sec"]))
        shot_wpm = (len(spec_pairs) / speech_dur) * 60.0
        n = len(spec_pairs)
        if len(spec_pairs) == len(per_shot) and per_shot:
            for i, (tok, br) in enumerate(spec_pairs):
                words.append({
                    "start": float(per_shot[i]["start"]) + offset,
                    "end": float(per_shot[i]["end"]) + offset,
                    "word": tok,
                    "break_after": br,
                    "shot_wpm": shot_wpm,
                })
        elif per_shot:
            t0 = float(per_shot[0]["start"])
            t1 = float(per_shot[-1]["end"])
            span = max(0.05, t1 - t0)
            for i, (tok, br) in enumerate(spec_pairs):
                words.append({
                    "start": offset + t0 + span * (i / n),
                    "end": offset + t0 + span * ((i + 1) / n),
                    "word": tok,
                    "break_after": br,
                    "shot_wpm": shot_wpm,
                })
        else:
            # No transcription — even spread over voice file's actual duration
            import soundfile as _sf
            voice_dur = _sf.info(str(vfile)).frames / _sf.info(str(vfile)).samplerate
            for i, (tok, br) in enumerate(spec_pairs):
                words.append({
                    "start": offset + voice_dur * (i / n),
                    "end": offset + voice_dur * ((i + 1) / n),
                    "word": tok,
                    "break_after": br,
                    "shot_wpm": shot_wpm,
                })
        print(f"  shot {shot['id']}: {n} tokens, whisper={len(per_shot)}, wpm={shot_wpm:.0f}, offset={offset:.2f}s")

    # 4) Build ASS subtitles (Hook + Caption layers)
    ass_path = work_dir / "captions.ass"
    ass_path.write_text(build_ass(spec, words), encoding="utf-8")

    # 5) Final mux: video + audio + ASS overlay + soft fade-out (last 0.7s)
    out_path = rdir / "render.mp4"
    ass_for_filter = str(ass_path).replace("\\", "/").replace(":", "\\:")
    fonts_dir = "C\\:/Windows/Fonts"

    # compute total duration from voice.wav for fade-out timing
    import soundfile as _sf
    total_dur = _sf.info(str(voice_path)).frames / _sf.info(str(voice_path)).samplerate
    fade_dur = 0.7
    fade_start = max(0.0, total_dur - fade_dur)

    # AUDIO_HEAD_OFFSET (module constant) delays audio + caption timestamps so the
    # viewer gets a beat of motion before voice/text hit. AUDIO_TAIL_BUFFER absorbs
    # the offset at the tail so we don't clip the closing words.
    overlay_inputs, overlay_filters, base_video_label = _build_overlay_chain(
        spec, base_label="0:v", first_input_idx=2
    )
    af_chain = f"loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.3,afade=t=out:st={fade_start:.2f}:d={fade_dur}"

    if overlay_filters:
        # Multi-input pipeline: filter_complex chain through every overlay,
        # then ASS + final fade-out at the end.
        ass_chain = (
            f"[{base_video_label}]ass='{ass_for_filter}':fontsdir='{fonts_dir}',"
            f"fade=t=out:st={fade_start:.2f}:d={fade_dur}[vfinal]"
        )
        filter_complex = ";".join(overlay_filters + [ass_chain])
        cmd = [
            FFMPEG, "-y",
            "-i", str(silent_concat),
            "-itsoffset", str(AUDIO_HEAD_OFFSET),
            "-i", str(voice_path),
            *overlay_inputs,
            "-filter_complex", filter_complex,
            "-af", af_chain,
            "-map", "[vfinal]",
            "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
            "-shortest",
            str(out_path),
        ]
        n_overlays = sum(1 for o in (spec.get("overlays") or []) if o.get("filename"))
        print(f"Burning {n_overlays} overlay(s) + ASS captions + muxing audio + fade-out...")
    else:
        # Original single-input path — preserved so existing reels render bit-for-bit
        # the same as before when they have no overlays defined.
        cmd = [
            FFMPEG, "-y",
            "-i", str(silent_concat),
            "-itsoffset", str(AUDIO_HEAD_OFFSET),
            "-i", str(voice_path),
            "-vf", f"ass='{ass_for_filter}':fontsdir='{fonts_dir}',fade=t=out:st={fade_start:.2f}:d={fade_dur}",
            "-af", af_chain,
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
            "-map", "0:v:0", "-map", "1:a:0",
            "-shortest",
            str(out_path),
        ]
        print(f"Burning ASS captions + muxing audio + fade-out (last {fade_dur}s of {total_dur:.1f}s)...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"final mux failed:\n{res.stderr[-2000:]}")

    return out_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python compose_video.py <reel_id>")
        sys.exit(1)
    out = compose(sys.argv[1])
    print(f"\nDone -> {out}")
    print(f"Size: {out.stat().st_size / 1024 / 1024:.2f} MB")
