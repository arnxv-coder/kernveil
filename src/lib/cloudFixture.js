/* ============================================================
   Kernveil — cloud exposure fixture engine (client-side).
   Interprets an uploaded scan fixture (a JSON report, uploadable
   by the user) into Kernveil assets and findings. No live cloud
   credentials are ever involved — the fixture is the single
   source of truth and is parsed entirely in the browser.

   A bundled "demo fixture" exists so the flow is believable when
   no file is handy; it is always clearly labelled as a simulation.
   ============================================================ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_COLOR = { critical: "var(--red)", high: "var(--orange)", medium: "var(--amber)", low: "var(--slate)" };

export const SOURCE_LABEL = "Cloud audit";

/* ---------- rule catalog ---------- */

export const RULES = {
  "storage-public-read": {
    title: "Publicly exposed storage resource",
    category: "Exposure",
    assetType: "storage",
    severity: "critical",
    impact: "Sensitive data at rest",
    why: "Anyone on the internet can read (and sometimes write) the data this resource holds. For backup and archive data this is a direct data breach path.",
    steps: [
      "Remove the public grant in the resource's access-control list or bucket policy.",
      "Attach the key to the service role that actually consumes it.",
      "Verify the public URL now returns access-denied, then re-check.",
    ],
  },
  "db-open-port": {
    title: "Open database port on shared host",
    category: "Configuration",
    assetType: "database",
    severity: "high",
    impact: "Data exposure",
    why: "A database that accepts connections from the whole internet is exposed to credential guessing and any flaw in the client library. It should only accept traffic from your application subnets.",
    steps: [
      "Open the security-group or firewall rule for this host.",
      "Remove the 0.0.0.0/0 rule and allow only your application subnet.",
      "Confirm the app still connects, then re-check.",
    ],
  },
  "iam-overprivileged": {
    title: "Overly permissive access policy",
    category: "Identity",
    assetType: "identity",
    severity: "medium",
    impact: "Wider compromise blast radius",
    why: "If this credential is ever leaked, the blast radius is far wider than the application needs. Narrowing the policy limits what a compromise could touch.",
    steps: [
      "Restrict the policy to the exact resources and actions the role uses.",
      "Split read and write roles so a leak cannot modify data.",
    ],
  },
};

export function isKnownRule(rule) {
  return Object.prototype.hasOwnProperty.call(RULES, rule);
}

/* ---------- helpers ---------- */

export function cloudAssetId(account, resource) {
  return `cloud:${account || "unknown"}:${resource}`;
}

export function cloudFindingId(account, rule, resource) {
  return `cloud:${account || "unknown"}:${rule}:${resource}`;
}

function stripTags(html) {
  return String(html || "").replace(/<[^>]+>/g, "").trim();
}

function fmtLongDate(ts) {
  if (!ts) return "Imported scan";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Imported scan";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function toEvidenceList(obj) {
  return Object.entries(obj || {}).map(([key, value]) => ({
    key,
    value: typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value),
  }));
}

/* ---------- asset + finding shaping ---------- */

function buildAsset(record, fixture) {
  const rule = RULES[record.rule];
  const id = cloudAssetId(fixture.account, record.resource);
  return {
    id,
    name: record.resource,
    type: rule.assetType,
    env: "Production",
    source: SOURCE_LABEL,
    risk: record.severity || rule.severity,
    last: "just now",
    host: record.evidence && (record.evidence.host || record.evidence.Host)
      ? String(record.evidence.host || record.evidence.Host)
      : record.region
        ? `${record.region} · ${record.service || fixture.provider || "Cloud"}`
        : `${fixture.account} · ${record.rule}`,
  };
}

