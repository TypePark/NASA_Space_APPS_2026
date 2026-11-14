import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import "./App.css";
import Glossary from "./components/Glossary";
import TopBar from "./components/TopBar";
import type { NavKey } from "./components/TopBar";
import TourBar from "./components/TourBar";
import type { RegionId } from "./data/records";
import { DEFAULT_SETTINGS, buildView, normalise } from "./model";
import type { Settings } from "./model";
import CaseFile from "./screens/CaseFile";
import Explorer from "./screens/Explorer";
import Map3D from "./screens/Map3D";
import Method from "./screens/Method";
import Setup from "./screens/Setup";
import Welcome from "./screens/Welcome";
import { TOUR } from "./tour";

type Screen = "welcome" | "setup" | "explore" | "case" | "method" | "map3d";

const ROUTES: Record<string, Screen> = {
  "": "welcome",
  "#/": "welcome",
  "#/setup": "setup",
  "#/explore": "explore",
  // The old Rain map address now opens the 3D map.
  "#/rain-map": "map3d",
  "#/case": "case",
  "#/method": "method",
  "#/map3d": "map3d",
};
const HASH: Record<Screen, string> = {
  welcome: "#/",
  setup: "#/setup",
  explore: "#/explore",
  case: "#/case",
  method: "#/method",
  map3d: "#/map3d",
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
  /** Index of the guided tour's current step, or null when the tour is not running. */
  const [tour, setTour] = useState<number | null>(null);

  const view = useMemo(() => buildView(settings), [settings]);
  const cardIndex = Math.max(0, Math.min(view.cards.length - 1, card));

  const change = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      // Picking a ready-made question replaces a custom choice of months.
      if (patch.variable && patch.custom === undefined) next.custom = null;
      // A new question, place or record starts from the full record again.
      if (
        patch.periodMode === undefined &&
        (patch.variable || patch.custom || patch.region || patch.dataset)
      )
        next.periodMode = "full";
      return normalise(next);
    });
    if (
      patch.variable ||
      patch.custom ||
      patch.region ||
      patch.dataset ||
      patch.periodMode === "explore"
    )
      setCard(0);
  }, []);

  /** Open one step of the tour: put the app in the state that step starts from. */
  const openStep = useCallback(
    (index: number) => {
      const step = TOUR[index];
      const next = normalise({ ...DEFAULT_SETTINGS, ...step.settings });
      setSettings(next);
      setCard(
        step.card
          ? Math.max(
              0,
              buildView(next).cards.findIndex((c) => c.id === step.card),
            )
          : 0,
      );
      setPanelOpen(false);
      setGlossaryTerm(null);
      setTour(index);
      go(step.screen ?? "explore");
    },
    [go],
  );

  const openGlossary = useCallback((term: string) => {
    setPanelOpen(false);
    setGlossaryTerm(term);
  }, []);
  const closeGlossary = useCallback(() => setGlossaryTerm(null), []);

  // ---------- guided tour ----------
  const step = tour === null ? null : TOUR[tour];
  const context = { view, card: view.cards[cardIndex].id, screen };
  const taskDone = step?.task ? step.task.done(context) : false;
  const last = tour !== null && tour === TOUR.length - 1;

  const nav: NavKey =
    tour !== null
      ? "tour"
      : screen === "explore"
        ? "explore"
        : screen === "method"
          ? "method"
          : screen === "map3d"
            ? "map3d"
            : null;

  return (
    <div className={tour !== null ? "app has-tour" : "app"}>
      {screen !== "welcome" && (
        <TopBar
          active={nav}
          onExplore={() => go("explore")}
          onTour={() => openStep(0)}
          onGlossary={() => openGlossary("p_value")}
        />
      )}

      {screen === "welcome" && (
        <Welcome
          onTour={() => openStep(0)}
          onPlace={(region: RegionId) => {
            change({ region, variable: "annual_total", dataset: "imerg" });
            go("explore");
          }}
          onVariable={(variable) => {
            change({
              custom: {
                variable,
                months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
              },
              region: "cyprus_whole",
            });
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
            // A question with no data for the chosen place uses the whole island.
            change({
              region: view.region.id,
              dataset: view.dataset,
              periodMode: "full",
            });
            setSetupStep(1);
            go("explore");
          }}
        />
      )}

      {screen === "explore" && (
        <Explorer
          view={view}
          card={cardIndex}
          onCard={setCard}
          panelOpen={panelOpen}
          onPanel={setPanelOpen}
          onChange={change}
          onTerm={openGlossary}
          highlight={step?.target ?? null}
          tourStep={tour}
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

      {screen === "map3d" && <Map3D />}

      {screen === "map3d" && <Map3D />}

      {glossaryTerm && <Glossary term={glossaryTerm} onClose={closeGlossary} />}

      {step && tour !== null && (
        <TourBar
          part={step.part}
          step={tour + 1}
          count={TOUR.length}
          text={step.text(context)}
          doneText={taskDone && step.task ? step.task.after(context) : null}
          nextLabel={last ? "Finish" : step.task && !taskDone ? "Skip" : "Next"}
          onBack={() => openStep(tour - 1)}
          onNext={() => (last ? setTour(null) : openStep(tour + 1))}
          onExit={() => setTour(null)}
        />
      )}
    </div>
  );
}
