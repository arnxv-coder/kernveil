import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandMark, ArrowIcon, LinkArrowIcon } from "../components/Icons.jsx";
import { useMarketingFx } from "../hooks/useMarketingFx.js";

/* ---------- decorative inline SVG snippets ---------- */
const IC_COVERAGE = {
  code: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 8h16M4 15h16M8 4v16M16 4v16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 11v1M12 11v1M17 11v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 7v.01M10 7v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  api: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3v5M5 6.5l3.5 3.5M19 6.5L15.5 10M5 17.5L8.5 14M19 17.5L15.5 14M12 16v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  identity: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c.7-3.2 3.2-5.5 6.5-5.5s5.8 2.3 6.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  backups: (
    <svg viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  saas: (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="3" y="9" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="14.5" r="1.3" fill="currentColor" />
    </svg>
  ),
};

const COVERAGE_ITEMS = [
  { name: "Code", status: "In the demo", badge: "badge-teal", icon: IC_COVERAGE.code },
  { name: "Cloud", status: "In the demo", badge: "badge-teal", icon: IC_COVERAGE.cloud },
  { name: "Websites", status: "In the demo", badge: "badge-teal", icon: IC_COVERAGE.website },
  { name: "APIs", status: "Planned", badge: "badge-slate", icon: IC_COVERAGE.api },
  { name: "Identities", status: "Planned", badge: "badge-slate", icon: IC_COVERAGE.identity },
  { name: "Backups", status: "Planned", badge: "badge-slate", icon: IC_COVERAGE.backups },
  { name: "SaaS", status: "Coming next", badge: "badge-ghost", icon: IC_COVERAGE.saas },
];

const ALERT_CHIPS = [
  "session token leaked",
  "port 5432 open",
  "config drift",
  "deprecation notice",
  "repo exposed",
  "db backup stale",
  "policy warning",
  "tls misconfig",
  "new dependency",
  "token rotated",
  "ssh key found",
  "api rate abuse",
];

const SORTED_ITEMS = [
  {
    rank: "01",
    title: "Publicly exposed storage resource",
    meta: "prod-web-01 · affects 3 assets",
    sev: "Critical",
    sevCls: "sev-critical",
  },
  {
    rank: "02",
    title: "Open database port on shared host",
    meta: "db-main · affects 2 assets",
    sev: "High",
    sevCls: "sev-high",
  },
  {
    rank: "03",
    title: "Overly permissive access policy",
    meta: "billing-app · affects 1 asset",
    sev: "Medium",
    sevCls: "sev-medium",
  },
];

const CAPS = [
  {
    visual: (
      <>
        <svg className="cap-net" viewBox="0 0 160 110" fill="none">
          <g stroke="rgba(42,230,199,0.35)" strokeWidth="1">
            <line x1="30" y1="80" x2="70" y2="35" className="cap-edge" />
            <line x1="70" y1="35" x2="120" y2="70" className="cap-edge" />
            <line x1="30" y1="80" x2="120" y2="70" className="cap-edge" />
            <line x1="90" y1="20" x2="70" y2="35" className="cap-edge" />
            <line x1="90" y1="20" x2="120" y2="70" className="cap-edge" />
          </g>
          <circle cx="30" cy="80" r="4" className="cap-node" />
          <circle cx="70" cy="35" r="5" className="cap-node cap-node-hot" />
          <circle cx="90" cy="20" r="4" className="cap-node" />
          <circle cx="120" cy="70" r="5" className="cap-node cap-node-hot" />
        </svg>
        <span className="cap-tag badge badge-teal">Inventory · 14 assets</span>
      </>
    ),
    title: "See your environment",
    desc: "Understand the assets, repositories, and systems that matter.",
    link: { to: "/demo-assets", text: "View sample assets" },
  },
  {
    visual: (
      <>
        <div className="cap-bars">
          <span className="cap-bar" style={{"--h": "34%", "--c": "var(--red)"}}></span>
          <span className="cap-bar" style={{"--h": "52%", "--c": "var(--orange)"}}></span>
          <span className="cap-bar" style={{"--h": "68%", "--c": "var(--amber)"}}></span>
          <span className="cap-bar" style={{"--h": "80%", "--c": "var(--slate)"}}></span>
          <span className="cap-bar" style={{"--h": "44%", "--c": "var(--slate)"}}></span>
          <span className="cap-bar" style={{"--h": "58%", "--c": "var(--amber)"}}></span>
          <span className="cap-bar" style={{"--h": "72%", "--c": "var(--slate)"}}></span>
        </div>
        <span className="cap-tag badge badge-orange">27 findings → 11 matter</span>
      </>
    ),
    title: "Prioritize real risk",
    desc: "Focus on severity, business impact, and affected assets instead of alert volume.",
    link: { to: "/demo-findings", text: "View sample findings" },
  },
  {
    visual: (
      <>
        <div className="cap-doc">
          <span className="cap-doc-icon mono">!</span>
          <div className="cap-doc-lines">
            <span className="cap-doc-line hl"></span>
            <span className="cap-doc-line"></span>
            <span className="cap-doc-line"></span>
            <span className="cap-doc-explain">…put simply, it means anyone on the internet could read this data.</span>
          </div>
        </div>
        <span className="cap-tag badge badge-cyan">Plain-English explanations</span>
      </>
    ),
    title: "Understand every finding",
    desc: "Get plain-English explanations, evidence, context, and a clear reason to care.",
    link: { to: "/demo-finding?id=publicly-exposed-storage", text: "Read a sample finding" },
  },
  {
    visual: (
      <>
        <ol className="cap-timeline">
          <li className="cap-step done"><span className="cap-step-dot"></span><span>Detected</span></li>
          <li className="cap-step doing"><span className="cap-step-dot"></span><span>Being fixed</span></li>
          <li className="cap-step todo"><span className="cap-step-dot"></span><span>Awaiting approval</span></li>
        </ol>
        <span className="cap-tag badge badge-green">Remediation tracked</span>
      </>
    ),
    title: "Move toward remediation",
    desc: "Track what is open, what is being addressed, and what needs approval.",
    link: { to: "/demo", text: "See remediation progress" },
  },
];

const STEPS = [
  {
    num: "01",
    title: "Connect or import",
    body: "Bring in the systems and scan information your team already uses. Nothing gets invented.",
    list: [
      { done: true, text: "GitHub sample repo" },
      { done: true, text: "Cloud environment (sample)" },
      { done: false, text: "Website checks" },
    ],
  },
  {
    num: "02",
    title: "Understand exposure",
    body: "Kernveil organizes assets, findings, severity, and evidence in one clear workspace.",
    list: [
      { done: true, text: "14 assets mapped" },
      { done: true, text: "27 findings classified" },
      { done: true, text: "11 worth acting on" },
    ],
  },
  {
    num: "03",
    title: "Act with confidence",
    body: "Follow a clear next step and track progress without guessing what to do next.",
    list: [
      { done: true, text: "Next step recommended" },
      { done: true, text: "Progress tracked" },
      { done: true, text: "Approval workflow" },
    ],
  },
];

const ACTIVITY = [
  { c: "var(--red)", txt: "New critical finding — exposed storage", time: "2m" },
  { c: "var(--teal)", txt: "Monitoring rescan completed", time: "32m" },
  { c: "var(--green)", txt: "2 findings resolved", time: "3h" },
  { c: "var(--amber)", txt: "High finding acknowledged", time: "5h" },
];

/* ============================================================
   MarketingPage
   ============================================================ */
export default function MarketingPage() {
  const rootRef = useRef(null);
  const [modalKey, setModalKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        requestAnimationFrame(() => target.scrollIntoView({ behavior: "auto", block: "start" }));
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.hash, location.pathname]);

  useMarketingFx(rootRef);

  let lastFocus = useRef(null);

  return (
    <div ref={rootRef} className="marketing-page">
      <a className="skip-link" href="#main">Skip to content</a>

      {/* ============ HEADER ============ */}
      <header className="site-header" id="site-header">
        <div className="container header-inner">
          <a className="brand" href="#hero" aria-label="Kernveil home">
            <BrandMark />
            <span className="brand-name">Kernveil</span>
          </a>

          <nav className="nav-desktop" aria-label="Primary">
            <a href="#capabilities" className="nav-link">Product</a>
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#coverage" className="nav-link">Coverage</a>
          </nav>

          <div className="header-actions">
            <button
              className="nav-link btn-signin"
              id="nav-signin"
              type="button"
              onClick={(e) => openModal("signin", e.currentTarget)}
            >
              Sign in
            </button>
            <Link className="btn btn-primary btn-sm" to="/demo">
              Explore the demo
              <ArrowIcon />
            </Link>
            <button
              className="mobile-toggle"
              id="mobile-toggle"
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div className="mobile-menu" id="mobile-menu" hidden={!mobileOpen}>
        <nav className="mobile-menu-nav" aria-label="Mobile">
          <a href="#capabilities" className="mm-link">Product</a>
          <a href="#how-it-works" className="mm-link">How it works</a>
          <a href="#coverage" className="mm-link">Coverage</a>
          <a href="#example-finding" className="mm-link">Sample finding</a>
        </nav>
        <div className="mobile-menu-actions">
          <a className="btn btn-secondary" href="#capabilities">Sign in</a>
          <Link className="btn btn-primary" to="/demo" onClick={() => setMobileOpen(false)}>
            Explore the demo
            <ArrowIcon />
          </Link>
        </div>
      </div>

      <main id="main">
        {/* ============ HERO ============ */}
        <section className="hero" id="hero">
          <div className="hero-bg" data-hero-bg aria-hidden="true">
            <div className="hero-grid" aria-hidden="true"></div>
            <div className="hero-network" data-hero-network aria-hidden="true">
              <svg className="network-svg" viewBox="0 0 700 560" fill="none" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="rgba(42,230,199,0)" />
                    <stop offset="0.5" stopColor="rgba(42,230,199,0.4)" />
                    <stop offset="1" stopColor="rgba(42,230,199,0)" />
                  </linearGradient>
                </defs>
                <g className="edges" stroke="url(#edgeGrad)" strokeWidth="1">
                  <line x1="120" y1="120" x2="330" y2="90" className="edge" />
                  <line x1="330" y1="90" x2="540" y2="150" className="edge" />
                  <line x1="120" y1="120" x2="190" y2="300" className="edge" />
                  <line x1="330" y1="90" x2="300" y2="260" className="edge" />
                  <line x1="540" y1="150" x2="430" y2="300" className="edge" />
                  <line x1="300" y1="260" x2="190" y2="300" className="edge" />
                  <line x1="300" y1="260" x2="430" y2="300" className="edge" />
                  <line x1="190" y1="300" x2="120" y2="440" className="edge" />
                  <line x1="480" y1="300" x2="430" y2="300" className="edge" />
                  <line x1="540" y1="150" x2="620" y2="320" className="edge" />
                  <line x1="620" y1="320" x2="430" y2="300" className="edge" />
                  <line x1="330" y1="90" x2="150" y2="40" className="edge" />
                </g>
                <g className="nodes">
                  <circle cx="120" cy="120" r="5" /><circle cx="330" cy="90" r="7" className="hub" />
                  <circle cx="540" cy="150" r="5" /><circle cx="190" cy="300" r="4.5" />
                  <circle cx="300" cy="260" r="6" className="hub" /><circle cx="430" cy="300" r="5" />
                  <circle cx="120" cy="440" r="4" /><circle cx="620" cy="320" r="4.5" />
                  <circle cx="150" cy="40" r="4" />
                </g>
                <g className="pulses">
                  <circle r="3" fill="#53f3d6" className="pulse-dot" />
                </g>
              </svg>
            </div>
            <div className="hero-glow hero-glow-a" aria-hidden="true"></div>
            <div className="hero-glow hero-glow-b" aria-hidden="true"></div>
          </div>

          <div className="container hero-inner">
            <div className="hero-copy" data-hero-copy>
              <span className="eyebrow" data-reveal>
                <span className="dot" aria-hidden="true"></span>
                AI-assisted security for growing companies
              </span>
              <h1 className="hero-title">
                <span className="line" data-hero-line>See what puts your business at risk.</span>
                <span className="line line-accent" data-hero-line>Fix what matters first.</span>
              </h1>
              <p className="hero-sub" data-hero-sub>
                Kernveil gives growing companies one clear workspace to discover exposure,
                understand the risk, and take the next right step — without needing a dedicated security team.
              </p>
              <div className="hero-cta" data-hero-cta>
                <Link className="btn btn-primary btn-lg" to="/demo" data-magnetic>
                  Explore the demo
                  <ArrowIcon />
                </Link>
                <a className="btn btn-secondary btn-lg" href="#how-it-works" data-magnetic>
                  See how it works
                </a>
              </div>
              <p className="hero-note" data-hero-note>
                One clear view of the security risks that matter most.
              </p>
            </div>

            {/* ============ HERO PRODUCT VISUAL ============ */}
            <div className="hero-visual" data-hero-visual aria-label="Interactive preview of the Kernveil demo workspace">
              <div className="hud-card" data-hud>
                <header className="hud-head">
                  <div className="hud-brand">
                    <BrandMark small />
                    <span className="hud-title">Kernveil</span>
                  </div>
                  <div className="hud-pills">
                    <span className="badge badge-teal"><span className="dot"></span>Demo workspace</span>
                    <span className="badge badge-ghost hud-status"><span className="dots" aria-hidden="true"><i></i><i></i><i></i></span>Monitoring</span>
                  </div>
                </header>

                <div className="hud-body">
                  <div className="hud-top">
                    <div className="risk-gauge" data-gauge>
                      <svg viewBox="0 0 120 120" className="gauge" aria-hidden="true">
                        <defs>
                          <linearGradient id="gaugeGrad" x1="0" y1="1" x2="1" y2="0">
                            <stop offset="0" stopColor="#ef6a72" />
                            <stop offset="0.45" stopColor="#f4b64a" />
                            <stop offset="1" stopColor="#2ae6c7" />
                          </linearGradient>
                        </defs>
                        <circle className="gauge-track" cx="60" cy="60" r="50" />
                        <circle className="gauge-value" id="gaugeArc" cx="60" cy="60" r="50"
                          pathLength="100" stroke="url(#gaugeGrad)" />
                      </svg>
                      <div className="gauge-center">
                        <span className="gauge-num mono" data-count="74">0</span>
                        <span className="gauge-label">risk score</span>
                      </div>
                    </div>

                    <div className="hud-metrics">
                      <div className="metric">
                        <span className="metric-val mono" data-count="2">0</span>
                        <span className="metric-label"><span className="sev sev-critical">Critical</span></span>
                      </div>
                      <div className="metric">
                        <span className="metric-val mono" data-count="9">0</span>
                        <span className="metric-label"><span className="sev sev-high">High</span></span>
                      </div>
                      <div className="metric">
                        <span className="metric-val mono" data-count="14">0</span>
                        <span className="metric-label">Assets monitored</span>
                      </div>
                    </div>
                  </div>

                  <div className="hud-trend">
                    <div className="hud-block-head">
                      <span>Risk trend</span>
                      <span className="mono hud-trend-delta">-6% this month</span>
                    </div>
                    <svg className="trend-chart" viewBox="0 0 300 74" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="rgba(42,230,199,0.24)" />
                          <stop offset="1" stopColor="rgba(42,230,199,0)" />
                        </linearGradient>
                      </defs>
                      <path className="trend-area" d="M0,52 L34,44 L68,48 L102,38 L136,42 L170,30 L204,34 L238,22 L272,26 L300,16 L300,74 L0,74 Z" fill="url(#trendFill)" />
                      <path className="trend-line" id="trendLine" d="M0,52 L34,44 L68,48 L102,38 L136,42 L170,30 L204,34 L238,22 L272,26 L300,16" />
                    </svg>
                  </div>

                  <div className="hud-findings">
                    <div className="hud-block-head">
                      <span>Recent findings</span>
                      <Link to="/demo-findings" className="hud-more">View all</Link>
                    </div>
                    <ul className="hud-findings-list">
                      <li className="hud-finding">
                        <span className="sev sev-critical">Critical</span>
                        <span className="hud-finding-text">Publicly exposed storage resource</span>
                        <span className="hud-finding-asset mono">prod-web-01</span>
                      </li>
                      <li className="hud-finding">
                        <span className="sev sev-high">High</span>
                        <span className="hud-finding-text">Open database port on shared host</span>
                        <span className="hud-finding-asset mono">db-main</span>
                      </li>
                      <li className="hud-finding">
                        <span className="sev sev-medium">Medium</span>
                        <span className="hud-finding-text">Overly permissive access policy</span>
                        <span className="hud-finding-asset mono">billing-app</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <footer className="hud-foot">
                  <span className="hud-foot-item"><span className="status-dot" aria-hidden="true"></span> Continuous monitoring</span>
                  <span className="hud-foot-item mono">Last checked 2m ago</span>
                </footer>

                {/* ambient effects over the card */}
                <div className="hud-scan" aria-hidden="true"></div>
                <div className="hud-sweep" aria-hidden="true"></div>
                <div className="hud-corner-glow" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ COVERAGE STRIP ============ */}
        <section className="coverage" id="coverage">
          <div className="container">
            <div className="section-head center" data-reveal>
              <span className="eyebrow neutral">Coverage</span>
              <h2 className="section-title">Built to help you understand your whole environment</h2>
              <p className="section-lede">Kernveil is designed around the systems growing companies actually run on.</p>
            </div>

            <ul className="coverage-strip" data-reveal>
              {COVERAGE_ITEMS.map((item) => (
                <li className="coverage-item" key={item.name}>
                  <span className="coverage-ic" aria-hidden="true">{item.icon}</span>
                  <div>
                    <span className="coverage-name">{item.name}</span>
                    <span className={`coverage-status badge ${item.badge}`}>{item.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============ PROBLEM ============ */}
        <section className="problem" id="problem">
          <div className="problem-glow" aria-hidden="true"></div>
          <div className="container">
            <div className="section-head" data-reveal>
              <span className="eyebrow">The problem</span>
              <h2 className="section-title">Security should not require a security department.</h2>
              <p className="section-lede">
                Growing companies rely on cloud platforms, code repositories, SaaS tools, APIs,
                remote access, and third-party services every day. The hard part is not collecting
                more alerts. It is understanding which risks matter, what they affect, and what
                to do next.
              </p>
            </div>

            <div className="problem-figure" data-reveal>
              <div className="pf-col pf-before" data-reveal>
                <div className="pf-label">
                  <span className="pf-label-title">What it feels like today</span>
                  <span className="badge badge-red">18 alerts / day</span>
                </div>
                <div className="alert-stream" data-alert-stream aria-hidden="true">
                  {ALERT_CHIPS.map((chip, i) => (
                    <div className={`alert-chip a${i + 1}`} key={chip}><i></i><span>{chip}</span></div>
                  ))}
                </div>
              </div>

              <div className="pf-connector" aria-hidden="true">
                <div className="pf-arrow"><span>→</span></div>
              </div>

              <div className="pf-col pf-after" data-reveal>
                <div className="pf-label">
                  <span className="pf-label-title">What Kernveil shows</span>
                  <span className="badge badge-teal">2 are worth your time</span>
                </div>
                <div className="sorted-list">
                  {SORTED_ITEMS.map((item, i) => (
                    <div className={`sorted-item sorted-item-${i + 1}`} key={item.rank}>
                      <span className="sorted-ranking mono">{item.rank}</span>
                      <div>
                        <span className="sorted-title">{item.title}</span>
                        <span className="sorted-meta mono">{item.meta}</span>
                      </div>
                      <span className={`sev ${item.sevCls}`}>{item.sev}</span>
                    </div>
                  ))}
                </div>
                <p className="pf-after-note">Everything else gets grouped, explained, or simply waited on.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ CAPABILITIES ============ */}
        <section className="capabilities" id="capabilities">
          <div className="container">
            <div className="section-head" data-reveal>
              <span className="eyebrow neutral">What Kernveil does</span>
              <h2 className="section-title">From dark corner to clear next step</h2>
              <p className="section-lede">
                Four things, done well: see your environment, understand what actually matters,
                make sense of every finding, and move toward safe remediation.
              </p>
            </div>

            <div className="caps-grid">
              {CAPS.map((cap) => (
                <article className="cap-card" data-reveal key={cap.title}>
                  <div className="cap-visual" aria-hidden="true">{cap.visual}</div>
                  <h3 className="cap-title">{cap.title}</h3>
                  <p className="cap-desc">{cap.desc}</p>
                  <Link className="link-arrow" to={cap.link.to} tabIndex="-1">
                    {cap.link.text}
                    <LinkArrowIcon />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section className="howitsworks" id="how-it-works">
          <div className="container">
            <div className="section-head center" data-reveal>
              <span className="eyebrow">How it works</span>
              <h2 className="section-title">From first connection to clear next step</h2>
              <p className="section-lede">A calm, guided path from setup to confidence.</p>
            </div>

            <div className="steps" data-steps>
              <div className="step-track" aria-hidden="true"><div className="step-track-fill" data-step-fill></div></div>

              {STEPS.map((step) => (
                <article className="step" data-step={step.num} key={step.num}>
                  <div className="step-num" aria-hidden="true">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <ul className="step-list">
                    {step.list.map((item) => (
                      <li key={item.text}>
                        <span className={item.done ? "sev sev-resolved" : "sev sev-low"}>{item.done ? "✓" : "·"}</span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============ PRODUCT SHOWCASE ============ */}
        <section className="showcase" id="showcase">
          <div className="showcase-bg" aria-hidden="true"></div>
          <div className="container">
            <div className="section-head center" data-reveal>
              <span className="eyebrow neutral">The workspace</span>
              <h2 className="section-title">Everything you need, in one calm view</h2>
              <p className="section-lede">
                This is the actual demo workspace. Risk overview, assets, findings, remediation,
                and a plain-English plan — together on one screen.
              </p>
            </div>

            <div className="showcase-frame" data-reveal>
              {/* faithful mirror of the demo overview */}
              <div className="dash-canvas" id="dashCanvas">
                <div className="showcase-topline">
                  <span className="badge badge-teal"><span className="dot"></span>Demo workspace</span>
                  <span className="badge badge-ghost mono">Acme Retail — sample</span>
                </div>

                <div className="overview-grid">
                  <section className="panel risk-panel">
                    <span className="panel-label">Risk score</span>
                    <div className="risk-score-row">
                      <div className="gauge-sm">
                        <svg viewBox="0 0 120 120" aria-hidden="true">
                          <circle className="gauge-track" cx="60" cy="60" r="50" />
                          <circle className="gauge-value" id="scGauge" cx="60" cy="60" r="50" pathLength="100"
                            stroke="url(#gaugeGrad)" />
                        </svg>
                        <span className="gauge-center"><span className="gauge-num mono" data-count="74">0</span><span className="gauge-label">/ 100</span></span>
                      </div>
                      <div className="risk-side">
                        <p className="risk-side-text">Moderate, improving. Two issues need attention this week.</p>
                        <div className="mini-sev">
                          <span className="sev sev-critical">2 Critical</span>
                          <span className="sev sev-high">9 High</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="panel severity-panel">
                    <span className="panel-label">Findings by severity</span>
                    <div className="severity-bars">
                      <div className="sev-row"><span className="sev sev-critical">Critical</span><span className="sev-bar-track"><span className="sev-bar" data-h="28" data-c="var(--red)"></span></span><span className="mono sev-count">2</span></div>
                      <div className="sev-row"><span className="sev sev-high">High</span><span className="sev-bar-track"><span className="sev-bar" data-h="56" data-c="var(--orange)"></span></span><span className="mono sev-count">9</span></div>
                      <div className="sev-row"><span className="sev sev-medium">Medium</span><span className="sev-bar-track"><span className="sev-bar" data-h="30" data-c="var(--amber)"></span></span><span className="mono sev-count">8</span></div>
                      <div className="sev-row"><span className="sev sev-low">Low</span><span className="sev-bar-track"><span className="sev-bar" data-h="22" data-c="var(--slate)"></span></span><span className="mono sev-count">8</span></div>
                    </div>
                  </section>

                  <section className="panel remed-panel">
                    <span className="panel-label">Remediation progress</span>
                    <div className="remed-ring">
                      <svg viewBox="0 0 120 120" aria-hidden="true">
                        <circle className="gauge-track" cx="60" cy="60" r="50" pathLength="100" />
                        <circle className="gauge-value remed-arc" id="scRemed" cx="60" cy="60" r="50" pathLength="100" stroke="var(--teal)" />
                      </svg>
                      <span className="gauge-center"><span className="gauge-num mono" data-count="23">0</span><span className="gauge-label">resolved</span></span>
                    </div>
                    <p className="remed-note mono">23 of 30 findings resolved</p>
                  </section>

                  <section className="panel activity-panel">
                    <span className="panel-label">Recent activity</span>
                    <ul className="activity-list">
                      {ACTIVITY.map((a) => (
                        <li key={a.txt}><span className="activity-dot" style={{"--c": a.c}}></span><span className="activity-txt">{a.txt}</span><span className="activity-time mono">{a.time}</span></li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section className="panel next-panel">
                  <span className="panel-label">Recommended next step</span>
                  <div className="next-card">
                    <div className="next-sev"><span className="sev sev-critical">Critical</span></div>
                    <div className="next-body">
                      <span className="next-title">Tighten access to the exposed storage resource</span>
                      <p className="next-desc"><strong>Why it matters:</strong> this bucket is reachable from the public internet and holds customer backup data. Restrict it to the app's service role and confirm the public ACL is gone.</p>
                    </div>
                    <Link className="btn btn-primary btn-sm" to="/demo-finding?id=publicly-exposed-storage"><span className="ok">View in demo</span></Link>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>

        {/* ============ EXAMPLE FINDING ============ */}
        <section className="example-finding" id="example-finding">
          <div className="container">
            <div className="section-head" data-reveal>
              <span className="eyebrow">A real finding, explained</span>
              <h2 className="section-title">Findings you can actually understand</h2>
              <p className="section-lede">
                Every finding is written for a founder or generalist first, not for a dedicated
                security team. Here is an example from the demo workspace.
              </p>
            </div>

            <div className="ef-card" data-reveal>
              <header className="ef-head">
                <div className="ef-title-wrap">
                  <div className="ef-sev"><span className="sev sev-critical">Critical</span><span className="badge badge-orange">Open</span></div>
                  <h3 className="ef-title">Publicly exposed storage resource</h3>
                  <p className="ef-asset mono">Affected asset · prod-web-01 · us-east-1 / acme-retail-primary</p>
                </div>
                <Link className="btn btn-secondary btn-sm" to="/demo-finding?id=publicly-exposed-storage">
                  Open in demo
                  <ArrowIcon />
                </Link>
              </header>

              <div className="ef-body">
                <div className="ef-columns">
                  <div className="ef-detected">
                    <h4>What was detected</h4>
                    <p>The storage resource <code className="mono">acme-retail-primary</code> allows public read access. Its access-control list grants access to <code className="mono">AllUsers</code>, and the resource is reachable from the internet.</p>
                  </div>
                  <div className="ef-impact">
                    <h4>Why it matters</h4>
                    <p>This resource contains backup data for customer orders. Anyone with internet access could read it. There is no evidence the data has been accessed, but the exposure is open right now.</p>
                  </div>
                  <div className="ef-next">
                    <h4>Recommended next step</h4>
                    <p>Restrict the access-control list to the application role that owns the resource, verify the change, then re-check for public access.</p>
                  </div>
                </div>

                <div className="ef-evidence">
                  <h4>Evidence</h4>
                  <div className="evidence-block mono">
                    <span className="evidence-loc">ACL</span>
                    <code>urn:acme:storage:acme-retail-primary</code>
                    <span className="evidence-grant"><i className="gr-dot" style={{"--c": "var(--red)"}}></i> AllUsers:READ</span>
                  </div>
                  <div className="evidence-meta">
                    <span>First detected <b className="mono">Aug 28, 2026</b></span>
                    <span>Last checked <b className="mono">2 minutes ago</b></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FINAL CTA ============ */}
        <section className="final-cta" id="cta">
          <div className="final-cta-glow" aria-hidden="true"></div>
          <div className="container">
            <div className="final-cta-inner" data-reveal>
              <h2 className="final-cta-title">Know what matters before it becomes a problem.</h2>
              <p className="final-cta-sub">
                Kernveil gives growing companies a clearer way to understand and improve their security.
              </p>
              <div className="final-cta-actions">
                <Link className="btn btn-primary btn-lg" to="/demo" data-magnetic>
                  Explore the demo
                  <ArrowIcon />
                </Link>
              </div>
              <p className="final-cta-note mono">Interactive product preview · no sign-up required</p>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="site-footer" id="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <a className="brand" href="#hero" aria-label="Kernveil home">
              <BrandMark />
              <span className="brand-name">Kernveil</span>
            </a>
            <p className="footer-mission">
              Kernveil exists to make strong, continuous security understandable and attainable
              for every company, not just those with a security team.
            </p>
          </div>

          <nav className="footer-col" aria-label="Product">
            <span className="footer-col-title">Product</span>
            <a href="#capabilities">See your environment</a>
            <a href="#capabilities">Prioritize real risk</a>
            <a href="#capabilities">Understand findings</a>
            <a href="#capabilities">Remediation</a>
          </nav>

          <nav className="footer-col" aria-label="Explore">
            <span className="footer-col-title">Explore</span>
            <Link to="/demo">Overview demo</Link>
            <Link to="/demo-assets">Assets demo</Link>
            <Link to="/demo-findings">Findings demo</Link>
            <Link to="/demo-connectors">Connectors demo</Link>
          </nav>

          <nav className="footer-col" aria-label="Company">
            <span className="footer-col-title">Company</span>
            <button className="footer-link-btn" onClick={(e) => openModal("contact", e.currentTarget)}>Contact</button>
            <a href="#coverage">Coverage</a>
            <a href="#how-it-works">How it works</a>
          </nav>
        </div>

        <div className="container footer-bottom">
          <p>© 2026 Kernveil. All rights reserved.</p>
          <nav className="footer-legal" aria-label="Legal">
            <button className="footer-link-btn" onClick={(e) => openModal("privacy", e.currentTarget)}>Privacy</button>
            <button className="footer-link-btn" onClick={(e) => openModal("terms", e.currentTarget)}>Terms</button>
          </nav>
        </div>
      </footer>

      {/* ============ MODALS (sign-in / legal) ============ */}
      <div className="modal-backdrop" id="modalBackdrop" hidden={modalKey === null}></div>
      <div className="modal" id="modal" role="dialog" aria-modal="true" hidden={modalKey === null}>
        <button className="modal-close" id="modalClose" type="button" aria-label="Close dialog" onClick={closeModal}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="modal-body">
          {modalKey && <ModalContent key={modalKey} modalKey={modalKey} />}
        </div>
      </div>
    </div>
  );

  function openModal(key, opener) {
    lastFocus.current = opener;
    setModalKey(key);
  }

  function closeModal() {
    setModalKey(null);
    if (lastFocus.current) lastFocus.current.focus({ preventScroll: true });
  }
}

const MODAL_CONTENT = {
  signin: {
    label: "Product preview",
    badge: ["badge-teal", "Interactive demo"],
    title: "Kernveil is not a live app yet",
    body: "This site is an interactive product preview with seeded, clearly-fictional demo data. There are no user accounts or sign-ins to create here.",
    cta: { to: "/demo", text: "Explore the demo instead" },
  },
  contact: {
    label: "Contact",
    title: "We are still building.",
    body: "Kernveil is in development and not accepting sign-ups yet. You can explore the interactive product preview now; when accounts open, they will be announced here.",
  },
  privacy: {
    label: "Privacy",
    title: "Privacy",
    body: "This site stores no personal data and sets no tracking cookies. The demo uses only local, seeded data that lives in your browser. No visitor information is collected or shared.",
  },
  terms: {
    label: "Terms",
    title: "Terms of use",
    body: "The interactive product preview on this site shows fictional example data for illustration. It is not a security assessment, does not scan your systems, and should not be used as the basis for any security decision.",
  },
};

function ModalContent({ modalKey }) {
  const c = MODAL_CONTENT[modalKey] || MODAL_CONTENT.terms;
  const badge = c.badge
    ? `<span class="badge ${c.badge[0]}"><span class="dot"></span>${c.badge[1]}</span>`
    : `<span class="badge badge-teal"><span class="dot"></span>${c.label}</span>`;
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: badge }} />
      <h3>{c.title}</h3>
      <p>{c.body}</p>
      <div className="modal-actions">
        {c.cta ? (
          <Link className="btn btn-primary" to={c.cta.to}>
            {c.cta.text}
            <ArrowIcon />
          </Link>
        ) : (
          <a className="btn btn-secondary" href="#hero">Back to the site</a>
        )}
      </div>
    </>
  );
}