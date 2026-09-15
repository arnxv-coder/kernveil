/* ============================================================
   Kernveil — unified connector framework.
   A single model for describing every connector on the page and
   dashboard: its live/demo status, the named scopes it accesses,
   when it last synced, its sync history, and the data label that
   keeps simulated sources honest.
   ============================================================ */

const MIN = 60e3;
const HOUR = 3600e3;
const DAY = 86400e3;

/* ---------- connection status model ---------- */

export const CONN_STATE_META = {
  connected: { label: "Connected", cls: "badge-green", dot: "var(--green)" },
  "needs-attention": { label: "Needs attention", cls: "badge-amber", dot: "var(--amber)" },
  syncing: { label: "Syncing", cls: "badge-teal", dot: "var(--teal)" },
  error: { label: "Sync error", cls: "badge-red", dot: "var(--red)" },
  disconnected: { label: "Not connected", cls: "badge-slate", dot: "var(--slate)" },
  planned: { label: "Planned", cls: "badge-ghost", dot: "var(--text-disabled)" },
  coming: { label: "Coming soon", cls: "badge-ghost", dot: "var(--text-disabled)" },
};

/**
 * Derive the connection status for a connector card.
 * busy/syncing wins, then a recorded failure, then unresolved
 * findings ("needs attention"), then a clean connection.
 */
export function connStatusFor({ record, busy = false, openCount = 0, fallback = "disconnected" }) {
  if (busy) return "syncing";
  if (!record) return fallback;
  if (record.lastError) return "error";
  if (openCount > 0) return "needs-attention";
  return "connected";
}

/* ---------- named access scopes ---------- */

export const SOURCE_SCOPES = {
  github: [
    "Repositories your team works in",
    "Dependency manifests and lockfiles",
    "Published advisories for reachable versions",
  ],
  cloud: [
    "Storage configuration and public access",
    "Database and networking endpoints",
    "Identity policies and permissions",
  ],
  website: [
    "TLS certificates and renewal dates",
    "Security headers and CORS",
    "DNS records — SPF, DKIM, DMARC",
  ],
  identity: [
    "Credential age and rotation",
    "Sign-in patterns and anomalies",
    "MFA coverage and policy hygiene",
  ],
  backup: [
    "Retention schedules and coverage",
    "Restore verification",
    "Encryption and access controls",
  ],
  saas: [
    "Connected third-party tools",
    "Data access and granted scopes",
    "Member and role mapping",
  ],
};

/* ---------- honest data labels ---------- */

export function dataLabel(source, record) {
  if (!record) return "Sample data";
  if (record.mode === "demo") return source === "cloud" ? "Demo fixture" : "Demo scan";
  if (record.mode === "uploaded") return "Imported fixture";
  if (record.mode === "live") return "Live scan";
  if (record.mode === "sample") return "Sample data";
  return "Scan data";
}

/* ---------- relative time + last sync ---------- */

export function relTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 45e3) return "just now";
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  if (diff < 7 * DAY) return `${Math.round(diff / DAY)} d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function lastSyncText(record) {
  if (!record) return "—";
  if (record.mode === "sample") return "Sample";
  return relTime(record.lastScanAt || record.scannedAt);
}

/* ---------- sync history ---------- */

export function syncNoteOf(record) {
  if (!record) return "Scan complete";
  if (record.kind === "github") {
    return record.healthy
      ? "Clean scan — no dependencies flagged"
      : `${record.findings.length} finding${record.findings.length === 1 ? "" : "s"}`;
  }
  if (record.kind === "cloud") {
    return `${record.records} check${record.records === 1 ? "" : "s"} · ${record.findings.length} finding${record.findings.length === 1 ? "" : "s"}`;
  }
  return "Scan complete";
}

export function syncEntryFor(record, overrides = {}) {
  return {
    at: record.lastScanAt || record.scannedAt || Date.now(),
    ok: overrides.ok !== undefined ? overrides.ok : true,
    note: overrides.note || syncNoteOf(record),
    mode: record.mode,
  };
}

export function appendSync(syncs, entry) {
  return [...(syncs || []).filter((s) => s.at !== entry.at), entry].slice(-12);
}

/* The website connector has no live scanning in this demo — its
   sample history deliberately includes a failed crawl so the
   "last sync" model is visible without claiming real connections. */
const SAMPLE_SYNCS = [
  { at: Date.now() - 62 * MIN, ok: true, note: "Crawl complete — 6 pages, 2 findings", mode: "sample" },
  { at: Date.now() - 5 * HOUR, ok: true, note: "Crawl complete — 6 pages, 2 findings", mode: "sample" },
  { at: Date.now() - 26 * HOUR, ok: false, note: "Crawl failed — TLS handshake time out", mode: "sample" },
  { at: Date.now() - 2 * DAY, ok: true, note: "Crawl complete — 6 pages", mode: "sample" },
];

export function syncHistoryOf(source, record) {
  if (record && Array.isArray(record.syncs) && record.syncs.length) {
    return [...record.syncs].sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  if (record) return [{ at: record.lastScanAt || record.scannedAt, ok: true, note: syncNoteOf(record), mode: record.mode }];
  if (source === "website") return SAMPLE_SYNCS;
  return [];
}