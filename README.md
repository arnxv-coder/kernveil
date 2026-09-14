# Kernveil — Marketing Site & Interactive Product Demo

Kernveil gives growing companies one clear workspace to discover exposed assets, understand the risk, and take the next right step — without a dedicated security team.

This repository contains **two static experiences** built with plain HTML, CSS, and vanilla JavaScript:

1. **Marketing site** (`index.html`) — a dark, cinematic, animated one-pager.
2. **Product demo** (`demo-*.html`) — a fictional example workspace that mirrors the product’s overview, assets, findings, and connectors screens.

**All demo data is fictional.** Nothing connects to a real product, cloud account, or repository. Connector states (available / planned / coming soon) are illustrative only, and every demo page is labeled as a demo.

## Run it

There is no build step, no server framework, and no package manager — **no Node.js, no npm, nothing to install.** Just open `index.html` in any browser, or serve the folder with any static file server of your choice:

```bash
# Whatever you already have is fine, for example:
python -m http.server 8080
```

File paths:

| Page | URL |
| --- | --- |
| Marketing site | `index.html` |
| Overview | `demo.html` |
| Assets inventory | `demo-assets.html` |
| Findings list | `demo-findings.html` |
| Finding detail | `demo-finding.html?id=publicly-exposed-storage` |
| Connectors | `demo-connectors.html` |

Finding detail is driven by `?id=` and falls back to a “Finding not found” state for unknown ids. Opening `index.html` directly from the filesystem also works — all scripts and animation libraries are vendored locally (no CDN), so no network is required except Google Fonts, which fall back to system fonts offline.

## Structure

```
index.html                  Marketing one-pager
demo.html                   Overview workspace (KPIs, gauges, trend, activity, next step)
demo-assets.html            Asset inventory
demo-findings.html          Findings list with search/filters/sorting
demo-connectors.html        Off-the-shelf integrations (honest availability labels)
demo-finding.html           Finding detail (rendered from ?id=)
styles/
  tokens.css                Design tokens (color, type, spacing, radius, shadow, motion)
  base.css                  Reset + shared atoms (buttons, badges, severity, reveals, modals)
  marketing.css             Marketing site styles
  dashboard.css             Demo workspace shell + pages
js/
  lib/data.js               window.KERNVEIL_DATA — all seeded demo data
  lib/common.js             window.KV helper layer (query, reduced-motion, count-up, reveals, menus, modals)
  marketing.js              Marketing animations (GSAP + ScrollTrigger + Motion)
  dashboard.js              Demo workspace rendering
  vendor/                   Vendored animation libraries (local, framework-free)
```

## Animation stack

Two animation libraries are used purposefully, side by side:

- **GSAP + ScrollTrigger** (`js/vendor/gsap.min.js`, `js/vendor/ScrollTrigger.min.js`) — hero intro timeline, idle ambient motion (scanline, levitation, pulses), scroll-linked reveals and parallax, HUD tilt, and table/row transitions in the demo.
- **Motion** (`js/vendor/motion.global.min.js`, UMD global `window.Motion`) — the overview risk-trend chart draw and micro-pulse interactions.

Both respect `prefers-reduced-motion`: all entries, reveals, and count-ups resolve to their final state instantly when reduced motion is requested.

### Motion design system

The motion system follows a **Premium** brand personality:

- **Signature easing**: `cubic-bezier(0.16, 1, 0.3, 1)` for 80% of spatial animations
- **Duration palette**: fast (180ms), standard (350ms), slow (550ms)
- **Entrance pattern**: 16–24px rise + opacity + blur-decay, decelerate curve, stagger 30ms per item (capped under 200ms)
- **Three motion layers**: primary (hero card pop), secondary (glow shadow follows card in 60ms later), ambient (metric levitation, gauge shimmer, network pulse)
- All tokens defined in `styles/tokens.css`

## Design

- Midnight-navy surfaces on a near-black canvas, single electric-teal accent with cyan/orange/red severity coding.
- Sora (display), Inter (UI), JetBrains Mono (data/code).
- All color, type, spacing, radius, shadow, and motion values are tokenized in `styles/tokens.css`.

## Honest-marketing rules used here

- No fake testimonials, fake logos, or invented certifications.
- Connector cards show their real state (available vs planned vs coming soon).
- Demo pages are labeled “Demo workspace” with a sample-data notice, and every finding is fictional Acme Retail data.