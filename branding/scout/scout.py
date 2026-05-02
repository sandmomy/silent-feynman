"""
FV Exploration Radar — scout library + CLI.

Usable as:
  - Library:  from scout import search_hf, search_gh, get_watchlist, ...
  - CLI:      python scout.py            # one-shot scan, write radar.html
              python scout.py --quick    # smaller per-tag limit
              python scout.py --quiet    # don't auto-open browser

For an interactive UI with live search + watchlist persistence, run
`python server.py` instead (or double-click start.bat) — that boots an
HTTP server on :8767 backed by this same module.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

HERE = Path(__file__).parent.resolve()
WATCHLIST_FILE = HERE / "watchlist.json"
USER_AGENT = "fv-scout/2.0 (https://github.com/sandmomy)"

# ── HF pipeline tags we care about ─────────────────────────────────────────
HF_TAGS_DEFAULT = [
    "text-to-video",
    "image-to-video",
    "text-to-image",
    "image-to-image",
    "video-to-video",
    "text-to-audio",
    "audio-to-audio",
    "automatic-speech-recognition",
    "text-to-speech",
]

# ── GitHub topics ──────────────────────────────────────────────────────────
GH_TOPICS_DEFAULT = [
    "text-to-video",
    "image-to-video",
    "video-generation",
    "stable-diffusion",
    "comfyui",
    "comfyui-nodes",
    "diffusion-models",
    "text-to-speech",
    "voice-cloning",
    "ai-video",
]

# ── Drop signals ───────────────────────────────────────────────────────────
DROP_SIGNALS = [
    "llama", "qwen", "mistral", "phi-3", "phi3", "gemma",
    "instruct", "chatbot", "rag-", " rag ", "agent", "tool-use",
    "conversational",
    "robot", "gr00t", "dexcap", "manipulation", "humanoid", "isaac",
    "embedding", "embed-", "rerank", "sentence-transformer",
    "dataset",
]

# ── Default watchlist seed (only used if watchlist.json doesn't exist) ─────
WATCHLIST_SEED = {
    "huggingface": [
        "Wan-AI/Wan2.1-I2V-14B-480P",
        "black-forest-labs/FLUX.1-dev",
        "black-forest-labs/FLUX.1-Redux-dev",
        "nvidia/Cosmos-Predict2.5-2B",
        "nvidia/parakeet-tdt-0.6b-v2",
        "Lightricks/LTX-Video",
        "tencent/HunyuanVideo",
        "genmo/mochi-1-preview",
        "stabilityai/stable-video-diffusion-img2vid-xt-1-1",
        "bosonai/higgs-audio-v2-generation-3B-base",
    ],
    "github": [
        "comfyanonymous/ComfyUI",
        "Stability-AI/generative-models",
        "Lightricks/LTX-Video",
        "RVC-Boss/GPT-SoVITS",
        "fishaudio/fish-speech",
        "city96/ComfyUI-GGUF",
        "kijai/ComfyUI-WanVideoWrapper",
        "XLabs-AI/x-flux-comfyui",
    ],
}

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731 — fresh "now" per call


# ── HTTP ────────────────────────────────────────────────────────────────────
def http_get(url: str, headers: dict | None = None, timeout: int = 20):
    req = Request(url, headers={**{"User-Agent": USER_AGENT}, **(headers or {})})
    with urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def gh_headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    tok = os.environ.get("GITHUB_TOKEN")
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


def days_since(iso: str | None) -> int:
    if not iso:
        return 9999
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return max(0, (NOW() - dt).days)
    except Exception:
        return 9999


def has_drop_signal(text: str) -> bool:
    t = (text or "").lower()
    return any(sig in t for sig in DROP_SIGNALS)


# ── Search ──────────────────────────────────────────────────────────────────
def search_hf(
    query: str | None = None,
    tag: str | None = None,
    sort: str = "downloads",
    limit: int = 20,
    apply_drop_filter: bool = True,
) -> list[dict]:
    """Query HF model search.
    - query: free-text search across model names
    - tag: pipeline_tag filter (e.g. 'text-to-video')
    - sort: 'downloads' | 'likes' | 'lastModified' | 'createdAt'
    """
    parts = [f"sort={sort}", "direction=-1", f"limit={limit}"]
    if query:
        parts.append(f"search={quote(query)}")
    if tag:
        parts.append(f"filter={quote(tag)}")
    url = f"https://huggingface.co/api/models?{'&'.join(parts)}"
    try:
        data = http_get(url)
    except (HTTPError, URLError) as e:
        return [{"_error": f"HF: {e}"}]
    out = []
    for m in data:
        name = m.get("id", "")
        if apply_drop_filter and has_drop_signal(name):
            continue
        out.append(_normalize_hf(m, primary_tag=tag or m.get("pipeline_tag") or "search"))
    return out


def search_gh(
    query: str | None = None,
    topic: str | None = None,
    pushed_within_days: int = 90,
    sort: str = "stars",
    limit: int = 20,
    apply_drop_filter: bool = True,
) -> list[dict]:
    """Query GitHub repo search."""
    qparts = []
    if query:
        qparts.append(query)
    if topic:
        qparts.append(f"topic:{topic}")
    if pushed_within_days and pushed_within_days > 0:
        cutoff = (NOW() - timedelta(days=pushed_within_days)).strftime("%Y-%m-%d")
        qparts.append(f"pushed:>{cutoff}")
    if not qparts:
        qparts.append("topic:diffusion-models")  # fallback so the query isn't empty
    q = quote(" ".join(qparts))
    url = f"https://api.github.com/search/repositories?q={q}&sort={sort}&order=desc&per_page={limit}"
    try:
        data = http_get(url, headers=gh_headers())
    except (HTTPError, URLError) as e:
        return [{"_error": f"GH: {e}"}]
    out = []
    for r in data.get("items") or []:
        full = r.get("full_name", "")
        desc = r.get("description") or ""
        if apply_drop_filter and (has_drop_signal(full) or has_drop_signal(desc)):
            continue
        out.append(_normalize_gh(r, primary_tag=topic or (query or "search")))
    return out


# ── Normalizers ─────────────────────────────────────────────────────────────
def _normalize_hf(m: dict, primary_tag: str = "") -> dict:
    return {
        "source": "HuggingFace",
        "name": m.get("id", ""),
        "url": f"https://huggingface.co/{m.get('id', '')}",
        "downloads": m.get("downloads", 0),
        "likes": m.get("likes", 0),
        "primary_tag": primary_tag,
        "tags": [t for t in (m.get("tags") or []) if not t.startswith("license:")][:6],
        "last_modified": m.get("lastModified") or m.get("createdAt", ""),
        "days_ago": days_since(m.get("lastModified") or m.get("createdAt")),
        "description": m.get("pipeline_tag", ""),
    }


def _normalize_gh(r: dict, primary_tag: str = "") -> dict:
    return {
        "source": "GitHub",
        "name": r.get("full_name", ""),
        "url": r.get("html_url"),
        "stars": r.get("stargazers_count", 0),
        "forks": r.get("forks_count", 0),
        "primary_tag": primary_tag,
        "tags": (r.get("topics") or [])[:6],
        "description": r.get("description") or "",
        "last_modified": r.get("pushed_at", ""),
        "days_ago": days_since(r.get("pushed_at")),
        "language": r.get("language") or "",
    }


# ── Fetch single item by id (for watchlist resolution) ─────────────────────
def hf_model_card(model_id: str) -> dict | None:
    try:
        return http_get(f"https://huggingface.co/api/models/{model_id}")
    except Exception:
        return None


def gh_repo_card(full_name: str) -> dict | None:
    try:
        return http_get(f"https://api.github.com/repos/{full_name}", headers=gh_headers())
    except Exception:
        return None


def resolve_watchlist_items(wl: dict) -> list[dict]:
    items: list[dict] = []
    for mid in wl.get("huggingface", []):
        d = hf_model_card(mid)
        if d:
            items.append(_normalize_hf(d, primary_tag="watchlist"))
    for full in wl.get("github", []):
        d = gh_repo_card(full)
        if d:
            items.append(_normalize_gh(d, primary_tag="watchlist"))
    return items


# ── Watchlist persistence ───────────────────────────────────────────────────
def get_watchlist() -> dict:
    if not WATCHLIST_FILE.is_file():
        save_watchlist(WATCHLIST_SEED)
        return WATCHLIST_SEED.copy()
    try:
        return json.loads(WATCHLIST_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"huggingface": [], "github": []}


def save_watchlist(wl: dict) -> None:
    WATCHLIST_FILE.write_text(json.dumps(wl, indent=2, ensure_ascii=False), encoding="utf-8")


def add_to_watchlist(source: str, name: str) -> dict:
    wl = get_watchlist()
    key = "huggingface" if source.lower() in ("huggingface", "hf") else "github"
    if name not in wl.get(key, []):
        wl.setdefault(key, []).append(name)
        save_watchlist(wl)
    return wl


def remove_from_watchlist(source: str, name: str) -> dict:
    wl = get_watchlist()
    key = "huggingface" if source.lower() in ("huggingface", "hf") else "github"
    if name in wl.get(key, []):
        wl[key].remove(name)
        save_watchlist(wl)
    return wl


# ── One-shot scan (used by CLI mode and as a default for the server) ──────
def collect_trending(per_tag_limit: int = 12, hf_tags=None, gh_topics=None) -> list[dict]:
    items: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for t in (hf_tags or HF_TAGS_DEFAULT):
        for m in search_hf(tag=t, limit=per_tag_limit):
            if "_error" in m:
                continue
            key = ("HF", m["name"].lower())
            if key in seen:
                continue
            seen.add(key)
            items.append(m)
    for t in (gh_topics or GH_TOPICS_DEFAULT):
        for r in search_gh(topic=t, limit=per_tag_limit):
            if "_error" in r:
                continue
            key = ("GH", r["name"].lower())
            if key in seen:
                continue
            seen.add(key)
            items.append(r)
    items.sort(
        key=lambda x: (
            x.get("days_ago", 9999),
            -(x.get("downloads", 0) + x.get("stars", 0) * 200 + x.get("likes", 0) * 50),
        )
    )
    return items


# ── CLI mode (writes static radar.html, kept for backward compat) ─────────
def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_static_html(items: list[dict], watch: list[dict], out_path: Path) -> None:
    """Write a self-contained radar.html (no server required to view).
    For the interactive version, use `server.py` instead."""

    def card_html(it: dict) -> str:
        if it["source"] == "HuggingFace":
            stat = f"⬇ {it.get('downloads', 0):,} · ❤ {it.get('likes', 0)}"
            src_class = "src-hf"
        else:
            stat = f"⭐ {it.get('stars', 0):,} · ⑂ {it.get('forks', 0)}"
            src_class = "src-gh"
        days = it.get("days_ago", 9999)
        recency = "🟢 fresh" if days <= 14 else "🟡 recent" if days <= 60 else "⚪ older"
        rclass = "fresh" if days <= 14 else "recent" if days <= 60 else "older"
        desc = (it.get("description") or " · ".join(it.get("tags", [])[:4]) or "—")[:180]
        return f"""<a class="card" href="{it['url']}" target="_blank" rel="noopener" data-source="{it['source']}" data-recency="{rclass}">
          <div class="row1"><span class="src {src_class}">{it['source']}</span><span class="recency">{recency}</span><span class="days">{days}d ago</span></div>
          <div class="name">{_esc(it['name'])}</div>
          <div class="desc">{_esc(desc)}</div>
          <div class="row3"><span class="stat">{stat}</span><span class="tag">#{_esc(it.get('primary_tag', ''))}</span></div>
        </a>"""

    cards = "\n".join(card_html(it) for it in items)
    watch_cards = "\n".join(card_html(it) for it in watch)
    fresh = sum(1 for it in items if it.get("days_ago", 9999) <= 14)
    ts = NOW().strftime("%Y-%m-%d %H:%M UTC")

    out_path.write_text(
        f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FV Radar (static) — {len(items)} candidates</title>
<style>{_STATIC_CSS}</style></head><body>
<h1>FV Exploration Radar (static)</h1>
<div class="meta">{len(items)} candidates · {fresh} fresh · scanned {ts} · for live search use <code>server.py</code></div>
<h2>📡 Trending</h2><div class="grid">{cards or '<div class="empty">no items</div>'}</div>
<h2>👁 Watchlist</h2><div class="grid">{watch_cards or '<div class="empty">no items</div>'}</div>
</body></html>""",
        encoding="utf-8",
    )


