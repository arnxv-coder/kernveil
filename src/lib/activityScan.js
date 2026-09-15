/* ============================================================
   Kernveil — suspicious-activity model (Phase 7).
   An audit-log review derived entirely from a fixture in this
   browser (bundled sample or uploaded JSON export). Raw events
   are classified into a standard alert set (unusual login /
   repeated failed access / privilege change / sensitive access /
   new admin action), and anything risky becomes a standard
   tracked finding in the unified model. HONESTY BOUNDARY:
   nothing here ever connects to a live cloud or identity log,
   and no account, privilege, or resource is ever changed.
   Labels stay honest.
   ============================================================ */

export const SOURCE_LABEL = "Activity monitoring";
export const CATEGORY = "Suspicious activity";

export const ALERT_RULES = [
  "unusual-login",
  "failed-access",
  "privilege-change",
  "sensitive-access",
  "admin-action",
];

const MIN = 60e3;
const HOUR = 3600e3;
const DAY = 86400e3;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtStamp(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtFull(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDay(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

function tsOf(value) {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function slugId(id) {
  return String(id || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "event";
}

function stripTags(str) {
  return String(str || "").replace(/<[^>]*>/g, "");
}

export const ALERT_STATE_META = {
  "unusual-login": { label: "Unusual login", cls: "badge-orange", dot: "var(--orange)" },
  "failed-access": { label: "Repeated failures", cls: "badge-amber", dot: "var(--amber)" },
  "privilege-change": { label: "Privilege change", cls: "badge-red", dot: "var(--red)" },
  "sensitive-access": { label: "Sensitive access", cls: "badge-orange", dot: "var(--orange)" },
  "admin-action": { label: "Admin action", cls: "badge-orange", dot: "var(--orange)" },
  normal: { label: "Normal activity", cls: "badge-green", dot: "var(--green)" },
};

const SEVERITY_OF_STATE = {
  "unusual-login": "high",
  "failed-access": "medium",
  "privilege-change": "critical",
  "sensitive-access": "high",
  "admin-action": "high",
};

const IMPACT_OF_STATE = {
  "unusual-login": "Credential-reuse exposure",
  "failed-access": "Threat of brute-force takeover",
  "privilege-change": "Unauthorised privileged access",
  "sensitive-access": "Sensitive data exposure",
  "admin-action": "Broader control-plane blast radius",
};

const TITLE_OF_STATE = {
  "unusual-login": (a) => `Unusual sign-in from a new region — ${a}`,
  "failed-access": (a) => `Repeated failed sign-in attempts — ${a}`,
  "privilege-change": (a) => `Privilege escalation attempt — ${a}`,
  "sensitive-access": (r) => `Unexpected access to a sensitive resource — ${r}`,
  "admin-action": (r) => `New administrator action — ${r}`,
};

const SUMMARY_OF_STATE = {
  "unusual-login": (region, actorId) => `${region} sign-in flagged — first for ${actorId}`,
  "failed-access": (n, m) => `${n} failed sign-ins in ${m} minutes`,
  "privilege-change": (actorId) => `Administrator role added to ${actorId} without approval`,
  "sensitive-access": (r) => `Read of ${r} from an unexpected session`,
  "admin-action": (actorId, role) => `Administrator-capable action by ${actorId}${role ? ` (${role})` : ""}`,
};

const ENTITY_META = {
  sensitive: { kind: "storage", name: (r) => r },
  account: { kind: "application", name: (r) => r },
  identityUser: { kind: "identity", name: (actor, id) => (id ? `${actor} · ${id}` : actor) },
};

/* One rule per event, decided in escalating-priority order so a log
   line that meets several patterns gets its most serious label. */
function classifyEvent(ev) {
  if (!ev) return "normal";
  if (ev.expected === true) return "normal";
  const roleAdded = String(ev.roleAdded || "");
  if ((ev.privilegeEscalation === true || /admin/i.test(roleAdded)) && ev.approved !== true) {
    return "privilege-change";
  }
  if (ev.sensitive === true && (ev.unusualAccess === true || ev.newActor === true)) return "sensitive-access";
  if (ev.adminAction === true && ev.newAdminAction !== false) return "admin-action";
  if (ev.unexpectedRegion === true || ev.newDevice === true) return "unusual-login";
  const fails = Number(ev.failedAttempts) || 0;
  const windowMin = Number(ev.windowMinutes) || 0;
  if (fails >= 5 && windowMin <= 15) return "failed-access";
  return "normal";
}

function typeNameOf(t) {
  return t === "service" ? "Service account" : t === "account" ? "Cloud account" : "User";
}

/* Derive one activity event (alert or normal) from a raw log entry. */
function deriveEvent(raw, mode, meta = {}) {
  const id = String(raw && raw.id != null ? raw.id : "").trim();
  const action = stripTags(raw && raw.action) || "Event";
  const actor = stripTags(raw && raw.actor) || "Unknown actor";
  const actorId = stripTags(raw && raw.actorId) || id;
  const actorType = String(raw && raw.actorType) || "user";
  const source = raw && raw.source === "identity" ? "identity" : "cloud";
  const auditSource = source === "identity" ? "Identity" : "Cloud";
  const resource = stripTags(raw && raw.resource) || "—";
  const ts = tsOf(raw && raw.ts);
  const eventTime = ts ? fmtStamp(ts) : "—";
  const state = classifyEvent(raw);
  const severity = state === "normal" ? "healthy" : SEVERITY_OF_STATE[state];
  const failCount = Math.max(1, Number(raw && raw.failedAttempts) || 1);
  const windowMin = Math.max(1, Number(raw && raw.windowMinutes) || 1);
  const region = stripTags(raw && raw.region) || "";
  const ip = stripTags(raw && raw.ip) || "";
  const device = stripTags(raw && raw.device) || "";
  const roleAdded = stripTags(raw && raw.roleAdded) || "";
  const grantedRole = stripTags(raw && raw.grantedRole) || "";
  const removedAfterMin = raw && raw.removedAfterMin != null ? Number(raw.removedAfterMin) : null;
  const objectCount = raw && raw.objectCount != null ? Number(raw.objectCount) : null;
  const normalPath = stripTags(raw && raw.normalAccessPath) || "";
  const session = stripTags(raw && raw.session) || "";

  /* What the alert is about: the affected user/identity for account
     events, the resource/asset for resource and admin events. */
  let entity = slugId(actorId);
  let entityName = ENTITY_META.identityUser.name(actor, actorId);
  let entityKind = "identity";
  if (state === "sensitive-access") {
    entity = slugId(resource);
    entityName = ENTITY_META.sensitive.name(resource);
    entityKind = ENTITY_META.sensitive.kind;
  } else if (state === "admin-action") {
    entity = slugId(resource);
    entityName = ENTITY_META.account.name(resource);
    entityKind = ENTITY_META.account.kind;
  }

  const evidenceBase = [
    { key: "Event type", value: ALERT_STATE_META[state] ? ALERT_STATE_META[state].label : "Event" },
    { key: "Origin log", value: `${auditSource} audit` },
    { key: "Event time", value: eventTime },
    { key: "Actor", value: `${actor} · ${actorId}` },
  ];

  let why = "";
  let detected = "";
  let summary = "";
  let impact = IMPACT_OF_STATE[state] || "";
  const evidence = evidenceBase.slice();
  let steps = [];

  if (state === "unusual-login") {
    evidence.push({ key: "Region", value: region || "new region" });
    evidence.push({ key: "Device", value: device || "—" });
    evidence.push({ key: "IP address", value: ip || "—" });
    summary = SUMMARY_OF_STATE["unusual-login"](region || "A new region", actorId);
    why = `A successful sign-in from a location this account has never used before is the classic signature of a stolen session or credential — the legitimate user almost never walked in at that time from that region. A single successful login is enough for an attacker to read mail, export data, or begin moving laterally, which is why one unusual success beats a thousand blocked failures.`;
    detected = `The audit log records <code>${actor}</code> (<code>${actorId}</code>) signing in from <code class='bad'>${region || "a new region"}</code>${eventTime !== "—" ? ` at <code>${eventTime}</code>` : ""}${ip ? ` from <code>${ip}</code>` : ""} — a location not seen before for this account.`;
    steps = [
      `Confirm with ${actorId} whether this sign-in was them (at the recorded time and region).`,
      "If it was not them, expire the session and rotate the account credential now.",
      "Watch this account for any further sign-ins from new regions, then re-analyse the log.",
    ];
  } else if (state === "failed-access") {
    evidence.push({ key: "Failed attempts", value: `${failCount} in ~${windowMin} min` });
    evidence.push({ key: "IP address", value: ip || "—" });
    evidence.push({ key: "Outcome", value: "All attempts failed" });
    summary = SUMMARY_OF_STATE["failed-access"](failCount, windowMin);
    why = `${failCount} failed sign-in attempts in under ${windowMin} minutes is a brute-force pattern — something is throwing credentials at this account at automation speed, and guessing can eventually succeed on weak or recycled passwords. Even while failures continue, the account is under active attack, and a service account being targeted is especially concerning.`;
    detected = `The audit log shows <code>${failCount}</code> consecutive failed sign-in attempts for <code>${actor}</code> (<code>${actorId}</code>) within <code>${windowMin}</code> minutes${ip ? ` from <code>${ip}</code>` : ""}. No attempt succeeded.`;
    steps = [
      `Check whether ${actorId} or its team recognises the recent attempts.`,
      "Enforce MFA (or rotate the credential for a service account) so a guessed password alone is not enough.",
      "Watch the account for further failures, then re-analyse the log.",
    ];
  } else if (state === "privilege-change") {
    evidence.push({ key: "Role added", value: roleAdded || "administrator role" });
    if (removedAfterMin != null) evidence.push({ key: "Role removed after", value: `${removedAfterMin} min` });
    evidence.push({ key: "Approval recorded", value: raw && raw.approved === true ? "Yes" : "No" });
    evidence.push({ key: "Resource", value: resource });
    summary = SUMMARY_OF_STATE["privilege-change"](actorId);
    why = "Adding an administrator role — then removing it minutes later — is the shape of a privilege-escalation attempt: an attacker hops into a privileged role long enough to do damage or plant a backdoor, then tidies up. With no approval record, this change should never be silently trusted, because a compromised account can use that minute to reset others, read secrets, and modify policy.";
    detected = `The audit log attaches <code class='bad'>${roleAdded || "an administrator role"}</code> to <code>${actor}</code> (<code>${actorId}</code>)${eventTime !== "—" ? ` at <code>${eventTime}</code>` : ""}${removedAfterMin != null ? `, then removes it <code>${removedAfterMin}</code> minutes later` : ""} with <code>${raw && raw.approved === true ? "an approval" : "no approval"}</code> on record.`;
    steps = [
      "Review who raised this role change and whether it was ever approved.",
      "Reduce the account's access to exactly what its job needs, and confirm no backdoor remains.",
      "Turn on alerts for privilege-grant events, then re-analyse the log.",
    ];
  } else if (state === "sensitive-access") {
    evidence.push({ key: "Resource", value: resource });
    if (objectCount != null) evidence.push({ key: "Objects accessed", value: `${objectCount}` });
    evidence.push({ key: "Normal access", value: normalPath || "Operations team" });
    evidence.push({ key: "Session", value: session || "unexpected" });
    summary = SUMMARY_OF_STATE["sensitive-access"](resource);
    why = `Sensitive ${resource} was read from a session that does not match the resource's normal access path. If the read was not the pipeline's usual job, that export was likely exfiltrated — copies of customer or order data outside the expected owner escalate a breach from 'accessed' to 'extracted'. Timing and path are the evidence that separates routine automation from data theft.`;
    detected = `The audit log records <code>${actor}</code> (<code>${actorId}</code>) reading <code class='bad'>${resource}</code>${session ? ` from an <code>${session}</code> session` : ""}${eventTime !== "—" ? ` at <code>${eventTime}</code>` : ""}. This resource is normally accessed only by ${normalPath || "the operations team"}.`;
    steps = [
      `Confirm whether ${actorId} had a legitimate reason to read ${resource} at that time.`,
      "If not, rotate the identity's credentials and review what was accessed to scope the exposure.",
      "Tighten the resource's access policy to its normal callers, then re-analyse the log.",
    ];
  } else if (state === "admin-action") {
    evidence.push({ key: "Action", value: action });
    evidence.push({ key: "Resource", value: resource });
    if (grantedRole) evidence.push({ key: "Role granted", value: grantedRole });
    evidence.push({ key: "Actor", value: `${actor} · ${actorId}` });
    summary = SUMMARY_OF_STATE["admin-action"](actorId, grantedRole);
    why = `An administrator-capable action on the account ${actorId} performed ${eventTime !== "—" ? `at <code>${eventTime}</code>` : ""} is ${newActivityToSay()}. Creating accounts with admin roles, changing policy, or rotating keys is exactly what a moderator wants to lock down, because a single privileged action can rebuild permissions from the ground up. Anything new or outside the routine pattern belongs in front of a human reviewer.`;
    detected = `The audit log shows the administrator <code>${actor}</code> (<code>${actorId}</code>) performing <code class='bad'>${action.toLowerCase()}</code> on <code>${resource}</code>${grantedRole ? `, granting <code>${grantedRole}</code>` : ""}${eventTime !== "—" ? ` at <code>${eventTime}</code>` : ""}.`;
    steps = [
      "Review the purpose record for this admin action and confirm who requested it.",
      "If it was not intended, undo the change (remove the role or new account) now.",
      "Send privileged actions through an approval path, then re-analyse the log.",
    ];
  } else {
    why = "This event matched the account's normal baseline — expected actor, expected resource, expected time-of-day. No alert needed; it is kept as verified-normal evidence rather than noise.";
    detected = "";
    summary = "";
  }

  evidence.push({ key: "Data type", value: "audit-log export" });
  evidence.push({ key: "Analysed", value: "just now" });

  return {
    id,
    action,
    state,
    issue: state !== "normal",
    severity,
    actor,
    actorId,
    actorType,
    actorTypeLabel: typeNameOf(actorType),
    source,
    auditSource,
    resource,
    entity,
    entityName,
    entityKind,
    eventAt: ts,
    eventTime,
    summary,
    detected,
    why,
    impact,
    steps,
    evidence,
    raw,
  };
}

function newActivityToSay() {
  return "outside the routine pattern"; /* keep the admin narrative honest without hard-coded flair */
}

/* Full analysis of a raw audit log. `meta` carries the source name/
   period used by record + finding builders. */
export function analyzeActivityEvents(rawEvents, mode, meta = {}) {
  const list = Array.isArray(rawEvents) ? rawEvents : [];
  let skipped = 0;
  const events = [];
  for (const r of list) {
    if (!r || typeof r !== "object" || r.id == null || String(r.id).trim() === "") {
      skipped += 1;
      continue;
    }
    events.push(deriveEvent(r, mode, meta));
  }

  const now = Date.now();
  const alerts = events.filter((e) => e.issue);
  const normalEvents = events.filter((e) => !e.issue);

  const findings = alerts.map((s) => ({
    id: `act:${slugId(s.id)}:${s.state}`,
    title: TITLE_OF_STATE[s.state](s.entityName),
    severity: s.severity,
    category: CATEGORY,
    status: "open",
    asset: `act:${s.entity}`,
    first: fmtDay(now),
    last: "just now",
    summary: s.summary,
    detected: s.detected,
    why: s.why,
    impact: s.impact,
    evidence: s.evidence,
    steps: s.steps,
    related: ["activity-monitoring", `act:${s.entity}`],
    history: [
      {
        time: fmtStamp(now),
        text: mode === "demo" ? "Flagged by activity analysis — bundled sample audit log (simulated events)." : "Flagged by activity analysis — from the audit log you uploaded.",
        c: "var(--red)",
      },
    ],
    source: "activity-fixture",
    demo: mode === "demo",
    rule: s.state,
    eventType: ALERT_STATE_META[s.state] ? ALERT_STATE_META[s.state].label : s.state,
    auditSource: s.auditSource,
    identity: s.actor,
    username: s.actorId,
    actor: s.actor,
    resource: s.resource,
    eventTime: s.eventTime,
    eventAt: s.eventAt,
    fixture: meta.name || null,
  }));

  const seen = new Set();
  const assets = alerts
    .filter((a) => {
      if (seen.has(a.entity)) return false;
      seen.add(a.entity);
      return true;
    })
    .map((a) => ({
      id: `act:${a.entity}`,
      name: a.entityName,
      type: a.entityKind,
      env: "Production",
      source: SOURCE_LABEL,
      risk: a.severity,
      last: "just now",
      host: a.actorId || a.resource,
    }));

  const periodFrom = events.length ? Math.min(...events.map((e) => e.eventAt).filter(Boolean)) : 0;
  const periodTo = events.length ? Math.max(...events.map((e) => e.eventAt).filter(Boolean)) : 0;
  const timeRange = periodFrom ? `${fmtFull(periodFrom)} → ${fmtFull(periodTo)}` : "No events";

  const warnings = [];
  if (mode === "demo") {
    warnings.push("Bundled sample — this is simulated audit-log data, not a live cloud or identity log.");
  }
  if (skipped > 0) {
    warnings.push(`${skipped} entr${skipped === 1 ? "y was" : "ies were"} skipped (missing an id).`);
  }
  if (events.length === 0) {
    warnings.push("The audit log contained no events — nothing to evaluate.");
  }
  if (alerts.length === 0 && events.length > 0) {
    warnings.push("No suspicious activity — every event matched normal behaviour for the account.");
  }

  return {
    ok: true,
    mode,
    origin: meta.origin || "Cloud + Identity audit",
    account: meta.account || "upload",
    name: meta.name || (events[0] ? `Audit log — ${meta.account || events[0].actorId}` : "Audit log"),
    fixtureName: meta.name || null,
    records: events.length,
    events,
    alerts,
    normalEvents,
    rawEvents: list.slice(),
    findings,
    assets,
    skipped,
    warnings,
    clean: alerts.length === 0 && events.length > 0,
    state: alerts.length ? "findings" : events.length === 0 ? "no-data" : "no-results",
    periodFrom,
    periodTo,
    timeRange,
    analyzedAt: now,
    analyzedLabel: "just now",
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
    return { ok: false, errors: ["This file isn't valid JSON — export the audit log again and retry."] };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, errors: ["The log should be a JSON object with an events list."] };
  }
  if (!Array.isArray(doc.events)) {
    return {
      ok: true,
      unsupported: true,
      errors: ["This file has no events list. Export an audit log with a top-level events array to analyse it."],
    };
  }
  return { ok: true, doc };
}

export function parseActivityFixture(text) {
  return parseRawFixture(text);
}

export function analyzeActivityFixture(text) {
  const p = parseRawFixture(text);
  if (!p.ok || p.unsupported) {
    return { ok: false, errors: p.errors, unsupported: p.unsupported };
  }
  const doc = p.doc;
  const period = doc.period && typeof doc.period === "object" ? doc.period : {};
  const scope = String(doc.scope === "identity" ? "Identity" : doc.scope === "cloud" ? "Cloud" : doc.scope || "");
  const suffix = scope ? " audit" : " audit";
  const origin = stripTags(doc.scopeName) || `${scope || "Cloud + Identity"}${suffix}`;
  const account = String(doc.account || (doc.period && doc.period.account) || "upload");
  const result = analyzeActivityEvents(doc.events, "uploaded", {
    origin,
    account: String(account).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "upload",
    name: doc.fixtureName || (doc.account ? `Audit log — ${doc.account}` : "Uploaded audit log"),
  });
  result.periodFrom = tsOf(period.from) || result.periodFrom;
  result.periodTo = tsOf(period.to) || result.periodTo;
  if (result.periodFrom && result.periodTo) {
    result.timeRange = `${fmtFull(result.periodFrom)} → ${fmtFull(result.periodTo)}`;
  }
  return result;
}

/* ---------- bundled demo sample ---------- */

export function buildDemoActivityEvents() {
  const H = HOUR;
  const D = DAY;
  const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
  return [
    {
      id: "ev-unusual-login",
      ts: isoAgo(11 * H),
      action: "Sign-in",
      actor: "Elena Alvarez",
      actorId: "e-alvarez",
      actorType: "user",
      source: "identity",
      region: "Frankfurt (DE)",
      device: "Unknown browser",
      ip: "203.0.113.87",
      unexpectedRegion: true,
      resource: "identity-console",
      outcome: "success",
    },
    {
      id: "ev-failed-access",
      ts: isoAgo(4 * H),
      action: "Sign-in failure",
      actor: "Billing Agent",
      actorId: "svc-billing-agent",
      actorType: "service",
      source: "identity",
      failedAttempts: 12,
      windowMinutes: 11,
      ip: "198.51.100.9",
      resource: "billing-api",
      outcome: "failure",
    },
    {
      id: "ev-privilege-change",
      ts: isoAgo(30 * H),
      action: "Role change",
      actor: "Marisol Okafor",
      actorId: "mokafor",
      actorType: "user",
      source: "identity",
      privilegeEscalation: true,
      roleAdded: "global-account-admin",
      removedAfterMin: 22,
      approved: false,
      resource: "iam-console",
    },
    {
      id: "ev-sensitive-access",
      ts: isoAgo(38 * H),
      action: "Read objects",
      actor: "Data Pipeline",
      actorId: "svc-data-pipeline",
      actorType: "service",
      source: "cloud",
      sensitive: true,
      unusualAccess: true,
      objectCount: 184,
      session: "unexpected",
      normalAccessPath: "Operations team",
      resource: "orders-db-exports",
    },
    {
      id: "ev-admin-action",
      ts: isoAgo(52 * H),
      action: "Create account",
      actor: "root",
      actorId: "root",
      actorType: "account",
      source: "cloud",
      adminAction: true,
      newAdminAction: true,
      grantedRole: "account-admin",
      resource: "reporting-console",
    },
    {
      id: "ev-normal",
      ts: isoAgo(1 * H),
      action: "Deploy via CI",
      actor: "Emily Tran",
      actorId: "etran",
      actorType: "user",
      source: "identity",
      expected: true,
      outcome: "success",
      resource: "shop-api",
    },
  ];
}

export function buildDemoActivityResult() {
  const events = buildDemoActivityEvents();
  const from = events.length ? Math.min(...events.map((e) => Date.parse(e.ts))) : Date.now();
  const to = events.length ? Math.max(...events.map((e) => Date.parse(e.ts))) : Date.now();
  return analyzeActivityEvents(events, "demo", {
    origin: "Cloud audit · Identity audit (sample)",
    account: "acme-retail",
    name: "Acme Retail audit log (sample)",
    periodFrom: from,
    periodTo: to,
  });
}

export function buildDemoActivityFixture() {
  const events = buildDemoActivityEvents();
  const from = events.length ? Math.min(...events.map((e) => Date.parse(e.ts))) : Date.now();
  const to = events.length ? Math.max(...events.map((e) => Date.parse(e.ts))) : Date.now();
  return {
    version: 1,
    source: "demo-activity",
    scopeName: "Cloud audit · Identity audit",
    account: "acme-retail",
    fixtureName: "Acme Retail audit log (sample)",
    period: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    events,
  };
}

/* Record builder shared by the dashboard health panel and the
   Activity monitoring page, matching the unified connector model. */
export function buildActivityRecord(result, mode) {
  const now = Date.now();
  return {
    id: `act:${result.account || "sample"}`,
    kind: "activity",
    mode,
    name: result.name,
    origin: result.origin,
    account: result.account,
    records: result.records,
    events: result.events,
    alerts: result.alerts,
    normalEvents: result.normalEvents,
    findings: result.findings,
    assets: result.assets,
    rawEvents: result.rawEvents,
    clean: result.clean,
    state: result.state,
    warnings: result.warnings || [],
    skipped: result.skipped || 0,
    periodFrom: result.periodFrom,
    periodTo: result.periodTo,
    timeRange: result.timeRange,
    analyzedAt: result.analyzedAt || now,
    addedAt: now,
    lastScanAt: now,
  };
}