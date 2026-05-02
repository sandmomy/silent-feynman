# BookVoice — Sentry Setup

## Status
- **Worker**: `@sentry/cloudflare` installed, wrapper deployed (Worker version `54fd1f74`). **No-op until `SENTRY_DSN` secret is set.**
- **Mobile**: will be integrated in v6.2 build (bundled with nonce + signed URLs work).

## Step 1 — Create Sentry account (2 min)

1. Go to https://sentry.io/signup (free tier = 5k events/month, plenty for BookVoice scale)
2. Sign up with `sandmomy@gmail.com`
3. Create org: `BookVoice` (or `Eugene Mierak`)

## Step 2 — Create two projects

In Sentry → **Projects → Create Project**:

- **Project 1**: name `bookvoice-worker`, platform `Node.js → Cloudflare Workers`
- **Project 2**: name `bookvoice-mobile`, platform `React Native`

Each gives you a **DSN** (URL like `https://abc123@o456.ingest.sentry.io/789`). Copy both.

## Step 3 — Activate Worker Sentry (30 sec)

```bash
cd "Desktop/bussines model/worker"
npx wrangler secret put SENTRY_DSN
# paste the bookvoice-worker DSN

# Optional: set release tag
npx wrangler secret put SENTRY_RELEASE
# paste: bookvoice-worker@1.0.0

npx wrangler deploy
```

The wrapper in `src/sentry-wrap.js` is already:
- Redacting cookie + authorization headers before sending
- Redacting `?mobile_token=` query strings
- `tracesSampleRate: 0` (errors only, no performance overhead)
- `enabled: !!env.SENTRY_DSN` (silently disabled if secret absent)

### Test the integration

After setting DSN + deploying, visit:
```
https://book.eugenemierak.com/api/__internal_do_not_use_sentry_test
```
(Not a real route — the 404 path still executes through Sentry. Any 500 from a real endpoint will surface in Sentry within seconds.)

## Step 4 — Mobile Sentry (happens during v6.2 build)

When v6.2 is built, `@sentry/react-native` will be added. Setup for Zak:

1. After v6.2 mobile code is committed, Zak adds the DSN to `mobile/.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=<bookvoice-mobile DSN from Step 2>
   ```
2. Run `eas build --profile production --platform android` to produce v6.2 AAB
3. Sentry will capture mobile crashes + unhandled promise rejections

## Step 5 — Verify monthly quota

Sentry free tier: 5,000 errors/month. At BookVoice's current scale (handful of testers) this is way over-sized.

Check usage: Sentry → Settings → Subscription → Usage.

If you ever hit the cap:
- Raise sample rate filters
- Or upgrade to Team tier ($26/mo)

## Step 6 — Daily / weekly review

Sentry → Issues view shows grouped errors with stack traces + breadcrumbs + affected user count.

- Morning 5-min check during launch week
- Weekly after stable
- Turn on email alerts for NEW issues (Sentry → Settings → Alerts)

## Privacy / PII note

The Worker wrapper explicitly strips cookies, Authorization headers, and `mobile_token` URL params before sending to Sentry. No session tokens ever reach Sentry. Mobile wrapper will do the same (see `lib/sentry.ts` in v6.2).
