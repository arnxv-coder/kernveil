/* ============================================================
   Kernveil — plan and usage model.
   Defines the three product tiers, their capability limits and
   access, usage-status derivation, upgrade comparison data, and
   the seeded scenarios the Plans & usage preview can simulate.
   NO pricing is invented anywhere in this module: every tier
   reports "Pricing TBD" and billing is explicitly a preview.
   ============================================================ */

export const PLAN_STORAGE_KEY = "kernveil.plan.v1";

/* ---------- capability model ---------- */

export const CAPABILITIES = [
  {
    key: "assets",
    label: "Managed assets",
    unit: "assets",
    area: "/demo-assets",
    areaLabel: "Assets",
    whatHappens:
      "New assets stop being tracked until you free up space or move to a higher plan. Already-tracked assets and their findings stay fully visible.",
  },
  {
    key: "connectors",
    label: "Connectors",
    unit: "connectors",
    area: "/demo-connectors",
    areaLabel: "Connectors",
    whatHappens:
      "No additional source can be connected until you disconnect one or upgrade. Sources already connected keep syncing normally.",
  },
  {
    key: "reports",
    label: "Security reports",
    unit: "reports",
    area: "/demo-reports",
    areaLabel: "Reports",
    whatHappens:
      "Report generation pauses for the rest of the billing period. Existing reports and the live report view stay readable.",
  },
  {
    key: "notifications",
    label: "Notification rules",
    unit: "rules",
    area: "/demo-notifications",
    areaLabel: "Notifications",
    whatHappens:
      "New alert rules cannot be enabled until you disable one or upgrade. Rules that are already enabled keep sending alerts.",
  },
  {
    key: "remediation",
    label: "Remediation actions",
    unit: "actions",
    area: "/demo-findings",
    areaLabel: "Remediation",
    whatHappens:
      "New remediation actions can be logged but cannot be approved until room frees up or you upgrade. Existing actions stay visible and tracked.",
  },
];

const capByKey = (key) => CAPABILITIES.find((c) => c.key === key);

/* ---------- tiers ---------- */

const FREE_DASH = "—";

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For small teams getting a first grip on their biggest risks.",
    priceLabel: "TBD",
    priceNote: "Pricing not set — ask for a quote.",
    limits: { assets: 5, connectors: 2, reports: 2, notifications: 1, remediation: 3 },
    access: { assets: "full", connectors: "full", reports: "limited", notifications: "full", remediation: "limited" },
    accessNote: {
      reports: "Executive summary + top priorities only",
      remediation: "Actions without the approval workflow",
    },
    highlight: false,
  },
  {
    id: "business",
    name: "Business",
    tagline: "For growing teams that need connectors, reports, and remediation at scale.",
    priceLabel: "TBD",
    priceNote: "Pricing not set — ask for a quote.",
    limits: { assets: 15, connectors: 5, reports: 15, notifications: 3, remediation: 10 },
    access: { assets: "full", connectors: "full", reports: "full", notifications: "full", remediation: "full" },
    accessNote: {},
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For security-led organisations that need unlimited visibility and control.",
    priceLabel: "TBD",
    priceNote: "Pricing not set — ask for a quote.",
    limits: { assets: null, connectors: null, reports: null, notifications: null, remediation: null },
    access: { assets: "full", connectors: "full", reports: "full", notifications: "full", remediation: "full" },
    accessNote: {},
    highlight: false,
  },
];

export const DEMO_PLAN = {
  id: "demo",
  name: "Demo plan",
  tagline: "Full-access preview used while no billing plan is selected.",
  priceLabel: "Preview",
  priceNote: "No plan, no billing — everything is enabled for the demo.",
  limits: { assets: null, connectors: null, reports: null, notifications: null, remediation: null },
  access: { assets: "full", connectors: "full", reports: "full", notifications: "full", remediation: "full" },
  accessNote: {},
  demo: true,
};

export const PLAN_ORDER = ["starter", "business", "pro"];

export const planById = (id) => PLANS.find((p) => p.id === id);

export function resolvePlan(tierId) {
  if (tierId === "demo") return DEMO_PLAN;
  return planById(tierId) || DEMO_PLAN;
}

export function nextTier(id) {
  if (id === "demo") return "starter";
  const i = PLAN_ORDER.indexOf(id);
  if (i === -1) return "starter";
  return PLAN_ORDER[i + 1] || null;
}

export function limitText(plan, key) {
  if (!plan) return FREE_DASH;
  const cap = capByKey(key);
  const limit = plan.limits[key];
  if (limit === null) return plan.demo ? "Unlimited (preview)" : "Unlimited";
  return `${limit} ${cap.unit}`;
}

/* ---------- feature comparison matrix ---------- */

export const FEATURE_ROWS = [
  {
    group: "Detection",
    rows: [
      { label: "Managed assets", starter: "5", business: "15", pro: "Unlimited" },
      { label: "Connectors", starter: "2", business: "5", pro: "Unlimited" },
      { label: "Findings depth", starter: "Top risks", business: "Full register", pro: "Full register + history" },
    ],
  },
  {
    group: "Reporting",
    rows: [
      { label: "Security reports", starter: "2 / month", business: "15 / month", pro: "Unlimited" },
      { label: "Report depth", starter: "Executive summary", business: "Full detail", pro: "Full detail + export" },
    ],
  },
  {
    group: "Alerting & remediation",
    rows: [
      { label: "Notification rules", starter: "1", business: "3", pro: "Unlimited" },
      { label: "Remediation actions", starter: "3 concurrent", business: "10 concurrent", pro: "Unlimited" },
      { label: "Approval workflow", starter: FREE_DASH, business: "Included", pro: "Included" },
    ],
  },
];

