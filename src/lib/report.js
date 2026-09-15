/* ============================================================
   Kernveil — customer-facing security report engine (Phase 9).
   Generates a clear, business-friendly report from the existing
   unified findings, connector, scan, remediation, and activity
   data already in the workspace.

   HONESTY BOUNDARY: every data-source label, stale marker, and
   missing-source note is explicit. The report never claims a
   check was run when it was not, never inflates severity, and
   never fabricates findings or remediation results.
   ============================================================ */
import { normalizeStatus } from "./remediation.js";

/* ---------- source map for the report ---------- */

const SOURCE_META = {
  "github-connector": { label: "GitHub", sectionTitle: "GitHub dependency findings", icon: "code", order: 1 },
  "cloud-fixture": { label: "Cloud", sectionTitle: "Cloud exposure findings", icon: "cloud", order: 2 },
  "website-fixture": { label: "Website", sectionTitle: "Website and domain checks", icon: "web", order: 3 },
  "backup-fixture": { label: "Backup", sectionTitle: "Backup verification", icon: "backup", order: 4 },
  "identity-fixture": { label: "Identity", sectionTitle: "Identity analysis", icon: "identity", order: 5 },
  "activity-fixture": { label: "Activity", sectionTitle: "Suspicious activity", icon: "activity", order: 6 },
  sample: { label: "Sample", sectionTitle: "Sample findings", icon: "sample", order: 7 },
};

function sourceMeta(f) {
  return SOURCE_META[f._src] || SOURCE_META.sample;
}

/* Map an ASSETS.source label to a report source key. The seeded
   findings carry no explicit source, so we infer it from the asset
   they attach to when the workspace assets list is available. */
const SOURCE_FROM_ASSET = {
  Code: "github-connector",
  Cloud: "cloud-fixture",
  Website: "website-fixture",
  Backups: "backup-fixture",
  Identity: "identity-fixture",
  Activity: "activity-fixture",
};

/* ---------- date parsing ---------- */

function parseDate(s) {
  if (!s) return 0;
  const m = String(s).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\D+(\d{1,2})\D+(\d{4})/i);
  if (!m) return 0;
  const d = new Date(Number(m[3]), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m[1]), Number(m[2]));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ---------- risk tone helpers ---------- */

function riskTone(critical, high) {
  if (critical > 0) return "critical";
  if (high > 3) return "high";
  if (high > 0) return "elevated";
  return "good";
}

function riskLabel(tone) {
  const labels = { critical: "Critical risk", high: "High risk", elevated: "Elevated risk", good: "Good posture" };
  return labels[tone] || "Unknown";
}

function riskSummary(tone) {
  const map = {
    critical:
      "Your business has critical vulnerabilities that should be addressed immediately. These expose sensitive data or systems to known attack patterns.",
    high:
      "Your business has high-severity issues that require prompt attention. While not immediately exploitable in every case, they represent meaningful risk.",
    elevated:
      "Your overall posture is reasonable, but there are specific areas that should be tightened to reduce exposure.",
    good:
      "Your security posture is strong. Remaining items are low-risk housekeeping or improvements that do not represent immediate business exposure.",
  };
  return map[tone] || "";
}

function plainEnglish(f) {
  const sev = f.severity;
  const parts = [];
  if (sev === "critical") parts.push("This is urgent.");
  else if (sev === "high") parts.push("This needs prompt attention.");
  else if (sev === "medium") parts.push("This should be addressed in your next maintenance window.");
  else parts.push("This is low-priority housekeeping.");

  if (f.impact) {
    const impact = String(f.impact).toLowerCase();
    if (/sensitive|customer|credential|secret|data/.test(impact)) parts.push("Customer data may be at risk.");
    else if (/availability|outage|service|downtime/.test(impact)) parts.push("Service availability could be affected.");
    else if (/supply.chain|dependency|package/.test(impact)) parts.push("Supply-chain risk is elevated.");
  }
  if (f.category === "Exposure" || f.category === "Configuration") parts.push("This is a configuration issue that your team can fix.");
  if (f.category === "Dependencies") parts.push("This relates to a software dependency that should be updated.");
  return parts.join(" ");
}

