import Icon from "../components/Icon";
import { DATASETS, LIMITS, METHOD_STEPS } from "../content";
import { allResultRows } from "../model";

const ROWS = allResultRows();

export default function Method() {
  return (
    <main className="page page-narrow method">
      <section className="stack-12">
        <h1 className="title">Data &amp; Method</h1>
        <p className="lead muted">Everything behind the verdicts, so you can check our work.</p>
      </section>

      <section aria-labelledby="m-data" className="stack-14">
        <h2 id="m-data" className="h2">
          The data
        </h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="m-data">
          <table className="table table-data">
            <thead>
              <tr>
                <th scope="col">Dataset</th>
                <th scope="col">What it measures</th>
                <th scope="col">Period</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {DATASETS.map((d) => (
                <tr key={d.name + d.what}>
                  <td className="strong">{d.name}</td>
                  <td>{d.what}</td>
                  <td>{d.period}</td>
                  <td className="muted">{d.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Accessed through NASA Giovanni (area-averaged time series). Regions are the Cyprus country outline plus five
          boxes around Troodos, Nicosia / Lefkoşa, Limassol, Larnaca and Paphos.
        </p>
      </section>

      <section aria-labelledby="m-method" className="stack-14">
        <h2 id="m-method" className="h2">
          How we test for a trend
        </h2>
        <div className="method-grid">
          {METHOD_STEPS.map((m) => (
            <div key={m.title} className="stack-6">
              <span className="strong">{m.title}</span>
              <span className="small muted">{m.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="m-results" className="stack-14">
        <h2 id="m-results" className="h2">
          All results
        </h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="m-results">
          <table className="table table-results">
            <thead>
              <tr>
                <th scope="col">Place</th>
                <th scope="col">Measure</th>
                <th scope="col">Record</th>
                <th scope="col" className="right">
                  Change per decade
                </th>
                <th scope="col" className="right">
                  p-value
                </th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.id}>
                  <td>{r.place}</td>
                  <td>{r.measure}</td>
                  <td className="muted">{r.record}</td>
                  <td className="num right">{r.trend}</td>
                  <td className="num right">{r.p}</td>
                  <td>
                    <span className={`badge badge-sm badge-${r.badge.status}`}>
                      <Icon name={r.badge.icon} size={14} strokeWidth={2} />
                      {r.badge.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="m-limits" className="stack-12">
        <h2 id="m-limits" className="h2">
          Limitations
        </h2>
        <ul className="limits small muted">
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="m-team" className="team stack-8">
        <h2 id="m-team" className="h3">
          Team
        </h2>
        <p className="small muted">
          AquaCosmos team · NASA Space Apps Challenge 2026 · Challenge: Be An Earth System Trend Detective
        </p>
        <p className="tiny muted">
          This project uses NASA open data. NASA does not endorse any non-U.S. Government entity and is not responsible
          for information on non-U.S. Government websites.
        </p>
      </section>
    </main>
  );
}