/* ---------- usage status ---------- */

export const STATUS_META = {
  available: { label: "Available", cls: "plan-status-ok", desc: "Plenty of headroom on this plan." },
  approaching: { label: "Approaching limit", cls: "plan-status-warn", desc: "You are close to this plan's cap." },
  reached: { label: "Limit reached", cls: "plan-status-red", desc: "You have hit this plan's cap." },
  restricted: { label: "Restricted", cls: "plan-status-red", desc: "This capability is capped on your plan." },
  unavailable: { label: "Unavailable", cls: "plan-status-muted", desc: "No plan is selected yet." },
  "no-data": { label: "No usage data", cls: "plan-status-muted", desc: "Nothing connected yet." },
};

export function capabilityStatus(plan, key, used) {
  if (!plan) return "unavailable";
  if (used === null || used === undefined) return "no-data";
  const limit = plan.limits[key];
  if (limit === null || limit === undefined) return "available";
  const ratio = used / limit;
  if (ratio >= 1) return plan.access[key] === "limited" ? "restricted" : "reached";
  if (ratio >= 0.8) return "approaching";
  return "available";
}

/* ---------- upgrade comparison ---------- */

export function upgradeDiff(fromPlan, toPlan) {
  if (!fromPlan || !toPlan || fromPlan.id === toPlan.id) return [];
  return CAPABILITIES.map((cap) => {
    const limits = (p) => {
      const v = p.limits[cap.key];
      if (v === null) return "Unlimited";
      return `${v} ${cap.unit}`;
    };
    const access = (p) => (p.access[cap.key] === "limited" ? "Limited" : "Full");
    return {
      key: cap.key,
      label: cap.label,
      current: `${limits(fromPlan)} · ${access(fromPlan)} access`,
      next: `${limits(toPlan)} · ${access(toPlan)} access`,
      improved:
        limitsPredictor(fromPlan, toPlan, cap.key) ||
        (fromPlan.access[cap.key] !== toPlan.access[cap.key]),
    };
  });
}

function limitsPredictor(from, to, key) {
  const a = from.limits[key];
  const b = to.limits[key];
  if (a === null && b === null) return false;
  if (a === null) return false;
  if (b === null) return true;
  return b > a;
}

/* ---------- seeded scenarios ---------- */

export const SEEDED_PLAN_STATES = [
  {
    id: "no-plan",
    label: "No plan selected",
    desc: "A fresh workspace before any plan is picked. Limits are not enforced and every capability reports as unavailable until a plan is chosen.",
    tierId: null,
    used: {},
  },
  {
    id: "starter-low",
    label: "Starter — under limits",
    desc: "A Starter workspace that is comfortably inside every allowance.",
    tierId: "starter",
    used: { assets: 3, connectors: 1, reports: 0, notifications: 0, remediation: 1 },
  },
  {
    id: "starter-approx",
    label: "Starter — approaching a limit",
    desc: "A Starter workspace where one allowance is close to its cap.",
    tierId: "starter",
    used: { assets: 4, connectors: 1, reports: 1, notifications: 0, remediation: 2 },
  },
  {
    id: "asset-reached",
    label: "Starter — asset limit reached",
    desc: "A Starter workspace that has hit the 5-asset cap. New sources can be connected but results stop tracking new assets.",
    tierId: "starter",
    used: { assets: 5, connectors: 1, reports: 1, notifications: 0, remediation: 1 },
  },
  {
    id: "connector-reached",
    label: "Starter — connector limit reached",
    desc: "A Starter workspace at the 2-connector cap. Further sources cannot be connected without disconnecting one.",
    tierId: "starter",
    used: { assets: 3, connectors: 2, reports: 1, notifications: 0, remediation: 1 },
  },
  {
    id: "restricted",
    label: "Starter — restricted report & remediation",
    desc: "A Starter workspace where reporting and remediation have run up against their limited allowed access.",
    tierId: "starter",
    used: { assets: 4, connectors: 1, reports: 2, notifications: 1, remediation: 3 },
  },
  {
    id: "business-compare",
    label: "Business — mid usage",
    desc: "A Business workspace with visible headroom in reporting, while assets, connectors, and remediation sit near their caps.",
    tierId: "business",
    used: { assets: 12, connectors: 4, reports: 8, notifications: 3, remediation: 9 },
  },
  {
    id: "pro-compare",
    label: "Pro — unlimited",
    desc: "A Pro workspace where limits no longer apply and everything is available.",
    tierId: "pro",
    used: { assets: 12, connectors: 3, reports: 8, notifications: 2, remediation: 7 },
  },
  {
    id: "no-usage",
    label: "No usage data",
    desc: "A workspace with no sources connected. Nothing counts against a limit because nothing is being tracked.",
    tierId: "starter",
    used: { assets: null, connectors: null, reports: null, notifications: null, remediation: null },
  },
];

export const seedById = (id) => SEEDED_PLAN_STATES.find((s) => s.id === id) || null;

/* ---------- plan selection persistence ---------- */

export function loadPlanSelection() {
  try {
    const raw = window.localStorage.getItem(PLAN_STORAGE_KEY);
    if (!raw) return "demo";
    const parsed = JSON.parse(raw);
    const tier = parsed && parsed.tierId;
    if (tier === "demo") return "demo";
    if (PLAN_ORDER.includes(tier)) return tier;
    return "demo";
  } catch {
    return "demo";
  }
}

export function savePlanSelection(tierId) {
  try {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ tierId }));
  } catch {
    /* storage unavailable — selection just does not persist */
  }
}