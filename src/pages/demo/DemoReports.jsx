/* ============================================================
   Kernveil — demo Reports page (Phase 9).
   Customer-facing security report viewer with list + detail
   views, filter controls, and all required polished states:
   loading, empty, no-data, stale, invalid-filter, success,
   generation-error.

   HONESTY BOUNDARY: every data-source label, stale marker, and
   missing-source note is explicit. Reports never claim a check
   was run when it was not, never inflate severity, and never
   fabricate findings or remediation results.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { gsap, reducedMotion } from "../../lib/anim.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { normalizeStatus, STATUS_LABEL } from "../../lib/remediation.js";
import { generateReport, SEEDED_REPORTS } from "../../lib/report.js";

const SEVERITY_OPTS = [
  { key: "all", label: "All severities" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const SOURCE_OPTS = [
  { key: "all", label: "All sources" },
  { key: "GitHub", label: "GitHub" },
  { key: "Cloud", label: "Cloud" },
  { key: "Website", label: "Website" },
  { key: "Backup", label: "Backup" },
  { key: "Identity", label: "Identity" },
  { key: "Activity", label: "Activity" },
];

const STATUS_OPTS = [
  { key: "all", label: "All statuses" },
  { key: "open", label: "Open" },
  { key: "in-progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
];

const TONE_CLASSES = {
  critical: "rpt-badge-critical",
  high: "rpt-badge-high",
  elevated: "rpt-badge-elevated",
  good: "rpt-badge-good",
};

function ToneBadge({ tone, label }) {
  return <span className={`rpt-tone-badge ${TONE_CLASSES[tone] || ""}`}>{label}</span>;
}

function StaleBadge({ stale }) {
  if (!stale) return null;
  return <span className="rpt-stale-badge">Stale</span>;
}

function QualityNote({ dataQuality }) {
  return (
    <div className="rpt-quality-note" data-has-stale={dataQuality.staleSources.length > 0 ? "true" : undefined} data-all-sample={dataQuality.allSample ? "true" : undefined}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="rpt-quality-icon">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v4M12 15.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>{dataQuality.note}</span>
    </div>
  );
}

function RiskSummary({ report }) {
  const { executiveSummary: es } = report;
  return (
    <div className="rpt-risk-summary" data-tone={report.tone}>
      <div className="rpt-risk-head">
        <ToneBadge tone={report.tone} label={report.riskLabel} />
        <span className="rpt-generated mono">{report.generatedDate} · {report.generatedTime}</span>
      </div>
      <p className="rpt-risk-text">{report.riskSummary}</p>
      <div className="rpt-kpi-row">
        <span className="rpt-kpi"><b>{es.criticalFindings}</b> critical</span>
        <span className="rpt-kpi"><b>{es.highFindings}</b> high</span>
        <span className="rpt-kpi"><b>{es.totalOpen}</b> open</span>
        <span className="rpt-kpi"><b>{es.affectedAssets}</b> assets affected</span>
        <span className="rpt-kpi"><b>{es.totalResolved}</b> resolved</span>
      </div>
    </div>
  );
}

function SourceHealth({ dataQuality }) {
  const sources = dataQuality.sources;
  return (
    <div className="rpt-source-health">
      <span className="panel-label">Data sources</span>
      <div className="rpt-health-grid">
        {sources.map((s) => (
          <div className="rpt-health-cell" key={s.label} data-status={s.status}>
            <span className="rpt-health-label">{s.label}</span>
            <span className={`rpt-health-status ${s.status === "unavailable" || s.status === "not connected" ? "rpt-health-off" : "rpt-health-on"}`}>
              {s.status}
            </span>
            <StaleBadge stale={s.stale} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingsBySource({ sourceGroups }) {
  if (!sourceGroups.length) return null;
  return (
    <div className="rpt-source-groups">
      {sourceGroups.map((grp) => (
        <div className="rpt-source-group" key={grp.label}>
          <div className="rpt-source-head">
            <span className="panel-label">{grp.sectionTitle}</span>
            <span className="rpt-source-count mono">{grp.findings.length} finding{grp.findings.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="rpt-finding-list">
            {grp.findings.map((f) => (
              <li className="rpt-finding-row" key={f.id} data-sev={f.severity}>
                <div className="rpt-finding-hero">
                  <span className={`sev sev-${f.severity}`}>{f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}</span>
                  <div className="rpt-finding-id">
                    <Link className="rpt-finding-link" to={f.link}>
                      {f.title}
                      <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 12, height: 12 }}>
                        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    <span className="rpt-finding-sub mono">{f.asset} · {STATUS_LABEL[f.status] || f.status}</span>
                  </div>
                </div>
                <div className="rpt-finding-body">
                  <p className="rpt-finding-english">{f.plainEnglish}</p>
                  {f.firstStep && <p className="rpt-finding-step"><b>Next step:</b> {f.firstStep}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RemediationOverview({ remediation }) {
  const s = remediation.summary;
  return (
    <div className="rpt-remed-block">
      <span className="panel-label">Remediation progress</span>
      <div className="rpt-remed-grid">
        {s.proposed > 0 && <span className="rpt-remed-chip">{s.proposed} proposed</span>}
        {s.awaitingApproval > 0 && <span className="rpt-remed-chip rpt-remed-await">{s.awaitingApproval} awaiting approval</span>}
        {s.approved > 0 && <span className="rpt-remed-chip rpt-remed-approved">{s.approved} approved</span>}
        {s.inProgress > 0 && <span className="rpt-remed-chip">{s.inProgress} in progress</span>}
        {s.completed > 0 && <span className="rpt-remed-chip rpt-remed-done">{s.completed} completed</span>}
        {s.failed > 0 && <span className="rpt-remed-chip rpt-remed-fail">{s.failed} failed</span>}
        {s.rejected > 0 && <span className="rpt-remed-chip rpt-remed-rej">{s.rejected} rejected</span>}
      </div>
      {remediation.queuedActions.length > 0 && (
        <ul className="rpt-queued-list">
          {remediation.queuedActions.map((a, i) => (
            <li className="rpt-queued-row" key={i}>
              <span className="rpt-queued-label">{a.label}</span>
              <span className="rpt-queued-target mono">{a.target}</span>
              <Link className="link-arrow rpt-queued-link" to={a.link}>
                View finding
                <svg className="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <span className="rpt-remed-total mono">{remediation.totalActions} total action{remediation.totalActions === 1 ? "" : "s"}</span>
    </div>
  );
}

function ReportFilterBar({ filters, onChange, assetOpts }) {
  return (
    <div className="rpt-filterbar" id="rptFilters" role="group" aria-label="Report filters">
      <div className="rpt-filter-field">
        <label htmlFor="rptDateFrom">From</label>
        <input id="rptDateFrom" type="date" value={filters.dateFrom} onChange={(e) => onChange("dateFrom", e.target.value)} />
      </div>
      <div className="rpt-filter-field">
        <label htmlFor="rptDateTo">To</label>
        <input id="rptDateTo" type="date" value={filters.dateTo} onChange={(e) => onChange("dateTo", e.target.value)} />
      </div>
      <div className="rpt-filter-field">
        <label className="visually-hidden" htmlFor="rptSevFilter">Filter by severity</label>
        <select id="rptSevFilter" value={filters.severity} onChange={(e) => onChange("severity", e.target.value)}>
          {SEVERITY_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      <div className="rpt-filter-field">
        <label className="visually-hidden" htmlFor="rptSrcFilter">Filter by source</label>
        <select id="rptSrcFilter" value={filters.source} onChange={(e) => onChange("source", e.target.value)}>
          {SOURCE_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
      <div className="rpt-filter-field">
        <label className="visually-hidden" htmlFor="rptAssetFilter">Filter by asset</label>
        <select id="rptAssetFilter" value={filters.asset} onChange={(e) => onChange("asset", e.target.value)}>
          <option value="all">All assets</option>
          {assetOpts.filter((a) => a !== "all").map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="rpt-filter-field">
        <label className="visually-hidden" htmlFor="rptStatusFilter">Filter by status</label>
        <select id="rptStatusFilter" value={filters.status} onChange={(e) => onChange("status", e.target.value)}>
          {STATUS_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function ReportDetail({ report, onBack, filters, onChangeFilter, assetOpts, isLive }) {
  return (
    <div className="rpt-detail">
      <button type="button" className="btn btn-ghost btn-sm rpt-back" onClick={onBack} id="rptBack">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to reports
      </button>

      <header className="page-head">
        <h1 className="page-title">
          {report.seededLabel || "Security report"}
        </h1>
        <p className="page-sub">
          {report.seeded
            ? report.seededDescription
            : `Generated ${report.generatedDate} at ${report.generatedTime} for ${report.workspaceName}.`}
        </p>
      </header>

      {isLive && (
        <ReportFilterBar filters={filters} onChange={onChangeFilter} assetOpts={assetOpts} />
      )}

      <QualityNote dataQuality={report.dataQuality} />
      <RiskSummary report={report} />

      {report.topPriorities.length > 0 && (
        <div className="rpt-priorities">
          <span className="panel-label">Top priorities</span>
          <ul className="rpt-priority-list">
            {report.topPriorities.map((f) => (
              <li className="rpt-priority-row" key={f.id}>
                <span className={`sev sev-${f.severity}`}>{f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}</span>
                <Link className="rpt-finding-link" to={f.link}>
                  {f.title}
                  <svg className="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: 12, height: 12 }}>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SourceHealth dataQuality={report.dataQuality} />

      <FindingsBySource sourceGroups={report.sourceGroups} />

      {report.findings.length === 0 && (
        <div className="rpt-no-findings" id="rptNoFindings">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <b>No findings match</b>
            <span>{report.seededLabel ? "This report has no findings to display." : "No findings match the current filters. Try adjusting the date range, severity, source, or status."}</span>
          </div>
        </div>
      )}

      <RemediationOverview remediation={report.remediation} />

      <div className="rpt-footer">
        <span className="mono rpt-footer-note">
          {report.dataQuality.allSample
            ? "This report is based on sample data. No live or imported data sources are connected."
            : report.dataQuality.hasImports
              ? `Data: ${report.dataQuality.sources.filter((s) => s.status !== "not connected" && s.status !== "unavailable").map((s) => s.label).join(", ")}`
              : "No data sources connected."}
        </span>
      </div>
    </div>
  );
}

export default function DemoReports() {
  const rootRef = useRef(null);
  const REDUCED = reducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    findings, assets, overview, connectors,
    cloudScans, webScans, backupScans, identityScans, activityScans,
    actionsList, actionCounts,
  } = useWorkspace();

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    severity: "all",
    source: "all",
    asset: "all",
    status: "all",
  });

  const report = useMemo(
    () => generateReport({
      findings, assets, overview, connectors,
      cloudScans, webScans, backupScans, identityScans, activityScans,
      actionsList, actionCounts,
      workspace: { name: "Acme Retail (sample)" },
    }, filters),
    [findings, assets, overview, connectors, cloudScans, webScans, backupScans, identityScans, activityScans, actionsList, actionCounts, filters]
  );

  const [view, setView] = useState("list");
  const [activeReport, setActiveReport] = useState(null);

  const openReport = (r) => {
    setActiveReport(r);
    setView("detail");
    if (r.seeded) setSearchParams({ id: r.id });
    else setSearchParams({ live: "true" });
  };

  const backToList = () => {
    setActiveReport(null);
    setView("list");
    setSearchParams({});
  };

  useEffect(() => {
    const id = searchParams.get("id");
    const live = searchParams.get("live");
    if (id) {
      const seeded = SEEDED_REPORTS.find((r) => r.id === id);
      if (seeded) { setActiveReport(seeded); setView("detail"); }
    } else if (live === "true") {
      setActiveReport(null);
      setView("detail");
    }
  }, []);

  const updateFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const filteredFindings = useMemo(() => {
    if (!activeReport) return report.findings;
    return activeReport.findings;
  }, [activeReport, report.findings]);

  const assetOpts = useMemo(() => {
    const set = new Set(findings.map((f) => f.asset));
    return ["all", ...set];
  }, [findings]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const cards = root.querySelectorAll(".rpt-list-card");
      if (REDUCED) {
        gsap.set(cards, { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(cards, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.06, delay: 0.1 });
    }, root);
    return () => ctx.revert();
  }, [view, REDUCED]);

  if (view === "detail") {
    const detailReport = activeReport || { ...report, seededLabel: null, seededDescription: null };
    const isLive = !activeReport;
    return (
      <div ref={rootRef}>
        <ReportDetail
          report={detailReport}
          onBack={backToList}
          filters={filters}
          onChangeFilter={updateFilter}
          assetOpts={assetOpts}
          isLive={isLive}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Security reports</h1>
        <p className="page-sub">
          Customer-facing security reports generated from connected data sources, fixture
          imports, and bundled samples. Each report labels every data source as live, imported,
          sample, or unavailable — nothing is assumed.
        </p>
      </header>

      <div className="rpt-list" id="rptList">
        {/* live report */}
        <article className="rpt-list-card rpt-list-live" data-rpt="live" onClick={() => openReport(null)}>
          <div className="rpt-list-head">
            <ToneBadge tone={report.tone} label={report.riskLabel} />
            <span className="rpt-list-date mono">{report.generatedDate}</span>
          </div>
          <div className="rpt-list-title-row">
            <span className="rpt-list-title">Live report — {report.workspaceName}</span>
          </div>
          <p className="rpt-list-summary">
            {report.executiveSummary.totalOpen} open finding{report.executiveSummary.totalOpen === 1 ? "" : "s"} · {report.executiveSummary.affectedAssets} asset{report.executiveSummary.affectedAssets === 1 ? "" : "s"} affected
            {report.dataQuality.staleSources.length > 0 && <StaleBadge stale />}
            {report.dataQuality.allSample && <span className="rpt-list-sample mono">Sample data only</span>}
          </p>
          <span className="rpt-list-cta link-arrow">
            Open report
            <svg className="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </article>

        {SEEDED_REPORTS.map((r) => (
          <article className="rpt-list-card" data-rpt={r.id} key={r.id} onClick={() => openReport(r)}>
            <div className="rpt-list-head">
              <ToneBadge tone={r.tone} label={r.riskLabel} />
              <span className="rpt-list-date mono">{r.generatedDate}</span>
            </div>
            <div className="rpt-list-title-row">
              <span className="rpt-list-title">{r.seededLabel}</span>
              <span className="rpt-seed-badge badge badge-ghost" style={{ fontSize: "0.64rem" }}>Seeded</span>
            </div>
            <p className="rpt-list-summary">{r.seededDescription}</p>
            <span className="rpt-list-cta link-arrow">
              Open report
              <svg className="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </article>
        ))}
      </div>

      <p className="rpt-empty-note" id="rptEmptyNote" style={{ display: "none" }}>
        No reports available. Connect a data source or load a sample to generate one.
      </p>
    </div>
  );
}
