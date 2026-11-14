import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import RegionMap from "../components/RegionMap";
import { MoreYearsChart, RhythmChart, SeriesChart } from "../components/charts";
import { BASE_VARS, MONTHS_LONG, MONTHS_SHORT, MONTH_SETS, VARS } from "../content";
import type { DemoTarget } from "../content";
import type { VariableId } from "../data/records";
import { SERIES, yearsOf } from "../data/series";
import { MIN_YEARS, monthsText } from "../model";
import type { Settings, View } from "../model";

export interface DemoBar {
  label: string;
  step: number;
  count: number;
  text: string;
  target: DemoTarget;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
}

interface ExplorerProps {
  view: View;
  card: number;
  onCard: (index: number) => void;
  panelOpen: boolean;
  onPanel: (open: boolean) => void;
  onChange: (patch: Partial<Settings>) => void;
  onTerm: (id: string) => void;
  demo: DemoBar | null;
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="pill" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Term({ id, onTerm, children }: { id: string; onTerm: (id: string) => void; children: React.ReactNode }) {
  return (
    <button type="button" className="term" onClick={() => onTerm(id)}>
      {children}
    </button>
  );
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((m) => b.includes(m));
}

/** "NASA GPM IMERG 1998–2025 · NASA MERRA-2 1980–2026", read from the data. */
function coverage(variable: string): string {
  const seen = new Map<string, [number, number]>();
  for (const s of SERIES) {
    if (s.variable !== variable) continue;
    const [a, b] = yearsOf(s);
    const cur = seen.get(s.dataset_name);
    seen.set(s.dataset_name, cur ? [Math.min(a, cur[0]), Math.max(b, cur[1])] : [a, b]);
  }
  return [...seen].map(([name, [a, b]]) => `NASA ${name} ${a}–${b}`).join(" · ");
}

export default function Explorer({ view, card, onCard, panelOpen, onPanel, onChange, onTerm, demo }: ExplorerProps) {
  const { rec, cards } = view;
  const cardIdx = Math.max(0, Math.min(cards.length - 1, card));
  const cur = cards[cardIdx].id;
  // The Adjust card has a simple view (five questions) and a detailed view (variable and months).
  const [detailed, setDetailed] = useState(view.custom);
  const months = view.vdef.months;
  const toggleMonth = (m: number) => {
    const next = months.includes(m) ? months.filter((x) => x !== m) : [...months, m].sort((a, b) => a - b);
    if (next.length) onChange({ custom: { variable: view.base.id, months: next } });
  };
  const hl = (t: DemoTarget) => (demo?.target === t ? " is-hl" : "");
  const deckHl = demo && (demo.target === "chart" || demo.target === "deck") ? " is-hl" : "";

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onPanel(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen, onPanel]);

  const { startYear: sY, endYear: eY, x0, x1 } = view;
  const span = MIN_YEARS - 1;
  const steppers = [
    {
      label: "From",
      value: sY,
      down: () => onChange({ startYear: Math.max(x0, sY - 1), endYear: eY }),
      up: () => onChange({ startYear: Math.min(eY - span, sY + 1), endYear: eY }),
      canDown: sY > x0,
      canUp: sY < eY - span,
      downLabel: "Start one year earlier",
      upLabel: "Start one year later",
    },
    {
      label: "To",
      value: eY,
      down: () => onChange({ startYear: sY, endYear: Math.max(sY + span, eY - 1) }),
      up: () => onChange({ startYear: sY, endYear: Math.min(x1, eY + 1) }),
      canDown: eY > sY + span,
      canUp: eY < x1,
      downLabel: "End one year earlier",
      upLabel: "End one year later",
    },
  ];

