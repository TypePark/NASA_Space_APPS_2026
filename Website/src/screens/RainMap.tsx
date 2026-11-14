import { useState } from "react";
import Icon from "../components/Icon";
import RainMapSlot from "../components/RainMapSlot";
import type { RegionId } from "../data/records";
import { DEFAULT_SETTINGS, buildView } from "../model";

interface RainMapProps {
  /** Open the Explorer with yearly rainfall for this place. */
  onOpen: (region: RegionId) => void;
}

export default function RainMap({ onOpen }: RainMapProps) {
  const [selected, setSelected] = useState<RegionId>("cyprus_whole");
  // Yearly rainfall from the GPM IMERG record, read from the results data.
  const view = buildView({ ...DEFAULT_SETTINGS, region: selected, variable: "annual_total", dataset: "imerg" });
  const { rec } = view;

  return (
    <main className="page page-wide rainmap">
      <section className="stack-6">
        <h1 className="title">Rain map</h1>
        <p className="lead muted">Rainfall across Cyprus from NASA GPM IMERG, on terrain from the NISAR elevation model.</p>
      </section>

      <div className="rainmap-layout">
        <section aria-label="Map" className="panel rainmap-main">
          <RainMapSlot selectedRegion={selected} onPick={setSelected} />
        </section>

        <aside aria-labelledby="sel-title" className="panel rainmap-side">
          <div className="stack-2">
            <span id="sel-title" className="group-label">
              Selected area
            </span>
            <h2 className="h2">{view.region.name}</h2>
          </div>

          <div className="stack-2">
            <span className="small muted">{rec.variable_label}, change per decade</span>
            <span className="num big">{view.rate}</span>
            <span className="tiny muted">
              {view.rateSub} · Sen’s slope · {rec.dataset}, {view.periodText}
            </span>
          </div>

          <div className="row row-center row-tight">
            <span className={`badge badge-${rec.status}`}>
              <Icon name={view.badge.icon} size={18} strokeWidth={1.9} />
              {view.badge.label}
            </span>
            <span className="num small">p = {rec.p_value_display}</span>
          </div>

          <div className="stack-2">
            <span className="group-label">Places</span>
            {view.regionRows.map((r) => (
              <button
                key={r.id}
                type="button"
                className="region-row place-row"
                aria-pressed={r.id === selected}
                onClick={() => setSelected(r.id)}
              >
                <span className="small strong">{r.name}</span>
                <span className="region-value">
                  <span className="num small">{r.value}</span>
                  <Icon name={r.badge.icon} size={18} strokeWidth={1.9} label={r.badge.label} className={`tone-${r.badge.status}`} />
                </span>
              </button>
            ))}
            <span className="tiny muted">Change in yearly rainfall per decade.</span>
          </div>

          <button type="button" className="btn btn-primary" onClick={() => onOpen(selected)}>
            Open in the explorer
            <Icon name="arrowR" size={18} strokeWidth={2} />
          </button>
        </aside>
      </div>
    </main>
  );
}
