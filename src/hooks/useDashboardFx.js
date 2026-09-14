/* ============================================================
   Kernveil — demo workspace entrance effects (overview)
   ============================================================ */
import { useEffect } from "react";
import { gsap, reducedMotion, applyDataCounts, pop } from "../lib/anim.jsx";

export function useDashboardFx(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const REDUCED = reducedMotion();

    const ctx = gsap.context(() => {
      pop(root.querySelectorAll(".kpi"), 0.1);
      pop(root.querySelectorAll(".overview-grid > .panel"), 0.12);

      const gauge = root.querySelector(".dash-gauge");
      if (gauge) {
        gsap.to(gauge, { strokeDashoffset: parseFloat(gauge.getAttribute("data-offset") || "26"), duration: 1.6, ease: "power2.inOut", delay: 0.3 });
      }
      const remed = root.querySelector(".dash-remed");
      if (remed) {
        gsap.fromTo(remed, { strokeDashoffset: 100 }, { strokeDashoffset: parseFloat(remed.getAttribute("data-offset") || "77"), duration: 1.6, ease: "power2.inOut", delay: 0.3 });
      }

      root.querySelectorAll(".dash-sev").forEach((b, i) => {
        gsap.to(b, { width: b.getAttribute("data-h") + "%", duration: 1.1, ease: "power3.out", delay: 0.4 + i * 0.1 });
      });

      if (!REDUCED) {
        gsap.fromTo(
          ".activity-list li",
          { opacity: 0, x: -12 },
          { opacity: 1, x: 0, duration: 0.5, ease: "power2.out", stagger: 0.08, delay: 0.6 }
        );
      }
    }, root);

    applyDataCounts(root);

    return () => ctx.revert();
  }, [rootRef]);
}