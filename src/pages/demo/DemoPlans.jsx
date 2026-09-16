/* ============================================================
   Kernveil — demo Plans & usage page (Phase 10).
   Two views:
     · Plans            — Starter / Business / Pro comparison with
                          "Pricing TBD" placeholders and a clearly
                          labelled current-plan or demo-plan state.
     · Usage & limits    — per-capability usage against the active
                          plan, limit statuses (available /
                          approaching / reached / restricted /
                          unavailable / no-data), what happens at
                          each limit, and honest upgrade prompts.

   HONESTY BOUNDARY: no fake billing anywhere. Prices are TBD,
   "Request access" never changes a plan, and every simulated
   scenario is labelled as a preview. Nothing claims a payment,
   a subscription, or a plan change occurred.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { gsap, reducedMotion } from "../../lib/anim.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import {
  CAPABILITIES,
  DEMO_PLAN,
  FEATURE_ROWS,
  PLANS,
  PLAN_ORDER,
  SEEDED_PLAN_STATES,
  STATUS_META,
  capabilityStatus,
  limitText,
  loadPlanSelection,
  nextTier,
  planById,
  resolvePlan,
  savePlanSelection,
  seedById,
  upgradeDiff,
} from "../../lib/plan.js";

const TABS = [
  { key: "plans", label: "Plans" },
  { key: "usage", label: "Usage & limits" },
];

function limitSummary(plan) {
  if (!plan) return "no plan selected";
  return CAPABILITIES.map((c) => `${limitText(plan, c.key)} ${c.label.toLowerCase()}`).join(" · ");
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.available;
  return <span className={`pl-status-badge ${meta.cls}`} data-status={status}>{meta.label}</span>;
}

function UsageMeter({ used, limit }) {
  if (limit === null)
    return (
      <div className="pl-meter pl-meter-unlimited">
        <span className="pl-meter-tag mono">Unlimited</span>
      </div>
    );
  if (used === null || used === undefined)
    return (
      <div className="pl-meter pl-meter-na">
        <span className="pl-meter-tag mono">No usage data</span>
      </div>
    );
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const status = pct >= 100 ? "reached" : pct >= 80 ? "approaching" : "ok";
  return (
    <div className="pl-meter">
      <div className="pl-meter-track" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={`${used} of ${limit} used`}>
        <div className="pl-meter-fill" style={{ width: `${pct}%` }} data-status={status}></div>
      </div>
      <span className="pl-meter-label mono">{used} / {limit}</span>
    </div>
  );
}

function UpgradePrompt({ plan, cap, used, onRequest }) {
  const nextId = nextTier(plan.id);
  if (!nextId) return null;
  const toPlan = planById(nextId);
  const diff = upgradeDiff(plan, toPlan);
  return (
    <details
      className="pl-upgrade"
      id={`plUpgrade-${cap.key}`}
      onToggle={(e) => {
        if (e.currentTarget.open) {
          e.currentTarget.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }}
    >
      <summary>
        <span>Upgrade options — pricing TBD</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pl-chev">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="pl-upgrade-body">
        <p className="pl-upgrade-why">
          <b>{cap.label}:</b> you are at the cap for <b>{plan.name}</b> ({used} of {limitText(plan, cap.key)} used).
        </p>
        <p className="pl-upgrade-have">
          Your plan gives you: <span className="mono">{limitSummary(plan)}</span>.
        </p>
        <div className="pl-upgrade-diff">
          <span className="panel-label">What {toPlan.name} adds</span>
          <ul>
            {diff.filter((d) => d.improved).map((d) => (
              <li key={d.key}>
                <b>{d.label}:</b> {d.current} → <b>{d.next}</b>
              </li>
            ))}
          </ul>
        </div>
        <p className="pl-pricing-note" id="plPricingNote">
          Pricing is not configured for {toPlan.name} yet. No checkout, payment, or billing exists in
          this preview, and moving to a plan is not possible from the demo.
        </p>
        <div className="pl-upgrade-actions">
          <button type="button" className="btn btn-secondary btn-sm" id={`plRequest-${cap.key}`} onClick={() => onRequest(toPlan.name)}>
            Request access
          </button>
          <Link className="btn btn-ghost btn-sm" to="/demo-plans?tab=plans">Compare plans</Link>
        </div>
      </div>
    </details>
  );
}

function PlanCard({ plan, active, onPreview, onRequest }) {
  const isActive = active === plan.id;
  return (
    <article className={`pl-tier-card${plan.highlight ? " is-highlight" : ""}${isActive ? " is-current" : ""}`} id={`plTier-${plan.id}`} data-plan={plan.id}>
      <div className="pl-tier-head">
        <span className="pl-tier-name">{plan.name}</span>
        {plan.highlight && <span className="badge badge-teal">Most coverage per tier</span>}
        {isActive && <span className="pl-current-chip">Current plan (preview)</span>}
      </div>
      <p className="pl-tier-tagline">{plan.tagline}</p>
      <div className="pl-price">
        <span className="pl-price-value mono">{plan.priceLabel}</span>
        <span className="pl-price-note mono">{plan.priceNote}</span>
      </div>
      <ul className="pl-tier-limits">
        {CAPABILITIES.map((c) => {
          const access = plan.access[c.key] === "limited" ? " · limited access" : "";
          return (
            <li key={c.key}>
              <span className="pl-limit-k">{c.label}</span>
              <span className="pl-limit-v mono">{limitText(plan, c.key)}{access}</span>
            </li>
          );
        })}
      </ul>
      <div className="pl-tier-actions">
        {isActive ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled aria-disabled="true">Current plan</button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id={`plPreview-${plan.id}`}
            onClick={() => onPreview(plan)}
          >
            Preview this tier
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          id={`plRequest-${plan.id}`}
          onClick={() => onRequest(plan.name)}
        >
          Request access — pricing TBD
        </button>
      </div>
    </article>
  );
}

function FeatureMatrix() {
  return (
    <div className="pl-matrix">
      <span className="panel-label">What each plan includes</span>
      <div className="pl-matrix-table">
        <div className="pl-matrix-row pl-matrix-head">
          <span>Capability</span>
          {PLAN_ORDER.map((id) => {
            const p = planById(id);
            return <span key={id}>{p.name} <em className="mono">({p.priceLabel})</em></span>;
          })}
        </div>
        {FEATURE_ROWS.map((grp) => (
          <div className="pl-matrix-group" key={grp.group}>
            <div className="pl-matrix-group-label">{grp.group}</div>
            {grp.rows.map((row) => (
              <div className="pl-matrix-row" key={row.label}>
                <span><b>{row.label}</b></span>
                <span>{row.starter}</span>
                <span>{row.business}</span>
                <span>{row.pro}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="pl-matrix-row pl-matrix-foot">
          <span>Billing</span>
          <span className="mono">TBD</span>
          <span className="mono">TBD</span>
          <span className="mono">TBD</span>
        </div>
      </div>
    </div>
  );
}

function CurrentPlanBanner({ plan, seeded, seedLabel }) {
  return (
    <div className="pl-current-banner" id="plCurrentPlan" data-plan={plan ? plan.id : "none"}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pl-banner-ic">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 10h18M7 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div className="pl-banner-body">
        <p className="pl-banner-head">
          {plan ? (
            <>
              <b>{plan.name}</b>
              {plan.id === "demo" && <span className="badge badge-ghost">Demo plan · no billing</span>}
              {seeded && <span className="badge badge-amber">Simulated scenario</span>}
            </>
          ) : (
            <span className="badge badge-slate">No plan selected</span>
          )}
        </p>
        {plan && plan.demo && (
          <p className="pl-banner-sub">
            You are previewing the product with full access. No billing plan has been selected — the tiers
            below are a comparison, not your billing state.
          </p>
        )}
        {plan && !plan.demo && !seeded && (
          <p className="pl-banner-sub">
            Preview plan: <span className="mono">{limitSummary(plan)}</span>. Billing is not active — this
            is a simulation so you can explore limits before pricing exists.
          </p>
        )}
        {seeded && seedLabel && (
          <p className="pl-banner-sub">{seedLabel}</p>
        )}
        {!plan && !seeded && (
          <p className="pl-banner-sub">
            Pick a plan to preview, or open a seeded scenario, so limits and upgrades can be explored.
          </p>
        )}
      </div>
    </div>
  );
}

function Notice({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <div className="pl-notice" id="plNotice" role="status">
      <span>{notice}</span>
      <button type="button" className="pl-notice-x" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="pl-loading" id="plLoading" role="status" aria-live="polite">
      <span className="scan-spinner" aria-hidden="true"></span>
      <span>Loading plans…</span>
      <div className="pl-skeleton-row">
        <div className="pl-skeleton pl-skeleton-card"></div>
        <div className="pl-skeleton pl-skeleton-card"></div>
        <div className="pl-skeleton pl-skeleton-card"></div>
      </div>
    </div>
  );
}

function InvalidState({ onReset }) {
  return (
    <div className="pl-error" id="plError" role="alert">
      <span className="empty-ic" aria-hidden="true">!</span>
      <h2>Invalid view</h2>
      <p>The requested plan view does not exist in this preview. Reset to the default plan comparison.</p>
      <button type="button" className="btn btn-secondary btn-sm" id="plReset" onClick={onReset}>Reset view</button>
    </div>
  );
}

export default function DemoPlans() {
  const { assets, connectors, notifSettings, actionsList } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const rootRef = useRef(null);
  const reduced = reducedMotion();
  const [planId, setPlanId] = useState(() => loadPlanSelection());
  const [phase, setPhase] = useState("loading");
  const [notice, setNotice] = useState(null);

  const tabParam = searchParams.get("tab") || "plans";
  const scenarioParam = searchParams.get("scenario") || "live";

  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : "invalid";
  const scenario = tab === "usage"
    ? scenarioParam === "live" || seedById(scenarioParam) ? scenarioParam : "invalid"
    : null;

  const invalid = tab === "invalid" || scenario === "invalid";

  const activePlan = useMemo(() => resolvePlan(planId), [planId]);

  const liveUsed = useMemo(
    () => ({
      assets: assets.length,
      connectors: connectors.filter((c) => c.connected || (c.findings && c.findings.length) || c.lastSync || c.lastSyncedAt).length,
      reports: 1,
      notifications: Object.values(notifSettings || {}).filter((s) => s && s.enabled !== false).length,
      remediation: (actionsList || []).length,
    }),
    [assets, connectors, notifSettings, actionsList]
  );

  useEffect(() => {
    if (invalid) return;
    setPhase("loading");
    const t = window.setTimeout(() => setPhase("ready"), 460);
    return () => window.clearTimeout(t);
  }, [tab, scenario, invalid]);

  useEffect(() => {
    if (planId === "demo") return;
    savePlanSelection(planId);
  }, [planId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || phase !== "ready") return;
    const ctx = gsap.context(() => {
      const items = root.querySelectorAll(".pl-reveal");
      if (reduced) {
        gsap.set(items, { opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(items, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.06, delay: 0.08 });
    }, root);
    return () => ctx.revert();
  }, [phase, tab, scenario, reduced]);

  const setTab = (t) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", t);
    setSearchParams(p);
  };

  const setScenario = (s) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", "usage");
    if (s === "live") p.delete("scenario");
    else p.set("scenario", s);
    setSearchParams(p);
  };

  const previewTier = (plan) => {
    setPlanId(plan.id);
    setNotice(`Previewing ${plan.name} as your plan. This is a simulation — no billing is active and no plan changed.`);
  };

  const requestAccess = (name) => {
    setNotice(`Access requests are not live in this preview and pricing for ${name} is not configured (TBD). No request was sent.`);
  };

  const resetView = () => setSearchParams({ tab: "plans" });

  const seed = scenario && scenario !== "live" ? seedById(scenario) : null;
  const usageView = useMemo(() => {
    if (!seed) return null;
    const plan = seed.tierId ? planById(seed.tierId) : null;
    return { seed, plan, used: seed.used };
  }, [seed]);

  if (invalid) {
    return (
      <div ref={rootRef}>
        <header className="page-head">
          <h1 className="page-title">Plans &amp; usage</h1>
          <p className="page-sub">Preview the Kernveil plans and how your workspace uses each capability.</p>
        </header>
        <InvalidState onReset={resetView} />
      </div>
    );
  }

  if (phase !== "ready") {
    return (
      <div ref={rootRef}>
        <header className="page-head">
          <h1 className="page-title">Plans &amp; usage</h1>
          <p className="page-sub">Preview the Kernveil plans and how your workspace uses each capability.</p>
        </header>
        <LoadingState />
        <Notice notice={notice} onDismiss={() => setNotice(null)} />
      </div>
    );
  }

  /* ---------- Plans tab ---------- */
  if (tab === "plans") {
    return (
      <div ref={rootRef}>
        <header className="page-head">
          <h1 className="page-title">Plans &amp; usage</h1>
          <p className="page-sub">
            Compare the Kernveil plans, their capability limits, and report access. Pricing is not
            configured yet — every price below is marked TBD, and this demo never activates billing.
          </p>
        </header>

        <div className="pl-tabs" role="tablist" aria-label="Plans and usage views">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`plTab${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`}
              aria-selected={tab === t.key}
              className={tab === t.key ? "is-active" : ""}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Notice notice={notice} onDismiss={() => setNotice(null)} />

        <div className="pl-reveal">
          <CurrentPlanBanner plan={activePlan} seeded={false} />
        </div>

        <section className="pl-tier-grid pl-reveal" id="plTierGrid" aria-label="Plan comparison">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} active={activePlan.id} onPreview={previewTier} onRequest={requestAccess} />
          ))}
        </section>

        <div className="pl-reveal">
          <div className="pl-note">
            <span className="pl-note-label">Billing preview</span>
            <span>
              No payment, subscription, or checkout system exists in this demo. Selecting a tier only
              changes which limits are simulated — it does not start a plan.
            </span>
          </div>
        </div>

        <div className="pl-reveal">
          <FeatureMatrix />
        </div>
      </div>
    );
  }

  /* ---------- Usage tab ---------- */
  const isLive = scenario === "live";
  const plan = isLive ? activePlan : usageView.plan;
  const used = isLive ? liveUsed : usageView.used;
  const allNoData = !isLive && CAPABILITIES.every((c) => used[c.key] == null);
  const noPlan = !plan;

  return (
    <div ref={rootRef}>
      <header className="page-head">
        <h1 className="page-title">Plans &amp; usage</h1>
        <p className="page-sub">
          See how this workspace uses assets, connectors, reports, notifications, and remediation
          against the selected plan — and exactly what happens, or unlocks, at each limit.
        </p>
      </header>

      <div className="pl-tabs" role="tablist" aria-label="Plans and usage views">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`plTab${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`}
            aria-selected={tab === t.key}
            className={tab === t.key ? "is-active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="pl-reveal">
        <CurrentPlanBanner plan={plan} seeded={!isLive && seed} seedLabel={seed && `${seed.label} — ${seed.desc}`} />
      </div>

      <div className="pl-reveal pl-scenario">
        <span className="panel-label">Scenario</span>
        <div className="pl-chips" role="list" aria-label="Usage scenarios">
          <button
            type="button"
            role="listitem"
            className={`pl-chip${isLive ? " is-active" : ""}`}
            id="plSeed-live"
            onClick={() => setScenario("live")}
          >
            Live workspace
          </button>
          {SEEDED_PLAN_STATES.map((s) => (
            <button
              type="button"
              role="listitem"
              className={`pl-chip${scenario === s.id ? " is-active" : ""}`}
              id={`plSeed-${s.id}`}
              key={s.id}
              onClick={() => setScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {seed && (
          <p className="pl-scenario-desc">
            <span className="badge badge-amber">Simulated scenario</span> {seed.desc}
          </p>
        )}
      </div>

      {noPlan && (
        <div className="pl-reveal pl-no-plan" id="plNoPlan">
          <span className="empty-ic" aria-hidden="true">?</span>
          <div>
            <h2>No active plan selected</h2>
            <p>This scenario simulates a workspace before a plan is picked. Limits are not enforced, and
              every capability reports as unavailable until a plan is selected.</p>
            <Link className="btn btn-secondary btn-sm" id="plCompare" to="/demo-plans?tab=plans">Compare plans</Link>
          </div>
        </div>
      )}

      {allNoData && !noPlan && (
        <div className="pl-reveal pl-empty" id="plEmpty">
          <span className="empty-ic" aria-hidden="true">⌁</span>
          <div>
            <h2>No usage data available</h2>
            <p>This workspace has nothing connected yet, so nothing counts against a limit. Connect a
              source below to start tracking assets, findings, and reports.</p>
            <Link className="btn btn-secondary btn-sm" to="/demo-connectors">Go to Connectors</Link>
          </div>
        </div>
      )}

      <section className="pl-usage pl-reveal" id="plUsage" aria-label="Usage and limits">
        {CAPABILITIES.map((cap) => {
          const status = capabilityStatus(plan, cap.key, used[cap.key]);
          const meta = STATUS_META[status] || STATUS_META.available;
          const limit = plan ? plan.limits[cap.key] : null;
          const showUpgrade = status === "reached" || status === "restricted";
          return (
            <article className="pl-usage-card" id={`plRow-${cap.key}`} data-cap={cap.key} data-status={status} key={cap.key}>
              <div className="pl-usage-head">
                <div className="pl-usage-title">
                  <span className="pl-usage-label">{cap.label}</span>
                  <StatusBadge status={status} />
                </div>
                <Link className="pl-usage-link link-arrow" to={cap.area}>
                  View {cap.areaLabel.toLowerCase()}
                  <svg className="ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>

              <div className="pl-usage-meter">
                <UsageMeter used={used[cap.key]} limit={limit} />
              </div>

              <p className={`pl-usage-desc ${showUpgrade ? "is-tight" : ""}`}>
                {meta.desc}
                {plan && plan.access[cap.key] === "limited" && (
                  <span className="pl-access-note mono"> · {plan.accessNote[cap.key]}</span>
                )}
              </p>

              {(status === "reached" || status === "restricted" || status === "approaching") && (
                <p className="pl-usage-what" id={`plWhat-${cap.key}`}>
                  <b>At the limit:</b> {cap.whatHappens}
                </p>
              )}

              {showUpgrade && plan && (
                <UpgradePrompt plan={plan} cap={cap} used={used[cap.key]} onRequest={requestAccess} />
              )}
            </article>
          );
        })}
      </section>

      <div className="pl-reveal pl-note">
        <span className="pl-note-label">Usage is simulated</span>
        <span>
          The live workspace view derives usage from what is actually on this page (assets, connected
          sources, the live report, enabled notification rules, and remediation actions). Seeded
          scenarios are labelled previews and never change the workspace.
        </span>
      </div>
    </div>
  );
}