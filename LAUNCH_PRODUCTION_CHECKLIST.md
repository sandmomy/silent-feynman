# BookVoice — Production Launch Checklist

Last updated 2026-04-17. Covers the path from v6 AAB uploaded to Internal Testing → available on the public Play Store.

## 0. Pre-flight (do BEFORE touching Play Console)

- [ ] v6 AAB downloaded from EAS and uploaded to Internal Testing in Play Console (versionCode 6).
- [ ] Installed on a real Android device from the Internal Testing link. Tested:
  - [ ] Google Sign-In works (returns to catalog after auth).
  - [ ] Email+password login works (use an existing account).
  - [ ] Reader opens a unlocked book (no blank screen, no freeze on pinch).
  - [ ] Audio plays, lock-screen controls appear, audio stops on sign-out.
  - [ ] Sign-out kicks back to login screen.
- [ ] Worker v6.1 deployed (verified via `/api/session/status` returning `google_enabled:true`).
- [ ] Cloudflare WAF rules applied (see `worker/WAF_RULES_v6_1.md`).

## 1. Identify your Play Console account type

Play Console → top-left avatar → **Settings → Developer account → Account details → Developer type**.

- If **Organization** → follow Section 2A (fast path).
- If **Personal** and account created **before Nov 2023** → follow Section 2A.
- If **Personal** and account created **after Nov 2023** → follow Section 2B (slow path, 12 testers × 14 days required).

## 2A. Fast path — Organization or legacy Personal account

### App Content — everything must be green

Play Console → **Policy → App content**:

- [ ] **Privacy policy** — URL: `https://book.eugenemierak.com/privacy` ✅
- [ ] **App access** — explain any login walls ("Some content requires a purchased account")
- [ ] **Ads** — select "No ads"
- [ ] **Content rating** — complete the IARC questionnaire (likely Everyone / PEGI 3 for an audiobook reader)
- [ ] **Target audience** — 18+ (adult audiobook content), confirm no children
- [ ] **News app** — No
- [ ] **Government app** — No
- [ ] **Data safety** — already done ✅ (confirm answers match what the app actually collects: email, name, purchase history)
- [ ] **Financial features** — declare if selling in-app (Stripe redirect = NO in-app purchase as far as Play is concerned, but double-check with Play's current policy on "external purchase" disclosure)

### Pricing & distribution

- [ ] **Pricing** → Free (since purchases happen on the web via Stripe, not IAP)
- [ ] **Countries/regions** → select countries where Stripe is active and legal:
  - Start conservative: Spain, Italy, Germany, France, UK, Netherlands, Portugal
  - Expand after launch
- [ ] **Device categories** → Phone + Tablet (default)

### Create Production release

1. **Release → Production → Create new release**
2. **Upload AAB** — same v6 AAB or a separate production one
3. **Release name**: `1.0.0 (6)`
4. **Release notes** (see `mobile/RELEASE_NOTES_v6.md` — copy EN + ES)
5. **Rollout percentage**: start at **20%**. You'll promote to 100% after 48h if metrics are clean.
6. **Save → Review release → Send for review**

Review time first submission: **2–7 days**. Subsequent releases usually 1-2 days.

## 2B. Slow path — new Personal account (12 testers × 14 days) **— BookVoice is here**

### Step 1: Finish App Content (Play Console still shows draft state)

Play Console → **Policy → App content** — confirm these are all green:

- [ ] **Política de privacidad** → `https://book.eugenemierak.com/privacy` (already live)
- [ ] **Acceso a las aplicaciones** → declare that some content requires a purchased account
- [ ] **Anuncios** → "Mi app no tiene anuncios"
- [ ] **Clasificación de contenido** → complete IARC questionnaire (likely PEGI 3 / Everyone for a reader)
- [ ] **Audiencia objetivo** → 18+ (spiritual / adult self-development content)
- [ ] **Seguridad de los datos** → confirm (already done per 2026-04-16)
- [ ] **Aplicaciones gubernamentales** → No
- [ ] **Funciones financieras** → No (Stripe redirect is web, not in-app purchase)
- [ ] **Salud** → No
- [ ] **Categoría + contacto** → "Libros y obras de consulta" + support email
- [ ] **Ficha de Play Store** → feature graphic, screenshots, description (already done per 2026-04-16)

### Step 2: Create Closed Testing track

1. Play Console → **Test and release → Testing → Closed testing → Create track** (name it `alpha`)
2. Upload the v6 AAB to this track (the same one used for Internal Testing)
3. **Testers tab** → create a Google Group OR email list; add at least **12 real Gmail addresses** (recruit 14-15 in practice — some drop out)
4. **Copy the opt-in link**: `https://play.google.com/apps/testing/com.eugenemierak.bookvoice`
5. **Start rollout** to the closed track (don't promote to production yet)

### Step 3: Recruit 12 active testers

See `TESTER_RECRUITMENT_TEMPLATES.md` — 6 ready-to-paste messages for Reddit, Discord, email, WhatsApp, LinkedIn.

Fastest sources:

- Post on **r/AndroidTesting** on Reddit (most common, many dev-to-dev swaps)
- Post on **r/TestMyApp** / Indie Android Devs Discord
- Reach to BookVoice-interested people via Eugene's list / LinkedIn / Instagram / WhatsApp
- Offer reciprocity: "test mine, I'll test yours"

Each tester must:
- Click the opt-in link on an Android device signed in with a Gmail
- Install the app from Play Store
- **Open the app at least once during the 14 days** (Google tracks this)

### Step 4: Monitor the testing count

Play Console → **Test and release → Production → Solicitar acceso a producción** — shows progress: accepted-tester count + days elapsed.

Current state (2026-04-17): 0/12 testers, 0/14 days. Counter starts the moment the first tester opts in AND installs.

### Step 5: Eligibility unlocked → request production

- Click **Solicitar acceso a producción** — Google asks ~5 questions about the test window.
- Review: **1-3 days**.
- Upload v6 (or v6.2 if an update was pushed mid-test) to Production track.
- First Production review: **3-7 days**.
- Total timeline: **~3-4 weeks** from Closed Test start to public release.

## 3. Post-submission monitoring (first 48h after public)

- [ ] **Install crash rate** — Play Console → Vitals → Crashes and ANRs. Target <2%.
- [ ] **Stripe webhook delivery** — Stripe dashboard → Webhooks → check delivery success.
- [ ] **Worker error rate** — Cloudflare dashboard → Workers → bookvoice → Observability → Logs filtered by status >= 500.
- [ ] **D1 growth** — Cloudflare dashboard → D1 → bookvoice → Metrics. Expect <1KB per new user.

## 4. Rollout escalation plan

- Day 0: 20% staged rollout
- Day 2: if install crash rate <2% and no critical Play Console alerts → 50%
- Day 4: if still clean → 100%
- If ANY crash spike or Stripe anomaly → halt rollout via Play Console, diagnose, ship v7 hotfix before resuming

## 5. What to do on rejection (if reviewer flags issues)

Common reasons for BookVoice profile:
- **"External purchase without disclosure"** — if rejected for selling audiobooks via Stripe, add a disclosure screen before the purchase CTA: "This purchase will open your browser to complete payment outside the app."
- **"Data Safety mismatch"** — update the form to include anything Google's automated scan found (email, auth tokens, purchase history).
- **"Metadata policy"** — shorten description if they flag keyword stuffing.

Fix → resubmit → faster second review.
