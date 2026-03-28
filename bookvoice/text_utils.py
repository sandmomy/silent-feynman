from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader


SUPPORTED_BOOK_SUFFIXES = {".pdf", ".txt", ".md"}

SECTION_HEADING_RE = re.compile(
    r"^(chapter|cap[ií]tulo|part|parte|section|secci[oó]n|book|libro)\b",
    re.IGNORECASE,
)


def extract_text_from_path(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(str(path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return path.read_text(encoding="utf-8", errors="ignore")


def extract_text_from_bytes(file_name: str, content: bytes) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(BytesIO(content))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return content.decode("utf-8", errors="ignore")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_text_into_review_sections(text: str, target_chars: int = 18000) -> list[dict]:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", normalize_text(text)) if part.strip()]
    if not paragraphs:
        return []

    sections: list[dict] = []
    current_title = ""
    current_paragraphs: list[str] = []

    def flush() -> None:
        nonlocal current_title, current_paragraphs
        section_text = "\n\n".join(current_paragraphs).strip()
        if not section_text:
            current_title = ""
            current_paragraphs = []
            return
        index = len(sections) + 1
        title = current_title or f"Parte {index}"
        sections.append(
            {
                "index": index,
                "title": title,
                "text": section_text,
                "excerpt": text_excerpt(section_text, max_chars=180),
                "word_count": len(section_text.split()),
                "char_count": len(section_text),
            }
        )
        current_title = ""
        current_paragraphs = []

    for paragraph in paragraphs:
        compact = re.sub(r"\s+", " ", paragraph).strip()
        is_heading = bool(SECTION_HEADING_RE.match(compact))
        current_length = len("\n\n".join(current_paragraphs))

        if is_heading and current_paragraphs:
            flush()
            current_title = compact[:120]

        if is_heading and not current_paragraphs:
            current_title = compact[:120]

        current_paragraphs.append(paragraph)

        if not is_heading and current_length >= target_chars:
            flush()

    flush()

    if len(sections) == 1:
        return _split_large_section_into_parts(sections[0], target_chars=max(8000, target_chars))
    return sections


def _split_large_section_into_parts(section: dict, target_chars: int) -> list[dict]:
    text = section["text"]
    chunks = split_text_into_chunks(text, max_chars=target_chars)
    if len(chunks) <= 1:
        return [section]

    parts: list[dict] = []
    for index, chunk in enumerate(chunks, start=1):
        title = f"{section['title']} - Parte {index}" if section["title"] else f"Parte {index}"
        parts.append(
            {
                "index": index,
                "title": title,
                "text": chunk,
                "excerpt": text_excerpt(chunk, max_chars=180),
                "word_count": len(chunk.split()),
                "char_count": len(chunk),
            }
        )
    return parts


def split_text_into_chunks(text: str, max_chars: int) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", normalize_text(text)) if part.strip()]
    chunks: list[str] = []
    current_parts: list[str] = []
    current_len = 0

    def flush() -> None:
        nonlocal current_parts, current_len
        if current_parts:
            chunks.append("\n\n".join(current_parts).strip())
            current_parts = []
            current_len = 0

    def append_piece(piece: str) -> None:
        nonlocal current_len
        separator = 2 if current_parts else 0
        projected = current_len + len(piece) + separator
        if projected > max_chars and current_parts:
            flush()
        current_parts.append(piece)
        current_len += len(piece) + (2 if len(current_parts) > 1 else 0)

    for paragraph in paragraphs:
        if len(paragraph) <= max_chars:
            append_piece(paragraph)
            continue

        sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", paragraph) if item.strip()]
        if not sentences:
            sentences = [paragraph]

        for sentence in sentences:
            if len(sentence) <= max_chars:
                append_piece(sentence)
                continue

            words = sentence.split()
            current_sentence_words: list[str] = []
            current_sentence_len = 0

            for word in words:
                extra = len(word) + (1 if current_sentence_words else 0)
                if current_sentence_words and current_sentence_len + extra > max_chars:
                    append_piece(" ".join(current_sentence_words))
                    current_sentence_words = [word]
                    current_sentence_len = len(word)
                elif len(word) > max_chars:
                    flush()
                    for start in range(0, len(word), max_chars):
                        chunks.append(word[start : start + max_chars])
                    current_sentence_words = []
                    current_sentence_len = 0
                else:
                    current_sentence_words.append(word)
                    current_sentence_len += extra

            if current_sentence_words:
                append_piece(" ".join(current_sentence_words))

    flush()
    return [chunk for chunk in chunks if chunk.strip()]


def estimate_read_minutes(text: str, words_per_minute: int = 165) -> int:
    words = len(text.split())
    return max(1, round(words / words_per_minute))


def text_excerpt(text: str, max_chars: int = 420) -> str:
    clean = normalize_text(text).replace("\n", " ")
    if len(clean) <= max_chars:
        return clean
    return clean[: max_chars - 1].rstrip() + "..."


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return value or "item"
