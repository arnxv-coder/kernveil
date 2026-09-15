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
};

export const STATUS_ORDER = {
  open: 0,
  rejected: 1,
  "awaiting-approval": 2,
  approved: 3,
  "in-progress": 4,
  failed: 5,
  completed: 6,
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
  "in-progress": "wip",
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

export function remediationOf(f) {
  if (!f) return null;
  if (f.source === "github-connector") return githubDraft(f);
  if (f.source === "cloud-fixture") return cloudChange(f);
  if (f.source === "website-fixture") return websiteChange(f);
  if (f.source === "backup-fixture") return backupChange(f);
  return genericDraft(f);
}

/* Actions available from each status. `note(plan)` is the audit reason
   recorded alongside the transition. */
const S = (to, label, primary, ghost, note) => ({ to, label, primary, ghost, note });

export const NEXT_ACTIONS = {
  open: [
    S("awaiting-approval", "Submit for approval", true, false, (p) =>
      `${p.glow} ready for review — ${p.title}. Nothing was opened in a real repository or cloud account.`
    ),
    S("in-progress", "Mark in progress", false, false, () => "Started without approval"),
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