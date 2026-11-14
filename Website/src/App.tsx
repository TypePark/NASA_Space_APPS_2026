<<<<<<< HEAD
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import "./App.css";
import Glossary from "./components/Glossary";
import TopBar from "./components/TopBar";
import type { NavKey } from "./components/TopBar";
import { CASES } from "./content";
import type { CaseId } from "./content";
import type { RegionId } from "./data/records";
import { DEFAULT_SETTINGS, buildView, settingsForCase } from "./model";
import type { Settings } from "./model";
import CaseFile from "./screens/CaseFile";
import Explorer from "./screens/Explorer";
import type { DemoBar } from "./screens/Explorer";
import Method from "./screens/Method";
import Setup from "./screens/Setup";
import Welcome from "./screens/Welcome";

type Screen = "welcome" | "setup" | "explore" | "case" | "method";

const ROUTES: Record<string, Screen> = {
  "": "welcome",
  "#/": "welcome",
  "#/setup": "setup",
  "#/explore": "explore",
  "#/case": "case",
  "#/method": "method",
};
const HASH: Record<Screen, string> = {
  welcome: "#/",
  setup: "#/setup",
  explore: "#/explore",
  case: "#/case",
  method: "#/method",
};

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

/** The current screen lives in the URL hash, so the browser's back button works. */
function useScreen(): [Screen, (s: Screen) => void] {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const go = useCallback((s: Screen) => {
    if (window.location.hash !== HASH[s]) window.location.hash = HASH[s];
    window.scrollTo(0, 0);
  }, []);
  return [ROUTES[hash] ?? "welcome", go];
}

export default function App() {
  const [screen, go] = useScreen();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [card, setCard] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [glossaryTerm, setGlossaryTerm] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ id: CaseId; step: number } | null>(null);

  const view = useMemo(() => buildView(settings), [settings]);
  // The demo only runs on the Explorer; leaving the screen ends it.
  const activeDemo = screen === "explore" ? demo : null;

  /** Any change made by the user ends the demo and returns the deck to card 1. */
  const change = useCallback((patch: Partial<Settings>) => {
    setDemo(null);
    setSettings((s) => {
      const next = { ...s, ...patch };
      // A new question, place or record starts from the full record again.
      if (patch.periodMode === undefined && (patch.variable || patch.region || patch.dataset)) next.periodMode = "full";
      return next;
    });
    if (patch.variable || patch.region || patch.dataset || patch.periodMode === "explore") setCard(0);
  }, []);

  const startDemo = useCallback(
    (id: CaseId) => {
      setSettings(settingsForCase(id));
      setDemo({ id, step: 1 });
      setPanelOpen(false);
      setGlossaryTerm(null);
      go("explore");
    },
    [go],
  );

  const openGlossary = useCallback((term: string) => {
    setPanelOpen(false);
    setGlossaryTerm(term);
  }, []);
  const closeGlossary = useCallback(() => setGlossaryTerm(null), []);

  // ---------- demo caption ----------
  let demoBar: DemoBar | null = null;
  let shownCard = card;
  if (activeDemo) {
    const cs = CASES[activeDemo.id];
    const step = cs.steps[activeDemo.step - 1];
    const idx = view.cards.findIndex((c) => c.id === step.card);
    shownCard = idx < 0 ? 0 : idx;
    const last = activeDemo.step >= cs.steps.length;
    demoBar = {
      label: cs.label,
      step: activeDemo.step,
      count: cs.steps.length,
      text: step.text,
      target: step.target,
      nextLabel: !last ? "Next" : activeDemo.id === "A" ? "Next case" : "Explore on your own",
      onBack: () => setDemo({ id: activeDemo.id, step: activeDemo.step - 1 }),
      onNext: () => {
        if (!last) setDemo({ id: activeDemo.id, step: activeDemo.step + 1 });
        else if (activeDemo.id === "A") startDemo("B");
        else {
          setDemo(null);
          setCard(0);
        }
      },
      onExit: () => {
        setDemo(null);
        setCard(shownCard);
      },
    };
  }

  const nav: NavKey = activeDemo ? "demo" : screen === "explore" ? "explore" : screen === "method" ? "method" : null;

  return (
    <div className="app">
      {screen !== "welcome" && (
        <TopBar
          active={nav}
          onExplore={() => {
            setDemo(null);
            go("explore");
          }}
          onDemo={() => startDemo("A")}
          onGlossary={() => openGlossary("p_value")}
        />
      )}

      {screen === "welcome" && (
        <Welcome
          onDemo={() => startDemo("A")}
          onPlace={(region: RegionId) => {
            change({ region, variable: "annual_total", dataset: "imerg" });
            go("explore");
          }}
        />
      )}

      {screen === "setup" && (
        <Setup
          settings={settings}
          step={setupStep}
          onStep={setSetupStep}
          onChange={change}
          onOpen={() => {
            // Temperature exists for the whole island only.
            change({ region: view.region.id, dataset: view.dataset, periodMode: "full" });
            setSetupStep(1);
            go("explore");
          }}
        />
      )}

      {screen === "explore" && (
        <Explorer
          view={view}
          card={shownCard}
          onCard={(i) => {
            setDemo(null);
            setCard(i);
          }}
          panelOpen={panelOpen && !activeDemo}
          onPanel={(open) => {
            setDemo(null);
            setPanelOpen(open);
          }}
          onChange={change}
          onTerm={openGlossary}
          demo={demoBar}
        />
      )}

      {screen === "case" && (
        <CaseFile
          view={view}
          onLead={(patch) => {
            change(patch);
            go("explore");
          }}
          onNewCase={() => {
            change({ ...DEFAULT_SETTINGS });
            setSetupStep(1);
            go("setup");
          }}
        />
      )}

      {screen === "method" && <Method />}

      {glossaryTerm && <Glossary term={glossaryTerm} onClose={closeGlossary} />}
    </div>
  );
}
=======

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Activity,
  BarChart3,
  CloudRain,
  Droplets,
  Globe2,
  Layers3,
  MapPin,
  Menu,
  Satellite,
  ShieldCheck,
  Thermometer,
  Waves,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./App.css";

