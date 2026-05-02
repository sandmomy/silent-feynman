# .parking — work-in-progress patches not ready to ship

Each subfolder / file here is a snapshot of WIP that was sitting in
`git stash` and was extracted on **2026-05-02** so the day-to-day repo
could stay clean. Nothing here is live in production.

## wip-legal-compliance-pass-2026-04-13.patch

Adds Privacy / Terms / Legal links + cookie-notice script tag + accept-
terms checkbox on booking forms, across ~16 HTML pages of the main site
(eugenemierak.com).

- **Status:** never deployed (verified 2026-05-02 — `cookie-notice.js`
  returns 404 on the live main site).
- **Companion files** (the actual new pages + script the patch references)
  live in `wip-legal-files/`:
  - `wip-legal-files/js/cookie-notice.js`
  - `wip-legal-files/privacy.html`
  - `wip-legal-files/terms.html`
  - `wip-legal-files/legal.html`

To re-apply later when ready:

```bash
git apply .parking/wip-legal-compliance-pass-2026-04-13.patch
cp -r .parking/wip-legal-files/* .
```

May need conflict resolution because the underlying HTMLs have evolved
since the patch was generated (Listen nav link, Atranga partner, brand
mark, etc. were all added afterwards).

## wip-full-stash-snapshot-2026-05-02.patch

Full snapshot of the original `git stash` state (51 files, 13733 lines).
Includes everything: legal compliance pass + the BookVoice editorial
rewrite (now committed in `web/`) + the legacy `bookvoice/` Python
hardening (legacy code, deliberately discarded) + library_data PDFs +
misc configs. Kept as a safety net only — for normal use prefer the
focused legal-compliance patch above.
