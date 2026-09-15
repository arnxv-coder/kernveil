/* ============================================================
   Kernveil — demo Overview page.
   A single, unified risk-prioritisation view across every source:
   the seeded sample data, GitHub dependency scans, and cloud
   exposure fixtures all live in one findings model below. The most
   important unresolved finding is always surfaced first.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { animate } from "motion";
import { gsap, reducedMotion, SEV_RANK, CONN_ICONS } from "../../lib/anim.jsx";
import { RISK_SERIES } from "../../lib/data.js";
import { severityPill, statusBadge } from "../../components/demo/badges.jsx";
import { CONN_STATE_META, connStatusFor, lastSyncText } from "../../lib/connectors.js";
import { normalizeStatus, STATUS_ORDER } from "../../lib/remediation.js";
import { useDashboardFx } from "../../hooks/useDashboardFx.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

/* ------------------------------------------------------------------
   Priority model — every finding ranks by remediation status first,
   then severity, then business impact, then recency.
   ------------------------------------------------------------------ */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sourceOf(f) {
  if (f.source === "github-connector") return "github";
  if (f.source === "cloud-fixture") return "cloud";
  if (f.source === "website-fixture") return "website";
  if (f.source === "backup-fixture") return "backup";
  return "sample";
}

const SRC_META = {
  github: { label: "GitHub", dot: "var(--slate)" },
  cloud: { label: "Cloud", dot: "var(--teal)" },
  website: { label: "Website", dot: "var(--cyan)" },
  backup: { label: "Backup", dot: "var(--green)" },
  sample: { label: "Sample", dot: "var(--amber)" },
};

/* STATUS_ORDER comes from remediation.js — proposed/rejected first, completed last. */

function impactTier(impact) {
  const s = String(impact || "").toLowerCase();
  if (/data at rest|data exposure|customer-facing outage|auth bypass|cross-origin/.test(s)) return 2;
  if (/blast radius|supply-chain|credential|availability|disclosure/.test(s)) return 1;
  return 0;
}

function prioLevel(f) {
  if (f.severity === "critical") return 1;
  if (f.severity === "high" && impactTier(f.impact) >= 1) return 1;
  if (f.severity === "high") return 2;
  if (f.severity === "medium" && impactTier(f.impact) === 2) return 2;
  return 3;
}

const PRIO_LABEL = { 1: "P1", 2: "P2", 3: "P3" };

function parseDate(s) {
  if (!s) return 0;
  const m = String(s).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\D+(\d{1,2})\D+(\d{4})/i);
  if (!m) return 0;
  const d = new Date(Number(m[3]), MONTHS.indexOf(m[1]), Number(m[2]));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function priorityRows(list) {
  return list.slice().sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 3;
    const sb = STATUS_ORDER[b.status] ?? 3;
    if (sa !== sb) return sa - sb;
    const pa = prioLevel(a);
    const pb = prioLevel(b);
    if (pa !== pb) return pa - pb;
    const ea = SEV_RANK[a.severity];
    const eb = SEV_RANK[b.severity];
    if (ea !== eb) return ea - eb;
    const ia = impactTier(a.impact);
    const ib = impactTier(b.impact);
    if (ia !== ib) return ib - ia;
    return (parseDate(b.first) || 0) - (parseDate(a.first) || 0);
  });
}

/* ------------------------------ trend chart ----------------------------- */

