"""
FV Exploration Radar — interactive HTTP server.

Serves the index.html UI and exposes scout.py as a JSON API:
  GET  /                                   → index.html
  GET  /api/trending?limit=12              → default scan (HF tags + GH topics)
  GET  /api/search?q=...&source=hf|gh|both → live search
  GET  /api/watchlist                      → resolve current watchlist via APIs
  POST /api/watchlist/add                  → body {source, name}
  POST /api/watchlist/remove               → body {source, name}
  GET  /api/health                         → ok + watchlist count

Run: python server.py    (or double-click start.bat)
Port: 8767 (next to reels controller's 8766)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import scout

PORT = 8767
HERE = Path(__file__).parent.resolve()
INDEX_HTML = HERE / "index.html"


class Handler(BaseHTTPRequestHandler):
    # Reduce noise — only log API calls, not every static file
    def log_message(self, fmt, *args):  # noqa: N802
        if "/api/" in fmt % args or "ERR" in fmt % args:
            sys.stderr.write(f"[scout] {self.address_string()} {fmt % args}\n")

    # ── helpers ──────────────────────────────────────────────────────────
    def _json(self, code: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _bad(self, code: int, msg: str):
        self._json(code, {"error": msg})

    def _read_body(self) -> bytes:
        n = int(self.headers.get("Content-Length", "0") or "0")
        return self.rfile.read(n) if n else b""

    def _read_json(self) -> dict:
        raw = self._read_body()
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as e:
            raise ValueError(f"invalid JSON body: {e}")

    def _serve_file(self, path: Path, mime: str = "text/html; charset=utf-8"):
        if not path.is_file():
            self.send_error(404, f"not found: {path.name}")
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    # ── routes ───────────────────────────────────────────────────────────
    def do_GET(self):  # noqa: N802
        url = urllib.parse.urlparse(self.path)
        path = url.path
        qs = urllib.parse.parse_qs(url.query)

        try:
            if path in ("/", "/index.html"):
                return self._serve_file(INDEX_HTML)
            if path == "/api/health":
                return self._json(200, {
                    "ok": True,
                    "watchlist_size": (
                        len(scout.get_watchlist().get("huggingface", []))
                        + len(scout.get_watchlist().get("github", []))
                    ),
                })

            if path == "/api/trending":
                limit = int((qs.get("limit") or [12])[0])
                items = scout.collect_trending(per_tag_limit=max(3, min(limit, 30)))
                return self._json(200, {"items": items, "count": len(items)})

            if path == "/api/search":
                q = (qs.get("q") or [""])[0].strip()
                source = (qs.get("source") or ["both"])[0].lower()
                tag = (qs.get("tag") or [None])[0]
                limit = int((qs.get("limit") or [25])[0])
                limit = max(1, min(limit, 50))
                items: list[dict] = []
                if source in ("hf", "huggingface", "both"):
                    items += scout.search_hf(query=q or None, tag=tag, limit=limit)
                if source in ("gh", "github", "both"):
                    items += scout.search_gh(query=q or None, topic=tag, limit=limit)
                # Drop error markers, sort by recency × popularity
                items = [i for i in items if "_error" not in i]
                items.sort(
                    key=lambda x: (
                        x.get("days_ago", 9999),
                        -(x.get("downloads", 0) + x.get("stars", 0) * 200),
                    )
                )
                return self._json(200, {
                    "items": items,
                    "count": len(items),
                    "query": q,
                    "source": source,
                    "tag": tag,
                })

            if path == "/api/watchlist":
                wl = scout.get_watchlist()
                items = scout.resolve_watchlist_items(wl)
                return self._json(200, {"watchlist": wl, "items": items, "count": len(items)})

            self.send_error(404, f"unknown path: {path}")

        except Exception as e:
            self._bad(500, f"{type(e).__name__}: {e}")

    def do_POST(self):  # noqa: N802
        url = urllib.parse.urlparse(self.path)
        path = url.path
        try:
            if path == "/api/watchlist/add":
                data = self._read_json()
                src = data.get("source", "")
                name = data.get("name", "")
                if not src or not name:
                    return self._bad(400, "source and name required")
                wl = scout.add_to_watchlist(src, name)
                return self._json(200, {"ok": True, "watchlist": wl})

            if path == "/api/watchlist/remove":
                data = self._read_json()
                src = data.get("source", "")
                name = data.get("name", "")
                if not src or not name:
                    return self._bad(400, "source and name required")
                wl = scout.remove_from_watchlist(src, name)
                return self._json(200, {"ok": True, "watchlist": wl})

            self.send_error(404, f"unknown path: {path}")
        except ValueError as e:
            self._bad(400, str(e))
        except Exception as e:
            self._bad(500, f"{type(e).__name__}: {e}")


def main() -> int:
    if not INDEX_HTML.is_file():
        print(f"[scout] missing index.html at {INDEX_HTML}", file=sys.stderr)
        return 1
    print("=" * 60)
    print(f"  FV Exploration Radar -- http://127.0.0.1:{PORT}")
    print(f"  watchlist: {scout.WATCHLIST_FILE}")
    print(f"  GitHub auth: {'token (' + ('5000/h' if os.environ.get('GITHUB_TOKEN') else '60/h') + ')'}")
    print("=" * 60)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    if os.environ.get("SCOUT_NO_OPEN") != "1":
        try:
            webbrowser.open(f"http://127.0.0.1:{PORT}")
        except Exception:
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
    return 0


if __name__ == "__main__":
    sys.exit(main())
