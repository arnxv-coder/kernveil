/* ============================================================
   Kernveil — stateless verification codes
   Endpoints run as separate serverless functions, so an in-memory map
   is unreliable: a code issued by /api/verify can be checked by a
   different instance of /api/scan that has never heard of it.

   Instead of storing anything, we issue the code itself as a signed,
   short-lived token. Whichever instance checks it can verify it using
   only the shared secret, so no shared state is required.

   Token shape (base64url payload + "." + base64url HMAC-SHA256).
   Payload: { code, email, exp }
   ============================================================ */

import crypto from "node:crypto";

const TTL_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;

/** The secret is required in production; a build-time fallback keeps local dev working. */
function secret() {
  const s = process.env.VERIFY_SECRET;
  if (s) return s;
  if (process.env.VERCEL) {
    throw new Error("VERIFY_SECRET must be set in production.");
  }
  return "kernveil-local-dev-secret-not-for-production";
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payloadB64) {
  return crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

/** Wrap a code in a signed, expiring token. */
export function issueToken(code, email) {
  const payload = { code, email, exp: Date.now() + TTL_MS };
  const b64 = b64url(JSON.stringify(payload));
  return `${b64}.${sign(b64)}`;
}

/**
 * Verify a submitted code.
 * @returns {{ok: true} | {ok: false, error: string, lockedUntil?: number}}
 */
export function checkToken(token, email, submittedCode) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, error: "Request a new code - the previous one is no longer valid." };
  }

  const [b64, mac] = token.split(".");
  const expected = sign(b64);

  // Constant-time compare so the signature cannot be brute-forced.
  const a = Buffer.from(mac || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "That verification link has been tampered with. Request a new code." };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "That verification link is not readable. Request a new code." };
  }

  if (!payload || typeof payload.exp !== "number") {
    return { ok: false, error: "That verification link is malformed. Request a new code." };
  }

  if (payload.exp < Date.now()) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  if (String(payload.email || "").toLowerCase() !== String(email || "").toLowerCase()) {
    return { ok: false, error: "That code was issued for a different address." };
  }

  if (String(payload.code) !== String(submittedCode || "").trim()) {
    const left = Math.max(0, MAX_TRIES - (payload.tries || 0) - 1);
    return {
      ok: false,
      error: left > 0
        ? `That code is not right. ${left} attempt${left > 1 ? "s" : ""} left.`
        : "Too many incorrect attempts. Request a new code.",
      tries: (payload.tries || 0) + 1,
      token: issueTokenWithTries(payload.code, payload.email, payload.exp, (payload.tries || 0) + 1),
    };
  }

  return { ok: true };
}

/** Re-issue a token with the failed-attempt counter preserved. */
function issueTokenWithTries(code, email, exp, tries) {
  const payload = { code, email, exp, tries };
  const b64 = b64url(JSON.stringify(payload));
  return `${b64}.${sign(b64)}`;
}

/** Reads the Set-Cookie values from a response so we can forward the token. */
export function cookieHeader(token, maxAgeSeconds) {
  return `kv_token=${token}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function tokenFromCookie(header) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "kv_token") return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function newCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}