import { useEffect, useRef, useState } from "react";
// Map3D/tif-terrain.js is the single source of the 3D map; Vite serves / bundles it as a file.
// It loads CesiumJS and geotiff.js from a CDN on first use.
import tifTerrainUrl from "../../Map3D/tif-terrain.js?url";
import demUrl from "../../output_hh.tif?url";
import rainUrl from "../../GIOVANNI-g4.timeAvgMap.GPM_3IMERGM_07_precipitation.19980101-20260930.32E_34N_34E_35N.tif?url";

/** Cyprus: west, south, east, north (degrees). */
const BOUNDS = [32.15293, 34.41917, 34.73326, 35.7758];

export interface SimulationState {
  running: boolean;
  /** Water level 0..1 (1 = hollows full). */
  fill: number;
  time: number;
  waterKm2: number;
}

interface TifTerrainController {
  destroy(): void;
  startSimulation(): void;
  pauseSimulation(): void;
  resetSimulation(): void;
  readonly simulation: SimulationState | null;
}

interface TifTerrainGlobal {
  mount(target: HTMLElement, opts: Record<string, unknown>): Promise<TifTerrainController>;
}

declare global {
  interface Window {
    TifTerrain?: TifTerrainGlobal;
  }
}

let scriptPromise: Promise<TifTerrainGlobal> | null = null;
function loadTifTerrain(): Promise<TifTerrainGlobal> {
  if (window.TifTerrain) return Promise.resolve(window.TifTerrain);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = tifTerrainUrl;
      s.async = true;
      s.onload = () => (window.TifTerrain ? resolve(window.TifTerrain) : reject(new Error("TifTerrain not found")));
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Could not load the 3D map script"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

interface TerrainMap3DProps {
  /** Seconds of simulated rain until the standing water is ~full. */
  fillSeconds?: number;
  onSimulation?: (state: SimulationState) => void;
  className?: string;
}

/**
 * 3D terrain of Cyprus (NASA SRTM DEM) with the GPM IMERG precipitation map, clouds and rain.
 * The "Start simulation" button on the map lets it rain; the standing water then fills up slowly.
 */
export default function TerrainMap3D({ fillSeconds = 40, onSimulation, className }: TerrainMap3DProps) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onSimulation);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cb.current = onSimulation;
  }, [onSimulation]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let ctl: TifTerrainController | null = null;
    let cancelled = false;
    const onSim = (e: Event) => cb.current?.((e as CustomEvent<SimulationState>).detail);
    el.addEventListener("tif-terrain-simulation", onSim);

    loadTifTerrain()
      .then((TT) =>
        TT.mount(el, {
          src: demUrl,
          rain: rainUrl,
          bounds: BOUNDS,
          weather: { simulation: true, fillSeconds },
        }),
      )
      .then((c) => {
        if (cancelled) c.destroy();
        else ctl = c;
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
      el.removeEventListener("tif-terrain-simulation", onSim);
      ctl?.destroy();
    };
  }, [fillSeconds]);

  return (
    <div className={className ? `terrain3d ${className}` : "terrain3d"}>
      <div ref={box} className="terrain3d-map" />
      {error && (
        <p className="terrain3d-error" role="alert">
          The 3D map could not be loaded: {error}
        </p>
      )}
    </div>
  );
}
