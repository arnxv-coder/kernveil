/* ============================================================
   Kernveil — demo workspace badge atoms
   ============================================================ */
import { STATUS_META, RISK_META } from "../../lib/anim.jsx";

export function statusBadge(status) {
  const m = STATUS_META[status] || { label: status, cls: "st-open" };
  return (
    <span className={`status-badge ${m.cls}`}>
      <span className="sdot"></span>
      {m.label}
    </span>
  );
}

export function riskBadge(risk) {
  const m = RISK_META[risk] || RISK_META.low;
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export function severityPill(sev) {
  const label = sev.charAt(0).toUpperCase() + sev.slice(1);
  return <span className={`sev sev-${sev}`}>{label}</span>;
}

export function typeLabel(k) {
  return k.charAt(0).toUpperCase() + k.slice(1);
}