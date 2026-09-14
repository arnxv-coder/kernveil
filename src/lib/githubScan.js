/* ============================================================
   Kernveil — GitHub dependency-risk scan (client-side).
   Fetches a repository's manifest/lockfile from GitHub's raw
   endpoints (public repos need no credentials), then checks each
   dependency against:
     - registry.npmjs.org   for the latest published version
     - api.osv.dev          for published vulnerabilities
   Everything runs in the browser. Tokens (optional, private-only)
   are never persisted in this module.

   A "demo" mode exists so the connector stays believable when a
   real network/credentials path is unavailable — it is always
   clearly labelled as a simulation.
   ============================================================ */

const OSV_ENDPOINT = "https://api.osv.dev/v1/query";
const REGISTRY_ENDPOINT = "https://registry.npmjs.org/";
const RAW_ENDPOINT = "https://raw.githubusercontent.com/";

const OSV_CACHE_KEY = "kernveil.osvCache.v1";
const REGISTRY_CACHE_KEY = "kernveil.registryCache.v1";
const OSV_TTL = 1000 * 60 * 60 * 24; // 24h
const REGISTRY_TTL = 1000 * 60 * 60 * 6; // 6h
const MAX_DEPS = 60;
const MAX_OUTDATED_FINDINGS = 6;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- tiny semver helpers ---------- */

export function parseVer(v = "") {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null };
}

export function verCompare(a, b) {
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa) return -1;
  if (!pb) return 1;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (!!pa.pre !== !!pb.pre) return pa.pre ? -1 : 1;
  return 0;
}

/* Resolve a loose semver range to a best-effort "installed" version. */
function versionFromRange(range) {
  const v = String(range || "").trim().replace(/^(\^|~|>=?|<=?|=|>)/, "").split(/\s+/)[0];
  const p = parseVer(v);
  return p ? v : null;
}

function maxFixed(events) {
  let best = null;
  for (const ev of events || []) {
    if (ev && ev.fixed && (!best || verCompare(ev.fixed, best) > 0)) best = ev.fixed;
  }
  return best;
}

