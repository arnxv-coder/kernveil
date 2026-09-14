/* ============================================================
   Kernveil — demo Connectors page.
   GitHub is a real, functional connector (public repositories can
   be scanned without credentials). Every other card remains a
   clearly-labelled simulation.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion, CONN_ICONS } from "../../lib/anim.jsx";
import { CONNECTORS } from "../../lib/data.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { scanRepository, buildDemoScan } from "../../lib/githubScan.js";

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

const REPO_PATTERN = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+)$/;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function resultToRecord(r) {
  return {
    id: `gh:${r.repo}`,
    kind: "github",
    name: r.repo,
    mode: r.mode,
    repoUrl: r.repoUrl,
    addedAt: r.scanAt,
    lastScanAt: r.scanAt,
    manifestPath: r.manifestPath,
    depCount: r.depCount,
    vulnerableCount: r.vulnerableCount,
    outdatedCount: r.outdatedCount,
    skipped: r.skipped || 0,
    healthy: r.healthy,
    state: r.healthy ? "healthy" : "findings",
    asset: r.asset,
    findings: r.findings,
  };
}

export default function DemoConnectors() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const { connectors, findings, putConnector, removeConnector } = useWorkspace();

  const gh = connectors.find((c) => c.kind === "github");

  const [repoInput, setRepoInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | connecting | demo
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);

  const ghFindings = useMemo(
    () => (gh ? findings.filter((f) => f.related && f.related[0] === gh.asset.id) : []),
    [findings, gh]
  );
  const openOnGh = ghFindings.filter((f) => f.status !== "resolved").length;

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

  const runLive = async (e) => {
    e.preventDefault();
    const m = repoInput.trim().match(REPO_PATTERN);
    if (!m) {
      setError("Enter a repository as owner/name — e.g. <b>vercel/next.js</b>.");
      setProgress("");
      return;
    }
    cancelRef.current = false;
    setError(null);
    setPhase("connecting");
    setProgress("Reading dependency manifest…");
    try {
      const result = await scanRepository({
        owner: m[1],
        repo: m[2],
        token: tokenInput.trim(),
        onProgress: (p) => { if (!cancelRef.current) setProgress(p.label); },
      });
      if (cancelRef.current) return;
      putConnector(resultToRecord(result));
    } catch (err) {
      if (!cancelRef.current) setError(err.message || "The scan could not complete.");
    } finally {
      if (!cancelRef.current) setPhase("idle");
    }
  };

  const runDemo = async () => {
    cancelRef.current = false;
    setError(null);
    setPhase("demo");
    setProgress("Reading package-lock.json…");
    try {
      await delay(600);
      if (!cancelRef.current) setProgress("Checking 8 packages against published advisories…");
      await delay(900);
      if (cancelRef.current) return;
      setProgress("Assembling findings…");
      await delay(400);
      if (cancelRef.current) return;
      putConnector(resultToRecord(buildDemoScan()));
    } finally {
      if (!cancelRef.current) setPhase("idle");
    }
  };

  const rescan = async () => {
    if (!gh) return;
    setError(null);
    if (gh.mode === "demo") {
      setPhase("demo");
      setProgress("Re-reading simulated manifest…");
      await delay(800);
      putConnector(resultToRecord(buildDemoScan()));
      setPhase("idle");
      return;
    }
    const parts = gh.name.split("/");
    cancelRef.current = false;
    setPhase("connecting");
    setProgress("Reading dependency manifest…");
    try {
      const result = await scanRepository({
        owner: parts[0],
        repo: parts[1],
        token: "",
        onProgress: (p) => { if (!cancelRef.current) setProgress(p.label); },
      });
      if (cancelRef.current) return;
      putConnector(resultToRecord(result));
    } catch (err) {
      if (!cancelRef.current) setError(`Rescan failed — ${err.message}`);
    } finally {
      if (!cancelRef.current) setPhase("idle");
    }
  };

  const githubMeta = CONNECTORS.find((c) => c.id === "github");

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Connectors</h1>
        <p className="page-sub">
          The systems Kernveil is designed to understand. The GitHub connector is live in this preview — every other
          connector remains clearly labelled simulated sample data.
        </p>
      </header>

      <div className="conn-grid" id="connGrid">
        {/* ---------- GitHub — real connector ---------- */}
        <article className="conn-card" data-conn data-github>
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.github || ""}</span>
            <div>
              <span className="conn-name">{githubMeta.name}</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>{githubMeta.type}</span>
            </div>
          </div>
          <p className="conn-desc">{githubMeta.desc}</p>

          {phase !== "idle" ? (
            /* ---------- loading / progress ---------- */
            <div className="scan-progress" id="scanProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{progress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; setPhase("idle"); setProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                {phase === "demo"
                  ? "Simulated repository scan — no network requests are made for demo data."
                  : "Only the manifest and lockfile are read. Source code never leaves the browser."}
              </p>
            </div>
          ) : gh ? (
            /* ---------- connected / success ---------- */
            <div className="conn-connected" id="ghConnected" data-state={gh.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: "var(--teal)" }}></span>
                <span>{gh.mode === "demo" ? "Demo simulation · no real repository scanned" : `Connected · github.com/${gh.name}`}</span>
                <span className={gh.state === "healthy" ? "badge badge-green" : "badge badge-orange"} style={{ marginLeft: "auto" }}>
                  {gh.state === "healthy" ? "Healthy" : "Findings found"}
                </span>
              </div>

              {gh.state === "healthy" && (
                <div className="conn-healthy" id="ghHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>No vulnerable or outdated dependencies found.</b>
                    <span>This repository's <code className="mono">{gh.manifestPath}</code> resolves {gh.depCount} packages with a clean bill.</span>
                  </div>
                </div>
              )}

              <div className="conn-metrics">
                <span><b>1</b>repo monitored</span>
                <span><b>{openOnGh}</b>active findings</span>
                <span><b>{gh.depCount}</b>dependencies checked</span>
              </div>

              <p className="conn-note" style={{ marginTop: "0.6rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {gh.mode === "demo" ? "Demo scan" : "Live scan"}
                </span>
                {gh.mode === "demo" ? "Simulated data for " : "Scanned from "}
                <code className="mono">{gh.name}</code> · manifest {gh.manifestPath}
                {gh.skipped > 0 && <span style={{ display: "block", color: "var(--amber)", marginTop: "0.35rem" }}>{gh.skipped} packages skipped (registry/advisory service unreachable).</span>}
              </p>

              {error && (
                <div className="conn-error" id="ghError" role="alert">
                  <b>Scan failed</b>
                  <span dangerouslySetInnerHTML={{ __html: error }} />
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" to="/demo-findings">
                  View findings
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={rescan} disabled={phase !== "idle"}>Rescan</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" onClick={() => removeConnector(gh.id)}>Disconnect</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- connect form ---------- */
            <form className="conn-form" id="ghForm" onSubmit={runLive}>
              <div className="field">
                <label htmlFor="ghRepo">Repository</label>
                <input
                  id="ghRepo"
                  type="text"
                  placeholder="owner/name — e.g. vercel/next.js"
                  autoComplete="off"
                  spellCheck="false"
                  value={repoInput}
                  onChange={(e) => { setRepoInput(e.target.value); if (error) setError(null); }}
                />
                <span className="field-hint">Public repositories need no credentials.</span>
              </div>
              <div className="field">
                <label htmlFor="ghToken">Personal access token <span className="opt">optional</span></label>
                <input
                  id="ghToken"
                  type="password"
                  placeholder="ghp_… (private repositories only)"
                  autoComplete="off"
                  value={tokenInput}
                  onChange={(e) => { setTokenInput(e.target.value); if (error) setError(null); }}
                />
                <span className="field-hint">Stored only in this browser while you scan. Never saved to your workspace.</span>
              </div>

              {error && (
                <div className="conn-error" id="ghError" role="alert">
                  <b>Could not scan this repository</b>
                  <span dangerouslySetInnerHTML={{ __html: error }} />
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={runDemo}>Use a simulated repo instead</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ flexWrap: "wrap" }}>
                <button type="submit" className="btn btn-primary btn-sm" id="ghConnect">
                  Connect &amp; scan
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" className="btn btn-ghost btn-sm" id="ghDemo" onClick={runDemo}>
                  No repo handy? Load a simulated one
                </button>
              </div>
            </form>
          )}
        </article>

        {/* ---------- other connectors (simulated) ---------- */}
        {CONNECTORS.filter((c) => c.id !== "github").map((c) => {
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
        <span style={{ "--lg-c": "var(--teal)" }}>Live in this preview (real GitHub scan)</span>
        <span style={{ "--lg-c": "var(--slate)" }}>Simulated in this demo</span>
        <span style={{ "--lg-c": "var(--text-disabled)" }}>Planned / coming soon</span>
      </div>

      <p className="result-count" style={{ marginTop: "1.6rem", textAlign: "center" }} id="connectorsNote">
        {gh
          ? `GitHub connector is real — ${gh.name} was ${gh.mode === "demo" ? "simulated (no repository was actually scanned)" : "scanned over the GitHub raw API"}. All other connector data on this page is fictional sample data.`
          : "Only the GitHub connector is functional in this preview. All other connector data is simulated; nothing else is actually connected."}
      </p>
    </div>
  );
}