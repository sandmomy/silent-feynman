from __future__ import annotations

from pathlib import Path

from ..audio_utils import concat_mp3_files, create_silence_mp3, get_audio_duration_seconds
from .base import EngineDescriptor, NarrationContext, NarrationResult, ProgressCallback


class MockPreviewEngine:
    def descriptor(self) -> EngineDescriptor:
        return EngineDescriptor(
            key="mock_preview",
            name="Preview local",
            description="Genera un MP3 de prueba para validar la web, la cola y el almacenamiento.",
            ready=True,
            mode="local",
            requires_voice_profile=False,
        )

    def synthesize(self, context: NarrationContext, progress_callback: ProgressCallback) -> NarrationResult:
        segments_dir = context.output_dir / "segments"
        segments_dir.mkdir(parents=True, exist_ok=True)
        segment_paths: list[Path] = []

        for index, chunk in enumerate(context.chunks, start=1):
            words = max(12, len(chunk.split()))
            duration_seconds = min(25.0, max(1.4, words / 3.2))
            segment_path = segments_dir / f"segment_{index:03}.mp3"
            create_silence_mp3(segment_path, duration_seconds)
            segment_paths.append(segment_path)
            progress_callback(index, len(context.chunks), f"Segmento preview {index}/{len(context.chunks)}")

        output_audio_path = context.output_dir / "book_preview.mp3"
        concat_mp3_files(segment_paths, output_audio_path)
        return NarrationResult(
            audio_path=output_audio_path,
            segment_count=len(segment_paths),
            metadata={
                "engine_mode": "preview",
                "audio_duration_seconds": get_audio_duration_seconds(output_audio_path),
                "notes": "Este audio es una maqueta silenciosa para probar el pipeline local completo.",
            },
        )
