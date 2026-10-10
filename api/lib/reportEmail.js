/* ============================================================
   Kernveil — scan report email
   Builds the HTML + plain-text report that is delivered to the
   visitor's inbox. Email clients are hostile to modern CSS, so
   everything here is table-based with inline styles only.
   ============================================================ */

const INK = "#f0f0f2";
const INK_2 = "#a0a0a8";
const INK_3 = "#68686e";
const BG = "#0a0a0b";
const CARD = "#161618";
const CARD_2 = "#0e0e10";
const LINE = "#242427";
const TEAL = "#63d2a9";
const TEAL_BRIGHT = "#7fe0bd";

const TONE = {
  pass: { color: "#56c98f", bg: "#152520", label: "Pass" },
  warn: { color: "#e6b45e", bg: "#241f14", label: "Needs work" },
  fail: { color: "#e0646e", bg: "#241416", label: "Failing" },
  unknown: { color: "#8494a7", bg: "#161a1f", label: "Not checked" },
};

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gradeWord(grade) {
  return (
    { A: "Strong", B: "Good", C: "Needs work", D: "Weak", F: "At risk" }[grade] || "Unknown"
  );
}

function longDate(iso) {
  try {
    return new Date(iso).toUTCString().replace(" GMT", " UTC");
  } catch {
    return iso;
  }
}

function badge(status) {
  const t = TONE[status] || TONE.unknown;
  return (
    `<span style="display:inline-block;padding:3px 9px;border-radius:4px;` +
    `background:${t.bg};color:${t.color};font-size:11px;font-weight:700;` +
    `letter-spacing:0.06em;text-transform:uppercase;">${esc(t.label)}</span>`
  );
}

function checkBlock(check) {
  const evidence = (check.evidence || [])
    .map(
      (e) =>
        `<tr>` +
        `<td style="padding:5px 12px 5px 0;color:${INK_3};font:12px/1.5 'SFMono-Regular',Consolas,monospace;` +
        `vertical-align:top;white-space:nowrap;">${esc(e.key)}</td>` +
        `<td style="padding:5px 0;color:${INK_2};font:12px/1.5 'SFMono-Regular',Consolas,monospace;` +
        `word-break:break-word;">${esc(e.value)}</td>` +
        `</tr>`
    )
    .join("");

  const fix = check.fix
    ? `<tr><td colspan="2" style="padding:12px 0 0;border-top:1px dashed ${LINE};">` +
      `<span style="color:${TEAL};font-weight:700;">How to fix it. </span>` +
      `<span style="color:${INK_2};font-size:13px;line-height:1.6;">${esc(check.fix)}</span></td></tr>`
    : "";

  return (
    `<tr><td colspan="2" style="padding:0 0 14px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD_2};` +
    `border:1px solid ${LINE};border-radius:10px;">` +
    `<tr><td style="padding:16px 18px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td style="font:600 15px/1.4 -apple-system,Segoe UI,Inter,sans-serif;color:${INK};">${esc(check.title)}</td>` +
    `<td align="right" style="white-space:nowrap;">${badge(check.status)}</td>` +
    `</tr></table>` +
    `<p style="margin:8px 0 0;font:400 13px/1.6 -apple-system,Segoe UI,Inter,sans-serif;color:${INK_2};">${esc(check.summary)}</p>` +
    (evidence
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${evidence}</table>`
      : "") +
    (fix ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fix}</table>` : "") +
    `</td></tr>` +
    `</table></td></tr>`
  );
}

