# Stripe Setup For `silent-feynman`

This project already has the Vercel backend and the `services.html` checkout wiring in place.
To activate Stripe in production, create these products and prices in Stripe and then copy the resulting Price IDs into Vercel environment variables.

## Products And Price Mapping

### 1. Private Elite Coaching

- Product name: `Private Elite Coaching`
- Billing model: recurring
- Recommended Stripe price:
  - Monthly subscription
  - Currency: `EUR`
  - Amount: choose your entry point, for example `1500.00`
- Vercel env var: `STRIPE_PRICE_ELITE_COACHING`
- Internal service slug: `elite-coaching`

Notes:
- The page currently shows `EUR 1.5k - 5k / mo`.
- If you want multiple coaching tiers later, we can evolve this from one default Stripe price to a selector with several monthly plans.

### 2. Obsidian Retreats

- Product name: `Obsidian Retreats`
- Billing model: one-time payment
- Recommended Stripe price:
  - One-time
  - Currency: `EUR`
  - Amount: choose the public booking deposit or full reservation amount
- Vercel env var: `STRIPE_PRICE_OBSIDIAN_RETREATS`
- Internal service slug: `obsidian-retreats`

Notes:
- The page currently shows `EUR 2.5k - 10k / person`.
- Best practice for premium retreats is often a Stripe deposit first, with the balance handled manually or via invoice.

### 3. Certification Program

- Product name: `Certification Program`
- Billing model: one-time payment
- Recommended Stripe price:
  - One-time
  - Currency: `EUR`
  - Amount: choose your main enrollment amount, for example `3000.00`
- Vercel env var: `STRIPE_PRICE_CERTIFICATION`
- Internal service slug: `certification`

Notes:
- The page currently shows `EUR 3k - 8k / cert`.
- If you want installment plans later, we can move this to subscription mode or payment links per cohort.

## Services That Stay Manual

These services are intentionally left as consultation / proposal flow:

- `leadership-development`
- `workshops`

They already fall back to email/private contact.

## Required Vercel Environment Variables

Add these in the Vercel project:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ELITE_COACHING`
- `STRIPE_PRICE_OBSIDIAN_RETREATS`
- `STRIPE_PRICE_CERTIFICATION`
- `SITE_CONTACT_EMAIL`
- `PUBLIC_SITE_URL`

Recommended production value:

```text
PUBLIC_SITE_URL=https://silent-feynman.vercel.app
```

## Stripe Webhook

Create a Stripe webhook endpoint pointing to:

```text
https://silent-feynman.vercel.app/api/stripe/webhook
```

Recommended events:

- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`

Copy the webhook signing secret into:

```text
STRIPE_WEBHOOK_SECRET
```

## Quick Activation Checklist

1. Create the three Stripe products/prices above.
2. Copy each generated `price_...` ID into the matching Vercel env var.
3. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
4. Redeploy the project on Vercel.
5. Test:
   - `GET /api/stripe/catalog`
   - Click the three Stripe-backed CTAs on `services.html`
   - Confirm Stripe redirect works
6. Send a test webhook event from Stripe or Stripe CLI.

## Current Deployment

- Production site: `https://silent-feynman.vercel.app`
- Services page: `https://silent-feynman.vercel.app/services.html`
- Stripe catalog endpoint: `https://silent-feynman.vercel.app/api/stripe/catalog`
