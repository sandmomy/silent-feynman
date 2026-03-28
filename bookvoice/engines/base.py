from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Protocol


ProgressCallback = Callable[[int, int, str], None]


@dataclass(frozen=True)
class EngineDescriptor:
    key: str
    name: str
    description: str
    ready: bool
    mode: str
    requires_voice_profile: bool


@dataclass(frozen=True)
class NarrationContext:
    book_id: str
    title: str
    language: str
    speed: float
    chunks: list[str]
    output_dir: Path
    voice_profile: dict | None = None
    options: dict | None = None


@dataclass(frozen=True)
class NarrationResult:
    audio_path: Path
    segment_count: int
    metadata: dict


class NarrationEngine(Protocol):
    def descriptor(self) -> EngineDescriptor:
        ...

    def synthesize(self, context: NarrationContext, progress_callback: ProgressCallback) -> NarrationResult:
        ...