function firstStep(f) {
  if (f && Array.isArray(f.steps) && f.steps.length) {
    const txt = String(f.steps[0]).replace(/<[^>]*>/g, "").trim();
    return txt.length > 160 ? txt.slice(0, 157) + "…" : txt;
  }
  return "Complete the recommended remediation.";
}

/* ---------- connector/scan health ---------- */

function connectorHealth(connectors, cloudScans, webScans, backupScans, identityScans, activityScans) {
  const sources = [];

  const gh = connectors.find((c) => c.kind === "github");
  if (gh) {
    sources.push({
      label: "GitHub",
      status: gh.connected ? "connected" : "not connected",
      lastScan: gh.lastSync || null,
      stale: gh.connected && (!gh.lastSync || Date.now() - gh.lastSync > 24 * 3600e3),
    });
  } else {
    sources.push({ label: "GitHub", status: "not connected", lastScan: null, stale: false });
  }

  const cloud = cloudScans[0];
  if (cloud) {
    sources.push({
      label: "Cloud",
      status: "imported",
      lastScan: cloud.lastScanAt || null,
      stale: !cloud.lastScanAt || Date.now() - cloud.lastScanAt > 24 * 3600e3,
    });
  } else {
    sources.push({ label: "Cloud", status: "unavailable", lastScan: null, stale: false });
  }

  const web = webScans[0];
  if (web) {
    sources.push({
      label: "Website",
      status: "imported",
      lastScan: web.lastScanAt || null,
      stale: !web.lastScanAt || Date.now() - web.lastScanAt > 24 * 3600e3,
    });
  } else {
    sources.push({ label: "Website", status: "unavailable", lastScan: null, stale: false });
  }

  const backup = backupScans[0];
  if (backup) {
    sources.push({
      label: "Backup",
      status: "imported",
      lastScan: backup.lastScanAt || null,
      stale: !backup.lastScanAt || Date.now() - backup.lastScanAt > 24 * 3600e3,
    });
  } else {
    sources.push({ label: "Backup", status: "unavailable", lastScan: null, stale: false });
  }

  const identity = identityScans[0];
  if (identity) {
    sources.push({
      label: "Identity",
      status: "imported",
      lastScan: identity.lastScanAt || null,
      stale: !identity.lastScanAt || Date.now() - identity.lastScanAt > 24 * 3600e3,
    });
  } else {
    sources.push({ label: "Identity", status: "unavailable", lastScan: null, stale: false });
  }

  const activity = activityScans[0];
  if (activity) {
    sources.push({
      label: "Activity",
      status: "imported",
      lastScan: activity.lastScanAt || null,
      stale: !activity.lastScanAt || Date.now() - activity.lastScanAt > 24 * 3600e3,
    });
  } else {
    sources.push({ label: "Activity", status: "unavailable", lastScan: null, stale: false });
  }

  return sources;
}

function staleSources(health) {
  return health.filter((h) => h.stale || h.status === "unavailable");
}

/* ---------- main report generator ---------- */

/**
 * Generate a report from the current workspace state.
 * @param {object} state - all workspace context values
 * @param {object} filters - { dateFrom, dateTo, severity, source, asset, status }
 * @returns {object} report
 */
