import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import "./App.css";
import Glossary from "./components/Glossary";
import TopBar from "./components/TopBar";
import type { NavKey } from "./components/TopBar";
import { CASES } from "./content";
import type { CaseId } from "./content";
import type { RegionId } from "./data/records";
import { DEFAULT_SETTINGS, buildView, normalise, settingsForCase } from "./model";
import type { Settings } from "./model";
import CaseFile from "./screens/CaseFile";
import Explorer from "./screens/Explorer";
import type { DemoBar } from "./screens/Explorer";
import Method from "./screens/Method";
import RainMap from "./screens/RainMap";
import Setup from "./screens/Setup";
import Welcome from "./screens/Welcome";

type Screen = "welcome" | "setup" | "explore" | "rain" | "case" | "method";

const ROUTES: Record<string, Screen> = {
  "": "welcome",
  "#/": "welcome",
  "#/setup": "setup",
  "#/explore": "explore",
  "#/rain-map": "rain",
  "#/case": "case",
  "#/method": "method",
};
const HASH: Record<Screen, string> = {
  welcome: "#/",
  setup: "#/setup",
  explore: "#/explore",
  rain: "#/rain-map",
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
      // Picking a ready-made question replaces a custom choice of months.
      if (patch.variable && patch.custom === undefined) next.custom = null;
      // A new question, place or record starts from the full record again.
      if (patch.periodMode === undefined && (patch.variable || patch.custom || patch.region || patch.dataset)) next.periodMode = "full";
      return normalise(next);
    });
    if (patch.variable || patch.custom || patch.region || patch.dataset || patch.periodMode === "explore") setCard(0);
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

  const nav: NavKey = activeDemo ? "demo" : screen === "explore" ? "explore" : screen === "rain" ? "rain" : screen === "method" ? "method" : null;

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

      {screen === "rain" && (
        <RainMap
          onOpen={(region: RegionId) => {
            change({ region, variable: "annual_total", dataset: "imerg" });
            go("explore");
          }}
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
