import Brand from "./Brand";
import Icon from "./Icon";

export type NavKey = "explore" | "tour" | "method" | "map3d" | null;

interface TopBarProps {
  active: NavKey;
  onExplore: () => void;
  onTour: () => void;
  onGlossary: () => void;
}

export default function TopBar({
  active,
  onExplore,
  onTour,
  onGlossary,
}: TopBarProps) {
  const cur = (k: NavKey) => (active === k ? "page" : undefined);
  return (
    <header className="topbar">
      <a className="brand" href="#/" aria-label="AquaCosmos home">
        <Brand />
      </a>
      <nav aria-label="Main" className="topbar-nav">
        <button
          type="button"
          className="nav-link"
          aria-current={cur("explore")}
          onClick={onExplore}
        >
          Explore
        </button>
        <button
          type="button"
          className="nav-link"
          aria-current={cur("tour")}
          onClick={onTour}
        >
          Guided tour
        </button>
        <a className="nav-link" aria-current={cur("map3d")} href="#/map3d">
          3D Map
        </a>
        <a className="nav-link" aria-current={cur("method")} href="#/method">
          Data &amp; Method
        </a>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onGlossary}
        >
          <Icon name="book" size={18} />
          Glossary
        </button>
      </nav>
    </header>
  );
}
