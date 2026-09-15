/* ============================================================
   Kernveil — demo workspace state (Context + localStorage).
   One source of truth for the seeded workspace, live finding
   statuses, GitHub connectors, and the activity trail. Everything
   persists in the browser so a "session" survives reload and
   navigation.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ASSETS, FINDINGS, WORKSPACE, OVERVIEW } from "../lib/data.js";
import { appendSync, syncEntryFor } from "../lib/connectors.js";
import { normalizeStatus, STATUS_LABEL, STATUS_GROUP } from "../lib/remediation.js";

export const WORKSPACE_KEY = "kernveil.workspace.v1";
export const FINDING_STATE_KEY = "kernveil.findingState.v1";
export const FINDING_ACTIONS_KEY = "kernveil.findingActions.v1";
export const CONNECTORS_KEY = "kernveil.connectors.v1";
export const CLOUD_KEY = "kernveil.cloudScans.v1";
export const WEBSITE_KEY = "kernveil.websiteScans.v1";

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
    acc.byGrp[STATUS_GROUP[normalizeStatus(f.status)]] += 1;
    if (normalizeStatus(f.status) !== "completed") acc.sevNonResolved[f.severity] += 1;
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

function activityMeta(action, allFindings) {
  const f = allFindings.find((x) => x.id === action.findingId);
  const title = f ? ` · ${f.title}` : "";
  switch (normalizeStatus(action.status)) {
    case "completed":
      return { c: "var(--green)", txt: `Completed remediation${title}` };
    case "in-progress":
      return { c: "var(--amber)", txt: `Moved to in progress${title}` };
    case "approved":
      return { c: "var(--cyan)", txt: `Approved remediation${title}` };
    case "awaiting-approval":
      return { c: "var(--amber)", txt: `Awaiting approval${title}` };
    case "rejected":
      return { c: "var(--slate)", txt: `Proposal rejected${title}` };
    case "failed":
      return { c: "var(--orange)", txt: `Remediation failed${title}` };
    default:
      return { c: "var(--red)", txt: `Proposed${title}` };
  }
}

function auditColor(status) {
  switch (normalizeStatus(status)) {
    case "completed":
      return "var(--green)";
    case "failed":
      return "var(--orange)";
    case "awaiting-approval":
    case "approved":
    case "in-progress":
      return "var(--amber)";
    case "rejected":
      return "var(--slate)";
    default:
      return "var(--red)";
  }
}

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(() => loadJSON(WORKSPACE_KEY, null));
  const [stateMap, setStateMap] = useState(() => loadJSON(FINDING_STATE_KEY, {}));
  const [actions, setActions] = useState(() => loadJSON(FINDING_ACTIONS_KEY, []));
  const [connectors, setConnectors] = useState(() => loadJSON(CONNECTORS_KEY, []));
  const [cloudScans, setCloudScans] = useState(() => loadJSON(CLOUD_KEY, []));
  const [webScans, setWebScans] = useState(() => loadJSON(WEBSITE_KEY, []));

  useEffect(() => saveJSON(WORKSPACE_KEY, workspace), [workspace]);
  useEffect(() => saveJSON(FINDING_STATE_KEY, stateMap), [stateMap]);
  useEffect(() => saveJSON(FINDING_ACTIONS_KEY, actions), [actions]);
  useEffect(() => saveJSON(CONNECTORS_KEY, connectors), [connectors]);
  useEffect(() => saveJSON(CLOUD_KEY, cloudScans), [cloudScans]);
  useEffect(() => saveJSON(WEBSITE_KEY, webScans), [webScans]);

  const createWorkspace = useCallback((name) => {
    const ts = Date.now();
    setWorkspace({
      name: (name || "").trim() || "Acme Retail (sample)",
      plan: WORKSPACE.plan,
      createdAt: ts,
    });
    setStateMap({});
    setActions([]);
    setConnectors([]);
    setCloudScans([]);
    setWebScans([]);
  }, []);

  const resetWorkspace = useCallback(() => {
    setWorkspace(null);
    setStateMap({});
    setActions([]);
    setConnectors([]);
    setCloudScans([]);
    setWebScans([]);
  }, []);

  const setFindingStatus = useCallback((id, status, note) => {
    const at = Date.now();
    setStateMap((prev) => ({ ...prev, [id]: { status, at } }));
    setActions((prev) => [...prev, { id: `${id}-${at}`, findingId: id, status, at, note }]);
  }, []);

  const putConnector = useCallback((record) => {
    setConnectors((prev) => {
      const prevRec = prev.find((c) => c.id === record.id);
      const next = {
        ...record,
        lastError: undefined,
        syncs: appendSync(prevRec && prevRec.syncs, syncEntryFor(record)),
      };
      return [...prev.filter((c) => c.id !== record.id), next];
    });
    setActions((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}-${record.id}`,
        kind: "connector",
        text: `Repository ${record.name || record.repo} — ${record.mode === "demo" ? "demo" : "dependency"} scan complete · ${record.findings.length} finding${record.findings.length === 1 ? "" : "s"}`,
        at: Date.now(),
      },
    ]);
  }, []);

  const removeConnector = useCallback((id) => {
    setConnectors((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const putCloudScan = useCallback((record) => {
    setCloudScans((prev) => {
      const prevRec = prev.find((c) => c.id === record.id);
      const next = {
        ...record,
        lastError: undefined,
        syncs: appendSync(prevRec && prevRec.syncs, syncEntryFor(record)),
      };
      return [...prev.filter((c) => c.id !== record.id), next];
    });
    setActions((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}-${record.id}`,
        kind: "connector",
        text: `Cloud fixture ${record.name} — imported · ${record.findings.length} finding${record.findings.length === 1 ? "" : "s"} across ${record.assets.length} assets`,
        at: Date.now(),
      },
    ]);
  }, []);

  const putWebScan = useCallback((record) => {
    setWebScans((prev) => {
      const prevRec = prev.find((c) => c.id === record.id);
      const next = {
        ...record,
        lastError: undefined,
        syncs: appendSync(prevRec && prevRec.syncs, syncEntryFor(record)),
      };
      return [...prev.filter((c) => c.id !== record.id), next];
    });
    setActions((prev) => [
      ...prev,
      {
        id: `ev-${Date.now()}-${record.id}`,
        kind: "connector",
        text: `Website scan for ${record.name || record.host} — ${record.mode === "demo" ? "sample profile" : "simulated"} · ${record.findings.length} finding${record.findings.length === 1 ? "" : "s"}, ${record.records} checks`,
        at: Date.now(),
      },
    ]);
  }, []);

  const noteConnectorFailure = useCallback((id, message) => {
    const at = Date.now();
    const failEntry = { at, ok: false, note: message, mode: "live" };
    const patch = (prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, lastError: message, syncs: appendSync(c.syncs, failEntry) }
          : c
      );
    setConnectors(patch);
    setCloudScans(patch);
    setWebScans(patch);
  }, []);

  const removeCloudScan = useCallback((id) => {
    setCloudScans((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const removeWebScan = useCallback((id) => {
    setWebScans((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(() => {
    /* Findings imported from connected repositories, cloud fixtures,
       and website scans. */
    const customRecords = [
      ...connectors.flatMap((c) => c.findings || []),
      ...cloudScans.flatMap((c) => c.findings || []),
      ...webScans.flatMap((c) => c.findings || []),
    ];

    /* Live findings: seed data + imported scan findings, each with
       persisted status overrides, appended history, and the audit trail
       recorded with every status transition. */
    const mergeFinding = (f) => {
      const st = stateMap[f.id];
      const status = normalizeStatus(st ? st.status : f.status);
      const own = actions.filter((a) => a.findingId === f.id);
      const history = own.length
        ? [
            ...f.history,
            ...own.map((a) => ({
              time: fmtTime(a.at),
              text: `${STATUS_LABEL[normalizeStatus(a.status)]}${a.note ? ` — ${a.note}` : " — manual update"}`,
              c: auditColor(a.status),
            })),
          ]
        : f.history;
      return { ...f, status, history, last: st ? "just now" : f.last };
    };

    const findings = [...FINDINGS.map(mergeFinding), ...customRecords.map(mergeFinding)];

    /* Overview deltas relative to the narrative baseline. */
    const live = { open: SEED.byGrp.open, wip: SEED.byGrp.wip, resolved: SEED.byGrp.resolved };
    const liveSev = { critical: 0, high: 0, medium: 0, low: 0 };
    let riskDelta = 0;

    for (const f of FINDINGS) {
      const status = normalizeStatus(stateMap[f.id] ? stateMap[f.id].status : f.status);
      const gSeed = STATUS_GROUP[normalizeStatus(f.status)];
      const gLive = STATUS_GROUP[status];
      if (gSeed !== gLive) {
        live[gSeed] -= 1;
        live[gLive] += 1;
      }
      if (status !== "completed") liveSev[f.severity] += 1;
      if (status !== normalizeStatus(f.status)) {
        const wasResolved = normalizeStatus(f.status) === "completed";
        const isResolved = status === "completed";
        if (!wasResolved && isResolved) riskDelta -= SEV_WEIGHT[f.severity];
        else if (wasResolved && !isResolved) riskDelta += SEV_WEIGHT[f.severity];
      }
    }

    /* Imported findings raise the score gently at half severity weight,
       and drop back off when they are completed. */
    for (const f of customRecords) {
      const status = normalizeStatus(stateMap[f.id] ? stateMap[f.id].status : f.status);
      live[STATUS_GROUP[status]] += 1;
      if (status !== "completed") {
        liveSev[f.severity] += 1;
        riskDelta += Math.round(SEV_WEIGHT[f.severity] / 2);
      }
    }

    const assets = [
      ...ASSETS,
      ...connectors.map((c) => c.asset).filter(Boolean),
      ...cloudScans.flatMap((c) => c.assets || []),
      ...webScans.flatMap((c) => c.assets || []),
    ].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);
    const resolved = BASE.resolved + (live.resolved - SEED.byGrp.resolved);

    const overview = {
      risk: clamp(Math.round(BASE.risk + riskDelta), 0, 100),
      critical: BASE.severity.critical + (liveSev.critical - SEED.sevNonResolved.critical),
      high: BASE.severity.high + (liveSev.high - SEED.sevNonResolved.high),
      medium: BASE.severity.medium + (liveSev.medium - SEED.sevNonResolved.medium),
      low: BASE.severity.low + (liveSev.low - SEED.sevNonResolved.low),
      open: BASE.open + (live.open - SEED.byGrp.open),
      inProgress: BASE.inProgress + (live.wip - SEED.byGrp.wip),
      resolved,
      total: BASE.total + customRecords.length,
      assets: assets.length,
      remedPct: resolved,
      delta: OVERVIEW.delta,
      lastSync: OVERVIEW.lastSync,
    };

    /* Recent activity: connector events and finding actions first, then
       the seeded trail. */
    const userActivity = [...actions]
      .reverse()
      .map((a) =>
        a.kind === "connector"
          ? { id: a.id, c: a.c || "var(--teal)", txt: a.text, t: "just now" }
          : { id: a.id, ...activityMeta(a, findings), t: "just now" }
      );
    const activity = [...userActivity, ...SEED_ACTIVITY].slice(0, 8);

    const cloudOpen = cloudScans
      .flatMap((c) => c.findings || [])
      .filter((f) => {
        const status = normalizeStatus(stateMap[f.id] ? stateMap[f.id].status : f.status);
        return status !== "completed";
      }).length;

    const webOpen = webScans
      .flatMap((c) => c.findings || [])
      .filter((f) => {
        const status = normalizeStatus(stateMap[f.id] ? stateMap[f.id].status : f.status);
        return status !== "completed";
      }).length;

    return {
      workspace,
      findings,
      assets,
      connectors,
      cloudScans,
      webScans,
      cloudOpen,
      webOpen,
      overview,
      activity,
      setFindingStatus,
      putConnector,
      removeConnector,
      putCloudScan,
      removeCloudScan,
      putWebScan,
      removeWebScan,
      noteConnectorFailure,
      createWorkspace,
      resetWorkspace,
    };
  }, [workspace, stateMap, actions, connectors, cloudScans, webScans, setFindingStatus, putConnector, removeConnector, putCloudScan, removeCloudScan, putWebScan, removeWebScan, noteConnectorFailure, createWorkspace, resetWorkspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}