// --------------------------------------------------
// DEMO DATA
// These values are placeholders for the first UI build.
// They are NOT real NASA observations.
// --------------------------------------------------

const rainfallData = [
  { year: "2016", rainfall: 410 },
  { year: "2017", rainfall: 385 },
  { year: "2018", rainfall: 430 },
  { year: "2019", rainfall: 360 },
  { year: "2020", rainfall: 395 },
  { year: "2021", rainfall: 345 },
  { year: "2022", rainfall: 370 },
  { year: "2023", rainfall: 325 },
  { year: "2024", rainfall: 350 },
  { year: "2025", rainfall: 310 },
];

const variables = [
  {
    name: "Precipitation",
    subtitle: "Rainfall patterns and changes",
    source: "NASA GPM IMERG",
    icon: CloudRain,
    color: "blue",
    unit: "mm",
  },
  {
    name: "Land Surface Temperature",
    subtitle: "Surface temperature patterns",
    source: "NASA MODIS MOD11A2",
    icon: Thermometer,
    color: "orange",
    unit: "K",
  },
  {
    name: "Soil Moisture",
    subtitle: "Land surface water conditions",
    source: "NASA GLDAS",
    icon: Droplets,
    color: "teal",
    unit: "m³/m³",
  },
];

const regions = [
  {
    name: "Western Cyprus",
    location: "Paphos region",
    description: "Explore precipitation and surface temperature patterns.",
    icon: Waves,
  },
  {
    name: "Central Cyprus",
    location: "Nicosia region",
    description: "Compare long-term environmental changes.",
    icon: Globe2,
  },
  {
    name: "Eastern Cyprus",
    location: "Larnaca and Famagusta region",
    description: "Investigate regional differences in Earth system variables.",
    icon: Layers3,
  },
];