  return (
    <main className="page page-wide explorer">
      {/* floating settings */}
      <div className="adjust">
        <div className="adjust-anchor">
          <button type="button" className="btn btn-primary adjust-btn" aria-expanded={panelOpen} onClick={() => onPanel(!panelOpen)}>
            <Icon name="sliders" strokeWidth={1.9} />
            Adjust
          </button>
          {panelOpen && (
            <div className="adjust-panel" role="dialog" aria-label="Adjust what you see">
              <div className="adjust-head">
                <span className="strong">Adjust what you see</span>
                <div className="row row-tight row-center">
                  <button
                    type="button"
                    className="pill view-switch"
                    aria-pressed={detailed}
                    onClick={() => setDetailed(!detailed)}
                  >
                    <Icon name={detailed ? "check" : "layers"} size={16} className="accent-ink" />
                    More options
                  </button>
                  <button type="button" className="icon-btn icon-btn-soft icon-btn-sm" aria-label="Close" onClick={() => onPanel(false)}>
                    <Icon name="x" size={18} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {!detailed && (
                <div role="group" aria-label="Question" className="stack-8">
                  <span className="group-label">Question</span>
                  <div className="row row-tight">
                    {VARS.map((v) => (
                      <Pill key={v.id} on={v.id === view.vdef.id} onClick={() => onChange({ variable: v.id as VariableId })}>
                        <Icon name={v.icon} size={16} className="accent-ink" />
                        {v.short}
                      </Pill>
                    ))}
                  </div>
                  {view.custom && (
                    <span className="tiny muted">
                      Showing your own choice: {view.vdef.short}. Open “More options” to change it.
                    </span>
                  )}
                </div>
              )}

              {detailed && (
                <>
                  <div role="radiogroup" aria-label="Variable" className="stack-8">
                    <span className="group-label">Variable</span>
                    {BASE_VARS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        role="radio"
                        aria-checked={b.id === view.base.id}
                        className="choice choice-variable"
                        onClick={() => onChange({ custom: { variable: b.id, months } })}
                      >
                        <span className="round-icon round-icon-sm">
                          <Icon name={b.icon} />
                        </span>
                        <span className="stack-2">
                          <span className="small strong">
                            {b.name} <span className="tiny muted">· {b.group}</span>
                          </span>
                          <span className="tiny muted">{b.def}</span>
                          <span className="tiny muted">{coverage(b.id)}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div role="group" aria-label="Months" className="stack-8">
                    <span className="group-label">Months · {monthsText(months)}</span>
                    <div className="row row-tight">
                      {MONTH_SETS.map((m) => (
                        <Pill key={m.id} on={sameSet(m.months, months)} onClick={() => onChange({ custom: { variable: view.base.id, months: m.months } })}>
                          {m.label}
                        </Pill>
                      ))}
                    </div>
                    <div className="month-grid">
                      {MONTHS_SHORT.map((name, i) => (
                        <button
                          key={name}
                          type="button"
                          className="pill month"
                          aria-pressed={months.includes(i + 1)}
                          aria-label={MONTHS_LONG[i]}
                          onClick={() => toggleMonth(i + 1)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    <span className="tiny muted">Tap months to build your own season. Only complete seasons are counted.</span>
                  </div>
                </>
              )}

              <div role="group" aria-label="Place" className="stack-8">
                <span className="group-label">Place</span>
                <div className="row row-tight">
                  {view.places.map((r) => (
                    <Pill key={r.id} on={r.id === view.region.id} onClick={() => onChange({ region: r.id })}>
                      {r.name}
                    </Pill>
                  ))}
                </div>
              </div>

              {view.datasets.length > 1 && (
                <div role="group" aria-label="Record" className="stack-8">
                  <span className="group-label">Record</span>
                  <div className="row row-tight">
                    {view.datasets.map((d, i) => (
                      <Pill key={d.id} on={view.dataset === d.id} onClick={() => onChange({ dataset: d.id })}>
                        {detailed ? `NASA ${d.name} · since ${d.since}` : `Since ${d.since} · ${i === 0 ? "detailed" : "longer"}`}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}

              <div role="group" aria-label="Period" className="stack-8">
                <span className="group-label">Period</span>
                <div className="row row-tight">
                  <Pill on={!view.explore} onClick={() => onChange({ periodMode: "full" })}>
                    Full record · {view.periodText}
                  </Pill>
                  <Pill on={view.explore} onClick={() => onChange({ periodMode: "explore", startYear: sY, endYear: eY })}>
                    Choose years
                  </Pill>
                </div>
              </div>

              {view.explore && (
                <div className="row steppers">
                  {steppers.map((st) => (
                    <div key={st.label} className="stepper">
                      <span className="small muted stepper-label">{st.label}</span>
                      <button type="button" className="icon-btn icon-btn-sm" aria-label={st.downLabel} disabled={!st.canDown} onClick={st.down}>
                        −
                      </button>
                      <span className="num strong stepper-value">{st.value}</span>
                      <button type="button" className="icon-btn icon-btn-sm" aria-label={st.upLabel} disabled={!st.canUp} onClick={st.up}>
                        +
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* what you are looking at + verdict */}
      <section aria-labelledby="ev-head" className={"verdict" + hl("headline")}>
        <button type="button" className={"summary-chip" + hl("case")} aria-label="Adjust what you see" onClick={() => onPanel(!panelOpen)}>
          <span>
            <Icon name={view.vdef.icon} size={16} />
            {view.vdef.short}
          </span>
          <span>
            <Icon name="pin" size={16} />
            {view.region.name}
          </span>
          <span>
            <Icon name="calendar" size={16} />
            {view.explore ? `${sY} to ${eY}` : view.periodText}
          </span>
        </button>

        <h1 id="ev-head" className="title headline">
          {view.headline}
        </h1>

        <div className="row row-tight">
          <button type="button" className="badge badge-btn" onClick={() => onTerm("trend")}>
            <Icon name={view.direction.icon} size={18} strokeWidth={1.9} />
            <span className="dotted">{view.direction.label}</span>
          </button>
          <button type="button" className={`badge badge-btn badge-${rec.status}`} onClick={() => onTerm(rec.status)}>
            <Icon name={view.badge.icon} size={18} strokeWidth={1.9} />
            <span className="dotted">{view.badge.label}</span>
          </button>
        </div>

        {view.cautions.map((c) => (
          <p key={c} className="caution small">
            <Icon name="info" size={18} />
            {c}
          </p>
        ))}

        <div className={"key-numbers" + hl("numbers")}>
          <div className="key-number">
            <span className="small muted">Change per decade</span>
            <span className="num big">{view.rate}</span>
            {view.rateSub && <span className="tiny muted">{view.rateSub}</span>}
            <span className="tiny muted">likely {view.sure.range.replace(/ per decade$/, "")}</span>
          </div>
          <div className="key-number">
            <span className="small muted">Change along the trend line, {view.periodText}</span>
            <span className="num big">{view.total}</span>
          </div>
          <div className="key-number">
            <button type="button" className="term term-muted" onClick={() => onTerm("p_value")}>
              p-value
            </button>
            <span className="num big">{view.pDisplay}</span>
            <span className="tiny muted">{view.pSub}</span>
          </div>
        </div>

        <p className="small muted methods">
          Rate of change:{" "}
          <Term id="sens_slope" onTerm={onTerm}>
            Sen’s slope
          </Term>{" "}
          · Significance:{" "}
          <Term id="mann_kendall" onTerm={onTerm}>
            Mann-Kendall test
          </Term>
        </p>
      </section>

      {/* card deck + where */}
      <div className="evidence">
        <section aria-label="Evidence cards" className="deck">
          <div className="deck-peek deck-peek-2" aria-hidden="true" />
          <div className="deck-peek deck-peek-1" aria-hidden="true" />
          <div className={"panel deck-card" + deckHl}>
            <div className="deck-head">
              <div className="stack-2">
                <span className="group-label">
                  Card {cardIdx + 1} of {cards.length}
                </span>
                <h2 className="h3">{cards[cardIdx].title}</h2>
              </div>
              <div className="row row-center deck-nav">
                <span className="dots" aria-hidden="true">
                  {cards.map((c, i) => (
                    <span key={c.id} className={i === cardIdx ? "dot is-current dot-sm" : "dot"} />
                  ))}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Previous card"
                  onClick={() => onCard((cardIdx + cards.length - 1) % cards.length)}
                >
                  <Icon name="arrowL" size={18} strokeWidth={2} />
                </button>
                <button type="button" className="icon-btn icon-btn-primary" aria-label="Next card" onClick={() => onCard((cardIdx + 1) % cards.length)}>
                  <Icon name="arrowR" size={18} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div aria-live="polite">
              {cur === "series" && (
                <div className="stack-12">
                  <div className="legend">
                    <span>
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <circle cx="7" cy="7" r="3.5" fill="var(--series)" />
                      </svg>
                      Each {view.perWord}
                    </span>
                    <span>
                      <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
                        <path d="M1 7h20" stroke="var(--trend)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      Trend
                    </span>
                    <span>
                      <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
                        <path d="M1 7h20" stroke="var(--mean-line)" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
                      </svg>
                      Average
                    </span>
                  </div>
                  <SeriesChart view={view} />
                  {view.window && (
                    <div className="window-strip">
                      <span className={`badge badge-sm badge-${view.window.status}`}>
                        <Icon name={view.window.status === "significant" ? "check" : "minus"} size={16} strokeWidth={1.9} />
                        {view.window.status === "significant" ? "Significant" : "Not significant"}
                      </span>
                      <span className="num small">{view.windowText}</span>
                      {view.window.shortPeriodWarning && <span className="small warn">Short periods can mislead.</span>}
                      <button type="button" className="link-btn window-back" onClick={() => onChange({ periodMode: "full" })}>
                        Back to full record
                      </button>
                    </div>
                  )}
                </div>
              )}

              {cur === "sure" && (
                <div className="stack-12">
                  <div className="second-row">
                    <span className="stack-0">
                      <span className="strong">
                        <Term id="range" onTerm={onTerm}>
                          Likely range
                        </Term>{" "}
                        of the change
                      </span>
                      <span className="small muted">{view.sure.rangeNote}</span>
                    </span>
                    <span className="num strong">{view.sure.range}</span>
                  </div>
                  <div className="second-row">
                    <span className="stack-0">
                      <span className="strong">
                        <Term id="dependence" onTerm={onTerm}>
                          Year-to-year dependence
                        </Term>
                      </span>
                      <span className="small muted">{view.sure.depend}</span>
                    </span>
                  </div>
                  <p className="small muted">
                    The rate of change is an estimate from {rec.values.length} {view.perWord}s of data. These two checks show how far to
                    trust it.
                  </p>
                </div>
              )}

              {cur === "years" && (
                <div className="card-split">
                  <div className="card-text">
                    <p className="lead">{view.moreYears.caption}</p>
                    <p className="small muted">
                      The line shows the{" "}
                      <Term id="p_value" onTerm={onTerm}>
                        p-value
                      </Term>{" "}
                      for the latest 15 {view.perWord}s, then 16, and so on up to the full record. Below the dashed line means{" "}
                      <Term id="significant" onTerm={onTerm}>
                        significant
                      </Term>
                      .
                    </p>
                  </div>
                  <MoreYearsChart view={view} />
                </div>
              )}

              {cur === "rhythm" && (
                <div className="card-split">
                  <div className="card-text">
                    <p className="lead">{view.rhythmText}</p>
                    <p className="small muted">
                      This regular pattern is the{" "}
                      <Term id="seasonal_cycle" onTerm={onTerm}>
                        seasonal cycle
                      </Term>
                      .
                    </p>
                  </div>
                  <RhythmChart view={view} />
                </div>
              )}

              {cur === "second" && view.second && (
                <div className="stack-12">
                  <p className="lead">{view.second.note}</p>
                  {view.second.rows.map((so) => (
                    <div key={so.name} className="second-row">
                      <span className="stack-0">
                        <span className="strong">{so.name}</span>
                        <span className="tiny muted">{so.sub}</span>
                      </span>
                      <span className="row row-center row-tight">
                        <span className="num small">{so.value}</span>
                        <span className={`badge badge-sm badge-${so.badge.status}`}>
                          <Icon name={so.badge.icon} size={14} strokeWidth={2} />
                          {so.badge.label}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {view.where && (
          <section aria-labelledby="where-title" className="panel where">
            <div className="stack-2">
              <h2 id="where-title" className="h3">
                Where is it changing?
              </h2>
              <p className="small muted">{view.where.intro}</p>
            </div>
            <RegionMap fills={view.mapFills} labels={view.mapLabels} selected={view.region.id} onPick={(id) => onChange({ region: id })} />
            <div className="stack-2">
              {view.where.rows.map((r) => {
                const w = Math.min(50, (Math.abs(r.amount) / view.where!.scale) * 50);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="region-row"
                    aria-pressed={r.id === view.region.id}
                    onClick={() => onChange({ region: r.id })}
                  >
                    <span className="small strong">{r.name}</span>
                    <span className="bar" aria-hidden="true">
                      <span className="bar-mid" />
                      <span
                        className="bar-fill"
                        style={{
                          left: r.amount < 0 ? `${50 - w}%` : "50%",
                          width: `${w}%`,
                          background: r.amount < 0 ? "var(--dry-strong)" : "var(--wet-strong)",
                        }}
                      />
                    </span>
                    <span className="region-value">
                      <span className="num small">{r.value}</span>
                      <Icon name={r.badge.icon} size={18} strokeWidth={1.9} label={r.badge.label} className={`tone-${r.badge.status}`} />
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="tiny muted">{view.where.caption}</span>
          </section>
        )}
      </div>

      <div className="row">
        <a className="btn btn-primary btn-lg" href="#/case">
          Close the case: see the verdict
          <Icon name="arrowR" strokeWidth={2} />
        </a>
      </div>

      {/* demo caption: follows along at the bottom */}
      {demo && (
        <div role="status" className="demo-bar">
          <div className="demo-text">
            <Icon name="play" size={24} />
            <div className="stack-4">
              <span className="demo-label">
                {demo.label} · Step {demo.step} of {demo.count}
              </span>
              <span>{demo.text}</span>
            </div>
          </div>
          <div className="row row-tight">
            <button type="button" className="btn demo-back" disabled={demo.step <= 1} onClick={demo.onBack}>
              Back
            </button>
            <button type="button" className="btn demo-next" onClick={demo.onNext}>
              {demo.nextLabel}
            </button>
            <button type="button" className="icon-btn demo-exit" aria-label="Exit the demo" onClick={demo.onExit}>
              <Icon name="x" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