function buildFinding(record, fixture, mode) {
  const rule = RULES[record.rule];
  const severity = record.severity || rule.severity;
  const assetId = cloudAssetId(fixture.account, record.resource);
  const scanned = fixture.scannedAt ? new Date(fixture.scannedAt) : new Date();
  const now = new Date();

  const why = record.why || rule.why || rule.what;
  const steps = [];
  if (record.action) {
    steps.push(`Apply the fix in the cloud console: ${record.action}`);
  }
  steps.push(...(rule.steps || []).map((s) => s.replace("{resource}", `<code>${record.resource}</code>`)));

  const evidence = toEvidenceList(record.evidence);
  evidence.push({ key: "Rule", value: record.rule });
  if (record.region) evidence.push({ key: "Region", value: record.region });

  return {
    id: cloudFindingId(fixture.account, record.rule, record.resource),
    title: rule.title,
    severity,
    category: rule.category,
    asset: assetId,
    status: "open",
    first: fmtLongDate(scanned),
    last: "just now",
    summary: record.summary || stripTags(record.description || rule.title) || `${rule.title} on ${record.resource}.`,
    detected: record.description || `The fixture reports <code>${record.resource}</code> against the ${record.rule} rule.`,
    why,
    impact: record.impact || rule.impact,
    evidence,
    steps,
    related: [assetId],
    history: [
      { time: `${MONTHS[now.getMonth()]} ${String(now.getDate()).padStart(2, "0")} · fixture imported`, text: `Imported from "${fixture.fixtureName || "cloud fixture"}"`, c: SEV_COLOR[severity] || "var(--slate)" },
    ],
    source: "cloud-fixture",
    demo: mode === "demo",
    fixture: fixture.fixtureName || fixture.account,
    rule: record.rule,
  };
}

/* ---------- fixture validation + analysis ---------- */

/**
 * Analyze a fixture document (already parsed JSON).
 * mode is "demo" when analyzing the bundled sample fixture (labels
 * findings as clearly-simulated), otherwise "uploaded".
 * Returns { ok, assets, findings, skipped, errors, warnings }.
 */
export function analyzeFixture(doc, mode = "uploaded") {
  const errors = [];
  const warnings = [];

  if (doc == null || typeof doc !== "object" || Array.isArray(doc)) {
    errors.push("The fixture must be a JSON object with a top-level results array.");
    return { ok: false, errors };
  }

  const account = String(doc.account || "unknown").trim();
  const fixtureName = String(doc.fixtureName || doc.account || "imported scan").trim();
  const provider = String(doc.provider || "aws").trim();
  const scannedAt = doc.scannedAt || null;

  if (!doc.results || !Array.isArray(doc.results)) {
    errors.push('The fixture is missing a "results" array. Every fixture must list each scan entry under results.');
    return { ok: false, errors };
  }

  if (!doc.results.length) {
    warnings.push("The fixture contains 0 check results — import it with a completely clean bill.");
  }

  const records = [];
  let skipped = 0;
  for (const entry of doc.results) {
    if (entry == null || typeof entry !== "object") {
      skipped += 1;
      continue;
    }
    if (!isKnownRule(entry.rule)) {
      warnings.push(`Entry "${entry.resource || entry.id || "?"}" references rule "${entry.rule || "(none)"}", which Kernveil does not check yet — skipped.`);
      skipped += 1;
      continue;
    }
    if (!entry.resource || typeof entry.resource !== "string") {
      warnings.push('A result is missing a "resource" (the asset it refers to) — skipped.');
      skipped += 1;
      continue;
    }
    records.push(entry);
  }

  const assets = records.map((r) => buildAsset(r, { account, provider }));
  const findings = records.map((r) => buildFinding(r, { account, provider, fixtureName, scannedAt }, mode));

  return { ok: true, assets, findings, skipped, warnings, provider, records: records.length, account, fixtureName, scannedAt };
}

/**
 * Parse + analyze an uploaded fixture file (text).
 * Returns the same shape as analyzeFixture with parse errors surfaced.
 */
export function parseCloudFixture(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This file isn't valid JSON. Upload the fixture exactly as exported by your sample — a .json file."] };
  }
  return analyzeFixture(doc);
}

/* ---------- bundled demo fixture (no network, no file) ---------- */