/* ---------- small fetch helpers ---------- */

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (res.status === 404) {
    const err = new Error(`Not found: ${url}`);
    err.code = "NOT_FOUND";
    throw err;
  }
  if (res.status === 429 || res.status === 403) {
    const err = new Error("Rate limited by the upstream service. Wait a minute and retry.");
    err.code = "RATE_LIMIT";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Upstream error ${res.status}`);
    err.code = "NETWORK";
    throw err;
  }
  return res.text();
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(`Advisory service error ${res.status}`);
    err.code = "NETWORK";
    throw err;
  }
  return res.json();
}

/* ---------- persistence-backed caches ---------- */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy mode */
  }
}

async function latestVersion(name) {
  const cache = loadJSON(REGISTRY_CACHE_KEY, {});
  const hit = cache[name];
  if (hit && Date.now() - hit.at < REGISTRY_TTL) return hit.version;
  const url = REGISTRY_ENDPOINT + name.replace(/\//g, "%2F") + "/latest";
  const body = JSON.parse(await fetchText(url));
  const version = body && typeof body.version === "string" ? body.version : null;
  cache[name] = { version, at: Date.now() };
  saveJSON(REGISTRY_CACHE_KEY, cache);
  return version;
}

async function osvVulns(pkg, version) {
  const cacheKey = `npm:${pkg}@${version}`;
  const cache = loadJSON(OSV_CACHE_KEY, {});
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.at < OSV_TTL) return hit.vulns;
  const res = await postJson(OSV_ENDPOINT, { package: { name: pkg, ecosystem: "npm" }, version });
  const raw = res.vulns || [];
  const vulns = raw.map((v) => {
    const affected = v.affected || [];
    let severity = "medium";
    let safe = null;
    const ids = [v.id, ...(v.aliases || [])].filter(Boolean);
    for (const a of affected) {
      const db = a.database_specific || {};
      const rawSev = db.severity || (db.cvss && db.cvss.severity);
      if (typeof rawSev === "string") {
        const s = rawSev.toLowerCase();
        if (s === "critical" || s === "high" || s === "moderate" || s === "medium" || s === "low") {
          const mapped = s === "moderate" ? "medium" : s;
          if (severity !== "critical") severity = mapped;
        }
      }
      const cvss = (a.severity && a.severity[0] && a.severity[0].score) || (db.cvss && db.cvss.score);
      const score = cvss && typeof cvss === "number" ? cvss : cvss && Array.isArray(cvss) ? cvss[0] : cvss;
      if (typeof score === "number") {
        const fromScore = score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low";
        if (severity !== "critical" && fromScore !== "critical") severity = fromScore === "high" ? "high" : fromScore;
      }
      const fixed = maxFixed(a.ranges && a.ranges[0] && a.ranges[0].events);
      if (fixed && (!safe || verCompare(fixed, safe) > 0)) safe = fixed;
    }
    const link = (v.references || []).find((r) => r && r.url) || {};
    return {
      id: ids[0] || "GHSA-UNKNOWN",
      refs: ids.slice(1).slice(0, 2),
      summary: v.summary || v.details || "Published advisory for this package version.",
      severity,
      safe,
      url: link.url || null,
    };
  });
  cache[cacheKey] = { vulns, at: Date.now() };
  saveJSON(OSV_CACHE_KEY, cache);
  return vulns;
}

/* ---------- dependency extraction ---------- */

function parsePackageLock(text) {
  try {
    const doc = JSON.parse(text);
    const deps = new Map();
    const add = (name, version, approx) => {
      if (!name || !version) return;
      deps.set(name, { name, version, approx: !!approx });
    };
    const tree = doc.dependencies || {};
    for (const [name, info] of Object.entries(tree)) {
      add(name, info && info.version);
    }
    if (deps.size) return [...deps.values()];
    const pkgs = doc.packages || {};
    for (const [path, info] of Object.entries(pkgs)) {
      const m = path.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)$/);
      if (m) add(m[1], info.version);
    }
    const root = pkgs[""] || {};
    for (const [name, range] of Object.entries({ ...(root.dependencies || {}), ...(root.devDependencies || {}) })) {
      if (!deps.has(name)) add(name, versionFromRange(range), true);
    }
    return [...deps.values()];
  } catch {
    return null;
  }
}

function parsePackageJson(text) {
  try {
    const doc = JSON.parse(text);
    const deps = [];
    for (const [name, range] of Object.entries({ ...(doc.dependencies || {}), ...(doc.devDependencies || {}) })) {
      const version = versionFromRange(range);
      if (name && version) deps.push({ name, version, approx: true });
    }
    return deps;
  } catch {
    return null;
  }
}

function parseYarnLock(text) {
  const deps = [];
  const re = /^"?([^\s@][^\s@]*?(?:\/[^\s@]+)?)@[^:@\s]+:\n\s*version "?([0-9][^"\s]*)"?/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    let name = m[1];
    if (name.includes("@")) name = name.split("@")[0];
    const version = m[2];
    if (!deps.some((d) => d.name === name)) deps.push({ name, version, approx: true });
  }
  return deps;
}

function parsePnpmLock(text) {
  const deps = [];
  const re = /^ {4}\/((?:@[^/]+\/)?[^/]+)@([0-9][^:()]*):/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!deps.some((d) => d.name === m[1])) deps.push({ name: m[1], version: m[2].trim(), approx: true });
  }
  return deps;
}

const MANIFEST_PATHS = [
  { path: "package-lock.json", parse: parsePackageLock },
  { path: "yarn.lock", parse: parseYarnLock },
  { path: "pnpm-lock.yaml", parse: parsePnpmLock },
  { path: "package.json", parse: parsePackageJson },
];

export async function fetchManifest(owner, repo, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const base = RAW_ENDPOINT + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/HEAD/";
  let lastErr = null;
  for (const entry of MANIFEST_PATHS) {
    try {
      const text = await fetchText(base + entry.path, headers);
      const deps = entry.parse(text);
      if (deps && deps.length) return { path: entry.path, deps };
    } catch (err) {
      lastErr = err;
      if (err.code !== "NOT_FOUND") throw err;
    }
  }
  if (lastErr && lastErr.code === "NOT_FOUND") {
    const err = new Error("Repositories must be public (or use a token) and have a JavaScript/Node dependency manifest.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (lastErr) throw lastErr;
  const err = new Error("No dependency manifest or lockfile found at the repository root.");
  err.code = "NO_MANIFEST";
  throw err;
}

/* ---------- finding + asset shaping ---------- */

export function scanAssetId(owner, repo) {
  return `repo:${owner}:${repo}`;
}

export function scanFindingId(assetId, name, version, kind) {
  return `gh:${assetId}:${kind}:${name}:${version}`;
}

function fmtLongDate(ts) {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function plainRepoName(name) {
  if (name.startsWith("@")) {
    const [scope, pkg] = name.slice(1).split("/");
    return `${scope}/${pkg}`;
  }
  return name;
}

function buildFinding({ assetId, repo, repoUrl, name, version, kind, vulns, latest, mode, manifestPath }) {
  const safe = vulns && vulns.length ? vulns.map((v) => v.safe).filter(Boolean).sort(verCompare).pop() : null;
  const worst = vulns && vulns.length ? vulns.reduce((a, b) => (SEV_ORDER[b.severity] < SEV_ORDER[a.severity] ? b : a)) : null;
  const now = Date.now();
  const isVuln = kind === "vulnerable";
  const severity = isVuln ? worst.severity : "low";
  const advisoryIds = vulns
    ? vulns.slice(0, 3).map((v) => v.id).join(", ") + (vulns.length > 3 ? ` +${vulns.length - 3} more` : "")
    : "";

  const title = isVuln
    ? `Vulnerable dependency — ${plainRepoName(name)}`
    : `Outdated dependency — ${plainRepoName(name)}`;

  const summary = isVuln
    ? `${name}@${version} is affected by ${vulns.length} published advis${vulns.length === 1 ? "y" : "ies"} (${advisoryIds}).`
    : `${name} is behind the latest release: ${version} → ${latest || "unknown"}.`;

  const detected = isVuln
    ? `The repository's <code>${manifestPath}</code> resolves <code>${name}@${version}</code>, which is listed as affected by ${
        vulns.length
      } public advisories. A fixed release ${
        safe ? `is available (<code>${safe}</code>)` : "has not been published yet"
      }.`
    : `The repository's <code>${manifestPath}</code> pins <code>${version}</code>, but the latest published release is <code>${
        latest || "unknown"
      }</code>. ${latest && verCompare(latest, version) > 0 ? `This is ${stage(latest, version)} releases behind.` : ""}`;

  const why = isVuln
    ? vulns
        .slice(0, 2)
        .map((v) => `${v.summary}${v.url ? ` (${v.url})` : ""}`)
        .join(" ")
    : "Outdated dependencies drift from security patches, but being behind the latest release is not itself an active vulnerability. Low urgency — plan the upgrade when convenient.";

  const steps = isVuln
    ? [
        safe
          ? `Upgrade <code>${name}</code> to <b>${safe}</b> (or the newest available release) in the manifest and regenerate the lockfile.`
          : `Watch the package for a patched release, and apply it as soon as it is published.`,
        "Run the test suite and ship the change through your normal flow.",
        "Rescan — this finding clears automatically once the manifest no longer resolves the affected version.",
        `Open the advisory for details: <code>${worst.url || "see evidence"}</code>`,
      ]
    : [
        `Upgrade <code>${name}</code> from <code>${version}</code> to <b>${latest || "the latest release"}</b>.`,
        "Regenerate the lockfile, run the tests, and deploy as usual.",
        "Rescan to confirm it is current.",
      ];

  const evidence = isVuln
    ? [
        { key: "Repository", value: repo },
        { key: "Dependency", value: `${name}@${version}` },
        { key: "Safe version", value: safe || "Not yet released" },
        { key: "Advisories", value: advisoryIds },
        { key: "Manifest", value: manifestPath },
      ]
    : [
        { key: "Repository", value: repo },
        { key: "Dependency", value: `${name}@${version}` },
        { key: "Installed", value: version },
        { key: "Latest", value: latest || "Unknown" },
        { key: "Manifest", value: manifestPath },
      ];

  return {
    id: scanFindingId(assetId, name, version, kind),
    title,
    severity,
    category: "Dependencies",
    asset: assetId,
    status: "open",
    first: fmtLongDate(now),
    last: "just now",
    summary,
    detected,
    why,
    impact: isVuln ? "Supply-chain risk" : "Maintenance debt",
    evidence,
    steps,
    related: [assetId],
    history: [
      { time: `${MONTHS[new Date().getMonth()]} ${String(new Date().getDate()).padStart(2, "0")} · ${isVuln ? "detected via advisory match" : "detected via version comparison"}`, text: isVuln ? `First detected — ${vulns[0].id}` : "Outdated version detected", c: isVuln ? "var(--red)" : "var(--slate)" },
    ],
    source: "github-connector",
    demo: mode === "demo",
    repoUrl,
    manifest: manifestPath,
  };
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function stage(latest, installed) {
  const l = parseVer(latest);
  const i = parseVer(installed);
  if (!l || !i) return "several";
  const majors = l.major - i.major;
  if (majors >= 2) return `${majors} major versions`;
  if (majors === 1) return "one major version";
  if (l.minor - i.minor >= 1) return `${l.minor - i.minor} minor version${l.minor - i.minor > 1 ? "s" : ""}`;
  return "a patch";
}

/* ---------- scan orchestration ---------- */

/**
 * Scan a live (public, or token-authed) GitHub repository.
 * Returns a payload ready to be persisted as a connector.
 */
export async function scanRepository({ owner, repo, token = "", onProgress }) {
  const report = (label, phase) => onProgress && onProgress({ label });

  report("Reading dependency manifest", 0.05);

  const { path: manifestPath, deps: parsed } = await fetchManifest(owner, repo, token);

  const unique = new Map();
  for (const d of parsed) {
    const key = `${d.name}@${d.version}`;
    if (!unique.has(key)) unique.set(key, d);
  }
  let deps = [...unique.values()].slice(0, MAX_DEPS);

  const reportProgress = (done) => {
    report(`Checking ${done + 1} of ${deps.length} packages…`, 0.1 + (done / deps.length) * 0.85);
  };

  const enriched = [];
  let skipped = 0;
  for (let i = 0; i < deps.length; i += 1) {
    const d = deps[i];
    reportProgress(i);
    let latest = null;
    let vulns = [];
    try {
      latest = await latestVersion(d.name);
    } catch {
      skipped += 1;
    }
    try {
      vulns = await osvVulns(d.name, d.version);
    } catch {
      skipped += 1;
    }
    enriched.push({ ...d, latest, vulns, outdated: latest && verCompare(latest, d.version) > 0 });
  }

  if (skipped >= deps.length && deps.length > 0) {
    const err = new Error("Could not reach the package registry or the vulnerability database. Check your connection and try again.");
    err.code = "NETWORK";
    throw err;
  }

  report("Assembling findings", 0.97);

  const assetId = scanAssetId(owner, repo);
  const now = Date.now();
  const asset = {
    id: assetId,
    name: `${owner}/${repo}`,
    type: "repository",
    env: "Production",
    source: "GitHub",
    risk: "healthy",
    last: "just now",
    host: `github.com/${owner}/${repo}`,
  };

  const findings = [];
  for (const d of enriched) {
    if (d.vulns.length) {
      d.vulns.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
      findings.push(
        buildFinding({
          assetId,
          repo: `${owner}/${repo}`,
          repoUrl: `https://github.com/${owner}/${repo}`,
          name: d.name,
          version: d.version,
          kind: "vulnerable",
          vulns: d.vulns,
          latest: d.latest,
          mode: "live",
          manifestPath,
        })
      );
    } else if (d.outdated && findings.filter((f) => f.title.includes("Outdated")).length < MAX_OUTDATED_FINDINGS) {
      findings.push(
        buildFinding({
          assetId,
          repo: `${owner}/${repo}`,
          repoUrl: `https://github.com/${owner}/${repo}`,
          name: d.name,
          version: d.version,
          kind: "outdated",
          vulns: [],
          latest: d.latest,
          mode: "live",
          manifestPath,
        })
      );
    }
  }

  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const worst = findings.length ? findings[0].severity : null;
  asset.risk = worst || "healthy";

  report("Done", 1);

  return {
    mode: "live",
    repo: `${owner}/${repo}`,
    repoUrl: `https://github.com/${owner}/${repo}`,
    manifestPath,
    scanAt: now,
    depCount: enriched.length,
    vulnerableCount: findings.filter((f) => f.title.startsWith("Vulnerable")).length,
    outdatedCount: findings.filter((f) => f.title.startsWith("Outdated")).length,
    skipped,
    healthy: findings.length === 0,
    asset,
    findings,
  };
}

