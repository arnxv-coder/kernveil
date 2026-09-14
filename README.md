# Kernveil — Marketing Site & Interactive Product Demo

Kernveil gives growing companies one clear workspace to discover exposed assets, understand the risk, and take the next right step — without a dedicated security team.

This repository is a **React (Vite) single-page application** that reproduces, in React, two experiences that were originally built and shipped as a static site:

1. **Marketing site** (`/`) — a dark, cinematic, animated one-pager.
2. **Product demo** (`/demo`, `/demo-assets`, `/demo-findings`, `/demo-finding`, `/demo-connectors`) — a fictional example workspace mirroring the product’s overview, assets, findings, and connectors screens.

**All demo data is fictional.** Nothing connects to a real product, cloud account, or repository. Connector states (available / planned / coming soon) are illustrative only, and every demo page is labeled as a demo.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

## Routes

| Page | Route |
| --- | --- |
| Marketing site | `/` |
| Overview | `/demo` |
| Assets inventory | `/demo-assets` |
| Findings list | `/demo-findings` |
| Finding detail | `/demo-finding?id=publicly-exposed-storage` |
| Connectors | `/demo-connectors` |

Finding detail is driven by `?id=` and falls back to a “Finding not found” state for unknown ids.

## Structure

```
index.html                  Vite entry (fonts, favicon, reduced-motion pre-paint script)
vite.config.js              Vite + React config
vercel.json                 Vite framework + SPA rewrites for client-side routing
src/
  main.jsx                  Router + body-class + motion notice + CSS imports
  lib/web.js                Shared helpers + motion-preference system (React)
  lib/data.js               All seeded demo data (fictional Acme Retail)
  lib/anim.jsx              GSAP registration + shared dashboard kit + icons
  hooks/useMarketingFx.js   Marketing page animations (GSAP + ScrollTrigger + Motion)
  hooks/useDashboardFx.js   Overview entrance effects
  components/MotionNotice.jsx  Reduced-motion notice + “Enable animations” override
  components/Icons.jsx      Shared SVG components
  components/demo/           Demo badge atoms
  pages/MarketingPage.jsx   Marketing one-pager
  pages/demo/               Demo layout + overview, assets, findings, connectors, finding detail
styles/
  tokens.css                Design tokens (color, type, spacing, radius, shadow, motion)
  base.css                  Reset + shared atoms (buttons, badges, severity, reveals, modals)
  marketing.css             Marketing site styles
  dashboard.css             Demo workspace shell + pages
```

## Animation stack

Two animation libraries are used purposefully, side by side:

- **GSAP + ScrollTrigger** (npm `gsap`) — hero intro timeline, idle ambient motion (scanline, levitation, pulses), scroll-linked reveals and parallax, HUD tilt, and table/row transitions in the demo.
- **Motion** (npm `motion`, formerly Framer Motion) — the overview risk-trend chart draw and micro-pulse interactions.

Both respect `prefers-reduced-motion`, with an explicit in-page override (“Enable animations”) so the OS preference can be opted out of per site. All entries, reveals, and count-ups resolve to their final state instantly when reduced motion is requested.

## Design

- Midnight-navy surfaces on a near-black canvas, single electric-teal accent with cyan/orange/red severity coding.
- Sora (display), Inter (UI), JetBrains Mono (data/code).
- All color, type, spacing, radius, shadow, and motion values are tokenized in `styles/tokens.css`.

## Honest-marketing rules used here

- No fake testimonials, fake logos, or invented certifications.
- Connector cards show their real state (available vs planned vs coming soon).
- Demo pages are labeled “Demo workspace” with a sample-data notice, and every finding is fictional Acme Retail data.