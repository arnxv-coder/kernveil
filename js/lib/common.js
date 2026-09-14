/* ============================================================
   Kernveil — shared helpers & site-level interactions
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  const finePointer = window.matchMedia
    ? window.matchMedia("(pointer: fine)").matches
    : true;

  // Explicit per-site override so a user can opt back in to animations even
  // when the OS requests reduced motion (default always respects the OS).
  const forceMotion = (() => {
    try {
      return localStorage.getItem("kernveil.motion") === "on";
    } catch (e) {
      return false;
    }
  })();

  const reducedMotion = () => prefersReducedMotion.matches && !forceMotion;

  // Must happen before first paint so the CSS reduced-motion guards un-apply
  // when the user has explicitly opted back in to animations.
  if (forceMotion) document.documentElement.classList.add("kv-motion");

  window.KV = { $, $$, prefersReducedMotion, finePointer, reducedMotion, forceMotion };

  /* ---------- Count-up ---------- */
  function countUp(el, target, { duration = 1400, suffix = "", decimals = 0 } = {}) {
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
  window.KV.countUp = countUp;

  /* ---------- data-* attribute helpers ---------- */
  function applyDataCounts(root) {
    $$("[data-count]", root).forEach((el) => {
      const target = parseFloat(el.getAttribute("data-count") || "0");
      const suffix = el.getAttribute("data-suffix") || "";
      const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      countUp(el, target, { suffix, decimals });
    });
  }
  window.KV.applyDataCounts = applyDataCounts;

  /* ---------- Reveal on scroll (data-reveal) ---------- */
  // Staggered siblings: add a transition-delay based on group position when
  // elements share the same direct parent and a data-reveal-group is present.
  function setupReveals(root) {
    const items = $$("[data-reveal]", root);
    if (!items.length) return;

    // Staggered siblings: micro-cascade 30ms per item, capped under the
    // 200ms total budget (motion-design 1/3 Rule) when elements share the
    // same direct parent and a data-reveal-group is present.
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
  window.KV.setupReveals = setupReveals;

  /* ---------- Header: compress on scroll ---------- */
  function initHeader() {
    const header = $("#site-header");
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle("is-solid", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  function initMobileMenu() {
    const toggle = $("#mobile-toggle");
    const menu = $("#mobile-menu");
    if (!toggle || !menu) return;
    const body = document.body;

    const setOpen = (open) => {
      menu.hidden = !open;
      if (open) {
        menu.classList.remove("is-open");
        // force reflow so the transition plays
        void menu.offsetWidth;
        requestAnimationFrame(() => menu.classList.add("is-open"));
        body.style.overflow = "hidden";
      } else {
        menu.classList.remove("is-open");
        body.style.overflow = "";
      }
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    toggle.addEventListener("click", () => {
      setOpen(menu.classList.contains("is-open") ? false : true);
    });

    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) setOpen(false);
    });
  }

  /* ---------- Modal system (sign-in / contact / legal) ---------- */
  function initModals() {
    const backdrop = $("#modalBackdrop");
    const modal = $("#modal");
    const modalBody = $("#modalBody");
    const modalClose = $("#modalClose");
    if (!modal || !modalBody) return;

    const content = {
      signin: {
        label: "Product preview",
        badge: ["badge-teal", "Interactive demo"],
        title: "Kernveil is not a live app yet",
        body: "This site is an interactive product preview with seeded, clearly-fictional demo data. There are no user accounts or sign-ins to create here.",
        cta: { href: "demo.html", text: "Explore the demo instead" },
      },
      contact: {
        label: "Contact",
        title: "We are still building.",
        body: "Kernveil is in development and not accepting sign-ups yet. You can explore the interactive product preview now; when accounts open, they will be announced here.",
      },
      privacy: {
        label: "Privacy",
        title: "Privacy",
        body: "This site stores no personal data and sets no tracking cookies. The demo uses only local, seeded data that lives in your browser. No visitor information is collected or shared.",
      },
      terms: {
        label: "Terms",
        title: "Terms of use",
        body: "The interactive product preview on this site shows fictional example data for illustration. It is not a security assessment, does not scan your systems, and should not be used as the basis for any security decision.",
      },
    };

    let lastFocus = null;

    const render = (key) => {
      const c = content[key];
      if (!c) return;
      const badge = c.badge
        ? `<span class="badge ${c.badge[0]}"><span class="dot"></span>${c.badge[1]}</span>`
        : `<span class="badge badge-teal"><span class="dot"></span>${c.label}</span>`;
      const cta = c.cta
        ? `<a class="btn btn-primary" href="${c.cta.href}">${c.cta.text}<svg class="ic ic-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`
        : `<a class="btn btn-secondary" href="index.html#hero">Back to the site</a>`;
      modalBody.innerHTML = `
        ${badge}
        <h3>${c.title}</h3>
        <p>${c.body}</p>
        <div class="modal-actions">${cta}</div>
      `;
      modal.setAttribute("aria-label", c.title);
    };

    const open = (key, opener) => {
      render(key);
      lastFocus = opener;
      backdrop.hidden = false;
      modal.hidden = false;
      requestAnimationFrame(() => {
        backdrop.classList.add("is-open");
        modal.classList.add("is-open");
      });
      body.noScroll = true;
      document.body.style.overflow = "hidden";
      modalClose.focus();
    };

    const close = () => {
      backdrop.classList.remove("is-open");
      modal.classList.remove("is-open");
      const done = () => {
        backdrop.hidden = true;
        modal.hidden = true;
        document.body.style.overflow = "";
      };
      if (prefersReducedMotion.matches) done();
      else setTimeout(done, 320);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    };

    $$("[data-open-modal]").forEach((btn) => {
      btn.addEventListener("click", () => open(btn.getAttribute("data-open-modal"), btn));
    });
    const signIn = $("#nav-signin");
    if (signIn) signIn.addEventListener("click", () => open("signin", signIn));

    modalClose.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) close();
    });
  }

  /* ---------- Magnetic buttons (desktop, non-reduced-motion) ---------- */
  function initMagnetic() {
    if (!finePointer || prefersReducedMotion.matches) return;
    $$("[data-magnetic]").forEach((el) => {
      const strength = 12;
      let raf = 0;
      // 1:1 follow while the pointer is over the button...
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
      // ...then ease back home with a springy settle (release = 300ms)
      el.addEventListener("pointerleave", () => {
        cancelAnimationFrame(raf);
        el.style.transition = "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* ---------- Cursor-follow glow for cards ---------- */
  function initCardLights() {
    if (!finePointer || prefersReducedMotion.matches) return;
    $$(".cap-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });
  }

  /* ---------- Reduced-motion notice: offer opt back in ---------- */
  function initMotionNotice() {
    if (!prefersReducedMotion.matches || forceMotion) return;
    try {
      if (sessionStorage.getItem("kernveil.motion.notice") === "seen") return;
    } catch (e) { /* ignore */ }

    const el = document.createElement("div");
    el.className = "motion-notice";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="motion-notice-txt">Animations are turned off by your device&rsquo;s reduced-motion setting.</span>' +
      '<button class="motion-notice-btn" type="button">Enable animations</button>' +
      '<button class="motion-notice-x" type="button" aria-label="Dismiss">&times;</button>';

    el.querySelector(".motion-notice-btn").addEventListener("click", () => {
      try { localStorage.setItem("kernveil.motion", "on"); } catch (e) { /* ignore */ }
      location.reload();
    });
    el.querySelector(".motion-notice-x").addEventListener("click", () => {
      try { sessionStorage.setItem("kernveil.motion.notice", "seen"); } catch (e) { /* ignore */ }
      el.remove();
    });

    document.body.appendChild(el);
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initHeader();
    initMobileMenu();
    initModals();
    initMagnetic();
    initCardLights();
    setupReveals(document);
    initMotionNotice();
  });
})();