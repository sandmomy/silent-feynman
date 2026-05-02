# BookVoice — Post-launch Monitoring Setup

Last updated 2026-04-17. Setup takes ~45 min total the first time.

## 1. Cloudflare Workers observability (already enabled)

`wrangler.jsonc` has `observability.enabled: true`. Logs retained 7 days on free plan.

### Configure alerts

Cloudflare dashboard → **Notifications → Add** → product "Workers":

- [ ] **Alert: Workers Usage** — notify when CPU time > 1000ms avg over 15min. Indicates a hot loop or slow query.
- [ ] **Alert: Workers Errors Threshold** — notify when unhandled exception rate > 5/min over 10min.
- [ ] Deliver to: `sandmomy@gmail.com`.

### Manually tail logs any time

```bash
cd "Desktop/bussines model/worker"
npx wrangler tail
```

Filter by status:
```bash
npx wrangler tail --status error
```

## 2. D1 metrics

Cloudflare dashboard → **Workers & Pages → D1 → bookvoice → Metrics**.

Watch:
- Row read / write rate (spikes suggest scanning instead of indexed queries).
- Storage size (free plan cap is 5GB total, alert at 2GB).
- Query duration p95 (>100ms suggests missing index).

Set a reminder in your calendar to eyeball this weekly for the first month.

## 3. Stripe webhook monitoring

Stripe dashboard → **Developers → Webhooks → `book.eugenemierak.com/api/stripe/webhook`**.

### Alerts to configure

Stripe dashboard → **Developers → Webhooks → ... → Edit → Alerts** (or go to **Settings → Email preferences**):

- [ ] Email when webhook delivery fails (5 consecutive).
- [ ] Email on payment_intent.payment_failed surge.

### Smoke-test monthly

Use Stripe's **Send test webhook** button to send a synthetic `checkout.session.completed`. Verify:
- Returns 200 from our endpoint.
- Replaying the same event returns `{received:true,duplicate:true}` (idempotency check).

## 4. External uptime monitor

Pick ONE free service. Recommended: **Better Stack** (formerly Better Uptime) free tier allows 10 monitors.

### Monitors to create

| Name | URL | Check interval | Expected |
|---|---|---|---|
| BookVoice home | `https://book.eugenemierak.com/` | 5 min | HTTP 200 |
| BookVoice API status | `https://book.eugenemierak.com/api/session/status` | 5 min | HTTP 200 + body contains `"google_enabled":true` |
| BookVoice privacy | `https://book.eugenemierak.com/privacy` | 1 hour | HTTP 200 |

Notify: email + optional SMS (paid). Free tier gives 3 monitors + email only, which is enough for the critical paths.

## 5. Play Store Vitals (built-in, no setup)

Play Console → **Quality → Android vitals** — Google automatically tracks:
- **Crashes / ANRs** — Google emails you if crashes exceed your peer benchmark.
- **Excessive wake-ups** / battery drain.
- **Slow rendering frames**.

### Thresholds to watch first week

- Crash rate <2% (if >2% Google sends a warning).
- ANR rate <0.47%.

If the app is in Closed Testing, these populate slowly (needs active users). Open Production = real signal.

## 6. EAS Build status

https://expo.dev/accounts/sandmomy1/projects/bookvoice/builds — bookmark.

Alerts: EAS sends email on build success/failure by default.

## 7. Mobile app crash reporting (TODO v6.2)

Currently BookVoice has NO crash reporter. Post-launch plan:

- [ ] Install `sentry-expo` (or the SDK 54-compatible `@sentry/react-native`).
- [ ] Create Sentry project at https://sentry.io (free tier = 5k events/month).
- [ ] Wrap root layout + capture unhandled promise rejections.
- [ ] Add Sentry Worker plugin for the backend too (`@sentry/cloudflare`).

This is deferred because we want Play Vitals baseline first (free, zero-config).

## 8. Weekly review cadence

Monday morning, 5 min check:

- [ ] Play Console Vitals — crash rate, ANR rate.
- [ ] Stripe dashboard — successful payments count vs last week, any disputes.
- [ ] Cloudflare dashboard — requests count, error rate, D1 storage.
- [ ] Uptime monitor — any incidents?
- [ ] `npx wrangler tail --status error --format pretty` — scan last 1000 error lines for new patterns.

Log findings in a `WEEKLY_REVIEW.md` at the repo root if you want a paper trail.
