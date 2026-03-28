from __future__ import annotations

import subprocess
import wave
from pathlib import Path


VOICE_SAMPLE_RATE = 24000
VOICE_CLEANUP_FILTER = ",".join(
    [
        "highpass=f=100",
        "lowpass=f=7800",
        "afftdn=nf=-25",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "silenceremove=start_periods=1:start_duration=0.15:start_threshold=-45dB:"
        "stop_periods=-1:stop_duration=0.2:stop_threshold=-45dB",
    ]
)


def _run_media_command(command: list[str], *, error_message: str) -> str:
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or error_message
        raise RuntimeError(detail)
    return result.stdout.strip()


def concat_mp3_files(segment_paths: list[Path], output_path: Path) -> None:
    manifest_path = output_path.with_name("concat_manifest.txt")
    lines = []
    for segment_path in segment_paths:
        ffmpeg_path = segment_path.resolve().as_posix().replace("'", "'\\''")
        lines.append(f"file '{ffmpeg_path}'")
    manifest_path.write_text("\n".join(lines), encoding="utf-8")

    _run_media_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(manifest_path),
            "-c",
            "copy",
            str(output_path),
        ],
        error_message="ffmpeg could not merge the audio segments.",
    )


def create_silence_mp3(output_path: Path, duration_seconds: float) -> None:
    _run_media_command(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=mono",
            "-t",
            f"{duration_seconds:.2f}",
            "-q:a",
            "9",
            "-acodec",
            "libmp3lame",
            str(output_path),
        ],
        error_message="ffmpeg could not create the preview silence track.",
    )


def get_audio_duration_seconds(audio_path: Path) -> float | None:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    try:
        return round(float(result.stdout.strip()), 2)
    except ValueError:
        return None


def convert_audio_to_mp3(source_path: Path, output_path: Path) -> None:
    _run_media_command(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(output_path),
        ],
        error_message="ffmpeg could not convert the audio to MP3.",
    )


def convert_audio_to_voice_wav(source_path: Path, output_path: Path, *, cleaned: bool) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(VOICE_SAMPLE_RATE),
        "-c:a",
        "pcm_s16le",
    ]
    if cleaned:
        command.extend(["-af", VOICE_CLEANUP_FILTER])
    command.append(str(output_path))
    _run_media_command(
        command,
        error_message="ffmpeg could not preprocess the voice sample.",
    )


def analyze_voice_wav(audio_path: Path) -> dict:
    with wave.open(str(audio_path), "rb") as wav_file:
        frame_count = wav_file.getnframes()
        sample_rate = wav_file.getframerate()
        sample_width = wav_file.getsampwidth()
        channel_count = wav_file.getnchannels()
        raw_frames = wav_file.readframes(frame_count)

    if frame_count <= 0 or sample_rate <= 0:
        raise RuntimeError("The generated WAV is empty.")

    if sample_width not in {1, 2, 4}:
        raise RuntimeError(f"Unsupported sample width: {sample_width}")

    if sample_width == 1:
        max_amplitude = 127
        samples = [abs(sample - 128) for sample in raw_frames]
    elif sample_width == 2:
        max_amplitude = 32767
        samples = [
            abs(int.from_bytes(raw_frames[index : index + 2], byteorder="little", signed=True))
            for index in range(0, len(raw_frames), 2)
        ]
    else:
        max_amplitude = 2147483647
        samples = [
            abs(int.from_bytes(raw_frames[index : index + 4], byteorder="little", signed=True))
            for index in range(0, len(raw_frames), 4)
        ]

    if not samples:
        raise RuntimeError("No samples could be read from the WAV file.")

    peak = max(samples)
    silence_threshold = max(1, int(max_amplitude * 0.015))
    silent_samples = sum(1 for sample in samples if sample <= silence_threshold)
    total_samples = max(1, len(samples))
    duration_seconds = round(frame_count / float(sample_rate), 2)

    return {
        "duration_seconds": duration_seconds,
        "sample_rate": sample_rate,
        "channel_count": channel_count,
        "sample_width": sample_width,
        "peak_normalized": round(peak / float(max_amplitude), 4),
        "silence_ratio": round(silent_samples / float(total_samples), 4),
        "clipping": peak >= int(max_amplitude * 0.985),
        "too_short": duration_seconds < 15.0,
    }


def preprocess_voice_sample(source_path: Path, raw_wav_path: Path, cleaned_wav_path: Path) -> dict:
    raw_wav_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned_wav_path.parent.mkdir(parents=True, exist_ok=True)
    convert_audio_to_voice_wav(source_path, raw_wav_path, cleaned=False)
    convert_audio_to_voice_wav(source_path, cleaned_wav_path, cleaned=True)
    metrics = analyze_voice_wav(cleaned_wav_path)

    warnings: list[str] = []
    if metrics["too_short"]:
        warnings.append("This sample is short. Longer clips usually clone more accurately.")
    if metrics["silence_ratio"] >= 0.35:
        warnings.append("This sample still contains a lot of silence.")
    if metrics["clipping"]:
        warnings.append("This sample appears clipped or distorted.")

    return {
        "metrics": metrics,
        "warnings": warnings,
    }
