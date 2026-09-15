/* ============================================================
   Kernveil — approval-based remediation actions (Phase 8).
   A remediation action is an explicit, reviewable change record
   attached to a finding: permission reductions, security-header
   improvements, and exposed-resource fixes. Every action reuses
   the existing status set (Proposed / Awaiting approval /
   Approved / Rejected / In progress / Completed / Failed) and
   requires explicit approval before anything is queued.

   HONESTY BOUNDARY: Kernveil never applies a change itself. No
   cloud permission, security header, or exposed resource is ever
   modified by this workspace. "Completed" records a change that
   was applied outside Kernveil (or inside the simulated fixture)
   and verified — it is labelled truthfully, never implied.
   ============================================================ */
import { normalizeStatus } from "./remediation.js";

export const KIND_META = {
  "permission-reduction": { label: "Permission reduction", cls: "ra-kind-perm" },
  "security-header": { label: "Security header fix", cls: "ra-kind-hdr" },
  "exposure-fix": { label: "Exposure fix", cls: "ra-kind-exp" },
};

export const EXEC_META = {
  draft: { label: "Draft", note: "Proposal only — nothing has been executed." },
  simulated: { label: "Simulated", note: "Applied inside the simulated fixture world, never a live system." },
  "pending-external": { label: "Pending external change", note: "Real change — Kernveil cannot execute it; your normal change process applies it." },
  "manual-verified": { label: "Manual verification", note: "Applied outside Kernveil by the team and verified. Kernveil itself changed nothing." },
};

const DATA_STATUS_META = {
  demo: { label: "Demo data", note: "Fictional sample data for the interactive preview." },
  "fixture-based": { label: "Fixture-based", note: "Derived from a bundled simulated fixture in this workspace." },
  imported: { label: "Imported", note: "Derived from a file your workspace imported." },
  live: { label: "Live", note: "Backed by a live connected scan." },
};

export function dataStatusMeta(key) {
  return DATA_STATUS_META[key] || DATA_STATUS_META.demo;
}

export function execContextFor(f) {
  if (f && f.demo === true) return "simulated";
  if (f && f.source) return "pending-external";
  return "simulated";
}

export function dataStatusFor(f) {
  if (f && f.demo === true) {
    if (["cloud-fixture", "website-fixture", "backup-fixture", "identity-fixture", "activity-fixture"].includes(f.source)) {
      return "fixture-based";
    }
    return "demo";
  }
  if (f && f.source) return "imported";
  return "demo";
}

function evOf(f) {
  return Object.fromEntries((f.evidence || []).map((e) => [e.key, e.value]));
}

