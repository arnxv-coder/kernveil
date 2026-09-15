/* ============================================================
   Kernveil — demo Finding detail page
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { gsap, reducedMotion, TYPE_ICONS } from "../../lib/anim.jsx";
import { severityPill, statusBadge } from "../../components/demo/badges.jsx";
import ActionModal from "../../components/demo/ActionModal.jsx";
import { NEXT_ACTIONS, remediationOf } from "../../lib/remediation.js";
import { ACTION_NEXT, KIND_META, EXEC_META, baseActionsFor, dataStatusMeta } from "../../lib/remediationActions.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

const STATUS_NOTE = {
  open: "This finding has a proposed remediation. Route it through approval, or start working on it directly. Everything stays inside this demo workspace.",
  "awaiting-approval": "The remediation draft is waiting on a decision. Approve it to queue the change, or reject the proposal.",
  approved: "This change is approved and queued. Mark it in progress once execution begins.",
  rejected: "The proposal was rejected. Resubmit it, or proceed without approval.",
  "in-progress": "Remediation is underway. Mark it completed once the check clears — or failed if it doesn't.",
  completed: "This finding is closed. Kernveil keeps monitoring and will re-propose it if the issue returns.",
  failed: "The last attempt did not clear the check. Retry the remediation, or re-propose a different approach.",
  investigating: "An investigation is open on this alert. The audit trail records the timeline; mark it resolved once the activity has been reviewed and accounted for.",
  acknowledged: "This alert has been acknowledged and is being tracked. Reopen it to investigate, or resolve it once the risk is closed.",
};

export default function DemoFindingDetail() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { findings, assets, actions, setFindingStatus, notifications, actionsList, changeActionStatus } = useWorkspace();
  const [saved, setSaved] = useState(false);
  const [modal, setModal] = useState(null);
  const [actionSaved, setActionSaved] = useState(false);
  const [actionsLoading, setActionsLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setActionsLoading(false), 300);
    return () => window.clearTimeout(t);
  }, []);

  const flashAction = () => {
    setActionSaved(true);
    window.clearTimeout(flashAction._t);
    flashAction._t = window.setTimeout(() => setActionSaved(false), 3200);
  };

  const id = params.get("id");
  const f = findings.find((x) => x.id === id);
  const plan = remediationOf(f);
  const actBase = f ? baseActionsFor(f) : null;
  const myActions = (actionsList || []).filter((a) => a.findingId === f?.id);

  const runAction = (action, trans) => {
    if (trans.confirm) {
      setModal({ action, trans });
      return;
    }
    changeActionStatus(action.id, f.id, trans.to, trans.note ? trans.note(action) : undefined);
    flashAction();
  };

  const confirmModal = () => {
    if (!modal) return;
    const { action, trans } = modal;
    changeActionStatus(action.id, f.id, trans.to, trans.note ? trans.note(action) : undefined);
    setModal(null);
    flashAction();
  };

  const repoAsset = f ? assets.find((a) => a.id === f.asset) : null;
  const sourceNote =
    f && f.source === "github-connector"
      ? f.demo
        ? `Demo repository — ${repoAsset ? repoAsset.name : f.asset} is a simulated scan. No repository was actually scanned.`
        : `Imported from the GitHub connector — dependency data read from ${repoAsset ? repoAsset.name : f.asset}. Only the manifest and lockfile were used; source code was not read.`
      : f && f.source === "cloud-fixture"
        ? f.demo
          ? `Bundled sample fixture — ${f.fixture ? `"${f.fixture}" gave this finding ` : ""}from Kernveil's built-in demo dataset. No scan file was involved.`
          : `Imported scan data — this finding came from the fixture ${f.fixture ? `"${f.fixture}" ` : ""}you uploaded. No live cloud account is connected; the evidence below is from the file.`
        : f && f.source === "backup-fixture"
          ? f.demo
            ? `Bundled backup sample — ${f.system ? `"${f.system}" ` : ""}is a simulated backup record. No backup system was actually contacted.`
            : `Imported backup data — this finding came from the register you uploaded. No live backup tool is connected; the evidence below is from the file.`
          : f && f.source === "identity-fixture"
            ? f.demo
              ? `Bundled identity sample — ${f.identity ? `"${f.identity}" ` : ""}is a simulated directory record. No identity provider was actually contacted.`
              : `Imported identity data — this finding came from the directory export you uploaded. No live identity provider is connected; the evidence below is from the file.`
            : f && f.source === "activity-fixture"
              ? f.demo
                ? `Bundled activity sample — ${f.actor ? `"${f.actor}" ` : ""}is a simulated audit-log event. No live cloud or identity log was connected.`
                : `Imported audit-log data — this alert came from the log you uploaded. No live cloud or identity service is connected; the evidence below is from the file.`
            : "Demo finding — fictional sample data for illustration.";

  const changeStatus = (status, note) => {
    setFindingStatus(id, status, note);
    setSaved(true);
    window.clearTimeout(changeStatus._t);
    changeStatus._t = window.setTimeout(() => setSaved(false), 3200);
  };

  const related = (f?.related || [])
    .map((rid) => {
      const a = assets.find((x) => x.id === rid);
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
    f && f.status !== "completed" && f.steps && f.steps.length
      ? <div className="detail-block action-block" style={{ marginTop: 0 }}>
          <h4>Recommended next step</h4>
          <div className="action-steps">
            {f.steps.map((s, i) => <div className="action-step" key={i}><p>{s}</p></div>)}
          </div>
        </div>
      : <div className="detail-block" style={{ marginTop: 0 }}>
          <h4>Recommended next step</h4>
          <p>This finding is already completed. Nothing to do — Kernveil will let you know if it reappears.</p>
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
                <div className="panel detail-block status-panel">
                  <h4>Remediation status</h4>
                  <div className="status-badge-row">
                    {statusBadge(f.status)}
                    {saved && <span className="status-saved">Saved to this workspace</span>}
                  </div>
                  <p className="status-note">
                    {STATUS_NOTE[f.status] || STATUS_NOTE.open}
                  </p>
                  <div className="status-actions">
                    {(NEXT_ACTIONS[f.status] || []).filter((a) => !a.alertOnly || f.source === "activity-fixture").map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        className={`btn ${a.primary ? "btn-primary" : a.ghost ? "btn-ghost" : "btn-secondary"} btn-sm`}
                        onClick={() => changeStatus(a.to, a.note(plan))}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {plan && f.status !== "completed" && (
                  <div className="panel detail-block plan-block" id="remedPlan">
                    <h4>Remediation plan</h4>
                    <span className="plan-glow">{plan.glow}</span>
                    <p className="plan-title">{plan.title}</p>
                    <div className="plan-compare">
                      <div className="plan-side">
                        <span className="plan-side-label">Before</span>
                        <ul>{(plan.before || []).map((b, i) => <li key={i}>{b}</li>)}</ul>
                      </div>
                      <div className="plan-side plan-after">
                        <span className="plan-side-label">After</span>
                        <ul>{(plan.after || []).map((a, i) => <li key={i}>{a}</li>)}</ul>
                      </div>
                    </div>
                    <p className="plan-note mono">
                      Preview only — Kernveil demonstrates this draft inside your browser. Nothing is opened, merged, or changed in a real repository or cloud account.
                    </p>
                  </div>
                )}
                {f.status === "completed" && (
                  <div className="panel detail-block" id="remedPlan">
                    <h4>Remediation plan</h4>
                    <p>This change has been applied and verified. Kernveil keeps monitoring; it will re-propose remediation if the issue returns.</p>
                  </div>
                )}

                <div className="panel detail-block" id="findingActions">
                  <div className="status-badge-row">
                    <h4 style={{ margin: 0 }}>Remediation actions</h4>
                    {actionSaved && <span className="status-saved" id="actionSaved">Saved to this workspace</span>}
                  </div>

                  {actionsLoading ? (
                    <div className="scan-progress ra-block" id="actionsLoading" role="status" aria-live="polite">
                      <span className="scan-spinner" aria-hidden="true"></span>
                      <span className="scan-label">Preparing remediation actions…</span>
                      <p className="conn-scan-note">Only proposals and honest statuses — nothing is applied automatically.</p>
                    </div>
                  ) : myActions.length ? (
                    <>
                      <div className="ra-banner" id="actBanner">
                        <svg className="ra-banner-ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="4.5" y="10.5" width="15" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          <path d="M12 14v2M12 17.6h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <div>
                          <strong>Requires explicit approval</strong>
                          <span>
                            Kernveil never applies a change on its own. Every action below needs your sign-off before it is queued,
                            and each status is honest about whether anything has actually been changed.
                          </span>
                        </div>
                      </div>

                      <div className="ra-block">
                        {myActions.map((a) => {
                          const kind = KIND_META[a.kind] || { label: a.kind, cls: "" };
                          const data = dataStatusMeta(a.dataStatus);
                          const exec = EXEC_META[a.executionContext] || { label: a.executionContext || "Draft" };
                          return (
                            <article className="ra-card" key={a.id} data-action-id={a.id} id={`actionCard-${a.id}`}>
                              <div className="ra-head">
                                <span className={`ra-kind ${kind.cls || ""}`}>{kind.label}</span>
                                {statusBadge(a.status)}
                                <span className="ra-meta-pill" title={data.note}><b>{data.label}</b></span>
                                <span className="ra-meta-pill" title={exec.note}><b>{exec.label}</b></span>
                              </div>
                              <p className="ra-title">{a.label}</p>
                              <p className="ra-target mono">Target: {a.target}</p>

                              <div>
                                <span className="ra-compare-hint">Proposed change</span>
                                <div className="plan-compare">
                                  <div className="plan-side">
                                    <span className="plan-side-label">Now</span>
                                    <ul><li>{a.currentState}</li></ul>
                                  </div>
                                  <div className="plan-side plan-after">
                                    <span className="plan-side-label">After</span>
                                    <ul><li>{a.proposedState}</li></ul>
                                  </div>
                                </div>
                              </div>

                              <div className="ra-info-grid">
                                <div className="ra-info-field">
                                  <span className="ra-field-label">Security benefit</span>
                                  <p>{a.securityBenefit}</p>
                                </div>
                                <div className="ra-info-field">
                                  <span className="ra-field-label is-safe">Why this is safe</span>
                                  <p>{a.safeReason}</p>
                                </div>
                                <div className="ra-info-field">
                                  <span className="ra-field-label is-risk">Operational impact</span>
                                  <p>{a.operationalImpact}</p>
                                </div>
                                <div className="ra-info-field">
                                  <span className="ra-field-label is-rev">Reversal</span>
                                  <p>{a.reversal}</p>
                                </div>
                              </div>

                              {a.status === "completed" && (
                                <p className="ra-modal-honesty is-warn" style={{ marginTop: 0 }}>
                                  <b>Honest status</b>
                                  {exec.note || "Applied outside Kernveil and verified. Kernveil itself changed nothing."}
                                </p>
                              )}
                              {a.status !== "completed" && a.executionContext === "pending-external" && (
                                <p className="ra-check-note">
                                  This is a real change Kernveil cannot execute itself — it stays pending your own change process until verified.
                                </p>
                              )}

                              {(a.history || []).length > 0 && (
                                <ul className="ra-history">
                                  {a.history.map((h, i) => (
                                    <li key={i} style={{ "--ra-hist-c": h.c || "var(--slate)" }}>
                                      <span>{h.text}</span>
                                      <span className="ra-hist-time">{h.time}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div className="status-actions">
                                {(ACTION_NEXT[a.status] || []).map((t) => (
                                  <button
                                    key={t.label}
                                    type="button"
                                    className={`btn ${t.primary ? "btn-primary" : t.ghost ? "btn-ghost" : "btn-secondary"} btn-sm`}
                                    onClick={() => runAction(a, t)}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : f.status === "completed" ? (
                    <div className="ra-empty" id="actEmpty">
                      <b>Nothing to remediate</b>
                      This finding is already completed — the actions on it were resolved. It re-enters the queue only if the issue reappears.
                    </div>
                  ) : (
                    <div className="ra-empty" id="actEmpty">
                      <b>No eligible remediation available</b>
                      <span>
                        {actBase && actBase.reason
                          ? actBase.reason
                          : "This finding type isn't part of the approval-based action remit. The existing remediation draft above still applies through the finding workflow."}
                      </span>
                    </div>
                  )}
                </div>

                <div className="panel detail-block">
                  <h4>Alerts for this finding</h4>
                  <div id="findingAlerts" style={{ display: "grid", gap: "0.5rem" }}>
                    {notifications.filter((n) => n.findingId === f.id).length ? (
                      notifications
                        .filter((n) => n.findingId === f.id)
                        .map((n) => (
                          <span key={n.id} className={`finding-alert ${n.type === "critical-finding" ? "is-critical" : "is-overdue"}`}>
                            <b>{n.type === "critical-finding" ? "Critical finding" : "Overdue remediation"}</b>
                            <span>
                              {n.title} · {n.status === "resolved" ? "resolved" : n.status === "cleared" ? "cleared" : n.status === "dismissed" ? "dismissed" : "new"} · preview, not sent
                            </span>
                          </span>
                        ))
                    ) : (
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-disabled)" }}>
                        No alerts have been generated for this finding yet. Alerts are previews only — nothing is sent.
                      </p>
                    )}
                  </div>
                </div>

                {steps}

                <div className="panel detail-block">
                  <h4>Related assets</h4>
                  <div style={{ display: "grid", gap: "0.5rem" }}>{related}</div>
                </div>

                <div className="panel detail-block">
                  <h4>Finding history & audit</h4>
                  <ol className="history-list" style={{ margin: 0 }}>
                    {history.length ? (
                      history
                    ) : (
                      <li className="history-item" style={{ "--his-c": "var(--slate)", listStyle: "none" }}>
                        <span className="history-title">No recorded changes yet</span>
                        <span className="history-time"></span>
                      </li>
                    )}
                  </ol>
                </div>
              </div>
            </div>

            <p className="result-count" style={{ marginTop: "1.4rem", textAlign: "center" }}>
              {sourceNote}
            </p>
          </>
        )}
      </div>

      <ActionModal
        open={!!modal}
        action={modal ? modal.action : null}
        finding={f}
        mode={modal ? modal.trans.confirm : null}
        onConfirm={confirmModal}
        onClose={() => setModal(null)}
      />
    </div>
  );
}