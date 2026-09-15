/* ============================================================
   Kernveil — demo Findings list (filters + table)
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap, reducedMotion, SEV_RANK } from "../../lib/anim.jsx";
import { severityPill, statusBadge } from "../../components/demo/badges.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

const CATEGORIES = ["Exposure", "Configuration", "Dependencies", "Identity", "Repositories", "Backups", "Email security"];

function sorted(list) {
  return list.slice().sort((a, b) => {
    const ra = a.status === "completed" ? 1 : 0;
    const rb = b.status === "completed" ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return SEV_RANK[a.severity] - SEV_RANK[b.severity];
  });
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Proposed" },
  { key: "awaiting-approval", label: "Awaiting approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "in-progress", label: "In progress" },
  { key: "failed", label: "Failed" },
  { key: "completed", label: "Completed" },
];

export default function DemoFindings() {
  const rootRef = useRef(null);
  const tbodyRef = useRef(null);
  const REDUCED = reducedMotion();
  const navigate = useNavigate();
  const { findings: allFindings } = useWorkspace();

  const [term, setTerm] = useState("");
  const [sev, setSev] = useState("all");
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return sorted(allFindings).filter((f) => {
      if (sev !== "all" && f.severity !== sev) return false;
      if (status !== "all" && f.status !== status) return false;
      if (cat !== "all" && f.category !== cat) return false;
      if (q && !(f.title + f.asset + f.category + f.summary).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [term, sev, status, cat, allFindings]);

  const rowsKey = rows.map((f) => f.id).join(",");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      if (REDUCED) {
        gsap.set(".list-card", { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(".list-card", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" });
      }
    }, root);
    return () => ctx.revert();
  }, [rootRef, REDUCED]);

  useEffect(() => {
    const tbody = tbodyRef.current;
    if (!tbody || !rows.length) return;
    const ctx = gsap.context(() => {
      if (REDUCED) {
        gsap.set(tbody.children, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(tbody.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.34, ease: "power2.out", stagger: 0.018 });
      }
    }, tbody);
    return () => ctx.revert();
  }, [rowsKey, REDUCED]);

  const openDetail = (id) => navigate(`/demo-finding?id=${id}`);

  const Seg = ({ dataKey, options, value, onChange }) => (
    <div className="seg" role="group" aria-label={`Filter by ${dataKey}`}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={value === o.key ? "is-active" : undefined}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Findings</h1>
        <p className="page-sub">Every issue Kernveil has identified, prioritized by what matters most.</p>
      </header>

      <div className="list-card">
        <div className="table-filter-wrap">
          <div className="search-field">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <label className="visually-hidden" htmlFor="findingSearch">Search findings</label>
            <input id="findingSearch" type="search" placeholder="Search findings…" autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>

          <Seg
            dataKey="severity"
            value={sev}
            onChange={setSev}
            options={[
              { key: "all", label: "All" },
              { key: "critical", label: "Critical" },
              { key: "high", label: "High" },
              { key: "medium", label: "Medium" },
              { key: "low", label: "Low" },
            ]}
          />
        </div>

        <div className="table-filter-wrap" style={{ paddingTop: 0 }}>
          <div className="chip-set" role="group" aria-label="Filter by remediation status">
            {STATUS_FILTERS.map((o) => (
              <button
                key={o.key}
                type="button"
                className={`chip${status === o.key ? " is-active" : ""}`}
                aria-pressed={status === o.key}
                onClick={() => setStatus(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="chip-set" role="group" aria-label="Filter by category">
            <button type="button" className={`chip${cat === "all" ? " is-active" : ""}`} onClick={() => setCat("all")}>All categories</button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip${cat === c ? " is-active" : ""}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table" aria-label="Findings list">
            <thead>
              <tr>
                <th scope="col">Finding</th>
                <th scope="col">Severity</th>
                <th scope="col">Affected asset</th>
                <th scope="col">Status</th>
                <th scope="col">First detected</th>
                <th scope="col">Last checked</th>
              </tr>
            </thead>
            <tbody id="findingRows" ref={tbodyRef} style={rows.length ? undefined : { display: "none" }}>
              {rows.map((f) => (
                <tr
                  key={f.id}
                  data-id={f.id}
                  tabIndex="0"
                  role="button"
                  aria-label={`Open finding: ${f.title}`}
                  onClick={() => openDetail(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(f.id);
                    }
                  }}
                >
                  <td>
                    <div className="finding-row">
                      <span className="f-title">{f.title}</span>
                      <span className="cell-sub">{f.category}</span>
                    </div>
                  </td>
                  <td>{severityPill(f.severity)}</td>
                  <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "0.84rem", color: "var(--text-2)" }}>{f.asset}</span></td>
                  <td>{statusBadge(f.status)}</td>
                  <td><span className="mono" style={{ color: "var(--text-3)" }}>{f.first}</span></td>
                  <td><span className="mono" style={{ color: "var(--text-3)" }}>{f.last}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`empty-state${rows.length ? " hidden" : ""}`} id="findingEmpty">
          <div className="empty-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 4h6l4 4v12H5V4h4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 4v4h6V4M8 13l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3>No findings match</h3>
          <p>Try a different search term or loosen a filter.</p>
          <p className="modal-hint" style={{ marginTop: "0.5rem" }}>This is one of the good outcomes.</p>
        </div>
      </div>

      <p className="result-count" id="findingCount">{rows.length} of {allFindings.length} findings shown</p>
    </div>
  );
}