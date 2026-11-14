import { useEffect, useRef } from "react";
import { GLOSSARY } from "../content";
import Icon from "./Icon";

interface GlossaryProps {
  /** The term to show first and highlight. */
  term: string;
  onClose: () => void;
}

export default function Glossary({ term, onClose }: GlossaryProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  const entries = [...GLOSSARY].sort((a, b) => Number(b.id === term) - Number(a.id === term));

  return (
    <div className="scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="gl-title" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 id="gl-title">
            <Icon name="book" size={24} />
            Glossary
          </h2>
          <button ref={closeRef} type="button" className="icon-btn icon-btn-soft" aria-label="Close the glossary" onClick={onClose}>
            <Icon name="x" strokeWidth={2} />
          </button>
        </div>
        <p className="small muted">Every term in plain words: the short answer first, then how it works.</p>
        <dl className="glossary-list">
          {entries.map((g) => (
            <div key={g.id} className={g.id === term ? "glossary-item is-on" : "glossary-item"}>
              <dt>{g.term}</dt>
              <dd>{g.text}</dd>
              <dd className="glossary-more">{g.more}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
