/* ============================================================
   Kernveil — demo Connectors page.
   Every connector now shares one framework: a connection status,
   the named scopes it accesses, a "last sync" line and a sync
   history, plus honest data labels that keep simulated sources
   clearly labelled. GitHub is the only live connector (public
   repositories can be scanned without credentials). Cloud reads a
   fixture uploaded on the Cloud checks page — nothing else talks
   to a real service.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion, CONN_ICONS } from "../../lib/anim.jsx";
import { CONNECTORS } from "../../lib/data.js";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { scanRepository, buildDemoScan } from "../../lib/githubScan.js";
import { analyzeDemoFixture } from "../../lib/cloudFixture.js";
import { analyzeDemoSite, analyzeHostScan, normalizeHost } from "../../lib/websiteScan.js";
import { buildDemoBackupResult, buildBackupRecord } from "../../lib/backupScan.js";
import { buildDemoIdentityResult, buildIdentityRecord } from "../../lib/identityScan.js";
import {
  CONN_STATE_META,
  SOURCE_SCOPES,
  connStatusFor,
  dataLabel,
  lastSyncText,
  relTime,
  syncHistoryOf,
} from "../../lib/connectors.js";

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

function cloudRecordFrom(result, mode) {
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
  };
}

function websiteRecordFrom(result, mode) {
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

const stripTags = (html) => String(html || "").replace(/<[^>]+>/g, "").trim();

/* ---------- shared card building blocks ---------- */

