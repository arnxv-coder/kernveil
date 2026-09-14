/* ============================================================
   Kernveil — brand mark + shared SVG atoms
   ============================================================ */

export function BrandMark({ className = "", small = false }) {
  return (
    <span className={`brand-mark${small ? " sm" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M6 21 C8.2 14.5 12 11.5 16 11.5 C20 11.5 23.8 14.5 26 21" stroke="#2ae6c7" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M9 24.5 C11.5 19.5 13.8 17.2 16 17.2 C18.2 17.2 20.5 19.5 23 24.5" stroke="#7ddbf4" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        <circle cx="16" cy="13.5" r="2" fill="#53f3d6" />
      </svg>
    </span>
  );
}

export function ArrowIcon({ className = "" }) {
  return (
    <svg className={`ic ic-arrow${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkArrowIcon({ className = "" }) {
  return (
    <svg className={`ic${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- inject raw, trusted inline SVG markup ---------- */
export function RawSvg({ markup, className = "", ariaHidden = true }) {
  return (
    <span
      className={className || undefined}
      dangerouslySetInnerHTML={{ __html: markup }}
      aria-hidden={ariaHidden === false ? undefined : "true"}
    />
  );
}