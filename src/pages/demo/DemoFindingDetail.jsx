/* ============================================================
   Kernveil — demo Finding detail page
   ============================================================ */
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { gsap, reducedMotion, TYPE_ICONS } from "../../lib/anim.jsx";
import { FINDINGS, ASSETS } from "../../lib/data.js";
import { severityPill, statusBadge } from "../../components/demo/badges.jsx";

export default function DemoFindingDetail() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const id = params.get("id");
  const f = FINDINGS.find((x) => x.id === id);

  const related = (f?.related || [])
    .map((rid) => {
      const a = ASSETS.find((x) => x.id === rid);
      if (!a) return null;
      return (
        <li className="related-asset" style={{ listStyle: "none" }} key={rid}>
          <span className="type-icon" aria-hidden="true">{TYPE_ICONS[a.type] || ""}</span>
          <div>
            <span className="related-asset-name">{a.name}</span>
            <span className="related-asset-env mono" style={{ display: "block" }}>{a.env} · {a.source}</span>
          </div>
        </li>
      );
    })
    .filter(Boolean);

  const history = (f?.history || []).map((h, i) => (
    <li className="history-item" style={{ "--his-c": h.c, listStyle: "none" }} key={i}>
      <span className="history-title">{h.text}</span>
      <span className="history-time">{h.time}</span>
    </li>
  ));

  const evidence = (f?.evidence || [])
    .map((e, i) => (
      <span key={i}>
        <span className="ek">{e.key}</span>: <span className="ev">{e.value}</span>
        {i < f.evidence.length - 1 ? "\n" : null}
      </span>
    ));

  const steps =
    f && f.steps && f.steps.length
      ? <div className="detail-block action-block" style={{ marginTop: 0 }}>
          <h4>Recommended next step</h4>
          <div className="action-steps">
            {f.steps.map((s, i) => <div className="action-step" key={i}><p>{s}</p></div>)}
          </div>
        </div>
      : <div className="detail-block" style={{ marginTop: 0 }}>
          <h4>Recommended next step</h4>
          <p>This finding is already resolved. Nothing to do — Kernveil will let you know if it reappears.</p>
        </div>;

  const boxRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ctx = gsap.context(() => {
      if (REDUCED) {
        gsap.set(box.children, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(box.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.09 });
        gsap.fromTo(
          ".history-item",
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.4, ease: "power2.out", stagger: 0.1, delay: 0.45 }
        );
      }
    }, box);
    return () => ctx.revert();
  }, [id, REDUCED]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/demo-findings");
    }
  };

  return (
    <div ref={rootRef}>
      <button className="detail-back" id="detailBack" type="button" onClick={goBack}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to findings
      </button>

      <div id="findingDetail" ref={boxRef}>
        {!f ? (
          <div className="empty-state" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-lg)", background: "var(--surface-1)" }}>
            <div className="empty-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Finding not found</h3>
            <p>This demo finding doesn’t exist. Pick any finding from the list.</p>
            <p style={{ marginTop: "1.1rem" }}><Link className="btn btn-primary btn-sm" to="/demo-findings">Browse findings</Link></p>
          </div>
        ) : (
          <>
            <div className="detail-head">
              <div>
                <div className="detail-sev-labels">
                  {severityPill(f.severity)}
                  {statusBadge(f.status)}
                </div>
                <h1 className="detail-title">{f.title}</h1>
                <div className="detail-meta">
                  <span>Affected asset <b>{f.asset}</b></span>
                  <span>Category <b>{f.category}</b></span>
                  <span>First detected <b>{f.first}</b></span>
                  <span>Last checked <b>{f.last}</b></span>
                </div>
              </div>
              <div className="recommend-explainer mono" style={{ maxWidth: 280 }}>
                {f.summary}
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-cols">
                <div className="panel detail-block">
                  <h4>What was detected</h4>
                  <p dangerouslySetInnerHTML={{ __html: f.detected }} />
                </div>

                <div className="panel detail-block">
                  <h4>Why it matters</h4>
                  {f.impact && <span className="impact-badge"><i></i>{f.impact}</span>}
                  <p dangerouslySetInnerHTML={{ __html: f.why }} />
                </div>

                <div className="panel detail-block">
                  <h4>Evidence</h4>
                  <pre className="evidence-code">{evidence}</pre>
                </div>
              </div>

              <div className="detail-col-stack">
                {steps}

                <div className="panel detail-block">
                  <h4>Related assets</h4>
                  <div style={{ display: "grid", gap: "0.5rem" }}>{related}</div>
                </div>

                <div className="panel detail-block">
                  <h4>Finding history</h4>
                  <ol className="history-list" style={{ margin: 0 }}>{history}</ol>
                </div>
              </div>
            </div>

            <p className="result-count" style={{ marginTop: "1.4rem", textAlign: "center" }}>
              Demo finding — fictional sample data for illustration.
            </p>
          </>
        )}
      </div>
    </div>
  );
}