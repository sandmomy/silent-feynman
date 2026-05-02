# Cloudflare WAF rate-limit rules — BookVoice v6.1

Apply these in Cloudflare dashboard (not via wrangler). Zone: `eugenemierak.com` (or whichever zone serves `book.eugenemierak.com`).

## Path
Cloudflare dashboard → **eugenemierak.com** → **Security → WAF → Rate limiting rules** → **Create rule**.

## Rule 1 — Login brute-force protection
- **Rule name**: `bookvoice login rate limit`
- **Field**: `URI Path`, **Operator**: `is in`, **Value**:
  ```
  /api/session/login
  /api/auth/mobile/login
  /api/session/register
  /api/auth/mobile/google
  /api/auth/google/start
  ```
- **Characteristics**: `IP source address`
- **Rate**: `10 requests per 1 minute`
- **Action**: `Block`, **Duration**: `10 minutes`
- **Response**: default (429)

## Rule 2 — Stripe webhook protection (prevent flood)
- **Rule name**: `stripe webhook rate limit`
- **Field**: `URI Path`, **Operator**: `equals`, **Value**: `/api/stripe/webhook`
- **Characteristics**: `IP source address`
- **Rate**: `60 requests per 10 seconds` (Stripe retries liberally on 5xx)
- **Action**: `Managed Challenge` (do NOT block, because Stripe must reach this)
- **Duration**: `1 minute`

## Rule 3 — Admin panel protection
- **Rule name**: `admin panel rate limit`
- **Field**: `URI Path`, **Operator**: `starts with`, **Value**: `/api/admin/`
- **Characteristics**: `IP source address`
- **Rate**: `30 requests per 1 minute`
- **Action**: `Block`, **Duration**: `5 minutes`

## Verify after creating
```
# Should get 429 after 11 rapid attempts:
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://book.eugenemierak.com/api/session/login \
    -H "Content-Type: application/json" -d '{"username":"x","password":"y"}'
done
```

Expected: first 10 return `401`, requests 11+ return `429`.

## Free plan note
Cloudflare Free plan allows only **1 rate-limit rule**. If on free tier, collapse Rules 1+3 into one (Login + admin combined). Check plan: dashboard → overview → "Plan".