/* ---------- deterministic demo scan (no network) ---------- */

const DEMO_PROJECTS = [
  { name: "@angular/core", version: "15.2.0", latest: "19.2.3", vuln: true, sev: "medium", safe: "16.2.12", adv: "GHSA-9vpm-xm53-p742", summary: "Template parsing in @angular/core could be tricked into expense beyond expectations in some configurations." },
  { name: "express", version: "4.17.1", latest: "4.21.2", vuln: true, sev: "high", safe: "4.19.2", adv: "CVE-2024-29041", summary: "Express is vulnerable to a high-severity denial-of-service and open-redirect issue when handling certain unicode paths." },
  { name: "lodash", version: "4.17.19", latest: "4.17.21", vuln: true, sev: "high", safe: "4.17.21", adv: "CVE-2021-23337", summary: "Command injection in the template function of lodash allows an attacker to execute arbitrary code via a crafted template string." },
  { name: "axios", version: "0.21.4", latest: "1.10.0", vuln: true, sev: "medium", safe: "0.28.0", adv: "CVE-2023-45857", summary: "Axios allows internal services to be accessed through a specially crafted URL when a proxy is configured." },
  { name: "socket.io-parser", version: "4.0.5", latest: "4.2.4", vuln: true, sev: "high", safe: "4.2.3", adv: "CVE-2023-32695", summary: "Insufficient validation of the packet-data in socket.io-parser can cause an out-of-memory condition on the server." },
  { name: "react", version: "17.0.2", latest: "19.1.0", vuln: false },
  { name: "next", version: "12.3.4", latest: "15.5.4", vuln: false },
  { name: "webpack", version: "5.76.0", latest: "5.99.6", vuln: false },
];

