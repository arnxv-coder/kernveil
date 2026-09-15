/* ============================================================
   Kernveil — demo Notification settings page (Phase 5).
   Two alert rules built from the shared findings & remediation
   model: newly surfaced critical findings, and remediation items
   overdue past their 7-day action window.
   HONESTY BOUNDARY: no email service is connected in this demo.
   Every alert is a preview written to the workspace with
   sent:false. "Send now" answers with an explicit error instead
   of pretending delivery. Sample history is always labelled as
   bundled demo data.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion } from "../../lib/anim.jsx";
import {
  DEFAULT_NOTIF_SETTINGS,
  EMAIL_CAPABILITY,
  EMAIL_RE,
  NOTIFICATION_TYPES,
  entryRows,
  fmtAlertTime,
  isOverdueFinding,
  parseDate,
  previewRows,
  previewSubject,
} from "../../lib/notifications.js";
import { normalizeStatus } from "../../lib/remediation.js";
import { approvedQueued } from "../../lib/remediationActions.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

const PREFIX = {
  "critical-finding": "crit",
  "overdue-remediation": "ovr",
};

const TYPE_SPEC = {
  "critical-finding": {
    title: "Newly discovered critical findings",
    triggers:
      "When a scanner, rescan, or import surfaces a critical finding for the first time in this workspace. Each finding alerts once — a closed finding that reappears alerts again as a new event.",
    previewWhen: "A critical finding is open right now, a preview appears below.",
    previewNone: "No open critical finding — there is nothing to preview right now.",
  },
  "overdue-remediation": {
    title: "Overdue remediation items",
    triggers:
      "When an open remediation item passes its 7-day action window and is still unresolved at the next evaluation. It stays active until the item completes or leaves the workspace.",
    previewWhen: "The most overdue open remediation item is previewed below.",
    previewNone: "Nothing is overdue — there is nothing to preview right now.",
  },
};

function statusChips(entry) {
  const chips = [];
  if (entry.kind === "reminder") chips.push({ cls: "badge-ghost", label: "Reminder (demo)" });
  if (entry.mode === "demo-history") chips.push({ cls: "badge-ghost", label: "Sample history" });
  if (entry.delivery === "preview") chips.push({ cls: "badge-ghost", label: "Preview · not sent" });
  if (entry.status === "new") chips.push({ cls: "badge-orange", label: "New" });
  if (entry.status === "resolved") chips.push({ cls: "badge-green", label: "Resolved · finding completed" });
  if (entry.status === "cleared") chips.push({ cls: "badge-ghost", label: "Removed from workspace" });
  if (entry.status === "dismissed") chips.push({ cls: "badge-ghost", label: "Dismissed" });
  return chips;
}

function AlertEntry({ type, entry, onDismiss, onReminder, onSendNow }) {
  const rows = entryRows(type, entry);
  const chips = statusChips(entry);
  return (
    <li className={`notif-entry${entry.status === "new" ? " is-new" : ""}`} key={entry.id} id={`${PREFIX[type]}Row-${entry.id}`}>
      <div className="notif-entry-head">
        <div>
          <b className="notif-entry-title">{entry.title}</b>
          <span className="notif-entry-meta mono">
            {type === "critical-finding" ? `${entry.severity} · ${entry.asset} · ${entry.source}` : `${entry.asset} · ${entry.remediationStatus} · overdue ${entry.overdueFor}`}
          </span>
        </div>
        <span className="notif-entry-chips">
          {chips.map((c) => (
            <span className={`badge ${c.cls}`} key={c.label}>{c.label}</span>
          ))}
        </span>
      </div>
      <div className="notif-entry-body">
        <span><b>Risk:</b> {entry.risk}</span>
        {(rows || []).map((r) => (
          <span key={r.k}><b>{r.k}:</b> {r.v}</span>
        ))}
        <span className="notif-entry-time mono">Alert time {fmtAlertTime(entry.discoveredAt)} · first detected {entry.firstDetected}</span>
      </div>
      <div className="notif-entry-actions">
        <Link className="btn btn-secondary btn-sm" to={`/demo-finding?id=${entry.findingId}`}>
          Link finding
          <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 13, height: 13 }}>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        {entry.mode === "generated" && (
          <>
            {entry.kind !== "reminder" && entry.status === "new" && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReminder(entry)}>Send reminder (demo)</button>
            )}
            {entry.status === "new" && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSendNow(entry)}>Send now</button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDismiss(entry)}>Dismiss</button>
          </>
        )}
      </div>
    </li>
  );
}

export default function DemoNotifications() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const {
    findings,
    notifications,
    notifSettings,
    notifOpen,
    notifCounts,
    updateNotifSetting,
    addNotifRecipient,
    removeNotifRecipient,
    dismissNotif,
    requestReminder,
    loadNotifHistory,
    clearNotifHistory,
  } = useWorkspace();

  const [phase, setPhase] = useState("checking");
  const [recipientDraft, setRecipientDraft] = useState({});
  const [inputErr, setInputErr] = useState({});
  const [toast, setToast] = useState("");
  const [sendErr, setSendErr] = useState(null);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      if (alive) setPhase("ready");
    }, 680);
    return () => { alive = false; window.clearTimeout(t); };
  }, []);

  const flash = (msg) => {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(""), 3000);
  };

  const previews = useMemo(() => {
    const open = findings.filter((f) => normalizeStatus(f.status) !== "completed");
    const critical = [...open]
      .filter((f) => f.severity === "critical")
      .sort((a, b) => parseDate(b.first) - parseDate(a.first))[0];
    const overdue = [...open]
      .sort((a, b) => parseDate(a.first) - parseDate(b.first))
      .find((f) => isOverdueFinding(f));
    return {
      "critical-finding": critical || null,
      "overdue-remediation": overdue || null,
    };
  }, [findings]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || REDUCED || phase !== "ready") return;
    const ctx = gsap.context(() => {
      gsap.fromTo(root.querySelectorAll(".notif-card"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.09 });
    }, root);
    return () => ctx.revert();
  }, [phase, REDUCED]);

  const handleAddRecipient = (type) => {
    const value = (recipientDraft[type] || "").trim();
    if (!value) return;
    if (!EMAIL_RE.test(value)) {
      setInputErr((prev) => ({ ...prev, [type]: `"${value}" is not a valid email address. Nothing was added.` }));
      return;
    }
    addNotifRecipient(type, value);
    setInputErr((prev) => ({ ...prev, [type]: "" }));
    setRecipientDraft((prev) => ({ ...prev, [type]: "" }));
    flash(`${value} added as a recipient — preview only, nothing sent.`);
  };

  const handleSendNow = (entry) => {
    setSendErr({
      id: entry.id,
      title: "Send now is not available — no email service is connected",
      text:
        "This alert is a preview written to this demo workspace with sent:false. No email infrastructure is connected, so nothing was sent. To actually email these alerts, hook up a delivery provider in a future phase.",
    });
    flash("Nothing was sent — email delivery is not connected in this demo.");
  };

  const renderCard = (typeMeta) => {
    const type = typeMeta.key;
    const p = PREFIX[type];
    const tier = TYPE_SPEC[type];
    const settings = notifSettings[type] || DEFAULT_NOTIF_SETTINGS[type];
    const enabled = settings.enabled !== false;
    const entries = notifications.filter((e) => e.type === type);
    const sorted = [...entries].sort((a, b) => (b.discoveredAt || 0) - (a.discoveredAt || 0));
    const previewFinding = previews[type];
    const queued = previewFinding ? approvedQueued(previewFinding) : null;
    const subject = previewSubject(type, previewFinding, queued);
    const rows = previewRows(type, previewFinding, queued);
    const count = notifCounts[type] || 0;

    return (
      <article className="conn-card notif-card" id={type === "critical-finding" ? "ntfCardCrit" : "ntfCardOver"}>
        <div className="conn-head">
          <span className="conn-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
              <path d="M12 3l8 3.5v5c0 4.6-3.2 8.1-8 9.5-4.8-1.4-8-4.9-8-9.5v-5L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M12 8v4M12 15.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <span className="conn-name">{tier.title}</span>
            <span className="notif-count-badge">
              {enabled ? (count ? `${count} new preview${count === 1 ? "" : "s"}` : "All caught up") : "Paused"}
            </span>
          </div>
        </div>

        <p className="conn-desc">{tier.triggers}</p>

        <div className="notif-row">
          <label className="switch-row" htmlFor={`${p}Toggle`}>
            <span>
              <b>{enabled ? "Alerts on" : "Alerts paused"}</b>
              <small>{enabled ? "New matching alerts will be written to this workspace as previews." : "No new alerts will be generated until this is switched back on."}</small>
            </span>
            <button
              type="button"
              id={`${p}Toggle`}
              role="switch"
              aria-checked={enabled}
              aria-label={`${tier.title} alerts`}
              className={`switch${enabled ? " is-on" : ""}`}
              onClick={() => {
                const turningOff = enabled;
                updateNotifSetting(type, { enabled: !enabled });
                if (turningOff) {
                  flash(`${tier.title} paused — existing previews stay in history.`);
                } else {
                  flash(`${tier.title} enabled — new alerts will appear as previews.`);
                }
              }}
            >
              <span className="switch-knob" aria-hidden="true"></span>
            </button>
          </label>
        </div>

        <div className="notif-recipients">
          <span className="panel-label">Recipients</span>
          <div className="recipient-input-row">
            <input
              id={`${p}Recipient`}
              type="email"
              className="bk-input"
              placeholder="name@company.example"
              value={recipientDraft[type] || ""}
              disabled={!enabled}
              onChange={(e) => setRecipientDraft((d) => ({ ...d, [type]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddRecipient(type); }}
              aria-label="Recipient email address"
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              id={`${p}RecipientAdd`}
              disabled={!enabled}
              onClick={() => handleAddRecipient(type)}
            >
              Add
            </button>
          </div>
          {inputErr[type] && (
            <p className="recipient-error" id={`${p}RecipientError`} role="alert">{inputErr[type]}</p>
          )}
          <div className="recipient-chips" id={`${p}Recipients`}>
            {(settings.recipients || []).map((r) => (
              <span className="recipient-chip" key={r}>
                {r}
                <button
                  type="button"
                  aria-label={`Remove ${r}`}
                  onClick={() => removeNotifRecipient(type, r)}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width={11} height={11}>
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
            <span className="recipient-note mono">Preview only — no email is sent in this demo.</span>
          </div>
        </div>

        {!enabled && (
          <div className="notif-paused" id={`${p}Paused`}>
            <b>{tier.title} are paused.</b>
            <span>You will not get new alerts for this rule until you switch it back on. Existing history is kept unchanged.</span>
          </div>
        )}

        <div className="notif-preview" id={`${p}Preview`}>
          <span className="panel-label">Content preview</span>
          {previewFinding ? (
            <>
              <div className={`preview-mail${enabled ? "" : " is-dim"}`}>
                <span className="preview-mail-subject mono" id={`${p}PreviewSubject`}>{subject}</span>
                <div className="preview-mail-rows">
                  {(rows || []).map((r) => (
                    <span key={r.k}><b>{r.k}</b>{r.v}</span>
                  ))}
                </div>
                {(enabled ? settings.recipients : []).length > 0 && (
                  <span className="preview-mail-to mono">To: {(enabled ? settings.recipients : []).join(", ")}</span>
                )}
                <span className="preview-mail-foot mono">
                  This preview is generated from one live finding in this workspace. The alert body may change as findings move through remediation.
                </span>
              </div>
            </>
          ) : (
            <p className="notif-preview-none">{tier.previewNone}</p>
          )}
        </div>

        <div className="notif-history-block">
          <div className="notif-history-head">
            <span className="panel-label">Recent alerts</span>
            <span className="queue-sub mono">{sorted.length} {sorted.length === 1 ? "entry" : "entries"} · previews, not sent</span>
          </div>

          {sorted.length ? (
            <ol className="notif-history" id={`${p}History`} style={{ margin: 0 }}>
              {sorted.map((entry) => (
                <AlertEntry
                  key={entry.id}
                  type={type}
                  entry={entry}
                  onDismiss={(e) => { dismissNotif(e.id); flash("Alert dismissed — it stays in history but is no longer counted as new."); }}
                  onReminder={(e) => { requestReminder(type, e.findingId); flash("Reminder queued as a preview — nothing was sent."); }}
                  onSendNow={(e) => handleSendNow(e)}
                />
              ))}
            </ol>
          ) : (
            <p className="notif-empty" id={`${p}Empty`}>No alerts yet for this rule. As findings qualify, previews will appear here.</p>
          )}
          <div className="notif-history-actions">
            <button type="button" className="btn btn-ghost btn-sm" id={`${p}Sample`} onClick={() => { loadNotifHistory(type); flash("Sample history loaded — entries are clearly labelled demo data."); }}>Load sample history</button>
            <button type="button" className="btn btn-ghost btn-sm" id={`${p}Clear`} disabled={!sorted.length} onClick={() => { clearNotifHistory(type); flash("Alert history cleared for this rule. New events can still arrive."); }}>Clear history</button>
          </div>
        </div>
      </article>
    );
  };

  const sending = sendErr;

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Notification settings</h1>
        <p className="page-sub">
          Choose what gets flagged and who to notify — critical findings and overdue remediation, straight from the findings
          this workspace already tracks. Everything here is a preview: no email service is connected in this demo.
        </p>
      </header>

      <div className="notif-capability" id="notifCapability">
        <span className="badge badge-ghost">Email delivery — Preview only</span>
        <p>
          No email provider is connected to this demo workspace. Alerts are computed, stored, and shown here for review with
          <span className="mono" style={{ fontFamily: "inherit" }}> sent:false</span> — nothing is ever delivered to an inbox, and
          nothing claims otherwise. Sending will light up when a delivery provider is connected in a future phase.
        </p>
      </div>

      {phase === "checking" ? (
        <div className="scan-progress notif-loading" id="notifLoading" role="status" aria-live="polite">
          <span className="scan-spinner" aria-hidden="true"></span>
          <span className="scan-label">Checking notification rules against this workspace…</span>
          <p className="conn-scan-note">Only preview alerts — no email infrastructure is involved.</p>
        </div>
      ) : (
        <>
          {notifOpen > 0 && (
            <div className="notif-summary" id="notifSummary" role="status">
              <span className="notif-summary-chip"><b>{notifOpen}</b> new alert{notifOpen === 1 ? "" : "s"} waiting in this workspace</span>
              <span className="notif-summary-chip">Critical findings: <b>{notifCounts["critical-finding"]}</b></span>
              <span className="notif-summary-chip">Overdue remediation: <b>{notifCounts["overdue-remediation"]}</b></span>
              <span className="notif-summary-chip mono">Delivery: <b>{EMAIL_CAPABILITY === "preview" ? "preview only" : "connected"}</b></span>
            </div>
          )}

          {toast && <span className="status-saved notif-toast" role="status">{toast}</span>}

          {sending && (
            <div className="conn-error notif-send-error" id="notifSendError" role="alert">
              <b>{sending.title}</b>
              <span>{sending.text}</span>
              <span className="conn-error-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSendErr(null)}>Dismiss</button>
              </span>
            </div>
          )}

          <div className="notif-grid">
            {NOTIFICATION_TYPES.map((t) => renderCard(t))}
          </div>

          <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }}>
            Alerts reference the same unified findings the dashboard uses — when a finding is resolved, the related alert resolves too.
            No audit-log alerts, auto-remediation, or new integrations are part of this phase.
          </p>
        </>
      )}
    </div>
  );
}