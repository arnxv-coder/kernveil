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
| Free domain scanner | `/scan` |
| Workspace entry | `/demo-entry` |
| Overview | `/demo` |
| Assets inventory | `/demo-assets` |
| Findings list | `/demo-findings` |
| Finding detail | `/demo-finding?id=publicly-exposed-storage` |
| Connectors | `/demo-connectors` |
| Reports | `/demo-reports` |
| Plans & usage | `/demo-plans` |
| Activity | `/demo-activity` |
| Notifications | `/demo-notifications` |
| Backups | `/demo-backups` |
| Identity | `/demo-identity` |
| Cloud checks | `/demo-cloud` |
| Website checks | `/demo-website` |

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

- Near-black canvas (`#0a0a0b`) with a single restrained green accent (`#63d2a9`). Severity uses a calm red / orange / amber / green ramp.
- Inter for display and UI; JetBrains Mono for data, records and evidence.
- All color, type, spacing, radius, shadow, and motion values are tokenized in `styles/tokens.css`.
- Decorative effects that read as "AI-generated" are deliberately absent: no radial-gradient mesh backgrounds, no glow orbs, no glassmorphism, no fake scan-line or sweep animations.

## Free domain scanner (`/scan`)

A public, real (not simulated) domain scanner. This is the only part of the app that
contacts infrastructure over the network, and it is the only part that is a product
rather than a demo.

**`api/lib/scanCore.js`** — the engine. Dependency-free, runs unchanged on a serverless
function. Seven checks:

| Check | Method | Honest limits |
| --- | --- | --- |
| HTTPS enforcement | `fetch` over HTTP/HTTPS | — |
| TLS certificate | HTTPS reachability + `crt.sh` CT logs | Cannot open a raw socket, so no cipher/chain detail |
| Security headers | Response headers | — |
| SPF | DNS-over-HTTPS | — |
| DKIM | DNS-over-HTTPS, 6 common selectors | Custom selectors read as `unknown`, not `fail` |
| DMARC | DNS-over-HTTPS | — |
| Exposed files | 5 paths, parallel probes | — |

A check that cannot complete reports `unknown` and says why. Nothing is ever guessed.
Scans resolve the host first and refuse private, loopback, link-local and
`169.254.169.254` targets, so the scanner cannot be used as an internal network probe.

**`api/scan.js`** — the endpoint.

```
POST /api/scan  { "host": "example.com" }
  -> { preview: { host, resolvable, score, grade, totals, issues }, report: null, gated: true }

POST /api/scan  { "host": "example.com", "email": "you@company.com" }
  -> { preview, report: { host, score, grade, totals, checks[] }, gated: false, leadCaptured: true }
```

The full report is only returned when a valid email is supplied. Rate limiting is
**in-memory and best-effort** — it protects a warm instance but resets on cold start and
is not shared across concurrent instances. That is fine for a lead magnet; put a real
limiter in front of it if it is ever abused.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | no | Enables lead email alerts |
| `LEADS_EMAIL` | no | Where lead alerts are delivered |
| `LEADS_FROM` | no | Verified sender; defaults to `Kernveil <onboarding@resend.dev>` |

Without these the scanner still works — visitors still get their full report — but
lead alerts are skipped and a warning is written to the function logs.

**Sender and recipients (current limitation).** Resend's test mode only permits sending
to the address on the Resend account, so alerts currently go to `playnav.yt@gmail.com`
using the `onboarding@resend.dev` sender. To send to any other recipient, verify a
sending domain at [resend.com/domains](https://resend.com/domains), add the DNS records
it gives you, then set `LEADS_FROM` to an address on that verified domain. A `vercel.app`
subdomain cannot be used as a sending domain.

## Honest-marketing rules used here

- No fake testimonials, fake logos, or invented certifications.
- Connector cards show their real state (available vs planned vs coming soon).
- Demo pages are labeled “Demo workspace” with a sample-data notice, and every finding is fictional Acme Retail data.