export function buildDemoFixture() {
  return {
    version: 1,
    provider: "aws",
    account: "acme-retail-prod",
    fixtureName: "Acme Retail production audit (sample)",
    scannedAt: "2026-09-08T07:30:00Z",
    results: [
      {
        id: "storage-data-archive-public",
        rule: "storage-public-read",
        severity: "critical",
        service: "S3",
        resource: "acme-retail-data-archive",
        region: "us-east-1",
        summary: "A storage resource that holds customer order archives is publicly readable from the internet.",
        description:
          "The storage resource <code>acme-retail-data-archive</code> allows public read access. Its access-control list grants <code class='bad'>AllUsers</code> read permission, and the resource is resolvable from a public endpoint.",
        why: "This bucket mirrors customer order archives in real time. Because the ACL is public, anyone on the internet can enumerate and download those files. There is no evidence it has been accessed, but the exposure is live right now and trivial to test.",
        action: "Remove the public AllUsers grant, attach the bucket policy to the app service role, and confirm the public URL returns 403.",
        evidence: {
          Resource: "acme-retail-data-archive",
          "Public URL": "https://acme-retail-data-archive.s3.amazonaws.com",
          ACL: "AllUsers:READ",
          Encryption: "AES-256 — disabled",
        },
      },
      {
        id: "storage-analytics-ingest-write",
        rule: "storage-public-read",
        severity: "high",
        service: "S3",
        resource: "analytics-ingest-bucket",
        region: "us-east-1",
        summary: "An analytics ingest bucket allows unauthenticated writes from the internet.",
        description:
          "The bucket <code>analytics-ingest-bucket</code> has a policy that allows unauthenticated <code class='bad'>s3:PutObject</code> from any IP.",
        why: "Unauthenticated write means anyone can plant objects that downstream analytics then consume — poisoning reporting and letting an attacker smuggle content into your pipeline.",
        action: "Rewrite the bucket policy to require the ingest service role's credentials.",
        evidence: {
          Resource: "analytics-ingest-bucket",
          "Policy statement": "s3:PutObject — Principal: *",
          "Public URL": "https://analytics-ingest-bucket.s3.amazonaws.com",
        },
      },
      {
        id: "db-checkout-prod-open",
        rule: "db-open-port",
        severity: "high",
        service: "RDS PostgreSQL",
        resource: "checkout-db-prod",
        region: "us-east-1",
        summary: "The checkout database is listening on a port reachable from the public internet.",
        description:
          "The database <code>checkout-db-prod</code> accepts connections on port <code class='bad'>5432</code> from <code class='bad'>0.0.0.0/0</code>. The security group is not restricted to your internal network.",
        why: "A database that accepts connections from the whole internet is exposed to password-guessing and any flaw in the client library. Your checkout data should only accept traffic from your application servers.",
        action: "Remove the 0.0.0.0/0 ingress rule for TCP 5432 and add the application subnet only.",
        evidence: {
          Host: "10.0.4.41:5432",
          "Security group rule": "0.0.0.0/0 · TCP:5432",
          Engine: "PostgreSQL 15",
        },
      },
      {
        id: "iam-data-archive-wildcard",
        rule: "iam-overprivileged",
        severity: "medium",
        service: "IAM",
        resource: "data-archive-write-role",
        region: "us-east-1",
        summary: "The archive-write role can write to any prefix in the storage estate.",
        description:
          "The role <code>data-archive-write-role</code> carries a managed policy granting <code class='bad'>s3:PutObject</code> on <code class='bad'>arn:aws:s3:::bucket/*</code> — every bucket, every prefix.",
        why: "This role only needs to write the archive prefix. If the credential leaks, the blast radius is the whole storage estate instead of one prefix.",
        action: "Scope the policy to arn:aws:s3:::acme-retail-data-archive/archive/* and separate read from write.",
        evidence: {
          Principal: "arn:aws:iam::093411002111:role/data-archive-write",
          "Managed policy": "s3:PutObject on arn:aws:s3:::bucket/*",
          Scope: "All buckets, all prefixes",
        },
      },
      {
        id: "iam-billing-export-admin",
        rule: "iam-overprivileged",
        severity: "low",
        service: "IAM",
        resource: "billing-export-role",
        region: "us-east-1",
        summary: "A cron role used to export billing CSVs has full administrator access.",
        description:
          "The role <code>billing-export-role</code>, used only by the nightly billing-export cron, is attached to <code class='bad'>AdministratorAccess</code>.",
        why: "Administrator access for a reporting job is far beyond need. A compromise or a mistake in this cron turns into an account-wide incident.",
        action: "Replace the AdministratorAccess attachment with read-only billing and S3 put on the export prefix.",
        evidence: {
          Principal: "arn:aws:iam::093411002111:role/billing-export-role",
          "Managed policy": "AdministratorAccess",
          "Used by": "billing-export nightly cron",
        },
      },
    ],
  };
}

export function analyzeDemoFixture() {
  return analyzeFixture(buildDemoFixture(), "demo");
}