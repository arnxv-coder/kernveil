/* ============================================================
   Kernveil — demo Activity monitoring page (Phase 7).
   A review of a cloud + identity audit log computed entirely in
   this browser: the bundled sample, or a JSON audit-log export you
   upload. Events are classified against the five alert rules, and
   each alert becomes a standard tracked finding in the unified
   model. READ-ONLY BOUNDARY: nothing here ever connects to a live
   cloud or identity log, and no account, privilege, or resource is
   ever changed. Labels stay honest — the badge on every card and
   register keeps the source, event window, and last-analysis time
   visible.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { animate } from "motion";
import { gsap, reducedMotion, CONN_ICONS, TYPE_ICONS } from "../../lib/anim.jsx";
import {
  ALERT_STATE_META,
  SOURCE_LABEL,
  buildDemoActivityResult,
  buildDemoActivityFixture,
  parseActivityFixture,
  analyzeActivityFixture,
  buildActivityRecord,
} from "../../lib/activityScan.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { CONN_STATE_META, connStatusFor, lastSyncText } from "../../lib/connectors.js";
import { normalizeStatus } from "../../lib/remediation.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const CHECKS = [
  { key: "unusual-login", label: "Unusual sign-in", tone: "var(--orange)", text: "A successful sign-in from a region or device an account has never used is flagged — one successful login is enough for a stolen session to do real damage." },
  { key: "failures", label: "Repeated failed access", tone: "var(--amber)", text: "A burst of failed sign-in attempts against one account inside a short window is the definition of a brute-force push and is flagged for review." },
  { key: "privilege", label: "Privilege change", tone: "var(--red)", text: "An administrator role added to an account without approval is the fastest way to lateral movement and gets the most serious label." },
  { key: "sensitive", label: "Sensitive access", tone: "var(--red)", text: "A read of a sensitive resource from an unexpected session — a pipeline, tool, or person that never touches it normally — is surfaced as exposure risk." },
  { key: "admin", label: "New admin action", tone: "var(--red)", text: "A fresh administrator-capable action on a resource expands the control-plane blast radius and is queued for review." },
];

function StateBadge({ state }) {
  const m = ALERT_STATE_META[state] || ALERT_STATE_META["unusual-login"];
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

const STATUS_OPTS = [
  { key: "all", label: "Any status" },
  { key: "open", label: "Proposed" },
  { key: "investigating", label: "Investigating" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "completed", label: "Completed" },
];

export default function DemoActivity() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const fileRef = useRef(null);
  const { activityScans, findings, putActivityScan, removeActivityScan } = useWorkspace();

  const scan = activityScans[0];

  const [phase, setPhase] = useState("idle"); // idle | importing
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [isDrag, setIsDrag] = useState(false);
  const cancelRef = useRef(false);

  /* register filters */
  const [term, setTerm] = useState("");
  const [sev, setSev] = useState("all");
  const [src, setSrc] = useState("all");
  const [etype, setEtype] = useState("all");
  const [status, setStatus] = useState("all");

  const activityFindings = useMemo(
    () => (scan ? findings.filter((f) => f.source === "activity-fixture" && scan.assets.some((a) => a.id === f.asset)) : []),
    [scan, findings]
  );
  const alertRows = useMemo(() => {
    const q = term.trim().toLowerCase();
return (scan ? scan.alerts : []).map((s) => {
      const f = activityFindings.find((x) => x.rule === s.state && x.asset === `act:${s.entity}`) ||
        scan.findings.find((x) => x.rule === s.state && x.asset === `act:${s.entity}`);
      return { ev: s, f };
    }).filter(({ f }) => {
      if (!f) return true;
      if (sev !== "all" && f.severity !== sev) return false;
      if (src !== "all" && f.auditSource !== src) return false;
      if (etype !== "all" && f.rule !== etype) return false;
      if (status !== "all" && normalizeStatus(f.status) !== status) return false;
      if (q && !(f.title + (f.actor || "") + f.resource + (f.eventType || "") + (f.summary || "") + (f.asset || "")).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scan, activityFindings, term, sev, src, etype, status]);

  const openOnActivity = activityFindings.filter((f) => normalizeStatus(f.status) !== "completed").length;
  const compliantCount = scan ? scan.normalEvents.length : 0;
  const openFindingsCount = scan ? scan.findings.filter((f) => normalizeStatus(f.status) !== "completed").length : 0;

  const sampleUrl = useMemo(
    () => URL.createObjectURL(new Blob([JSON.stringify(buildDemoActivityFixture(), null, 2)], { type: "application/json" })),
    []
  );

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

  useEffect(() => () => { cancelRef.current = true; }, []);

  /* count-up for the register headline */
  useEffect(() => {
    const el = rootRef.current;
    if (!el || REDUCED) return;
    const targets = [...el.querySelectorAll(".bk-num")];
    if (!targets.length) return;
    const final = targets.map((n) => ({ el: n, to: Number(n.textContent) || 0 }));
    targets.forEach((n) => { n.textContent = "0"; });
    const t1 = animate(0, 100, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        final.forEach((t) => {
          t.el.textContent = String(Math.round((v / 100) * t.to));
        });
      },
    });
    const o1 = animate(targets, { opacity: [0, 1] }, { duration: 0.3, delay: 0.15 });
    return () => { t1.stop(); o1.stop(); };
  }, [scan && scan.id, REDUCED]);

  const step = async (label, ms) => {
    if (cancelRef.current) return true;
    setProgress(label);
    await delay(ms);
    return cancelRef.current;
  };

  const runImport = async (factory) => {
    cancelRef.current = false;
    setError(null);
    setPhase("importing");
    const stopped = (await step("Reading the audit log…", 480)) || (await step("Classifying events against the alert rules…", 950)) || (await step("Assembling alerts…", 460));
    if (stopped) return;
    const rec = factory();
    if (!rec) return;
    putActivityScan(rec);
    if (!cancelRef.current) setPhase("idle");
  };

  const onFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(null);
    let text;
    try {
      text = await file.text();
    } catch {
      setError("The file could not be read. Choose the exported .json audit log and try again.");
      return;
    }
    const parsed = parseActivityFixture(text);
    if (!parsed.ok || parsed.unsupported) {
      setError(parsed.errors.join(" "));
      return;
    }
    runImport(() => buildActivityRecord(analyzeActivityFixture(text), "uploaded"));
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDrag(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFileChange({ target: { files: e.dataTransfer.files } });
    else setError("Drop a single .json audit log to import it.");
  };

  const runDemo = () => runImport(() => buildActivityRecord(buildDemoActivityResult(), "demo"));

  const rescan = async () => {
    if (!scan) return;
    if (scan.mode === "demo") {
      runDemo();
      return;
    }
    setError("This log was imported from a file that is no longer rescan-able here. Remove it and upload the export again.");
  };

  const connState = connStatusFor({ record: scan, busy: phase !== "idle", openCount: openOnActivity });
  const last = lastSyncText(scan);

  const srcOptions = useMemo(() => {
    if (!scan) return ["all"];
    const set = new Set(scan.alerts.map((a) => a.auditSource));
    return ["all", ...set];
  }, [scan]);

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Activity alerts</h1>
        <p className="page-sub">
          Classify the cloud and identity audit log you provide — or the bundled sample — against five suspicious-activity
          rules: unusual sign-ins, brute-force pushes, privilege changes, sensitive access, and new admin actions. Everything is
          computed from a log in this browser; no live cloud or identity log is ever contacted.
        </p>
      </header>

      <div className="conn-grid" id="actGrid">
        {/* ---------- activity review card ---------- */}
        <article className="conn-card" data-conn data-activity id="actCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.activity || ""}</span>
            <div>
              <span className="conn-name">Activity monitoring</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Cloud + Identity audit log</span>
            </div>
          </div>
          <p className="conn-desc">
            Sign-in geography, credential hammering, privilege grants, and access to sensitive resources across the audit log you provide — or the bundled sample.
          </p>

          {phase !== "idle" ? (
            /* ---------- importing / progress ---------- */
            <div className="scan-progress" id="actProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{progress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; setPhase("idle"); setProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                No live cloud or identity log is read — the audit log is classified entirely in this browser.
              </p>
            </div>
          ) : scan ? (
            /* ---------- connected / success ---------- */
            <div className="conn-connected" id="actConnected" data-state={scan.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META[connState].dot }}></span>
                <span>{scan.mode === "demo" ? "Bundled sample audit log · nothing was uploaded" : `Imported from "${scan.name}"`}</span>
                <span className={scan.state === "no-results" || scan.state === "no-data" ? "badge badge-green" : "badge badge-red"} style={{ marginLeft: "auto" }}>
                  {scan.state === "no-results" ? "No suspicious activity" : scan.state === "no-data" ? "No events" : `${scan.alerts.length} alert${scan.alerts.length === 1 ? "" : "s"}`}
                </span>
              </div>

              <div className="conn-safe" id="actSafe" role="note">
                <span className="conn-safe-ic" aria-hidden="true">✓</span>
                <span>
                  Read-only log review — Kernveil only classifies the export you provide in this browser. It never
                  connects to a live cloud or identity log and never changes an account, privilege, or resource.
                </span>
              </div>

              {scan.state === "no-results" && (
                <div className="conn-healthy" id="actHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>No suspicious activity in this log.</b>
                    <span>All {scan.records} events matched normal behaviour for the account — this is the clean result.</span>
                  </div>
                </div>
              )}

              {scan.state === "no-data" && (
                <div className="bk-issue" style={{ borderColor: "var(--amber)", margin: "0.8rem 0" }} id="actNoData">
                  <summary>No events found in the log</summary>
                  <p>The audit log parsed successfully, but contained no events to evaluate. Export the full log and try again.</p>
                </div>
              )}

              <div className="conn-metrics">
                <span><b className="bk-num">{scan.records}</b>events</span>
                <span><b className="bk-num">{scan.alerts.length}</b>alerts</span>
                <span><b className="bk-num">{compliantCount}</b>normal</span>
              </div>

              {scan.alerts.length > 0 && (
                /* ---------- alert register + filters ---------- */
                <div className="bk-register" id="actRegister">
                  <div className="bk-register-head">
                    <span className="panel-label">Alert register</span>
                    <span className="queue-sub mono">{scan.alerts.length} alerts · {sourceLabel(scan)}</span>
                  </div>

                  <div className="table-filter-wrap" id="actFilters">
                    <div className="search-field">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      <label className="visually-hidden" htmlFor="actSearch">Search alerts</label>
                      <input id="actSearch" type="search" placeholder="Search alerts…" autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)} />
                    </div>

                    <label className="visually-hidden" htmlFor="actSevFilter">Filter by severity</label>
                    <select id="actSevFilter" className="filter-select" value={sev} onChange={(e) => setSev(e.target.value)}>
                      <option value="all">Any severity</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                    </select>

                    <label className="visually-hidden" htmlFor="actSrcFilter">Filter by log</label>
                    <select id="actSrcFilter" className="filter-select" value={src} onChange={(e) => setSrc(e.target.value)}>
                      {srcOptions.includes("Identity") ? <option value="all">Any log</option> : <option value="all">Any log</option>}
                      {srcOptions.map((s) => (s === "all" ? null : <option key={s} value={s}>{s} audit</option>))}
                    </select>

                    <label className="visually-hidden" htmlFor="actTypeFilter">Filter by event type</label>
                    <select id="actTypeFilter" className="filter-select" value={etype} onChange={(e) => setEtype(e.target.value)}>
                      <option value="all">Any event type</option>
                      {Object.keys(ALERT_STATE_META).filter((k) => k !== "normal").map((k) => (
                        <option key={k} value={k}>{ALERT_STATE_META[k].label}</option>
                      ))}
                    </select>

                    <label className="visually-hidden" htmlFor="actStatusFilter">Filter by status</label>
                    <select id="actStatusFilter" className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>

                  <ul className="bk-list" id="actList">
                    {alertRows.map(({ ev: s, f }) => {
                      const st = ALERT_STATE_META[s.state] || ALERT_STATE_META["unusual-login"];
                      return (
                        <li className={`bk-row is-issue`} data-act={s.id} key={s.id}>
                          <div className="bk-hero">
                            <span className="bk-dot" style={{ "--bk": st.dot }}></span>
                            <span className="type-icon" aria-hidden="true">{TYPE_ICONS[s.entityKind] || CONN_ICONS.activity}</span>
                            <div className="bk-id">
                              <b>{s.entityName}</b>
                              <span className="cell-sub">{s.action || "Event"} · {s.resource}</span>
                            </div>
                            <StateBadge state={s.state} />
                            {f && <span className={`sev sev-${f.severity}`}>{f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}</span>}
                          </div>

                          <div className="bk-meta">
                            <span className="bk-bi">Log <b>{s.auditSource}</b></span>
                            <span className="bk-bi">Actor <b>{s.actorId}</b></span>
                            <span className="bk-bi">When <b>{s.eventTime}</b></span>
                            <span className="bk-bi">Checked <b>just now</b></span>
                          </div>

                          {f && (
                            <details className="bk-issue" id={`actWhy-${s.id}`}>
                              <summary>Why it matters · recommended action</summary>
                              <p><b>Why:</b> {f.why}</p>
                              <p><b>Recommended:</b> {f.steps[0]}</p>
                              <p className="bk-issue-link">
                                <Link className="link-arrow" to={`/demo-finding?id=${f.id}`}>
                                  Review the finding
                                  <svg className="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </Link>
                              </p>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className={`empty-state${alertRows.length ? " hidden" : ""}`} id="actFilterEmpty">
                    <div className="empty-ic" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </div>
                    <h3>No alerts match</h3>
                    <p>Try a different search term or loosen a filter.</p>
                  </div>

                  {/* ---------- normal events ---------- */}
                  {scan.normalEvents.length > 0 && (
                    <div className="bk-register" style={{ marginTop: "0.9rem" }}>
                      <div className="bk-register-head">
                        <span className="panel-label">Everything else was normal</span>
                        <span className="queue-sub mono">{scan.normalEvents.length} events cleared</span>
                      </div>
                      <ul className="bk-list" id="actNormal">
                        {scan.normalEvents.map((s) => (
                          <li className="bk-row act-ok" data-act={s.id} key={s.id}>
                            <div className="bk-hero">
                              <span className="bk-dot" style={{ "--bk": "var(--green)" }}></span>
                              <span className="type-icon" aria-hidden="true">{TYPE_ICONS[s.entityKind] || CONN_ICONS.activity}</span>
                              <div className="bk-id">
                                <b>{s.action}</b>
                                <span className="cell-sub">{s.actor ? `${s.actor} · ` : ""}{s.resource}</span>
                              </div>
                              <StateBadge state={s.state} />
                            </div>
                            <div className="bk-meta">
                              <span className="bk-bi">Log <b>{s.auditSource}</b></span>
                              <span className="bk-bi">Actor <b>{s.actorId}</b></span>
                              <span className="bk-bi">When <b>{s.eventTime}</b></span>
                              <span className="bk-bi">Checked <b>just now</b></span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="act-stats" id="actStats">
                    <span>Source: <b>{scan.origin}</b></span>
                    <span>Account: <b>{scan.account}</b></span>
                    <span>Window: <b>{scan.timeRange}</b></span>
                    <span>Last analysis: <b>{scan.analyzedLabel || "just now"}</b> · <b>{last || "—"}</b></span>
                  </div>
                </div>
              )}

              <p className="conn-note" style={{ marginTop: "0.7rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {scan.mode === "demo" ? "Demo fixture" : "Imported report"}
                </span>
                {scan.mode === "demo"
                  ? "Bundled sample — Kernveil generated this audit log from a built-in dataset (no cloud or identity log involved)."
                  : "File parsed in this browser — no live cloud or identity service is connected, so nothing claims a live log was reached."}
                {scan.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: w.includes("normal") || w.includes("events were skipped") || w.includes("no events") ? "var(--amber)" : "var(--teal)", marginTop: "0.35rem" }}>{w}</span>
                ))}
              </p>

              {error && (
                <div className="conn-error" id="actError" role="alert">
                  <b>Could not apply that change</b>
                  <span>{error}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" id="actFindings" to="/demo-findings">
                  View findings
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" id="actRescan" onClick={rescan} disabled={phase !== "idle"}>Re-analyse</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="actRemove" onClick={() => removeActivityScan(scan.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / upload state ---------- */
            <div id="actEmpty">
              <div
                className={`dropzone${isDrag ? " is-drag" : ""}`}
                id="actDrop"
                role="button"
                tabIndex={0}
                aria-label="Upload an audit log — drop a .json export here or press Enter to browse"
                onClick={() => { if (phase === "idle") fileRef.current && fileRef.current.click(); }}
                onKeyDown={(e) => { if (phase === "idle" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileRef.current && fileRef.current.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={onDrop}
              >
                <span className="dropzone-ic" aria-hidden="true">{CONN_ICONS.activity}</span>
                <span className="dropzone-title">Drop an audit log here, or click to browse</span>
                <span className="dropzone-sub">A .json export — events&#91;&#123; id, action, actor, actorId, source, ts &#125;&#93;</span>
              </div>
              <input ref={fileRef} id="actFile" type="file" accept=".json,application/json" className="visually-hidden" onChange={onFileChange} />

              <div className="cloud-actions" style={{ marginTop: "0.8rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" id="actDemo" onClick={runDemo}>
                  No log handy? Load the bundled sample
                </button>
                <a id="actSample" className="btn btn-ghost btn-sm" href={sampleUrl} download="kernveil-activity-audit-log.sample.json">
                  Download a sample audit log
                </a>
              </div>

              {error && (
                <div className="conn-error" id="actError" role="alert">
                  <b>Could not import that log</b>
                  <span>{error}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={runDemo}>Load the bundled sample instead</button>
                  </span>
                </div>
              )}
            </div>
          )}
        </article>

        {/* ---------- how it works ---------- */}
        <article className="conn-card is-planned" data-conn>
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.activity || ""}</span>
            <div>
              <span className="conn-name">What gets checked</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Audit-log based</span>
            </div>
          </div>
          <ul className="cloud-checks" aria-label="Alert rules applied to an audit log">
            {CHECKS.map((c) => (
              <li key={c.key}>
                <span className="cloud-check-dot" style={{ "--cd": c.tone }}></span>
                <div>
                  <b>{c.label}</b>
                  <span>{c.text}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="conn-note" style={{ marginTop: "0.9rem" }}>
            Kernveil never connects to your cloud or identity provider. You provide an audit log (or use the bundled
            sample) and every alert — unusual login, repeated failures, privilege change, sensitive access, new admin
            action — is derived from that log in this browser. Events that match no rule are listed as normal.
          </p>
        </article>
      </div>

      <div className="conn-legend">
        <span style={{ "--lg-c": "var(--red)" }}>Privilege change / sensitive access / admin action</span>
        <span style={{ "--lg-c": "var(--orange)" }}>Unusual sign-in</span>
        <span style={{ "--lg-c": "var(--amber)" }}>Repeated failed access</span>
        <span style={{ "--lg-c": "var(--green)" }}>Normal activity</span>
        <span style={{ "--lg-c": "var(--text-disabled)" }}>No live log involved</span>
      </div>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }} id="actNote">
        {scan
          ? scan.mode === "demo"
            ? `Currently showing the bundled sample audit log — ${openOnActivity} open alert${openOnActivity === 1 ? "" : "s"} surfaced from simulated data. Upload a real log to replace it.`
            : `Currently showing imported log data — "${scan.name}" was read from the file you uploaded. No cloud or identity log is connected, so nothing is verified against a live log.`
          : "Nothing loaded yet. Load the bundled sample audit log or upload one to see activity analysis in action."}
      </p>
    </div>
  );
}

function sourceLabel(scan) {
  if (scan.mode === "demo") return `bundled sample · ${SOURCE_LABEL}`;
  return `uploaded · ${SOURCE_LABEL}`;
}