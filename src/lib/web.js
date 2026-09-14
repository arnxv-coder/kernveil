/* ============================================================
   Kernveil — shared web helpers & motion preference system
   (React edition of the old js/lib/common.js core)
   ============================================================ */

export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export const prefersReducedMotion = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };

export const finePointer = window.matchMedia
  ? window.matchMedia("(pointer: fine)").matches
  : true;

// Explicit per-site override so a user can opt back in to animations even
// when the OS requests reduced motion (default always respects the OS).
export const forceMotion = (() => {
  try {
    return localStorage.getItem("kernveil.motion") === "on";
  } catch (e) {
    return false;
  }
})();

export const reducedMotion = () => prefersReducedMotion.matches && !forceMotion;

export const KV = {
  $,
  $$,
  prefersReducedMotion,
  finePointer,
  reducedMotion,
  forceMotion,
};

/* ---------- Count-up ---------- */
export function countUp(el, target, { duration = 1400, suffix = "", decimals = 0 } = {}) {
  const go = () => {
    if (reducedMotion()) {
      el.textContent = target.toLocaleString("en-US") + suffix;
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-US") + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            io.disconnect();
            go();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
  } else {
    go();
  }
}

/* ---------- data-* attribute helpers ---------- */
export function applyDataCounts(root) {
  $$("[data-count]", root).forEach((el) => {
    const target = parseFloat(el.getAttribute("data-count") || "0");
    const suffix = el.getAttribute("data-suffix") || "";
    const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    countUp(el, target, { suffix, decimals });
  });
}

/* ---------- Reveal on scroll (data-reveal) ---------- */
export function setupReveals(root) {
  const items = $$("[data-reveal]", root);
  if (!items.length) return;

  $$("[data-reveal-group]", root).forEach((group) => {
    $$("[data-reveal]", group).forEach((el, i) => {
      el.style.transitionDelay = Math.min(i * 30, 180) + "ms";
    });
  });

  if (reducedMotion()) {
    items.forEach((el) => el.classList.add("is-inview"));
    return;
  }

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-inview"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-inview");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
  );
  items.forEach((el) => io.observe(el));
}

/* ---------- Magnetic buttons (desktop, non-reduced-motion) ---------- */
export function initMagnetic(root) {
  if (!finePointer || prefersReducedMotion.matches) return;
  $$("[data-magnetic]", root).forEach((el) => {
    const strength = 12;
    let raf = 0;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transition = "none";
        el.style.transform = `translate(${dx * 0.28}px, ${dy * 0.34}px)`;
      });
    });
    el.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      el.style.transition = "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "translate(0,0)";
    });
  });
}

/* ---------- Cursor-follow glow for cards ---------- */
export function initCardLights(root) {
  if (!finePointer || prefersReducedMotion.matches) return;
  $$(".cap-card", root).forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
  });
}