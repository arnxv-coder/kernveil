/* ============================================================
   Kernveil — email notification model (Phase 5).
   Two alert types driven by the existing unified findings and
   remediation data:
     • critical-finding   — newly discovered critical findings
     • overdue-remediation — open remediation items past their
                            7-day action window
   HONESTY BOUNDARY: no email service is connected in this demo.
   Every entry stores sent:false and renders as a preview. Nothing
   here ever claims an email was delivered.
   ============================================================ */
import { STATUS_LABEL, normalizeStatus } from "./remediation.js";

export const EMAIL_CAPABILITY = "preview"; // "preview" | "connected" — never connected in this demo

export const OVERDUE_MS = 7 * 24 * 3600 * 1000;

export const NOTIFICATION_TYPES = [
  {
    key: "critical-finding",
    label: "Newly discovered critical findings",
    short: "Critical findings",
    triggers:
      "When a scanner, import, or rescan surfaces a critical finding for the first time in this workspace. Each finding alerts once — if a closed finding is reopened, it alerts again as a new event.",
  },
  {
    key: "overdue-remediation",
    label: "Overdue remediation items",
    short: "Overdue remediation",
    triggers:
      "When an open remediation item passes its 7-day action window and is still unresolved at the next evaluation (proposed, awaiting approval, approved, rejected, in progress, or failed). It stays active until the item completes or leaves the workspace.",
  },
];

