/* ============================================================
   Kernveil — demo workspace shell (topbar + sidebar + content)
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandMark } from "../../components/Icons.jsx";
import { useWorkspace, initialsOf } from "../../context/WorkspaceContext.jsx";
import { ASSETS } from "../../lib/data.js";

export default function DemoLayout({ page, children }) {
  const { workspace, overview, resetWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const wrapRef = useRef(null);

  const workspaceName = workspace?.name || "Acme Retail (sample)";
  const accountInitials = initialsOf(workspaceName);

  useEffect(() => {
    if (!workspace) navigate("/demo-entry", { replace: true });
  }, [workspace, navigate]);

  if (!workspace) return null;

  const NAV = [
    {
      page: "overview",
      to: "/demo",
      label: "Overview",
      count: null,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 13h6V4H4v9zM14 20h6v-9h-6v9zM4 20h6v-3H4v3zM14 7h6V4h-6v3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      page: "assets",
      to: "/demo-assets",
      label: "Assets",
      count: ASSETS.length,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="4" width="18" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3" y="13" width="18" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 7.5h.01M7 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      page: "findings",
      to: "/demo-findings",
      label: "Findings",
      count: overview.open,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l8 3.5v5c0 4.6-3.2 8.1-8 9.5-4.8-1.4-8-4.9-8-9.5v-5L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 8v4M12 15.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      page: "connectors",
      to: "/demo-connectors",
      label: "Connectors",
      count: null,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 3v5M15 3v5M9 8h6v3a3 3 0 01-6 0V8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 11v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const toggleSidebar = (open) => {
    setSidebarOpen(open);
    const t = document.getElementById("sidebarToggle");
    if (t) t.setAttribute("aria-expanded", String(open));
  };

  const toggleAccount = (open) => {
    setAccountOpen(open);
    const b = document.getElementById("accountBtn");
    if (b) b.setAttribute("aria-expanded", String(open));
  };

  const onDocClick = (e) => {
    if (wrapRef.current && !wrapRef.current.contains(e.target)) {
      if (accountOpen) toggleAccount(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Escape") {
      if (accountOpen) toggleAccount(false);
      if (sidebarOpen) toggleSidebar(false);
    }
  };

  return (
    <div className="demo-shell" ref={wrapRef} onClick={onDocClick} onKeyDown={onKey}>
      <div className="demo-topbar" id="topbar">
        <div className="topbar-left">
          <button
            className="sidebar-toggle"
            id="sidebarToggle"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
            onClick={() => toggleSidebar(!sidebarOpen)}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Link className="brand" to="/demo" aria-label="Kernveil demo home">
            <BrandMark small />
            <span className="brand-name" style={{ fontSize: "1.05rem" }}>Kernveil</span>
          </Link>
          <button
            className="workspace-switcher"
            type="button"
            title="Switch or reset this demo workspace"
            onClick={() => navigate("/demo-entry")}
          >
            {workspaceName} <span className="chv" aria-hidden="true">▾</span>
          </button>
        </div>
        <div className="topbar-right">
          <Link className="topbar-help" to="/#how-it-works">How it works</Link>
          <div className="account">
            <button
              className="avatar"
              id="accountBtn"
              type="button"
              aria-label="Account menu"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              onClick={(e) => {
                e.stopPropagation();
                toggleAccount(!accountOpen);
              }}
            >
              {accountInitials}
            </button>
            <div className="account-menu" id="accountMenu" role="menu" hidden={!accountOpen}>
              <div className="account-menu-head">
                <strong>{workspaceName}</strong>
                <span>Demo account · sample data only</span>
              </div>
              <Link to="/demo-entry" role="menuitem" onClick={() => { toggleAccount(false); navigate("/demo-entry"); }}>Switch workspace</Link>
              <Link to="/" role="menuitem" onClick={() => toggleAccount(false)}>Back to the Kernveil site</Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  resetWorkspace();
                  toggleAccount(false);
                  navigate("/");
                }}
              >
                Sign out — end demo session
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className={`demo-sidebar${sidebarOpen ? " is-open" : ""}`} id="sidebar">
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {NAV.map((n) => {
            const active = n.page === page;
            const count = n.count != null ? <span className="nav-count">{n.count}</span> : null;
            return (
              <Link
                className={`sidebar-link${active ? " is-active" : ""}`}
                to={n.to}
                aria-current={active ? "page" : undefined}
                key={n.page}
                onClick={() => {
                  if (window.innerWidth < 980) toggleSidebar(false);
                }}
              >
                {n.icon}
                {n.label}
                {count}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer"></div>
        <div className="sidebar-grow"></div>
        <div className="sidebar-banner">
          <span className="badge badge-ghost" style={{ fontSize: "0.64rem" }}>
            Settings · <span style={{ color: "var(--amber)" }}>Planned</span>
          </span>
          <p>Settings and account management are not part of the demo yet.</p>
        </div>
        <div className="sidebar-spacer"></div>
        <p
          style={{ fontSize: "0.68rem", color: "var(--text-disabled)", padding: "0 0.7rem", lineHeight: "1.5" }}
          className="mono"
        >
          Demo workspace · fictional sample data · not a real security scan
        </p>
      </aside>

      <main className="demo-main" id="main">
        {children}
      </main>
    </div>
  );
}