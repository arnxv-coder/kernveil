/* ============================================================
   Kernveil — demo Overview page
   ============================================================ */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { animate } from "motion";
import { gsap, reducedMotion } from "../../lib/anim.jsx";
import { RISK_SERIES } from "../../lib/data.js";
import { useDashboardFx } from "../../hooks/useDashboardFx.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

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

export default function DemoOverview() {
  const rootRef = useRef(null);
  useDashboardFx(rootRef);
  const { overview: o, activity } = useWorkspace();

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Overview</h1>
        <p className="page-sub">Risk posture, priority findings, and what changed — at a glance.</p>
      </header>

      <div className="kpi-grid" data-reveal-group>
        <div className="kpi" style={{ "--kpi-c": "var(--teal)" }}>
          <span className="kpi-val" data-count={o.risk}>0</span>
          <span className="kpi-label">Risk score <span className="kpi-delta">▼ 6 this month</span></span>
        </div>
        <div className="kpi" style={{ "--kpi-c": "var(--red)" }}>
          <span className="kpi-val" data-count={o.critical}>0</span>
          <span className="kpi-label"><span className="sev sev-critical">Critical</span></span>
        </div>
        <div className="kpi" style={{ "--kpi-c": "var(--orange)" }}>
          <span className="kpi-val" data-count={o.high}>0</span>
          <span className="kpi-label"><span className="sev sev-high">High</span></span>
        </div>
        <div className="kpi" style={{ "--kpi-c": "var(--cyan)" }}>
          <span className="kpi-val" data-count={o.assets}>0</span>
          <span className="kpi-label">Total assets</span>
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
                Moderate and trending down. Two findings need attention this week — both affect <span className="mono">prod-web-01</span> traffic.
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

      <section className="panel recommend-panel">
        <span className="panel-label">Recommended next step</span>
        <div className="recommend-body">
          <div className="recommend-action">
            <ol>
              <li>Restrict <code className="mono">acme-retail-primary</code> to the app's service role.</li>
              <li>Verify public access is removed (auto re-check).</li>
              <li>Confirm customer backup data is no longer reachable.</li>
            </ol>
            <p className="remed-note" style={{ textAlign: "left", marginTop: "1rem" }}>This closes your only Critical finding.</p>
          </div>
          <div className="recommend-why">
            <p>
              <strong style={{ color: "var(--text-1)" }}>Why this first:</strong> the exposed storage resource holds customer order backups
              and is publicly readable right now. It is the highest-leverage fix available and unblocks the rest of the queue.
            </p>
            <div className="recommend-explainer mono">Affected assets: acme-retail-primary · prod-web-01 · backup-system</div>
            <p style={{ marginTop: "0.9rem" }}>
              <Link className="link-arrow" to="/demo-finding?id=publicly-exposed-storage">
                Open the finding
                <svg className="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </p>
          </div>
        </div>
      </section>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }}>
        Demo workspace — every number and asset on this page is fictional sample data.
      </p>
    </div>
  );
}