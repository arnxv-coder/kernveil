/* ============================================================
   Kernveil — demo Website checks page.
   Evaluate a public host against HTTPS enforcement, TLS health,
   security headers, and the SPF / DKIM / DMARC mail records.
   Everything is simulated and clearly labelled — no live DNS,
   TLS, or HTTP interrogation ever leaves the browser. A bundled
   sample site profile exists so the flow is believable without
   typing anything in.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion, CONN_ICONS } from "../../lib/anim.jsx";
import { WEBSITE_CHECKS, analyzeDemoSite, analyzeHostScan, normalizeHost } from "../../lib/websiteScan.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function makeRecord(result, mode) {
  const now = Date.now();
  return {
    id: `web:${result.host}`,
    kind: "website",
    mode,
    name: result.host,
    host: result.host,
    addedAt: now,
    lastScanAt: now,
    records: result.records,
    checks: result.checks,
    findings: result.findings,
    assets: result.assets,
    clean: result.findings.length === 0,
    state: result.findings.length ? "findings" : "healthy",
    warnings: result.warnings || [],
    skipped: result.skipped || 0,
  };
}

export default function DemoWebsiteChecks() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const { webScans, findings, putWebScan, removeWebScan } = useWorkspace();

  const scan = webScans[0];

  const [phase, setPhase] = useState("idle"); // idle | scanning
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [url, setUrl] = useState("");
  const cancelRef = useRef(false);

  const webFindings = useMemo(
    () => (scan ? findings.filter((f) => f.source === "website-fixture" && scan.assets.some((a) => a.id === f.asset)) : []),
    [scan, findings]
  );
  const openOnWeb = webFindings.filter((f) => f.status !== "completed").length;

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

  const runScan = async (factory) => {
    cancelRef.current = false;
    setError(null);
    setPhase("scanning");
    const stopped =
      (await step("Evaluating HTTPS and TLS…", 520)) ||
      (await step("Reading security headers…", 620)) ||
      (await step("Checking DNS records — SPF, DKIM, DMARC…", 760)) ||
      (await step("Assembling findings…", 420));
    if (stopped) return;
    const rec = factory();
    if (!rec) return;
    putWebScan(rec);
    if (!cancelRef.current) setPhase("idle");
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const norm = normalizeHost(url);
    if (!norm.ok) {
      setError(norm.error);
      return;
    }
    runScan(() => makeRecord(analyzeHostScan(norm.host), "scan"));
  };

  const runDemo = () => runScan(() => makeRecord(analyzeDemoSite(), "demo"));

  const rescan = async () => {
    if (!scan) return;
    if (scan.mode === "demo") {
      runScan(() => makeRecord(analyzeDemoSite(), "demo"));
      return;
    }
    runScan(() => makeRecord(analyzeHostScan(scan.host), "scan"));
  };

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Website checks</h1>
        <p className="page-sub">
          Evaluate a public host against HTTPS enforcement, TLS certificate health, security headers, and the
          SPF / DKIM / DMARC mail records. Every check runs as a clearly-labelled simulation in this browser — no
          real site is contacted.
        </p>
      </header>

      <div className="conn-grid" id="webGrid">
        {/* ---------- evaluate / scan card ---------- */}
        <article className="conn-card" data-conn id="webCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.website || ""}</span>
            <div>
              <span className="conn-name">Website evaluation</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Enter a host</span>
            </div>
          </div>
          <p className="conn-desc">
            Runs six checks — HTTPS, TLS, security headers, SPF, DKIM, and DMARC — and turns any failures into
            tracked findings.
          </p>

          {phase !== "idle" ? (
            /* ---------- scanning / progress ---------- */
            <div className="scan-progress" id="webProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{progress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; setPhase("idle"); setProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                Simulated evaluation — no live DNS, TLS, or HTTP interrogation happens in this demo.
              </p>
            </div>
          ) : scan ? (
            /* ---------- evaluated / success ---------- */
            <div className="conn-connected" id="webConnected" data-state={scan.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: "var(--teal)" }}></span>
                <span>{scan.mode === "demo" ? "Bundled sample site · nothing was contacted" : `Evaluated "${scan.name}" (simulated)`}</span>
                <span className={scan.state === "healthy" ? "badge badge-green" : "badge badge-orange"} style={{ marginLeft: "auto" }}>
                  {scan.state === "healthy" ? "Healthy" : "Findings found"}
                </span>
              </div>

              {scan.state === "healthy" && (
                <div className="conn-healthy" id="webHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>No HTTPS, TLS, header, or mail-authentication issues found.</b>
                    <span>All {scan.records} checks passed for this host.</span>
                  </div>
                </div>
              )}

              <div className="conn-metrics">
                <span><b>{scan.records}</b>checks</span>
                <span><b>{openOnWeb}</b>active findings</span>
                <span><b>{scan.assets.length}</b>asset{scan.assets.length === 1 ? "" : "s"} affected</span>
              </div>

              {!scan.clean && (
                <ul className="scan-results" aria-label="Website check results">
                  {scan.checks.map((c) => (
                    <li className="scan-check" key={c.rule}>
                      <span className="scan-check-dot" style={{ "--cd": c.status === "pass" ? "var(--green)" : c.status === "warn" ? "var(--amber)" : "var(--red)" }}></span>
                      <span className="scan-check-label">{c.label}</span>
                      <span className={`badge ${c.status === "pass" ? "badge-teal" : c.status === "warn" ? "badge-amber" : "badge-orange"}`} style={{ fontSize: "0.64rem", marginLeft: "auto" }}>
                        {c.status === "pass" ? "Pass" : c.status === "warn" ? "Warning" : "Fail"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="conn-note" style={{ marginTop: "0.6rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {scan.mode === "demo" ? "Demo site" : "Simulated scan"}
                </span>
                {scan.mode === "demo"
                  ? "Bundled sample — Kernveil generated these checks from a built-in site profile (no live scan)."
                  : "Simulated host evaluation in this browser — no domains were actually contacted, so nothing claims to be a live scan."}
                {scan.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
                {scan.clean && scan.warnings.length === 0 && (
                  <span style={{ display: "block", color: "var(--teal)", marginTop: "0.35rem" }}>This host came back clean on every check.</span>
                )}
              </p>

              {error && (
                <div className="conn-error" id="webError" role="alert">
                  <b>Scan failed</b>
                  <span dangerouslySetInnerHTML={{ __html: error }} />
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={runDemo}>Load the bundled sample instead</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" id="webFindings" to="/demo-findings">
                  View findings
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" id="webRescan" onClick={rescan} disabled={phase !== "idle"}>Rescan</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="webRemove" onClick={() => removeWebScan(scan.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / enter host ---------- */
            <div id="webEmpty">
              <form className="conn-form" id="webForm" onSubmit={onSubmit}>
                <div className="field">
                  <label htmlFor="webUrl">Website host</label>
                  <input
                    id="webUrl"
                    type="text"
                    placeholder="e.g. api.acme.com"
                    autoComplete="off"
                    spellCheck="false"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); if (error) setError(null); }}
                  />
                  <span className="field-hint">Simulated evaluation — no real site is contacted or scanned.</span>
                </div>

                <div className="conn-actions" style={{ flexWrap: "wrap" }}>
                  <button type="submit" className="btn btn-primary btn-sm" id="webConnect">
                    Evaluate host
                    <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" id="webDemo" onClick={runDemo}>
                    No site handy? Load the bundled sample
                  </button>
                </div>
              </form>

              {error && (
                <div className="conn-error" id="webError" role="alert">
                  <b>Could not evaluate that host</b>
                  <span dangerouslySetInnerHTML={{ __html: error }} />
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
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.website || ""}</span>
            <div>
              <span className="conn-name">What gets checked</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Six checks</span>
            </div>
          </div>
          <ul className="cloud-checks" aria-label="Checks performed on an evaluated host">
            {WEBSITE_CHECKS.map((c) => (
              <li key={c.rule}>
                <span className="cloud-check-dot" style={{ "--cd": "var(--teal)" }}></span>
                <div>
                  <b>{c.label}</b>
                  <span>{c.text}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="conn-note" style={{ marginTop: "0.9rem" }}>
            Kernveil never contacts a real site or DNS server in this demo. You enter a host (or use the bundled
            sample) and every check result is derived from a simulated profile in this browser.
          </p>
        </article>
      </div>

      <div className="conn-legend">
        <span style={{ "--lg-c": "var(--slate)" }}>Bundled sample site (simulation)</span>
        <span style={{ "--lg-c": "var(--teal)" }}>Simulated host evaluation</span>
        <span style={{ "--lg-c": "var(--text-disabled)" }}>No live scanning anywhere</span>
      </div>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }} id="webNote">
        {scan
          ? scan.mode === "demo"
            ? `Currently showing the bundled sample site — ${openOnWeb} open finding${openOnWeb === 1 ? "" : "s"} surfaced from simulated data.`
            : `Currently showing the simulated evaluation of "${scan.name}". No domain was actually contacted, so nothing is claimed as a live scan.`
          : "Nothing evaluated yet. Use the bundled sample or enter a host to see the checks in action."}
      </p>
    </div>
  );
}