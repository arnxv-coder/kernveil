/* ============================================================
   Kernveil — real web/domain security scanner (server side)
   Used by the /api/scan endpoint. Performs live DNS and HTTP
   interrogation against a caller-supplied hostname.

   Deliberately dependency-free so it runs unmodified on
   serverless functions. Everything here is honest: a check that
   could not be completed reports "unknown" and says why, rather
   than guessing a result.
   ============================================================ */

const USER_AGENT = "Kernveil-Scanner/1.0 (+https://kernveil.vercel.app)";
const HTTP_TIMEOUT_MS = 6000;
const DNS_TIMEOUT_MS = 4000;
const OVERALL_DEADLINE_MS = 9000;

/* ---------- host normalisation ---------- */

export function normalizeHost(input) {
  let raw = String(input || "").trim().toLowerCase();
  if (!raw) throw new Error("Enter a domain to scan.");
  raw = raw.replace(/^[a-z]+:\/\//, "");
  raw = raw.split("/")[0].split("?")[0];
  raw = raw.split("@").pop();
  raw = raw.replace(/:\d+$/, "");
  if (!raw) throw new Error("Enter a domain to scan.");
  // Reject anything that is not a plain hostname.
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(raw)) {
    throw new Error("That does not look like a domain. Try something like example.com");
  }
  if (raw.endsWith(".example") || raw.endsWith(".test") || raw.endsWith(".invalid")) {
    throw new Error("That domain cannot be resolved publicly.");
  }
  return raw;
}

/* ---------- SSRF guard ---------- */

/**
 * Blocks scans aimed at private, loopback, link-local or cloud-metadata
 * addresses. Resolves the host and refuses anything non-public so the
 * scanner cannot be turned into an internal network probe.
 */
function isBlockedAddress(ip) {
  const v = ip.replace(/^::ffff:/, "");
  if (v === "::1" || v === "0.0.0.0") return true;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    // IPv6 unique-local / link-local ranges.
    if (/^f[cd][0-9a-f]{2}:/.test(v)) return true;
    if (/^fe80:/.test(v)) return true;
    return false;
  }
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast/reserved
  return false;
}

async function resolvePublicHost(host) {
  const res = await dohQuery("A", host);
  const v4 = (res.Answer || []).filter((r) => r.type === 1).map((r) => r.data);
  const res6 = await dohQuery("AAAA", host);
  const v6 = (res6.Answer || []).filter((r) => r.type === 28).map((r) => r.data);
  const all = [...v4, ...v6];
  if (!all.length) return { addresses: [], blocked: false };
  if (all.every(isBlockedAddress)) return { addresses: all, blocked: true };
  return { addresses: all, blocked: false };
}

/* ---------- DNS over HTTPS ---------- */

const DOH_RESOLVERS = [
  "https://dns.google/resolve",
  "https://cloudflare-dns.com/dns-query",
];

async function dohQuery(type, name) {
  for (const base of DOH_RESOLVERS) {
    try {
      const url = `${base}?name=${encodeURIComponent(name)}&type=${type}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), DNS_TIMEOUT_MS);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { accept: "application/dns-json" },
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      if (json.Status === 0 || (json.Answer && json.Answer.length)) return json;
      // NOERROR with no answer is a valid "record absent" answer.
      if (json.Status === 0) return json;
    } catch {
      /* try the next resolver */
    }
  }
  return {};
}

function txtFrom(json) {
  return (json.Answer || [])
    .filter((r) => r.type === 16)
    .map((r) => (typeof r.data === "string" ? r.data : ""))
    .join("");
}

/* ---------- HTTP helpers ---------- */

async function timedFetch(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "user-agent": USER_AGENT, accept: "*/*" },
      ...opts,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/* ---------- individual checks ---------- */

async function checkHttps(host) {
  // 1. Does cleartext get upgraded to TLS?
  try {
    const res = await timedFetch(`http://${host}/`);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location") || "";
      if (loc.startsWith("https://")) {
        return checkTlsDeep(host, true, `Cleartext requests redirect to HTTPS (${res.status}).`);
      }
      return {
        rule: "https-enforced",
        status: "fail",
        summary: `HTTP redirects to a non-HTTPS location.`,
        evidence: [{ key: "Location", value: loc || "(empty)" }],
        weight: 10,
      };
    }
    // Served directly over cleartext.
    const res2 = await timedFetch(`http://${host}/`, { method: "HEAD" });
    const hs = res2.headers.get("strict-transport-security");
    if (!hs) {
      return {
        rule: "https-enforced",
        status: "fail",
        summary: "The site answers on plain HTTP with no redirect to HTTPS. Visitors can be intercepted in transit.",
        evidence: [{ key: "HTTP response", value: String(res2.status) }],
        weight: 10,
      };
    }
    return checkTlsDeep(host, true, "HSTS is present but cleartext still answers.");
  } catch (err) {
    return {
      rule: "https-enforced",
      status: "unknown",
      summary: "Could not complete an HTTP request to this host.",
      evidence: [{ key: "Error", value: String(err && err.message ? err.message : err).slice(0, 160) }],
      weight: 0,
    };
  }
}

