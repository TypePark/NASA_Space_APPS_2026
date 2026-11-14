import Brand from "../components/Brand";
import Icon from "../components/Icon";
import RegionMap from "../components/RegionMap";
import { HOW_STEPS, REGIONS } from "../content";
import type { RegionId } from "../data/records";

interface WelcomeProps {
  onDemo: () => void;
  onPlace: (region: RegionId) => void;
}

export default function Welcome({ onDemo, onPlace }: WelcomeProps) {
  return (
    <section className="welcome">
      <div className="welcome-map" aria-hidden="true">
        <RegionMap faded />
      </div>

      <header className="welcome-bar">
        <div className="brand">
          <Brand />
        </div>
        <nav aria-label="Main" className="topbar-nav">
          <a className="nav-link" href="#/explore">
            Explore
          </a>
          <a className="btn btn-outline btn-sm" href="#/method">
            Data &amp; Method
          </a>
        </nav>
      </header>

      <div className="welcome-hero">
        <span className="kicker">A data detective tool · NASA Space Apps 2026</span>
        <h1 className="display">Is Cyprus’s climate changing? Investigate it with NASA data.</h1>
        <p className="lead muted">
          Pick a question and a place. We show you up to 46 years of satellite and model data, how fast things are
          changing, and whether the change is real or still hidden in the noise.
        </p>
        <div className="row">
          <a className="btn btn-primary btn-lg" href="#/setup">
            Start an investigation
            <Icon name="arrowR" strokeWidth={2} />
          </a>
          <button type="button" className="btn btn-outline btn-lg" onClick={onDemo}>
            <Icon name="play" />
            Watch a case
          </button>
        </div>
      </div>

      <div className="welcome-foot">
        <div className="how">
          {HOW_STEPS.map((s) => (
            <div key={s.title} className="how-step">
              <span className="round-icon">
                <Icon name={s.icon} size={22} />
              </span>
              <span className="stack-2">
                <span className="strong">{s.title}</span>
                <span className="small muted">{s.text}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="welcome-places">
          <span className="small strong">Explore a place</span>
          <div className="row row-tight">
            {REGIONS.map((r) => (
              <button key={r.id} type="button" className="pill" onClick={() => onPlace(r.id)}>
                <Icon name="pin" size={16} className="accent-ink" />
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <p className="tiny muted">
          Data: NASA GPM IMERG V07 (rainfall), NASA MERRA-2 (rainfall and air temperature) and NASA SRTM (terrain).
        </p>
      </div>
    </section>
  );
}
