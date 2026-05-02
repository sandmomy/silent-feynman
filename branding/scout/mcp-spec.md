# Scout MCP integration — spec (Phase 2, not implemented yet)

The current scout works as: HTTP server on `:8767` exposes scan / search /
watchlist as JSON, the HTML calls it. That covers the "I want to search and
save manually" loop.

The next step is making the same operations callable by an LLM (Claude in our
case). That way you can type a natural-language brief like:

> "find me i2v models released this month that fit 16GB VRAM and have GGUF
> quants on Hugging Face, save the top 3 to my watchlist"

and Claude will issue the right tool calls, score the results, and update the
watchlist. The current REST API is fine for a person; an LLM needs a thin MCP
wrapper so the calls are discoverable and self-describing.

## Tools to expose

| MCP tool | Maps to |
|---|---|
| `scout.search_huggingface(query, tag?, sort?, limit?)` | `scout.search_hf` |
| `scout.search_github(query, topic?, pushed_within_days?, limit?)` | `scout.search_gh` |
| `scout.get_watchlist()` | `scout.get_watchlist` + `scout.resolve_watchlist_items` |
| `scout.add_to_watchlist(source, name, reason?)` | `scout.add_to_watchlist` (+ optional `reason` stored alongside) |
| `scout.remove_from_watchlist(source, name)` | `scout.remove_from_watchlist` |
| `scout.fetch_model_card(source, name)` | `scout.hf_model_card` / `scout.gh_repo_card` (full details for ranking) |

## Implementation sketch

`branding/scout/mcp_server.py` would:

1. Use the official `mcp` Python SDK (`pip install mcp`).
2. Register the tools listed above as `@server.list_tools()` / `@server.call_tool()`.
3. Internally call the same functions in `scout.py` — no duplication.
4. Return JSON results in the MCP `TextContent` format.

Then register it in Claude Code's `~/.claude/settings.json` under
`mcpServers`:

```json
{
  "mcpServers": {
    "fv-scout": {
      "command": "python",
      "args": ["-X", "utf8", "C:/Users/Usuario/Desktop/bussines model/branding/scout/mcp_server.py"]
    }
  }
}
```

After that, in any Claude conversation, the tools `scout.search_huggingface`
etc. become callable by Claude directly.

## Why not now

- Adds a dependency (`mcp` SDK) and a new process management story.
- The HTTP server already covers 90% of the value (live search + persistent
  watchlist + UI).
- An LLM can be reasoned with via the HTTP API too: a future custom GPT or
  agent can hit `http://127.0.0.1:8767/api/search` directly without MCP.

Re-evaluate when:
- You want to query the radar from inside a Claude Code conversation
  ("what i2v released this week that fits my 5080?") and have Claude run the
  search + save + report loop end-to-end.
- Or when you build a second MCP server for another tool — bundling makes
  sense.