async function checkTlsDeep(host, enforced, note) {
  let res;
  try {
    res = await timedFetch(`https://${host}/`, { method: "GET" });
  } catch (err) {
    return {
      rule: "https-enforced",
      status: "fail",
      summary: "HTTPS could not be established - the certificate did not validate or the host refused the connection.",
      evidence: [{ key: "Error", value: String(err && err.message ? err.message : err).slice(0, 160) }],
      weight: 10,
    };
  }

  const headers = res.headers;
  const hsts = headers.get("strict-transport-security");
  const evidence = [
    { key: "HTTPS response", value: String(res.status) },
    { key: "HSTS", value: hsts || "absent" },
  ];

  if (enforced && !hsts) {
    return {
      rule: "https-enforced",
      status: "fail",
      summary: "HTTPS works but Strict-Transport-Security is missing, so the browser can still be downgraded to HTTP.",
      evidence,
      weight: 6,
    };
  }
  if (!enforced) {
    return { rule: "https-enforced", status: "fail", summary: note, evidence, weight: 10 };
  }
  return {
    rule: "https-enforced",
    status: "pass",
    summary: hsts
      ? "HTTPS is enforced and HSTS is set."
      : "HTTPS is enforced.",
    evidence,
    weight: 0,
  };
}

async function checkTlsCertificate(host) {
  // Serverless cannot open a raw TLS socket, so we infer chain validity
  // from whether the platform's TLS client accepted the certificate, and
  // pull expiry from Certificate Transparency logs when available.
  let res;
  try {
    res = await timedFetch(`https://${host}/`, { method: "GET" });
  } catch (err) {
    return {
      rule: "tls-certificate",
      status: "fail",
      summary: "The TLS certificate did not validate. Browsers will show a security warning.",
      evidence: [{ key: "Error", value: String(err && err.message ? err.message : err).slice(0, 160) }],
      weight: 12,
    };
  }

  // Query crt.sh for the most recent certificate covering this host.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const crt = await fetch(
      `https://crt.sh/?q=${encodeURIComponent(host)}&output=json&exclude=expired`,
      { signal: ctrl.signal, headers: { "user-agent": USER_AGENT } }
    );
    clearTimeout(t);
    if (crt.ok) {
      const rows = await crt.json();
      const dates = rows
        .map((r) => r.not_after && Date.parse(r.not_after))
        .filter((d) => Number.isFinite(d) && d > Date.now())
        .sort((a, b) => b - a);
      if (dates.length) {
        const soonest = dates[dates.length - 1];
        const soonestLatest = dates[0];
        const days = Math.round((soonestLatest - Date.now()) / 86400000);
        return {
          rule: "tls-certificate",
          status: "pass",
          summary:
            days < 21
              ? "Certificate is valid, but a certificate expires soon - confirm renewal is automated."
              : "Certificate is valid and publicly trusted.",
          evidence: [
            { key: "HTTPS response", value: String(res.status) },
            { key: "Valid certificates found", value: String(dates.length) },
            { key: "Expiring within", value: days > 0 ? `${days} day(s)` : "none tracked" },
          ],
          weight: 0,
        };
      }
      return {
        rule: "tls-certificate",
        status: "unknown",
        summary: "HTTPS works and the certificate chain validated, but no unexpired certificate was found in public logs.",
        evidence: [{ key: "HTTPS response", value: String(res.status) }],
        weight: 0,
      };
    }
  } catch {
    /* fall through to the generic pass */
  }

  return {
    rule: "tls-certificate",
    status: "pass",
    summary: "The certificate chain validated successfully.",
    evidence: [{ key: "HTTPS response", value: String(res.status) }],
    weight: 0,
  };
}

