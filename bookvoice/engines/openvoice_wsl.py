from __future__ import annotations

import json
import shlex
import subprocess
from pathlib import Path

from ..audio_utils import convert_audio_to_mp3, get_audio_duration_seconds
from ..settings import AppSettings
from .base import EngineDescriptor, NarrationContext, NarrationResult, ProgressCallback


class OpenVoiceWSLEngine:
    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings

    def descriptor(self) -> EngineDescriptor:
        return EngineDescriptor(
            key="openvoice_wsl",
            name="OpenVoice + MeloTTS (WSL)",
            description="Local engine prepared for voice cloning and full narration in Linux/WSL.",
            ready=self._is_ready(),
            mode="local-gpu",
            requires_voice_profile=True,
        )

    def synthesize(self, context: NarrationContext, progress_callback: ProgressCallback) -> NarrationResult:
        if not self._is_ready():
            raise RuntimeError(
                "OpenVoice WSL is not configured. Check OPENVOICE_WSL_ENABLED and OPENVOICE_WSL_PYTHON_BIN."
            )
        if not context.voice_profile:
            raise RuntimeError("This engine needs a saved voice pack.")

        render_config = context.voice_profile.get("_render_config") or {}
        voice_sample_paths = list(render_config.get("sample_paths") or [])
        if not voice_sample_paths:
            legacy_path = context.voice_profile.get("sample_path")
            if legacy_path:
                voice_sample_paths = [legacy_path]
        if not voice_sample_paths:
            raise RuntimeError("This voice pack does not contain any usable sample files.")

        request_path = context.output_dir / "openvoice_request.json"
        output_wav_path = context.output_dir / "book_openvoice.wav"
        output_audio_path = context.output_dir / "book_openvoice.mp3"
        payload = {
            "title": context.title,
            "language": context.language,
            "speed": context.speed,
            "chunks": context.chunks,
            "voice_sample_paths": voice_sample_paths,
            "output_audio_path": str(output_wav_path),
            "base_speaker": self.settings.openvoice_base_speaker_es
            if context.language == "es"
            else self.settings.openvoice_base_speaker_en,
        }
        request_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")

        progress_callback(0, 1, "Launching OpenVoice in WSL")
        request_path_wsl = self._to_wsl_path(request_path)
        project_dir_wsl = self._to_wsl_path(self.settings.app_dir)
        command = (
            f"cd {shlex.quote(project_dir_wsl)} && "
            f"{shlex.quote(self.settings.openvoice_python_bin)} scripts/openvoice_book_tts.py "
            f"--request-json {shlex.quote(request_path_wsl)}"
        )
        result = subprocess.run(
            ["wsl", "-d", self.settings.openvoice_wsl_distro, "bash", "-lc", command],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            message = (result.stderr or result.stdout).strip()
            raise RuntimeError(f"OpenVoice failed in WSL: {message}")
        if not output_wav_path.exists():
            raise RuntimeError("OpenVoice finished without producing the expected WAV file.")

        convert_audio_to_mp3(output_wav_path, output_audio_path)

        progress_callback(1, 1, "Audio generated")
        return NarrationResult(
            audio_path=output_audio_path,
            segment_count=len(context.chunks),
            metadata={
                "engine_mode": "openvoice_wsl",
                "audio_duration_seconds": get_audio_duration_seconds(output_audio_path),
                "sample_mode": render_config.get("sample_mode") or context.options.get("sample_mode"),
                "sample_count_used": render_config.get("sample_count_used", len(voice_sample_paths)),
                "voice_sample_paths": voice_sample_paths,
                "wsl_stdout": result.stdout.strip()[-1200:],
            },
        )

    def _is_ready(self) -> bool:
        return self.settings.openvoice_enabled and bool(self.settings.openvoice_python_bin.strip())

    def _to_wsl_path(self, path: Path) -> str:
        command = f"wslpath -a {shlex.quote(str(path))}"
        result = subprocess.run(
            ["wsl", "-d", self.settings.openvoice_wsl_distro, "bash", "-lc", command],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"I could not convert this path to WSL: {path}")
        return result.stdout.strip()
