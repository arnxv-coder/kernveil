/* ============================================================
   Kernveil — remediation workflow model (Phase 2).
   Canonical status set: Proposed / Awaiting approval / Approved /
   Rejected / In progress / Completed / Failed, plus per-source
   draft plans (GitHub dependency-upgrade PR draft, cloud config
   change). Every draft here is a preview — nothing is opened,
   merged, or applied outside this demo workspace.
   ============================================================ */

export const STATUS_LABEL = {
  open: "Proposed",
  "awaiting-approval": "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  "in-progress": "In progress",
  completed: "Completed",
  failed: "Failed",
  investigating: "Investigating",
  acknowledged: "Acknowledged",
};

export const STATUS_ORDER = {
  open: 0,
  rejected: 1,
  "awaiting-approval": 2,
  approved: 3,
  acknowledged: 4,
  "in-progress": 5,
  failed: 6,
  completed: 7,
};

/* Legacy persisted keys (pre-Phase-2) mapped onto the new set. */
export function normalizeStatus(status) {
  if (STATUS_LABEL[status]) return status;
  if (status === "resolved") return "completed";
  return "open";
}

/* How each canonical status buckets into the overview aggregates. */
export const STATUS_GROUP = {
  open: "open",
  rejected: "open",
  "awaiting-approval": "open",
  approved: "open",
  acknowledged: "open",
  "in-progress": "wip",
  investigating: "wip",
  failed: "open",
  completed: "resolved",
};

function evEntries(evidence) {
  return (evidence || []).map((e) => `${e.key}: ${e.value}`);
}

