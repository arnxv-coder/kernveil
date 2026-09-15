/* ============================================================
   Kernveil — identity-provider analysis model (Phase 6).
   A directory review derived entirely from a fixture in this
   browser (bundled sample or uploaded JSON export). Every record
   carries its role, MFA state, last sign-in, and admin history;
   the engine derives a standard (healthy / dormant account /
   excessive privileges / missing MFA / suspicious admin) and turns
   anything risky into a standard tracked finding. HONESTY BOUNDARY:
   nothing here ever connects to a live identity provider, and no
   account, MFA, or privilege is ever changed. Labels stay honest.
   ============================================================ */

export const SOURCE_LABEL = "Identity audit";
export const CATEGORY = "Identity";

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

function fmtDay(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

function fmtRel(ts) {
  const t = tsOf(ts);
  if (!t) return "Never";
  const diff = Date.now() - t;
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))} min ago`;
  if (diff < DAY) return `${Math.max(1, Math.round(diff / HOUR))} h ago`;
  return `${Math.max(1, Math.round(diff / DAY))} d ago`;
}

function tsOf(value) {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function ageDays(value) {
  const t = tsOf(value);
  return t ? (Date.now() - t) / DAY : null;
}

function slugId(id) {
  return String(id || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "identity";
}

function stripTags(str) {
  return String(str || "").replace(/<[^>]*>/g, "");
}

export const IDP_STATE_META = {
  healthy: { label: "Standards met", cls: "badge-green", dot: "var(--green)" },
  "inactive-user": { label: "Dormant account", cls: "badge-amber", dot: "var(--amber)" },
  "excessive-permissions": { label: "Excessive privileges", cls: "badge-orange", dot: "var(--orange)" },
  "no-mfa": { label: "Missing MFA", cls: "badge-orange", dot: "var(--orange)" },
  "suspicious-admin": { label: "Suspicious admin", cls: "badge-red", dot: "var(--red)" },
};

const STATE_META = IDP_STATE_META;

const SEVERITY_OF_STATE = {
  "inactive-user": "medium",
  "excessive-permissions": "high",
  "no-mfa": "high",
  "suspicious-admin": "high",
};

const IMPACT_OF_STATE = {
  "inactive-user": "Dormant account — standing entry point",
  "excessive-permissions": "Wider compromise blast radius",
  "no-mfa": "Credential-guessing exposure",
  "suspicious-admin": "Unexplained privileged access",
};

const TITLE_OF_STATE = {
  "inactive-user": (name) => `Dormant account — ${name}`,
  "excessive-permissions": (name) => `Excessive permissions — ${name}`,
  "no-mfa": (name) => `Account without multi-factor authentication — ${name}`,
  "suspicious-admin": (name) => `Unexpected administrator access — ${name}`,
};

const SUMMARY_OF_STATE = {
  "inactive-user": (days) => `Enabled account unused for ${days} days`,
  "excessive-permissions": "Privileges far beyond the job the identity performs",
  "no-mfa": "No multi-factor authentication on a privileged identity",
  "suspicious-admin": "Unapproved administrator access granted recently",
};

const typeLabelOf = (t) =>
  t === "service" ? "Service account" : t === "role" ? "Role" : "User";

const PRIV_RX = /(global[\s-]*admin|full[\s-]*access|iam:full|account.*administrator|:delete|deleteobject|deletebucket|\bon\s+all\b|\*)/i;

function hasOverPrivilege(rec) {
  if (rec.admin === true && rec.type === "service") return true;
  return Array.isArray(rec.privileges) && rec.privileges.some((p) => PRIV_RX.test(String(p)));
}

export function identityState(r) {
  const adminDays = ageDays(r.adminGrantedAt);
  if (r.admin === true && r.adminGrantedAt && adminDays !== null && adminDays <= 30 &&
      (r.adminApproved === false || r.unexpectedSignIn === true)) {
    return "suspicious-admin";
  }
  if (r.mfa === false && (r.admin === true || r.type === "service")) return "no-mfa";
  if (hasOverPrivilege(r)) return "excessive-permissions";
  const idle = ageDays(r.lastLogin);
  const born = ageDays(r.created);
  if (r.enabled !== false && ((r.lastLogin && idle !== null && idle >= 180) || (!r.lastLogin && born !== null && born >= 90))) {
    return "inactive-user";
  }
  return "healthy";
}

/* Derive one identity record from a raw export entry. */
function deriveIdentity(raw, mode, meta = {}) {
  const id = String(raw && raw.id != null ? raw.id : "").trim();
  const name = stripTags(raw && (raw.name || raw.username || meta.resolveName && meta.resolveName(raw))) || "Unnamed identity";
  const username = stripTags(raw && raw.username) || id;
  const email = stripTags(raw && raw.email) || "";
  const type = String(raw && raw.type) || "user";
  const role = stripTags(raw && raw.role) || "—";
  const admin = raw && raw.admin === true;
  const mfa = raw && raw.mfa === true;
  const enabled = raw && raw.enabled !== false;
  const privileges = Array.isArray(raw && raw.privileges) ? raw.privileges.map((p) => stripTags(p)).filter(Boolean) : [];
  const state = identityState({
    admin,
    type,
    mfa,
    enabled,
    privileges,
    lastLogin: raw && raw.lastLogin,
    created: raw && raw.created,
    adminGrantedAt: raw && raw.adminGrantedAt,
    adminApproved: raw && raw.adminApproved,
    unexpectedSignIn: raw && raw.unexpectedSignIn,
  });
  const severity = SEVERITY_OF_STATE[state] || "healthy";
  const lastLoginAt = tsOf(raw && raw.lastLogin);
  const lastLoginLabel = state === "inactive-user" && lastLoginAt ? fmtRel(lastLoginAt) : lastLoginAt ? fmtRel(lastLoginAt) : "Never";
  const createdLabel = tsOf(raw && raw.created) ? fmtDay(raw && raw.created) : "—";
  const grantedAt = tsOf(raw && raw.adminGrantedAt);
  const grantedLabel = grantedAt ? fmtRel(grantedAt) : null;
  const display = username ? `${name} · ${username}` : name;

  const evidenceBase = [
    { key: "Identity", value: display },
    { key: "Type", value: typeLabelOf(type) },
    { key: "Role", value: role },
    { key: "Member of account", value: meta.provider || "directory export" },
  ];

  let why = "";
  let detected = "";
  let steps = [];
  const evidence = evidenceBase.slice();
  if (state === "inactive-user") {
    const days = lastLoginAt ? Math.max(1, Math.round(ageDays(raw.lastLogin))) : Math.max(1, Math.round(ageDays(raw.created)));
    evidence.push({ key: "Last sign-in", value: lastLoginLabel });
    evidence.push({ key: "Account enabled", value: enabled ? "Yes" : "No" });
    why = `An enabled account that nobody has used in ${days} days is a standing entry point: if its password was ever leaked, nothing reminds anyone to notice the sign-in, and no owner is present to spot unusual behaviour. Deactivating or removing it shrinks the number of accounts an attacker could aim at.`;
    detected = `The directory shows <code>${name}</code> (<code>${username}</code>) last signed in ${lastLoginLabel}. The account is still enabled and keeps its enrolled memberships.`;
    steps = [
      `Confirm ${username} no longer needs access — check with its last-known owner.`,
      "Disable the account (or remove it) in the identity provider.",
      "Re-run identity analysis to confirm the record clears.",
    ];
  } else if (state === "excessive-permissions") {
    evidence.push({ key: "Privileges", value: privileges.length ? privileges.join(", ") : "global-account-admin (standing)" });
    evidence.push({ key: "Missing MFA", value: mfa ? "No" : "Yes" });
    why = `This identity carries far more reach than its job uses${admin ? ", including administrator privileges" : ""}. If its credential is ever compromised, the blast radius is that whole privilege set rather than a narrow scope. Least-privilege keeps a single leaked credential from becoming a full-account takeover.`;
    detected = `The directory grants <code>${name}</code> privileges beyond a normal role: <code class='bad'>${stripTags(privileges.join(", ")) || "global-account-admin"}</code>.`;
    steps = [
      `List the grants attached to ${username} and compare them with the job function.`,
      "Replace the broad grants with least-privilege roles covering exactly the resources used.",
      "Re-run identity analysis to confirm the identity now meets the standards.",
    ];
  } else if (state === "no-mfa") {
    evidence.push({ key: "MFA enrolled", value: "No" });
    evidence.push({ key: "Administrator", value: admin ? "Yes" : "No" });
    evidence.push({ key: "Last sign-in", value: lastLoginLabel });
    why = `A single password separates an attacker from this identity${admin ? " — and it carries administrator privileges, the highest-value target in the directory" : ""}. MFA adds a second factor, so a stolen or guessed password alone is no longer enough to sign in. High-value accounts are the ones targeted first.`;
    detected = `The directory records <code>${name}</code> (${admin ? "administrator" : typeLabelOf(type)}) with no multi-factor authentication enrolled.`;
    steps = [
      `Require MFA on ${username} in the identity provider.`,
      "Enroll the authenticator and verify a sign-in now demands the second factor.",
      "Re-run identity analysis to confirm the record clears.",
    ];
  } else if (state === "suspicious-admin") {
    const approvalNote = raw && raw.adminApproved === false ? " without any approval record" : "";
    const regionNote = raw && raw.unexpectedSignIn === true ? ", and the account has since signed in from an unexpected region" : "";
    evidence.push({ key: "Administrator", value: "Yes" });
    evidence.push({ key: "Admin granted", value: grantedLabel || "—" });
    evidence.push({ key: "Approval recorded", value: raw && raw.adminApproved === false ? "No" : "Yes" });
    evidence.push({ key: "Unexpected region sign-in", value: raw && raw.unexpectedSignIn === true ? "Yes" : "No" });
    evidence.push({ key: "Last sign-in", value: lastLoginLabel });
    why = `Administrator access appeared recently on an account that did not hold it before${approvalNote}${regionNote}. Because the grant is recent, unexplained, and unapproved, it should be reviewed before relying on it — a compromised or unauthorised administrator can change policies, reset credentials, and read anything.`;
    detected = `The directory granted administrator access to <code>${name}</code> ${grantedLabel || "recently"}${approvalNote}${regionNote}.`;
    steps = [
      "Review who requested the administrator grant and whether it was intended.",
      "If it was not intended, revoke the administrator role from " + username + " now.",
      "Turn on alerts for administrator-membership changes, then re-run identity analysis.",
    ];
  }

  evidence.push({ key: "Data type", value: "directory export" });
  evidence.push({ key: "Analysed", value: "just now" });

  return {
    id,
    name,
    username,
    email,
    display,
    type,
    typeLabel: typeLabelOf(type),
    role,
    env: "Production",
    admin,
    mfa,
    enabled,
    privileges,
    state,
    severity,
    issue: state !== "healthy",
    lastLoginAt,
    lastLoginLabel,
    createdLabel,
    grantedLabel,
    why,
    summary: SUMMARY_OF_STATE[state] ? (typeof SUMMARY_OF_STATE[state] === "function" ? SUMMARY_OF_STATE[state](Math.max(1, Math.round(ageDays(raw.lastLogin) || ageDays(raw.created) || 1))) : SUMMARY_OF_STATE[state]) : "",
    detected,
    impact: IMPACT_OF_STATE[state] || "",
    steps,
    evidence,
    raw,
  };
}

/* Full analysis of a raw identity export. `meta` carries the
   provider/account name used by record + finding builders. */
export function analyzeIdentities(rawIdentities, mode, meta = {}) {
  const list = Array.isArray(rawIdentities) ? rawIdentities : [];
  let skipped = 0;
  const identities = [];
  for (const r of list) {
    if (!r || typeof r !== "object" || r.id == null || String(r.id).trim() === "") {
      skipped += 1;
      continue;
    }
    identities.push(deriveIdentity(r, mode, meta));
  }

  const now = Date.now();
  const findings = identities
    .filter((s) => s.issue)
    .map((s) => ({
      id: `idp:${s.id}:${s.state}`,
      title: TITLE_OF_STATE[s.state](s.name),
      severity: s.severity,
      category: CATEGORY,
      status: "open",
      asset: `id:${slugId(s.id)}`,
      first: fmtDay(now),
      last: "just now",
      summary: s.summary,
      detected: s.detected,
      why: s.why,
      impact: s.impact,
      evidence: s.evidence,
      steps: s.steps,
      related: ["identity-provider", `id:${slugId(s.id)}`],
      history: [
        {
          time: fmtStamp(now),
          text: mode === "demo" ? "Identified during identity analysis — bundled sample directory (simulated data)." : "Identified during identity analysis — from the directory export you uploaded.",
          c: "var(--amber)",
        },
      ],
      source: "identity-fixture",
      demo: mode === "demo",
      rule: s.state,
      identity: s.name,
      username: s.username,
      fixture: meta.name || null,
    }));

  const assets = identities.map((s) => ({
    id: `id:${slugId(s.id)}`,
    name: s.display,
    type: "identity",
    env: s.env,
    source: SOURCE_LABEL,
    risk: s.severity,
    last: "just now",
    host: s.email || s.username || s.name,
  }));

  const warnings = [];
  if (mode === "demo") {
    warnings.push("Bundled sample — this is simulated identity data, not a live identity provider.");
  }
  if (skipped > 0) {
    warnings.push(`${skipped} entr${skipped === 1 ? "y was" : "ies were"} skipped (missing an id).`);
  }
  if (identities.length === 0) {
    warnings.push("The directory export contained no identities — nothing to evaluate.");
  }
  if (findings.length === 0 && identities.length > 0) {
    warnings.push("Every identity meets the standards — the directory is clean.");
  }

  return {
    ok: true,
    mode,
    provider: meta.provider || (identities[0] ? "Directory export" : "Directory export"),
    account: meta.account || "upload",
    name: meta.name || (identities[0] ? `Identity directory — ${meta.account || identities[0].username}` : "Identity directory export"),
    fixtureName: meta.name || null,
    records: identities.length,
    identities,
    rawIdentities: list.slice(),
    findings,
    assets,
    skipped,
    warnings,
    clean: findings.length === 0,
    state: findings.length ? "findings" : identities.length === 0 ? "no-data" : "healthy",
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
    return { ok: false, errors: ["This file isn't valid JSON — export the directory again and retry."] };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, errors: ["The export should be a JSON object with an identities list."] };
  }
  if (!Array.isArray(doc.identities)) {
    return { ok: false, errors: ["The export is missing an identities list — add a top-level identities array."] };
  }
  return { ok: true, doc };
}

export function parseIdentityFixture(text) {
  return parseRawFixture(text);
}

export function analyzeIdentityFixture(text) {
  const p = parseRawFixture(text);
  if (!p.ok) {
    return { ok: false, errors: p.errors };
  }
  const doc = p.doc;
  const provider = stripTags(doc.provider) || "Directory export";
  const account = String(doc.account || (doc.identities[0] && doc.identities[0].username) || "upload");
  const result = analyzeIdentities(doc.identities, "uploaded", {
    provider,
    account: String(account).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "upload",
    name: doc.fixtureName || (doc.account ? `Identity directory — ${doc.account}` : "Uploaded identity directory"),
  });
  return result;
}

/* ---------- bundled demo sample ---------- */

export function buildDemoIdentities() {
  const H = HOUR;
  const D = DAY;
  const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
  return [
    {
      id: "u-dwhitfield",
      name: "Dana Whitfield",
      username: "dwhitfield",
      email: "dwhitfield@acme.example",
      type: "user",
      role: "Support · internal tools",
      admin: false,
      mfa: true,
      enabled: true,
      created: isoAgo(900 * D),
      lastLogin: isoAgo(320 * D),
    },
    {
      id: "svc-orders-api",
      name: "Orders API",
      username: "svc-orders-api",
      email: "svc-orders-api@acme.example",
      type: "service",
      role: "Payments integration",
      admin: false,
      mfa: true,
      enabled: true,
      created: isoAgo(600 * D),
      lastLogin: isoAgo(1 * D),
      privileges: ["s3:DeleteObject on all buckets", "iam:FullAccess", "global-account-admin"],
    },
    {
      id: "u-pmehta",
      name: "Priya Mehta",
      username: "pmehta",
      email: "pmehta@acme.example",
      type: "user",
      role: "Cloud platform admin",
      admin: true,
      mfa: false,
      enabled: true,
      created: isoAgo(400 * D),
      lastLogin: isoAgo(2 * H),
    },
    {
      id: "u-mreed",
      name: "Marcus Reed",
      username: "mreed",
      email: "mreed@acme.example",
      type: "user",
      role: "Support",
      admin: true,
      mfa: true,
      enabled: true,
      created: isoAgo(600 * D),
      lastLogin: isoAgo(20 * H),
      adminGrantedAt: isoAgo(6 * D),
      adminApproved: false,
      unexpectedSignIn: true,
    },
    {
      id: "u-etran",
      name: "Emily Tran",
      username: "etran",
      email: "etran@acme.example",
      type: "user",
      role: "Engineering",
      admin: false,
      mfa: true,
      enabled: true,
      created: isoAgo(350 * D),
      lastLogin: isoAgo(4 * H),
    },
  ];
}

export function buildDemoIdentityResult() {
  return analyzeIdentities(buildDemoIdentities(), "demo", {
    provider: "Okta (sample)",
    account: "acme-retail-okta",
    name: "Acme Retail identity directory (sample)",
  });
}

export function buildDemoIdentityFixture() {
  return {
    version: 1,
    source: "demo-identity",
    provider: "Okta (sample)",
    account: "acme-retail-okta",
    fixtureName: "Acme Retail identity directory (sample)",
    identities: buildDemoIdentities(),
  };
}

/* Record builder shared by the Connectors page and the Identity
   analysis page, matching the unified connector model. */
export function buildIdentityRecord(result, mode) {
  const now = Date.now();
  return {
    id: `idp:${result.account || "sample"}`,
    kind: "identity",
    mode,
    name: result.name,
    provider: result.provider,
    account: result.account,
    records: result.records,
    identities: result.identities,
    findings: result.findings,
    assets: result.assets,
    rawIdentities: result.rawIdentities,
    clean: result.findings.length === 0,
    state: result.state,
    warnings: result.warnings || [],
    skipped: result.skipped || 0,
    addedAt: now,
    lastScanAt: now,
  };
}