export const DEFAULT_NOTIF_SETTINGS = {
  "critical-finding": { enabled: true, recipients: ["sec@acme.example"] },
  "overdue-remediation": { enabled: true, recipients: ["sec@acme.example"] },
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- shared helpers ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseDate(s) {
  if (!s) return 0;
  const m = String(s).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\D+(\d{1,2})\D+(\d{4})/i);
  if (!m) return 0;
  const d = new Date(Number(m[3]), MONTHS.indexOf(m[1]), Number(m[2]));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstStep(f) {
  if (f && Array.isArray(f.steps) && f.steps.length) return stripTags(f.steps[0]);
  if (f) return stripTags(f.summary) || "Complete the recommended remediation.";
  return "Complete the recommended remediation.";
}

export function sourceLabel(f) {
  if (f.source === "github-connector") return "GitHub";
  if (f.source === "cloud-fixture") return "Cloud";
  if (f.source === "website-fixture") return "Website";
  if (f.source === "backup-fixture") return "Backup";
  if (f.source === "identity-fixture") return "Identity";
  return "Sample";
}

export function fmtAlertTime(ts) {
  const d = new Date(ts || Date.now());
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${dd} · ${hh}:${mi}`;
}

export function humanizeDays(ms) {
  const n = Math.max(1, Math.round(ms / 86400000));
  return `${n} ${n === 1 ? "day" : "days"}`;
}

export function overdueFor(f) {
  return humanizeDays(Date.now() - parseDate(f.first));
}

export function isOverdueFinding(f) {
  if (!f) return false;
  if (normalizeStatus(f.status) === "completed") return false;
  if (!f.first) return false;
  return Date.now() - parseDate(f.first) > OVERDUE_MS;
}

/* ---------- alert builders ---------- */

const DOC = {
  kind: "email",
  channel: "email",
  sent: false,
  delivery: "preview",
};

export function makeCriticalAlert(f, cycle) {
  return {
    ...DOC,
    id: `al-crit-${f.id}-${cycle}`,
    type: "critical-finding",
    kind: "initial",
    event: cycle,
    status: "new",
    mode: "generated",
    findingId: f.id,
    title: f.title,
    severity: "Critical",
    asset: f.asset,
    source: sourceLabel(f),
    risk: stripTags(f.why) || stripTags(f.summary),
    action: firstStep(f),
    firstDetected: f.first,
    discoveredAt: Date.now(),
  };
}

export function makeOverdueAlert(f, cycle) {
  return {
    ...DOC,
    id: `al-ovr-${f.id}-${cycle}`,
    type: "overdue-remediation",
    kind: "initial",
    event: cycle,
    status: "new",
    mode: "generated",
    findingId: f.id,
    title: f.title,
    asset: f.asset,
    source: sourceLabel(f),
    remediationStatus: STATUS_LABEL[normalizeStatus(f.status)] || "Proposed",
    overdueFor: overdueFor(f),
    nextAction: firstStep(f),
    risk: stripTags(f.why) || stripTags(f.summary),
    firstDetected: f.first,
    discoveredAt: Date.now(),
  };
}

export function makeReminder(entry) {
  const n = (entry.reminderCount || 0) + 1;
  return {
    ...entry,
    id: `${entry.id}-r${n}`,
    event: `${entry.event}-r${n}`,
    kind: "reminder",
    status: "new",
    mode: "generated",
    reminderCount: n,
    remindedFrom: entry.id,
    discoveredAt: Date.now(),
  };
}

/* ---------- sample (clearly-labelled demo) history ---------- */

export function sampleHistory(type) {
  const now = Date.now();
  if (type === "critical-finding") {
    return [
      {
        ...DOC,
        id: "al-sample-crit-1",
        type,
        kind: "initial",
        event: "sample-1",
        status: "new",
        mode: "demo-history",
        findingId: "sample-crit-1",
        title: "Service account key committed to a public repository",
        severity: "Critical",
        asset: "billing-app",
        source: "GitHub",
        risk: "A production credential is readable by anyone on the internet. Sample demo entry — not from this workspace.",
        action: "Rotate the key now and scrub it from repository history.",
        firstDetected: "Sep 12, 2026",
        discoveredAt: now - 2 * 86400000,
      },
      {
        ...DOC,
        id: "al-sample-crit-2",
        type,
        kind: "initial",
        event: "sample-2",
        status: "resolved",
        mode: "demo-history",
        findingId: "sample-crit-2",
        title: "Database credentials revealed in build logs",
        severity: "Critical",
        asset: "db-main",
        source: "Cloud",
        risk: "Connection strings in public logs let anyone attempt direct logins. Sample demo entry — not from this workspace.",
        action: "Rotate the credentials and stop logging them.",
        firstDetected: "Sep 03, 2026",
        discoveredAt: now - 5 * 86400000,
      },
    ];
  }
  return [
    {
      ...DOC,
      id: "al-sample-ovr-1",
      type,
      kind: "initial",
      event: "sample-1",
      status: "new",
      mode: "demo-history",
      findingId: "sample-ovr-1",
      title: "Public write access on a repository",
      asset: "cms-admin",
      source: "GitHub",
      remediationStatus: "Approved",
      overdueFor: "9 days",
      nextAction: "Ship the approved permission change and re-check.",
      risk: "Anyone can merge to this repository. Sample demo entry — not from this workspace.",
      firstDetected: "Jul 30, 2026",
      discoveredAt: now - 3 * 86400000,
    },
    {
      ...DOC,
      id: "al-sample-ovr-2",
      type,
      kind: "reminder",
      event: "sample-2",
      status: "resolved",
      mode: "demo-history",
      findingId: "sample-ovr-2",
      title: "Unencrypted uploads on a staging bucket",
      asset: "orders-bucket",
      source: "Cloud",
      remediationStatus: "In progress",
      overdueFor: "5 days",
      nextAction: "Enable default encryption on the bucket.",
      risk: "Data at rest is stored without encryption. Sample demo entry — not from this workspace.",
      firstDetected: "Jul 22, 2026",
      discoveredAt: now - 4 * 86400000,
    },
  ];
}

/* ---------- previews and rendered body ---------- */

export function previewSubject(type, f) {
  if (!f) return "";
  if (type === "critical-finding") return `[Critical] ${f.title} — ${f.asset}`;
  return `[Overdue] ${f.title} — open for ${overdueFor(f)}`;
}

export function previewRows(type, f) {
  if (!f) return [];
  if (type === "critical-finding") {
    return [
      { k: "Severity", v: "Critical" },
      { k: "Affected asset", v: f.asset },
      { k: "Source", v: sourceLabel(f) },
      { k: "Risk", v: stripTags(f.why) || stripTags(f.summary) },
      { k: "Recommended action", v: firstStep(f) },
    ];
  }
  return [
    { k: "Affected asset", v: f.asset },
    { k: "Current status", v: STATUS_LABEL[normalizeStatus(f.status)] || "Proposed" },
    { k: "Overdue by", v: overdueFor(f) },
    { k: "Recommended next action", v: firstStep(f) },
  ];
}

export function entryRows(type, entry) {
  if (type === "critical-finding") {
    return [
      { k: "Severity", v: entry.severity },
      { k: "Affected asset", v: entry.asset },
      { k: "Source", v: entry.source },
      { k: "Risk", v: entry.risk },
      { k: "Recommended action", v: entry.action },
    ];
  }
  return [
    { k: "Affected asset", v: entry.asset },
    { k: "Current status", v: entry.remediationStatus },
    { k: "Overdue by", v: entry.overdueFor },
    { k: "Recommended next action", v: entry.nextAction },
  ];
}

/* ---------- staging (pure + idempotent) ---------- */

/**
 * Compare the current workspace state against the persisted alert
 * ledger and return the minimal changes to apply.
 *  - resolves any generated alert whose finding completes
 *  - clears alerts whose finding source left the workspace
 *  - adds one alert per (type, finding, event-cycle); a finding that
 *    completes, then reopens, is a NEW event and alerts again — that
 *    is the only way a duplicate alert for the same finding is made.
 */
export function stageNotifications({ findings, settings, existing = [], seen = [] }) {
  const additions = [];
  const updates = [];
  const newSeen = [];
  const findOf = (id) => findings.find((f) => f.id === id);

  for (const e of existing) {
    if (e.mode === "demo-history") continue;
    if (e.status === "resolved" || e.status === "cleared" || e.status === "dismissed") continue;
    const f = findOf(e.findingId);
    if (!f) {
      updates.push({ id: e.id, patch: { status: "cleared", resolvedAt: Date.now() } });
    } else if (f.status === "completed") {
      updates.push({ id: e.id, patch: { status: "resolved", resolvedAt: Date.now() } });
    }
  }

  const handledCycles = (type, fid) =>
    existing.filter(
      (e) =>
        e.type === type &&
        e.findingId === fid &&
        (e.status === "resolved" || e.status === "cleared")
    ).length;

  for (const f of findings) {
    const status = normalizeStatus(f.status);
    if (!f || status === "completed") continue;

    if (settings["critical-finding"] && settings["critical-finding"].enabled !== false && f.severity === "critical") {
      const cycle = handledCycles("critical-finding", f.id) + 1;
      const key = `critical-finding|${f.id}|${cycle}`;
      const already = existing.some((e) => e.type === "critical-finding" && e.findingId === f.id && e.event === cycle);
      if (!already && !seen.includes(key)) {
        additions.push({ key, entry: makeCriticalAlert(f, cycle) });
        newSeen.push(key);
      }
    }

    if (settings["overdue-remediation"] && settings["overdue-remediation"].enabled !== false && isOverdueFinding(f)) {
      const cycle = handledCycles("overdue-remediation", f.id) + 1;
      const key = `overdue-remediation|${f.id}|${cycle}`;
      const already = existing.some((e) => e.type === "overdue-remediation" && e.findingId === f.id && e.event === cycle);
      if (!already && !seen.includes(key)) {
        additions.push({ key, entry: makeOverdueAlert(f, cycle) });
        newSeen.push(key);
      }
    }
  }

  return { additions, updates, newSeen };
}

/* ---------- active counts (settings-gated) ---------- */

export function activeCountFor(list, type, enabled = true) {
  if (!enabled) return 0;
  return list.filter((e) => e.type === type && e.mode === "generated" && e.status === "new").length;
}