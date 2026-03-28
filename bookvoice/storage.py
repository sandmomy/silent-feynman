from __future__ import annotations

import json
import hashlib
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .audio_utils import get_audio_duration_seconds, preprocess_voice_sample
from .settings import AppSettings
from .text_utils import (
    SUPPORTED_BOOK_SUFFIXES,
    estimate_read_minutes,
    extract_text_from_bytes,
    extract_text_from_path,
    normalize_text,
    slugify,
    text_excerpt,
)


IGNORED_ROOT_NAMES = {
    ".venv",
    "__pycache__",
    "bookvoice",
    "generated_audio",
    "library_data",
    "scripts",
    "web",
}

DEFAULT_PUBLIC_CTA_LABEL = "Read and listen"
PREVIEW_RENDER_SCOPES = {"demo_excerpt", "chapter_1"}
FULL_RENDER_SCOPE = "full_book"
RENDER_SCOPE_LABELS = {
    "demo_excerpt": "Short demo",
    "chapter_1": "Chapter 1 only",
    "full_book": "Full book",
}
VOICE_SAMPLE_MODES = ("raw_single", "clean_single", "clean_multi")
VOICE_SAMPLE_MODE_LABELS = {
    "raw_single": "Raw single sample",
    "clean_single": "Clean best sample",
    "clean_multi": "Clean multi-sample",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LibraryStore:
    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings
        self.settings.ensure_directories()
        self._lock = threading.RLock()
        self.ensure_demo_customer()

    def scan_importable_documents(self) -> list[Path]:
        documents: list[Path] = []
        for path in self.settings.app_dir.iterdir():
            if path.name in IGNORED_ROOT_NAMES:
                continue
            try:
                is_file = path.is_file()
            except OSError:
                # Some Windows shell entries can surface as unreadable pseudo-files.
                continue
            if not is_file:
                continue
            if path.suffix.lower() != ".pdf":
                continue
            documents.append(path)
        return sorted(documents, key=lambda item: item.name.lower())

    def seed_local_documents(self) -> list[dict]:
        imported = []
        fingerprints = {book["source_fingerprint"] for book in self.list_books() if book.get("source_fingerprint")}
        for path in self.scan_importable_documents():
            fingerprint = self._file_fingerprint(path)
            if fingerprint in fingerprints:
                continue
            imported.append(self.import_book_from_path(path))
            fingerprints.add(fingerprint)
        return imported

    def list_books(self, *, published_only: bool = False) -> list[dict]:
        books = []
        for metadata_path in self.settings.books_dir.glob("*/metadata.json"):
            book = self._normalize_book_payload(self._read_json(metadata_path))
            if published_only and not book.get("published", False):
                continue
            books.append(book)
        return sorted(books, key=lambda book: book.get("created_at", ""), reverse=True)

    def list_customer_users(self) -> list[dict]:
        users = []
        for metadata_path in self.settings.users_dir.glob("*/metadata.json"):
            user = self._read_json(metadata_path)
            if user.get("role") != "customer":
                continue
            users.append(self._normalize_customer_payload(user))
        return sorted(users, key=lambda user: user.get("created_at", ""), reverse=True)

    def get_customer_user(self, username: str) -> dict:
        metadata_path = self.settings.users_dir / username / "metadata.json"
        if not metadata_path.exists():
            raise KeyError(f"User {username} does not exist.")
        user = self._read_json(metadata_path)
        if user.get("role") != "customer":
            raise KeyError(f"User {username} does not exist.")
        return self._normalize_customer_payload(user)

    def create_customer_user(self, *, username: str, password: str, display_name: str = "", email: str = "") -> dict:
        normalized_username = slugify(username).replace("-", "_")
        if not normalized_username:
            raise ValueError("Username cannot be empty.")
        if len(password.strip()) < 3:
            raise ValueError("Password must be at least 3 characters.")
        normalized_email = email.strip().lower()
        if normalized_email and self._find_customer_user_by_email(normalized_email):
            raise ValueError("That email is already registered.")
        user_dir = self.settings.users_dir / normalized_username
        metadata_path = user_dir / "metadata.json"
        if metadata_path.exists():
            raise ValueError("That username already exists.")
        user_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "username": normalized_username,
            "display_name": display_name.strip() or normalized_username,
            "email": normalized_email,
            "password_hash": self._hash_password(password),
            "role": "customer",
            "created_at": utc_now_iso(),
            "book_ids": [],
        }
        self._write_json(metadata_path, payload)
        return self._normalize_customer_payload(payload)

    def register_customer_user(self, *, display_name: str, email: str, password: str) -> dict:
        normalized_email = email.strip().lower()
        if "@" not in normalized_email or "." not in normalized_email.split("@")[-1]:
            raise ValueError("Enter a valid email address.")
        base_username = slugify(normalized_email.split("@", 1)[0]).replace("-", "_")
        if not base_username:
            base_username = slugify(display_name).replace("-", "_") or "reader"
        username = self._next_available_customer_username(base_username)
        return self.create_customer_user(
            username=username,
            password=password,
            display_name=display_name,
            email=normalized_email,
        )

    def authenticate_customer_user(self, username: str, password: str) -> dict | None:
        identifier = username.strip()
        user = self._find_customer_user_by_identifier(identifier)
        if not user:
            return None
        if user.get("password_hash") != self._hash_password(password):
            return None
        return user

    def grant_book_access(self, username: str, book_id: str) -> dict:
        user = self.get_customer_user(username)
        self.get_book(book_id)
        book_ids = list(user.get("book_ids", []))
        if book_id not in book_ids:
            book_ids.append(book_id)
        user["book_ids"] = sorted(book_ids)
        self._save_customer_user(user)
        return self.get_customer_user(username)

    def revoke_book_access(self, username: str, book_id: str) -> dict:
        user = self.get_customer_user(username)
        user["book_ids"] = [current for current in user.get("book_ids", []) if current != book_id]
        self._save_customer_user(user)
        return self.get_customer_user(username)

    def customer_has_book_access(self, username: str, book_id: str) -> bool:
        try:
            user = self.get_customer_user(username)
        except KeyError:
            return False
        return book_id in user.get("book_ids", [])

    def list_customer_catalog(self, username: str | None = None) -> list[dict]:
        catalog = []
        for book in self.list_books(published_only=True):
            catalog.append(self._build_customer_book_payload(book, username=username))
        return catalog

    def get_customer_book_by_slug(self, slug: str, username: str | None = None) -> dict:
        book = self.get_published_book_by_slug(slug)
        return self._build_customer_book_payload(book, username=username)

    def get_customer_book_text_by_slug(self, slug: str, username: str) -> str:
        book = self.get_published_book_by_slug(slug)
        if not self.customer_has_book_access(username, book["book_id"]):
            raise KeyError("This book is not unlocked for this user.")
        return self.get_book_text(book["book_id"])

    def get_customer_audio_path_by_slug(self, slug: str, username: str) -> Path:
        book = self.get_published_book_by_slug(slug)
        if not self.customer_has_book_access(username, book["book_id"]):
            raise KeyError("This audio is not unlocked for this user.")
        return self.get_published_audio_path_by_slug(slug)

    def get_customer_pdf_path_by_slug(self, slug: str, username: str) -> Path:
        book = self.get_published_book_by_slug(slug)
        if not self.customer_has_book_access(username, book["book_id"]):
            raise KeyError("This book PDF is not unlocked for this user.")
        return self.get_published_pdf_path_by_slug(slug)

    def get_published_audio_path_by_slug(self, slug: str) -> Path:
        book = self.get_published_book_by_slug(slug)
        narration = book.get("published_narration")
        if not narration:
            raise KeyError("This book does not have published audio yet.")
        audio_url = narration.get("audio_url", "")
        if not audio_url.startswith("/media/"):
            raise KeyError("Published audio could not be found.")
        relative_path = audio_url.removeprefix("/media/")
        return self.settings.data_dir / relative_path

    def get_published_pdf_path_by_slug(self, slug: str) -> Path:
        book = self.get_published_book_by_slug(slug)
        source_name = book.get("source_name")
        if not source_name:
            raise KeyError("This book source could not be found.")
        source_path = self.settings.books_dir / book["book_id"] / "source" / source_name
        if not source_path.exists() or source_path.suffix.lower() != ".pdf":
            raise KeyError("This book does not have a PDF source available.")
        return source_path

    def get_book(self, book_id: str) -> dict:
        metadata_path = self.settings.books_dir / book_id / "metadata.json"
        if not metadata_path.exists():
            raise KeyError(f"Book {book_id} does not exist.")
        return self._normalize_book_payload(self._read_json(metadata_path))

    def get_published_book_by_slug(self, slug: str) -> dict:
        for book in self.list_books(published_only=True):
            if book.get("slug") == slug:
                return book
        raise KeyError(f"No published book exists with slug '{slug}'.")

    def get_published_book_text_by_slug(self, slug: str) -> str:
        book = self.get_published_book_by_slug(slug)
        return self.get_book_text(book["book_id"])

    def save_book(self, book: dict) -> dict:
        normalized = self._normalize_book_payload(book)
        self._write_json(
            self.settings.books_dir / normalized["book_id"] / "metadata.json",
            self._serialize_book_payload(normalized),
        )
        return normalized

    def publish_book(self, book_id: str) -> dict:
        book = self.get_book(book_id)
        publishable_narration = self._get_publishable_narration(book)
        if not publishable_narration:
            raise ValueError("You need an approved full audio and every chapter reviewed before publishing.")
        book["published"] = True
        book["published_at"] = utc_now_iso()
        book["published_narration_id"] = publishable_narration["narration_id"]
        return self.save_book(book)

    def unpublish_book(self, book_id: str) -> dict:
        book = self.get_book(book_id)
        book["published"] = False
        book["published_at"] = None
        book["published_narration_id"] = None
        return self.save_book(book)

    def update_public_profile(self, book_id: str, profile_fields: dict) -> dict:
        book = self.get_book(book_id)
        current_profile = book.get("public_profile", {})
        updated_profile = self._public_profile_defaults(book) | current_profile | profile_fields
        book["public_profile"] = updated_profile

        if updated_profile.get("featured"):
            for other_book in self.list_books():
                if other_book["book_id"] == book_id:
                    continue
                other_profile = other_book.get("public_profile", {})
                if other_profile.get("featured"):
                    other_book["public_profile"] = self._public_profile_defaults(other_book) | other_profile | {"featured": False}
                    self.save_book(other_book)

        return self.save_book(book)

    def get_book_text(self, book_id: str) -> str:
        book_dir = self.settings.books_dir / book_id
        text_path = book_dir / "text.txt"
        if not text_path.exists():
            raise KeyError(f"The text for book {book_id} does not exist.")
        return text_path.read_text(encoding="utf-8")

    def import_book_from_path(self, source_path: Path) -> dict:
        text = normalize_text(extract_text_from_path(source_path))
        if len(text) < 20:
            raise ValueError(f"I could not extract enough text from {source_path.name}.")
        return self._create_book_record(
            source_name=source_path.name,
            source_bytes=source_path.read_bytes(),
            text=text,
            suffix=source_path.suffix,
            source_fingerprint=self._file_fingerprint(source_path),
        )

    def import_uploaded_book(self, file_name: str, content: bytes) -> dict:
        text = normalize_text(extract_text_from_bytes(file_name, content))
        if len(text) < 20:
            raise ValueError("I could not extract enough text from the uploaded file.")
        return self._create_book_record(
            source_name=file_name,
            source_bytes=content,
            text=text,
            suffix=Path(file_name).suffix,
            source_fingerprint=f"upload:{file_name}:{len(content)}",
        )

    def create_voice_profile(
        self,
        label: str,
        sample_name: str | None = None,
        content: bytes | None = None,
        notes: str = "",
        language: str = "en",
        samples: list[dict] | None = None,
    ) -> dict:
        uploaded_samples = list(samples or [])
        if sample_name is not None and content is not None:
            uploaded_samples.append({"name": sample_name, "content": content})
        if not uploaded_samples:
            raise ValueError("Upload at least one voice sample.")
        if len(uploaded_samples) > 10:
            raise ValueError("A voice pack can contain up to 10 samples.")

        voice_id = f"voice_{uuid4().hex[:10]}"
        voice_dir = self.settings.voices_dir / voice_id
        original_dir = voice_dir / "samples" / "original"
        prepared_dir = voice_dir / "samples" / "prepared"
        cleaned_dir = voice_dir / "samples" / "cleaned"
        original_dir.mkdir(parents=True, exist_ok=True)
        prepared_dir.mkdir(parents=True, exist_ok=True)
        cleaned_dir.mkdir(parents=True, exist_ok=True)

        sample_payloads: list[dict] = []
        profile_warnings: list[str] = []

        for index, uploaded_sample in enumerate(uploaded_samples, start=1):
            incoming_name = self._safe_upload_name(uploaded_sample.get("name") or f"sample_{index:02}.wav")
            incoming_content = uploaded_sample.get("content") or b""
            if not incoming_content:
                profile_warnings.append(f"{incoming_name}: this sample was empty and was skipped.")
                continue

            sample_id = f"sample_{index:03}"
            original_path = original_dir / f"{sample_id}_{incoming_name}"
            original_path.write_bytes(incoming_content)

            prepared_raw_path = prepared_dir / f"{sample_id}_raw.wav"
            cleaned_path = cleaned_dir / f"{sample_id}_clean.wav"

            try:
                processed = preprocess_voice_sample(original_path, prepared_raw_path, cleaned_path)
                metrics = processed["metrics"]
                warnings = processed["warnings"]
            except Exception as exc:
                profile_warnings.append(f"{incoming_name}: {exc}")
                continue

            sample_payloads.append(
                {
                    "sample_id": sample_id,
                    "file_name": incoming_name,
                    "original_path": str(original_path),
                    "original_url": self._media_url_from_path(original_path),
                    "prepared_raw_path": str(prepared_raw_path),
                    "prepared_raw_url": self._media_url_from_path(prepared_raw_path),
                    "cleaned_path": str(cleaned_path),
                    "cleaned_url": self._media_url_from_path(cleaned_path),
                    "duration_seconds": metrics["duration_seconds"],
                    "warnings": warnings,
                    "metrics": metrics,
                }
            )

        if not sample_payloads:
            detail = "; ".join(profile_warnings) if profile_warnings else "No readable voice samples were uploaded."
            raise ValueError(detail)

        metadata = {
            "voice_profile_id": voice_id,
            "label": label.strip() or "Untitled voice pack",
            "notes": notes.strip(),
            "language": (language or "en").strip().lower() or "en",
            "created_at": utc_now_iso(),
            "samples": sample_payloads,
            "warnings": profile_warnings,
            "comparison_runs": [],
            "preferred_preset": None,
        }
        self._write_json(voice_dir / "metadata.json", metadata)
        return self.get_voice_profile(voice_id)

    def list_voice_profiles(self) -> list[dict]:
        voices = []
        for metadata_path in self.settings.voices_dir.glob("*/metadata.json"):
            voices.append(self._normalize_voice_profile_payload(self._read_json(metadata_path)))
        return sorted(voices, key=lambda voice: voice.get("created_at", ""), reverse=True)

    def get_voice_profile(self, voice_profile_id: str) -> dict:
        metadata_path = self.settings.voices_dir / voice_profile_id / "metadata.json"
        if not metadata_path.exists():
            raise KeyError(f"Voice profile {voice_profile_id} does not exist.")
        return self._normalize_voice_profile_payload(self._read_json(metadata_path))

    def resolve_voice_render_config(self, voice_profile: dict, requested_mode: str | None = None) -> dict:
        samples = voice_profile.get("samples", [])
        raw_samples = [sample for sample in samples if self._sample_render_path(sample, cleaned=False)]
        clean_samples = [sample for sample in samples if self._sample_render_path(sample, cleaned=True)]
        available_modes = {
            "raw_single": bool(raw_samples),
            "clean_single": bool(clean_samples),
            "clean_multi": bool(clean_samples),
        }

        mode = requested_mode if requested_mode in VOICE_SAMPLE_MODES else None
        if mode and not available_modes.get(mode):
            mode = None
        if not mode:
            preferred = voice_profile.get("preferred_preset")
            if preferred in VOICE_SAMPLE_MODES and available_modes.get(preferred):
                mode = preferred
            elif clean_samples:
                mode = "clean_multi" if len(clean_samples) > 1 else "clean_single"
            else:
                mode = "raw_single"

        if mode == "raw_single":
            selected_samples = raw_samples[:1]
            sample_paths = [self._sample_render_path(selected_samples[0], cleaned=False)] if selected_samples else []
        elif mode == "clean_single":
            selected_samples = [self._best_clean_sample(clean_samples)] if clean_samples else []
            sample_paths = [self._sample_render_path(selected_samples[0], cleaned=True)] if selected_samples else []
        else:
            selected_samples = clean_samples
            sample_paths = [self._sample_render_path(sample, cleaned=True) for sample in selected_samples]

        if not sample_paths:
            raise ValueError("This voice pack does not have usable sample files yet.")

        return {
            "sample_mode": mode,
            "sample_mode_label": VOICE_SAMPLE_MODE_LABELS[mode],
            "available_modes": [preset for preset, is_available in available_modes.items() if is_available],
            "sample_paths": sample_paths,
            "sample_ids": [sample.get("sample_id") for sample in selected_samples],
            "sample_names": [sample.get("file_name") for sample in selected_samples],
            "sample_count_used": len(sample_paths),
        }

    def set_voice_profile_preferred_preset(self, voice_profile_id: str, preset: str) -> dict:
        if preset not in VOICE_SAMPLE_MODES:
            raise ValueError("Unsupported voice preset.")
        voice = self.get_voice_profile(voice_profile_id)
        render_config = self.resolve_voice_render_config(voice, preset)
        voice["preferred_preset"] = render_config["sample_mode"]
        voice["preferred_preset_updated_at"] = utc_now_iso()
        self._save_voice_profile(voice)
        return self.get_voice_profile(voice_profile_id)

    def add_voice_comparison_run(self, voice_profile_id: str, comparison_run: dict) -> dict:
        voice = self.get_voice_profile(voice_profile_id)
        comparison_runs = list(voice.get("comparison_runs", []))
        comparison_runs.insert(0, comparison_run)
        voice["comparison_runs"] = comparison_runs[:12]
        self._save_voice_profile(voice)
        return self.get_voice_profile(voice_profile_id)

    def create_job(self, *, book_id: str, engine_key: str, voice_profile_id: str | None, options: dict) -> dict:
        job_id = f"job_{uuid4().hex[:12]}"
        job_dir = self.settings.jobs_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        book_title = None
        try:
            book_title = self.get_book(book_id).get("title")
        except KeyError:
            book_title = None
        payload = {
            "job_id": job_id,
            "book_id": book_id,
            "book_title": book_title,
            "engine": engine_key,
            "voice_profile_id": voice_profile_id,
            "options": options,
            "status": "queued",
            "progress": 0.0,
            "message": "Queued",
            "created_at": utc_now_iso(),
            "updated_at": utc_now_iso(),
        }
        self._write_json(job_dir / "job.json", payload)
        return payload

    def list_jobs(self) -> list[dict]:
        jobs = []
        for job_path in self.settings.jobs_dir.glob("*/job.json"):
            jobs.append(self._read_json(job_path))
        return sorted(jobs, key=lambda job: job.get("created_at", ""), reverse=True)

    def get_job(self, job_id: str) -> dict:
        job_path = self.settings.jobs_dir / job_id / "job.json"
        if not job_path.exists():
            raise KeyError(f"Job {job_id} does not exist.")
        return self._read_json(job_path)

    def update_job(self, job_id: str, **fields: object) -> dict:
        job = self.get_job(job_id)
        job.update(fields)
        job["updated_at"] = utc_now_iso()
        self._write_json(self.settings.jobs_dir / job_id / "job.json", job)
        return job

    def get_job_dir(self, job_id: str) -> Path:
        return self.settings.jobs_dir / job_id

    def attach_narration_to_book(self, book_id: str, narration_payload: dict) -> dict:
        book = self.get_book(book_id)
        narrations = book.setdefault("narrations", [])
        narrations.insert(0, narration_payload)
        return self.save_book(book)

    def approve_narration(self, book_id: str, narration_id: str) -> dict:
        book = self.get_book(book_id)
        narration = self._get_narration(book, narration_id)
        metadata = narration.setdefault("metadata", {})

        if metadata.get("render_scope") == FULL_RENDER_SCOPE and narration.get("chapters"):
            approved_chapter_count = sum(1 for chapter in narration["chapters"] if chapter.get("approved"))
            if approved_chapter_count < len(narration["chapters"]):
                raise ValueError("Approve every chapter before approving the full audio.")

        metadata["approved"] = True
        metadata["approved_at"] = utc_now_iso()
        narration["approved"] = True
        return self.save_book(book)

    def approve_chapter(self, book_id: str, narration_id: str, chapter_index: int) -> dict:
        book = self.get_book(book_id)
        narration = self._get_narration(book, narration_id)
        metadata = narration.setdefault("metadata", {})
        if metadata.get("render_scope") != FULL_RENDER_SCOPE:
            raise ValueError("Chapter approval is only used for the full book.")

        try:
            chapter = narration["chapters"][chapter_index - 1]
        except IndexError as exc:
            raise KeyError(f"Chapter {chapter_index} does not exist.") from exc

        chapter_metadata = chapter.setdefault("metadata", {})
        chapter_metadata["approved"] = True
        chapter_metadata["approved_at"] = utc_now_iso()
        chapter["approved"] = True
        return self.save_book(book)

    def has_approved_preview(
        self,
        book_id: str,
        *,
        engine_key: str,
        voice_profile_id: str | None,
        sample_mode: str | None = None,
    ) -> bool:
        book = self.get_book(book_id)
        for narration in book.get("narrations", []):
            if narration.get("engine") != engine_key:
                continue
            if narration.get("voice_profile_id") != voice_profile_id:
                continue
            narration_mode = narration.get("metadata", {}).get("sample_mode") or narration.get("sample_mode")
            if sample_mode and narration_mode and narration_mode != sample_mode:
                continue
            if narration.get("render_scope") not in PREVIEW_RENDER_SCOPES:
                continue
            if narration.get("approved"):
                return True
        return False

    def mark_incomplete_jobs_as_failed(self) -> None:
        for job in self.list_jobs():
            if job["status"] in {"queued", "running"}:
                self.update_job(job["job_id"], status="failed", message="Interrupted because the server restarted.")

    def _create_book_record(
        self,
        *,
        source_name: str,
        source_bytes: bytes,
        text: str,
        suffix: str,
        source_fingerprint: str,
    ) -> dict:
        with self._lock:
            book_id = f"book_{uuid4().hex[:10]}"
            book_dir = self.settings.books_dir / book_id
            source_dir = book_dir / "source"
            source_dir.mkdir(parents=True, exist_ok=True)

            safe_source_name = Path(source_name).name
            source_path = source_dir / safe_source_name
            source_path.write_bytes(source_bytes)
            (book_dir / "text.txt").write_text(text, encoding="utf-8")

            metadata = {
                "book_id": book_id,
                "title": Path(source_name).stem,
                "slug": slugify(Path(source_name).stem),
                "source_name": safe_source_name,
                "source_extension": suffix.lower(),
                "source_url": f"/media/books/{book_id}/source/{safe_source_name}",
                "char_count": len(text),
                "word_count": len(text.split()),
                "estimated_read_minutes": estimate_read_minutes(text),
                "excerpt": text_excerpt(text),
                "source_fingerprint": source_fingerprint,
                "created_at": utc_now_iso(),
                "published": False,
                "published_at": None,
                "published_narration_id": None,
                "narrations": [],
            }
            metadata["public_profile"] = self._public_profile_defaults(metadata)
            self._write_json(book_dir / "metadata.json", metadata)
            return self._normalize_book_payload(metadata)

    @staticmethod
    def _public_profile_defaults(book: dict) -> dict:
        return {
            "hook": book.get("title", ""),
            "summary": book.get("excerpt", ""),
            "price_label": "",
            "cta_label": DEFAULT_PUBLIC_CTA_LABEL,
            "cta_url": "",
            "featured": False,
        }

    def _normalize_book_payload(self, book: dict) -> dict:
        normalized = dict(book)
        normalized.setdefault("narrations", [])
        normalized.setdefault("published", False)
        normalized.setdefault("published_at", None)
        normalized.setdefault("published_narration_id", None)
        normalized["public_path"] = f"/b/{normalized['slug']}"
        public_profile = normalized.get("public_profile", {})
        defaults = self._public_profile_defaults(normalized)
        normalized["public_profile"] = defaults | public_profile
        if normalized["public_profile"].get("cta_label") == "Escuchar y leer":
            normalized["public_profile"]["cta_label"] = DEFAULT_PUBLIC_CTA_LABEL
        normalized["narrations"] = [self._normalize_narration_payload(narration) for narration in normalized["narrations"]]
        normalized["published_narration"] = self._get_published_narration(normalized)
        normalized["workflow"] = self._build_workflow(normalized)
        return normalized

    def _build_customer_book_payload(self, book: dict, *, username: str | None) -> dict:
        normalized = self._normalize_book_payload(book)
        has_access = bool(username and self.customer_has_book_access(username, normalized["book_id"]))
        narration = normalized.get("published_narration")
        customer_payload = dict(normalized)
        customer_payload["has_access"] = has_access
        customer_payload["source_url"] = None
        customer_payload["customer_text_url"] = (
            f"/api/customer/books/{normalized['slug']}/text" if has_access else None
        )
        customer_payload["customer_audio_url"] = (
            f"/api/customer/books/{normalized['slug']}/audio" if has_access and narration else None
        )
        customer_payload["customer_pdf_url"] = (
            f"/api/customer/books/{normalized['slug']}/pdf"
            if has_access and normalized.get("source_extension") == ".pdf"
            else None
        )
        return customer_payload

    def _serialize_book_payload(self, book: dict) -> dict:
        payload = dict(book)
        payload.pop("public_path", None)
        payload.pop("published_narration", None)
        payload.pop("workflow", None)
        payload.pop("has_access", None)
        payload.pop("customer_text_url", None)
        payload.pop("customer_audio_url", None)
        payload.pop("customer_pdf_url", None)
        return payload

    def _normalize_narration_payload(self, narration: dict) -> dict:
        normalized = dict(narration)
        metadata = dict(normalized.get("metadata", {}))
        scope = metadata.get("render_scope") or normalized.get("render_scope") or FULL_RENDER_SCOPE
        if scope not in RENDER_SCOPE_LABELS:
            scope = FULL_RENDER_SCOPE
        metadata["render_scope"] = scope
        metadata["render_scope_label"] = RENDER_SCOPE_LABELS[scope]
        sample_mode = metadata.get("sample_mode") or normalized.get("sample_mode")
        if sample_mode in VOICE_SAMPLE_MODE_LABELS:
            metadata["sample_mode"] = sample_mode
            metadata["sample_mode_label"] = VOICE_SAMPLE_MODE_LABELS[sample_mode]

        chapters = []
        approved_chapter_count = 0
        for chapter in normalized.get("chapters", []):
            chapter_copy = dict(chapter)
            chapter_metadata = dict(chapter_copy.get("metadata", {}))
            chapter_copy["approved"] = bool(chapter_metadata.get("approved", False))
            if chapter_copy["approved"]:
                approved_chapter_count += 1
            chapter_copy["metadata"] = chapter_metadata
            chapters.append(chapter_copy)

        requires_chapter_approval = scope == FULL_RENDER_SCOPE and bool(chapters)
        chapter_reviews_complete = (not requires_chapter_approval) or approved_chapter_count == len(chapters)
        metadata["approved_chapter_count"] = approved_chapter_count
        metadata["requires_chapter_approval"] = requires_chapter_approval
        metadata["chapter_reviews_complete"] = chapter_reviews_complete
        metadata["approval_required"] = True
        metadata["ready_for_full_render"] = scope in PREVIEW_RENDER_SCOPES and bool(metadata.get("approved", False))
        metadata["ready_for_publish"] = scope == FULL_RENDER_SCOPE and bool(metadata.get("approved", False)) and chapter_reviews_complete

        normalized["metadata"] = metadata
        normalized["chapters"] = chapters
        normalized["approved"] = bool(metadata.get("approved", False))
        normalized["render_scope"] = scope
        normalized["render_scope_label"] = metadata["render_scope_label"]
        return normalized

    def _normalize_voice_profile_payload(self, voice: dict) -> dict:
        normalized = dict(voice)
        normalized.setdefault("label", "Untitled voice pack")
        normalized.setdefault("notes", "")
        normalized.setdefault("language", "en")
        normalized.setdefault("warnings", [])
        normalized.setdefault("comparison_runs", [])
        samples = normalized.get("samples")

        if not samples:
            sample_path = normalized.get("sample_path")
            sample_name = normalized.get("sample_name") or (Path(sample_path).name if sample_path else "legacy_sample")
            sample_url = normalized.get("sample_url") or (
                self._media_url_from_path(Path(sample_path)) if sample_path else None
            )
            duration_seconds = None
            if sample_path:
                try:
                    duration_seconds = get_audio_duration_seconds(Path(sample_path))
                except Exception:
                    duration_seconds = None
            samples = [
                {
                    "sample_id": "sample_001",
                    "file_name": sample_name,
                    "original_path": sample_path,
                    "original_url": sample_url,
                    "prepared_raw_path": None,
                    "prepared_raw_url": None,
                    "cleaned_path": None,
                    "cleaned_url": None,
                    "duration_seconds": duration_seconds,
                    "warnings": ["Legacy voice profile: cleaned voice-pack assets are not available yet."],
                    "metrics": {
                        "duration_seconds": duration_seconds,
                        "silence_ratio": None,
                        "peak_normalized": None,
                        "clipping": False,
                        "too_short": bool(duration_seconds is not None and duration_seconds < 15.0),
                    },
                }
            ]

        normalized_samples = [self._normalize_voice_sample_payload(sample, index) for index, sample in enumerate(samples, start=1)]
        normalized["samples"] = normalized_samples
        normalized["sample_count"] = len(normalized_samples)
        normalized["valid_sample_count"] = sum(1 for sample in normalized_samples if sample.get("duration_seconds"))
        normalized["total_duration_seconds"] = round(
            sum(float(sample.get("duration_seconds") or 0.0) for sample in normalized_samples),
            2,
        )
        normalized["quality_grade"] = self._voice_quality_grade(
            normalized["valid_sample_count"],
            normalized["total_duration_seconds"],
        )
        normalized["preferred_for_render"] = bool(normalized.get("preferred_preset"))
        normalized["available_sample_modes"] = self._available_sample_modes(normalized_samples)
        try:
            normalized["default_sample_mode"] = self.resolve_voice_render_config(normalized)["sample_mode"]
        except ValueError:
            normalized["default_sample_mode"] = "raw_single"
        normalized["default_sample_mode_label"] = VOICE_SAMPLE_MODE_LABELS[normalized["default_sample_mode"]]
        normalized["sample_name"] = normalized_samples[0].get("file_name") if normalized_samples else None
        normalized["sample_path"] = normalized_samples[0].get("original_path") if normalized_samples else None
        normalized["sample_url"] = normalized_samples[0].get("original_url") if normalized_samples else None
        normalized["comparison_runs"] = [
            self._normalize_comparison_run(run)
            for run in normalized.get("comparison_runs", [])
        ]
        return normalized

    def _get_narration(self, book: dict, narration_id: str) -> dict:
        for narration in book.get("narrations", []):
            if narration.get("narration_id") == narration_id:
                return narration
        raise KeyError(f"Narration {narration_id} does not exist.")

    def _get_published_narration(self, book: dict) -> dict | None:
        published_narration_id = book.get("published_narration_id")
        if published_narration_id:
            for narration in book.get("narrations", []):
                if narration.get("narration_id") == published_narration_id:
                    return narration
        narrations = book.get("narrations", [])
        return narrations[0] if book.get("published") and narrations else None

    def _get_publishable_narration(self, book: dict) -> dict | None:
        for narration in book.get("narrations", []):
            if narration.get("render_scope") != FULL_RENDER_SCOPE:
                continue
            if narration.get("metadata", {}).get("ready_for_publish"):
                return narration
        return None

    def _build_workflow(self, book: dict) -> dict:
        publishable_narration = self._get_publishable_narration(book)
        approved_preview = next(
            (
                narration
                for narration in book.get("narrations", [])
                if narration.get("render_scope") in PREVIEW_RENDER_SCOPES and narration.get("approved")
            ),
            None,
        )
        latest_full = next((narration for narration in book.get("narrations", []) if narration.get("render_scope") == FULL_RENDER_SCOPE), None)
        return {
            "has_approved_preview": approved_preview is not None,
            "approved_preview_narration_id": approved_preview.get("narration_id") if approved_preview else None,
            "can_publish": publishable_narration is not None,
            "publishable_narration_id": publishable_narration.get("narration_id") if publishable_narration else None,
            "publish_block_reason": ""
            if publishable_narration
            else "An approved full audio with every chapter reviewed is still required.",
            "latest_full_narration_id": latest_full.get("narration_id") if latest_full else None,
        }

    @staticmethod
    def _hash_password(password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    def _normalize_customer_payload(self, user: dict) -> dict:
        normalized = dict(user)
        normalized.setdefault("book_ids", [])
        normalized.setdefault("role", "customer")
        normalized.setdefault("email", "")
        return normalized

    def _find_customer_user_by_email(self, email: str) -> dict | None:
        normalized_email = email.strip().lower()
        if not normalized_email:
            return None
        for user in self.list_customer_users():
            if user.get("email", "").strip().lower() == normalized_email:
                return user
        return None

    def _find_customer_user_by_identifier(self, identifier: str) -> dict | None:
        if not identifier:
            return None
        normalized_username = slugify(identifier).replace("-", "_")
        if normalized_username:
            try:
                return self.get_customer_user(normalized_username)
            except KeyError:
                pass
        return self._find_customer_user_by_email(identifier)

    def _next_available_customer_username(self, base_username: str) -> str:
        base = slugify(base_username).replace("-", "_") or "reader"
        candidate = base
        suffix = 2
        while (self.settings.users_dir / candidate / "metadata.json").exists():
            candidate = f"{base}_{suffix}"
            suffix += 1
        return candidate

    def _save_customer_user(self, user: dict) -> dict:
        payload = self._normalize_customer_payload(user)
        metadata_path = self.settings.users_dir / payload["username"] / "metadata.json"
        self._write_json(metadata_path, payload)
        return payload

    def ensure_demo_customer(self) -> None:
        username = self.settings.demo_customer_username.strip()
        password = self.settings.demo_customer_password.strip()
        owned_username = self.settings.demo_owned_customer_username.strip()
        owned_password = self.settings.demo_owned_customer_password.strip()
        preferred_owned_slug = "book_chapter_1"

        if username and password:
            try:
                user = self.get_customer_user(username)
            except KeyError:
                user = self.create_customer_user(
                    username=username,
                    password=password,
                    display_name=self.settings.demo_customer_display_name,
                )
            user["display_name"] = self.settings.demo_customer_display_name
            user["book_ids"] = []
            self._save_customer_user(user)

        if owned_username and owned_password:
            try:
                owned_user = self.get_customer_user(owned_username)
            except KeyError:
                owned_user = self.create_customer_user(
                    username=owned_username,
                    password=owned_password,
                    display_name=self.settings.demo_owned_customer_display_name,
            )
            owned_user["display_name"] = self.settings.demo_owned_customer_display_name
            published_books = self.list_books(published_only=True)
            preferred_book = next((book for book in published_books if book.get("slug") == preferred_owned_slug), None)
            owned_user["book_ids"] = [preferred_book["book_id"]] if preferred_book else ([published_books[0]["book_id"]] if published_books else [])
            self._save_customer_user(owned_user)

    @staticmethod
    def _file_fingerprint(path: Path) -> str:
        stat = path.stat()
        return f"{path.name}:{stat.st_size}:{int(stat.st_mtime)}"

    @staticmethod
    def _read_json(path: Path) -> dict:
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(path: Path, payload: dict) -> None:
        temp_path = path.with_suffix(path.suffix + ".tmp")
        temp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
        temp_path.replace(path)

    def _save_voice_profile(self, voice: dict) -> None:
        voice_dir = self.settings.voices_dir / voice["voice_profile_id"]
        payload = dict(voice)
        for field in (
            "sample_count",
            "valid_sample_count",
            "total_duration_seconds",
            "quality_grade",
            "preferred_for_render",
            "available_sample_modes",
            "default_sample_mode",
            "default_sample_mode_label",
        ):
            payload.pop(field, None)
        payload["samples"] = [self._serialize_voice_sample_payload(sample) for sample in payload.get("samples", [])]
        payload["comparison_runs"] = [self._serialize_comparison_run(run) for run in payload.get("comparison_runs", [])]
        self._write_json(voice_dir / "metadata.json", payload)

    def _normalize_voice_sample_payload(self, sample: dict, index: int) -> dict:
        normalized = dict(sample)
        normalized.setdefault("sample_id", f"sample_{index:03}")
        normalized.setdefault("file_name", f"{normalized['sample_id']}.wav")
        normalized.setdefault("warnings", [])
        normalized.setdefault("metrics", {})
        normalized.setdefault("original_path", normalized.get("sample_path"))
        normalized.setdefault("original_url", normalized.get("sample_url"))
        normalized.setdefault("prepared_raw_path", None)
        normalized.setdefault("prepared_raw_url", None)
        normalized.setdefault("cleaned_path", None)
        normalized.setdefault("cleaned_url", None)
        normalized.setdefault(
            "duration_seconds",
            normalized.get("metrics", {}).get("duration_seconds") or normalized.get("duration_seconds"),
        )
        normalized["warnings"] = list(normalized.get("warnings") or [])
        return normalized

    @staticmethod
    def _serialize_voice_sample_payload(sample: dict) -> dict:
        payload = dict(sample)
        return payload

    def _normalize_comparison_run(self, run: dict) -> dict:
        normalized = dict(run)
        variants = []
        for variant in normalized.get("variants", []):
            variant_copy = dict(variant)
            preset = variant_copy.get("preset")
            if preset in VOICE_SAMPLE_MODE_LABELS:
                variant_copy.setdefault("preset_label", VOICE_SAMPLE_MODE_LABELS[preset])
            variants.append(variant_copy)
        normalized["variants"] = variants
        return normalized

    @staticmethod
    def _serialize_comparison_run(run: dict) -> dict:
        return dict(run)

    @staticmethod
    def _safe_upload_name(value: str) -> str:
        cleaned = Path(value).name.strip().replace(" ", "_")
        return cleaned or "sample.wav"

    def _media_url_from_path(self, path: Path) -> str:
        relative = path.resolve().relative_to(self.settings.data_dir.resolve())
        return f"/media/{relative.as_posix()}"

    @staticmethod
    def _voice_quality_grade(valid_sample_count: int, total_duration_seconds: float) -> str:
        if valid_sample_count >= 5 and total_duration_seconds >= 600:
            return "strong"
        if valid_sample_count >= 3 and total_duration_seconds >= 180:
            return "good"
        return "usable"

    @staticmethod
    def _best_clean_sample(samples: list[dict]) -> dict:
        return max(
            samples,
            key=lambda sample: (
                float(sample.get("duration_seconds") or 0.0),
                -len(sample.get("warnings", [])),
                sample.get("sample_id", ""),
            ),
        )

    def _available_sample_modes(self, samples: list[dict]) -> list[str]:
        available: list[str] = []
        if any(self._sample_render_path(sample, cleaned=False) for sample in samples):
            available.append("raw_single")
        if any(self._sample_render_path(sample, cleaned=True) for sample in samples):
            available.append("clean_single")
            available.append("clean_multi")
        return available

    def _sample_render_path(self, sample: dict, *, cleaned: bool) -> str | None:
        path_candidates = []
        if cleaned:
            path_candidates.extend([sample.get("cleaned_path"), sample.get("prepared_raw_path"), sample.get("original_path")])
        else:
            path_candidates.extend([sample.get("prepared_raw_path"), sample.get("original_path")])
        for candidate in path_candidates:
            if candidate and Path(candidate).exists():
                return str(Path(candidate))
        return None
