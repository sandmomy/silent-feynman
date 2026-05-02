# BookVoice — Incident Runbook

Last updated 2026-04-17. For `book.eugenemierak.com` + Android app `com.eugenemierak.bookvoice`.

## 0. Emergency contacts & access

- **Cloudflare dashboard**: `zakirsternik3c@gmail.com` account, `bookvoice` worker in zone `eugenemierak.com`.
- **Stripe dashboard**: https://dashboard.stripe.com (live mode active, `sk_live_*`).
- **Play Console**: `sandmomy1` owner.
- **EAS**: https://expo.dev/accounts/sandmomy1/projects/bookvoice.
- **Google Cloud OAuth**: project prefix `876735034127`.

## 1. Worker is throwing 500s (site down / API errors)

### Diagnose

```bash
cd "Desktop/bussines model/worker"
npx wrangler tail
```
Tails live logs. Look for uncaught errors, binding failures, secret references.

### Quick rollback to previous version

Cloudflare dashboard → Workers & Pages → bookvoice → **Deployments** → previous version → **Rollback**.

Or via CLI:
```bash
npx wrangler rollback
```

### If rollback is not enough — enable maintenance

Temporary hard stop:
```bash
# Comment out the router match and return a 503 in src/index.js, then:
npx wrangler deploy
```

## 2. `SESSION_SECRET` suspected compromised

### Rotate now

```bash
cd "Desktop/bussines model/worker"
openssl rand -hex 32      # copy output
npx wrangler secret put SESSION_SECRET   # paste when prompted
```

**Consequence**: every existing session becomes invalid immediately. Every user (including you) will be forced to sign in again. This is intended.

### Post-rotation

- Announce in-app via a server-side banner (edit `web/customer.html` "auth_error" flow to show a notice).
- Monitor sign-in rate for the next 1h — should spike then stabilize.

## 3. Stripe webhook failing / missing purchases

### Symptoms

User paid in Stripe but book not unlocked.

### Diagnose

1. Stripe dashboard → Developers → **Webhooks → bookvoice endpoint → Logs**.
2. Look for non-200 responses. Common: 400 "Invalid signature" or 500 from our side.

### Replay a failed event

Stripe dashboard → Webhooks → the failing event → **Resend**.

BookVoice worker has idempotency (`stripe_events` table since v6.1), so replays are safe — duplicates return `{received:true,duplicate:true}`.

### Manually grant a book while investigating

```bash
cd "Desktop/bussines model/worker"
npx wrangler d1 execute bookvoice --remote \
  --command "INSERT OR IGNORE INTO user_books (username, book_id, granted_at) VALUES ('<username>', '<book_id>', datetime('now'))"
```

### Rotate `STRIPE_WEBHOOK_SECRET` if suspected leaked

```bash
# In Stripe dashboard → Developers → Webhooks → endpoint → Reveal signing secret → Roll
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## 4. Google OAuth broken (users can't sign in with Google)

### Diagnose

```bash
curl -s https://book.eugenemierak.com/api/session/status
# If "google_enabled":false → GOOGLE_CLIENT_ID/SECRET missing on worker
```

Mobile app errors to watch: `id_token_invalid`, `audience_mismatch`, `bad_signature`, `token_expired`.

### Common fixes

| Symptom | Fix |
|---|---|
| `audience_mismatch` on all mobile sign-ins | Android OAuth Client ID in Google Cloud was deleted or the SHA-1 was removed. Re-check in Google Cloud Console → Credentials. |
| `bad_signature` intermittent | JWKS cache stale; resolves itself within 6h. Force: `npx wrangler deploy` (new isolate = empty cache). |
| Web login redirects to error | `GOOGLE_CLIENT_SECRET` expired/regenerated. Update: `npx wrangler secret put GOOGLE_CLIENT_SECRET`. |

## 5. D1 database corruption / accidental wipe

BookVoice has TWO backup mechanisms:

### A. Cloudflare D1 Time Travel (automatic, 30-day window)

Every D1 database automatically has 30 days of point-in-time recovery. No setup needed.

```bash
cd "Desktop/bussines model/worker"

# See last bookmark (most recent restore point):
npx wrangler d1 time-travel info bookvoice --remote

# Restore to a specific timestamp (ISO 8601):
npx wrangler d1 time-travel restore bookvoice --remote --timestamp "2026-04-10T12:00:00Z"