function trendGeometry() {
  const W = 820;
  const H = 200;
  const P = { l: 8, r: 8, t: 14, b: 6 };
  const data = RISK_SERIES;
  const max = 50;
  const x = (i) => P.l + (i / (data.length - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const pts = data.map((d, i) => [x(i), y(d.value)]);

  const last = data[data.length - 1].value;
  const prev = data[data.length - 2].value;
  const slope = last - prev;
  const proj = [0, 1, 2, 3].map((k) => {
    const v = Math.max(0, last + slope * (k + 1) * 0.8);
    return [x(data.length - 1 + k + 1) || x(data.length - 1), y(v)];
  });

  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
  const projLine = `M${pts[pts.length - 1][0]},${pts[pts.length - 1][1]} ${proj.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}`;
  const grid = [0.25, 0.5, 0.75].map((f) => ({
    y1: P.t + (1 - f) * (H - P.t - P.b),
    y2: P.t + (1 - f) * (H - P.t - P.b),
  }));
  return { W, H, P, line, area, projLine, grid, pts };
}

function TrendChart() {
  const boxRef = useRef(null);
  const G = trendGeometry();

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const REDUCED = reducedMotion();
    const main = box.querySelector("#trendLineMain");
    const area = box.querySelector(".trend-area");
    const proj = box.querySelector(".trend-line-proj");
    const points = box.querySelectorAll(".trend-point");
    if (!main || !area || !proj) return undefined;

    if (REDUCED) {
      main.style.strokeDasharray = "none";
      main.style.strokeDashoffset = "0";
      area.style.opacity = "1";
      return undefined;
    }

    main.style.strokeDasharray = "100";
    main.style.strokeDashoffset = "100";
    const c1 = animate(main, { strokeDashoffset: 0, opacity: 1 }, { duration: 1.7, ease: [0.6, 0.05, 0.3, 1] });
    const c2 = animate(proj, { opacity: 0.8 }, { duration: 0.4, delay: 1.4 });
    const c3 = animate(area, { opacity: 1 }, { duration: 0.9, delay: 1.2 });
    const tween = gsap.fromTo(
      points,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.8)", stagger: 0.05, delay: 1.25 }
    );
    return () => {
      c1.stop();
      c2.stop();
      c3.stop();
      tween.kill();
    };
  }, []);

  const lastIdx = G.pts.length - 1;
  return (
    <div id="trendChartBox" ref={boxRef}>
      <svg
        className="trend-svg"
        viewBox={`0 0 ${G.W} ${G.H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7ddbf4" />
            <stop offset="1" stopColor="#2ae6c7" />
          </linearGradient>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(42,230,199,0.22)" />
            <stop offset="1" stopColor="rgba(42,230,199,0)" />
          </linearGradient>
        </defs>
        {G.grid.map((g, i) => (
          <line
            key={i}
            className="trend-gridline"
            x1={G.P.l}
            y1={g.y1.toFixed(1)}
            x2={G.W - G.P.r}
            y2={g.y2.toFixed(1)}
          />
        ))}
        <path className="trend-area" d={G.area} fill="url(#chartFill)" style={{ opacity: 0 }} />
        <path className="trend-line-bg" d={G.line} />
        <path id="trendLineMain" className="trend-line-main" d={G.line} pathLength="100" style={{ opacity: 1 }} />
        <path className="trend-line-proj" d={G.projLine} pathLength="100" style={{ opacity: 0 }} />
        {G.pts.map((p, i) => (
          <circle
            key={i}
            className="trend-point"
            cx={p[0].toFixed(1)}
            cy={p[1].toFixed(1)}
            r={i === lastIdx ? 4.4 : 3.2}
          />
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------- page ------------------------------- */

export default function DemoOverview() {
  const rootRef = useRef(null);
  const queueRef = useRef(null);
  useDashboardFx(rootRef);
  const { findings: allFindings, assets, overview: o, activity, connectors, cloudScans, webScans, backupScans } = useWorkspace();

  const [term, setTerm] = useState("");
  const [sev, setSev] = useState("all");
  const [src, setSrc] = useState("all");
  const [status, setStatus] = useState("all");
  const [asset, setAsset] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return allFindings.filter((f) => {
      if (sev !== "all" && f.severity !== sev) return false;
      if (src !== "all" && sourceOf(f) !== src) return false;
      if (status !== "all" && f.status !== status) return false;
      if (asset !== "all" && f.asset !== asset) return false;
      if (q && !(f.title + f.asset + (f.summary || "") + f.category).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allFindings, sev, src, status, asset, term]);

  const rows = useMemo(() => priorityRows(filtered), [filtered]);
  const rowsKey = rows.map((f) => f.id).join(",");

  const srcCounts = useMemo(() => {
    const c = { github: 0, cloud: 0, website: 0, backup: 0, sample: 0 };
    for (const f of allFindings) c[sourceOf(f)] += 1;
    return c;
  }, [allFindings]);

  const assetOptions = useMemo(() => {
    const map = new Map();
    for (const f of allFindings) {
      if (!map.has(f.asset)) {
        const name = (assets.find((a) => a.id === f.asset) || {}).name || f.asset;
        map.set(f.asset, { id: f.asset, name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allFindings, assets]);

  const assetName = (id) => (assets.find((a) => a.id === id) || {}).name || id;

  const topOpen = useMemo(
    () => priorityRows(allFindings.filter((f) => f.status !== "completed"))[0] || null,
    [allFindings]
  );
  const isGlobalTopOnList = !!(topOpen && rows[0] && topOpen.id === rows[0].id);

  const openCount = allFindings.filter((f) => f.status !== "completed").length;

  const openForSource = (s) =>
    allFindings.reduce((n, f) => (sourceOf(f) === s && f.status !== "completed" ? n + 1 : n), 0);

  const healthRows = useMemo(() => {
    const gh = connectors.find((c) => c.kind === "github");
    const cloud = cloudScans[0];
    const web = webScans[0];
    const backup = backupScans[0];
    const websiteSample = { kind: "website", mode: "sample", lastScanAt: Date.now() - 62 * 60e3 };
    return [
      {
        id: "github",
        name: "GitHub",
        status: connStatusFor({ record: gh, openCount: openForSource("github") }),
        last: lastSyncText(gh),
        open: openForSource("github"),
      },
      {
        id: "cloud",
        name: "Cloud environment",
        status: connStatusFor({ record: cloud, openCount: openForSource("cloud") }),
        last: lastSyncText(cloud),
        open: openForSource("cloud"),
      },
      {
        id: "website",
        name: "Website",
        status: connStatusFor({ record: web || websiteSample, openCount: web ? openForSource("website") : 2 }),
        last: lastSyncText(web || websiteSample),
        open: web ? openForSource("website") : 2,
      },
      {
        id: "backup",
        name: "Backup system",
        status: connStatusFor({ record: backup, openCount: openForSource("backup") }),
        last: lastSyncText(backup),
        open: openForSource("backup"),
      },
      { id: "identity", name: "Identity provider", status: "planned", last: "—", open: 0 },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFindings, connectors, cloudScans, webScans, backupScans]);

  /* Remediation progress — count per workflow status, plus actions that
     have been sitting unresolved longer than a week. */
  const statusCounts = useMemo(() => {
    const c = { open: 0, "awaiting-approval": 0, approved: 0, rejected: 0, "in-progress": 0, failed: 0, completed: 0 };
    for (const f of allFindings) c[normalizeStatus(f.status)] += 1;
    return c;
  }, [allFindings]);

  const overdue = useMemo(
    () =>
      allFindings.filter((f) => {
        const s = normalizeStatus(f.status);
        if (s === "completed") return false;
        const age = Date.now() - parseDate(f.first);
        return age > 7 * 24 * 60 * 60 * 1000;
      }).length,
    [allFindings]
  );

  useEffect(() => {
    const list = queueRef.current;
    if (!list || !rows.length) return;
    const ctx = gsap.context(() => {
      if (reducedMotion()) {
        gsap.set(list.children, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(list.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.34, ease: "power2.out", stagger: 0.035 });
      }
    }, list);
    return () => ctx.revert();
  }, [rowsKey]);

  const openDetail = (id) => window.location.assign(`/demo-finding?id=${id}`);

  const toggleSrc = (key) => setSrc((prev) => (prev === key ? "all" : key));

  const Seg = ({ dataKey, value, onChange, options }) => (
    <div className="seg" data-key={dataKey} role="group" aria-label={`Filter by ${dataKey}`}>
      {options.map((o) => (
        <button key={o.key} type="button" className={value === o.key ? "is-active" : undefined} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const anyFindings = allFindings.length > 0;

  const sources = ["all", "github", "cloud", "website", "backup", "sample"];

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Overview</h1>
        <p className="page-sub">Every finding across GitHub, cloud, your websites, and backup health, prioritized by what matters most — at a glance.</p>
      </header>

      {!anyFindings ? (
        <div className="empty-state" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--surface-1)" }}>
          <div className="empty-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3l8 3.5v5c0 4.6-3.2 8.1-8 9.5-4.8-1.4-8-4.9-8-9.5v-5L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3>No findings yet</h3>
          <p>Connect a repository or import a cloud fixture to start tracking risk here.</p>
        </div>
      ) : (
        <>
          <div className="kpi-grid" data-reveal-group>
            <div className="kpi" style={{ "--kpi-c": "var(--teal)" }}>
              <span className="kpi-val" data-count={o.risk}>0</span>
              <span className="kpi-label">Risk score <span className="kpi-delta">▼ 6 this month</span></span>
            </div>
            <div className="kpi" style={{ "--kpi-c": "var(--red)" }}>
              <span className="kpi-val" data-count={o.critical + o.high}>0</span>
              <span className="kpi-label">
                <span className="sev sev-critical">Critical + High</span>
                <span className="kpi-sub">{o.critical} critical · {o.high} high</span>
              </span>
            </div>
            <div className="kpi" style={{ "--kpi-c": "var(--orange)" }}>
              <span className="kpi-val" data-count={o.open}>0</span>
              <span className="kpi-label"><span className="sev sev-orange">Open findings</span></span>
            </div>
            <div className="kpi" style={{ "--kpi-c": "var(--cyan)" }}>
              <span className="kpi-val" data-count={o.assets}>0</span>
              <span className="kpi-label">Affected assets</span>
            </div>
          </div>

          <div className="overview-grid" data-reveal-group>
            <section className="panel risk-panel">
              <span className="panel-label">Risk score</span>
              <div className="risk-score-row">
                <div className="gauge-sm">
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <defs>
                      <linearGradient id="dashGauge" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0" stopColor="#ef6a72" />
                        <stop offset="0.45" stopColor="#f4b64a" />
                        <stop offset="1" stopColor="#2ae6c7" />
                      </linearGradient>
                    </defs>
                    <circle className="gauge-track" cx="60" cy="60" r="50" />
                    <circle
                      className="gauge-value dash-gauge"
                      cx="60" cy="60" r="50"
                      pathLength="100"
                      stroke="url(#dashGauge)"
                      data-offset={100 - o.risk}
                    />
                  </svg>
                  <span className="gauge-center">
                    <span className="gauge-num mono" data-count={o.risk}>0</span>
                    <span className="gauge-label">/ 100</span>
                  </span>
                </div>
                <div className="risk-side">
                  <p className="risk-side-text">
                    {topOpen ? (
                      <>
                        Top priority: <span className="mono">{topOpen.title}</span>.{" "}
                        {topOpen.severity === "critical"
                          ? "It is the highest-leverage fix available — resolve it before anything else in the queue."
                          : "Address it, then work down the queue."}
                      </>
                    ) : (
                      "Nothing unresolved right now — the queue is clean."
                    )}
                  </p>
                  <div className="mini-sev">
                    <span className="sev sev-critical">{o.critical} Critical</span>
                    <span className="sev sev-high">{o.high} High</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel severity-panel">
              <span className="panel-label">Findings by severity</span>
              <div className="severity-bars">
                <div className="sev-row"><span className="sev sev-critical">Critical</span><span className="sev-bar-track"><span className="sev-bar dash-sev" data-h="28" data-c="var(--red)"></span></span><span className="mono sev-count" data-count={o.critical}>0</span></div>
                <div className="sev-row"><span className="sev sev-high">High</span><span className="sev-bar-track"><span className="sev-bar dash-sev" data-h="56" data-c="var(--orange)"></span></span><span className="mono sev-count" data-count={o.high}>0</span></div>
                <div className="sev-row"><span className="sev sev-medium">Medium</span><span className="sev-bar-track"><span className="sev-bar dash-sev" data-h="30" data-c="var(--amber)"></span></span><span className="mono sev-count" data-count={o.medium}>0</span></div>
                <div className="sev-row"><span className="sev sev-low">Low</span><span className="sev-bar-track"><span className="sev-bar dash-sev" data-h="22" data-c="var(--slate)"></span></span><span className="mono sev-count" data-count={o.low}>0</span></div>
              </div>
            </section>

            <section className="panel remed-panel">
              <span className="panel-label">Remediation progress</span>
              <div className="remed-ring">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="gauge-track" cx="60" cy="60" r="50" pathLength="100" />
                  <circle className="gauge-value dash-remed" cx="60" cy="60" r="50" pathLength="100" stroke="var(--teal)" data-offset={100 - o.resolved} />
                </svg>
                <span className="gauge-center">
                  <span className="gauge-num mono" data-count={o.resolved}>0</span>
                  <span className="gauge-label">resolved</span>
                </span>
              </div>
              <p className="remed-note mono">{o.resolved} of {o.total} findings resolved</p>
              <div className="remed-rows">
                <div className="remed-row"><span className="remed-dot" style={{ background: "var(--red)" }}></span><span>Proposed</span><b className="mono">{statusCounts.open}</b></div>
                <div className="remed-row"><span className="remed-dot" style={{ background: "var(--amber)" }}></span><span>Awaiting approval</span><b className="mono">{statusCounts["awaiting-approval"]}</b></div>
                <div className="remed-row"><span className="remed-dot" style={{ background: "var(--cyan)" }}></span><span>Approved</span><b className="mono">{statusCounts.approved}</b></div>
                <div className="remed-row"><span className="remed-dot" style={{ background: "var(--teal)" }}></span><span>In progress</span><b className="mono">{statusCounts["in-progress"]}</b></div>
                <div className="remed-row"><span className="remed-dot" style={{ background: "var(--orange)" }}></span><span>Failed</span><b className="mono">{statusCounts.failed}</b></div>
                <div className="remed-row"><span className="remed-dot" style={{ background: "var(--green)" }}></span><span>Completed</span><b className="mono">{statusCounts.completed}</b></div>
              </div>
              {overdue > 0 && (
                <p className="overdue-line">
                  {overdue} unresolved action{overdue === 1 ? "" : "s"} older than a week — review the priority queue.
                </p>
              )}
            </section>

            <section className="panel activity-panel">
              <span className="panel-label">Recent activity</span>
              <ul className="activity-list">
                {activity.map((a) => (
                  <li key={a.id}>
                    <span className="activity-dot" style={{ "--c": a.c }}></span>
                    <span className="activity-txt">{a.txt}</span>
                    <span className="activity-time mono">{a.t}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="panel chart-panel">
            <span className="panel-label">Risk trend</span>
            <TrendChart />
            <div className="chart-labels">
              <span>Jun 2025</span>
              <span id="trendLegendRight">Today</span>
            </div>
          </section>

          {/* ---------- unified priority queue ---------- */}
          <section className="panel queue-panel" id="priorityQueue">
            <div className="queue-top">
              <div className="queue-head">
                <span className="panel-label">Priority queue</span>
                <span className="queue-sub mono" id="queueSub">{rows.length} of {allFindings.length} findings · {openCount} open</span>
              </div>
              <div className="queue-sources" id="queueSources" role="group" aria-label="Findings by source">
                {sources.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`chip${src === k ? " is-active" : ""}`}
                    aria-pressed={src === k}
                    onClick={() => toggleSrc(k)}
                  >
                    {k === "all" ? "All sources" : SRC_META[k].label}
                    {k !== "all" && (
                      <span className="chip-count" data-src={k}>{srcCounts[k]}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="queue-filters">
              <div className="search-field">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <label className="visually-hidden" htmlFor="queueSearch">Search the priority queue</label>
                <input id="queueSearch" type="search" placeholder="Search the queue…" autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)} />
              </div>

              <Seg
                dataKey="severity"
                value={sev}
                onChange={setSev}
                options={[
                  { key: "all", label: "All" },
                  { key: "critical", label: "Critical" },
                  { key: "high", label: "High" },
                  { key: "medium", label: "Medium" },
                  { key: "low", label: "Low" },
                ]}
              />

              <div className="chip-set" role="group" aria-label="Filter by remediation status">
                {[
                  { key: "all", label: "All statuses" },
                  { key: "open", label: "Proposed" },
                  { key: "awaiting-approval", label: "Awaiting approval" },
                  { key: "approved", label: "Approved" },
                  { key: "rejected", label: "Rejected" },
                  { key: "in-progress", label: "In progress" },
                  { key: "failed", label: "Failed" },
                ].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={`chip${status === o.key ? " is-active" : ""}`}
                    aria-pressed={status === o.key}
                    onClick={() => setStatus(o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="select-field">
                <label className="visually-hidden" htmlFor="queueAsset">Filter by affected asset</label>
                <select id="queueAsset" value={asset} onChange={(e) => setAsset(e.target.value)}>
                  <option value="all">All assets</option>
                  {assetOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="queue-loading" id="queueLoading" role="status" aria-live="polite">
                <span className="scan-spinner" aria-hidden="true"></span>
                <span>Reading your risk view…</span>
              </div>
            ) : !rows.length ? (
              <div className="empty-state" id="queueEmpty">
                <div className="empty-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M9 4h6l4 4v12H5V4h4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M9 4v4h6V4M8 13l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>No findings match</h3>
                <p>Try a different search term or loosen a filter.</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTerm(""); setSev("all"); setSrc("all"); setStatus("all"); setAsset("all"); }}>
                  Clear all filters
                </button>
              </div>
            ) : (
              <ul className="queue-list" id="queueList" ref={queueRef}>
                {rows.map((f, i) => {
                  const s = sourceOf(f);
                  const meta = SRC_META[s];
                  const topFlag = i === 0 && isGlobalTopOnList;
                  return (
                    <li
                      key={f.id}
                      className={`queue-item${topFlag ? " is-top" : ""}`}
                      data-id={f.id}
                      tabIndex="0"
                      role="button"
                      aria-label={`Open finding: ${f.title}`}
                      onClick={() => openDetail(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(f.id);
                        }
                      }}
                    >
                      <span className={`prio-chip prio-${prioLevel(f)}`} aria-label={`Priority ${PRIO_LABEL[prioLevel(f)]}`}>{PRIO_LABEL[prioLevel(f)]}</span>
                      <span className="queue-main">
                        <span className="queue-title">{f.title}</span>
                        <span className="cell-sub" style={{ marginTop: 0 }}>
                          {f.category}{f.impact ? ` · ${f.impact}` : ""}
                        </span>
                        {topFlag && <span className="queue-top-flag">Top priority</span>}
                      </span>
                      <span className="queue-asset">{assetName(f.asset)}</span>
                      <span>{severityPill(f.severity)}</span>
                      <span className="queue-src">
                        <span className="qdot" style={{ background: meta.dot }}></span>
                        {meta.label}
                      </span>
                      {statusBadge(f.status)}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel recommend-panel">
            <span className="panel-label">Recommended next step</span>
            {topOpen ? (
              <div className="recommend-body">
                <div className="recommend-action">
                  <ol>
                    {(topOpen.steps || []).slice(0, 3).map((s, i) => (
                      <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
                    ))}
                  </ol>
                  <p className="remed-note" style={{ textAlign: "left", marginTop: "1rem" }}>
                    This closes your top {topOpen.severity} finding ({assetName(topOpen.asset)}).
                  </p>
                </div>
                <div className="recommend-why">
                  <p>
                    <strong style={{ color: "var(--text-1)" }}>Why this first:</strong>{" "}
                    <span dangerouslySetInnerHTML={{ __html: topOpen.why }} />
                  </p>
                  <div className="recommend-explainer mono">
                    Affected asset: {topOpen.asset} · priority {PRIO_LABEL[prioLevel(topOpen)]}
                  </div>
                  <p style={{ marginTop: "0.9rem" }}>
                    <Link className="link-arrow" to={`/demo-finding?id=${topOpen.id}`} id="recommendLink">
                      Open the finding
                      <svg className="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </p>
                </div>
              </div>
            ) : (
              <p className="remed-note">Nothing needs your attention right now.</p>
            )}
          </section>

          <section className="panel health-panel" id="connectorHealth">
            <span className="panel-label">Connector health</span>
            <div className="health-list">
              {healthRows.map((row) => {
                const meta = CONN_STATE_META[row.status];
                return (
                  <div className="health-row" key={row.id}>
                    <span className="conn-icon conn-icon-sm" aria-hidden="true">{CONN_ICONS[row.id] || ""}</span>
                    <span className="health-name">{row.name}</span>
                    <span className="health-meta">
                      <span className={`badge ${meta.cls}`}>{meta.label}</span>
                      <span className="health-last mono">last sync {row.last}</span>
                      <span className="health-open mono">{row.open ? `${row.open} open` : "0 open"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }}>
        Demo workspace — sample data plus anything you import stays in this browser. No live cloud or repository is monitored.
      </p>
    </div>
  );
}