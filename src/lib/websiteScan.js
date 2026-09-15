/* ============================================================
   Kernveil — website & domain check engine (client-side).
   Evaluates a public host against the checks Kernveil is
   designed to run — HTTPS enforcement, TLS certificate health,
   security headers, and the SPF / DKIM / DMARC mail records.
   Everything is simulated and clearly labelled: no live DNS,
   TLS, or HTTP interrogation ever leaves the browser. A bundled
   sample host profile exists so the flow is believable without
   a real site, and it always stays honest about being a demo.
   ============================================================ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEV_COLOR = { critical: "var(--red)", high: "var(--orange)", medium: "var(--amber)", low: "var(--slate)" };

export const SOURCE_LABEL = "Website audit";

/* ---------- check catalog ---------- */

export const WEBSITE_CHECKS = [
  {
    rule: "https-enforced",
    label: "HTTPS enforcement",
    text: "Every page and API must force HTTPS and send HSTS so clients can never be downgraded to cleartext.",
  },
  {
    rule: "tls-certificate",
    label: "TLS certificate",
    text: "The TLS certificate must be valid, unexpired, and cover every hostname it serves.",
  },
  {
    rule: "security-headers",
    label: "Security headers",
    text: "Responses should send CSP, X-Frame-Options, and nosniff headers to harden the browser surface.",
  },
  {
    rule: "spf",
    label: "SPF record",
    text: "SPF must clearly list the servers allowed to send mail and hard-fail unauthorized senders.",
  },
  {
    rule: "dkim",
    label: "DKIM signing",
    text: "Mail should be signed with a current DKIM key so receivers can verify the sender's identity.",
  },
  {
    rule: "dmarc",
    label: "DMARC policy",
    text: "DMARC tells receivers what to do with mail that fails SPF or DKIM — the policy should enforce, not just observe.",
  },
];

const RULES = {
  "https-enforced": {
    title: "Site still answers cleartext HTTP",
    category: "Configuration",
    severity: "high",
    impact: "Traffic interception",
    why: "A host that still answers plain HTTP lets anyone on the network read and modify requests. Browser upgrades can also silently downgrade to cleartext, which makes the TLS certificate pointless.",
    steps: [
      "Redirect every HTTP request to HTTPS with a 301.",
      "Enable HSTS so browsers require HTTPS on all later visits.",
    ],
  },
  "tls-certificate": {
    title: "TLS certificate concerns detected",
    category: "Configuration",
    severity: "high",
    impact: "Customer-facing downtime",
    why: "When the certificate expires, browsers block the site and every customer integration that talks to it fails, even though the service itself is up.",
    steps: [
      "Confirm the certificate auto-renewal job is enabled and reachable.",
      "If manual, renew now through your certificate authority.",
    ],
  },
  "security-headers": {
    title: "Missing security configuration on public site",
    category: "Configuration",
    severity: "medium",
    impact: "Client-side attack surface",
    why: "These headers are cheap hardening. Missing CSP and framing control increases the risk of injected content and clickjacking on the public surface.",
    steps: [
      "Add a starter CSP header (e.g. <code>default-src 'self'</code>) and refine it.",
      "Add <code>X-Frame-Options: DENY</code> and re-check.",
    ],
  },
  spf: {
    title: "SPF record does not hard-fail",
    category: "Email security",
    severity: "low",
    impact: "E-mail spoofing",
    why: "SPF is only meaningful when unauthorized senders are hard-failed. A softfail or permissive record lets spoofed mail pass as if the domain said so.",
    steps: [
      "Trim the SPF include list to servers that genuinely send mail.",
      "Change the all mechanism to <code>-all</code> once the list is correct.",
    ],
  },
  dkim: {
    title: "DKIM signing not working",
    category: "Email security",
    severity: "medium",
    impact: "E-mail spoofing",
    why: "DKIM lets receivers verify a message really comes from your domain. Without it, spoofed mail has nothing to be checked against.",
    steps: [
      "Publish a working DKIM key at the advertised selector.",
      "Ensure alignment so DMARC can actually pass authenticated mail.",
    ],
  },
  dmarc: {
    title: "DMARC policy allows spoofed mail",
    category: "Email security",
    severity: "medium",
    impact: "E-mail spoofing",
    why: "A <code>p=none</code> DMARC policy reports but never acts: receivers monitor spoofing but still deliver the mail. Until the policy quarantines or rejects, attacks have nothing to fear.",
    steps: [
      "Move the policy to <code>p=quarantine</code> once reporting looks clean.",
      "Escalate to <code>p=reject</code> and insist on strict DKIM/SPF alignment.",
    ],
  },
};

