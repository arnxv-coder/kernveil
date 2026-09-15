/* ============================================================
   Kernveil — shared remediation-action confirmation modal.
   Used by the finding detail page and the overview actions panel
   whenever an action needs a decision before it moves:
     • approve  — awaiting-approval → approved (explicit sign-off)
     • complete — in-progress → completed (honest "record only" gate)
   HONESTY BOUNDARY: the modal states plainly that Kernveil never
   applies the change itself. Approving only queues it; "completed"
   records a change that was applied elsewhere and verified.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { KIND_META, EXEC_META, dataStatusMeta } from "../../lib/remediationActions.js";
import { statusBadge } from "./badges.jsx";

export default function ActionModal({ open, action, finding, mode, onConfirm, onClose }) {
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return undefined;
    }
    const raf = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !action) return null;

  const kind = KIND_META[action.kind] || { label: action.kind };
  const exec = EXEC_META[action.executionContext] || { label: action.executionContext || "Draft" };
  const data = dataStatusMeta(action.dataStatus);
  const isApprove = mode === "approve";
  const isComplete = mode === "complete";

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      <div className={`modal-backdrop${mounted ? " is-open" : ""}`} id="actionModalBackdrop" onClick={handleBackdrop}></div>
      <div
        className={`modal${mounted ? " is-open" : ""}`}
        id="actionModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actionModalTitle"
        ref={rootRef}
      >
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="modal-body">
          <h3 id="actionModalTitle">
            {isApprove ? "Approve this remediation action" : isComplete ? "Mark this action as completed?" : "Confirm"}
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
            <span className={`ra-kind ${kind.cls || ""}`}>{kind.label}</span>
            {statusBadge(action.status)}
          </div>

          <p style={{ marginBottom: "0.6rem" }}>
            <b>{action.label}</b>
            <span className="ra-target" style={{ display: "block", marginTop: "0.25rem" }}>
              Target: {action.target} · {data.label} · {exec.label}
            </span>
          </p>

          <div className="ra-modal-summary">
            <div className="ra-modal-row">
              <span className="ra-modal-key">What changes</span>
              <div className="plan-compare">
                <div className="plan-side">
                  <span className="plan-side-label">Now</span>
                  <ul><li>{action.currentState}</li></ul>
                </div>
                <div className="plan-side plan-after">
                  <span className="plan-side-label">After</span>
                  <ul><li>{action.proposedState}</li></ul>
                </div>
              </div>
            </div>
            <div className="ra-modal-row">
              <span className="ra-modal-key">Security benefit</span>
              <p>{action.securityBenefit}</p>
            </div>
            <div className="ra-modal-row">
              <span className="ra-modal-key">Why this is safe</span>
              <p>{action.safeReason}</p>
            </div>
            <div className="ra-modal-row">
              <span className="ra-modal-key">Operational impact</span>
              <p>{action.operationalImpact}</p>
            </div>
          </div>

          {isApprove && (
            <div className="ra-modal-honesty">
              <b>What you are approving</b>
              Approving queues this action for execution — nothing has changed in this workspace yet. Kernveil does not
              apply the change itself: no cloud permission, security header, or exposed resource is modified by this
              demo. Execution happens through your normal change process (or in the simulated fixture), and only then
              would you mark the action as done after verifying it.
            </div>
          )}

          {isComplete && (
            <div className="ra-modal-honesty is-warn">
              <b>Nothing inside Kernveil changed</b>
              Kernveil cannot apply this change itself. Marking it completed records that the change was applied outside
              Kernveil (or inside the simulated fixture) and verified. Only mark completed when the change is genuinely
              finished — never to acknowledge a proposal.
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              id={`actionModalConfirm-${isApprove ? "approve" : "complete"}`}
              onClick={onConfirm}
            >
              {isApprove ? "Approve and queue" : isComplete ? "Mark completed" : "Confirm"}
            </button>
            <button type="button" className="btn btn-ghost" id="actionModalCancel" onClick={onClose}>
              Cancel
            </button>
          </div>
          {finding && (
            <p className="modal-hint mono">
              Affected finding: {finding.title} — {action.findingId}
            </p>
          )}
        </div>
      </div>
    </>
  );
}