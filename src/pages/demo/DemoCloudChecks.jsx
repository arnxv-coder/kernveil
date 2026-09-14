/* ============================================================
   Kernveil — demo Cloud exposure checks page.
   You upload a scan fixture (a JSON report exported by your
   cloud tooling) and Kernveil reads it entirely in the browser.
   No cloud credentials, no live cloud scanning, no billable API
   calls — the fixture is the source of truth. A bundled sample
   fixture exists so the flow is believable without a file, and is
   always clearly labelled as a simulation.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion, CONN_ICONS, TYPE_ICONS } from "../../lib/anim.jsx";
import { RULES, parseCloudFixture, analyzeDemoFixture, buildDemoFixture } from "../../lib/cloudFixture.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const CHECKS = [
  { rule: "storage-public-read", label: "Publicly exposed storage", tone: "var(--red)", text: "Storage resources (buckets, archives) readable or writable from the internet." },
  { rule: "db-open-port", label: "Open database ports", tone: "var(--orange)", text: "Databases listening on ports reachable from 0.0.0.0/0 instead of your app subnets." },
  { rule: "iam-overprivileged", label: "Overly permissive policies", tone: "var(--amber)", text: "Roles carrying far more privilege than the job needs — wildcard scopes or admin access." },
];

function makeRecord(result, mode, raw) {
  const now = Date.now();
  return {
    id: `cloud:${result.account}`,
    kind: "cloud",
    mode,
    name: result.fixtureName,
    account: result.account,
    provider: result.provider,
    scannedAt: result.scannedAt || now,
    addedAt: now,
    lastScanAt: now,
    records: result.records,
    findings: result.findings,
    assets: result.assets,
    clean: result.findings.length === 0,
    state: result.findings.length ? "findings" : "healthy",
    warnings: result.warnings || [],
    skipped: result.skipped || 0,
    raw: raw || null,
  };
}

export default function DemoCloudChecks() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const fileRef = useRef(null);
  const { cloudScans, findings, putCloudScan, removeCloudScan } = useWorkspace();

  const scan = cloudScans[0];

  const [phase, setPhase] = useState("idle"); // idle | importing
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [isDrag, setIsDrag] = useState(false);
  const cancelRef = useRef(false);

  const cloudFindings = useMemo(
    () => (scan ? findings.filter((f) => f.source === "cloud-fixture" && scan.assets.some((a) => a.id === f.asset)) : []),
    [scan, findings]
  );
  const openOnCloud = cloudFindings.filter((f) => f.status !== "resolved").length;

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
    const stopped = (await step("Reading fixture…", 480)) || (await step("Checking storage, databases, and access policies…", 950)) || (await step("Assembling findings…", 460));
    if (stopped) return;
    const rec = factory();
    if (!rec) return;
    putCloudScan(rec);
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
      setError("The file could not be read. Choose the exported .json fixture and try again.");
      return;
    }
    const result = parseCloudFixture(text);
    if (!result.ok) {
      setError(result.errors.join(" "));
      return;
    }
    runImport(() => makeRecord(result, "uploaded", text));
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDrag(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFileChange({ target: { files: e.dataTransfer.files } });
    else setError("Drop a single .json fixture file to import it.");
  };

  const runDemo = () => runImport(() => makeRecord(analyzeDemoFixture(), "demo", null));

  const rescan = async () => {
    if (!scan) return;
    if (scan.mode === "demo") {
      runImport(() => makeRecord(analyzeDemoFixture(), "demo", null));
      return;
    }
    const result = parseCloudFixture(scan.raw || "");
    if (!result.ok) {
      setError(result.errors.join(" "));
      return;
    }
    runImport(() => makeRecord(result, "uploaded", scan.raw));
  };

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Cloud exposure checks</h1>
        <p className="page-sub">
          Upload a scan fixture — a JSON report of your cloud estate — and Kernveil turns it into tracked findings.
          Everything is parsed in this browser: no credentials, no live cloud scan, no API calls.
        </p>
      </header>

      <div className="conn-grid" id="cloudGrid">
        {/* ---------- import / scan card ---------- */}
        <article className="conn-card" data-conn data-cloud id="cloudCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.cloud || ""}</span>
            <div>
              <span className="conn-name">Cloud exposure checks</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Upload a scan fixture</span>
            </div>
          </div>
          <p className="conn-desc">
            Checks three classes of exposure — publicly exposed storage, open database ports, and overly permissive policies — from a fixture you provide.
          </p>

          {phase !== "idle" ? (
            /* ---------- importing / progress ---------- */
            <div className="scan-progress" id="cloudProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{progress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; setPhase("idle"); setProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                No cloud account is contacted — the fixture is read entirely in this browser.
              </p>
            </div>
          ) : scan ? (
            /* ---------- imported / success ---------- */
            <div className="conn-connected" id="cloudConnected" data-state={scan.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: "var(--teal)" }}></span>
                <span>{scan.mode === "demo" ? "Bundled sample fixture · nothing was uploaded" : `Imported from "${scan.name}"`}</span>
                <span className={scan.state === "healthy" ? "badge badge-green" : "badge badge-orange"} style={{ marginLeft: "auto" }}>
                  {scan.state === "healthy" ? "Healthy" : "Findings found"}
                </span>
              </div>

              {scan.state === "healthy" && (
                <div className="conn-healthy" id="cloudHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>No exposed storage, open database ports, or over-permissive policies.</b>
                    <span>This fixture's {scan.records} check{scan.records === 1 ? "" : "s"} came back clean.</span>
                  </div>
                </div>
              )}

              <div className="conn-metrics">
                <span><b>{scan.records}</b>checks</span>
                <span><b>{openOnCloud}</b>active findings</span>
                <span><b>{scan.assets.length}</b>assets affected</span>
              </div>

              <p className="conn-note" style={{ marginTop: "0.6rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {scan.mode === "demo" ? "Demo fixture" : "Imported scan data"}
                </span>
                {scan.mode === "demo"
                  ? "Bundled sample — Kernveil generated these findings from a built-in dataset (no file)."
                  : `File parsed in this browser — no cloud account is connected or billed.`}
                {scan.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
                {scan.clean && scan.warnings.length === 0 && (
                  <span style={{ display: "block", color: "var(--teal)", marginTop: "0.35rem" }}>The fixture reported a completely clean bill.</span>
                )}
              </p>

              {error && (
                <div className="conn-error" id="cloudError" role="alert">
                  <b>Scan failed</b>
                  <span>{error}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={runDemo}>Load the bundled sample instead</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" id="cloudFindings" to="/demo-findings">
                  View findings
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" id="cloudRescan" onClick={rescan} disabled={phase !== "idle"}>Rescan</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="cloudRemove" onClick={() => removeCloudScan(scan.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / upload state ---------- */
            <div id="cloudEmpty">
              <div
                className={`dropzone${isDrag ? " is-drag" : ""}`}
                id="cloudDrop"
                role="button"
                tabIndex={0}
                aria-label="Upload a scan fixture — drop a .json file here or press Enter to browse"
                onClick={() => { if (phase === "idle") fileRef.current && fileRef.current.click(); }}
                onKeyDown={(e) => { if (phase === "idle" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileRef.current && fileRef.current.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={onDrop}
              >
                <span className="dropzone-ic" aria-hidden="true">{TYPE_ICONS.cloud}</span>
                <span className="dropzone-title">Drop a scan fixture here, or click to browse</span>
                <span className="dropzone-sub">A .json report — results[&#123; rule, severity, resource, description, evidence &#125;]</span>
              </div>
              <input ref={fileRef} id="cloudFile" type="file" accept=".json,application/json" className="visually-hidden" onChange={onFileChange} />

              <div className="cloud-actions" style={{ marginTop: "0.8rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" id="cloudDemo" onClick={runDemo}>
                  No fixture handy? Load the bundled sample
                </button>
                <a id="cloudSample" className="btn btn-ghost btn-sm" href={sampleUrl} download="kernveil-cloud-fixture.sample.json">
                  Download a sample fixture
                </a>
              </div>

              {error && (
                <div className="conn-error" id="cloudError" role="alert">
                  <b>Could not import that fixture</b>
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
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.cloud || ""}</span>
            <div>
              <span className="conn-name">What gets checked</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Fixture-based</span>
            </div>
          </div>
          <ul className="cloud-checks" aria-label="Checks performed on an imported fixture">
            {CHECKS.map((c) => (
              <li key={c.rule}>
                <span className="cloud-check-dot" style={{ "--cd": c.tone }}></span>
                <div>
                  <b>{c.label}</b>
                  <span>{c.text}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="conn-note" style={{ marginTop: "0.9rem" }}>
            Kernveil never connects to your cloud provider. You upload a JSON report (or use the bundled sample) and
            every finding is derived from that fixture in this browser.
          </p>
        </article>
      </div>

      <div className="conn-legend">
        <span style={{ "--lg-c": "var(--slate)" }}>Bundled sample fixture (simulation)</span>
        <span style={{ "--lg-c": "var(--teal)" }}>Imported from an uploaded fixture</span>
        <span style={{ "--lg-c": "var(--text-disabled)" }}>No live cloud account involved</span>
      </div>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }} id="cloudNote">
        {scan
          ? scan.mode === "demo"
            ? `Currently showing the bundled sample fixture — ${openOnCloud} open finding${openOnCloud === 1 ? "" : "s"} surfaced from simulated data. Upload a real fixture to replace it.`
            : `Currently showing imported scan data — "${scan.name}" was read from the file you uploaded. No cloud account is connected, so nothing is billed or monitored live.`
          : "Nothing imported yet. Load the bundled sample or upload a scan fixture to see the checks in action."}
      </p>
    </div>
  );
}