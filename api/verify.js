/* ============================================================
   Kernveil — /api/verify
   Sends a one-time code so we know an address is real before handing over a
   report. This is what stops junk leads: a visitor cannot unlock a report
   with an address they do not control.

   The code is held in memory with a short expiry. That is fine for a
   single-instance lead magnet; a real deployment would move it to a
   shared store.
   ============================================================ */

import { validateEmail } from "./lib/emailGuard.js";
import { send, canReachVisitors, makeCode } from "./lib/mailer.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_IP_HOUR = 5;
const MAX_SENDS_PER_EMAIL_HOUR = 3;
const RESEND_AFTER_MS = 45 * 1000;

const codes = new Map(); // email -> { code, expires, sentAt, tries }
const ipHits = new Map(); // ip -> [timestamps]

function prune() {
  const now = Date.now();
  for (const [k, v] of codes) if (v.expires < now) codes.delete(k);
  for (const [k, list] of ipHits) {
    const kept = list.filter((t) => now - t < 3600_000);
    if (kept.length) ipHits.set(k, kept);
    else ipHits.delete(k);
  }
}

function ipRateLimited(ip) {
  const now = Date.now();
  const list = (ipHits.get(ip) || []).filter((t) => now - t < 3600_000);
  if (list.length >= MAX_SENDS_PER_IP_HOUR) {
    ipHits.set(ip, list);
    return true;
  }
  list.push(now);
  ipHits.set(ip, list);
  return false;
}

function emailRateLimited(email) {
  const entry = codes.get(email);
  if (!entry) return false;
  return entry.sentAt && Date.now() - entry.sentAt < RESEND_AFTER_MS;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.headers["x-real-ip"] || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  prune();

  let email;
  try {
    const raw = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    email = raw.email;
  } catch {
    return res.status(400).json({ error: "Malformed request." });
  }

  const check = validateEmail(email);
  if (!check.ok) return res.status(400).json({ error: check.error });

  if (!canReachVisitors()) {
    return res.status(503).json({
      error: "Email verification is not switched on yet.",
      code: "NO_PROVIDER",
    });
  }

  const ip = clientIp(req);
  if (ipRateLimited(ip)) {
    return res.status(429).json({
      error: "Too many verification emails requested from this network. Try again later.",
    });
  }
  if (emailRateLimited(check.email)) {
    return res.status(429).json({
      error: "We already sent a code to that address a moment ago. Give it a minute.",
    });
  }

  const code = makeCode();
  codes.set(check.email, { code, expires: Date.now() + CODE_TTL_MS, sentAt: Date.now(), tries: 0 });

  const result = await send({
    to: check.email,
    subject: `${code} is your Kernveil verification code`,
    text: [
      `Your Kernveil verification code is ${code}`,
      ``,
      `Enter it to receive your security report.`,
      `The code expires in 10 minutes and can only be used once.`,
      ``,
      `If you did not request a scan, you can ignore this email.`,
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#0a0a0b;font-family:-apple-system,Segoe UI,Inter,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#161618;border:1px solid #242427;border-radius:14px;">
<tr><td style="padding:32px;">
<p style="margin:0 0 20px;font:600 16px/1 -apple-system,Segoe UI,Inter,sans-serif;color:#f0f0f2;letter-spacing:-0.02em;">Kernveil</p>
<p style="margin:0 0 8px;font:400 14px/1.6 -apple-system,Segoe UI,Inter,sans-serif;color:#a0a0a8;">Your verification code is</p>
<p style="margin:0 0 20px;font:600 34px/1 -apple-system,Segoe UI,Inter,sans-serif;color:#7fe0bd;letter-spacing:8px;">${code}</p>
<p style="margin:0;font:400 13px/1.6 -apple-system,Segoe UI,Inter,sans-serif;color:#68686e;">This expires in 10 minutes. If you did not request a scan, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`,
  });

  if (!result.sent) {
    console.warn(`[verify] could not send code to ${check.email}: ${result.reason}`);
    return res.status(502).json({
      error: "We could not send that code. Please try again in a moment.",
      code: "SEND_FAILED",
    });
  }

  return res.status(200).json({ sent: true, email: check.email });
}

/** Exposed for /api/scan, which needs to check a submitted code. */
export const store = codes;