# Or restore to a specific bookmark id:
npx wrangler d1 time-travel restore bookvoice --remote --bookmark <bookmark-id>
```

Restore creates a NEW point in time — you can still go back further by restoring again.

### B. Weekly R2 backup (cron-triggered, 12-week retention)

Worker has a scheduled handler that runs every **Sunday 03:00 UTC** and dumps all D1 tables to `bookvoice-assets/backups/d1-<timestamp>.sql`. Keeps last 12 backups (~3 months).

### Trigger a backup manually (admin-only)

```bash
# Login to get admin cookie, then:
curl -X POST https://book.eugenemierak.com/api/admin/backup \
  -H "Cookie: bookvoice_session=<your_admin_session>"
# Returns: { ok: true, key: "backups/d1-<stamp>.sql", size: <bytes>, tableCount: 6 }
```

### List R2 backups

```bash
npx wrangler r2 object list bookvoice-assets --prefix "backups/d1-"
```

### Restore from R2 backup

```bash
# Download the backup:
npx wrangler r2 object get bookvoice-assets/backups/d1-YYYY-MM-DDTHH-MM-SS.sql \
  --remote --file restore.sql

# Apply (this drops tables + re-inserts — destructive):
npx wrangler d1 execute bookvoice --remote --file restore.sql
```

### Best practice

- For accidental deletes in the last 30 days → use **Time Travel** (faster, no data loss between last backup and the incident).
- For data older than 30 days → use **R2 backup**.
- For preview/testing: download an R2 backup, apply to a local dev D1, experiment there.

### Recover specific row (if someone accidentally revoked a purchase)

If the user paid via Stripe, grep Stripe's checkout sessions:
```bash
curl -s https://api.stripe.com/v1/checkout/sessions?limit=100 \
  -u "$STRIPE_SECRET_KEY:" | jq '.data[] | select(.metadata.username=="<username>")'
```
Then manually re-grant (see section 3).

## 6. R2 asset missing (book audio/PDF/slides not loading)

### Check what's there

```bash
cd "Desktop/bussines model/worker"
npx wrangler r2 object list bookvoice-assets --prefix "books/"
```

### Re-upload a missing file

```bash
npx wrangler r2 object put "bookvoice-assets/books/<book_id>/audio.mp3" \
  --file "./path/to/audio.mp3" --content-type "audio/mpeg" --remote
```

Note: use `--remote` always (no local dev bucket). Key path matters — it must match what the Worker looks up in `api.js`.

## 7. Admin locked out

If Eugene's admin password is lost or compromised:

```bash
cd "Desktop/bussines model/worker"
npx wrangler secret put ADMIN_PASSWORD
# enter new plaintext password
```

ADMIN_PASSWORD is compared with plaintext equality in `api.js:142`, no hash. Session tokens issued under the old password remain valid until expiry (unless you also rotate `SESSION_SECRET`).

## 8. Play Store — app pulled / suspension

1. Do NOT panic-re-submit. Read the email from Google carefully.
2. Fix the specific policy issue named.
3. **Appeal** in Play Console (there is an Appeal button next to the rejection notice).
4. If users are mid-session and can't reach new purchases: Stripe flow still works via `book.eugenemierak.com` — communicate the web URL as fallback.

## 9. Mobile app — crash spike post-release

### Halt rollout

Play Console → Release → Production → current release → **Halt rollout**.

### Look at crash stacks

Play Console → Quality → Vitals → Crashes and ANRs → sort by occurrences.

### Ship hotfix

```bash
cd "Desktop/bussines model/mobile"
# fix code
git commit -m "hotfix v6.1: ..."
npx eas-cli build --profile production --platform android
# wait, upload AAB, create new Production release, roll out at 20% again
```

## 10. Rotate ALL secrets (post-incident nuclear option)

```bash
cd "Desktop/bussines model/worker"
# 1. Session signing
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET

# 2. Admin password (already plaintext — just change it)
npx wrangler secret put ADMIN_PASSWORD

# 3. Stripe webhook (roll in Stripe dashboard first, then:)
npx wrangler secret put STRIPE_WEBHOOK_SECRET

# 4. Google OAuth secret (create new secret in Google Cloud Console, then:)
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Takes ~5 min total. All active sessions invalidated. All users must re-sign-in.
