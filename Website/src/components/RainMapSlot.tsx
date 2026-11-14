import type { RegionId } from "../data/records";
import { DEFAULT_SETTINGS, buildView } from "../model";
import RegionMap from "./RegionMap";

/**
 * RainMapSlot – the slot for the rain simulation on the Rain map page.
 *
 * TEAM: replace everything inside this component with the CesiumJS rain
 * simulation. For now it shows the drawn RegionMap, coloured by the yearly
 * rainfall trend, so the page works.
 *
 * Keep these two props so the rest of the page keeps working:
 *
 *   selectedRegion  the place chosen in the side panel
 *                   ("cyprus_whole" means no single area)
 *   onPick          call this with a region id when the user picks an
 *                   area on the map
 *
 * Region ids: cyprus_whole, troodos, nicosia, limassol, larnaca, paphos.
 * The slot fills its parent panel, which is at least 640px tall.
 */
export interface RainMapSlotProps {
  selectedRegion: RegionId;
  onPick: (regionId: RegionId) => void;
}

// Yearly rainfall, satellite record: the colours and labels for each area.
const YEARLY = buildView({ ...DEFAULT_SETTINGS, variable: "annual_total", dataset: "imerg" });

export default function RainMapSlot({ selectedRegion, onPick }: RainMapSlotProps) {
  return (
    <div className="rain-map-slot">
      <RegionMap fills={YEARLY.mapFills} labels={YEARLY.mapLabels} selected={selectedRegion} onPick={onPick} />
    </div>
  );
}
