/* ============================================================
   Kernveil — demo workspace entry
   Name a seeded demo workspace and step into the product.
   Returning visitors are sent straight to their saved workspace.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "../../components/Icons.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

export default function DemoEntry() {
  const { workspace, createWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [name, setName] = useState("Acme Retail (sample)");

  useEffect(() => {
    if (workspace) navigate("/demo", { replace: true });
  }, [workspace, navigate]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll("[data-entry]");
    els.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i * 80, 400)}ms`;
    });
    const timer = window.setTimeout(() => {
      els.forEach((el) => el.classList.add("is-visible"));
    }, 60);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    createWorkspace(name);
    navigate("/demo", { replace: true });
  };

  return (
    <div className="entry-wrap" ref={rootRef}>
      <div className="entry-glow entry-glow-a" aria-hidden="true"></div>
      <div className="entry-glow entry-glow-b" aria-hidden="true"></div>

      <main className="entry-card">
        <span className="entry-logo" data-entry>
          <BrandMark />
        </span>
        <span className="badge badge-teal" data-entry>
          <span className="dot"></span>
          Interactive demo
        </span>
        <h1 data-entry>Name your demo workspace</h1>
        <p className="entry-lede" data-entry>
          Kernveil is seeded with a realistic security posture so you can try the
          flow end to end. Pick a workspace name and step in.
        </p>

        <form className="entry-form" onSubmit={submit} data-entry>
          <label htmlFor="entryWorkspace">Workspace name</label>
          <input
            id="entryWorkspace"
            type="text"
            autoComplete="off"
            spellCheck="false"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <p className="entry-hint">
            Everything you change — statuses, history, the activity trail — is
            saved in your browser for this workspace.
          </p>
          <button className="btn btn-primary btn-lg entry-submit" type="submit">
            Enter the workspace
          </button>
        </form>

        {workspace && (
          <p className="entry-existing" data-entry>
            A saved workspace already exists — entering again replaces it with a
            fresh seed.
            <button type="button" className="link-arrow" onClick={() => navigate("/demo")}>
              Continue to the existing workspace
            </button>
          </p>
        )}

        <p className="entry-foot mono" data-entry>
          Demo workspace · fictional sample data · not a real security scan
        </p>
      </main>
    </div>
  );
}