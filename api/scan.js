/* ============================================================
   Kernveil — /api/scan
   Public domain scanner.

   POST { host }            -> redacted preview (score + issue count)
   POST { host, email }     -> full report emailed to the visitor, and the
                               lead is emailed to the owner

   Email delivery is best-effort. If the visitor's message cannot be
   sent, the full report is returned in the response instead so the
   scan page can fall back to showing it rather than dead-ending.

   Rate limiting is in-memory and therefore best-effort: it protects a
   warm function instance but resets on cold start and is not shared
   across concurrent instances. That is acceptable for a free lead
   magnet; put a real limiter in front of it if it ever gets abused.
   ============================================================ */

import { scanHost, toPreview } from "./lib/scanCore.js";
import { buildReportHtml, buildReportText, buildReportSubject } from "./lib/reportEmail.js";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

/** Shared transport so every send reports failures the same way. */
async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY not configured" };

  const payload = {
    from: process.env.LEADS_FROM || "Kernveil <onboarding@resend.dev>",
    to: [to],
    subject,
  };
  if (html) payload.html = html;
  if (text) payload.text = text;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { sent: false, reason: `resend ${res.status}: ${detail.slice(0, 240)}` };
  }
  return { sent: true };
}

/** Sends the visitor their report. This is the thing the lead is buying. */
async function deliverReport({ email, report }) {
  return sendEmail({
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

  return sendEmail({
    to,
    subject: `Scan lead: ${host} (grade ${result.grade}, ${result.totals.fail} failing)`,
    text: [
      `New scan lead`,
      ``,
      `Domain: ${host}`,
      `Their email: ${email}`,
      `Score: ${result.score}/100 (${result.grade})`,
      `Findings: ${result.totals.fail} fail, ${result.totals.warn} warn, ${result.totals.pass} pass`,
      `Report emailed to them: ${delivery && delivery.sent ? "yes" : "NO - " + (delivery && delivery.reason)}`,
      ``,
      `Issues:`,
      issues || "  (none)",
    ].join("\n"),
  });
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
  try {
    const raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    host = raw.host;
    email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  } catch {
    return res.status(400).json({ error: "Malformed request." });
  }

  try {
    const result = await scanHost(host);
    const wantsFull = EMAIL_RE.test(email);

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
    const delivery = await deliverReport({ email, report }).catch((e) => ({
      sent: false,
      reason: String(e && e.message ? e.message : e).slice(0, 240),
    }));

    if (!delivery.sent) {
      console.warn(`[scan] report email to ${email} failed: ${delivery.reason}`);
    }

    // Owner notification must never cost the visitor their report, but it
    // must never be silent either - otherwise leads disappear unnoticed.
    const notify = await notifyLead({
      host: result.host,
      email,
      result,
      delivery,
    }).catch((e) => ({
      sent: false,
      reason: String(e && e.message ? e.message : e).slice(0, 200),
    }));

    if (!notify.sent) {
      console.warn(
        `[scan] lead captured but not emailed (${notify.reason}). ` +
          `Set RESEND_API_KEY and LEADS_EMAIL to receive lead alerts.`
      );
    }

    return res.status(200).json({
      preview: toPreview(result),
      report: delivery.sent ? null : report,
      gated: false,
      emailed: delivery.sent,
      emailedTo: delivery.sent ? email : null,
      leadCaptured: true,
      notified: notify.sent,
    });
  } catch (err) {
    const message = String(err && err.message ? err.message : err).slice(0, 200);
    const isUserError = /domain|resolve|enter/i.test(message);
    return res.status(isUserError ? 400 : 500).json({ error: message });
  }
}