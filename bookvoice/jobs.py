from __future__ import annotations

import threading
from queue import Empty, Queue
from pathlib import Path
from uuid import uuid4

from .engines import MockPreviewEngine, OpenVoiceWSLEngine
from .engines.base import NarrationContext
from .audio_utils import concat_mp3_files, get_audio_duration_seconds
from .settings import AppSettings
from .storage import LibraryStore, VOICE_SAMPLE_MODE_LABELS, utc_now_iso
from .text_utils import slugify, split_text_into_chunks, split_text_into_review_sections, text_excerpt


RENDER_SCOPE_LABELS = {
    "demo_excerpt": "Short demo",
    "chapter_1": "Chapter 1 only",
    "full_book": "Full book",
}
VOICE_COMPARISON_PRESETS = ("raw_single", "clean_single", "clean_multi")
VOICE_COMPARISON_TITLE = "Voice comparison reference"
VOICE_COMPARISON_PASSAGE = (
    "A good reading experience should feel calm, clear, and personal. "
    "The listener should understand every sentence without effort, and the voice should sound warm enough "
    "to stay with them chapter after chapter. This short passage exists only to compare voice quality, pacing, "
    "and natural tone under the same conditions every time."
)


class NarrationJobManager:
    def __init__(self, store: LibraryStore, settings: AppSettings) -> None:
        self.store = store
        self.settings = settings
        self.engines = {
            "mock_preview": MockPreviewEngine(),
            "openvoice_wsl": OpenVoiceWSLEngine(settings),
        }
        self.queue: Queue[str] = Queue()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._worker_loop, name="bookvoice-jobs", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def list_engine_descriptors(self) -> list[dict]:
        return [engine.descriptor().__dict__ for engine in self.engines.values()]

    def enqueue(self, *, book_id: str, engine_key: str, voice_profile_id: str | None, options: dict) -> dict:
        if engine_key not in self.engines:
            raise KeyError(f"Unknown engine: {engine_key}")
        if voice_profile_id:
            self.store.get_voice_profile(voice_profile_id)
        job = self.store.create_job(
            book_id=book_id,
            engine_key=engine_key,
            voice_profile_id=voice_profile_id,
            options=options,
        )
        self.queue.put(job["job_id"])
        return job

    def render_voice_comparison(self, *, voice_profile_id: str, book_id: str | None = None, language: str = "en") -> dict:
        engine = self.engines["openvoice_wsl"]
        if not engine.descriptor().ready:
            raise RuntimeError("OpenVoice WSL is not ready yet.")

        voice_profile = self.store.get_voice_profile(voice_profile_id)
        comparison_run_id = f"cmp_{uuid4().hex[:10]}"
        comparison_dir = self.settings.voices_dir / voice_profile_id / "comparisons" / comparison_run_id
        comparison_dir.mkdir(parents=True, exist_ok=True)
        chunks = split_text_into_chunks(VOICE_COMPARISON_PASSAGE, max_chars=280)

        variants = []
        for preset in VOICE_COMPARISON_PRESETS:
            render_config = self.store.resolve_voice_render_config(voice_profile, preset)
            variant_dir = comparison_dir / preset
            variant_dir.mkdir(parents=True, exist_ok=True)
            render_voice = dict(voice_profile)
            render_voice["_render_config"] = render_config

            result = engine.synthesize(
                NarrationContext(
                    book_id=book_id or "voice-comparison",
                    title=f"{VOICE_COMPARISON_TITLE} - {VOICE_SAMPLE_MODE_LABELS[preset]}",
                    language=(language or "en").lower() or "en",
                    speed=0.92,
                    chunks=chunks,
                    output_dir=variant_dir,
                    voice_profile=render_voice,
                    options={
                        "render_scope": "demo_excerpt",
                        "sample_mode": preset,
                        "comparison_run_id": comparison_run_id,
                    },
                ),
                progress_callback=lambda current, total, message: None,
            )

            final_audio_path = comparison_dir / f"{preset}.mp3"
            if result.audio_path != final_audio_path:
                result.audio_path.replace(final_audio_path)

            variants.append(
                {
                    "preset": preset,
                    "preset_label": VOICE_SAMPLE_MODE_LABELS[preset],
                    "resolved_preset": render_config["sample_mode"],
                    "resolved_preset_label": render_config["sample_mode_label"],
                    "audio_url": self._media_url(final_audio_path),
                    "audio_path": str(final_audio_path),
                    "duration_seconds": get_audio_duration_seconds(final_audio_path),
                    "sample_count_used": render_config["sample_count_used"],
                    "sample_ids": render_config["sample_ids"],
                    "sample_names": render_config["sample_names"],
                }
            )

        comparison_run = {
            "comparison_run_id": comparison_run_id,
            "book_id": book_id,
            "language": (language or "en").lower() or "en",
            "created_at": utc_now_iso(),
            "passage_title": VOICE_COMPARISON_TITLE,
            "passage_text": VOICE_COMPARISON_PASSAGE,
            "variants": variants,
        }
        updated_voice = self.store.add_voice_comparison_run(voice_profile_id, comparison_run)
        return {
            "voice_profile": updated_voice,
            "comparison_run": updated_voice.get("comparison_runs", [comparison_run])[0],
        }

    def _worker_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                job_id = self.queue.get(timeout=0.5)
            except Empty:
                continue

            try:
                self._run_job(job_id)
            finally:
                self.queue.task_done()

    def _run_job(self, job_id: str) -> None:
        job = self.store.get_job(job_id)
        book = self.store.get_book(job["book_id"])
        text = self.store.get_book_text(book["book_id"])
        engine = self.engines[job["engine"]]
        voice_profile = None
        if job.get("voice_profile_id"):
            voice_profile = self.store.get_voice_profile(job["voice_profile_id"])

        options = job.get("options", {})
        chunk_size = int(options.get("chunk_size", 2200))
        section_chars = int(options.get("section_chars", 18000))
        demo_chars = int(options.get("demo_chars", 1200))
        render_scope = options.get("render_scope", "demo_excerpt")
        language = options.get("language", "en")
        speed = float(options.get("speed", 1.0))
        sample_mode = options.get("sample_mode")
        render_config = None
        if voice_profile:
            render_config = self.store.resolve_voice_render_config(voice_profile, sample_mode)
            options = dict(options)
            options["sample_mode"] = render_config["sample_mode"]
            voice_profile = dict(voice_profile)
            voice_profile["_render_config"] = render_config
        all_sections = split_text_into_review_sections(text, target_chars=section_chars)
        sections = self._select_sections_for_scope(all_sections, render_scope=render_scope, demo_chars=demo_chars)
        output_dir = self.store.get_job_dir(job_id) / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        self.store.update_job(
            job_id,
            status="running",
            progress=0.02,
            message=f"Preparing {RENDER_SCOPE_LABELS.get(render_scope, 'audio')}",
        )

        try:
            chapter_results = self._render_sections(
                job_id=job_id,
                book=book,
                engine=engine,
                voice_profile=voice_profile,
                sections=sections,
                chunk_size=chunk_size,
                language=language,
                speed=speed,
                output_dir=output_dir,
                options=options,
            )

            chapter_paths = [Path(chapter["audio_path"]) for chapter in chapter_results]
            if not chapter_paths:
                raise RuntimeError("No audio chapter was generated.")

            audio_name = f"{slugify(book['title'])}_{job['engine']}.mp3"
            final_audio_path = output_dir / audio_name
            concat_mp3_files(chapter_paths, final_audio_path)

            narration_id = f"nar_{uuid4().hex[:10]}"
            narration_payload = {
                "narration_id": narration_id,
                "job_id": job_id,
                "engine": job["engine"],
                "voice_profile_id": job.get("voice_profile_id"),
                "audio_url": f"/media/jobs/{job_id}/output/{audio_name}",
                "download_url": f"/media/jobs/{job_id}/output/{audio_name}",
                "created_at": utc_now_iso(),
                "segment_count": sum(chapter["segment_count"] for chapter in chapter_results),
                "chapter_count": len(chapter_results),
                "render_scope": render_scope,
                "render_scope_label": RENDER_SCOPE_LABELS.get(render_scope, render_scope),
                "approved": False,
                "sample_mode": options.get("sample_mode"),
                "chapters": [
                    {
                        "chapter_index": chapter["chapter_index"],
                        "title": chapter["title"],
                        "excerpt": chapter["excerpt"],
                        "word_count": chapter["word_count"],
                        "segment_count": chapter["segment_count"],
                        "audio_url": chapter["audio_url"],
                        "download_url": chapter["audio_url"],
                        "metadata": chapter["metadata"],
                    }
                    for chapter in chapter_results
                ],
                "metadata": {
                    "render_scope": render_scope,
                    "render_scope_label": RENDER_SCOPE_LABELS.get(render_scope, render_scope),
                    "approved": False,
                    "sample_mode": options.get("sample_mode"),
                    "sample_mode_label": VOICE_SAMPLE_MODE_LABELS.get(options.get("sample_mode"), ""),
                    "voice_sample_count_used": render_config["sample_count_used"] if render_config else None,
                    "voice_sample_ids": render_config["sample_ids"] if render_config else [],
                    "voice_sample_names": render_config["sample_names"] if render_config else [],
                    "chapter_count": len(chapter_results),
                    "audio_duration_seconds": get_audio_duration_seconds(final_audio_path),
                    "chapters_review_ready": True,
                    "chapter_titles": [chapter["title"] for chapter in chapter_results],
                },
            }
            self.store.attach_narration_to_book(book["book_id"], narration_payload)
            self.store.update_job(
                job_id,
                status="completed",
                progress=1.0,
                message="Narration ready",
                narration=narration_payload,
            )
        except Exception as exc:
            self.store.update_job(job_id, status="failed", message=str(exc), progress=0.0)

    def _select_sections_for_scope(self, sections: list[dict], *, render_scope: str, demo_chars: int) -> list[dict]:
        if not sections:
            return []
        if render_scope == "full_book":
            return sections
        if render_scope == "chapter_1":
            return sections[:1]
        if render_scope == "demo_excerpt":
            base_section = sections[0]
            demo_text = split_text_into_chunks(base_section["text"], max_chars=demo_chars)[0]
            return [
                {
                    "index": 1,
                    "title": f"Short demo - {base_section['title']}",
                    "text": demo_text,
                    "excerpt": text_excerpt(demo_text, max_chars=180),
                    "word_count": len(demo_text.split()),
                    "char_count": len(demo_text),
                }
            ]
        raise ValueError(f"Unknown render scope: {render_scope}")

    def _render_sections(
        self,
        *,
        job_id: str,
        book: dict,
        engine: object,
        voice_profile: dict | None,
        sections: list[dict],
        chunk_size: int,
        language: str,
        speed: float,
        output_dir: Path,
        options: dict,
    ) -> list[dict]:
        chapter_dir = output_dir / "chapters"
        chapter_dir.mkdir(parents=True, exist_ok=True)
        total_sections = max(1, len(sections))
        chapter_results: list[dict] = []

        for index, section in enumerate(sections, start=1):
            section_title = section["title"]
            section_chunks = split_text_into_chunks(section["text"], max_chars=chunk_size)
            section_output_dir = chapter_dir / f"chapter_{index:03}"
            section_output_dir.mkdir(parents=True, exist_ok=True)

            def section_progress_callback(current: float, total: float, message: str) -> None:
                section_ratio = 1.0 if not total else float(current) / float(total)
                overall_ratio = ((index - 1) + section_ratio) / total_sections
                self.store.update_job(
                    job_id,
                    status="running",
                    progress=overall_ratio,
                    message=f"{section_title}: {message}",
                )

            self.store.update_job(
                job_id,
                status="running",
                progress=(index - 1) / total_sections,
                message=f"Generating {section_title}",
            )

            result = engine.synthesize(
                NarrationContext(
                    book_id=book["book_id"],
                    title=f"{book['title']} - {section_title}",
                    language=language,
                    speed=speed,
                    chunks=section_chunks,
                    output_dir=section_output_dir,
                    voice_profile=voice_profile,
                    options=options,
                ),
                progress_callback=section_progress_callback,
            )

            chapter_audio_name = f"chapter_{index:03}_{slugify(section_title)}.mp3"
            final_chapter_audio_path = chapter_dir / chapter_audio_name
            if result.audio_path != final_chapter_audio_path:
                result.audio_path.replace(final_chapter_audio_path)

            chapter_results.append(
                {
                    "chapter_index": index,
                    "title": section_title,
                    "excerpt": section["excerpt"],
                    "word_count": section["word_count"],
                    "segment_count": result.segment_count,
                    "audio_path": str(final_chapter_audio_path),
                    "audio_url": f"/media/jobs/{job_id}/output/chapters/{chapter_audio_name}",
                    "metadata": result.metadata,
                }
            )

        return chapter_results

    def _media_url(self, path: Path) -> str:
        relative = path.resolve().relative_to(self.settings.data_dir.resolve())
        return f"/media/{relative.as_posix()}"