function stripTags(str) {
  return String(str || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function actionSourceLabel(f) {
  if (f && f.demo === true) return "Simulated finding";
  if (f && f.source) return "Imported finding";
  return "Sample finding";
}

function commonFor(f) {
  return {
    dataStatus: dataStatusFor(f),
    executionContext: execContextFor(f),
    source: actionSourceLabel(f),
    createdAt: (f && f.first) || undefined,
  };
}

function startHistory(f, text) {
  return [{ time: f && f.first ? f.first : "Recent", text, c: "var(--slate)" }];
}

/* Which kinds of action a finding can carry, decided from its rule and
   its descriptive text. Everything else stays out of the approval-based
   remit (dependencies, backups, activity alerts, e-mail records, …). */
function kindsFor(f) {
  const text = `${f.title || ""} ${f.detected || ""} ${f.summary || ""} ${f.category || ""} ${f.rule || ""} ${f.id || ""}`.toLowerCase();
  const kinds = [];
  if (/(security header|content-security|x-frame|nosniff|\bcsp\b|\bcors\b|access-control-allow-origin)/.test(text)) {
    kinds.push("security-header");
  }
  if (f.rule === "excessive-permissions" || f.rule === "excessive-privileges" ||
      /(permissiv|excessive|privileg|\biam\b|access policy|write access|public write|admin access|least.?privilege)/.test(text)) {
    kinds.push("permission-reduction");
  }
  if (/(publicly exposed|public read|publicly readable|exposed resource|0\.0\.0\.0|public url|reachable from the public)/.test(text)) {
    kinds.push("exposure-fix");
  }
  return kinds;
}

/* ---------- generic builders for non-seeded (incl. imported) findings ---------- */

function permissionActionFor(f) {
  const ev = evOf(f);
  const subject = f.identity || f.username || ev.Identity || f.asset || "the account";
  const current = ev.Privileges ? stripTags(`${ev.Privileges}`) : "Broad grants far beyond the job this identity performs";
  const scopeText = f.rule === "excessive-permissions"
    ? `Least-privilege role covering exactly the resources ${subject} uses, replacing the recorded grants`
    : "Least-privilege scope covering only the resources the identity genuinely uses";
  return {
    id: `${f.id}::permission-reduction::least-privilege`,
    kind: "permission-reduction",
    status: "open",
    label: `Recertify and narrow the privileges on ${subject}`,
    target: `Policy for ${subject}`,
    currentState: `Current grants: ${current}`,
    proposedState: scopeText,
    securityBenefit: `Shrinks the blast radius of a leaked credential from the full privilege set to the scoped resources ${subject} actually uses.`,
    safeReason: "The change only removes reach beyond what the identity demonstrably needs; every access it currently uses is preserved.",
    operationalImpact: "Any workflow relying on the broad grants fails until its legitimate needs are re-scoped, so the owner should review first.",
    reversal: "Restore the previous grant set in the identity provider. Nothing is deleted.",
    history: startHistory(f, "Action drafted from the identity evidence"),
  };
}

function headerActionFor(f) {
  const ev = evOf(f);
  const host = ev.Host || f.host || f.asset || "the host";
  const current = ev.Missing
    ? `Missing: ${stripTags(ev.Missing)}`
    : ev.ACAO
      ? `Sends ${stripTags(ev.ACAO)} on every response`
      : "Recommended hardening headers are absent";
  return {
    id: `${f.id}::security-header::harden-headers`,
    kind: "security-header",
    status: "open",
    label: `Send hardening security headers on ${host}`,
    target: `Response headers for ${host}`,
    currentState: current,
    proposedState: "A starter Content-Security-Policy plus X-Frame-Options on every response (refined per route)",
    securityBenefit: "Reduces the risk of injected content and clickjacking on the public surface served by this host.",
    safeReason: "A starter CSP only restricts sources the site already loads, and DENY framing stops the site being embedded — low risk to visitors.",
    operationalImpact: "Inline scripts or third-party embeds would need allow-listing; verify the preview build before rollout.",
    reversal: "Remove the headers or relax the CSP — the previous behaviour returns immediately.",
    history: startHistory(f, "Action drafted from the website evidence"),
  };
}

function exposureActionFor(f) {
  const ev = evOf(f);
  const resource = ev.Resource || ev.Host || f.asset || "the resource";
  const current = ev.ACL
    ? stripTags(ev.ACL)
    : ev.Rule
      ? stripTags(ev.Rule)
      : "Exposed beyond its intended audience";
  return {
    id: `${f.id}::exposure-fix::restrict-access`,
    kind: "exposure-fix",
    status: "open",
    label: `Restrict access to ${resource}`,
    target: resource,
    currentState: current,
    proposedState: "Access scoped to the service roles that legitimately use it — no public or internet-wide grant",
    securityBenefit: "Closes the public exposure path so only authorised callers can reach the resource.",
    safeReason: "Only the service roles already observed using the resource are granted access; the change removes internet-wide reach.",
    operationalImpact: "Any other caller that currently relies on the public path would break — the follow-up re-check confirms access still works.",
    reversal: "Re-add the public grant to restore the previous exposure (not recommended). No data is lost.",
    history: startHistory(f, "Action drafted from the exposure evidence"),
  };
}

/* ---------- curated seed actions ---------- */

const SEED_ACTIONS = {
  "publicly-exposed-storage": [
    {
      id: "publicly-exposed-storage::exposure-fix::remove-public-read",
      findingId: "publicly-exposed-storage",
      kind: "exposure-fix",
      status: "awaiting-approval",
      label: "Remove public AllUsers read access on acme-retail-primary",
      target: "acme-retail-primary ACL / bucket policy",
      currentState: "AllUsers:READ on the resource — the public URL answers anyone on the internet",
      proposedState: "Remove the AllUsers grant; read access for the prod-web-01 service role only",
      securityBenefit: "Stops internet-wide downloads of customer backup data immediately — closes the only public read path.",
      safeReason: "prod-web-01 is the only caller observed using this resource; nothing else in the workspace depends on public reads. Removing the grant matches how the resource is actually used.",
      operationalImpact: "Any other tool that reads the resource anonymously would break. The follow-up re-check confirms the service role still has access.",
      reversal: "Re-add the AllUsers grant to restore the prior public state (not recommended). No data is lost either way.",
      source: "Sample finding",
      dataStatus: "demo",
      executionContext: "simulated",
      createdAt: "Aug 28, 2026",
      history: [
        { time: "Aug 28 · 09:14", text: "Action proposed from the finding evidence", c: "var(--slate)" },
        { time: "Sep 02 · 10:05", text: "Submitted for approval — awaiting a decision", c: "var(--amber)" },
      ],
    },
  ],
  "permissive-access-policy": [
    {
      id: "permissive-access-policy::permission-reduction::narrow-billing-scope",
      findingId: "permissive-access-policy",
      kind: "permission-reduction",
      status: "open",
      label: "Restrict the billing-app service-account policy to its two billing prefixes",
      target: "Policy for the arn:svc:billing-app service account",
      currentState: "s3:PutObject on arn:…:bucket/* — wildcard write across the whole storage estate",
      proposedState: "s3:PutObject on arn:…:bucket:billing/invoice-export/* and arn:…:bucket:billing/receipts/* only",
      securityBenefit: "A leaked credential can only reach the two billing prefixes instead of the whole storage estate — the blast radius shrinks to what the app genuinely writes.",
      safeReason: "Current runs only write invoice exports and receipts, so the narrowed policy maps exactly to existing behaviour with no new failure surface.",
      operationalImpact: "Any write outside the two prefixes fails with AccessDenied. Monitor logs for a few days after the change ships.",
      reversal: "Re-add the wildcard statement to the policy; the previous behaviour returns. Nothing is deleted.",
      source: "Sample finding",
      dataStatus: "demo",
      executionContext: "simulated",
      createdAt: "Sep 01, 2026",
      history: [
        { time: "Sep 01 · 13:47", text: "Action drafted from the identity evidence", c: "var(--slate)" },
      ],
    },
  ],
  "missing-security-headers": [
    {
      id: "missing-security-headers::security-header::add-csp-framing",
      findingId: "missing-security-headers",
      kind: "security-header",
      status: "awaiting-approval",
      label: "Send Content-Security-Policy and X-Frame-Options on acme.com",
      target: "Response headers for acme.com",
      currentState: "Responses send no CSP and no X-Frame-Options",
      proposedState: "CSP default-src 'self' (refined per route) + X-Frame-Options: DENY on every response",
      securityBenefit: "Reduces the risk of injected content and clickjacking on the public marketing site.",
      safeReason: "A starter CSP only restricts sources the site already loads, and DENY framing matches the site being displayed directly rather than embedded. Risk to visitors is minimal.",
      operationalImpact: "Inline scripts or third-party embeds would need allow-listing; run the preview build before rollout and watch for console warnings.",
      reversal: "Remove the headers or relax the CSP — the previous behaviour returns immediately.",
      source: "Sample finding",
      dataStatus: "demo",
      executionContext: "simulated",
      createdAt: "Sep 02, 2026",
      history: [
        { time: "Sep 02 · 12:18", text: "Action drafted from the website evidence", c: "var(--slate)" },
      ],
    },
  ],
  "repo-permissions": [
    {
      id: "repo-permissions::permission-reduction::require-review",
      findingId: "repo-permissions",
      kind: "permission-reduction",
      status: "approved",
      label: "Require review and disable force-push on acme/cms-admin",
      target: "acme/cms-admin repository settings",
      currentState: "Public users can open PRs and merge on approval; merge guard off; force-push allowed",
      proposedState: "Write access restricted to maintainers; one approving review required; force-push disabled",
      securityBenefit: "Closes the supply-chain route where an accepted PR could ship malicious code to the CMS admin.",
      safeReason: "Maintainers keep their current abilities; the change only adds a review barrier for unapproved pushes. The repo was already set to private.",
      operationalImpact: "Outside contributors may wait for a review before merging — the merge queue may slow slightly for them.",
      reversal: "Revert the repository settings in the connector; the previous access returns.",
      source: "Sample finding",
      dataStatus: "demo",
      executionContext: "simulated",
      createdAt: "Aug 26, 2026",
      history: [
        { time: "Aug 26 · 08:50", text: "Action proposed from the repository evidence", c: "var(--slate)" },
        { time: "Sep 07 · 16:12", text: "Approved — queued for execution (nothing applied yet)", c: "var(--cyan)" },
      ],
    },
  ],
  "staging-cors-open": [
    {
      id: "staging-cors-open::security-header::restrict-cors-origin",
      findingId: "staging-cors-open",
      kind: "security-header",
      status: "completed",
      label: "Restrict Access-Control-Allow-Origin on staging-web-02 to the staging origin",
      target: "staging-web-02 CORS header",
      currentState: "Access-Control-Allow-Origin: * on every staging response",
      proposedState: "Access-Control-Allow-Origin: https://staging.acme.app only",
      securityBenefit: "Stops any website from reading staging API responses cross-origin.",
      safeReason: "The staging app only calls its own origin, so the restriction matches the current caller set with no expected breakage.",
      operationalImpact: "Any tool that reads staging responses from another origin would need a header update.",
      reversal: "Clear the origin restriction to return to Allow-Origin: *.",
      source: "Sample finding",
      dataStatus: "demo",
      executionContext: "manual-verified",
      createdAt: "Aug 12, 2026",
      history: [
        { time: "Aug 12 · 08:00", text: "Action proposed from the CORS evidence", c: "var(--slate)" },
        { time: "Sep 07 · 16:25", text: "Approved to fix during the sprint", c: "var(--cyan)" },
        { time: "Sep 08 · 11:40", text: "Change applied outside Kernveil by the team and verified — Kernveil itself changed nothing", c: "var(--green)" },
      ],
    },
  ],
  "open-db-port": [
    {
      id: "open-db-port::exposure-fix::restrict-subnet",
      findingId: "open-db-port",
      kind: "exposure-fix",
      status: "rejected",
      label: "Restrict inbound 5432 on db-main to the application subnet",
      target: "db-main firewall rules (10.0.6.22:5432)",
      currentState: "Inbound 0.0.0.0/0 · TCP:5432 — anyone can attempt connections",
      proposedState: "Inbound TCP:5432 from 10.0.20.0/24 (application subnet) only",
      securityBenefit: "Stops internet-wide connection attempts to the database; only the app subnet can reach it.",
      safeReason: "The app servers live in 10.0.20.0/24 and are the only observed callers of the database. The restricted rule preserves that path.",
      operationalImpact: "Ad-hoc admin access from outside the subnet (e.g. a laptop not on the VPN) would need a temporary rule during DB maintenance.",
      reversal: "Re-add the 0.0.0.0/0 rule to restore the previous state.",
      source: "Sample finding",
      dataStatus: "demo",
      executionContext: "simulated",
      createdAt: "Aug 30, 2026",
      history: [
        { time: "Aug 30 · 11:22", text: "Action proposed from the port evidence", c: "var(--slate)" },
        { time: "Aug 31 · 09:00", text: "Submitted for approval", c: "var(--amber)" },
        { time: "Sep 03 · 14:20", text: "Rejected — the team chose a narrower allow-list approach instead", c: "var(--slate)" },
      ],
    },
    {
      id: "open-db-port::exposure-fix::ip-allowlist",
      findingId: "open-db-port",
      kind: "exposure-fix",
      status: "failed",
      label: "Attach an IP allow-list to db-main port 5432",
      target: "db-main network policy",
      currentState: "No allow-list; port 5432 open to 0.0.0.0/0",
      proposedState: "Allow-list restricting 5432 to the 10.0.20.0/24 application subnet",
      securityBenefit: "Only known app-server IPs can reach the database port.",
      safeReason: "Allow-lists only block traffic outside the approved range; the app subnet is inside it.",
      operationalImpact: "New app servers must be added to the allow-list before they can reach the database.",
      reversal: "Remove the allow-list to restore the previous rule.",
      source: "Sample finding",
      dataStatus: "demo",
      executionContext: "simulated",
      createdAt: "Sep 09, 2026",
      history: [
        { time: "Sep 04 · 10:10", text: "Action proposed (follow-up after rejection)", c: "var(--slate)" },
        { time: "Sep 06 · 16:30", text: "Approved and marked in progress", c: "var(--cyan)" },
        { time: "Sep 09 · 09:50", text: "Verification re-check still sees 0.0.0.0/0 — marked failed; retry or re-propose", c: "var(--orange)" },
      ],
    },
  ],
};

/* ---------- eligibility + action list ---------- */

const BUILDERS = {
  "permission-reduction": permissionActionFor,
  "security-header": headerActionFor,
  "exposure-fix": exposureActionFor,
};

export function baseActionsFor(f) {
  if (!f) return { eligible: false, actions: [], reason: "" };
  if (normalizeStatus(f.status) === "completed") {
    return { eligible: false, actions: [], reason: "This finding is already completed — there is nothing left to remediate." };
  }
  const seeded = SEED_ACTIONS[f.id];
  if (seeded) return { eligible: true, actions: seeded.map((a) => ({ ...a })) };

  const kinds = kindsFor(f);
  if (!kinds.length) {
    let reason = "";
    if (f.category === "Dependencies") {
      reason = "Dependency upgrades run through the dependency-draft flow, not the approval-based action queue.";
    } else if (f.source === "backup-fixture") {
      reason = "Backup issues are addressed through the backup-fix drafts, not the approval-based action queue.";
    } else if (f.source === "activity-fixture") {
      reason = "Activity alerts are handled through the alert-response drafts, not the approval-based action queue.";
    }
    return { eligible: false, actions: [], reason };
  }

  const actions = kinds
    .map((k) => BUILDERS[k](f))
    .filter(Boolean)
    .map((a) => ({
      ...commonFor(f),
      ...a,
    }));
  if (!actions.length) return { eligible: false, actions: [], reason: "" };
  return { eligible: true, actions };
}

/* ---------- transitions ---------- */

const A = (to, label, primary, ghost, note, confirm) => ({ to, label, primary, ghost, note, confirm });

export const ACTION_NEXT = {
  open: [
    A("awaiting-approval", "Submit for approval", true, false, (action) => `${action.label} submitted for approval. Kernveil changed nothing.`),
  ],
  "awaiting-approval": [
    A("approved", "Approve", true, false, (action) => `Approved — ${action.label}. Queued for execution; nothing has changed yet.`, "approve"),
    A("rejected", "Reject", false, false, (action) => `Action rejected — ${action.label}. The proposal was not approved.`),
    A("open", "Withdraw", false, true, (action) => `Withdrawn from approval — ${action.label}.`),
  ],
  approved: [
    A("in-progress", "Mark in progress", true, false, (action) => `Execution started — ${action.label}.`),
    A("open", "Back to proposed", false, true, (action) => `Approval rescinded — ${action.label} returned to proposed.`),
  ],
  rejected: [
    A("awaiting-approval", "Resubmit", true, false, (action) => `Resubmitted for approval — ${action.label}.`),
  ],
  "in-progress": [
    A("completed", "Mark completed", true, false, (action) => `Completed — ${action.label}. Applied outside Kernveil and verified; Kernveil itself changed nothing.`, "complete"),
    A("failed", "Mark failed", false, false, (action) => `Marked failed — ${action.label}. The verification re-check did not clear.`),
  ],
  completed: [
    A("open", "Reopen action", true, false, (action) => `Action reopened — ${action.label}. Monitoring again.`),
  ],
  failed: [
    A("in-progress", "Retry", true, false, (action) => `Retrying — ${action.label}.`),
    A("open", "Back to proposed", false, true, (action) => `Returned to proposed — ${action.label}.`),
  ],
};

/* ---------- primary (queued/attention) action + notification helper ---------- */

const PRIMARY_ORDER = { approved: 0, "awaiting-approval": 1, "in-progress": 2, failed: 3, rejected: 4, open: 5 };

export function primaryActionFor(f, list) {
  const mine = (list || []).filter((a) => a.findingId === f.id && a.status !== "completed");
  if (!mine.length) return null;
  return mine.slice().sort((a, b) => (PRIMARY_ORDER[a.status] ?? 9) - (PRIMARY_ORDER[b.status] ?? 9))[0];
}

/* Approved actions are the only ones surfaced inside notification
   previews — queued and genuinely waiting to run. */
export function approvedQueued(f) {
  const a = f && f.primaryAction;
  if (!a || a.status !== "approved" || !a.label) return null;
  return { label: a.label, target: a.target || "", status: a.status };
}