/* ============================================================
   Kernveil — backup verification model (Phase 4).
   A backup register derived entirely from a fixture in this
   browser (bundled sample or uploaded JSON) or plain planning
   data. Every system records its expected schedule, last good
   restore point and latest attempt; the engine derives the state
   (healthy / failed / missing / stale / no backup data) and turns
   anything risky into a standard tracked finding. Nothing here
   ever contacts a live backup tool — labels stay honest.
   ============================================================ */

export const SOURCE_LABEL = "Backup audit";
const CATEGORY = "Backups";

const MIN = 60e3;
const HOUR = 3600e3;
const DAY = 86400e3;
const WEEK = 7 * DAY;

const UNIT_MS = { minute: MIN, hour: HOUR, day: DAY, week: WEEK };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtStamp(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDay(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

export function scheduleMs(schedule) {
  const value = Number(schedule && schedule.value);
  if (!Number.isFinite(value) || value < 1) return 0;
  const ms = UNIT_MS[schedule && schedule.unit];
  if (!ms) return 0;
  return value * ms;
}

export function scheduleLabel(schedule) {
  const value = Number(schedule && schedule.value);
  if (!Number.isFinite(value) || value < 1 || !UNIT_MS[schedule.unit]) return "Not configured";
  const unit = value > 1 ? `${schedule.unit}s` : schedule.unit;
  return `every ${value} ${unit}`;
}

export function scheduleOptions() {
  return [
    { key: "minute", label: "Minutes" },
    { key: "hour", label: "Hours" },
    { key: "day", label: "Days" },
    { key: "week", label: "Weeks" },
  ];
}

export const BACKUP_STATE_META = {
  healthy: { label: "Protected", cls: "badge-green", dot: "var(--green)" },
  failed: { label: "Failed", cls: "badge-red", dot: "var(--red)" },
  missing: { label: "Missing", cls: "badge-orange", dot: "var(--orange)" },
  stale: { label: "Stale", cls: "badge-amber", dot: "var(--amber)" },
  "no-data": { label: "No backup data", cls: "badge-slate", dot: "var(--slate)" },
};

const SEVERITY_OF_STATE = { failed: "high", missing: "high", stale: "medium", "no-data": "medium" };

const TITLE_OF_STATE = {
  failed: (name) => `Backup failed — ${name}`,
  missing: (name) => `No backup on record — ${name}`,
  stale: (name) => `Backup stale — ${name}`,
  "no-data": (name) => `No backup coverage — ${name}`,
};

const SUMMARY_OF_STATE = {
  failed: "Restore coverage is at risk",
  missing: "Scheduled but never backed up",
  stale: "Backup overdue",
  "no-data": "No backup coverage",
};

const IMPACT_OF_STATE = {
  failed: "Potential data loss",
  missing: "No recovery path",
  stale: "Widening recovery window",
  "no-data": "No recovery path",
};

const STEPS_OF_STATE = {
  failed: (name) => [
    `Open the failed job for ${name} and read the recorded error.`,
    "Restore-test the latest good point before relying on the next run.",
    "Re-run the backup and confirm it clears.",
  ],
  missing: (name) => [
    `Create a backup job for ${name} that honors the expected schedule.`,
    "Run a first backup and restore-test it.",
    "Confirm the next expected backup lands on time.",
  ],
  stale: (name) => [
    `Run the missed backup for ${name} now to close the gap.`,
    "Restore-test the latest good point.",
    "Confirm the next expected backup is back on schedule.",
  ],
  "no-data": (name) => [
    `Attach a backup schedule for ${name}.`,
    "Run a first backup and restore-test it.",
    "Confirm the next expected backup lands on time.",
  ],
};

function tsOf(value) {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/* Derive the state for one raw system. Precedence: a failed latest
   attempt wins, then a configured-but-never-succeeded schedule
   ("missing"), then no records at all ("no backup data"), then an
   overdue last success ("stale"), else protected. */
export function systemState(s) {
  const attempt = s.lastAttempt ? { at: tsOf(s.lastAttempt.at), ok: !!s.lastAttempt.ok } : null;
  if (attempt && attempt.at && !attempt.ok) return "failed";
  const hasSchedule = scheduleMs(s.schedule) > 0;
  const lastSuccess = tsOf(s.lastSuccess);
  if (hasSchedule && !lastSuccess) return "missing";
  if (!lastSuccess) return "no-data";
  if (hasSchedule && Date.now() - lastSuccess > scheduleMs(s.schedule)) return "stale";
  return "healthy";
}

function slugId(id) {
  return String(id || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "system";
}

function stripTags(str) {
  return String(str || "").replace(/<[^>]*>/g, "");
}

function deriveSystem(raw, mode) {
  const id = String(raw && raw.id != null ? raw.id : "").trim();
  const name = stripTags(raw && (raw.name || slugId(id))) || "Unnamed system";
  const type = stripTags(raw && raw.type) || "server";
  const env = stripTags(raw && raw.env) || "Production";
  const host = stripTags(raw && raw.host) || "";
  const schedule = raw && raw.schedule ? { value: Number(raw.schedule.value) || 0, unit: UNIT_MS[raw.schedule.unit] ? raw.schedule.unit : "hour" } : { value: 0, unit: "hour" };
  const state = systemState({ lastSuccess: raw.lastSuccess, lastAttempt: raw.lastAttempt, schedule });
  const severity = SEVERITY_OF_STATE[state] || "healthy";
  const lastSuccessAt = tsOf(raw.lastSuccess);
  const lastSuccessLabel = lastSuccessAt ? fmtStamp(lastSuccessAt) : "None on record";
  const win = scheduleMs(schedule);
  const nextExpectedAt = lastSuccessAt ? lastSuccessAt + win : 0;
  const nextExpectedLabel = nextExpectedAt ? fmtStamp(nextExpectedAt) : win ? "Awaiting a first run" : "—";
  const attempt = raw.lastAttempt ? { at: tsOf(raw.lastAttempt.at), ok: !!raw.lastAttempt.ok, note: stripTags(raw.lastAttempt.note) } : null;
  const attemptNote = attempt && attempt.note ? attempt.note : "No error logged";
  const attemptAtLabel = attempt && attempt.at ? fmtStamp(attempt.at) : "—";

  let why = "";
  let detected = "";
  let steps = [];
  if (state === "failed") {
    why = `The most recent backup attempt for <code>${name}</code> failed. The newest restorable point is older than expected, so anything changed since then cannot be restored today.`;
    detected = `The backup register records a failed attempt for <code>${name}</code> at ${attemptAtLabel}: “${attemptNote}”.`;
    steps = STEPS_OF_STATE.failed(name);
  } else if (state === "missing") {
    why = `No successful backup is on record for <code>${name}</code> yet, even though it is scheduled ${scheduleLabel(schedule)}. Its data currently has no restorable copy.`;
    detected = `The register shows no successful restore point for <code>${name}</code> at all, against an expected ${scheduleLabel(schedule)} schedule.`;
    steps = STEPS_OF_STATE.missing(name);
  } else if (state === "stale") {
    why = `The last successful backup for <code>${name}</code> landed ${lastSuccessLabel} — past the expected ${scheduleLabel(schedule)} window. Changes since then are not yet restorable.`;
    detected = `The register shows the newest good restore point for <code>${name}</code> at ${lastSuccessLabel}, older than the ${scheduleLabel(schedule)} target of ${nextExpectedLabel}.`;
    steps = STEPS_OF_STATE.stale(name);
  } else if (state === "no-data") {
    why = `No backup is configured or recorded for <code>${name}</code> at all. There is no recovery path for this system today.`;
    detected = `The backup register has no entries for <code>${name}</code> — no schedule, no success, no attempt.`;
    steps = STEPS_OF_STATE["no-data"](name);
  }

  const evidence = [
    { key: "System", value: name },
    { key: "Type", value: type },
    { key: "Expected schedule", value: scheduleLabel(schedule) },
    { key: "Last successful backup", value: lastSuccessLabel },
    { key: "Next expected", value: nextExpectedLabel },
    { key: "Last attempt", value: attempt ? `${attempt.ok ? "Succeeded" : "Failed"} — ${attemptAtLabel}` : "None on record" },
    { key: "Checked", value: "just now" },
  ];

  return {
    id,
    name,
    type,
    env,
    host,
    schedule,
    state,
    severity,
    lastSuccessAt,
    lastSuccessLabel,
    nextExpectedAt,
    nextExpectedLabel,
    attemptAtLabel,
    attemptNote,
    scheme: raw,
    issue: state !== "healthy",
    why,
    summary: SUMMARY_OF_STATE[state] || "",
    detected,
    impact: IMPACT_OF_STATE[state] || "",
    steps,
    evidence,
  };
}

/* Full analysis of a raw system list. `meta` carries display name /
   account used by the record builder. */
export function analyzeBackupSystems(rawSystems, mode, meta = {}) {
  const list = Array.isArray(rawSystems) ? rawSystems : [];
  let skipped = 0;
  const systems = [];
  for (const s of list) {
    if (!s || typeof s !== "object" || s.id == null || String(s.id).trim() === "") {
      skipped += 1;
      continue;
    }
    systems.push(deriveSystem(s, mode));
  }

  const findings = systems
    .filter((s) => s.issue)
    .map((s) => {
      const now = Date.now();
      const first = s.lastSuccessAt ? fmtDay(s.lastSuccessAt) : fmtDay(now);
      return {
        id: `bk:${s.id}:${s.state}`,
        title: TITLE_OF_STATE[s.state](s.name),
        severity: s.severity,
        category: CATEGORY,
        status: "open",
        asset: `bk:${s.id}`,
        first,
        last: "just now",
        summary: s.summary,
        detected: s.detected,
        why: s.why,
        impact: s.impact,
        evidence: s.evidence,
        steps: s.steps,
        related: [`bk:${s.id}`],
        history: [
          {
            time: fmtStamp(now),
            text: mode === "demo" ? "Discovered from the bundled sample backup profile (simulated data)." : "Imported from the backup fixture you uploaded.",
            c: "var(--amber)",
          },
        ],
        source: "backup-fixture",
        demo: mode === "demo",
        rule: s.state,
        system: s.name,
        fixture: meta.fixtureName || null,
      };
      // first unused for display, but kept in closure scope above for clarity
    });

  const assets = systems.map((s) => ({
    id: `bk:${s.id}`,
    name: s.name,
    type: s.type,
    env: s.env,
    source: SOURCE_LABEL,
    risk: s.severity,
    last: "just now",
    host: s.host || `${s.name} · ${s.type}`,
  }));

  const warnings = [];
  if (mode === "demo") {
    warnings.push("Bundled sample — this is simulated backup data, not a live backup tool.");
  }
  if (skipped > 0) {
    warnings.push(`${skipped} entr${skipped === 1 ? "y was" : "ies were"} skipped (missing an id).`);
  }
  if (systems.length === 0) {
    warnings.push("The fixture reported no systems — nothing to evaluate.");
  }
  if (findings.length === 0 && systems.length > 0) {
    warnings.push("Every system is protected — the register is clean.");
  }

  return {
    ok: true,
    mode,
    account: meta.account || (systems[0] ? slugId(systems[0].id) : "upload"),
    name: meta.name || (meta.account ? `Backup fixture — ${meta.account}` : "Uploaded backup fixture"),
    fixtureName: meta.name || null,
    records: systems.length,
    systems,
    rawSystems: list.slice(),
    findings,
    assets,
    skipped,
    warnings,
    clean: findings.length === 0,
    state: findings.length ? "findings" : "healthy",
  };
}

/* ---------- fixture parsing ---------- */

function parseRawFixture(text) {
  if (!text || !String(text).trim()) {
    return { ok: false, errors: ["The file is empty."] };
  }
  let doc;
  try {
    doc = JSON.parse(String(text));
  } catch {
    return { ok: false, errors: ["This file isn't valid JSON — export the fixture again and retry."] };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, errors: ["The fixture should be a JSON object with a systems list."] };
  }
  if (!Array.isArray(doc.systems)) {
    return { ok: false, errors: ["The fixture is missing a systems list — add a top-level systems array."] };
  }
  return { ok: true, doc };
}

export function parseBackupFixture(text) {
  return parseRawFixture(text);
}

export function analyzeBackupFixture(text) {
  const p = parseRawFixture(text);
  if (!p.ok) {
    return { ok: false, errors: p.errors };
  }
  const doc = p.doc;
  const account = String(doc.account || (doc.systems[0] && doc.systems[0].id) || "upload");
  const result = analyzeBackupSystems(doc.systems, "uploaded", {
    account: String(account).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "upload",
    name: doc.fixtureName || (doc.account ? `Backup fixture — ${doc.account}` : "Uploaded backup fixture"),
  });
  return result;
}

/* ---------- bundled demo sample ---------- */

export function buildDemoSystems() {
  const H = HOUR;
  const D = DAY;
  const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
  return [
    {
      id: "checkout-db-prod",
      name: "checkout-db-prod",
      type: "database",
      env: "Production",
      host: "postgres-1.internal.acme.test",
      schedule: { value: 6, unit: "hour" },
      lastSuccess: isoAgo(3 * H),
      lastAttempt: { at: isoAgo(3 * H), ok: true, note: "Snapshot completed in 12 min" },
    },
    {
      id: "billing-app-data",
      name: "billing-app-data",
      type: "application",
      env: "Production",
      host: "billing.acme.internal",
      schedule: { value: 24, unit: "hour" },
      lastSuccess: isoAgo(5 * D),
      lastAttempt: { at: isoAgo(2 * H), ok: false, note: "Snapshot task timed out after 90 min" },
    },
    {
      id: "cms-admin",
      name: "cms-admin",
      type: "application",
      env: "Staging",
      host: "cms-staging.acme.test",
      schedule: { value: 24, unit: "hour" },
      lastSuccess: isoAgo(3 * D),
    },
    {
      id: "legacy-api-v2",
      name: "legacy-api-v2",
      type: "api",
      env: "Production",
      host: "legacy-api.acme.internal",
      schedule: { value: 12, unit: "hour" },
    },
    {
      id: "mail-relay",
      name: "mail-relay",
      type: "server",
      env: "Production",
      host: "relay.acme.internal",
      schedule: { value: 0, unit: "hour" },
    },
  ];
}

export function buildDemoBackupResult() {
  return analyzeBackupSystems(buildDemoSystems(), "demo", {
    account: "acme-retail-prod",
    name: "Acme Retail backup estate (sample)",
  });
}

export function buildDemoFixture() {
  return {
    version: 1,
    source: "demo-backups",
    account: "acme-retail-prod",
    fixtureName: "Acme Retail backup estate (sample)",
    systems: buildDemoSystems(),
  };
}

/* Record builder shared by the Connectors page and the Backup checks
   page, matching the unified connector model. */
export function buildBackupRecord(result, mode) {
  const now = Date.now();
  return {
    id: `backup:${result.account || "sample"}`,
    kind: "backup",
    mode,
    name: result.name,
    account: result.account,
    records: result.records,
    systems: result.systems,
    findings: result.findings,
    assets: result.assets,
    rawSystems: result.rawSystems,
    clean: result.findings.length === 0,
    state: result.findings.length ? "findings" : "healthy",
    warnings: result.warnings || [],
    skipped: result.skipped || 0,
    addedAt: now,
    lastScanAt: now,
  };
}