/** Full HTML report delivered to the visitor. */
export function buildReportHtml(report) {
  const { host, score, grade, totals, checks, scannedAt } = report;
  const failing = checks.filter((c) => c.status === "fail");
  const warning = checks.filter((c) => c.status === "warn");

  let headline;
  if (failing.length === 0 && warning.length === 0) {
    headline = "We found nothing that needs fixing in the checks we ran. That is a genuinely good result.";
  } else if (failing.length > 0) {
    headline = `${failing.length} of ${checks.length} checks are failing. These are worth fixing before anyone else finds them.`;
  } else {
    headline = `${warning.length} of ${checks.length} checks could be stronger. Nothing is urgent, but there is real room to improve.`;
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Security report for ${esc(host)}</title></head>
<body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

  <tr><td style="padding:0 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font:600 17px/1 -apple-system,Segoe UI,Inter,sans-serif;color:${INK};letter-spacing:-0.02em;">Kernveil</td>
      <td align="right" style="font:400 12px/1 -apple-system,Segoe UI,Inter,sans-serif;color:${INK_3};">Security report</td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:28px;background:${CARD};border:1px solid ${LINE};border-radius:14px;">
    <p style="margin:0;font:12px/1 -apple-system,Segoe UI,Inter,sans-serif;color:${TEAL};letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Website security check</p>
    <h1 style="margin:12px 0 0;font:600 24px/1.25 -apple-system,Segoe UI,Inter,sans-serif;color:${INK};letter-spacing:-0.02em;word-break:break-all;">${esc(host)}</h1>
    <p style="margin:10px 0 0;font:400 14px/1.65 -apple-system,Segoe UI,Inter,sans-serif;color:${INK_2};">${esc(headline)}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr>
      <td style="padding-right:20px;">
        <div style="width:64px;height:64px;border-radius:12px;background:${TONE[failing.length ? "fail" : "pass"].bg};border:1px solid ${LINE};text-align:center;padding-top:16px;font:600 26px/32px -apple-system,Segoe UI,Inter,sans-serif;color:${TEAL_BRIGHT};">${esc(grade)}</div>
      </td>
      <td style="vertical-align:middle;">
        <div style="font:600 15px/1.3 -apple-system,Segoe UI,Inter,sans-serif;color:${INK};">${esc(gradeWord(grade))}</div>
        <div style="margin-top:3px;font:400 13px/1.4 -apple-system,Segoe UI,Inter,sans-serif;color:${INK_2};">${score}/100 overall</div>
        <div style="margin-top:3px;font:400 12px/1.4 -apple-system,Segoe UI,Inter,sans-serif;color:${INK_3};">${totals.pass} pass &middot; ${totals.warn} warn &middot; ${totals.fail} fail</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:26px 0 0;">
    <p style="margin:0 0 14px;font:600 15px/1.4 -apple-system,Segoe UI,Inter,sans-serif;color:${INK};">Every check, in detail</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${checks.map(checkBlock).join("")}</table>
  </td></tr>

  <tr><td style="padding:10px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${LINE};border-radius:12px;">
      <tr><td style="padding:24px;">
        <p style="margin:0;font:600 16px/1.4 -apple-system,Segoe UI,Inter,sans-serif;color:${INK};">Most sites break the same way, quietly.</p>
        <p style="margin:8px 0 18px;font:400 14px/1.65 -apple-system,Segoe UI,Inter,sans-serif;color:${INK_2};">A certificate expires, a header gets dropped in a redesign, a DMARC policy gets weakened. Kernveil re-checks weekly and tells you the moment something changes, so you fix it before it becomes an incident.</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${TEAL};border-radius:8px;">
            <a href="https://kernveil.vercel.app/scan" style="display:inline-block;padding:11px 20px;font:600 14px/1 -apple-system,Segoe UI,Inter,sans-serif;color:#0a0a0b;text-decoration:none;">Re-scan this domain</a>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:28px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">
      <tr><td style="padding-top:18px;font:400 12px/1.7 -apple-system,Segoe UI,Inter,sans-serif;color:${INK_3};">
        Scanned ${esc(longDate(scannedAt))}. Results are a point-in-time read of publicly reachable data.<br><br>
        TLS is inferred from HTTPS reachability and public certificate logs, so cipher-level detail is not included.
        DKIM is only reported when a key exists on a common selector.<br><br>
        You received this because you requested a scan at kernveil.vercel.app.
      </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

/** Plain-text alternative for clients that do not render HTML. */
export function buildReportText(report) {
  const { host, score, grade, totals, checks, scannedAt } = report;
  const lines = [
    "KERNVEIL - WEBSITE SECURITY REPORT",
    "",
    `Domain:  ${host}`,
    `Grade:   ${grade} (${score}/100)`,
    `Result:  ${totals.pass} pass, ${totals.warn} warn, ${totals.fail} fail`,
    "",
    "EVERY CHECK",
    "",
  ];
  for (const c of checks) {
    const t = TONE[c.status] || TONE.unknown;
    lines.push(`[${t.label.toUpperCase()}] ${c.title}`);
    lines.push(`  ${c.summary}`);
    for (const e of c.evidence || []) {
      lines.push(`    ${e.key}: ${e.value}`);
    }
    if (c.fix) {
      lines.push(`  FIX: ${c.fix}`);
    }
    lines.push("");
  }
  lines.push(
    "Most sites break the same way, quietly. A certificate expires, a header gets",
    "dropped in a redesign, a DMARC policy gets weakened. Kernveil re-checks weekly",
    "and tells you when something changes.",
    "",
    "Re-scan: https://kernveil.vercel.app/scan",
    "",
    `Scanned ${longDate(scannedAt)}.`,
    "TLS is inferred from HTTPS reachability and certificate-transparency logs.",
    "You received this because you requested a scan at kernveil.vercel.app."
  );
  return lines.join("\n");
}

/** Subject line, tuned so it reads well in a crowded inbox. */
export function buildReportSubject(report) {
  const { host, grade, totals } = report;
  if (totals.fail === 0 && totals.warn === 0) return `Security report for ${host} - nothing urgent`;
  if (totals.fail === 0) return `Security report for ${host} - ${totals.warn} item${totals.warn > 1 ? "s" : ""} to improve`;
  return `Security report for ${host} - ${totals.fail} issue${totals.fail > 1 ? "s" : ""} found`;
}