const HEADER_CHECKS = [
  { header: "content-security-policy", key: "Content-Security-Policy", weight: 6, why: "CSP limits what scripts and frames the page may load, cutting the impact of an injection bug." },
  { header: "x-frame-options", key: "X-Frame-Options", weight: 4, why: "Blocks other sites from framing yours (clickjacking)." },
  { header: "x-content-type-options", key: "X-Content-Type-Options", weight: 3, why: "Stops the browser guessing file types (MIME sniffing)." },
  { header: "referrer-policy", key: "Referrer-Policy", weight: 1, why: "Keeps internal URLs out of outbound referrers." },
];

async function checkSecurityHeaders(host) {
  let res;
  try {
    res = await timedFetch(`https://${host}/`);
  } catch {
    res = null;
  }
  if (!res) {
    return {
      rule: "security-headers",
      status: "unknown",
      summary: "Could not read response headers - the site did not answer over HTTPS.",
      evidence: [],
      weight: 0,
    };
  }
  const evidence = [];
  const missing = [];
  for (const c of HEADER_CHECKS) {
    const val = res.headers.get(c.header);
    evidence.push({ key: c.key, value: val || "absent" });
    if (!val) missing.push(c);
  }
  if (!missing.length) {
    return {
      rule: "security-headers",
      status: "pass",
      summary: "All recommended browser security headers are present.",
      evidence,
      weight: 0,
    };
  }
  const weight = missing.reduce((n, c) => n + c.weight, 0);
  return {
    rule: "security-headers",
    status: weight >= 10 ? "fail" : "warn",
    summary: `${missing.length} recommended security header${missing.length > 1 ? "s are" : " is"} missing: ${missing.map((m) => m.key).join(", ")}.`,
    evidence: [
      ...evidence,
      ...missing.map((m) => ({ key: `Why ${m.key} matters`, value: m.why })),
    ],
    weight,
  };
}

async function checkSpf(host) {
  const json = await dohQuery("TXT", host);
  const txt = txtFrom(json);
  if (!txt) {
    return { rule: "spf", status: "warn", summary: "No SPF record found. Anyone can spoof mail from your domain.", evidence: [{ key: "TXT record", value: "absent" }], weight: 7 };
  }
  if (!/v=spf1/i.test(txt)) {
    return { rule: "spf", status: "warn", summary: "A TXT record exists but contains no v=spf1 policy.", evidence: [{ key: "SPF", value: txt.slice(0, 200) }], weight: 5 };
  }
  if (/(^|\s)[+~?]all/i.test(txt) && !/(-all|~all)/i.test(txt)) {
    return { rule: "spf", status: "warn", summary: "SPF ends in +all or ?all, which authorises every server on the internet to send mail as you.", evidence: [{ key: "SPF", value: txt.slice(0, 200) }], weight: 7 };
  }
  const qualifier = txt.match(/\s(-all|~all)/i);
  return {
    rule: "spf",
    status: "pass",
    summary: qualifier && /-all/i.test(qualifier[1])
      ? "SPF is configured and hard-fails (the strongest setting)."
      : "SPF is configured.",
    evidence: [{ key: "SPF", value: txt.slice(0, 200) }],
    weight: 0,
  };
}

