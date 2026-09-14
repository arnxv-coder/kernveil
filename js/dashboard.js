/* ============================================================
   Kernveil — demo workspace (dashboard)
   Shell injection, overview, assets, findings, finding detail,
   connectors. All data is fictional sample data.
   ============================================================ */
(function () {
  "use strict";

  const { $, $$, finePointer } = window.KV;
  const D = window.KERNVEIL_DATA;
  const REDUCED = window.KV.reducedMotion();

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- helpers ---------- */
  const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  const STATUS_META = {
    open: { label: "Open", cls: "st-open" },
    "in-progress": { label: "In progress", cls: "st-wip" },
    approved: { label: "Awaiting approval", cls: "st-approved" },
    resolved: { label: "Resolved", cls: "st-resolved" },
  };
  const RISK_META = {
    critical: { label: "Critical", cls: "badge-red" },
    high: { label: "High", cls: "badge-orange" },
    medium: { label: "Medium", cls: "badge-amber" },
    low: { label: "Low", cls: "badge-slate" },
    healthy: { label: "Healthy", cls: "badge-green" },
  };

  const TYPE_ICONS = {
    server:
      '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="13" width="18" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M7 7.5h.01M7 16.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    storage:
      '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" stroke-width="1.6"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke="currentColor" stroke-width="1.6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" stroke="currentColor" stroke-width="1.6"/></svg>',
    database:
      '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="5.5" rx="7.5" ry="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 5.5v13c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-13" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 12c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2" stroke="currentColor" stroke-width="1.6"/></svg>',
    application:
      '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h.01M8 12h.01M8 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 8l5 5m-5 0l5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    api:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v5M5 6.5l3.5 3.5M19 6.5L15.5 10M5 17.5L8.5 14M19 17.5L15.5 14M12 16v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>',
    website:
      '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.6"/><path d="M7 14h.01M10 14h.01M7 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    identity:
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 19c.7-3.2 3.2-5.5 6.5-5.5s5.8 2.3 6.5 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    cloud:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8h16M4 15h16M8 4v16M16 4v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7 11v1M12 11v1M17 11v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };

  function statusBadge(status) {
    const m = STATUS_META[status] || { label: status, cls: "st-open" };
    return `<span class="status-badge ${m.cls}"><span class="sdot"></span>${m.label}</span>`;
  }

  function riskBadge(risk) {
    const m = RISK_META[risk] || RISK_META.low;
    return `<span class="badge ${m.cls}">${m.label}</span>`;
  }

  function severityPill(sev) {
    const label = sev.charAt(0).toUpperCase() + sev.slice(1);
    return `<span class="sev sev-${sev}">${label}</span>`;
  }

  /* ============================================================
     1. Shell — topbar + sidebar
     ============================================================ */
  function logoSmall() {
    return '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M6 21 C8.2 14.5 12 11.5 16 11.5 C20 11.5 23.8 14.5 26 21" stroke="#2ae6c7" stroke-width="2.1" stroke-linecap="round"/><path d="M9 24.5 C11.5 19.5 13.8 17.2 16 17.2 C18.2 17.2 20.5 19.5 23 24.5" stroke="#7ddbf4" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/><circle cx="16" cy="13.5" r="2" fill="#53f3d6"/></svg>';
  }

  const NAV = [
    { page: "overview", href: "demo.html", label: "Overview", count: null,
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 13h6V4H4v9zM14 20h6v-9h-6v9zM4 20h6v-3H4v3zM14 7h6V4h-6v3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
    { page: "assets", href: "demo-assets.html", label: "Assets", count: D.OVERVIEW.assets,
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="13" width="18" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M7 7.5h.01M7 16.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
    { page: "findings", href: "demo-findings.html", label: "Findings", count: D.OVERVIEW.open,
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l8 3.5v5c0 4.6-3.2 8.1-8 9.5-4.8-1.4-8-4.9-8-9.5v-5L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v4M12 15.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
    { page: "connectors", href: "demo-connectors.html", label: "Connectors", count: null,
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 3v5M15 3v5M9 8h6v3a3 3 0 01-6 0V8z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
  ];

  function injectShell() {
    const page = document.body.dataset.page;
    const topbar = $("#topbar");
    const sidebar = $("#sidebar");
    if (!topbar || !sidebar) return;

    const navHtml = NAV.map((n) => {
      const active = n.page === page;
      const count = n.count != null ? `<span class="nav-count">${n.count}</span>` : "";
      return `<a class="sidebar-link${active ? " is-active" : ""}" href="${n.href}"${active ? ' aria-current="page"' : ""}>${n.icon}${n.label}${count}</a>`;
    }).join("");

    topbar.innerHTML = `
      <div class="topbar-left">
        <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Toggle navigation" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <a class="brand" href="demo.html" aria-label="Kernveil demo home">
          <span class="brand-mark sm" aria-hidden="true">${logoSmall()}</span>
          <span class="brand-name" style="font-size:1.05rem">Kernveil</span>
        </a>
        <span class="workspace-switcher" title="Demo workspace — fictional sample data">
          ${D.WORKSPACE.name} <span class="chv" aria-hidden="true">▾</span>
        </span>
      </div>
      <div class="topbar-right">
        <a class="topbar-help" href="index.html#how-it-works">How it works</a>
        <div class="account" id="accountWrap">
          <button class="avatar" id="accountBtn" type="button" aria-label="Account menu" aria-expanded="false" aria-haspopup="menu">AR</button>
          <div class="account-menu" id="accountMenu" role="menu" hidden>
            <div class="account-menu-head">
              <strong>Acme Retail</strong>
              <span>Demo account · sample data only</span>
            </div>
            <a href="demo.html" role="menuitem">Switch workspace (demo)</a>
            <a href="index.html" role="menuitem">Back to the Kernveil site</a>
            <button type="button" role="menuitem" disabled>Sign out — not available in the demo</button>
          </div>
        </div>
      </div>`;

    sidebar.innerHTML = `
      <nav class="sidebar-nav" aria-label="Workspace navigation">${navHtml}</nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-grow"></div>
      <div class="sidebar-banner">
        <span class="badge badge-ghost" style="font-size:0.64rem">Settings · <span style="color:var(--amber)">Planned</span></span>
        <p>Settings and account management are not part of the demo yet.</p>
      </div>
      <div class="sidebar-spacer"></div>
      <p style="font-size:0.68rem;color:var(--text-disabled);padding:0 0.7rem;line-height:1.5" class="mono">
        Demo workspace · fictional sample data · not a real security scan
      </p>`;

    prismAccount();
    initSidebarToggle();
  }

  function prismAccount() {
    const wrap = $("#accountWrap");
    const btn = $("#accountBtn");
    const menu = $("#accountMenu");
    if (!wrap || !btn || !menu) return;
    const close = () => {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };
    btn.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) close();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function initSidebarToggle() {
    const t = $("#sidebarToggle");
    const s = $("#sidebar");
    if (!t || !s) return;
    t.addEventListener("click", () => {
      const open = s.classList.toggle("is-open");
      t.setAttribute("aria-expanded", String(open));
    });
    s.addEventListener("click", (e) => {
      if (e.target.closest("a") && window.innerWidth < 980) {
        s.classList.remove("is-open");
        t.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ============================================================
     2. Overview
     ============================================================ */
  function initOverview() {
    const pop = (els, delay = 0.06) => {
      if (REDUCED) { gsap.set(els, { opacity: 1, y: 0 }); return; }
      gsap.fromTo(els, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: delay });
    };
    pop($$(".kpi"));
    pop($$(".overview-grid > .panel"), 0.1);

    // gauges
    gsap.to(".dash-gauge", { strokeDashoffset: 26, duration: 1.6, ease: "power2.inOut", delay: 0.3 });
    gsap.fromTo(".dash-remed", { strokeDashoffset: 100 }, { strokeDashoffset: 77, duration: 1.6, ease: "power2.inOut", delay: 0.3 });

    // severity bars
    $$(".dash-sev").forEach((b, i) => {
      gsap.to(b, { width: b.getAttribute("data-h") + "%", duration: 1.1, ease: "power3.out", delay: 0.4 + i * 0.1 });
    });

    // activity rows
    if (!REDUCED) {
      gsap.fromTo(".activity-list li", { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out", stagger: 0.08, delay: 0.6 });
    }

    window.KV.applyDataCounts(document);

    // trend chart
    const box = $("#trendChartBox");
    if (box && window.Motion) {
      renderTrendChart(box);
    }
  }

  function renderTrendChart(box) {
    const W = 820, H = 200, P = { l: 8, r: 8, t: 14, b: 6 };
    const data = D.RISK_SERIES;
    const max = 50;
    const x = (i) => P.l + (i / (data.length - 1)) * (W - P.l - P.r);
    const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
    const pts = data.map((d, i) => [x(i), y(d.value)]);

    // projection from last two points
    const last = data[data.length - 1].value;
    const prev = data[data.length - 2].value;
    const slope = last - prev;
    const proj = [0, 1, 2, 3].map((k) => {
      const v = Math.max(0, last + slope * (k + 1) * 0.8);
      return [x(data.length - 1 + k + 1) || x(data.length - 1), y(v)];
    });

    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
    const projLine = `M${pts[pts.length - 1][0]},${pts[pts.length - 1][1]} ${proj.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}`;

    const grid = [0.25, 0.5, 0.75].map(
      (f) => `<line class="trend-gridline" x1="${P.l}" y1="${(P.t + (1 - f) * (H - P.t - P.b)).toFixed(1)}" x2="${W - P.r}" y2="${(P.t + (1 - f) * (H - P.t - P.b)).toFixed(1)}"/>`
    ).join("");

    const dots = pts
      .map((p, i) => `<circle class="trend-point" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 4.4 : 3.2}"/>`)
      .join("");

    box.innerHTML = `
      <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#7ddbf4"/><stop offset="1" stop-color="#2ae6c7"/>
          </linearGradient>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgba(42,230,199,0.22)"/><stop offset="1" stop-color="rgba(42,230,199,0)"/>
          </linearGradient>
        </defs>
        ${grid}
        <path class="trend-area" d="${area}" fill="url(#chartFill)" style="opacity:0"/>
        <path class="trend-line-bg" d="${line}"/>
        <path id="trendLineMain" class="trend-line-main" d="${line}" pathLength="100"/>
        <path class="trend-line-proj" d="${projLine}" pathLength="100" style="opacity:0"/>
        ${dots}
      </svg>`;

    const main = $("#trendLineMain");
    const motion = window.Motion;
    const animate = motion.animate || motion;
    if (REDUCED) {
      main.style.strokeDasharray = "none";
      main.style.strokeDashoffset = "0";
      $(".trend-area").style.opacity = "1";
      return;
    }
    // Draw path via Motion spring-damped keyframes
    main.style.strokeDasharray = "100";
    main.style.strokeDashoffset = "100";
    animate(main, { strokeDashoffset: 0, opacity: 1 }, { duration: 1.7, ease: [0.6, 0.05, 0.3, 1] });
    animate($(".trend-line-proj"), { opacity: 0.8 }, { duration: 0.4, delay: 1.4 });
    animate($(".trend-area"), { opacity: 1 }, { duration: 0.9, delay: 1.2 });
    gsap.fromTo($$(".trend-point"), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.8)", stagger: 0.05, delay: 1.25 });
  }

  /* ============================================================
     3. Assets
     ============================================================ */
  function initAssets() {
    const tbody = $("#assetRows");
    const empty = $("#assetEmpty");
    const count = $("#assetCount");
    const sheet = $("#assetSheet");
    const sheetBody = $("#assetSheetBody");
    if (!tbody) return;

    const q = $("#assetSearch");
    const fType = $("#assetType");
    const fEnv = $("#assetEnv");
    const fSource = $("#assetSource");

    const label = (k) => k.charAt(0).toUpperCase() + k.slice(1);

    function render() {
      const term = (q?.value || "").trim().toLowerCase();
      const t = fType?.value || "all";
      const e = fEnv?.value || "all";
      const s = fSource?.value || "all";

      const rows = D.ASSETS.filter((a) => {
        if (t !== "all" && a.type !== t) return false;
        if (e !== "all" && a.env !== e) return false;
        if (s !== "all" && a.source !== s) return false;
        if (term && !((a.name + a.host + a.type + a.source).toLowerCase().includes(term))) return false;
        return true;
      });

      count.textContent = `${rows.length} of ${D.ASSETS.length} assets shown`;
      empty.classList.toggle("hidden", rows.length > 0);
      tbody.classList.toggle("hidden", rows.length === 0);

      // batch animation of old rows out, new rows in
      const old = $$("tr", tbody);
      if (old.length && !REDUCED) {
        gsap.to(old, { opacity: 0, y: -6, duration: 0.14, ease: "power1.in", stagger: 0.008, onComplete: () => draw() });
      } else {
        draw();
      }

      function draw() {
        tbody.innerHTML = rows
          .map(
            (a, i) => `<tr data-asset="${a.id}" tabindex="0" role="button" aria-label="View details for ${a.name}">
              <td>
                <div class="finding-row">
                  <span class="f-title">${a.name}</span>
                  <span class="cell-sub">${a.host}</span>
                </div>
              </td>
              <td><span class="type-icon" aria-hidden="true">${TYPE_ICONS[a.type] || ""}</span> ${label(a.type)}</td>
              <td><span class="badge badge-ghost">${a.env}</span></td>
              <td>${a.source}</td>
              <td>${riskBadge(a.risk)}</td>
              <td><span class="mono" style="color:var(--text-3)">${a.last}</span></td>
            </tr>`
          )
          .join("");
        gsap.fromTo(
          $$("tr", tbody),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.34, ease: "power2.out", stagger: 0.02, delay: 0.12 }
        );
      }
    }

    [q, fType, fEnv, fSource].forEach((el) => el && el.addEventListener("input", render));

    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-asset]");
      if (tr) openSheet(tr.getAttribute("data-asset"));
    });
    tbody.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const tr = e.target.closest("tr[data-asset]");
        if (tr) { e.preventDefault(); openSheet(tr.getAttribute("data-asset")); }
      }
    });

    function openSheet(id) {
      const asset = D.ASSETS.find((a) => a.id === id);
      if (!asset) return;
      const finds = (D.ASSET_FINDING_MAP[id] || []);
      const list =
        finds.length
          ? finds
              .map(
                (f) => `<a class="related-asset" href="demo-finding.html?id=${f.id}" style="text-decoration:none">
                  <span class="sev sev-${f.severity}"></span>
                  <span class="related-asset-name">${f.title}</span>
                  <span class="related-asset-env mono" style="margin-left:auto">${STATUS_META[f.status].label}</span>
                </a>`
              )
              .join("")
          : `<p style="font-size:0.88rem;color:var(--text-3)">No open findings for this asset. Healthy.</p>`;

      sheetBody.innerHTML = `
        <div class="risk-score-row" style="align-items:flex-start">
          <div>
            <div class="finding-row" style="display:flex;flex-direction:column;gap:0.3rem">
              <span class="f-title" style="font-family:var(--font-display);font-size:1.1rem;color:var(--text-1)">${asset.name}</span>
              <span class="cell-sub">${asset.host}</span>
            </div>
            <div class="detail-meta">
              <span>Type <b>${label(asset.type)}</b></span>
              <span>Environment <b>${asset.env}</b></span>
              <span>Source <b>${asset.source}</b></span>
              <span>Last checked <b>${asset.last}</b></span>
            </div>
          </div>
          ${riskBadge(asset.risk)}
        </div>
        <div class="sidebar-spacer" style="margin:1rem 0"></div>
        <h4 style="font-size:0.74rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:0.7rem">Findings on this asset</h4>
        <div style="display:grid;gap:0.5rem">${list}</div>`;

      sheet.hidden = false;
      if (!REDUCED) {
        gsap.fromTo(sheet, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
      } else {
        gsap.set(sheet, { opacity: 1, y: 0 });
      }
      sheet.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
    }

    render();
  }

  /* ============================================================
     4. Findings list
     ============================================================ */
  function initFindings() {
    const tbody = $("#findingRows");
    const empty = $("#findingEmpty");
    const count = $("#findingCount");
    if (!tbody) return;

    const q = $("#findingSearch");
    const sSeg = $("#sevSeg");
    const stSeg = $("#statusSeg");
    const cats = $("#catChips");

    let sev = "all";
    let status = "all";
    let cat = "all";

    function sorted() {
      return D.FINDINGS.slice().sort((a, b) => {
        const resA = a.status === "resolved" ? 1 : 0;
        const resB = b.status === "resolved" ? 1 : 0;
        if (resA !== resB) return resA - resB;
        return SEV_RANK[a.severity] - SEV_RANK[b.severity];
      });
    }

    function render() {
      const term = (q?.value || "").trim().toLowerCase();
      const rows = sorted().filter((f) => {
        if (sev !== "all" && f.severity !== sev) return false;
        if (status !== "all" && f.status !== status) return false;
        if (cat !== "all" && f.category !== cat) return false;
        if (term && !((f.title + f.asset + f.category + f.summary).toLowerCase().includes(term))) return false;
        return true;
      });

      count.textContent = `${rows.length} of ${D.FINDINGS.length} findings shown`;
      empty.classList.toggle("hidden", rows.length > 0);
      tbody.classList.toggle("hidden", rows.length === 0);

      if (rows.length === 0) {
        tbody.innerHTML = "";
        return;
      }

      if (!REDUCED && tbody.children.length) {
        const old = $$("tr", tbody);
        gsap.to(old, { opacity: 0, y: -5, duration: 0.12, ease: "power1.in", stagger: 0.006, onComplete: () => draw(rows) });
      } else {
        draw(rows);
      }
    }

    function draw(rows) {
      tbody.innerHTML = rows
        .map(
          (f) => `<tr data-id="${f.id}" tabindex="0" role="button" aria-label="Open finding: ${f.title}">
            <td>
              <div class="finding-row">
                <span class="f-title">${f.title}</span>
                <span class="cell-sub">${f.category}</span>
              </div>
            </td>
            <td>${severityPill(f.severity)}</td>
            <td><span style="font-family:var(--font-mono);font-size:0.84rem;color:var(--text-2)">${f.asset}</span></td>
            <td>${statusBadge(f.status)}</td>
            <td><span class="mono" style="color:var(--text-3)">${f.first}</span></td>
            <td><span class="mono" style="color:var(--text-3)">${f.last}</span></td>
          </tr>`
        )
        .join("");
      gsap.fromTo(
        $$("tr", tbody),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.34, ease: "power2.out", stagger: 0.018 }
      );

      $$("tr", tbody).forEach((tr) => {
        const go = () => { window.location.href = `demo-finding.html?id=${tr.getAttribute("data-id")}`; };
        tr.addEventListener("click", go);
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
        });
      });
    }

    q.addEventListener("input", render);
    sSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sev]");
      if (!b) return;
      sev = b.getAttribute("data-sev");
      $$("button", sSeg).forEach((x) => x.classList.toggle("is-active", x === b));
      render();
    });
    stSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-status]");
      if (!b) return;
      status = b.getAttribute("data-status");
      $$("button", stSeg).forEach((x) => x.classList.toggle("is-active", x === b));
      render();
    });
    cats.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-cat]");
      if (!b) return;
      cat = b.getAttribute("data-cat");
      $$("button", cats).forEach((x) => x.classList.toggle("is-active", x === b));
      render();
    });

    render();
  }

  /* ============================================================
     5. Finding detail
     ============================================================ */
  function initFindingDetail() {
    const box = $("#findingDetail");
    const back = $("#detailBack");
    if (!box) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const f = D.FINDINGS.find((x) => x.id === id);

    if (!f) {
      box.innerHTML = `
        <div class="empty-state" style="border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface-1)">
          <div class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
          <h3>Finding not found</h3>
          <p>This demo finding doesn’t exist. Pick any finding from the list.</p>
          <p style="margin-top:1.1rem"><a class="btn btn-primary btn-sm" href="demo-findings.html">Browse findings</a></p>
        </div>`;
      return;
    }

    const related = (f.related || [])
      .map((id) => {
        const a = D.ASSETS.find((x) => x.id === id);
        if (!a) return "";
        return `<li class="related-asset" style="list-style:none">
          <span class="type-icon" aria-hidden="true">${TYPE_ICONS[a.type] || ""}</span>
          <div>
            <span class="related-asset-name">${a.name}</span>
            <span class="related-asset-env mono" style="display:block">${a.env} · ${a.source}</span>
          </div>
        </li>`;
      })
      .join("");

    const history = (f.history || [])
      .map((h) => `<li class="history-item" style="--his-c:${h.c};list-style:none"><span class="history-title">${h.text}</span><span class="history-time">${h.time}</span></li>`)
      .join("");

    const evidence = (f.evidence || [])
      .map((e) => `<span class="ek">${e.key}</span>: <span class="ev">${e.value}</span>`)
      .join("\n");

    const steps =
      f.steps && f.steps.length
        ? `<div class="detail-block action-block" style="margin-top:0">
            <h4>Recommended next step</h4>
            <div class="action-steps">${f.steps.map((s) => `<div class="action-step"><p>${s}</p></div>`).join("")}</div>
          </div>`
        : `<div class="detail-block" style="margin-top:0">
            <h4>Recommended next step</h4>
            <p>This finding is already resolved. Nothing to do — Kernveil will let you know if it reappears.</p>
          </div>`;

    box.innerHTML = `
      <div class="detail-head">
        <div>
          <div class="detail-sev-labels">
            ${severityPill(f.severity)}
            ${statusBadge(f.status)}
          </div>
          <h1 class="detail-title">${f.title}</h1>
          <div class="detail-meta">
            <span>Affected asset <b>${f.asset}</b></span>
            <span>Category <b>${f.category}</b></span>
            <span>First detected <b>${f.first}</b></span>
            <span>Last checked <b>${f.last}</b></span>
          </div>
        </div>
        <div class="recommend-explainer mono" style="max-width:280px">
          ${f.summary}
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-cols">
          <div class="panel detail-block">
            <h4>What was detected</h4>
            <p>${f.detected}</p>
          </div>

          <div class="panel detail-block">
            <h4>Why it matters</h4>
            ${f.impact ? `<span class="impact-badge"><i></i>${f.impact}</span>` : ""}
            <p>${f.why}</p>
          </div>

          <div class="panel detail-block">
            <h4>Evidence</h4>
            <pre class="evidence-code">${evidence}</pre>
          </div>
        </div>

        <div class="detail-col-stack">
          <div class="panel detail-block">${steps}</div>

          <div class="panel detail-block">
            <h4>Related assets</h4>
            <div style="display:grid;gap:0.5rem">${related}</div>
          </div>

          <div class="panel detail-block">
            <h4>Finding history</h4>
            <ol class="history-list" style="margin:0">${history}</ol>
          </div>
        </div>
      </div>

      <p class="result-count" style="margin-top:1.4rem;text-align:center">Demo finding — fictional sample data for illustration.</p>`;

    // entrance
    if (REDUCED) {
      gsap.set($$(".detail-head, .detail-grid > *", box), { opacity: 1, y: 0 });
    } else {
      gsap.fromTo(box.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.09 });
    }

    // finding history ticks animate
    if (!REDUCED) {
      gsap.fromTo(".history-item", { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out", stagger: 0.1, delay: 0.45 });
    }

    back.addEventListener("click", () => {
      if (history.length > 1 || (document.referrer && document.referrer.includes("demo"))) {
        window.history.back();
      } else {
        window.location.href = "demo-findings.html";
      }
    });
  }

  /* ============================================================
     6. Connectors
     ============================================================ */
  function initConnectors() {
    const grid = $("#connGrid");
    if (!grid) return;

    const ICONS = {
      github: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      cloud: TYPE_ICONS.cloud,
      website: TYPE_ICONS.website,
      identity: TYPE_ICONS.identity,
      backup: '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" stroke-width="1.6"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke="currentColor" stroke-width="1.6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" stroke="currentColor" stroke-width="1.6"/></svg>',
      saas: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="9" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="14.5" r="1.3" fill="currentColor"/></svg>',
    };

    const CONN_STATE = {
      available: {
        badge: '<span class="badge badge-teal"><span class="dot"></span>Available in demo</span>',
        status: '<div class="conn-status-line"><span class="status-dot"></span>Simulated connection · sample data</div>',
        action: '<a class="btn btn-secondary btn-sm" href="demo-findings.html">View sample findings<svg class="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width:14px;height:14px"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>',
        metrics: (c) => {
          const m = {
            github: [["Repos monitored", "4"], ["Findings", "5"]],
            cloud: [["Assets", "8"], ["Findings", "9"]],
            website: [["Pages checked", "6"], ["Findings", "2"]],
          }[c.id] || [];
          return m.map(([l, v]) => `<span><b>${v}</b>${l}</span>`).join("");
        },
      },
      planned: {
        badge: '<span class="badge badge-slate">Planned connector</span>',
        status: '<div class="conn-status-line" style="color:var(--text-disabled)">Designed for — not available in this demo</div>',
        action: '<button class="btn btn-ghost btn-sm" type="button" disabled>Planned</button>',
        metrics: () => "",
      },
      coming: {
        badge: '<span class="badge badge-ghost">Coming soon</span>',
        status: '<div class="conn-status-line" style="color:var(--text-disabled)">On the roadmap</div>',
        action: '<button class="btn btn-ghost btn-sm" type="button" disabled>Coming soon</button>',
        metrics: () => "",
      },
    };

    grid.innerHTML = D.CONNECTORS.map((c, i) => {
      const s = CONN_STATE[c.state];
      return `<article class="conn-card${c.state !== "available" ? " is-planned" : ""}" data-conn>
        <div class="conn-head">
          <span class="conn-icon" aria-hidden="true">${ICONS[c.id] || ""}</span>
          <div>
            <span class="conn-name">${c.name}</span>
            <span class="badge badge-ghost" style="font-size:0.66rem;margin-top:0.25rem">${c.type}</span>
          </div>
        </div>
        <p class="conn-desc">${c.desc}</p>
        ${c.state === "available" ? `<div class="conn-metrics">${s.metrics(c)}</div>` : ""}
        ${s.status}
        <div class="conn-actions" style="margin-top:1rem">${s.action}${s.badge}</div>
      </article>`;
    }).join("");

    if (REDUCED) {
      gsap.set($$(".conn-card"), { opacity: 1, y: 0 });
      return;
    }
    // Primary: cards rise in; Secondary: soft shadow follows each card in
    const cards = $$(".conn-card");
    gsap.fromTo(cards, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08, delay: 0.1 });
    gsap.fromTo(cards, { boxShadow: "0 0 0 1px rgba(148,180,225,0.1)" }, {
      boxShadow: "0 0 0 1px rgba(148,180,225,0.2), var(--shadow-sm)",
      duration: 0.45, ease: "power1.out", stagger: 0.08, delay: 0.32,
    });
  }

  /* ---------- init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    injectShell();
    const page = document.body.dataset.page;
    if (page === "overview") initOverview();
    if (page === "assets") initAssets();
    if (page === "findings") initFindings();
    if (page === "finding-detail") initFindingDetail();
    if (page === "connectors") initConnectors();
  });
})();