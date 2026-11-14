import Brand from "./Brand";
import Icon from "./Icon";

export type NavKey = "explore" | "rain" | "demo" | "method" | "map3d" | null;

interface TopBarProps {
  active: NavKey;
  onExplore: () => void;
  onDemo: () => void;
  onGlossary: () => void;
}

export default function TopBar({ active, onExplore, onDemo, onGlossary }: TopBarProps) {
  const cur = (k: NavKey) => (active === k ? "page" : undefined);
  return (
    <header className="topbar">
      <a className="brand" href="#/" aria-label="AquaCosmos home">
        <Brand />
      </a>
      <nav aria-label="Main" className="topbar-nav">
        <button type="button" className="nav-link" aria-current={cur("explore")} onClick={onExplore}>
          Explore
        </button>
        <a className="nav-link" aria-current={cur("rain")} href="#/rain-map">
          Rain map
        </a>
        <button type="button" className="nav-link" aria-current={cur("demo")} onClick={onDemo}>
          Watch a case
        </button>
        <a className="nav-link" aria-current={cur("map3d")} href="#/map3d">
          3D Map
        </a>
        <a className="nav-link" aria-current={cur("method")} href="#/method">
          Data &amp; Method
        </a>
        <button type="button" className="btn btn-outline btn-sm" onClick={onGlossary}>
          <Icon name="book" size={18} />
          Glossary
        </button>
      </nav>
    </header>
  );
}