export function generateReport(state, filters = {}) {
  const now = Date.now();
  const {
    findings: allFindings = [],
    assets = [],
    overview = {},
    connectors = [],
    cloudScans = [],
    webScans = [],
    backupScans = [],
    identityScans = [],
    activityScans = [],
    actionsList = [],
    actionCounts = {},
  } = state;

  /* --- data source health --- */
  const health = connectorHealth(connectors, cloudScans, webScans, backupScans, identityScans, activityScans);
  const stale = staleSources(health);
  const anyConnectorFailed = connectors.some((c) => c.lastError);
  const hasImports = cloudScans.length > 0 || webScans.length > 0 || backupScans.length > 0 || identityScans.length > 0 || activityScans.length > 0;
  const hasLiveConnector = connectors.some((c) => c.connected);
  const allSample = !hasImports && !hasLiveConnector;

  /* Infer a report source for findings that do not carry one. */
  const assetSources = new Map((assets || []).map((a) => [a.id, a.source]));
  const inferredSource = (f) => {
    if (f.source) return f.source;
    const s = assetSources.get(f.asset);
    return (s && SOURCE_FROM_ASSET[s]) || "sample";
  };

  /* --- apply filters --- */
  let findings = allFindings.map((f) => ({ ...f, _src: inferredSource(f) })).filter((f) => {
    if (filters.severity && filters.severity !== "all" && f.severity !== filters.severity) return false;
    if (filters.source && filters.source !== "all" && sourceMeta(f).label !== filters.source) return false;
    if (filters.asset && filters.asset !== "all" && f.asset !== filters.asset) return false;
    if (filters.status && filters.status !== "all") {
      const s = normalizeStatus(f.status);
      if (filters.status === "open" && s !== "open" && s !== "awaiting-approval" && s !== "in-progress" && s !== "failed") return false;
      if (filters.status === "resolved" && s !== "completed") return false;
      if (filters.status === "in-progress" && s !== "in-progress") return false;
    }
    if (filters.dateFrom) {
      const ts = parseDate(f.first);
      if (ts && ts < new Date(filters.dateFrom).getTime()) return false;
    }
    if (filters.dateTo) {
      const ts = parseDate(f.first);
      if (ts && ts > new Date(filters.dateTo).getTime() + 86400e3) return false;
    }
    return true;
  });

  /* --- counts --- */
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
  const totalOpen = findings.filter((f) => normalizeStatus(f.status) !== "completed").length;
  const totalResolved = findings.filter((f) => normalizeStatus(f.status) === "completed").length;
  const affectedAssets = new Set(findings.filter((f) => normalizeStatus(f.status) !== "completed").map((f) => f.asset)).size;

  const tone = riskTone(severityCounts.critical, severityCounts.high);

  /* Enrich findings with report-only fields (plain English, first
     step, link) once, so every view reuses the same values. */
  const enrich = (f) => {
    const src = sourceMeta(f);
    return {
      ...f,
      sourceLabel: src.label,
      sectionTitle: src.sectionTitle,
      plainEnglish: plainEnglish(f),
      firstStep: firstStep(f),
      link: `/demo-finding?id=${f.id}`,
    };
  };
  const enrichedFindings = findings.map(enrich);

  /* --- group by source --- */
  const bySource = {};
  for (const f of enrichedFindings) {
    const meta = sourceMeta(f);
    if (!bySource[meta.label]) bySource[meta.label] = { label: meta.label, sectionTitle: meta.sectionTitle, findings: [], order: meta.order };
    bySource[meta.label].findings.push(f);
  }
  const sourceGroups = Object.values(bySource).sort((a, b) => a.order - b.order);

  /* --- remediation overview --- */
  const actionSummary = {
    proposed: actionCounts.open || 0,
    awaitingApproval: actionCounts["awaiting-approval"] || 0,
    approved: actionCounts.approved || 0,
    rejected: actionCounts.rejected || 0,
    inProgress: actionCounts["in-progress"] || 0,
    failed: actionCounts.failed || 0,
    completed: actionCounts.completed || 0,
  };
  const totalActions = actionsList.length;
  const queuedActions = actionsList.filter((a) => normalizeStatus(a.status) === "approved");

  /* --- top priorities --- */
  const topPriorities = enrichedFindings
    .filter((f) => normalizeStatus(f.status) !== "completed")
    .sort((a, b) => {
      const sv = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sv[a.severity] ?? 4) - (sv[b.severity] ?? 4);
    })
    .slice(0, 5);

  /* --- comparison delta (previous report) --- */
  const previous = null; // stored externally if needed

  const report = {
    id: `rpt-${now}`,
    generatedAt: now,
    generatedDate: formatDate(now),
    generatedTime: formatTime(now),
    workspaceName: state.workspace?.name || "Acme Retail (sample)",
    tone,
    riskLabel: riskLabel(tone),
    riskSummary: riskSummary(tone),
    dataQuality: {
      sources: health,
      staleSources: stale,
      anyConnectorFailed,
      hasImports,
      hasLiveConnector,
      allSample,
      note: allSample
        ? "This report is based entirely on sample data. No live or imported data sources are connected."
        : stale.length > 0
          ? `Some data sources are unavailable or stale: ${stale.map((s) => s.label).join(", ")}. The findings from those sources may not reflect the current state.`
          : "All connected data sources are current.",
    },
    executiveSummary: {
      criticalFindings: severityCounts.critical,
      highFindings: severityCounts.high,
      totalOpen,
      totalResolved,
      affectedAssets,
      tone,
    },
    findings: enrichedFindings,
    sourceGroups,
    topPriorities,
    remediation: {
      summary: actionSummary,
      totalActions,
      queuedActions: queuedActions.map((a) => ({
        label: a.label,
        target: a.target,
        findingId: a.findingId,
        link: `/demo-finding?id=${a.findingId}`,
      })),
    },
    comparison: previous
      ? {
          hasData: true,
          previousRisk: previous.risk || 0,
          riskDelta: (overview.risk || 0) - (previous.risk || 0),
          previousOpen: previous.open || 0,
          openDelta: totalOpen - (previous.open || 0),
        }
      : { hasData: false },
    filters: { ...filters },
  };

  return report;
}

