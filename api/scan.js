/* ============================================================
   Kernveil — /api/scan
   Public domain scanner.

   POST { host }                     -> redacted preview (score + issue count)
   POST { host, email, code }        -> verified; report emailed to the visitor
                                        and the lead is emailed to the owner

   A full report requires a one-time code that was emailed to the address,
   which proves the visitor controls it. Codes live in /api/verify.

   Email delivery is best-effort. If the visitor's message cannot be sent,
   the full report is returned in the response instead so the scan page
   can fall back to showing it rather than dead-ending.

   Rate limiting is in-memory and therefore best-effort: it protects a
   warm function instance but resets on cold start and is not shared
   across concurrent instances. That is acceptable for a free lead
   magnet; put a real limiter in front of it if it ever gets abused.
   ============================================================ */

import { scanHost, toPreview } from "./lib/scanCore.js";
import { buildReportHtml, buildReportText, buildReportSubject } from "./lib/reportEmail.js";
import { validateEmail } from "./lib/emailGuard.js";
import { send } from "./lib/mailer.js";
import { store as codeStore } from "./verify.js";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const MAX_CODE_TRIES = 5;
const BUCKETS = new Map();

function clientKey(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.headers["x-real-ip"] || "unknown";
}

function rateLimited(key) {
  const now = Date.now();
  const bucket = BUCKETS.get(key);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    BUCKETS.set(key, { start: now, count: 1 });
    // Opportunistic cleanup so the map cannot grow without bound.
    if (BUCKETS.size > 5000) {
      for (const [k, v] of BUCKETS) if (now - v.start > WINDOW_MS) BUCKETS.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_PER_WINDOW;
}

/** Sends the visitor their report. This is the thing the lead is buying. */
async function deliverReport({ email, report }) {
  return send({
    to: email,
    subject: buildReportSubject(report),
    html: buildReportHtml(report),
    text: buildReportText(report),
  });
}

/** Tells the owner a lead came in. Must never block the visitor's report. */
async function notifyLead({ host, email, result, delivery }) {
  const to = process.env.LEADS_EMAIL;
  if (!to) return { sent: false, reason: "LEADS_EMAIL not configured" };

  const issues = result.checks
    .filter((c) => c.status === "fail" || c.status === "warn")
    .map((c) => `  ${c.title} - ${c.status.toUpperCase()}: ${c.summary}`)
    .join("\n");

  return send({
    to,
    subject: `Scan lead: ${host} (grade ${result.grade}, ${result.totals.fail} failing)`,
    text: [
      `New scan lead`,
      ``,
      `Domain: ${host}`,
      `Their email: ${email}`,
      `Email verified by code: yes`,
      `Score: ${result.score}/100 (${result.grade})`,
      `Findings: ${result.totals.fail} fail, ${result.totals.warn} warn, ${result.totals.pass} pass`,
      `Report emailed to them: ${delivery && delivery.sent ? "yes" : "NO - " + (delivery && delivery.reason)}`,
      ``,
      `Issues:`,
      issues || "  (none)",
    ].join("\n"),
  });
}

/**
 * Checks a submitted code against the one emailed to that address.
 * Codes are single-use and expire; wrong guesses are capped so a 6-digit
 * space cannot be brute-forced from a single address.
 */
function checkCode(email, submitted) {
  const entry = codeStore.get(email);

  if (!entry) return { ok: false, error: "Request a new code - the previous one is no longer valid." };

  if (entry.lockedUntil) {
    if (Date.now() < entry.lockedUntil) {
      const mins = Math.max(1, Math.ceil((entry.lockedUntil - Date.now()) / 60000));
      return {
        ok: false,
        error: `Too many incorrect attempts. Request a new code in ${mins} minute${mins > 1 ? "s" : ""}.`,
      };
    }
    codeStore.delete(email);
    return { ok: false, error: "Request a new code." };
  }

  if (Date.now() > entry.expires) {
    codeStore.delete(email);
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  entry.tries += 1;

  if (entry.tries > MAX_CODE_TRIES) {
    // Lock the address out for the remainder of the code's life rather than
    // deleting it, so the visitor is told the truth about why it is refused.
    entry.lockedUntil = entry.expires;
    return { ok: false, error: "Too many incorrect attempts. Request a new code shortly." };
  }

  if (String(submitted || "").trim() !== entry.code) {
    const left = MAX_CODE_TRIES - entry.tries;
    return {
      ok: false,
      error: `That code is not right.${left > 0 ? ` ${left} attempt${left > 1 ? "s" : ""} left.` : ""}`,
    };
  }

  codeStore.delete(email); // single use
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const key = clientKey(req);
  if (rateLimited(key)) {
    return res.status(429).json({
      error: "Too many scans from this network. Try again later, or email us and we will run it for you.",
    });
  }

  let host;
  let email;
  let code;
  try {
    const raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    host = raw.host;
    email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    code = typeof raw.code === "string" ? raw.code.trim() : "";
  } catch {
    return res.status(400).json({ error: "Malformed request." });
  }

  // An address alone is not proof of anything. Without a correct code we
  // only ever return the preview, so nobody can unlock a report - or plant a
  // junk lead - just by typing an email.
  let verifiedEmail = null;
  if (email) {
    const check = validateEmail(email);
    if (!check.ok) return res.status(400).json({ error: check.error, field: "email" });
    const verified = checkCode(check.email, code);
    if (!verified.ok) {
      return res.status(401).json({ error: verified.error, field: "code", needsCode: true });
    }
    verifiedEmail = check.email;
  }

  try {
    const result = await scanHost(host);
    const wantsFull = Boolean(verifiedEmail);

    if (!result.dnsOk) {
      return res.status(200).json({
        preview: toPreview(result),
        report: null,
        message: "That domain has no public DNS records, so there is nothing to scan.",
      });
    }

    if (!wantsFull) {
      return res.status(200).json({
        preview: toPreview(result),
        report: null,
        gated: true,
      });
    }

    const report = {
      host: result.host,
      scannedAt: result.scannedAt,
      score: result.score,
      grade: result.grade,
      totals: result.totals,
      checks: result.checks,
    };

    // The report goes to their inbox. If that fails we fall back to
    // returning it so the page can show it, rather than dead-ending the
    // visitor on a send failure they cannot act on.
    const delivery = await deliverReport({ email: verifiedEmail, report }).catch((e) => ({
      sent: false,
      reason: String(e && e.message ? e.message : e).slice(0, 240),
    }));

    if (!delivery.sent) {
      console.warn(`[scan] report email to ${verifiedEmail} failed: ${delivery.reason}`);
    }

    // Owner notification must never cost the visitor their report, but it
    // must never be silent either - otherwise leads disappear unnoticed.
    const notify = await notifyLead({
      host: result.host,
      email: verifiedEmail,
      result,
      delivery,
    }).catch((e) => ({
      sent: false,
      reason: String(e && e.message ? e.message : e).slice(0, 200),
    }));

    if (!notify.sent) {
      console.warn(
        `[scan] lead captured but not emailed (${notify.reason}). ` +
          `Set an email provider and LEADS_EMAIL to receive lead alerts.`
      );
    }

    return res.status(200).json({
      preview: toPreview(result),
      report: delivery.sent ? null : report,
      gated: false,
      verified: true,
      emailed: delivery.sent,
      emailedTo: delivery.sent ? verifiedEmail : null,
      leadCaptured: true,
      notified: notify.sent,
    });
  } catch (err) {
    const message = String(err && err.message ? err.message : err).slice(0, 200);
    const isUserError = /domain|resolve|enter/i.test(message);
    return res.status(isUserError ? 400 : 500).json({ error: message });
  }
}