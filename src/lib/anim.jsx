/* ============================================================
   Kernveil — GSAP registration + shared dashboard animation kit
   ============================================================ */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion, countUp, applyDataCounts } from "../lib/web.js";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger, reducedMotion, countUp, applyDataCounts };

/* ---------- soft rise-in stagger helper ---------- */
/* eslint-disable no-unused-vars */
export function pop(els, delay = 0.06) {
  if (reducedMotion()) {
    gsap.set(els, { opacity: 1, y: 0 });
    return;
  }
  gsap.fromTo(els, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: delay });
}

/* ---------- severity/status metadata (shared by dashboard pages) ---------- */
export const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export const STATUS_META = {
  open: { label: "Open", cls: "st-open" },
  "in-progress": { label: "In progress", cls: "st-wip" },
  approved: { label: "Awaiting approval", cls: "st-approved" },
  resolved: { label: "Resolved", cls: "st-resolved" },
};

export const RISK_META = {
  critical: { label: "Critical", cls: "badge-red" },
  high: { label: "High", cls: "badge-orange" },
  medium: { label: "Medium", cls: "badge-amber" },
  low: { label: "Low", cls: "badge-slate" },
  healthy: { label: "Healthy", cls: "badge-green" },
};

/* ---------- type icons (server/storage/database/application/api/website/identity/cloud) ---------- */
export const TYPE_ICONS = {
  server: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="13" width="18" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 7.5h.01M7 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  storage: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  database: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 5.5v13c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-13" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 12c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  application: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h.01M8 12h.01M8 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 8l5 5m-5 0l5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  api: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v5M5 6.5l3.5 3.5M19 6.5L15.5 10M5 17.5L8.5 14M19 17.5L15.5 14M12 16v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 14h.01M10 14h.01M7 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  identity: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19c.7-3.2 3.2-5.5 6.5-5.5s5.8 2.3 6.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  repository: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 19a4 4 0 0 1 4-4h7a4 4 0 0 1 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 7.7v6.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 14a3.5 3.5 0 0 0 3.5-3.5A3.5 3.5 0 0 0 8.5 14z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <path d="M15.5 14a3.5 3.5 0 0 1-3.5-3.5A3.5 3.5 0 0 1 15.5 14z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8h16M4 15h16M8 4v16M16 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 11v1M12 11v1M17 11v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

/* ---------- connector icons ---------- */
export const CONN_ICONS = {
  github: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cloud: TYPE_ICONS.cloud,
  website: TYPE_ICONS.website,
  identity: TYPE_ICONS.identity,
  backup: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  saas: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="9" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V7a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="14.5" r="1.3" fill="currentColor" />
    </svg>
  ),
};