function stripTags(str) {
  return String(str || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function githubDraft(f) {
  const ev = Object.fromEntries((f.evidence || []).map((e) => [e.key, e.value]));
  const dep = ev.Dependency || "a dependency";
  const version = String(dep).includes("@") ? String(dep).split("@").pop() : "the affected version";
  const safe = ev["Safe version"];
  const patched = safe && safe !== "Not yet released";
  const depSlug = String(dep).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const title = patched ? `chore(deps): bump ${dep} to ${safe}` : `chore(deps): track advisory for ${dep}`;
  return {
    kind: "pr-draft",
    glow: "Dependency upgrade draft",
    title,
    branch: `kernveil/upgrade-${depSlug}`,
    before: [
      `${dep} pinned in ${f.manifest || "the manifest"}`,
      `Lockfile resolves ${dep}@${version}`,
    ],
    after: patched
      ? [`Bump ${dep} to ${safe}`, "Regenerate the lockfile", "Green test run via CI"]
      : ["Watch for a patched release", "Apply it as soon as it publishes"],
    target: f.manifest || "the manifest",
  };
}

function cloudChange(f) {
  const ev = Object.fromEntries((f.evidence || []).map((e) => [e.key, e.value]));
  const resource = ev.Resource || ev.Host || f.asset || "the resource";
  const text = `${f.title} ${f.detected || ""}`.toLowerCase();
  let after;
  if (/unauthenticated writ|public writ/i.test(text)) {
    after = ["Block public writes", "Restrict access to the service role", "Remove internet-facing grants"];
  } else if (/publicly exposed|public read|read access|publicly readable/i.test(text)) {
    after = ["Remove public (AllUsers) grants", "Scope access to the service role", "Verify no public route remains"];
  } else if (/port|reachable from the public internet|cidr|0\.0\.0\.0/i.test(text)) {
    after = ["Restrict the 0.0.0.0/0 rule to the application subnet", "Confirm the workload still connects"];
  } else if (/privilege|admin/i.test(text)) {
    after = ["Scope the role to the exact actions needed", "Replace wildcard actions and resources"];
  } else {
    after = ["Apply the change described in the recommended step", "Re-check to confirm it clears"];
  }
  return {
    kind: "config-change",
    glow: "Config change draft",
    title: `Change for ${resource}`,
    resource,
    before: evEntries(f.evidence),
    after,
    target: resource,
  };
}

function websiteChange(f) {
  const ev = Object.fromEntries((f.evidence || []).map((e) => [e.key, e.value]));
  const rule = f.rule || "website";
  const targets = {
    "https-enforced": {
      title: `Enforce HTTPS for ${f.host || f.asset}`,
      after: ["Redirect all HTTP traffic to HTTPS (301)", "Enable HSTS on the host"],
    },
    "tls-certificate": {
      title: `Renew the certificate for ${f.host || f.asset}`,
      after: ["Confirm the auto-renewal job is enabled", "Renew and verify the new validity window"],
    },
    "security-headers": {
      title: `Add security headers for ${f.host || f.asset}`,
      after: ["Ship a starter CSP header", "Send X-Frame-Options: DENY", "Re-check the headers"],
    },
    spf: {
      title: "Tighten the SPF record",
      after: ["Trim the include list to real senders", "Change the all mechanism to -all"],
    },
    dkim: {
      title: "Fix DKIM signing",
      after: ["Publish a working DKIM key at the advertised selector", "Ensure alignment with the sending domain"],
    },
    dmarc: {
      title: "Enforce the DMARC policy",
      after: ["Move the policy from p=none to p=quarantine", "Escalate to p=reject once reporting is clean"],
    },
  };
  const t = targets[rule] || {
    title: `Apply the recommended change for ${f.host || f.asset}`,
    after: ["Apply the change described in the recommended step", "Re-check to confirm it clears"],
  };
  return {
    kind: "config-change",
    glow: "Website change draft",
    title: t.title,
    resource: f.host || ev.Host || f.asset || "the host",
    before: evEntries(f.evidence),
    after: t.after,
    target: f.host || f.asset,
  };
}

function genericDraft(f) {
  return {
    kind: "generic",
    glow: "Remediation draft",
    title: `Draft proposal for this ${(f.category || "finding").toLowerCase()}`,
    before: f.summary ? [stripTags(f.summary)] : [],
    after: (f.steps || []).slice(0, 2).map(stripTags),
    target: f.asset,
  };
}

function backupChange(f) {
  const ev = Object.fromEntries((f.evidence || []).map((e) => [e.key, e.value]));
  const sys = f.system || f.asset || "the system";
  const rule = f.rule || "no-data";
  const plans = {
    failed: {
      title: `Restore-test and re-run the backup for ${sys}`,
      after: ["Read the recorded failure and fix the job", "Restore-test the latest good point", "Re-run the backup and confirm it clears"],
    },
    missing: {
      title: `Get a first successful backup landed for ${sys}`,
      after: ["Create the backup job honoring the expected schedule", "Run a first backup", "Restore-test it before relying on it"],
    },
    stale: {
      title: `Catch the missed backup up for ${sys}`,
      after: ["Run the pending backup now", "Restore-test the latest good point", "Confirm the next expected backup lands on time"],
    },
    "no-data": {
      title: `Set up backup coverage for ${sys}`,
      after: ["Attach a backup schedule", "Run a first backup and restore-test it", "Confirm the next expected backup lands on time"],
    },
  };
  const t = plans[rule] || plans["no-data"];
  return {
    kind: "config-change",
    glow: "Backup fix draft",
    title: t.title,
    resource: sys,
    before: evEntries(f.evidence),
    after: t.after,
    target: sys,
  };
}

function identityChange(f) {
  const ev = Object.fromEntries((f.evidence || []).map((e) => [e.key, e.value]));
  const acct = f.identity || f.username || f.asset || "the account";
  const rule = f.rule || "no-data";
  const plans = {
    "inactive-user": {
      title: `Remove the dormant account ${acct}`,
      after: ["Confirm with the last-known owner that the account is unused", "Disable the account in the identity provider", "Re-run identity analysis and confirm the record clears"],
    },
    "excessive-permissions": {
      title: `Recertify the privileges on ${acct}`,
      after: ["List the grants attached to the account", "Swap broad grants for least-privilege roles", "Re-run identity analysis and confirm the record clears"],
    },
    "no-mfa": {
      title: `Enroll MFA on ${acct}`,
      after: ["Require multi-factor authentication on the account", "Enroll the authenticator and verify a sign-in demands the second factor", "Re-run identity analysis and confirm the record clears"],
    },
    "suspicious-admin": {
      title: `Review the administrator access on ${acct}`,
      after: ["Check who requested the recent administrator grant", "Revoke the role if it was not intended", "Alert on admin-membership changes, then re-run identity analysis"],
    },
    "no-data": {
      title: `Cover ${acct} with an identity standard`,
      after: ["Define the account standard (MFA, least privilege, retention)", "Scan the directory against it", "Triage accounts that fall short"],
    },
  };
  const t = plans[rule] || plans["no-data"];
  return {
    kind: "config-change",
    glow: "Identity fix draft",
    title: t.title,
    resource: acct,
    before: evEntries(f.evidence),
    after: t.after,
    target: acct,
  };
}

function activityChange(f) {
  const ev = Object.fromEntries((f.evidence || []).map((e) => [e.key, e.value]));
  const rule = f.rule || "unusual-login";
  const who = f.actor || f.identity || f.username || "the actor";
  const what = f.resource || ev.Resource || f.asset || "the resource";
  const plans = {
    "unusual-login": {
      title: `Review the unexpected sign-in for ${who}`,
      after: ["Confirm with the user whether the sign-in was theirs", "Expire the session and rotate the credential if it was not", "Turn on sign-in alerts for new regions"],
    },
    "failed-access": {
      title: `Investigate the repeated failures for ${who}`,
      after: ["Check the attempts against the account owner", "Enforce MFA (or rotate the service-account credential)", "Watch the account; block the source if it continues"],
    },
    "privilege-change": {
      title: `Review the privilege change on ${who}`,
      after: ["Identify who raised the role change and approve or revoke it", "Trim the account back to least privilege", "Alert on future privilege-grant events"],
    },
    "sensitive-access": {
      title: `Review the access to ${what}`,
      after: ["Confirm whether the read was legitimate", "Rotate the identity's credentials if it was not", "Restrict the resource to its normal callers and re-check"],
    },
    "admin-action": {
      title: `Review the admin action on ${what}`,
      after: ["Trace who requested the privileged action", "Undo the change if it was unintended", "Route future admin actions through approval"],
    },
  };
  const t = plans[rule] || {
    title: `Respond to the alert on ${what}`,
    after: (f.steps || []).slice(0, 3).map(stripTags),
  };
  return {
    kind: "config-change",
    glow: "Alert response draft",
    title: t.title,
    resource: what,
    before: evEntries(f.evidence),
    after: t.after,
    target: what,
  };
}

export function remediationOf(f) {
  if (!f) return null;
  if (f.source === "github-connector") return githubDraft(f);
  if (f.source === "cloud-fixture") return cloudChange(f);
  if (f.source === "website-fixture") return websiteChange(f);
  if (f.source === "backup-fixture") return backupChange(f);
  if (f.source === "identity-fixture") return identityChange(f);
  if (f.source === "activity-fixture") return activityChange(f);
  return genericDraft(f);
}

/* Actions available from each status. `note(plan)` is the audit reason
   recorded alongside the transition. `alertOnly` actions appear only on
   suspicious-activity alerts, keeping every other finding's flow exactly
   as it already was. */
const S = (to, label, primary, ghost, note, alertOnly) => ({ to, label, primary, ghost, note, alertOnly });

export const NEXT_ACTIONS = {
  open: [
    S("investigating", "Start investigating", true, false, (p) => `Opened an investigation — ${p.title}. Nothing changed; the audit trail records triage only.`, true),
    S("awaiting-approval", "Submit for approval", true, false, (p) =>
      `${p.glow} ready for review — ${p.title}. Nothing was opened in a real repository or cloud account.`
    ),
    S("acknowledged", "Acknowledge", false, false, () => "Acknowledged — risk noted, investigation not started", true),
    S("in-progress", "Mark in progress", false, false, () => "Started without approval"),
  ],
  investigating: [
    S("acknowledged", "Acknowledge", false, false, () => "Acknowledged while the investigation continues"),
    S("completed", "Mark resolved", true, false, () => "Investigation concluded — activity reviewed and resolved"),
    S("open", "Back to proposed", false, true, () => "Reopened — investigation paused"),
  ],
  acknowledged: [
    S("open", "Reopen", true, false, () => "Reopened for investigation"),
    S("completed", "Mark resolved", false, false, () => "Resolved after acknowledgement"),
  ],
  "awaiting-approval": [
    S("approved", "Approve remediation", true, false, () => "Approved — queued for execution"),
    S("rejected", "Reject proposal", false, false, () => "Proposal rejected"),
    S("open", "Back to proposed", false, true, () => "Withdrawn from approval"),
  ],
  approved: [
    S("in-progress", "Mark in progress", true, false, (p) => `Applying — ${p.title}`),
    S("open", "Back to proposed", false, true, () => "Approval rescinded"),
  ],
  rejected: [
    S("awaiting-approval", "Resubmit for approval", true, false, () => "Resubmitted for approval"),
    S("in-progress", "Proceed manually", false, false, () => "Proceeding without approval"),
  ],
  "in-progress": [
    S("completed", "Mark completed", true, false, () => "Change applied and verified"),
    S("failed", "Mark failed", false, false, () => "Remediation did not clear the check"),
    S("open", "Back to proposed", false, true, () => "Returned to proposed"),
  ],
  completed: [
    S("open", "Reopen finding", true, false, () => "Reopened — monitoring again"),
  ],
  failed: [
    S("in-progress", "Retry remediation", true, false, (p) => `Retrying — ${p.title}`),
    S("open", "Back to proposed", false, true, () => "Returned to proposed"),
  ],
};