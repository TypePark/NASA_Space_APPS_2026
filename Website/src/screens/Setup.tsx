import Icon from "../components/Icon";
import RegionMap from "../components/RegionMap";
import { REGIONS, VARS } from "../content";
import type { RegionId, VariableId } from "../data/records";
import { datasetsFor, findSeries, regionsFor, yearsOf } from "../data/series";
import { regionDef, resolve, variableDef } from "../model";
import type { Settings } from "../model";

interface SetupProps {
  settings: Settings;
  step: number;
  onStep: (step: number) => void;
  onChange: (patch: Partial<Settings>) => void;
  onOpen: () => void;
}

/** How each record is described on the "How far back?" step. Its first year is read from the data. */
const RECORD_STYLE: Record<string, { label: string; kind: string; icon: "calendar" | "layers" }> = {
  imerg: { label: "Recent and detailed", kind: "satellites", icon: "calendar" },
  merra2: { label: "Longer history", kind: "model", icon: "layers" },
  fldas: { label: "Land model", kind: "model", icon: "layers" },
};

export default function Setup({ settings, step, onStep, onChange, onOpen }: SetupProps) {
  const chosen = regionDef(settings.region);
  const whole = settings.region === "cyprus_whole";
  // The record step only appears when the question has more than one record for the place.
  const base = variableDef(settings.variable).base;
  const place = resolve(settings).region;
  const records = datasetsFor(base, place).map((id) => {
    const series = findSeries(base, place, id)!;
    const style = RECORD_STYLE[id] ?? { label: series.dataset_name, kind: "record", icon: "layers" as const };
    return { id, label: style.label, sub: `Since ${yearsOf(series)[0]} · NASA ${series.dataset_name} ${style.kind}`, icon: style.icon };
  });
  const total = records.length > 1 ? 3 : 2;
  const cur = Math.max(1, Math.min(total, step));

  const fills: Record<string, string> = {};
  for (const r of REGIONS) if (r.id !== "cyprus_whole") fills[r.id] = r.id === settings.region ? "var(--accent-soft)" : "var(--neutral)";

  return (
    <main className="page page-wide setup">
      <div className="setup-top">
        <div className="row row-center">
          <span className="small strong muted">
            Step {cur} of {total}
          </span>
          <span className="dots" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={i + 1 === cur ? "dot is-current" : i + 1 < cur ? "dot is-done" : "dot"} />
            ))}
          </span>
        </div>
        <a className="link-btn" href="#/explore">
          Skip to the explorer
        </a>
      </div>

      {cur === 1 && (
        <div className="stack-24">
          <div className="stack-6">
            <h1 className="title">Where do you want to look?</h1>
            <p className="lead muted">Tap an area on the map, or choose one below.</p>
          </div>
          <div className="setup-where">
            <div className="panel setup-map">
              <RegionMap fills={fills} selected={settings.region} onPick={(id) => onChange({ region: id })} />
            </div>
            <div className="setup-side">
              <div role="radiogroup" aria-label="Place" className="stack-8">
                {REGIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={r.id === settings.region}
                    className="choice choice-row"
                    onClick={() => onChange({ region: r.id as RegionId })}
                  >
                    <Icon name="pin" className="accent-ink" />
                    {r.name}
                  </button>
                ))}
              </div>
              <div className="hint">
                <Icon name="bulb" size={22} className="accent-ink" />
                <span className="stack-2">
                  <span className="small strong">Why look at {whole ? "the whole island" : chosen.name}?</span>
                  <span className="small muted">{chosen.hint}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {cur === 2 && (
        <div className="stack-24 narrow">
          <div className="stack-6">
            <h1 className="title">What do you want to know about {whole ? "Cyprus" : chosen.name}?</h1>
            <p className="lead muted">Pick one question. You can change it any time in the explorer.</p>
          </div>
          <div role="radiogroup" aria-label="Question" className="stack-8">
            {VARS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={!settings.custom && v.id === settings.variable}
                className="choice choice-question"
                onClick={() => onChange({ variable: v.id as VariableId })}
              >
                <span className="round-icon round-icon-sm">
                  <Icon name={v.icon} />
                </span>
                <span className="stack-2">
                  <span className="strong">{!regionsFor(v.base).includes(settings.region) ? `${v.q} · whole island` : v.q}</span>
                  <span className="small muted">{v.def}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {cur === 3 && (
        <div className="stack-24 narrow">
          <div className="stack-6">
            <h1 className="title">How far back should we look?</h1>
            <p className="lead muted">More than one NASA record covers this place.</p>
          </div>
          <div role="radiogroup" aria-label="Record" className="row">
            {records.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === settings.dataset}
                className="choice choice-record"
                onClick={() => onChange({ dataset: c.id })}
              >
                <Icon name={c.icon} size={24} className="accent-ink" />
                <span className="h3">{c.label}</span>
                <span className="small muted">{c.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row row-center">
        {cur > 1 && (
          <button type="button" className="btn btn-outline btn-lg" onClick={() => onStep(cur - 1)}>
            <Icon name="arrowL" size={18} strokeWidth={2} />
            Back
          </button>
        )}
        <button type="button" className="btn btn-primary btn-lg" onClick={() => (cur < total ? onStep(cur + 1) : onOpen())}>
          {cur < total ? "Next" : "Open the explorer"}
          <Icon name="arrowR" strokeWidth={2} />
        </button>
      </div>
    </main>
  );
}
