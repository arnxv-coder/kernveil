/* ============================================================
   Kernveil — marketing page animations (GSAP + Motion) for React
   Direct port of the old js/marketing.js behaviour, scoped to a
   mounted subtree and torn down cleanly on unmount.
   ============================================================ */
import { useEffect } from "react";
import { gsap, ScrollTrigger, reducedMotion, applyDataCounts } from "../lib/anim.jsx";
import { $$, finePointer } from "../lib/web.js";
import { animate } from "motion";

export function useMarketingFx(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const REDUCED = reducedMotion();

    /* ---------- shared site-level interactions ---------- */
    const disposeHeader = setupHeaderScroll();
    setupReveals(root);
    initMagnetic(root);
    initCardLights(root);

    /* ---------- reduced motion: set final states, skip animation ---------- */
    function reducedPath() {
      gsap.set([".gauge-value", "#scGauge"], { strokeDashoffset: 26 });
      gsap.set("#scRemed", { strokeDashoffset: 77 });
      gsap.set(".trend-line", { strokeDashoffset: 0 });
      gsap.set(".trend-area", { opacity: 1 });
      gsap.set(
        "[data-hero-copy] [data-reveal], [data-hero-line], [data-hero-sub], [data-hero-cta], [data-hero-note], .hud-card, .metric, .hud-finding, .hud-foot",
        { opacity: 1, y: 0, filter: "blur(0px)" }
      );
      $$(".sev-bar[data-h]").forEach((b) => {
        b.style.width = b.getAttribute("data-h") + "%";
      });
      applyDataCounts(root.querySelector(".hero-visual"));
    }

    if (REDUCED) {
      reducedPath();
      return () => {
        disposeHeader && disposeHeader();
      };
    }

    /* ---------- 1. Hero entrance timeline ---------- */
    function heroIntro() {
      gsap
        .timeline({ delay: 0.15 })
        .fromTo(
          "[data-hero-copy] [data-reveal], [data-hero-line], [data-hero-sub], [data-hero-cta], [data-hero-note]",
          { opacity: 0, y: 24, filter: "blur(8px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.75, ease: "power3.out", stagger: 0.09 },
          0
        )
        .fromTo(
          "[data-hero-copy] .hero-title .line",
          { yPercent: 34, opacity: 0, rotate: 0.001 },
          { yPercent: 0, opacity: 1, duration: 1.05, ease: "power4.out", stagger: 0.13, clearProps: "transform" },
          0.05
        );

      gsap.fromTo(
        ".hud-card",
        { opacity: 0, y: 46, scale: 0.96, rotateX: 7, transformOrigin: "50% 100%" },
        { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 1.15, ease: "power3.out", delay: 0.32, clearProps: "opacity" }
      );
      gsap.fromTo(".hero-visual", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.2 });
      gsap.fromTo(".hero-bg", { opacity: 0 }, { opacity: 0.85, duration: 0.8, ease: "power1.out", delay: 0.55 });

      gsap.to(".risk-gauge .gauge-value", {
        strokeDashoffset: 26,
        duration: 1.5,
        ease: "power2.inOut",
        delay: 0.75,
      });

      gsap.fromTo(".metric", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out", stagger: 0.07, delay: 1.05 });

      gsap.fromTo(".hud-finding", { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out", stagger: 0.07, delay: 1.25 });

      gsap.to(".trend-line", { strokeDashoffset: 0, duration: 1.8, ease: "power1.inOut", delay: 0.95 });
      gsap.to(".trend-area", { opacity: 1, duration: 0.9, ease: "power1.out", delay: 1.9 });

      gsap.fromTo(".hud-foot", { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.out", delay: 1.7 });

      applyDataCounts(root.querySelector(".hero-visual"));
    }

    /* ---------- 2. Continuous "living system" behaviors ---------- */
    function heroIdle() {
      gsap.fromTo(
        ".hud-scan",
        { yPercent: -120, opacity: 0 },
        {
          yPercent: 130,
          opacity: 1,
          duration: 6.5,
          ease: "none",
          repeat: -1,
          keyframes: [
            { yPercent: -120, opacity: 0, duration: 0.65, ease: "power2.in" },
            { opacity: 1, duration: 0.4 },
            { yPercent: 130, opacity: 1, duration: 4.2, ease: "none" },
            { opacity: 0, duration: 0.5, ease: "power2.out" },
          ],
        }
      );

      gsap.fromTo(
        ".hud-status .dots i",
        { scale: 1 },
        { scale: 1.35, duration: 1.6, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: 0.12 }
      );

      gsap.to(".metric", {
        y: -3,
        duration: 3.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.5,
        delay: 1.9,
      });

      gsap.to(".gauge-value", { opacity: 0.85, duration: 2.2, ease: "sine.inOut", repeat: -1, yoyo: true });
    }

    /* ---------- 3. Data flowing through the background graph ---------- */
    const FLOWS = [
      { x1: 120, y1: 120, x2: 330, y2: 90 },
      { x1: 330, y1: 90, x2: 540, y2: 150 },
      { x1: 540, y1: 150, x2: 430, y2: 300 },
      { x1: 330, y1: 90, x2: 300, y2: 260 },
    ];

    function networkPulses() {
      const g = root.querySelector(".hero-network .pulses");
      if (!g) return;
      const NS = "http://www.w3.org/2000/svg";
      const dots = FLOWS.map((f, i) => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("r", String(2.2 + (i % 2) * 1.2));
        c.setAttribute("fill", i % 2 ? "#7ddbf4" : "#53f3d6");
        c.style.opacity = "0";
        g.appendChild(c);
        return { el: c, f, dur: 3.2 + i * 1.1, delay: i * 1.7 };
      });

      dots.forEach(({ el, f, dur, delay }) => {
        const tl = gsap.timeline({ repeat: -1, delay });
        tl.set(el, { x: f.x1, y: f.y1, autoAlpha: 0 })
          .to(el, { autoAlpha: 1, duration: dur * 0.16, ease: "power1.in" })
          .to(el, { x: f.x2, y: f.y2, duration: dur * 0.68, ease: "none" })
          .to(el, { autoAlpha: 0, duration: dur * 0.16, ease: "power1.out" });
      });
    }

    /* ---------- 4. Scroll choreography ---------- */
    function scrollFX() {
      gsap.to(".hero-bg", {
        y: 130,
        opacity: 0.45,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-visual", {
        y: 46,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });

      const stepsWrap = root.querySelector("[data-steps]");
      const fill = root.querySelector("[data-step-fill]");
      if (stepsWrap && fill) {
        gsap.to(fill, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: stepsWrap,
            start: "top 72%",
            end: "bottom 45%",
            scrub: 0.5,
          },
        });

        $$(".step", stepsWrap).forEach((el) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 58%",
            end: "bottom 52%",
            onToggle: (self) => {
              el.classList.toggle("is-active", self.isActive);
            },
          });
        });
      }

      const scGauge = root.querySelector("#scGauge");
      if (scGauge) {
        gsap.to(scGauge, {
          strokeDashoffset: 26,
          ease: "power2.inOut",
          scrollTrigger: { trigger: "#scGauge", start: "top 80%", once: true },
        });
      }
      const scRemed = root.querySelector("#scRemed");
      if (scRemed) {
        gsap.fromTo(
          scRemed,
          { strokeDashoffset: 100 },
          {
            strokeDashoffset: 77,
            ease: "power2.inOut",
            scrollTrigger: { trigger: "#scRemed", start: "top 80%", once: true },
          }
        );
      }
      $$(".sev-bar[data-h]").forEach((bar) => {
        gsap.to(bar, {
          width: bar.getAttribute("data-h") + "%",
          ease: "power3.out",
          duration: 1.1,
          scrollTrigger: { trigger: bar, start: "top 88%", once: true },
        });
      });

      ScrollTrigger.create({
        trigger: ".ef-evidence",
        start: "top 85%",
        once: true,
        onEnter: () => gsap.fromTo(".ef-evidence", { y: 14 }, { y: 0, duration: 0.8, ease: "power2.out" }),
      });
    }

    /* ---------- 5. Subtle 3D tilt on the HUD card (desktop only) ---------- */
    function hudTilt() {
      if (!finePointer) return;
      const wrap = root.querySelector(".hero-visual");
      const card = root.querySelector(".hud-card");
      if (!wrap || !card) return;
      const rx = gsap.quickTo(card, "rotationX", { duration: 0.7, ease: "power3.out" });
      const ry = gsap.quickTo(card, "rotationY", { duration: 0.7, ease: "power3.out" });
      gsap.set(card, { transformPerspective: 900, transformOrigin: "50% 50%" });

      const onMove = (e) => {
        const r = wrap.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        ry(nx * 5);
        rx(-ny * 4);
      };
      const onLeave = () => {
        ry(0);
        rx(0);
      };
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerleave", onLeave);
      return () => {
        wrap.removeEventListener("pointermove", onMove);
        wrap.removeEventListener("pointerleave", onLeave);
      };
    }

    /* ---------- 6. Motion-powered micro-pulse on status dots ---------- */
    function motionMicro() {
      const badge = root.querySelector(".hud-status .dots");
      if (!badge) return;
      const dots = $$("i", badge);
      const controls = [];
      dots.forEach((d, i) => {
        controls.push(
          animate(d, { backgroundColor: "rgba(42,230,199,1)" }, { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay: i * 0.18, ease: "easeInOut" })
        );
      });
      return () => {
        controls.forEach((c) => c.stop && c.stop());
      };
    }

    const ctx = gsap.context(() => {
      const cleanups = [hudTilt(), motionMicro()];
      heroIntro();
      heroIdle();
      networkPulses();
      scrollFX();
      return () => {
        cleanups.forEach((fn) => fn && fn());
      };
    }, root);

    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      disposeHeader && disposeHeader();
      ctx.revert();
    };
  }, [rootRef]);
}

/* ---------- header compress on scroll ---------- */
function setupHeaderScroll() {
  const header = document.querySelector("#site-header");
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle("is-solid", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

/* ---------- scroll reveals (data-reveal) ---------- */
function setupReveals(root) {
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

/* ---------- magnetic buttons + cursor light cards ---------- */
function initMagnetic(root) {
  if (!finePointer || reducedMotion()) return;
  $$("[data-magnetic]", root).forEach((el) => {
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

function initCardLights(root) {
  if (!finePointer || reducedMotion()) return;
  $$(".cap-card", root).forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
  });
}