const DEMO_REPO = "acme/storefront-web";

export function buildDemoScan() {
  const assetId = scanAssetId("acme", "storefront-web");
  const now = Date.now();
  const manifestPath = "package-lock.json";
  const findings = DEMO_PROJECTS.filter((p) => p.vuln).map((p) =>
    buildFinding({
      assetId,
      repo: DEMO_REPO,
      repoUrl: `https://github.com/${DEMO_REPO}`,
      name: p.name,
      version: p.version,
      kind: "vulnerable",
      vulns: [{ id: p.adv, summary: p.summary, severity: p.sev, safe: p.safe, url: `https://github.com/advisories/${p.adv}` }],
      latest: p.latest,
      mode: "demo",
      manifestPath,
    })
  );
  DEMO_PROJECTS.filter((p) => !p.vuln).forEach((p) => {
    if (findings.filter((f) => f.title.includes("Outdated")).length >= MAX_OUTDATED_FINDINGS) return;
    findings.push(
      buildFinding({
        assetId,
        repo: DEMO_REPO,
        repoUrl: `https://github.com/${DEMO_REPO}`,
        name: p.name,
        version: p.version,
        kind: "outdated",
        vulns: [],
        latest: p.latest,
        mode: "demo",
        manifestPath,
      })
    );
  });

  const asset = {
    id: assetId,
    name: DEMO_REPO,
    type: "repository",
    env: "Production",
    source: "GitHub",
    risk: "high",
    last: "just now",
    host: `github.com/${DEMO_REPO}`,
  };

  return {
    mode: "demo",
    repo: DEMO_REPO,
    repoUrl: `https://github.com/${DEMO_REPO}`,
    manifestPath,
    scanAt: now,
    depCount: DEMO_PROJECTS.length,
    vulnerableCount: findings.filter((f) => f.title.startsWith("Vulnerable")).length,
    outdatedCount: findings.filter((f) => f.title.startsWith("Outdated")).length,
    skipped: 0,
    healthy: false,
    asset,
    findings,
  };
}