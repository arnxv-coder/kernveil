import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/Icons.jsx";

const STATUS_META = {
  pass: { label: "Pass", tone: "ok" },
  warn: { label: "Needs work", tone: "warn" },
  fail: { label: "Failing", tone: "bad" },
  unknown: { label: "Not checked", tone: "none" },
};

const GRADE_TONE = { A: "ok", B: "ok", C: "warn", D: "bad", F: "bad" };

function gradeWord(grade) {
  return { A: "Strong", B: "Good", C: "Needs work", D: "Weak", F: "At risk" }[grade] || "Unknown";
}

export default function ScanPage() {
  const [host, setHost] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);
  const [notice, setNotice] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const resultRef = useRef(null);

  useEffect(() => {
    const el = resultRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    el.animate(
      [
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.22,1,0.36,1)" }
    );
  }, [preview, report]);

  const runScan = useCallback(async (withEmail) => {
    const value = host.trim();
    if (!value) {
      setError("Enter a domain to scan.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    if (withEmail) setUnlocking(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: value, ...(withEmail ? { email: email.trim() } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That scan could not be completed. Try again.");
        return;
      }
      setPreview(data.preview || null);
      if (data.report) {
        setReport(data.report);
        setNotice("Report unlocked. We sent a copy to your inbox.");
      } else if (data.message) {
        setError(data.message);
      }
    } catch {
      setError("Network error — the scan could not be reached.");
    } finally {
      setBusy(false);
      setUnlocking(false);
    }
  }, [host, email]);

  const onSubmit = (e) => {
    e.preventDefault();
    runScan(false);
  };

  const onUnlock = (e) => {
    e.preventDefault();
    runScan(true);
  };

  const reset = () => {
    setPreview(null);
    setReport(null);
    setError(null);
    setNotice(null);
    setEmail("");
  };

  return (
    <div className="scan-page">
      <header className="scan-nav">
        <Link to="/" className="scan-brand">
          <BrandMark />
          <span>Kernveil</span>
        </Link>
        <Link to="/" className="scan-back">← Back to site</Link>
      </header>

      <main className="scan-main">
        <section className="scan-hero">
          <p className="scan-eyebrow">Free domain security check</p>
          <h1 className="scan-title">Is your website secure?</h1>
          <p className="scan-lede">
            We check your live domain for the misconfigurations attackers actually use:
            missing HTTPS enforcement, absent security headers, broken email authentication,
            and publicly exposed files.
          </p>
        </section>

        <form className="scan-form" onSubmit={onSubmit}>
          <label className="scan-label" htmlFor="scan-host">Your domain</label>
          <div className="scan-row">
            <input
              id="scan-host"
              className="scan-input"
              type="text"
              inputMode="url"
              placeholder="example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              autoComplete="url"
              spellCheck="false"
            />
            <button className="scan-go" type="submit" disabled={busy}>
              {busy && !unlocking ? "Scanning…" : "Scan my domain"}
            </button>
          </div>
          <p className="scan-hint">A real scan, not a sample. Nothing is stored without your email.</p>
        </form>

        {error && (
          <div className="scan-alert scan-alert-bad" role="alert">{error}</div>
        )}

        {notice && (
          <div className="scan-alert scan-alert-ok" role="status">{notice}</div>
        )}

        {preview && preview.resolvable && (
          <section className="scan-result" ref={resultRef}>
            {!report ? (
              <div className="scan-teaser">
                <div className="scan-score">
                  <span className="scan-grade" data-tone={GRADE_TONE[preview.grade] || "none"}>
                    {preview.grade}
                  </span>
                  <div className="scan-score-meta">
                    <strong>{preview.host}</strong>
                    <span>{gradeWord(preview.grade)} — {preview.score}/100</span>
                  </div>
                </div>
                <p className="scan-teaser-line">
                  {preview.issues > 0
                    ? `${preview.issues} issue${preview.issues > 1 ? "s" : ""} found.`
                    : "No issues found in the checks we ran."}
                </p>
                <div className="scan-gate">
                  <p className="scan-gate-title">Get the full report</p>
                  <p className="scan-gate-sub">
                    Every failing check, the exact record we found, and how to fix it.
                  </p>
                  <form className="scan-row" onSubmit={onUnlock}>
                    <input
                      className="scan-input"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                    <button className="scan-go" type="submit" disabled={busy}>
                      {unlocking ? "Unlocking…" : "Unlock report"}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="scan-full">
                <div className="scan-score">
                  <span className="scan-grade" data-tone={GRADE_TONE[report.grade] || "none"}>
                    {report.grade}
                  </span>
                  <div className="scan-score-meta">
                    <strong>{report.host}</strong>
                    <span>{gradeWord(report.grade)} — {report.score}/100</span>
                  </div>
                </div>

                <ul className="scan-checks">
                  {report.checks.map((c) => {
                    const meta = STATUS_META[c.status] || STATUS_META.unknown;
                    return (
                      <li key={c.rule} className="scan-check" data-tone={meta.tone}>
                        <div className="scan-check-head">
                          <span className="scan-check-title">{c.title}</span>
                          <span className="scan-badge" data-tone={meta.tone}>{meta.label}</span>
                        </div>
                        <p className="scan-check-summary">{c.summary}</p>
                        {c.evidence && c.evidence.length > 0 && (
                          <dl className="scan-evidence">
                            {c.evidence.map((e, i) => (
                              <div key={i} className="scan-evidence-row">
                                <dt>{e.key}</dt>
                                <dd>{e.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {c.fix && <p className="scan-fix"><strong>Fix:</strong> {c.fix}</p>}
                      </li>
                    );
                  })}
                </ul>

                <div className="scan-cta">
                  <div>
                    <p className="scan-cta-title">Keep watching this automatically</p>
                    <p className="scan-cta-sub">
                      Weekly re-scans, an alert the moment something breaks or a certificate
                      is about to expire. $29/month, cancel anytime.
                    </p>
                  </div>
                  <a className="scan-go scan-go-ghost" href="mailto:playnav.yt@gmail.com?subject=Kernveil%20monitoring">
                    Start monitoring
                  </a>
                </div>

                <button className="scan-reset" type="button" onClick={reset}>Scan another domain</button>
              </div>
            )}
          </section>
        )}

        <section className="scan-what">
          <h2>What we check</h2>
          <ul>
            <li><strong>HTTPS enforcement</strong> — whether plain HTTP is upgraded and HSTS is set.</li>
            <li><strong>TLS certificate</strong> — validity and expiry, from public certificate logs.</li>
            <li><strong>Security headers</strong> — CSP, clickjacking and MIME-sniffing protection.</li>
            <li><strong>Email authentication</strong> — SPF, DKIM and DMARC, read from live DNS.</li>
            <li><strong>Exposed files</strong> — .env, .git, database dumps and config backups.</li>
          </ul>
        </section>
      </main>

      <footer className="scan-foot">
        <p>Scans are point-in-time and read public data only.</p>
      </footer>
    </div>
  );
}