_STATIC_CSS = """
:root{--bg:#0c0a06;--panel:#14110a;--panel-2:#1a160e;--text:#f2e8cc;--dim:rgba(234,224,200,.55);--gold:#d4a866;--teal:#5e9089;--hf:#ffcf33;--line:rgba(212,168,102,.18)}
*{box-sizing:border-box}body{margin:0;padding:36px 28px 80px;background:var(--bg);color:var(--text);font:13px/1.55 'IBM Plex Mono',monospace}
h1{font:500 36px 'Fraunces',serif;color:var(--gold);margin:0 0 6px}h2{font:500 18px 'Fraunces',serif;margin:36px 0 14px;border-bottom:1px solid var(--line);padding-bottom:8px}
.meta{color:var(--dim);font-size:11px;margin-bottom:24px}.meta code{background:var(--panel-2);padding:2px 6px;border-radius:3px;color:var(--gold)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.card{display:block;text-decoration:none;color:inherit;background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--line);border-radius:8px;padding:14px 16px;transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:var(--gold)}
.row1{display:flex;gap:10px;font-size:10px;margin-bottom:9px;align-items:center}.src{padding:2px 7px;border-radius:3px;font-weight:600;letter-spacing:.06em}.src-hf{background:rgba(255,207,51,.15);color:var(--hf)}.src-gh{background:rgba(94,144,137,.18);color:var(--teal)}
.recency{color:var(--dim)}.days{color:var(--dim);margin-left:auto;font-variant-numeric:tabular-nums}
.name{font:500 16px/1.25 'Fraunces',serif;color:var(--text);margin-bottom:7px;word-break:break-word}
.desc{color:var(--dim);font-size:11.5px;margin-bottom:12px;min-height:30px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.row3{display:flex;justify-content:space-between;font-size:10.5px;color:var(--dim)}.tag{font-style:italic;opacity:.75}
.empty{color:var(--dim);font-style:italic;padding:24px;text-align:center}
"""


def main() -> int:
    ap = argparse.ArgumentParser(description="FV Exploration Radar (CLI mode)")
    ap.add_argument("--quiet", action="store_true", help="Don't auto-open the browser")
    ap.add_argument("--quick", action="store_true", help="Smaller per-tag limit")
    args = ap.parse_args()

    limit = 6 if args.quick else 12
    print(f"Scanning trending (limit {limit}/tag)...")
    items = collect_trending(per_tag_limit=limit)
    print(f"  -> {len(items)} discovered")
    print("Resolving watchlist...")
    watch = resolve_watchlist_items(get_watchlist())
    print(f"  -> {len(watch)} watchlist items")

    out = HERE / "radar.html"
    render_static_html(items, watch, out)
    print(f"\n[ok] {out.name} -- {len(items)} discovered + {len(watch)} watchlist")

    if not args.quiet:
        try:
            os.startfile(str(out))  # Windows
        except AttributeError:
            print(f"  open: file:///{out.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