/* ---------- seeded report states ---------- */

export const SEEDED_REPORTS = [
  {
    id: "rpt-seed-1",
    generatedAt: Date.now() - 2 * 86400e3,
    generatedDate: formatDate(Date.now() - 2 * 86400e3),
    generatedTime: "09:14",
    workspaceName: "Acme Retail (sample)",
    tone: "good",
    riskLabel: "Good posture",
    riskSummary: "Your security posture is strong. Remaining items are low-risk housekeeping.",
    dataQuality: {
      sources: [
        { label: "GitHub", status: "connected", lastScan: Date.now() - 3600e3, stale: false },
        { label: "Cloud", status: "imported", lastScan: Date.now() - 2 * 3600e3, stale: false },
        { label: "Website", status: "imported", lastScan: Date.now() - 3600e3, stale: false },
        { label: "Backup", status: "imported", lastScan: Date.now() - 4 * 3600e3, stale: false },
        { label: "Identity", status: "imported", lastScan: Date.now() - 5 * 3600e3, stale: false },
        { label: "Activity", status: "unavailable", lastScan: null, stale: false },
      ],
      staleSources: [],
      anyConnectorFailed: false,
      hasImports: true,
      hasLiveConnector: true,
      allSample: false,
      note: "All connected data sources are current.",
    },
    executiveSummary: { criticalFindings: 0, highFindings: 1, totalOpen: 4, totalResolved: 28, affectedAssets: 3, tone: "good" },
    findings: [],
    sourceGroups: [],
    topPriorities: [],
    remediation: { summary: { proposed: 0, awaitingApproval: 0, approved: 2, rejected: 0, inProgress: 0, failed: 0, completed: 3 }, totalActions: 5, queuedActions: [] },
    comparison: { hasData: false },
    filters: {},
    seeded: true,
    seededLabel: "Healthy posture",
    seededDescription: "All critical and most high-severity findings resolved. Mostly low-priority housekeeping remains.",
  },
  {
    id: "rpt-seed-2",
    generatedAt: Date.now() - 86400e3,
    generatedDate: formatDate(Date.now() - 86400e3),
    generatedTime: "14:30",
    workspaceName: "Acme Retail (sample)",
    tone: "critical",
    riskLabel: "Critical risk",
    riskSummary: "Your business has critical vulnerabilities that should be addressed immediately.",
    dataQuality: {
      sources: [
        { label: "GitHub", status: "connected", lastScan: Date.now() - 1800e3, stale: false },
        { label: "Cloud", status: "imported", lastScan: Date.now() - 3600e3, stale: false },
        { label: "Website", status: "unavailable", lastScan: null, stale: false },
        { label: "Backup", status: "unavailable", lastScan: null, stale: false },
        { label: "Identity", status: "unavailable", lastScan: null, stale: false },
        { label: "Activity", status: "unavailable", lastScan: null, stale: false },
      ],
      staleSources: [
        { label: "Website", status: "unavailable" },
        { label: "Backup", status: "unavailable" },
        { label: "Identity", status: "unavailable" },
        { label: "Activity", status: "unavailable" },
      ],
      anyConnectorFailed: false,
      hasImports: true,
      hasLiveConnector: true,
      allSample: false,
      note: "Some data sources are unavailable: Website, Backup, Identity, Activity. Findings from those sources are not included.",
    },
    executiveSummary: { criticalFindings: 3, highFindings: 5, totalOpen: 12, totalResolved: 8, affectedAssets: 8, tone: "critical" },
    findings: [],
    sourceGroups: [],
    topPriorities: [],
    remediation: { summary: { proposed: 4, awaitingApproval: 2, approved: 0, rejected: 1, inProgress: 0, failed: 0, completed: 1 }, totalActions: 8, queuedActions: [] },
    comparison: { hasData: false },
    filters: {},
    seeded: true,
    seededLabel: "Critical-risk posture",
    seededDescription: "Multiple critical exposures with several connectors offline. Incomplete picture due to unavailable data sources.",
  },
  {
    id: "rpt-seed-3",
    generatedAt: Date.now() - 172800e3,
    generatedDate: formatDate(Date.now() - 172800e3),
    generatedTime: "08:00",
    workspaceName: "Acme Retail (sample)",
    tone: "good",
    riskLabel: "Good posture",
    riskSummary: "Your security posture is strong. No open findings at the time of this report.",
    dataQuality: {
      sources: [
        { label: "GitHub", status: "connected", lastScan: Date.now() - 86400e3, stale: false },
        { label: "Cloud", status: "imported", lastScan: Date.now() - 86400e3, stale: false },
        { label: "Website", status: "imported", lastScan: Date.now() - 86400e3, stale: false },
        { label: "Backup", status: "imported", lastScan: Date.now() - 86400e3, stale: false },
        { label: "Identity", status: "imported", lastScan: Date.now() - 86400e3, stale: false },
        { label: "Activity", status: "imported", lastScan: Date.now() - 86400e3, stale: false },
      ],
      staleSources: [],
      anyConnectorFailed: false,
      hasImports: true,
      hasLiveConnector: true,
      allSample: false,
      note: "All connected data sources are current.",
    },
    executiveSummary: { criticalFindings: 0, highFindings: 0, totalOpen: 0, totalResolved: 32, affectedAssets: 0, tone: "good" },
    findings: [],
    sourceGroups: [],
    topPriorities: [],
    remediation: { summary: { proposed: 0, awaitingApproval: 0, approved: 0, rejected: 0, inProgress: 0, failed: 0, completed: 5 }, totalActions: 5, queuedActions: [] },
    comparison: { hasData: false },
    filters: {},
    seeded: true,
    seededLabel: "No findings",
    seededDescription: "All previously identified issues have been resolved. No open findings at report time.",
  },
  {
    id: "rpt-seed-4",
    generatedAt: Date.now() - 43200e3,
    generatedDate: formatDate(Date.now() - 43200e3),
    generatedTime: "16:45",
    workspaceName: "Acme Retail (sample)",
    tone: "high",
    riskLabel: "High risk",
    riskSummary: "Your business has high-severity issues that require prompt attention.",
    dataQuality: {
      sources: [
        { label: "GitHub", status: "connected", lastScan: Date.now() - 3600e3, stale: false },
        { label: "Cloud", status: "unavailable", lastScan: null, stale: false },
        { label: "Website", status: "unavailable", lastScan: null, stale: false },
        { label: "Backup", status: "unavailable", lastScan: null, stale: false },
        { label: "Identity", status: "unavailable", lastScan: null, stale: false },
        { label: "Activity", status: "unavailable", lastScan: null, stale: false },
      ],
      staleSources: [
        { label: "Cloud", status: "unavailable" },
        { label: "Website", status: "unavailable" },
        { label: "Backup", status: "unavailable" },
        { label: "Identity", status: "unavailable" },
        { label: "Activity", status: "unavailable" },
      ],
      anyConnectorFailed: true,
      hasImports: false,
      hasLiveConnector: true,
      allSample: false,
      note: "Multiple connectors failed or are unavailable. This report only covers GitHub dependency data. Cloud, website, backup, identity, and activity data are missing.",
    },
    executiveSummary: { criticalFindings: 0, highFindings: 2, totalOpen: 5, totalResolved: 3, affectedAssets: 2, tone: "high" },
    findings: [],
    sourceGroups: [],
    topPriorities: [],
    remediation: { summary: { proposed: 2, awaitingApproval: 0, approved: 0, rejected: 0, inProgress: 1, failed: 0, completed: 2 }, totalActions: 5, queuedActions: [] },
    comparison: { hasData: false },
    filters: {},
    seeded: true,
    seededLabel: "Incomplete data (connector failed)",
    seededDescription: "GitHub connector is working, but cloud, backup, and other connectors are offline. Report covers only available data.",
  },
  {
    id: "rpt-seed-5",
    generatedAt: Date.now() - 604800e3,
    generatedDate: formatDate(Date.now() - 604800e3),
    generatedTime: "11:20",
    workspaceName: "Acme Retail (sample)",
    tone: "elevated",
    riskLabel: "Elevated risk",
    riskSummary: "Your overall posture is reasonable, but specific areas should be tightened.",
    dataQuality: {
      sources: [
        { label: "GitHub", status: "connected", lastScan: Date.now() - 86400e3 * 7, stale: true },
        { label: "Cloud", status: "imported", lastScan: Date.now() - 86400e3 * 7, stale: true },
        { label: "Website", status: "imported", lastScan: Date.now() - 86400e3 * 7, stale: true },
        { label: "Backup", status: "unavailable", lastScan: null, stale: false },
        { label: "Identity", status: "unavailable", lastScan: null, stale: false },
        { label: "Activity", status: "unavailable", lastScan: null, stale: false },
      ],
      staleSources: [
        { label: "GitHub", stale: true },
        { label: "Cloud", stale: true },
        { label: "Website", stale: true },
        { label: "Backup", status: "unavailable" },
        { label: "Identity", status: "unavailable" },
        { label: "Activity", status: "unavailable" },
      ],
      anyConnectorFailed: false,
      hasImports: true,
      hasLiveConnector: true,
      allSample: false,
      note: "Data sources are stale (last scan over 7 days ago). Findings may not reflect current state. Refresh connectors for an accurate picture.",
    },
    executiveSummary: { criticalFindings: 0, highFindings: 2, totalOpen: 6, totalResolved: 18, affectedAssets: 4, tone: "elevated" },
    findings: [],
    sourceGroups: [],
    topPriorities: [],
    remediation: { summary: { proposed: 1, awaitingApproval: 1, approved: 1, rejected: 0, inProgress: 1, failed: 0, completed: 2 }, totalActions: 6, queuedActions: [] },
    comparison: { hasData: false },
    filters: {},
    seeded: true,
    seededLabel: "Imported / demo-only data",
    seededDescription: "Report based on imported fixture data that is over a week old. Consider refreshing for accuracy.",
  },
  {
    id: "rpt-seed-6",
    generatedAt: Date.now() - 259200e3,
    generatedDate: formatDate(Date.now() - 259200e3),
    generatedTime: "07:00",
    workspaceName: "Acme Retail (sample)",
    tone: "good",
    riskLabel: "Good posture",
    riskSummary: "No report data available — no data sources have been connected.",
    dataQuality: {
      sources: [
        { label: "GitHub", status: "not connected", lastScan: null, stale: false },
        { label: "Cloud", status: "unavailable", lastScan: null, stale: false },
        { label: "Website", status: "unavailable", lastScan: null, stale: false },
        { label: "Backup", status: "unavailable", lastScan: null, stale: false },
        { label: "Identity", status: "unavailable", lastScan: null, stale: false },
        { label: "Activity", status: "unavailable", lastScan: null, stale: false },
      ],
      staleSources: [],
      anyConnectorFailed: false,
      hasImports: false,
      hasLiveConnector: false,
      allSample: false,
      note: "No data sources have been connected. Connect a repository or import a fixture to generate a report with real findings.",
    },
    executiveSummary: { criticalFindings: 0, highFindings: 0, totalOpen: 0, totalResolved: 0, affectedAssets: 0, tone: "good" },
    findings: [],
    sourceGroups: [],
    topPriorities: [],
    remediation: { summary: { proposed: 0, awaitingApproval: 0, approved: 0, rejected: 0, inProgress: 0, failed: 0, completed: 0 }, totalActions: 0, queuedActions: [] },
    comparison: { hasData: false },
    filters: {},
    seeded: true,
    seededLabel: "No report data available",
    seededDescription: "No data sources are connected. Connect a repository or import data to generate a report.",
  },
];
