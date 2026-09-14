/* ============================================================
   Kernveil — demo Connectors page
   ============================================================ */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion, CONN_ICONS } from "../../lib/anim.jsx";
import { CONNECTORS } from "../../lib/data.js";

const CONN_STATE = {
  available: {
    badge: <span className="badge badge-teal"><span className="dot"></span>Available in demo</span>,
    status: <div className="conn-status-line"><span className="status-dot"></span>Simulated connection · sample data</div>,
    action: (
      <Link className="btn btn-secondary btn-sm" to="/demo-findings">
        View sample findings
        <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    ),
    metrics(c) {
      const m = {
        github: [["Repos monitored", "4"], ["Findings", "5"]],
        cloud: [["Assets", "8"], ["Findings", "9"]],
        website: [["Pages checked", "6"], ["Findings", "2"]],
      }[c.id] || [];
      return m.map(([l, v], i) => <span key={i}><b>{v}</b>{l}</span>);
    },
  },
  planned: {
    badge: <span className="badge badge-slate">Planned connector</span>,
    status: <div className="conn-status-line" style={{ color: "var(--text-disabled)" }}>Designed for — not available in this demo</div>,
    action: <button className="btn btn-ghost btn-sm" type="button" disabled>Planned</button>,
    metrics() { return null; },
  },
  coming: {
    badge: <span className="badge badge-ghost">Coming soon</span>,
    status: <div className="conn-status-line" style={{ color: "var(--text-disabled)" }}>On the roadmap</div>,
    action: <button className="btn btn-ghost btn-sm" type="button" disabled>Coming soon</button>,
    metrics() { return null; },
  },
};

export default function DemoConnectors() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const cards = root.querySelectorAll(".conn-card");
      if (REDUCED) {
        gsap.set(cards, { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(cards, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08, delay: 0.1 });
      gsap.fromTo(
        cards,
        { boxShadow: "0 0 0 1px rgba(148,180,225,0.1)" },
        { boxShadow: "0 0 0 1px rgba(148,180,225,0.2), var(--shadow-sm)", duration: 0.45, ease: "power1.out", stagger: 0.08, delay: 0.32 }
      );
    }, root);
    return () => ctx.revert();
  }, [rootRef, REDUCED]);

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Connectors</h1>
        <p className="page-sub">The systems Kernveil is designed to understand. This demo simulates sample connectors — nothing is actually connected.</p>
      </header>

      <div className="conn-grid" id="connGrid">
        {CONNECTORS.map((c) => {
          const s = CONN_STATE[c.state];
          return (
            <article className={`conn-card${c.state !== "available" ? " is-planned" : ""}`} key={c.id} data-conn>
              <div className="conn-head">
                <span className="conn-icon" aria-hidden="true">{CONN_ICONS[c.id] || ""}</span>
                <div>
                  <span className="conn-name">{c.name}</span>
                  <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>{c.type}</span>
                </div>
              </div>
              <p className="conn-desc">{c.desc}</p>
              {c.state === "available" && <div className="conn-metrics">{s.metrics(c)}</div>}
              {s.status}
              <div className="conn-actions" style={{ marginTop: "1rem" }}>
                {s.action}{s.badge}
              </div>
            </article>
          );
        })}
      </div>

      <div className="conn-legend">
        <span style={{ "--lg-c": "var(--teal)" }}>Available in this demo (simulated)</span>
        <span style={{ "--lg-c": "var(--slate)" }}>Planned connector</span>
        <span style={{ "--lg-c": "var(--text-disabled)" }}>Coming soon</span>
      </div>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }}>
        No external service is connected. All connector data shown is fictional sample data.
      </p>
    </div>
  );
}