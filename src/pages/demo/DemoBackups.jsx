/* ============================================================
   Kernveil — demo Backup health page (Phase 4).
   Backup verification run entirely from a fixture in this
   browser: a bundled sample, or a JSON register you upload.
   Every system carries its expected schedule (editable here),
   last good restore point, next expected, and a derived state
   (protected / failed / missing / stale / no backup data).
   Changing an expected schedule re-derives the state immediately
   and flows straight into the shared findings model. Nothing
   here contacts a live backup tool — labels stay honest.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { animate } from "motion";
import { gsap, reducedMotion, CONN_ICONS, TYPE_ICONS } from "../../lib/anim.jsx";
import {
  BACKUP_STATE_META,
  SOURCE_LABEL,
  buildDemoBackupResult,
  buildDemoFixture,
  parseBackupFixture,
  analyzeBackupFixture,
  buildBackupRecord,
  scheduleLabel,
  scheduleOptions,
} from "../../lib/backupScan.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { CONN_STATE_META, connStatusFor, lastSyncText, syncHistoryOf } from "../../lib/connectors.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const CHECKS = [
  { key: "coverage", label: "Retention schedules & coverage", tone: "var(--teal)", text: "Each system knows its expected schedule, last good restore point, and whether the newest point is actually restorable." },
  { key: "verification", label: "Restore verification", tone: "var(--amber)", text: "A backup is only as good as its newest restorable point — failed, stale, and missing states surface that immediately." },
  { key: "controls", label: "Encryption & access controls", tone: "var(--slate)", text: "The register tracks who could reach backups and how they are protected, without ever touching a real backup tool." },
];

function StateBadge({ state }) {
  const m = BACKUP_STATE_META[state] || BACKUP_STATE_META["no-data"];
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export default function DemoBackups() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const fileRef = useRef(null);
  const { backupScans, findings, putBackupScan, removeBackupScan, updateBackupSchedule } = useWorkspace();

  const scan = backupScans[0];

  const [phase, setPhase] = useState("idle"); // idle | importing
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [isDrag, setIsDrag] = useState(false);
  const [editing, setEditing] = useState(null); // system id being edited
  const [draft, setDraft] = useState({ value: 24, unit: "hour" });
  const [savedId, setSavedId] = useState(null);
  const cancelRef = useRef(false);

  const backupFindings = useMemo(
    () => (scan ? findings.filter((f) => f.source === "backup-fixture" && scan.assets.some((a) => a.id === f.asset)) : []),
    [scan, findings]
  );
  const openOnBackup = backupFindings.filter((f) => f.status !== "completed").length;
  const protectedCount = scan ? scan.systems.filter((s) => s.state === "healthy").length : 0;
  const openFindingsCount = scan ? scan.findings.filter((f) => f.status !== "completed").length : 0;

  const sampleUrl = useMemo(() => URL.createObjectURL(new Blob([JSON.stringify(buildDemoFixture(), null, 2)], { type: "application/json" })), []);

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
    setEditing(null);
    const stopped = (await step("Reading the backup register…", 480)) || (await step("Checking retention schedules and restore coverage…", 950)) || (await step("Assembling findings…", 460));
    if (stopped) return;
    const rec = factory();
    if (!rec) return;
    putBackupScan(rec);
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
      setError("The file could not be read. Choose the exported .json register and try again.");
      return;
    }
    const parsed = parseBackupFixture(text);
    if (!parsed.ok) {
      setError(parsed.errors.join(" "));
      return;
    }
    runImport(() => buildBackupRecord(analyzeBackupFixture(text), "uploaded"));
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDrag(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFileChange({ target: { files: e.dataTransfer.files } });
    else setError("Drop a single .json register file to import it.");
  };

  const runDemo = () => runImport(() => buildBackupRecord(buildDemoBackupResult(), "demo"));

  const rescan = async () => {
    if (!scan) return;
    if (scan.mode === "demo") {
      runDemo();
      return;
    }
    setError("This register was imported from a file that is no longer rescan-able here. Remove it and upload the fixture again.");
  };

  const startEdit = (s) => {
    setEditing(s.id);
    setSavedId(null);
    setDraft({ value: Number(s.schedule.value) || 24, unit: UNIT_FALLBACK(s.schedule.unit) });
  };

  function UNIT_FALLBACK(unit) {
    return ["minute", "hour", "day", "week"].includes(unit) ? unit : "hour";
  }

  const saveSchedule = (s) => {
    if (!scan) return;
    const value = Math.max(1, Math.min(8760, Number(draft.value) || 1));
    updateBackupSchedule(scan.id, s.id, { value, unit: draft.unit });
    setEditing(null);
    setSavedId(s.id);
    window.clearTimeout(saveSchedule._t);
    saveSchedule._t = window.setTimeout(() => setSavedId(null), 2600);
  };

  const connState = connStatusFor({ record: scan, busy: phase !== "idle", openCount: openOnBackup });
  const last = lastSyncText(scan);
  const history = syncHistoryOf("backup", scan);

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Backup health</h1>
        <p className="page-sub">
          Verify every system's expected schedule, newest restorable point, and whether your backups would actually restore.
          Everything is computed from a register in this browser — no live backup tool is ever contacted.
        </p>
      </header>

      <div className="conn-grid" id="backupGrid">
        {/* ---------- backup review card ---------- */}
        <article className="conn-card" data-conn data-backup id="backupCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.backup || ""}</span>
            <div>
              <span className="conn-name">Backup system</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Load a register</span>
            </div>
          </div>
          <p className="conn-desc">
            Retention health, restore coverage, and whether your backups would actually restore — from a register you provide, or the bundled sample.
          </p>

          {phase !== "idle" ? (
            /* ---------- importing / progress ---------- */
            <div className="scan-progress" id="backupProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{progress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; setPhase("idle"); setProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                No backup tool is contacted — the register is read entirely in this browser.
              </p>
            </div>
          ) : scan ? (
            /* ---------- connected / success ---------- */
            <div className="conn-connected" id="backupConnected" data-state={scan.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META[connState].dot }}></span>
                <span>{scan.mode === "demo" ? "Bundled sample register · nothing was uploaded" : `Imported from "${scan.name}"`}</span>
                <span className={scan.state === "healthy" ? "badge badge-green" : "badge badge-orange"} style={{ marginLeft: "auto" }}>
                  {scan.state === "healthy" ? "Healthy" : "Findings found"}
                </span>
              </div>

              {scan.state === "healthy" && (
                <div className="conn-healthy" id="backupHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>Every system is protected.</b>
                    <span>All {scan.records} systems have a restorable point inside their expected window.</span>
                  </div>
                </div>
              )}

              <div className="conn-metrics">
                <span><b className="bk-num">{scan.records}</b>systems</span>
                <span><b className="bk-num">{openFindingsCount}</b>active findings</span>
                <span><b className="bk-num">{protectedCount}</b>fully protected</span>
              </div>

              {/* ---------- backup register ---------- */}
              <div className="bk-register" id="backupRegister">
                <div className="bk-register-head">
                  <span className="panel-label">Backup register</span>
                  <span className="queue-sub mono">{scan.systems.length} systems · {sourceLabel(scan)}</span>
                </div>
                <ul className="bk-list" id="backupList">
                  {scan.systems.map((s) => {
                    const st = BACKUP_STATE_META[s.state] || BACKUP_STATE_META["no-data"];
                    const finding = scan.findings.find((f) => f.system === s.name);
                    return (
                      <li className={`bk-row${s.issue ? " is-issue" : ""}`} data-bk={s.id} key={s.id}>
                        <div className="bk-hero">
                          <span className="bk-dot" style={{ "--bk": st.dot }}></span>
                          <span className="type-icon" aria-hidden="true">{TYPE_ICONS[s.type] || ""}</span>
                          <div className="bk-id">
                            <b>{s.name}</b>
                            <span className="cell-sub">{s.type} · {s.env}</span>
                          </div>
                          <StateBadge state={s.state} />
                          {s.issue && <span className={`sev sev-${s.severity}`}>{s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}</span>}
                        </div>

                        <div className="bk-meta">
                          <span className="bk-bi">
                            Expected schedule <b>{scheduleLabel(s.schedule)}</b>
                            {s.state === "no-data" || s.schedule.value > 0 ? (
                              <button type="button" className="bk-edit" id={`bkEdit-${s.id}`} onClick={() => startEdit(s)}>
                                {editing === s.id ? "Editing…" : "Edit"}
                              </button>
                            ) : null}
                          </span>
                          <span className="bk-bi">Last successful backup <b>{s.lastSuccessLabel}</b></span>
                          <span className="bk-bi">Next expected <b>{s.nextExpectedLabel}</b></span>
                          <span className="bk-bi">Check timestamp <b>just now</b></span>
                        </div>

                        {editing === s.id && (
                          <div className="bk-editor" id={`bkEditor-${s.id}`}>
                            <span className="bk-editor-label">Backup every</span>
                            <input
                              id={`bkScheduleValue-${s.id}`}
                              type="number"
                              min="1"
                              max="8760"
                              className="bk-input"
                              value={draft.value}
                              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                              aria-label="Backup interval"
                            />
                            <select
                              id={`bkScheduleUnit-${s.id}`}
                              className="bk-input bk-select"
                              value={draft.unit}
                              onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                              aria-label="Backup interval unit"
                            >
                              {scheduleOptions().map((o) => (
                                <option key={o.key} value={o.key}>{o.label}</option>
                              ))}
                            </select>
                            <span className="bk-editor-actions">
                              <button type="button" className="btn btn-primary btn-sm" id={`bkSave-${s.id}`} onClick={() => saveSchedule(s)}>Save schedule</button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                            </span>
                            <p className="bk-editor-hint">Changing the expected schedule re-derives this system's state and the dashboard right away.</p>
                          </div>
                        )}

                        {savedId === s.id && (
                          <span className="status-saved" id={`bkSaved-${s.id}`}>Saved — state re-derived</span>
                        )}

                        {s.issue && finding && (
                          <details className="bk-issue" id={`bkWhy-${s.id}`}>
                            <summary>Why it matters · recommended action</summary>
                            <p><b>Why:</b> <span dangerouslySetInnerHTML={{ __html: s.why }} /></p>
                            <p><b>Recommended:</b> {s.steps[0]}</p>
                            <p className="bk-issue-link">
                              <Link className="link-arrow" to={`/demo-finding?id=${finding.id}`}>
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
              </div>

              <p className="conn-note" style={{ marginTop: "0.7rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {scan.mode === "demo" ? "Demo fixture" : "Imported scan data"}
                </span>
                {scan.mode === "demo"
                  ? "Bundled sample — Kernveil generated this register from a built-in dataset (no backup tool involved)."
                  : "File parsed in this browser — no backup tool is connected, so nothing claims a live backup was reached."}
                {scan.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: w.includes("protected") ? "var(--teal)" : "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
              </p>

              {error && (
                <div className="conn-error" id="backupError" role="alert">
                  <b>Could not apply that change</b>
                  <span>{error}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" id="backupFindings" to="/demo-findings">
                  View findings
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" id="backupRescan" onClick={rescan} disabled={phase !== "idle"}>Rescan</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="backupRemove" onClick={() => removeBackupScan(scan.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / upload state ---------- */
            <div id="backupEmpty">
              <div
                className={`dropzone${isDrag ? " is-drag" : ""}`}
                id="backupDrop"
                role="button"
                tabIndex={0}
                aria-label="Upload a backup register — drop a .json file here or press Enter to browse"
                onClick={() => { if (phase === "idle") fileRef.current && fileRef.current.click(); }}
                onKeyDown={(e) => { if (phase === "idle" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileRef.current && fileRef.current.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={onDrop}
              >
                <span className="dropzone-ic" aria-hidden="true">{CONN_ICONS.backup}</span>
                <span className="dropzone-title">Drop a backup register here, or click to browse</span>
                <span className="dropzone-sub">A .json report — systems&#91;&#123; id, type, schedule, lastSuccess, lastAttempt &#125;&#93;</span>
              </div>
              <input ref={fileRef} id="backupFile" type="file" accept=".json,application/json" className="visually-hidden" onChange={onFileChange} />

              <div className="cloud-actions" style={{ marginTop: "0.8rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" id="backupDemo" onClick={runDemo}>
                  No register handy? Load the bundled sample
                </button>
                <a id="backupSample" className="btn btn-ghost btn-sm" href={sampleUrl} download="kernveil-backup-register.sample.json">
                  Download a sample register
                </a>
              </div>

              {error && (
                <div className="conn-error" id="backupError" role="alert">
                  <b>Could not import that register</b>
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
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.backup || ""}</span>
            <div>
              <span className="conn-name">What gets checked</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Register-based</span>
            </div>
          </div>
          <ul className="cloud-checks" aria-label="Checks performed on a backup register">
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
            Kernveil never connects to your backup tooling. You provide a register (or use the bundled sample) and every
            state — protected, failed, missing, stale, no backup data — is derived from that register in this browser.
          </p>
        </article>
      </div>

      <div className="conn-legend">
        <span style={{ "--lg-c": "var(--green)" }}>Protected · restorable point on schedule</span>
        <span style={{ "--lg-c": "var(--red)" }}>Failed / missing</span>
        <span style={{ "--lg-c": "var(--amber)" }}>Stale / no backup data</span>
        <span style={{ "--lg-c": "var(--text-disabled)" }}>No live backup tool involved</span>
      </div>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }} id="backupNote">
        {scan
          ? scan.mode === "demo"
            ? `Currently showing the bundled sample register — ${openOnBackup} open finding${openOnBackup === 1 ? "" : "s"} surfaced from simulated data. Upload a real register to replace it.`
            : `Currently showing imported backup data — "${scan.name}" was read from the file you uploaded. No backup tool is connected, so nothing is verified against a live system.`
          : "Nothing loaded yet. Load the bundled sample register or upload one to see backup verification in action."}
      </p>
    </div>
  );
}

function sourceLabel(scan) {
  if (scan.mode === "demo") return `bundled sample · ${SOURCE_LABEL}`;
  return `uploaded · ${SOURCE_LABEL}`;
}