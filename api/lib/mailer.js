/* ============================================================
   Kernveil — mail transport

   Two providers, one interface. Brevo is preferred because its free tier
   only requires a verified *sender address*, so it can deliver to any
   recipient. Resend requires a verified domain, which means in test mode
   it can only reach the account's own address.

   Configuration (Vercel environment variables):
     BREVO_API_KEY   - enables delivery to any recipient
     BREVO_FROM      - verified sender, e.g. "Kernveil <scan@example.com>"
     RESEND_API_KEY  - fallback; account-address-only in test mode
     LEADS_EMAIL     - where owner alerts go

   Every send reports { sent, provider, reason } so callers can log what
   actually happened rather than assuming.
   ============================================================ */

/** Stable 6-digit code generator (not a security token, just a gate). */
export function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendViaBrevo({ to, subject, html, text }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { sent: false, provider: "brevo", reason: "BREVO_API_KEY not configured" };

  const payload = {
    to: [{ email: to }],
    subject,
  };
  if (html) payload.htmlContent = html;
  if (text) payload.textContent = text;
  if (process.env.BREVO_FROM) {
    const m = process.env.BREVO_FROM.match(/^(.*)<([^>]+)>$/);
    payload.sender = m ? { name: m[1].trim(), email: m[2].trim() } : { name: "Kernveil", email: process.env.BREVO_FROM };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { sent: false, provider: "brevo", reason: `brevo ${res.status}: ${detail.slice(0, 240)}` };
  }
  return { sent: true, provider: "brevo" };
}

async function sendViaResend({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, provider: "resend", reason: "RESEND_API_KEY not configured" };

  const body = {
    from: process.env.LEADS_FROM || "Kernveil <onboarding@resend.dev>",
    to: [to],
    subject,
  };
  if (html) body.html = html;
  if (text) body.text = text;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { sent: false, provider: "resend", reason: `resend ${res.status}: ${detail.slice(0, 240)}` };
  }
  return { sent: true, provider: "resend" };
}

/**
 * Send one message, preferring any provider that can reach the recipient.
 * Order matters: Brevo first because it works without a domain.
 */
export async function send(message) {
  if (process.env.BREVO_API_KEY) {
    const viaBrevo = await sendViaBrevo(message).catch((e) => ({
      sent: false, provider: "brevo",
      reason: String(e && e.message ? e.message : e).slice(0, 240),
    }));
    if (viaBrevo.sent) return viaBrevo;
    // Fall through to Resend only if Resend could plausibly deliver.
    if (!process.env.RESEND_API_KEY) return viaBrevo;
    const viaResend = await sendViaResend(message).catch(() => ({
      sent: false, provider: "resend", reason: "unavailable",
    }));
    if (viaResend.sent) return viaResend;
    return viaBrevo;
  }

  if (process.env.RESEND_API_KEY) return sendViaResend(message).catch((e) => ({
    sent: false, provider: "resend",
    reason: String(e && e.message ? e.message : e).slice(0, 240),
  }));

  return { sent: false, provider: "none", reason: "no email provider configured" };
}

/** True when a provider exists that can reach an arbitrary recipient. */
export function canReachVisitors() {
  return Boolean(process.env.BREVO_API_KEY);
}