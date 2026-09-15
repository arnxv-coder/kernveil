/* ============================================================
   Kernveil — demo Identity analysis page (Phase 6).
   A directory review computed entirely from a fixture in this
   browser: the bundled sample, or a JSON directory export you
   upload. Every record carries its role, MFA state, last sign-in
   and admin history; the engine derives a standard (healthy /
   dormant account / excessive privileges / missing MFA /
   suspicious admin) and any risk flows straight into the shared
   findings model. READ-ONLY BOUNDARY: nothing here ever connects
   to a live identity provider, and no account, MFA, or privilege
   is ever changed. Labels stay honest.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { animate } from "motion";
import { gsap, reducedMotion, CONN_ICONS, TYPE_ICONS } from "../../lib/anim.jsx";
import {
  IDP_STATE_META,
  SOURCE_LABEL,
  buildDemoIdentityResult,
  buildDemoIdentityFixture,
  parseIdentityFixture,
  analyzeIdentityFixture,
  buildIdentityRecord,
} from "../../lib/identityScan.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { CONN_STATE_META, connStatusFor, lastSyncText, syncHistoryOf } from "../../lib/connectors.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const CHECKS = [
  { key: "privilege", label: "Role & privilege scope", tone: "var(--teal)", text: "Each identity records its role and standing privileges, so over-reaching grants and global admin roles surface immediately." },
  { key: "mfa", label: "MFA & authentication hygiene", tone: "var(--amber)", text: "Multi-factor enrolment is tracked per identity — accounts without it and privileged identities that rely on a single password stick out." },
  { key: "admin", label: "Admin history & standing access", tone: "var(--red)", text: "Recent, unapproved administrator grants and unusual sign-ins are flagged for review instead of being silently trusted." },
];

function StateBadge({ state }) {
  const m = IDP_STATE_META[state] || IDP_STATE_META["inactive-user"];
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export default function DemoIdentity() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const fileRef = useRef(null);
  const { identityScans, findings, putIdentityScan, removeIdentityScan } = useWorkspace();

  const scan = identityScans[0];

  const [phase, setPhase] = useState("idle"); // idle | importing
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [isDrag, setIsDrag] = useState(false);
  const cancelRef = useRef(false);

  const identityFindings = useMemo(
    () => (scan ? findings.filter((f) => f.source === "identity-fixture" && scan.assets.some((a) => a.id === f.asset)) : []),
    [scan, findings]
  );
  const openOnIdentity = identityFindings.filter((f) => f.status !== "completed").length;
  const compliantCount = scan ? scan.identities.filter((s) => s.state === "healthy").length : 0;
  const openFindingsCount = scan ? scan.findings.filter((f) => f.status !== "completed").length : 0;

  const sampleUrl = useMemo(
    () => URL.createObjectURL(new Blob([JSON.stringify(buildDemoIdentityFixture(), null, 2)], { type: "application/json" })),
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
    const stopped = (await step("Reading the identity directory…", 480)) || (await step("Checking roles, MFA and admin history…", 950)) || (await step("Assembling findings…", 460));
    if (stopped) return;
    const rec = factory();
    if (!rec) return;
    putIdentityScan(rec);
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
      setError("The file could not be read. Choose the exported .json directory and try again.");
      return;
    }
    const parsed = parseIdentityFixture(text);
    if (!parsed.ok) {
      setError(parsed.errors.join(" "));
      return;
    }
    runImport(() => buildIdentityRecord(analyzeIdentityFixture(text), "uploaded"));
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDrag(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFileChange({ target: { files: e.dataTransfer.files } });
    else setError("Drop a single .json directory file to import it.");
  };

  const runDemo = () => runImport(() => buildIdentityRecord(buildDemoIdentityResult(), "demo"));

  const rescan = async () => {
    if (!scan) return;
    if (scan.mode === "demo") {
      runDemo();
      return;
    }
    setError("This directory was imported from a file that is no longer rescan-able here. Remove it and upload the export again.");
  };

  const connState = connStatusFor({ record: scan, busy: phase !== "idle", openCount: openOnIdentity });
  const last = lastSyncText(scan);
  const history = syncHistoryOf("identity", scan);

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Identity checks</h1>
        <p className="page-sub">
          Review role scope, MFA enrolment, and admin history across the identity directory you provide — and flag
          dormant accounts, over-reaching grants, and unexplained administrator access. Everything is computed from an
          export in this browser; no live identity provider is ever contacted.
        </p>
      </header>

      <div className="conn-grid" id="idpGrid">
        {/* ---------- identity review card ---------- */}
        <article className="conn-card" data-conn data-identity id="idpCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.identity || ""}</span>
            <div>
              <span className="conn-name">Identity provider</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Load a directory export</span>
            </div>
          </div>
          <p className="conn-desc">
            Credential age, unusual sign-in patterns, and role hygiene across the exported directory you provide — or the bundled sample.
          </p>

          {phase !== "idle" ? (
            /* ---------- importing / progress ---------- */
            <div className="scan-progress" id="idpProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{progress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; setPhase("idle"); setProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                No live provider is contacted — the directory is read entirely in this browser.
              </p>
            </div>
          ) : scan ? (
            /* ---------- connected / success ---------- */
            <div className="conn-connected" id="idpConnected" data-state={scan.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META[connState].dot }}></span>
                <span>{scan.mode === "demo" ? "Bundled sample directory · nothing was uploaded" : `Imported from "${scan.name}"`}</span>
                <span className={scan.state === "healthy" ? "badge badge-green" : "badge badge-orange"} style={{ marginLeft: "auto" }}>
                  {scan.state === "healthy" ? "Standards met" : scan.state === "no-data" ? "No identities" : "Findings found"}
                </span>
              </div>

              <div className="conn-safe" id="idpSafe" role="note">
                <span className="conn-safe-ic" aria-hidden="true">✓</span>
                <span>
                  Read-only directory review — Kernveil only reads the export you provide in this browser. It never
                  connects to a live identity provider and never changes an account, MFA setup, or privilege.
                </span>
              </div>

              {scan.state === "healthy" && (
                <div className="conn-healthy" id="idpHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>Every identity meets the standards.</b>
                    <span>All {scan.records} identities have appropriate access and MFA where it matters.</span>
                  </div>
                </div>
              )}

              {scan.state === "no-data" && (
                <div className="bk-issue" style={{ borderColor: "var(--amber)", margin: "0.8rem 0" }} id="idpNoData">
                  <summary>No identities found in the export</summary>
                  <p>The directory parsed successfully, but contained no identity records to evaluate. Export the full directory and try again.</p>
                </div>
              )}

              <div className="conn-metrics">
                <span><b className="bk-num">{scan.records}</b>identities</span>
                <span><b className="bk-num">{openFindingsCount}</b>active findings</span>
                <span><b className="bk-num">{compliantCount}</b>meet standards</span>
              </div>

              {/* ---------- identity register ---------- */}
              <div className="bk-register" id="idpRegister">
                <div className="bk-register-head">
                  <span className="panel-label">Identity register</span>
                  <span className="queue-sub mono">{scan.identities.length} identities · {sourceLabel(scan)}</span>
                </div>
                <ul className="bk-list" id="idpList">
                  {scan.identities.map((s) => {
                    const st = IDP_STATE_META[s.state] || IDP_STATE_META["inactive-user"];
                    const finding = scan.findings.find((f) => f.username === s.username);
                    const mfaLabel = s.mfa ? "MFA enabled" : "No MFA";
                    return (
                      <li className={`bk-row${s.issue ? " is-issue" : ""}`} data-idp={s.id} key={s.id}>
                        <div className="bk-hero">
                          <span className="bk-dot" style={{ "--bk": st.dot }}></span>
                          <span className="type-icon" aria-hidden="true">{TYPE_ICONS[s.type] || CONN_ICONS.identity}</span>
                          <div className="bk-id">
                            <b>{s.name}</b>
                            <span className="cell-sub">{s.typeLabel} · {s.role || "—"}</span>
                          </div>
                          <StateBadge state={s.state} />
                          {s.issue && <span className={`sev sev-${s.severity}`}>{s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}</span>}
                        </div>

                        <div className="bk-meta">
                          <span className="bk-bi">Member of <b>{scan.provider}</b></span>
                          <span className="bk-bi">MFA <b className={s.mfa ? "" : "bad"}>{mfaLabel}</b></span>
                          <span className="bk-bi">Last sign-in <b>{s.lastLoginLabel}</b></span>
                          <span className="bk-bi">Checked <b>just now</b></span>
                        </div>

                        {s.issue && finding && (
                          <details className="bk-issue" id={`idpWhy-${s.id}`}>
                            <summary>Why it matters · recommended action</summary>
                            <p><b>Why:</b> {s.why}</p>
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
                  {scan.mode === "demo" ? "Demo fixture" : "Imported report"}
                </span>
                {scan.mode === "demo"
                  ? "Bundled sample — Kernveil generated this directory from a built-in dataset (no identity provider involved)."
                  : "File parsed in this browser — no live provider is connected, so nothing claims a live directory was reached."}
                {scan.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: w.includes("clean") ? "var(--teal)" : "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
              </p>

              {error && (
                <div className="conn-error" id="idpError" role="alert">
                  <b>Could not apply that change</b>
                  <span>{error}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" id="idpFindings" to="/demo-findings">
                  View findings
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" id="idpRescan" onClick={rescan} disabled={phase !== "idle"}>Re-analyse</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="idpRemove" onClick={() => removeIdentityScan(scan.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / upload state ---------- */
            <div id="idpEmpty">
              <div
                className={`dropzone${isDrag ? " is-drag" : ""}`}
                id="idpDrop"
                role="button"
                tabIndex={0}
                aria-label="Upload an identity directory — drop a .json export here or press Enter to browse"
                onClick={() => { if (phase === "idle") fileRef.current && fileRef.current.click(); }}
                onKeyDown={(e) => { if (phase === "idle" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileRef.current && fileRef.current.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={onDrop}
              >
                <span className="dropzone-ic" aria-hidden="true">{CONN_ICONS.identity}</span>
                <span className="dropzone-title">Drop an identity directory here, or click to browse</span>
                <span className="dropzone-sub">A .json export — identities&#91;&#123; id, name, type, mfa, privileges, lastLogin &#125;&#93;</span>
              </div>
              <input ref={fileRef} id="idpFile" type="file" accept=".json,application/json" className="visually-hidden" onChange={onFileChange} />

              <div className="cloud-actions" style={{ marginTop: "0.8rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" id="idpDemo" onClick={runDemo}>
                  No directory handy? Load the bundled sample
                </button>
                <a id="idpSample" className="btn btn-ghost btn-sm" href={sampleUrl} download="kernveil-identity-directory.sample.json">
                  Download a sample directory
                </a>
              </div>

              {error && (
                <div className="conn-error" id="idpError" role="alert">
                  <b>Could not import that directory</b>
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
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.identity || ""}</span>
            <div>
              <span className="conn-name">What gets checked</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Directory-based</span>
            </div>
          </div>
          <ul className="cloud-checks" aria-label="Checks performed on an identity directory">
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
            Kernveil never connects to your identity provider. You provide an export (or use the bundled sample) and
            every state — standards met, dormant account, excessive privileges, missing MFA, suspicious admin — is
            derived from that directory in this browser.
          </p>
        </article>
      </div>

      <div className="conn-legend">
        <span style={{ "--lg-c": "var(--green)" }}>Standards met · healthy access</span>
        <span style={{ "--lg-c": "var(--orange)" }}>Excessive privileges / missing MFA</span>
        <span style={{ "--lg-c": "var(--amber)" }}>Dormant account</span>
        <span style={{ "--lg-c": "var(--red)" }}>Suspicious admin</span>
        <span style={{ "--lg-c": "var(--text-disabled)" }}>No live provider involved</span>
      </div>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }} id="idpNote">
        {scan
          ? scan.mode === "demo"
            ? `Currently showing the bundled sample directory — ${openOnIdentity} open finding${openOnIdentity === 1 ? "" : "s"} surfaced from simulated data. Upload a real export to replace it.`
            : `Currently showing imported directory data — "${scan.name}" was read from the file you uploaded. No identity provider is connected, so nothing is verified against a live directory.`
          : "Nothing loaded yet. Load the bundled sample directory or upload one to see identity analysis in action."}
      </p>
    </div>
  );
}

function sourceLabel(scan) {
  if (scan.mode === "demo") return `bundled sample · ${SOURCE_LABEL}`;
  return `uploaded · ${SOURCE_LABEL}`;
}