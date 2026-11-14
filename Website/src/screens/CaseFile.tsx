import Icon from "../components/Icon";
import { BASE_VARS, NEXT_LEADS } from "../content";
import { ALL_MONTHS } from "../lib/aggregate";
import { buildAnswers } from "../model";
import type { Settings, View } from "../model";

interface CaseFileProps {
  view: View;
  onLead: (patch: Partial<Settings>) => void;
  onNewCase: () => void;
}

export default function CaseFile({ view, onLead, onNewCase }: CaseFileProps) {
  const answers = buildAnswers(view);
  // Next lead: the next variable in the list, whole island, whole year.
  const next = BASE_VARS[(BASE_VARS.findIndex((b) => b.id === view.base.id) + 1) % BASE_VARS.length];
  const lead = {
    ...(NEXT_LEADS[next.id] ?? { text: `Now look at ${next.noun}.`, button: `Check ${next.noun}` }),
    patch: { custom: { variable: next.id, months: ALL_MONTHS }, region: "cyprus_whole" } as const,
  };

  return (
    <main className="page page-narrow casefile">
      <a className="back-link" href="#/explore">
        <Icon name="arrowL" size={18} strokeWidth={2} />
        Back to the evidence
      </a>

      <section aria-labelledby="vd-head" className="stack-14">
        <span className="kicker kicker-icon">
          <Icon name="file" size={18} />
          Case file · {view.vdef.q} · {view.region.name}
        </span>
        <h1 id="vd-head" className="title headline">
          {view.headline}
        </h1>
      </section>

      <section aria-label="The verdict" className="panel answers">
        {answers.map((a) => (
          <div key={a.q} className="answer">
            <span className={`round-icon tone-bg-${a.tone}`}>
              <Icon name={a.icon} size={22} />
            </span>
            <div className="stack-4">
              <h2 className="small strong muted">{a.q}</h2>
              <p className="lead">{a.text}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="tiny muted source">Source: {view.rec.source}.</p>

      <section aria-labelledby="next-title" className="next-lead">
        <div className="stack-2">
          <h2 id="next-title" className="strong accent-ink">
            Next lead
          </h2>
          <span>{lead.text}</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onLead(lead.patch)}>
          {lead.button}
          <Icon name="arrowR" size={18} strokeWidth={2} />
        </button>
      </section>

      <div className="row row-center">
        <button type="button" className="btn btn-outline" onClick={onNewCase}>
          Start a new case
        </button>
        <a className="link-btn" href="#/method">
          How we worked this out
        </a>
      </div>
    </main>
  );
}