async function checkDkim(host) {
  // Common selectors, queried in parallel so a scan never waits on a
  // long tail of NXDOMAIN lookups.
  const selectors = ["default", "google", "selector1", "selector2", "k1", "s1"];
  const results = await Promise.all(
    selectors.map(async (sel) => {
      const json = await dohQuery("TXT", `${sel}._domainkey.${host}`);
      const txt = txtFrom(json);
      return txt ? { selector: sel, record: txt } : null;
    })
  );
  const found = results.filter(Boolean).slice(0, 2);
  if (!found.length) {
    return { rule: "dkim", status: "unknown", summary: "No DKIM key found on the common selectors. If you send mail, sign it - providers often choose other selectors.", evidence: [{ key: "Selectors tried", value: selectors.join(", ") }], weight: 0 };
  }
  return {
    rule: "dkim",
    status: "pass",
    summary: `DKIM signing is configured (${found.length} selector${found.length > 1 ? "s" : ""} found).`,
    evidence: found.map((f) => ({ key: `_${f.selector}._domainkey`, value: f.record.slice(0, 120) })),
    weight: 0,
  };
}

async function checkDmarc(host) {
  const json = await dohQuery("TXT", `_dmarc.${host}`);
  const txt = txtFrom(json);
  if (!txt) {
    return { rule: "dmarc", status: "fail", summary: "No DMARC policy. Spoofed mail from your domain is not reported or blocked anywhere.", evidence: [{ key: "_dmarc record", value: "absent" }], weight: 10 };
  }
  const p = txt.match(/p\s*=\s*(\w+)/i);
  const policy = p ? p[1].toLowerCase() : null;
  if (!policy) {
    return { rule: "dmarc", status: "warn", summary: "A DMARC record exists but declares no policy.", evidence: [{ key: "DMARC", value: txt.slice(0, 200) }], weight: 6 };
  }
  if (policy === "none") {
    return { rule: "dmarc", status: "warn", summary: "DMARC is in monitoring mode (p=none), which only observes - it does not block spoofed mail.", evidence: [{ key: "DMARC", value: txt.slice(0, 200) }], weight: 6 };
  }
  if (policy === "quarantine") {
    return { rule: "dmarc", status: "warn", summary: "DMARC quarantines failing mail. p=reject is stronger.", evidence: [{ key: "DMARC", value: txt.slice(0, 200) }], weight: 4 };
  }
  return { rule: "dmarc", status: "pass", summary: `DMARC is enforcing with p=${policy}.`, evidence: [{ key: "DMARC", value: txt.slice(0, 200) }], weight: 0 };
}

/* ---------- exposed files ---------- */

/**
 * Many hosts answer *every* path with HTTP 200 and the same page. That is
 * normal for single-page apps (Vercel/Netlify rewrites, static hosts, many
 * CMSs) and it means a naive "did /.env return 200?" test reports five
 * critical vulnerabilities on every SPA in the world.
 *
 * So we first probe a random path that cannot exist, and treat any response
 * that matches it as the catch-all page rather than a real file. We also
 * require the response to look like the file type we asked for, and require
 * its body to differ from both the site root and the baseline page.
 */
