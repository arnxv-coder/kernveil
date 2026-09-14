import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, forceMotion } from "../lib/web.js";

/* ============================================================
   Reduced-motion notice: offer an opt back in to animations.
   Mirrors the behaviour of the old js/lib/common.js system.
   ============================================================ */
export default function MotionNotice() {
  const [visible, setVisible] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    if (!prefersReducedMotion.matches || forceMotion) return;
    try {
      if (sessionStorage.getItem("kernveil.motion.notice") === "seen") return;
    } catch (e) {
      /* ignore */
    }
    timer.current = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer.current);
  }, []);

  if (!visible) return null;

  return (
    <div className="motion-notice" role="status">
      <span className="motion-notice-txt">
        Animations are turned off by your device&rsquo;s reduced-motion setting.
      </span>
      <button
        className="motion-notice-btn"
        type="button"
        onClick={() => {
          try {
            localStorage.setItem("kernveil.motion", "on");
          } catch (e) {
            /* ignore */
          }
          window.location.reload();
        }}
      >
        Enable animations
      </button>
      <button
        className="motion-notice-x"
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try {
            sessionStorage.setItem("kernveil.motion.notice", "seen");
          } catch (e) {
            /* ignore */
          }
          setVisible(false);
        }}
      >
        &times;
      </button>
    </div>
  );
}