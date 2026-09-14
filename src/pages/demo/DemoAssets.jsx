/* ============================================================
   Kernveil — demo Assets page (search + filters + detail sheet)
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap, reducedMotion, TYPE_ICONS, STATUS_META } from "../../lib/anim.jsx";
import { ASSETS, ASSET_FINDING_MAP } from "../../lib/data.js";
import { riskBadge } from "../../components/demo/badges.jsx";

const label = (k) => k.charAt(0).toUpperCase() + k.slice(1);

export default function DemoAssets() {
  const rootRef = useRef(null);
  const hideRowRef = useRef(null);
  const [term, setTerm] = useState("");
  const [type, setType] = useState("all");
  const [env, setEnv] = useState("all");
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState(null);
  const REDUCED = reducedMotion();

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return ASSETS.filter((a) => {
      if (type !== "all" && a.type !== type) return false;
      if (env !== "all" && a.env !== env) return false;
      if (source !== "all" && a.source !== source) return false;
      if (q && !(a.name + a.host + a.type + a.source).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [term, type, env, source]);

  const rowsKey = rows.map((a) => a.id).join(",");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      if (REDUCED) {
        gsap.set([".list-card", ".toolbar"], { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(".list-card", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", delay: 0.05 });
        gsap.fromTo(".toolbar", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", delay: 0.15 });
      }
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef]);

  useEffect(() => {
    const tbody = hideRowRef.current;
    if (!tbody || !rows.length) return;
    const ctx = gsap.context(() => {
      if (REDUCED) {
        gsap.set(tbody.children, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(tbody.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.34, ease: "power2.out", stagger: 0.02, delay: 0.12 });
      }
    }, tbody);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey, REDUCED]);

  useEffect(() => {
    const root = rootRef.current;
    if (!selected) return;
    const sheet = root.querySelector("#assetSheet");
    if (!sheet) return;
    const ctx = gsap.context(() => {
      if (REDUCED) {
        gsap.set(sheet, { opacity: 1, y: 0 });
      } else {
        gsap.fromTo(sheet, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
      }
    }, sheet);
    sheet.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const openSheet = (id) => setSelected(ASSETS.find((a) => a.id === id) || null);

  const asset = selected;
  const finds = asset ? (ASSET_FINDING_MAP[asset.id] || []) : [];

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Assets</h1>
        <p className="page-sub">The 14 systems, repositories, and websites Kernveil monitors in this workspace.</p>
      </header>

      <div className="toolbar">
        <div className="search-field">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <label className="visually-hidden" htmlFor="assetSearch">Search assets</label>
          <input id="assetSearch" type="search" placeholder="Search assets…" autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <div className="select-field">
          <label className="visually-hidden" htmlFor="assetType">Filter by type</label>
          <select id="assetType" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            <option value="server">Server</option>
            <option value="storage">Storage</option>
            <option value="database">Database</option>
            <option value="application">Application</option>
            <option value="api">API</option>
            <option value="website">Website</option>
            <option value="identity">Identity</option>
          </select>
        </div>
        <div className="select-field">
          <label className="visually-hidden" htmlFor="assetEnv">Filter by environment</label>
          <select id="assetEnv" value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="all">All environments</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
            <option value="Development">Development</option>
          </select>
        </div>
        <div className="select-field">
          <label className="visually-hidden" htmlFor="assetSource">Filter by source</label>
          <select id="assetSource" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            <option value="Cloud">Cloud</option>
            <option value="Code">Code</option>
            <option value="Website">Website</option>
            <option value="Backups">Backups</option>
          </select>
        </div>
      </div>

      <div className="list-card">
        <div className="table-wrap">
          <table className="table" aria-label="Asset inventory">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Type</th>
                <th scope="col">Environment</th>
                <th scope="col">Source</th>
                <th scope="col">Risk status</th>
                <th scope="col">Last checked</th>
              </tr>
            </thead>
            <tbody id="assetRows" ref={hideRowRef} style={rows.length ? undefined : { display: "none" }}>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  data-asset={a.id}
                  tabIndex="0"
                  role="button"
                  aria-label={`View details for ${a.name}`}
                  onClick={() => openSheet(a.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openSheet(a.id);
                    }
                  }}
                >
                  <td>
                    <div className="finding-row">
                      <span className="f-title">{a.name}</span>
                      <span className="cell-sub">{a.host}</span>
                    </div>
                  </td>
                  <td>
                    <span className="type-icon" aria-hidden="true">{TYPE_ICONS[a.type] || ""}</span> {label(a.type)}
                  </td>
                  <td><span className="badge badge-ghost">{a.env}</span></td>
                  <td>{a.source}</td>
                  <td>{riskBadge(a.risk)}</td>
                  <td><span className="mono" style={{ color: "var(--text-3)" }}>{a.last}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`empty-state${rows.length ? " hidden" : ""}`} id="assetEmpty">
          <div className="empty-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h3>No assets match</h3>
          <p>Try a different search term or clear a filter.</p>
        </div>
      </div>

      <p className="result-count" id="assetCount">{rows.length} of {ASSETS.length} assets shown</p>

      {asset && (
        <section className="panel" id="assetSheet">
          <span className="panel-label">Asset detail</span>
          <div className="risk-score-row" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="finding-row" style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <span className="f-title" style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--text-1)" }}>{asset.name}</span>
                <span className="cell-sub">{asset.host}</span>
              </div>
              <div className="detail-meta">
                <span>Type <b>{label(asset.type)}</b></span>
                <span>Environment <b>{asset.env}</b></span>
                <span>Source <b>{asset.source}</b></span>
                <span>Last checked <b>{asset.last}</b></span>
              </div>
            </div>
            {riskBadge(asset.risk)}
          </div>
          <div className="sidebar-spacer" style={{ margin: "1rem 0" }}></div>
          <h4 style={{ fontSize: "0.74rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "0.7rem" }}>
            Findings on this asset
          </h4>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {finds.length ? (
              finds.map((f) => (
                <a className="related-asset" href={`/demo-finding?id=${f.id}`} style={{ textDecoration: "none" }} key={f.id}>
                  <span className={`sev sev-${f.severity}`}></span>
                  <span className="related-asset-name">{f.title}</span>
                  <span className="related-asset-env mono" style={{ marginLeft: "auto" }}>{STATUS_META[f.status].label}</span>
                </a>
              ))
            ) : (
              <p style={{ fontSize: "0.88rem", color: "var(--text-3)" }}>No open findings for this asset. Healthy.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}