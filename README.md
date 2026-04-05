# Eugene Mierak - Strategic Advisor Portfolio (Golden State)

A high-end, high-performance executive landing page and project portal. Designed for maximum information density and premium visual impact, optimized for strategic consulting and global impact storytelling.

## 🚀 Live Environment
**Production:** [https://eugenemierak.com](https://eugenemierak.com)
**Hosted on:** Netlify + Cloudflare DNS

---

## ✨ Premium Executive Features (Golden State)

This project has been stabilized to its **"Golden State"** architecture, focusing on visual excellence and structural precision:

- **Interactive 3D Executive Globe**: Custom `Globe.GL` & `Three.js` implementation visualizing global capital flows and project nodes (Indonesia, Africa, Global Hubs).
- **Ultra-Glassmorphism Design**: High-fidelity UI using deep `backdrop-filter` blur (20px-30px), translucent borders, and radial glowing atmospheres.
- **3-Column Professional Hero**: Precision alignment of Identity, 3D Assets, and dynamic Event Context.
- **Ultra-Compact "Snapshot" Bio**: High-density executive profile featuring:
  - Vertical Portrait center-stack.
  - "Zero-G" Proximity spacing for efficient reading.
  - Large-scale Biography Manifesto for deep narrative impact.
- **Elite Contact Hub**: A streamlined 3-column footer integrating Direct Access, Social Ecosystem, and Global Availability.

---

## 🛠️ Tech Stack & Pillars

- **Core**: Vanilla HTML5, Modern CSS3 (Grid/Flex/Custom Variables).
- **Graphics**: `Three.js` + `Globe.GL` for high-performance WebGL visualizations.
- **Motion**: `Lenis.js` for smooth global kinetic scrolling and custom Keyframe animations.
- **Data**: Centralized `documents-data.js` managing project metadata and document filtering logic.

---

## 📁 Repository Map

```text
/silent-feynman/
├── index.html          # Main Executive Landing (The "Golden State")
├── projects.html       # Document Portal & Works Registry
├── css/
│   ├── styles.css      # Core Design System (Glassmorphism, Grid, Colors)
│   └── mobile-overrides.css # Precision patches for handheld devices
├── js/
│   ├── main.js         # Navigation, Globe interactivity, & Scroll logic
│   ├── projects.js     # Filtering engine for the Project Portal
│   └── documents-data.js # Central Object Data Store
└── assets/             # High-fidelity imagery and profile photography
```

---

## 🔌 Local Execution

Run a local server to view the high-precision animations correctly:
```bash
# Using Node.js
npx serve .

# Using Python
python -m http.server 8000
```

---

## Stripe + Vercel

The `services.html` page now supports a hybrid sales flow:

- `Private Elite Coaching`, `Obsidian Retreats`, and `Certification Program` can open Stripe Checkout once their Stripe Price IDs are configured.
- `Leadership Development` and `High-Performance Workshops` stay proposal-based and continue through private consultation.

### Required Environment Variables

Copy `.env.example` and set these values in Vercel:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ELITE_COACHING`
- `STRIPE_PRICE_OBSIDIAN_RETREATS`
- `STRIPE_PRICE_CERTIFICATION`
- `SITE_CONTACT_EMAIL`
- `PUBLIC_SITE_URL`

### Endpoints

- `GET /api/stripe/catalog`
- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/webhook`

### Deploy To Vercel

```bash
vercel link --yes --project <project-name> --scope <team-slug-or-id>
vercel env pull .env.local
vercel --prod
```

Detailed setup:

- See `STRIPE_SETUP.md`

---
*Maintained with precision by the Eugene Mierak Development Team.*