function StateBadges({ meta, state, noteLabel }) {
  return (
    <span style={{ marginLeft: "auto", display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
      <span className={`badge ${meta.cls}`}>{meta.label}</span>
      {noteLabel && <span className="badge badge-ghost" style={{ fontSize: "0.66rem" }}>{noteLabel}</span>}
      <span className={state === "healthy" ? "badge badge-green" : "badge badge-orange"}>
        {state === "healthy" ? "Healthy" : "Findings found"}
      </span>
    </span>
  );
}

function ScopesBlock({ source, id, label = "What it accesses" }) {
  return (
    <div className="conn-scopes" id={id}>
      <span className="scopes-label">{label}</span>
      <ul className="scopes-list">
        {(SOURCE_SCOPES[source] || []).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function SyncBlock({ source, record, id, lastId }) {
  const last = lastSyncText(record);
  const entries = syncHistoryOf(source, record);
  return (
    <div className="conn-sync" id={id}>
      <span className="conn-sync-line" id={lastId}>Last successful sync <b>{last}</b></span>
      {entries.length > 0 && (
        <details className="sync-history">
          <summary>Sync history · {entries.length}</summary>
          <ul className="sync-list">
            {entries.map((e, i) => (
              <li key={i}>
                <span className="sync-dot" style={{ "--sync-c": e.ok ? "var(--teal)" : "var(--red)" }}></span>
                <span className="sync-time mono">{relTime(e.at)}</span>
                <span className="sync-note">{e.note}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ============================================================ */

export default function DemoConnectors() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const { connectors, findings, putConnector, removeConnector, noteConnectorFailure, cloudScans, putCloudScan, removeCloudScan, webScans, putWebScan, removeWebScan, backupScans, putBackupScan, removeBackupScan, identityScans, putIdentityScan, removeIdentityScan } = useWorkspace();

  const gh = connectors.find((c) => c.kind === "github");
  const cloud = cloudScans[0];
  const web = webScans[0];
  const backup = backupScans[0];
  const identity = identityScans[0];

  /* --- github local state --- */
  const [repoInput, setRepoInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | connecting | demo
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);

  /* --- cloud local state (connector-page mirror of /demo-cloud) --- */
  const [cloudPhase, setCloudPhase] = useState("idle"); // idle | importing
  const [cloudProgress, setCloudProgress] = useState("");
  const [cloudError, setCloudError] = useState(null);
  const cloudCancelRef = useRef(false);

  /* --- website local state (connector-page mirror of /demo-website) --- */
  const [webPhase, setWebPhase] = useState("idle"); // idle | scanning
  const [webProgress, setWebProgress] = useState("");
  const [webError, setWebError] = useState(null);
  const [webUrl, setWebUrl] = useState("");
  const webCancelRef = useRef(false);

  /* --- backup local state (connector-page mirror of /demo-backups) --- */
  const [bkPhase, setBkPhase] = useState("idle"); // idle | importing
  const [bkProgress, setBkProgress] = useState("");
  const [bkError, setBkError] = useState(null);
  const bkCancelRef = useRef(false);

  /* --- identity local state (connector-page mirror of /demo-identity) --- */
  const [idpPhase, setIdpPhase] = useState("idle"); // idle | importing
  const [idpProgress, setIdpProgress] = useState("");
  const [idpError, setIdpError] = useState(null);
  const idpCancelRef = useRef(false);

  const ghFindings = useMemo(
    () => (gh ? findings.filter((f) => f.related && f.related[0] === (gh.asset ? gh.asset.id : gh.id)) : []),
    [findings, gh]
  );
  const openOnGh = ghFindings.filter((f) => f.status !== "completed").length;

  const cloudFindings = useMemo(
    () => (cloud ? findings.filter((f) => f.source === "cloud-fixture" && cloud.assets.some((a) => a.id === f.asset)) : []),
    [cloud, findings]
  );
  const openOnCloud = cloudFindings.filter((f) => f.status !== "completed").length;

  const webFindings = useMemo(
    () => (web ? findings.filter((f) => f.source === "website-fixture" && web.assets.some((a) => a.id === f.asset)) : []),
    [web, findings]
  );
  const openOnWeb = webFindings.filter((f) => f.status !== "completed").length;

  const backupFindings = useMemo(
    () => (backup ? findings.filter((f) => f.source === "backup-fixture" && backup.assets.some((a) => a.id === f.asset)) : []),
    [backup, findings]
  );
  const openOnBk = backupFindings.filter((f) => f.status !== "completed").length;
  const backupProtected = backup ? backup.systems.filter((s) => s.state === "healthy").length : 0;

  const identityFindings = useMemo(
    () => (identity ? findings.filter((f) => f.source === "identity-fixture" && identity.assets.some((a) => a.id === f.asset)) : []),
    [identity, findings]
  );
  const openOnIdp = identityFindings.filter((f) => f.status !== "completed").length;
  const identityCompliant = identity ? identity.identities.filter((s) => s.state === "healthy").length : 0;

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

  useEffect(() => () => { cancelRef.current = true; cloudCancelRef.current = true; webCancelRef.current = true; bkCancelRef.current = true; }, []);

  /* ---------- GitHub flows ---------- */

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
      if (!cancelRef.current) {
        const msg = `Rescan failed — ${stripTags(err.message || "unknown error")}`;
        setError(msg);
        noteConnectorFailure(gh.id, msg);
      }
    } finally {
      if (!cancelRef.current) setPhase("idle");
    }
  };

  /* ---------- Cloud flows (connector-page mirror) ---------- */

  const cloudRunDemo = async () => {
    cloudCancelRef.current = false;
    setCloudError(null);
    setCloudPhase("importing");
    setCloudProgress("Reading bundled sample fixture…");
    await delay(480);
    if (cloudCancelRef.current) return;
    setCloudProgress("Checking storage, databases, and access policies…");
    await delay(950);
    if (cloudCancelRef.current) return;
    setCloudProgress("Assembling findings…");
    await delay(460);
    if (cloudCancelRef.current) return;
    putCloudScan(cloudRecordFrom(analyzeDemoFixture(), "demo"));
    setCloudPhase("idle");
  };

  const cloudRescan = async () => {
    if (!cloud) return;
    if (cloud.mode === "demo") {
      cloudRunDemo();
      return;
    }
    setCloudError("This fixture was imported on the Cloud checks page — open it there to re-scan the same file.");
  };

  /* ---------- Website flows (connector-page mirror) ---------- */

  const websiteRunScan = async (result, mode) => {
    webCancelRef.current = false;
    setWebError(null);
    setWebPhase("scanning");
    setWebProgress("Evaluating HTTPS and TLS…");
    let stopped = false;
    stopped = webCancelRef.current;
    await delay(520);
    if (webCancelRef.current) return;
    setWebProgress("Reading security headers…");
    await delay(620);
    if (webCancelRef.current) return;
    setWebProgress("Checking DNS records — SPF, DKIM, DMARC…");
    await delay(760);
    if (webCancelRef.current) return;
    setWebProgress("Assembling findings…");
    await delay(420);
    if (webCancelRef.current) return;
    putWebScan(websiteRecordFrom(result, mode));
    setWebPhase("idle");
  };

  const webRunDemo = () => websiteRunScan(analyzeDemoSite("demo"), "demo");

  const webConnect = async (e) => {
    e.preventDefault();
    const norm = normalizeHost(webUrl);
    if (!norm.ok) {
      setWebError(norm.error);
      return;
    }
    if (webCancelRef.current) return;
    setWebError(null);
    setWebPhase("scanning");
    setWebProgress("Evaluating HTTPS and TLS…");
    await delay(520);
    if (webCancelRef.current) return;
    setWebProgress("Reading security headers…");
    await delay(620);
    if (webCancelRef.current) return;
    setWebProgress("Checking DNS records — SPF, DKIM, DMARC…");
    await delay(760);
    if (webCancelRef.current) return;
    setWebProgress("Assembling findings…");
    await delay(420);
    if (webCancelRef.current) return;
    putWebScan(websiteRecordFrom(analyzeHostScan(norm.host), "scan"));
    setWebPhase("idle");
  };

  const webRescan = async () => {
    if (!web) return;
    if (web.mode === "demo") {
      webRunDemo();
      return;
    }
    putWebScan(websiteRecordFrom(analyzeHostScan(web.host), "scan"));
  };

  /* ---------- Backup flows (connector-page mirror) ---------- */

  const bkRunDemo = async () => {
    bkCancelRef.current = false;
    setBkError(null);
    setBkPhase("importing");
    setBkProgress("Reading bundled backup register…");
    await delay(480);
    if (bkCancelRef.current) return;
    setBkProgress("Checking retention schedules and restore coverage…");
    await delay(950);
    if (bkCancelRef.current) return;
    setBkProgress("Assembling findings…");
    await delay(460);
    if (bkCancelRef.current) return;
    putBackupScan(buildBackupRecord(buildDemoBackupResult(), "demo"));
    setBkPhase("idle");
  };

  const bkRescan = () => {
    if (!backup) return;
    if (backup.mode === "demo") {
      bkRunDemo();
      return;
    }
    setBkError("This register was imported on the Backup checks page — open it there to reconsider the same file.");
  };

  /* ---------- Identity flows (connector-page mirror) ---------- */

  const idpRunDemo = async () => {
    idpCancelRef.current = false;
    setIdpError(null);
    setIdpPhase("importing");
    setIdpProgress("Reading bundled identity directory…");
    await delay(480);
    if (idpCancelRef.current) return;
    setIdpProgress("Checking roles, MFA and admin history…");
    await delay(950);
    if (idpCancelRef.current) return;
    setIdpProgress("Assembling findings…");
    await delay(460);
    if (idpCancelRef.current) return;
    putIdentityScan(buildIdentityRecord(buildDemoIdentityResult(), "demo"));
    setIdpPhase("idle");
  };

  const idpRescan = () => {
    if (!identity) return;
    if (identity.mode === "demo") {
      idpRunDemo();
      return;
    }
    setIdpError("This directory was imported on the Identity checks page — open it there to reconsider the same file.");
  };

  const githubMeta = CONNECTORS.find((c) => c.id === "github");
  const ghState = connStatusFor({ record: gh, busy: phase !== "idle", openCount: openOnGh });
  const cloudConnState = connStatusFor({ record: cloud, busy: cloudPhase !== "idle", openCount: openOnCloud });
  const webConnState = connStatusFor({ record: web, busy: webPhase !== "idle", openCount: openOnWeb });
  const bkConnState = connStatusFor({ record: backup, busy: bkPhase !== "idle", openCount: openOnBk });
  const idpConnState = connStatusFor({ record: identity, busy: idpPhase !== "idle", openCount: openOnIdp });

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Connectors</h1>
        <p className="page-sub">
          The systems Kernveil is designed to understand, each with the scopes it reads and a sync trail. Only the
          GitHub connector is live in this preview — cloud fixtures, website evaluations, and backup registers are
          clearly labelled simulated sample data.
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
                <span className="status-dot" style={{ background: CONN_STATE_META[ghState].dot }}></span>
                <span>{gh.mode === "demo" ? "Demo connector connected — simulated data, no real repo scanned" : `Connected · github.com/${gh.name}`}</span>
                <StateBadges meta={CONN_STATE_META[ghState]} state={gh.state} />
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
                  {dataLabel("github", gh)}
                </span>
                {gh.mode === "demo" ? "Simulated data for " : "Scanned from "}
                <span id="ghConnUrl">
                  <a className="mono" href={gh.repoUrl} target="_blank" rel="noreferrer">{gh.name}</a>
                </span>
                · manifest <code className="mono">{gh.manifestPath}</code>
                {gh.skipped > 0 && <span style={{ display: "block", color: "var(--amber)", marginTop: "0.35rem" }}>{gh.skipped} packages skipped (registry/advisory service unreachable).</span>}
              </p>

              {error && (
                <div className="conn-error" id="ghError" role="alert">
                  <b>Scan failed</b>
                  <span>{error}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={rescan}>Retry rescan</button>
                  </span>
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
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META.disconnected.dot }}></span>
                <span>Not connected — scan a public repository to begin.</span>
                <span className="badge badge-slate" style={{ marginLeft: "auto" }}>{CONN_STATE_META.disconnected.label}</span>
              </div>
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
                  No repo handy? Connect demo repo
                </button>
              </div>
            </form>
          )}

          <ScopesBlock source="github" id="ghScopes" />
          <SyncBlock source="github" record={gh} id="ghSync" lastId="ghLastSync" />
        </article>

        {/* ---------- Cloud environment (fixture connector) ---------- */}
        <article className="conn-card" data-conn data-cloud id="cloudCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.cloud || ""}</span>
            <div>
              <span className="conn-name">Cloud environment</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Cloud</span>
            </div>
          </div>
          <p className="conn-desc">
            Storage, networking, compute, and identity posture — read from a scan fixture you provide. No cloud account is ever connected.
          </p>

          {cloudPhase !== "idle" ? (
            /* ---------- importing / progress ---------- */
            <div className="scan-progress" id="cloudProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{cloudProgress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { cloudCancelRef.current = true; setCloudPhase("idle"); setCloudProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                No cloud account is contacted — the fixture is read entirely in this browser.
              </p>
            </div>
          ) : cloud ? (
            /* ---------- imported / success ---------- */
            <div className="conn-connected" id="cloudConnected" data-state={cloud.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META[cloudConnState].dot }}></span>
                <span>{cloud.mode === "demo" ? "Bundled sample fixture · nothing was uploaded" : `Imported from "${cloud.name}"`}</span>
                <StateBadges meta={CONN_STATE_META[cloudConnState]} state={cloud.state} />
              </div>

              <div className="conn-metrics">
                <span><b>{cloud.records}</b>checks</span>
                <span><b>{openOnCloud}</b>active findings</span>
                <span><b>{cloud.assets.length}</b>assets affected</span>
              </div>

              <p className="conn-note" style={{ marginTop: "0.6rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {dataLabel("cloud", cloud)}
                </span>
                {cloud.mode === "demo"
                  ? "Bundled sample — Kernveil generated these findings from a built-in dataset (no file)."
                  : "File parsed in this browser — no cloud account is connected or billed."}
                {cloud.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
                {cloud.clean && cloud.warnings.length === 0 && (
                  <span style={{ display: "block", color: "var(--teal)", marginTop: "0.35rem" }}>The fixture reported a completely clean bill.</span>
                )}
              </p>

              {cloudError && (
                <div className="conn-error" id="cloudError" role="alert">
                  <b>Scan failed</b>
                  <span>{cloudError}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCloudError(null)}>Dismiss</button>
                  </span>
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
                  <button type="button" className="btn btn-ghost btn-sm" id="cloudRescan" onClick={cloudRescan} disabled={cloudPhase !== "idle"}>Rescan</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="cloudRemove" onClick={() => removeCloudScan(cloud.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / not connected ---------- */
            <div id="cloudEmpty">
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META.disconnected.dot }}></span>
                <span>Not connected — no fixture loaded on this page.</span>
                <span className="badge badge-slate" style={{ marginLeft: "auto" }}>{CONN_STATE_META.disconnected.label}</span>
              </div>
              <div className="conn-actions" style={{ marginTop: "0.9rem", justifyContent: "flex-start" }}>
                <Link className="btn btn-secondary btn-sm" to="/demo-cloud">
                  Set up cloud checks
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" id="cloudDemo" onClick={cloudRunDemo}>
                  No fixture handy? Load the bundled sample
                </button>
              </div>

              {cloudError && (
                <div className="conn-error" id="cloudError" role="alert">
                  <b>Could not load a fixture</b>
                  <span>{cloudError}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCloudError(null)}>Dismiss</button>
                  </span>
                </div>
              )}
            </div>
          )}

          <ScopesBlock source="cloud" id="cloudScopes" />
          <SyncBlock source="cloud" record={cloud} id="cloudSync" lastId="cloudLastSync" />
        </article>

        {/* ---------- Website (simulated connector) ---------- */}
        <article className="conn-card" data-conn id="webCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.website || ""}</span>
            <div>
              <span className="conn-name">Website</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Website</span>
            </div>
          </div>
          <p className="conn-desc">Public exposure checks, TLS health, security headers, and mail authentication for the sites you answer for.</p>

          {webPhase !== "idle" ? (
            /* ---------- scanning / progress ---------- */
            <div className="scan-progress" id="webProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{webProgress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { webCancelRef.current = true; setWebPhase("idle"); setWebProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                Simulated evaluation — no live DNS, TLS, or HTTP interrogation happens in this demo.
              </p>
            </div>
          ) : web ? (
            /* ---------- connected / success ---------- */
            <div className="conn-connected" id="webConnected" data-state={web.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META[webConnState].dot }}></span>
                <span>{web.mode === "demo" ? "Bundled sample site · nothing was contacted" : `Evaluated "${web.name}" (simulated)`}</span>
                <StateBadges meta={CONN_STATE_META[webConnState]} state={web.state} />
              </div>

              {web.clean && web.warnings.length === 0 && (
                <div className="conn-healthy" id="webHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>No HTTPS, TLS, header, or mail-authentication issues found.</b>
                    <span>All {web.records} checks passed for this host.</span>
                  </div>
                </div>
              )}

              <div className="conn-metrics">
                <span><b>{web.records}</b>checks</span>
                <span><b>{openOnWeb}</b>active findings</span>
                <span><b>{web.assets.length}</b>asset{web.assets.length === 1 ? "" : "s"} affected</span>
              </div>

              {!web.clean && (
                <ul className="scan-results" aria-label="Website check results">
                  {web.checks.map((c) => (
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
                  {dataLabel("website", web)}
                </span>
                {web.mode === "demo"
                  ? "Bundled sample — Kernveil generated these checks from a built-in site profile (no live scan)."
                  : "Simulated host evaluation in this browser — no domains were actually contacted, so nothing claims to be a live scan."}
                {web.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
              </p>

              {webError && (
                <div className="conn-error" id="webError" role="alert">
                  <b>Scan failed</b>
                  <span>{webError}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWebError(null)}>Dismiss</button>
                  </span>
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
                  <button type="button" className="btn btn-ghost btn-sm" id="webRescan" onClick={webRescan} disabled={webPhase !== "idle"}>Rescan</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="webRemove" onClick={() => removeWebScan(web.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / not connected ---------- */
            <div id="webEmpty">
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META.disconnected.dot }}></span>
                <span>Not connected — no site evaluated on this page.</span>
                <span className="badge badge-slate" style={{ marginLeft: "auto" }}>{CONN_STATE_META.disconnected.label}</span>
              </div>
              <form className="conn-form" id="webForm" onSubmit={webConnect} style={{ marginTop: "0.7rem" }}>
                <div className="field">
                  <label htmlFor="webUrl">Website host</label>
                  <input
                    id="webUrl"
                    type="text"
                    placeholder="e.g. api.acme.com"
                    autoComplete="off"
                    spellCheck="false"
                    value={webUrl}
                    onChange={(e) => { setWebUrl(e.target.value); if (webError) setWebError(null); }}
                  />
                  <span className="field-hint">Simulated evaluation — no real site is contacted or scanned.</span>
                </div>
                <div className="conn-actions" style={{ flexWrap: "wrap" }}>
                  <button type="submit" className="btn btn-primary btn-sm" id="webConnect">
                    Connect &amp; evaluate
                    <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" id="webDemo" onClick={webRunDemo}>
                    No site handy? Load the bundled sample
                  </button>
                </div>
              </form>

              {webError && (
                <div className="conn-error" id="webError" role="alert">
                  <b>Could not evaluate that host</b>
                  <span dangerouslySetInnerHTML={{ __html: webError }} />
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWebError(null)}>Dismiss</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={webRunDemo}>Load the bundled sample instead</button>
                  </span>
                </div>
              )}
            </div>
          )}

          <ScopesBlock source="website" id="websiteScopes" />
          <SyncBlock source="website" record={web} id="websiteSync" lastId="websiteLastSync" />
        </article>

        {/* ---------- Backup system (simulated connector) ---------- */}
        <article className="conn-card" data-conn id="bkCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.backup || ""}</span>
            <div>
              <span className="conn-name">Backup system</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Backups</span>
            </div>
          </div>
          <p className="conn-desc">Retention health, restore coverage, and whether your backups would actually restore.</p>

          {bkPhase !== "idle" ? (
            /* ---------- importing / progress ---------- */
            <div className="scan-progress" id="bkProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{bkProgress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { bkCancelRef.current = true; setBkPhase("idle"); setBkProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                No backup tool is contacted — the register is read entirely in this browser.
              </p>
            </div>
          ) : backup ? (
            /* ---------- connected / success ---------- */
            <div className="conn-connected" id="bkConnected" data-state={backup.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META[bkConnState].dot }}></span>
                <span>{backup.mode === "demo" ? "Bundled sample register · nothing was uploaded" : `Imported from "${backup.name}"`}</span>
                <StateBadges meta={CONN_STATE_META[bkConnState]} state={backup.state} />
              </div>

              {backup.state === "healthy" && (
                <div className="conn-healthy" id="bkHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>Every system is protected.</b>
                    <span>All {backup.records} systems have a restorable point inside their expected window.</span>
                  </div>
                </div>
              )}

              <div className="conn-metrics">
                <span><b>{backup.records}</b>systems</span>
                <span><b>{openOnBk}</b>active findings</span>
                <span><b>{backupProtected}</b>fully protected</span>
              </div>

              <p className="conn-note" style={{ marginTop: "0.6rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {dataLabel("backup", backup)}
                </span>
                {backup.mode === "demo"
                  ? "Bundled sample — Kernveil generated this register from a built-in dataset (no backup tool)."
                  : "File parsed in this browser — no backup tool is connected or billed."}
                {backup.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: w.includes("protected") ? "var(--teal)" : "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
              </p>

              {bkError && (
                <div className="conn-error" id="bkError" role="alert">
                  <b>Scan failed</b>
                  <span>{bkError}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBkError(null)}>Dismiss</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" to="/demo-backups">
                  View backup health
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" id="bkRescan" onClick={bkRescan} disabled={bkPhase !== "idle"}>Rescan</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="bkRemove" onClick={() => removeBackupScan(backup.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / not connected ---------- */
            <div id="bkEmpty">
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META.disconnected.dot }}></span>
                <span>Not connected — no backup register loaded.</span>
                <span className="badge badge-slate" style={{ marginLeft: "auto" }}>{CONN_STATE_META.disconnected.label}</span>
              </div>
              <div className="conn-actions" style={{ marginTop: "0.9rem", justifyContent: "flex-start" }}>
                <Link className="btn btn-secondary btn-sm" to="/demo-backups">
                  Set up backup checks
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" id="bkDemo" onClick={bkRunDemo}>
                  No register handy? Load the bundled sample
                </button>
              </div>

              {bkError && (
                <div className="conn-error" id="bkError" role="alert">
                  <b>Could not load a register</b>
                  <span>{bkError}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBkError(null)}>Dismiss</button>
                  </span>
                </div>
              )}
            </div>
          )}

          <ScopesBlock source="backup" id="backupScopes" />
          <SyncBlock source="backup" record={backup} id="backupSync" lastId="backupLastSync" />
        </article>

        {/* ---------- Identity provider (simulated connector) ---------- */}
        <article className="conn-card" data-conn id="idpCard">
          <div className="conn-head">
            <span className="conn-icon" aria-hidden="true">{CONN_ICONS.identity || ""}</span>
            <div>
              <span className="conn-name">Identity provider</span>
              <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>Identity</span>
            </div>
          </div>
          <p className="conn-desc">Role scope, MFA enrolment, and admin history across the exported directory you provide.</p>

          {idpPhase !== "idle" ? (
            /* ---------- importing / progress ---------- */
            <div className="scan-progress" id="idpProgress" role="status" aria-live="polite">
              <span className="scan-spinner" aria-hidden="true"></span>
              <span className="scan-label">{idpProgress}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { idpCancelRef.current = true; setIdpPhase("idle"); setIdpProgress(""); }}>
                Cancel
              </button>
              <p className="conn-scan-note">
                No identity provider is contacted — the directory is read entirely in this browser.
              </p>
            </div>
          ) : identity ? (
            /* ---------- connected / success ---------- */
            <div className="conn-connected" id="idpConnected" data-state={identity.state}>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META[idpConnState].dot }}></span>
                <span>{identity.mode === "demo" ? "Bundled sample directory · nothing was uploaded" : `Imported from "${identity.name}"`}</span>
                <StateBadges meta={CONN_STATE_META[idpConnState]} state={identity.state} />
              </div>

              <div className="conn-safe" id="idpSafe" role="note">
                <span className="conn-safe-ic" aria-hidden="true">✓</span>
                <span>
                  Read-only directory review — Kernveil only reads the export you provide and never changes an account,
                  MFA setup, or privilege.
                </span>
              </div>

              {identity.state === "healthy" && (
                <div className="conn-healthy" id="idpHealthy">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <b>Every identity meets the standards.</b>
                    <span>All {identity.records} identities have appropriate access and MFA where it matters.</span>
                  </div>
                </div>
              )}

              <div className="conn-metrics">
                <span><b>{identity.records}</b>identities</span>
                <span><b>{openOnIdp}</b>active findings</span>
                <span><b>{identityCompliant}</b>meet standards</span>
              </div>

              <p className="conn-note" style={{ marginTop: "0.6rem" }}>
                <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginRight: "0.5rem" }}>
                  {dataLabel("identity", identity)}
                </span>
                {identity.mode === "demo"
                  ? "Bundled sample — Kernveil generated this directory from a built-in dataset (no identity provider)."
                  : "File parsed in this browser — no identity provider is connected or billed."}
                {identity.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block", color: w.includes("clean") ? "var(--teal)" : "var(--amber)", marginTop: "0.35rem" }}>{w}</span>
                ))}
              </p>

              {idpError && (
                <div className="conn-error" id="idpError" role="alert">
                  <b>Scan failed</b>
                  <span>{idpError}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIdpError(null)}>Dismiss</button>
                  </span>
                </div>
              )}

              <div className="conn-actions" style={{ marginTop: "0.9rem" }}>
                <Link className="btn btn-secondary btn-sm" to="/demo-identity">
                  View identity checks
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost btn-sm" id="idpRescan" onClick={idpRescan} disabled={idpPhase !== "idle"}>Re-analyse</button>
                  <button type="button" className="btn btn-ghost btn-sm conn-disconnect" id="idpRemove" onClick={() => removeIdentityScan(identity.id)}>Remove</button>
                </span>
              </div>
            </div>
          ) : (
            /* ---------- empty / not connected ---------- */
            <div id="idpEmpty">
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: CONN_STATE_META.disconnected.dot }}></span>
                <span>Not connected — no identity directory loaded.</span>
                <span className="badge badge-slate" style={{ marginLeft: "auto" }}>{CONN_STATE_META.disconnected.label}</span>
              </div>
              <div className="conn-actions" style={{ marginTop: "0.9rem", justifyContent: "flex-start" }}>
                <Link className="btn btn-secondary btn-sm" to="/demo-identity">
                  Set up identity checks
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" id="idpDemo" onClick={idpRunDemo}>
                  No directory handy? Load the bundled sample
                </button>
              </div>

              {idpError && (
                <div className="conn-error" id="idpError" role="alert">
                  <b>Could not load a directory</b>
                  <span>{idpError}</span>
                  <span className="conn-error-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIdpError(null)}>Dismiss</button>
                  </span>
                </div>
              )}
            </div>
          )}

          <ScopesBlock source="identity" id="identityScopes" />
          <SyncBlock source="identity" record={identity} id="identitySync" lastId="identityLastSync" />
        </article>

        {/* ---------- Planned / coming soon ---------- */}
        {CONNECTORS.filter((c) => c.state !== "available").map((c) => {
          const meta = CONN_STATE_META[c.state];
          return (
            <article className="conn-card is-planned" key={c.id} data-conn>
              <div className="conn-head">
                <span className="conn-icon" aria-hidden="true">{CONN_ICONS[c.id] || ""}</span>
                <div>
                  <span className="conn-name">{c.name}</span>
                  <span className="badge badge-ghost" style={{ fontSize: "0.66rem", marginTop: "0.25rem" }}>{c.type}</span>
                </div>
              </div>
              <p className="conn-desc">{c.desc}</p>
              <div className="conn-status-line">
                <span className="status-dot" style={{ background: "var(--text-disabled)" }}></span>
                <span style={{ color: "var(--text-disabled)" }}>
                  {c.state === "planned" ? "Designed for — not available in this demo" : "On the roadmap"}
                </span>
                <span className={`badge ${meta.cls}`} style={{ marginLeft: "auto" }}>{meta.label}</span>
              </div>
              <div className="conn-actions" style={{ marginTop: "1rem" }}>
                <button className="btn btn-ghost btn-sm" type="button" disabled>
                  {c.state === "planned" ? "Planned" : "Coming soon"}
                </button>
              </div>
              <ScopesBlock source={c.id} id={`${c.id}Scopes`} label="What it would access" />
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
          ? `GitHub connector is real — ${gh.name} was ${gh.mode === "demo" ? "simulated (no repository was actually scanned)" : "scanned over the GitHub raw API"}. All other connector data on this page is fictional sample data — no cloud account, website, backup tool, or identity provider is actually connected.`
          : "Only the GitHub connector is functional in this preview. All other connector data is simulated; nothing else is actually connected."}
      </p>
    </div>
  );
}