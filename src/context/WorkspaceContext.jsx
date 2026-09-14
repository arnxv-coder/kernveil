/* ============================================================
   Kernveil — demo workspace state (Context + localStorage).
   One source of truth for the seeded workspace, live finding
   statuses, and the activity trail. Everything persists in the
   browser so a "session" survives reload and navigation.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FINDINGS, WORKSPACE, OVERVIEW } from "../lib/data.js";

export const WORKSPACE_KEY = "kernveil.workspace.v1";
export const FINDING_STATE_KEY = "kernveil.findingState.v1";
export const FINDING_ACTIONS_KEY = "kernveil.findingActions.v1";

const STATUS_LABEL = {
  open: "Open",
  "in-progress": "In progress",
  approved: "Awaiting approval",
  resolved: "Resolved",
};

/* Approved findings still count as "open/active" for overview grouping. */
const GROUP = { open: "open", approved: "open", "in-progress": "wip", resolved: "resolved" };
const SEV_WEIGHT = { critical: 12, high: 8, medium: 5, low: 3 };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const SEED_ACTIVITY = [
  { id: "seed-activity-1", c: "var(--red)", txt: "New critical finding — exposed storage", t: "2m" },
  { id: "seed-activity-2", c: "var(--teal)", txt: "Monitoring rescan completed", t: "32m" },
  { id: "seed-activity-3", c: "var(--green)", txt: "2 findings resolved", t: "3h" },
  { id: "seed-activity-4", c: "var(--cyan)", txt: "Repository set to private (cms-admin)", t: "5h" },
  { id: "seed-activity-5", c: "var(--amber)", txt: "High finding acknowledged", t: "1d" },
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — demo keeps working for this session */
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtTime(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${dd} · ${hh}:${mi}`;
}

export function initialsOf(name) {
  const words = (name || "").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase());
  return letters.length ? letters.join("") : "KV";
}

/* Seed aggregates across the visible findings — used as the delta base
   for the (larger) narrative overview numbers. */
const SEED = FINDINGS.reduce(
  (acc, f) => {
    acc.byGrp[GROUP[f.status]] += 1;
    if (f.status !== "resolved") acc.sevNonResolved[f.severity] += 1;
    return acc;
  },
  { byGrp: { open: 0, wip: 0, resolved: 0 }, sevNonResolved: { critical: 0, high: 0, medium: 0, low: 0 } }
);

const BASE = {
  open: OVERVIEW.open,
  inProgress: OVERVIEW.inProgress,
  resolved: OVERVIEW.resolved,
  total: OVERVIEW.total,
  risk: OVERVIEW.risk,
  severity: { critical: OVERVIEW.critical, high: OVERVIEW.high, medium: OVERVIEW.medium, low: OVERVIEW.low },
};

function activityMeta(action) {
  const f = FINDINGS.find((x) => x.id === action.findingId);
  const title = f ? f.title : "a finding";
  switch (action.status) {
    case "resolved":
      return { c: "var(--green)", txt: `Resolved · ${title}` };
    case "in-progress":
      return { c: "var(--amber)", txt: `Moved to in progress · ${title}` };
    case "approved":
      return { c: "var(--cyan)", txt: `Marked awaiting approval · ${title}` };
    default:
      return { c: "var(--red)", txt: `Reopened · ${title}` };
  }
}

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(() => loadJSON(WORKSPACE_KEY, null));
  const [stateMap, setStateMap] = useState(() => loadJSON(FINDING_STATE_KEY, {}));
  const [actions, setActions] = useState(() => loadJSON(FINDING_ACTIONS_KEY, []));

  useEffect(() => saveJSON(WORKSPACE_KEY, workspace), [workspace]);
  useEffect(() => saveJSON(FINDING_STATE_KEY, stateMap), [stateMap]);
  useEffect(() => saveJSON(FINDING_ACTIONS_KEY, actions), [actions]);

  const createWorkspace = useCallback((name) => {
    const ts = Date.now();
    setWorkspace({
      name: (name || "").trim() || "Acme Retail (sample)",
      plan: WORKSPACE.plan,
      createdAt: ts,
    });
    setStateMap({});
    setActions([]);
  }, []);

  const resetWorkspace = useCallback(() => {
    setWorkspace(null);
    setStateMap({});
    setActions([]);
  }, []);

  const setFindingStatus = useCallback((id, status) => {
    const at = Date.now();
    setStateMap((prev) => ({ ...prev, [id]: { status, at } }));
    setActions((prev) => [...prev, { id: `${id}-${at}`, findingId: id, status, at }]);
  }, []);

  const value = useMemo(() => {
    /* Live findings: seed data + persisted status overrides + appended history. */
    const findings = FINDINGS.map((f) => {
      const st = stateMap[f.id];
      const status = st ? st.status : f.status;
      const own = actions.filter((a) => a.findingId === f.id);
      const history = own.length
        ? [
            ...f.history,
            ...own.map((a) => ({
              time: fmtTime(a.at),
              text: `${STATUS_LABEL[a.status]} — manual update`,
              c: a.status === "resolved" ? "var(--green)" : a.status === "in-progress" || a.status === "approved" ? "var(--amber)" : "var(--red)",
            })),
          ]
        : f.history;
      return { ...f, status, history, last: st ? "just now" : f.last };
    });

    /* Overview deltas relative to the narrative baseline. */
    const live = { open: SEED.byGrp.open, wip: SEED.byGrp.wip, resolved: SEED.byGrp.resolved };
    const liveSev = { critical: 0, high: 0, medium: 0, low: 0 };
    let riskDelta = 0;

    for (const f of FINDINGS) {
      const status = stateMap[f.id] ? stateMap[f.id].status : f.status;
      const gSeed = GROUP[f.status];
      const gLive = GROUP[status];
      if (gSeed !== gLive) {
        live[gSeed] -= 1;
        live[gLive] += 1;
      }
      if (status !== "resolved") liveSev[f.severity] += 1;
      if (status !== f.status) {
        const wasResolved = f.status === "resolved";
        const isResolved = status === "resolved";
        if (!wasResolved && isResolved) riskDelta -= SEV_WEIGHT[f.severity];
        else if (wasResolved && !isResolved) riskDelta += SEV_WEIGHT[f.severity];
      }
    }

    const resolved = BASE.resolved + (live.resolved - SEED.byGrp.resolved);
    const overview = {
      risk: clamp(BASE.risk + riskDelta, 0, 100),
      critical: BASE.severity.critical + (liveSev.critical - SEED.sevNonResolved.critical),
      high: BASE.severity.high + (liveSev.high - SEED.sevNonResolved.high),
      medium: BASE.severity.medium + (liveSev.medium - SEED.sevNonResolved.medium),
      low: BASE.severity.low + (liveSev.low - SEED.sevNonResolved.low),
      open: BASE.open + (live.open - SEED.byGrp.open),
      inProgress: BASE.inProgress + (live.wip - SEED.byGrp.wip),
      resolved,
      total: BASE.total,
      assets: OVERVIEW.assets,
      remedPct: resolved,
      delta: OVERVIEW.delta,
      lastSync: OVERVIEW.lastSync,
    };

    /* Recent activity: user actions first, then the seeded trail. */
    const userActivity = [...actions]
      .reverse()
      .map((a) => ({ id: a.id, ...activityMeta(a), t: "just now" }));
    const activity = [...userActivity, ...SEED_ACTIVITY].slice(0, 8);

    return {
      workspace,
      findings,
      overview,
      activity,
      setFindingStatus,
      createWorkspace,
      resetWorkspace,
    };
  }, [workspace, stateMap, actions, setFindingStatus, createWorkspace, resetWorkspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}