async function probeForFile(host, targetPath, baseline, rootFingerprint) {
  let res;
  try {
    res = await timedFetch(`https://${host}${targetPath}`);
  } catch {
    return { hit: false, note: `${targetPath} - could not check` };
  }

  if (res.status !== 200) {
    return { hit: false, note: `${targetPath} - not exposed (HTTP ${res.status})` };
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text().catch(() => "");
  const sample = text.slice(0, 400);

  // Identical to the catch-all 404 page for a path that cannot exist.
  if (baseline && baseline.ok) {
    if (sample.length === baseline.length && sample === baseline.sample) {
      return { hit: false, note: `${targetPath} - not exposed (catch-all response)` };
    }
    // Very close in size to the baseline page: still almost certainly the SPA shell.
    const sizeDelta = Math.abs(sample.length - baseline.length);
    if (sizeDelta <= 8 && sample.slice(0, 120) === baseline.sample.slice(0, 120)) {
      return { hit: false, note: `${targetPath} - not exposed (catch-all response)` };
    }
  }

  // Identical to the site root: the router is serving the app for all paths.
  if (rootFingerprint && sample.slice(0, 120) === rootFingerprint) {
    return { hit: false, note: `${targetPath} - not exposed (same as site root)` };
  }

  // A .env or SQL dump is never HTML. HTML here means we got the app shell.
  const looksHtml = contentType.includes("text/html") || sample.trim().slice(0, 40).startsWith("<!doctype html");
  if (looksHtml) {
    return { hit: false, note: `${targetPath} - not exposed (returned an HTML page)` };
  }

  // Content type must be plausible for the kind of file we asked for.
  const expectsText = /json|javascript|plain|sql|text|xml|octet-stream/.test(contentType);
  if (contentType && !expectsText) {
    return { hit: false, note: `${targetPath} - not exposed (unexpected type ${contentType.split(";")[0]})` };
  }

  return {
    hit: true,
    note: `${targetPath} returned HTTP 200 (${contentType.split(";")[0] || "unknown type"}, ${text.length} bytes)`,
  };
}

async function checkExposedFiles(host) {
  const exposedPaths = [
    { path: "/.env", label: "Environment file", why: "A leaked .env exposes database passwords and API keys." },
    { path: "/.git/config", label: "Git metadata", why: "An exposed .git directory leaks source code and history." },
    { path: "/backup.sql", label: "Database backup", why: "A stray database dump exposes all of your data." },
    { path: "/wp-config.php.bak", label: "WordPress config backup", why: "Backup files of config files leak credentials." },
    { path: "/.DS_Store", label: "macOS directory file", why: "Leaks folder structure and sometimes filenames." },
  ];

  // A path that cannot exist on any real host.
  const baselinePath = "/__kernveil_missing_" + Math.random().toString(36).slice(2, 12) + "__";

  const [baselineRes, rootRes] = await Promise.all([
    timedFetch(`https://${host}${baselinePath}`).then(async (r) => {
      const t = await r.text().catch(() => "");
      return { ok: true, status: r.status, sample: t.slice(0, 400), length: t.length };
    }).catch(() => ({ ok: false })),
    timedFetch(`https://${host}/`).then(async (r) => {
      const t = await r.text().catch(() => "");
      return t.slice(0, 120);
    }).catch(() => null),
  ]);

  const evidence = [];
  const exposed = [];
  const skipped = [];

  const probed = await Promise.all(
    exposedPaths.map(async (target) => {
      const result = await probeForFile(host, target.path, baselineRes, rootRes);
      return { target, ...result };
    })
  );

  for (const row of probed) {
    if (row.hit) exposed.push(row.target);
    else if (String(row.note).includes("could not check")) skipped.push(row.target.label);
    evidence.push({ key: row.target.label, value: row.note });
  }

  if (baselineRes.ok) {
    evidence.push({
      key: "Catch-all baseline",
      value: `${baselinePath} returned HTTP ${baselineRes.status} (${baselineRes.length} bytes)`,
    });
  }

  if (exposed.length) {
    return {
      rule: "exposed-files",
      status: "fail",
      summary: `${exposed.length} sensitive file${exposed.length > 1 ? "s are" : " is"} publicly reachable: ${exposed.map((e) => e.label).join(", ")}.`,
      evidence: [...evidence, ...exposed.map((e) => ({ key: `Why ${e.label} matters`, value: e.why }))],
      weight: 15,
    };
  }

  if (baselineRes.ok && baselineRes.status === 200 && skipped.length === exposedPaths.length) {
    return {
      rule: "exposed-files",
      status: "unknown",
      summary: `This host returns the same page for every path, so we could not confirm whether any of the ${exposedPaths.length} sensitive files are exposed.`,
      evidence,
      weight: 0,
    };
  }

  return {
    rule: "exposed-files",
    status: "pass",
    summary: `No common sensitive files are publicly reachable (${exposedPaths.length} paths checked).`,
    evidence,
    weight: 0,
  };
}

/* ---------- orchestration ---------- */

const RULE_TITLES = {
  "https-enforced": "HTTPS enforcement",
  "tls-certificate": "TLS certificate",
  "security-headers": "Security headers",
  spf: "SPF record",
  dkim: "DKIM signing",
  dmarc: "DMARC policy",
  "exposed-files": "Exposed sensitive files",
};

const FIXES = {
  "https-enforced": "Redirect every HTTP request to HTTPS and set Strict-Transport-Security: max-age=63072000; includeSubDomains; preload.",
  "tls-certificate": "Check that certificate renewal is automated and covers every hostname you serve (www and apex).",
  "security-headers": "Add Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff and Referrer-Policy to your responses.",
  spf: "Add a v=spf1 record listing only your real mail servers and end it with -all.",
  dkim: "Turn on DKIM signing with your mail provider and confirm the selector's DNS record is published.",
  dmarc: "Publish a DMARC record at _dmarc with p=reject once SPF and DKIM are reliable.",
  "exposed-files": "Remove or block these files at the web server and rotate any credentials that were exposed.",
};

/** Caps a single check so one slow host can never stall the whole scan. */
function withDeadline(promise, rule) {
  const timeout = new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          rule,
          status: "unknown",
          summary: "This check took too long to complete and was skipped.",
          evidence: [],
          weight: 0,
        }),
      OVERALL_DEADLINE_MS
    )
  );
  return Promise.race([promise, timeout]);
}

