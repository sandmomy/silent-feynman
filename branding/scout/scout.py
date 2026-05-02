"""
FV Exploration Radar — scan HuggingFace + GitHub for creative-content models &
repos that might fit Frequency Vibes / BookVoice / Eugene work, and filter
out the noise (LLMs, embeddings, robotics, chatbots).

Reads no auth by default. Set GITHUB_TOKEN env var to lift GitHub's anonymous
rate limit (60/h → 5000/h). HuggingFace API needs no auth for public models.

Usage: python scout.py            # full scan, opens radar.html in browser
       python scout.py --quiet    # no auto-open, just write the file
       python scout.py --quick    # smaller per-tag limit, faster scan

Output: radar.html in this folder.
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
OUT = HERE / "radar.html"
NOW = datetime.now(timezone.utc)
RECENT_DAYS = 90
USER_AGENT = "fv-scout/1.0 (https://github.com/sandmomy)"

# ── What we WANT — HF pipeline_tag filters ──────────────────────────────────
HF_TAGS = [
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

# ── GitHub topics — focus on creative content tooling ──────────────────────
GH_TOPICS = [
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

# ── Always-watched repos / models (curated) — surfaced even if outdated ────
WATCHLIST_HF = [
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
]
WATCHLIST_GH = [
    "comfyanonymous/ComfyUI",
    "Stability-AI/generative-models",
    "Lightricks/LTX-Video",
    "RVC-Boss/GPT-SoVITS",
    "fishaudio/fish-speech",
    "city96/ComfyUI-GGUF",
    "kijai/ComfyUI-WanVideoWrapper",
    "XLabs-AI/x-flux-comfyui",
]

# ── Drop signals — name/description substrings that mean "not for us" ─────
DROP_SIGNALS = [
    # LLM signals (substring on name or desc)
    "llama", "qwen", "mistral", "phi-3", "phi3", "gemma",
    "instruct", "chatbot", "rag-", " rag ", "agent", "tool-use",
    "conversational",
    # Robotics
    "robot", "gr00t", "dexcap", "manipulation", "humanoid", "isaac",
    # Embeddings / retrieval
    "embedding", "embed-", "rerank", "sentence-transformer",
    # Pure datasets (we want models)
    "dataset",
]


# ── HTTP helper ─────────────────────────────────────────────────────────────
def http_get(url: str, headers: dict | None = None, timeout: int = 20):
    req = Request(url, headers={**{"User-Agent": USER_AGENT}, **(headers or {})})
    with urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def days_since(iso: str | None) -> int:
    if not iso:
        return 9999
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return max(0, (NOW - dt).days)
    except Exception:
        return 9999


def has_drop_signal(text: str) -> bool:
    t = (text or "").lower()
    return any(sig in t for sig in DROP_SIGNALS)


# ── HuggingFace ─────────────────────────────────────────────────────────────
def hf_models_by_tag(tag: str, limit: int = 12) -> list[dict]:
    url = (
        f"https://huggingface.co/api/models?filter={quote(tag)}"
        f"&sort=downloads&direction=-1&limit={limit}"
    )
    try:
        data = http_get(url)
    except (HTTPError, URLError) as e:
        print(f"  [err] HF {tag}: {e}", file=sys.stderr)
        return []
    out = []
    for m in data:
        name = m.get("id", "")
        if has_drop_signal(name):
            continue
        out.append({
            "source": "HuggingFace",
            "name": name,
            "url": f"https://huggingface.co/{name}",
            "downloads": m.get("downloads", 0),
            "likes": m.get("likes", 0),
            "primary_tag": tag,
            "tags": [t for t in (m.get("tags") or []) if not t.startswith("license:")][:6],
            "last_modified": m.get("lastModified") or m.get("createdAt", ""),
            "days_ago": days_since(m.get("lastModified") or m.get("createdAt")),
        })
    return out


def hf_model_card(model_id: str) -> dict | None:
    try:
        return http_get(f"https://huggingface.co/api/models/{model_id}")
    except Exception:
        return None


# ── GitHub ──────────────────────────────────────────────────────────────────
def gh_headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    tok = os.environ.get("GITHUB_TOKEN")
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


def gh_repos_by_topic(topic: str, limit: int = 12) -> list[dict]:
    cutoff = (NOW - timedelta(days=RECENT_DAYS)).strftime("%Y-%m-%d")
    q = quote(f"topic:{topic} pushed:>{cutoff}")
    url = f"https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page={limit}"
    try:
        data = http_get(url, headers=gh_headers())
    except (HTTPError, URLError) as e:
        print(f"  [err] GH {topic}: {e}", file=sys.stderr)
        return []
    out = []
    for r in data.get("items") or []:
        full = r.get("full_name", "")
        desc = r.get("description") or ""
        if has_drop_signal(full) or has_drop_signal(desc):
            continue
        out.append({
            "source": "GitHub",
            "name": full,
            "url": r.get("html_url"),
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "primary_tag": topic,
            "tags": (r.get("topics") or [])[:6],
            "description": desc,
            "last_modified": r.get("pushed_at", ""),
            "days_ago": days_since(r.get("pushed_at")),
        })
    return out


def gh_repo_card(full_name: str) -> dict | None:
    try:
        return http_get(f"https://api.github.com/repos/{full_name}", headers=gh_headers())
    except Exception:
        return None


# ── Collect ─────────────────────────────────────────────────────────────────
def collect(per_tag_limit: int = 12) -> tuple[list[dict], list[dict]]:
    items: list[dict] = []
    seen: set[tuple[str, str]] = set()

    print(f"Scanning {len(HF_TAGS)} HF tags (limit {per_tag_limit}/each)...")
    for t in HF_TAGS:
        for m in hf_models_by_tag(t, limit=per_tag_limit):
            key = ("HF", m["name"].lower())
            if key in seen:
                continue
            seen.add(key)
            items.append(m)

    print(f"Scanning {len(GH_TOPICS)} GH topics (limit {per_tag_limit}/each)...")
    for t in GH_TOPICS:
        for r in gh_repos_by_topic(t, limit=per_tag_limit):
            key = ("GH", r["name"].lower())
            if key in seen:
                continue
            seen.add(key)
            items.append(r)

    print(f"\nFetching watchlist details ({len(WATCHLIST_HF)} HF + {len(WATCHLIST_GH)} GH)...")
    watch: list[dict] = []
    for mid in WATCHLIST_HF:
        d = hf_model_card(mid)
        if not d:
            continue
        watch.append({
            "source": "HuggingFace",
            "name": d.get("id", mid),
            "url": f"https://huggingface.co/{d.get('id', mid)}",
            "downloads": d.get("downloads", 0),
            "likes": d.get("likes", 0),
            "primary_tag": d.get("pipeline_tag") or "watchlist",
            "tags": [t for t in (d.get("tags") or []) if not t.startswith("license:")][:6],
            "last_modified": d.get("lastModified", ""),
            "days_ago": days_since(d.get("lastModified")),
        })
    for full in WATCHLIST_GH:
        d = gh_repo_card(full)
        if not d:
            continue
        watch.append({
            "source": "GitHub",
            "name": d.get("full_name", full),
            "url": d.get("html_url"),
            "stars": d.get("stargazers_count", 0),
            "forks": d.get("forks_count", 0),
            "primary_tag": "watchlist",
            "tags": (d.get("topics") or [])[:6],
            "description": d.get("description") or "",
            "last_modified": d.get("pushed_at", ""),
            "days_ago": days_since(d.get("pushed_at")),
        })

    return items, watch


# ── Render HTML ─────────────────────────────────────────────────────────────
def render_html(items: list[dict], watch: list[dict]) -> None:
    items.sort(
        key=lambda x: (
            x.get("days_ago", 9999),
            -(x.get("downloads", 0) + x.get("stars", 0) * 200 + x.get("likes", 0) * 50),
        )
    )
    watch.sort(key=lambda x: x.get("days_ago", 9999))

    def card_html(it: dict, is_watch: bool = False) -> str:
        if it["source"] == "HuggingFace":
            stat = f"⬇ {it.get('downloads', 0):,} · ❤ {it.get('likes', 0)}"
            src_class = "src-hf"
        else:
            stat = f"⭐ {it.get('stars', 0):,} · ⑂ {it.get('forks', 0)}"
            src_class = "src-gh"
        days = it.get("days_ago", 9999)
        recency_label = (
            "🟢 fresh" if days <= 14 else
            "🟡 recent" if days <= 60 else
            "🟠 quarter" if days <= 180 else
            "⚪ older"
        )
        recency_class = "fresh" if days <= 14 else "recent" if days <= 60 else "older"
        desc = (it.get("description") or " · ".join(it.get("tags", [])[:4]) or "—")[:180]
        days_label = f"{days}d ago" if days < 9999 else "—"
        primary = it.get("primary_tag", "")
        return f"""
        <a class="card" href="{it['url']}" target="_blank" rel="noopener" data-source="{it['source']}" data-recency="{recency_class}">
          <div class="row1">
            <span class="src {src_class}">{it['source']}</span>
            <span class="recency">{recency_label}</span>
            <span class="days">{days_label}</span>
          </div>
          <div class="name">{it['name']}</div>
          <div class="desc">{_esc(desc)}</div>
          <div class="row3">
            <span class="stat">{stat}</span>
            <span class="tag">#{_esc(primary)}</span>
          </div>
        </a>
        """

    cards = "\n".join(card_html(it) for it in items)
    watch_cards = "\n".join(card_html(it, is_watch=True) for it in watch)
    fresh_count = sum(1 for it in items if it.get("days_ago", 9999) <= 14)

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FV Exploration Radar — {len(items)} candidates</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg: #0c0a06;
      --panel: #14110a;
      --panel-2: #1a160e;
      --text: #f2e8cc;
      --dim: rgba(234, 224, 200, 0.55);
      --gold: #d4a866;
      --gold-soft: rgba(212, 168, 102, 0.10);
      --teal: #5e9089;
      --hf-yellow: #ffcf33;
      --line: rgba(212, 168, 102, 0.18);
      --shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
      --radius: 8px;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0; padding: 36px 28px 80px;
      background: var(--bg); color: var(--text);
      font-family: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
      font-size: 13px; line-height: 1.55;
    }}
    h1 {{
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 500; font-size: 36px; letter-spacing: -0.01em;
      margin: 0 0 6px; color: var(--gold);
    }}
    h2 {{
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 500; font-size: 18px;
      margin: 36px 0 14px; color: var(--text);
      border-bottom: 1px solid var(--line); padding-bottom: 8px;
    }}
    .meta {{ color: var(--dim); font-size: 11px; margin-bottom: 24px; }}
    .filters {{ display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }}
    .filter {{
      padding: 5px 12px; border-radius: 999px;
      background: var(--panel-2); border: 1px solid var(--line);
      cursor: pointer; font: 500 11px 'IBM Plex Mono', monospace;
      color: var(--dim);
      transition: color .15s, background .15s, border-color .15s;
    }}
    .filter:hover {{ color: var(--text); }}
    .filter.active {{ background: var(--gold); color: #1a1408; border-color: var(--gold); }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 14px;
    }}
    .card {{
      display: block; text-decoration: none; color: inherit;
      background: linear-gradient(180deg, var(--panel-2), var(--panel));
      border: 1px solid var(--line); border-radius: var(--radius);
      padding: 14px 16px;
      transition: transform .15s, border-color .15s, box-shadow .15s;
    }}
    .card:hover {{
      transform: translateY(-2px);
      border-color: var(--gold);
      box-shadow: var(--shadow);
    }}
    .row1 {{
      display: flex; gap: 10px; align-items: center;
      font-size: 10px; margin-bottom: 9px; letter-spacing: 0.02em;
    }}
    .src {{
      padding: 2px 7px; border-radius: 3px;
      font-weight: 600; font-size: 10px; letter-spacing: 0.06em;
    }}
    .src-hf {{ background: rgba(255, 207, 51, 0.15); color: var(--hf-yellow); }}
    .src-gh {{ background: rgba(94, 144, 137, 0.18); color: var(--teal); }}
    .recency {{ color: var(--dim); }}
    .days {{ color: var(--dim); margin-left: auto; font-variant-numeric: tabular-nums; }}
    .name {{
      font-family: 'Fraunces', serif; font-size: 16px; font-weight: 500;
      color: var(--text); margin-bottom: 7px; word-break: break-word;
      line-height: 1.25;
    }}
    .desc {{
      color: var(--dim); font-size: 11.5px; margin-bottom: 12px;
      min-height: 30px; line-height: 1.5;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    }}
    .row3 {{
      display: flex; justify-content: space-between; align-items: center;
      font-size: 10.5px; color: var(--dim);
    }}
    .stat {{ font-variant-numeric: tabular-nums; }}
    .tag {{ font-style: italic; opacity: 0.75; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
    .empty {{ color: var(--dim); font-style: italic; padding: 24px; text-align: center; }}
    @media (max-width: 600px) {{
      body {{ padding: 24px 16px 60px; }}
      h1 {{ font-size: 28px; }}
      .grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <h1>FV Exploration Radar</h1>
  <div class="meta">
    {len(items)} candidates · {fresh_count} fresh (≤14d) ·
    scanned {NOW.strftime('%Y-%m-%d %H:%M UTC')} ·
    sources: 🤗 HuggingFace + ⭐ GitHub ·
    sorted by recency × popularity
  </div>

  <div class="filters">
    <button class="filter active" data-filter="all">all</button>
    <button class="filter" data-filter="HuggingFace">🤗 HF only</button>
    <button class="filter" data-filter="GitHub">⭐ GH only</button>
    <button class="filter" data-filter="fresh">🟢 fresh (≤14d)</button>
    <button class="filter" data-filter="recent">🟡 recent (≤60d)</button>
  </div>

  <h2>📡 Trending — discovered this scan</h2>
  <div class="grid" id="grid-discover">
    {cards or '<div class="empty">No items collected. Check network or HF/GH API rate limits.</div>'}
  </div>

  <h2>👁 Watchlist — pinned references</h2>
  <div class="grid" id="grid-watch">
    {watch_cards or '<div class="empty">Watchlist API calls failed. Check network.</div>'}
  </div>

  <script>
    const allCards = document.querySelectorAll('.card');
    document.querySelectorAll('.filter').forEach(btn => {{
      btn.addEventListener('click', () => {{
        document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        allCards.forEach(c => {{
          let show = (f === 'all');
          if (f === 'HuggingFace' || f === 'GitHub') show = c.dataset.source === f;
          if (f === 'fresh') show = c.dataset.recency === 'fresh';
          if (f === 'recent') show = c.dataset.recency === 'fresh' || c.dataset.recency === 'recent';
          c.style.display = show ? 'block' : 'none';
        }});
      }});
    }});
  </script>
</body>
</html>
"""
    OUT.write_text(html, encoding="utf-8")


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ── Entry ───────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quiet", action="store_true", help="Don't auto-open the result in browser")
    ap.add_argument("--quick", action="store_true", help="Smaller per-tag limit (faster scan, fewer results)")
    args = ap.parse_args()

    limit = 6 if args.quick else 12
    items, watch = collect(per_tag_limit=limit)
    if not items and not watch:
        print("\nNo data collected. Possibly rate-limited or offline.", file=sys.stderr)
        return 1

    render_html(items, watch)
    print(f"\n[ok] {OUT.name} -- {len(items)} discovered + {len(watch)} watchlist")

    if not args.quiet:
        try:
            os.startfile(str(OUT))  # Windows-only; on other OSes just print path
        except AttributeError:
            print(f"  open: file:///{OUT.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