function App() {
  return (
    <div className="app-shell">
      {/* NAVIGATION */}
      <header className="navbar">
        <a href="#home" className="brand">
          <div className="brand-icon">
            <Droplets size={23} />
          </div>

          <div className="brand-text">
            <span className="brand-name">AquaFlow Earth</span>
            <span className="brand-caption">EARTH SYSTEM INTELLIGENCE</span>
          </div>
        </a>

        <nav className="nav-links">
          <a className="active" href="#home">Overview</a>
          <a href="#explorer">Earth Explorer</a>
          <a href="#trends">Trend Detective</a>
          <a href="#variables">Variables</a>
          <a href="#about">About</a>
        </nav>

        <a className="nav-cta" href="#explorer">
          Explore Data <ArrowRight size={16} />
        </a>

        <button className="mobile-menu" aria-label="Open navigation">
          <Menu size={23} />
        </button>
      </header>

      <main>
        {/* HERO */}
        <section className="hero-section" id="home">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="live-dot" />
              EARTH OBSERVATION & CLIMATE ANALYTICS
            </div>

            <h1>
              Understand our planet.
              <br />
              <span>Discover what is changing.</span>
            </h1>

            <p className="hero-description">
              Explore Earth system trends across Cyprus using satellite
              observations, environmental datasets, and statistical analysis.
              Turn complex data into meaningful discoveries.
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#explorer">
                Explore Earth Data <ArrowRight size={18} />
              </a>

              <a className="secondary-button" href="#trends">
                Discover Trends
              </a>
            </div>

            <div className="hero-trust">
              <div className="trust-item">
                <Satellite size={17} />
                <span>Satellite observations</span>
              </div>

              <div className="trust-item">
                <BarChart3 size={17} />
                <span>Statistical trend analysis</span>
              </div>

              <div className="trust-item">
                <ShieldCheck size={17} />
                <span>Research-oriented insights</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="earth-glow" />
            <div className="earth-orbit orbit-one" />
            <div className="earth-orbit orbit-two" />

            <div className="earth-image">
              <div className="earth-overlay" />
              <div className="earth-label">
                <span className="live-dot" />
                CYPRUS REGION
              </div>
            </div>

            <div className="floating-card satellite-card">
              <div className="floating-icon blue-icon">
                <Satellite size={19} />
              </div>
              <div>
                <strong>Earth Observation</strong>
                <span>Satellite-based datasets</span>
              </div>
            </div>

            <div className="floating-card analysis-card">
              <div className="floating-icon green-icon">
                <Activity size={19} />
              </div>
              <div>
                <strong>Trend Analysis</strong>
                <span>Long-term environmental signals</span>
              </div>
            </div>
          </div>
        </section>

        {/* DATA STATUS */}
        <section className="status-strip">
          <div className="status-item">
            <span className="status-label">PROJECT FOCUS</span>
            <strong>Cyprus</strong>
          </div>

          <div className="status-divider" />

          <div className="status-item">
            <span className="status-label">CORE APPROACH</span>
            <strong>Earth System Trends</strong>
          </div>

          <div className="status-divider" />

          <div className="status-item">
            <span className="status-label">DATA SOURCES</span>
            <strong>NASA Earth Observations</strong>
          </div>

          <div className="status-divider" />

          <div className="status-item">
            <span className="status-label">ANALYSIS</span>
            <strong>Statistical & Spatial</strong>
          </div>
        </section>

        {/* EXPLORER INTRO */}
        <section className="section-block" id="explorer">
          <div className="section-heading">
            <div>
              <span className="section-kicker">YOUR EARTH DATA WORKSPACE</span>
              <h2>Explore the system. Understand the signals.</h2>
              <p>
                A unified starting point for investigating environmental
                variables and their long-term changes.
              </p>
            </div>

            <a className="text-link" href="#variables">
              Browse variables <ArrowRight size={16} />
            </a>
          </div>

          <div className="metric-grid">
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon blue-icon">
                  <CloudRain size={20} />
                </span>
                <span className="metric-tag">CORE VARIABLE</span>
              </div>
              <span className="metric-title">Precipitation</span>
              <strong className="metric-value">GPM IMERG</strong>
              <span className="metric-description">
                Satellite-based precipitation estimates
              </span>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon orange-icon">
                  <Thermometer size={20} />
                </span>
                <span className="metric-tag">CORE VARIABLE</span>
              </div>
              <span className="metric-title">Surface Temperature</span>
              <strong className="metric-value">MODIS</strong>
              <span className="metric-description">
                Land surface temperature observations
              </span>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon teal-icon">
                  <Droplets size={20} />
                </span>
                <span className="metric-tag">OPTIONAL VARIABLE</span>
              </div>
              <span className="metric-title">Soil Moisture</span>
              <strong className="metric-value">GLDAS</strong>
              <span className="metric-description">
                Model-based land surface water estimates
              </span>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-icon purple-icon">
                  <BarChart3 size={20} />
                </span>
                <span className="metric-tag">ANALYSIS</span>
              </div>
              <span className="metric-title">Trend Detection</span>
              <strong className="metric-value">Statistical</strong>
              <span className="metric-description">
                Trend magnitude and significance testing
              </span>
            </article>
          </div>
        </section>

        {/* TREND SECTION */}
        <section className="trend-section" id="trends">
          <div className="trend-header">
            <div>
              <span className="section-kicker">TREND DETECTIVE</span>
              <h2>Discover environmental patterns.</h2>
              <p>
                Examine how environmental variables evolve over time and
                compare regional signals.
              </p>
            </div>

            <span className="demo-badge">ILLUSTRATIVE DEMO DATA</span>
          </div>

          <div className="trend-layout">
            <article className="chart-card">
              <div className="chart-heading">
                <div>
                  <span className="chart-label">PRECIPITATION OVERVIEW</span>
                  <h3>Annual rainfall pattern</h3>
                  <span className="chart-subtitle">
                    Illustrative values · 2016–2025 · mm/year
                  </span>
                </div>

                <div className="chart-icon">
                  <CloudRain size={21} />
                </div>
              </div>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={rainfallData}
                    margin={{ top: 15, right: 12, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="rainfallGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#22b8d5"
                          stopOpacity={0.32}
                        />
                        <stop
                          offset="100%"
                          stopColor="#22b8d5"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="#e8eef4"
                      strokeDasharray="4 5"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="year"
                      tick={{ fill: "#8291a5", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{ fill: "#8291a5", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5edf4",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [`${value} mm`, "Rainfall"]}
                    />

                    <Area
                      type="monotone"
                      dataKey="rainfall"
                      stroke="#159dbd"
                      strokeWidth={3}
                      fill="url(#rainfallGradient)"
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-footnote">
                <span className="footnote-dot" />
                Demo values only — not actual measured rainfall.
              </div>
            </article>

            <aside className="insight-card">
              <div className="insight-icon">
                <Activity size={21} />
              </div>

              <span className="section-kicker">WHAT CAN WE INVESTIGATE?</span>
              <h3>From observations to evidence.</h3>

              <p>
                A changing pattern is not automatically a statistically
                significant trend. AquaFlow Earth is designed to examine
                environmental signals with appropriate statistical tests.
              </p>

              <div className="insight-list">
                <div>
                  <span className="insight-number">01</span>
                  <span>Estimate trend magnitude</span>
                </div>
                <div>
                  <span className="insight-number">02</span>
                  <span>Test statistical significance</span>
                </div>
                <div>
                  <span className="insight-number">03</span>
                  <span>Compare regional differences</span>
                </div>
              </div>

              <a href="#variables" className="insight-link">
                Explore the variables <ArrowRight size={16} />
              </a>
            </aside>
          </div>
        </section>

        {/* VARIABLES */}
        <section className="section-block" id="variables">
          <div className="section-heading">
            <div>
              <span className="section-kicker">DATA EXPLORER</span>
              <h2>Environmental variables</h2>
              <p>
                Start with the datasets that help describe Earth's changing
                water and temperature systems.
              </p>
            </div>
          </div>

          <div className="variable-grid">
            {variables.map((variable) => {
              const Icon = variable.icon;

              return (
                <article className="variable-card" key={variable.name}>
                  <div className={`variable-icon ${variable.color}-icon`}>
                    <Icon size={23} />
                  </div>

                  <div className="variable-content">
                    <h3>{variable.name}</h3>
                    <p>{variable.subtitle}</p>
                  </div>

                  <div className="variable-meta">
                    <span>DATA SOURCE</span>
                    <strong>{variable.source}</strong>
                  </div>

                  <div className="variable-footer">
                    <span>Unit: {variable.unit}</span>
                    <span className="variable-arrow">
                      <ArrowRight size={17} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* REGIONS */}
        <section className="region-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">SPATIAL PERSPECTIVE</span>
              <h2>Explore Cyprus by region.</h2>
              <p>
                Compare environmental patterns across different parts of the
                island.
              </p>
            </div>

            <span className="region-location">
              <MapPin size={16} /> Cyprus
            </span>
          </div>

          <div className="region-grid">
            {regions.map((region) => {
              const Icon = region.icon;

              return (
                <article className="region-card" key={region.name}>
                  <div className="region-card-top">
                    <span className="region-icon">
                      <Icon size={22} />
                    </span>
                    <span className="region-explore">
                      <ArrowUpRight size={17} />
                    </span>
                  </div>

                  <h3>{region.name}</h3>
                  <span className="region-subtitle">{region.location}</span>
                  <p>{region.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ABOUT / CTA */}
        <section className="closing-section" id="about">
          <div className="closing-icon">
            <Globe2 size={28} />
          </div>

          <div className="closing-content">
            <span className="section-kicker">AQUAFLOW EARTH</span>
            <h2>Better questions. Stronger environmental insights.</h2>
            <p>
              Bringing Earth observation data, spatial exploration, and
              statistical trend detection together in one platform.
            </p>
          </div>

          <a href="#home" className="closing-button">
            Back to top <ArrowUpRight size={17} />
          </a>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <a href="#home" className="footer-brand">
          <Droplets size={19} />
          <strong>AquaFlow Earth</strong>
        </a>

        <span>
          An Earth system trend exploration project.
        </span>

        <span className="footer-right">
          Built for scientific discovery.
        </span>
      </footer>
    </div>
  );
}

export default App;
>>>>>>> main