/* ---------- helpers ---------- */

export function websiteAssetId(host) {
  return `web:${host}`;
}

export function websiteFindingId(host, rule) {
  return `web:${host}:${rule}`;
}

export function normalizeHost(input) {
  const raw = String(input || "").trim();
  if (!raw) return { ok: false, error: "Enter a domain — e.g. api.acme.com." };
  let host = raw.toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  const trailing = host.split(":");
  if (trailing.length > 1 && trailing[1]) host = trailing[0];
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) {
    return { ok: false, error: "That doesn't look like a domain. Enter a host such as <b>api.acme.com</b>." };
  }
  return { ok: true, host };
}

function fmtLongDate(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "Website scan";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function toEvidenceList(list) {
  return (list || []).map((e) => ({
    key: e.key,
    value: typeof e.value === "string" || typeof e.value === "number" ? String(e.value) : JSON.stringify(e.value),
  }));
}

/* ---------- asset + finding shaping ---------- */

function buildAsset(host) {
  return {
    id: websiteAssetId(host),
    name: host,
    type: "website",
    env: "Production",
    source: SOURCE_LABEL,
    risk: "high",
    last: "just now",
    host,
  };
}

function buildFinding(host, check, mode) {
  const spec = RULES[check.rule];
  const severity = check.severity || spec.severity;
  const now = new Date();
  return {
    id: websiteFindingId(host, check.rule),
    title: check.findingTitle || spec.title || check.label,
    severity,
    category: spec.category,
    asset: websiteAssetId(host),
    status: "open",
    first: fmtLongDate(now),
    last: "just now",
    summary: check.summary || `${check.label} on ${host} needs attention.`,
    detected: check.detected || `Kernveil's ${check.label.toLowerCase()} check on <code>${host}</code> did not pass.`,
    why: check.why || spec.why,
    impact: spec.impact,
    evidence: toEvidenceList(check.evidence),
    steps: spec.steps,
    related: [websiteAssetId(host)],
    history: [
      {
        time: `${MONTHS[now.getMonth()]} ${String(now.getDate()).padStart(2, "0")} · website scan`,
        text: mode === "demo"
          ? "Discovered from the bundled sample website profile (simulated data)."
          : "Discovered by the simulated host evaluation (no live scan).",
        c: SEV_COLOR[severity] || "var(--slate)",
      },
    ],
    source: "website-fixture",
    demo: mode === "demo",
    rule: check.rule,
    host,
  };
}

/* ---------- scan assembly ---------- */

function assembleScan({ host, checks, mode }) {
  const labels = Object.fromEntries(WEBSITE_CHECKS.map((c) => [c.rule, c.label]));
  const findings = [];
  for (const raw of checks) {
    const check = { ...raw, label: labels[raw.rule] || raw.label || raw.rule };
    const spec = RULES[check.rule];
    if (check.status === "pass") continue;
    if (!spec) continue;
    findings.push(
      buildFinding(host, { ...check, severity: check.status === "warn" ? "low" : check.severity || spec.severity }, mode)
    );
  }
  return {
    ok: true,
    host,
    records: checks.length,
    checks: checks.map((c) => ({ ...c, label: labels[c.rule] || c.label || c.rule })),
    findings,
    assets: [buildAsset(host)],
    skipped: 0,
    warnings: [],
  };
}

/* ---------- bundled sample host profile (demo) ---------- */

const DEMO_HOST = "api.acme.com";

const DEMO_CHECKS = [
  {
    rule: "https-enforced",
    status: "fail",
    summary: "The API host still answers cleartext HTTP and sends no HSTS header.",
    detected: "Requests to <code>http://api.acme.com</code> return <code class='bad'>200</code> instead of redirecting to HTTPS.",
    evidence: [
      { key: "Cleartext test", value: "http://api.acme.com → 200 OK (no redirect)" },
      { key: "HSTS header", value: "absent" },
    ],
  },
  {
    rule: "tls-certificate",
    status: "pass",
    evidence: [
      { key: "Certificate", value: "Let's Encrypt R3 · RSA 2048" },
      { key: "Expires", value: "18 Feb 2027" },
      { key: "SAN", value: "api.acme.com · acme.com" },
    ],
  },
  {
    rule: "security-headers",
    status: "fail",
    summary: "The public site omits recommended content-security and framing headers.",
    detected: "Responses from <code>api.acme.com</code> do not send <code class='bad'>Content-Security-Policy</code> or <code class='bad'>X-Frame-Options</code>.",
    evidence: [
      { key: "Missing", value: "CSP · X-Frame-Options" },
      { key: "Present", value: "X-Content-Type-Options: nosniff" },
    ],
  },
  {
    rule: "spf",
    status: "fail",
    summary: "SPF is present but does not hard-fail unauthorized senders.",
    detected: "The SPF record for <code>acme.com</code> ends in <code class='bad'>~all</code> (softfail) and lists more senders than needed.",
    evidence: [
      { key: "Record", value: "v=spf1 include:_spf.acme.com ~all" },
      { key: "Qualifier", value: "softfail (~all)" },
    ],
  },
  {
    rule: "dkim",
    status: "pass",
    evidence: [
      { key: "Selector", value: "k1._domainkey.acme.com" },
      { key: "Key", value: "RSA 2048-bit · aligned" },
    ],
  },
  {
    rule: "dmarc",
    status: "fail",
    summary: "DMARC exists but uses a monitoring-only policy.",
    detected: "The DMARC record for <code>acme.com</code> sets <code class='bad'>p=none</code>, so receivers do not act on spoofed mail.",
    evidence: [
      { key: "Record", value: "v=DMARC1; p=none; pct=100; rua=mailto:dmarc@acme.com" },
      { key: "Policy", value: "none (monitoring only)" },
    ],
  },
];

const BUNDLED_HOSTS = new Set([DEMO_HOST]);

export function analyzeDemoSite() {
  return assembleScan({ host: DEMO_HOST, checks: DEMO_CHECKS.map((c) => ({ ...c })), mode: "demo" });
}

/* ---------- user-entered host evaluation ---------- */

function cleanChecks(host) {
  return [
    { rule: "https-enforced", status: "pass", evidence: [{ key: "Cleartext test", value: `http://${host} → 301 → https` }, { key: "HSTS header", value: "max-age=63072000" }] },
    { rule: "tls-certificate", status: "pass", evidence: [{ key: "Certificate", value: "Valid · in date" }, { key: "SAN", value: host }] },
    { rule: "security-headers", status: "pass", evidence: [{ key: "CSP", value: "present" }, { key: "X-Frame-Options", value: "DENY" }] },
    { rule: "spf", status: "pass", evidence: [{ key: "Record", value: `v=spf1 ip4:192.0.2.0/24 -all` }, { key: "Qualifier", value: "hardfail (-all)" }] },
    { rule: "dkim", status: "pass", evidence: [{ key: "Selector", value: "k1._domainkey" }, { key: "Key", value: "RSA 2048-bit · aligned" }] },
    { rule: "dmarc", status: "pass", evidence: [{ key: "Record", value: "v=DMARC1; p=reject; pct=100" }, { key: "Policy", value: "reject" }] },
  ];
}

/**
 * Evaluate a host entered by the user. The bundled sample host uses its
 * known profile; any other host returns a clean simulated bill with a
 * clear warning — Kernveil never performs a live scan, so it won't
 * invent risk for a domain it didn't actually inspect.
 */
export function analyzeHostScan(host, mode = "scan") {
  const result = assembleScan({
    host,
    checks: BUNDLED_HOSTS.has(host) ? DEMO_CHECKS.map((c) => ({ ...c })) : cleanChecks(host),
    mode: mode === "scan" ? "scan" : "demo",
  });
  if (!BUNDLED_HOSTS.has(host)) {
    result.warnings.push("No live DNS, TLS, or HTTP interrogation — this host was evaluated from a simulated profile; nothing was contacted.");
  }
  return result;
}