export async function scanHost(rawHost) {
  const host = normalizeHost(rawHost);

  const dns = await resolvePublicHost(host);
  if (dns.blocked) {
    throw new Error("That domain resolves to a private address and cannot be scanned.");
  }
  if (!dns.addresses.length) {
    return {
      host,
      scannedAt: new Date().toISOString(),
      dnsOk: false,
      checks: [],
      score: null,
      grade: "unknown",
      totals: { fail: 0, warn: 0, pass: 0, unknown: 0 },
    };
  }

  const checks = await Promise.all([
    withDeadline(checkHttps(host), "https-enforced"),
    withDeadline(checkTlsCertificate(host), "tls-certificate"),
    withDeadline(checkSecurityHeaders(host), "security-headers"),
    withDeadline(checkSpf(host), "spf"),
    withDeadline(checkDkim(host), "dkim"),
    withDeadline(checkDmarc(host), "dmarc"),
    withDeadline(checkExposedFiles(host), "exposed-files"),
  ]);

  const scored = checks.map((c) => ({
    rule: c.rule,
    title: RULE_TITLES[c.rule] || c.rule,
    status: c.status,
    summary: c.summary,
    evidence: c.evidence || [],
    weight: c.weight || 0,
    fix: c.status === "pass" || c.status === "unknown" ? null : FIXES[c.rule] || null,
  }));

  const totals = {
    fail: scored.filter((c) => c.status === "fail").length,
    warn: scored.filter((c) => c.status === "warn").length,
    pass: scored.filter((c) => c.status === "pass").length,
    unknown: scored.filter((c) => c.status === "unknown").length,
  };

  const maxWeight = scored.reduce((n, c) => n + (c.weight || 0), 0) + 100;
  const penalty = scored.reduce((n, c) => n + (c.weight || 0), 0);
  const score = Math.max(0, Math.round(100 - (penalty / maxWeight) * 100));

  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return {
    host,
    scannedAt: new Date().toISOString(),
    dnsOk: true,
    addresses: dns.addresses.slice(0, 3),
    checks: scored,
    score,
    grade,
    totals,
  };
}

/** Reduced payload shown before the visitor submits an email address. */
export function toPreview(result) {
  if (!result || !result.dnsOk) {
    return { host: result?.host, resolvable: false, score: null, grade: null, totals: null };
  }
  return {
    host: result.host,
    resolvable: true,
    score: result.score,
    grade: result.grade,
    totals: result.totals,
    issues: result.checks.filter((c) => c.status === "fail" || c.status === "warn").length,
  };
}