import { useSyncExternalStore } from "react";
import type { View } from "../model";
import { rateDigits, signed } from "../model";

const FONT = "Figtree, sans-serif";

function niceTicks(min: number, max: number, count: number) {
  const raw = (max - min) / count;
  let step = Math.pow(10, Math.floor(Math.log10(raw)));
  const e = raw / step;
  if (e >= 7.5) step *= 10;
  else if (e >= 3.5) step *= 5;
  else if (e >= 1.5) step *= 2;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, step, ticks };
}

const PHONE = "(max-width: 720px)";
function subscribePhone(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** True at phone width, where the main chart is drawn narrower so its labels stay readable. */
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches);
}

/** Card 1: yearly values as dots, a thin connecting line, the trend line and a dashed average. */
export function SeriesChart({ view }: { view: View }) {
  const { rec, x0, x1, explore, startYear, endYear, unit } = view;
  const phone = useIsPhone();
  const W = phone ? 420 : 1000;
  const H = phone ? 320 : 380;
  const L = phone ? 56 : 64, R = W - (phone ? 12 : 24), T = 16, B = H - 44;
  const font = phone ? 13 : 14;
  const years = rec.year_numeric;
  const vmin = Math.min(...rec.values);
  const vmax = Math.max(...rec.values);
  const pad = (vmax - vmin) * 0.08;
  const nt = niceTicks(vmin - pad, vmax + pad, 5);
  const X = (yr: number) => L + ((yr - x0) / (x1 - x0)) * (R - L);
  const Y = (v: number) => B - ((v - nt.lo) / (nt.hi - nt.lo)) * (B - T);
  const line = (yr: number) => rec.trend_line.slope_per_year * yr + rec.trend_line.intercept;
  const step = (R - L) / (x1 - x0);
  const win = view.window;

  const aria =
    `${rec.variable_label} for ${rec.region}, ${view.periodText}. ` +
    `Trend ${signed(rec.trend_per_decade, rateDigits(rec))} ${rec.trend_units}.`;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
      {nt.ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={R} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" strokeWidth="1" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize={font} fill="var(--axis)" fontFamily={FONT}>
            {nt.step < 1 ? v.toFixed(1) : Math.round(v)} {unit}
          </text>
        </g>
      ))}
      {years
        .filter((yr) => yr % (phone && x1 - x0 > 30 ? 10 : 5) === 0)
        .map((yr) => (
          <text key={yr} x={X(yr)} y={H - 12} textAnchor="middle" fontSize={font} fill="var(--axis)" fontFamily={FONT}>
            {yr}
          </text>
        ))}
      {explore && (
        <rect x={X(startYear) - step / 2} y={T} width={X(endYear) - X(startYear) + step} height={B - T} rx="8" fill="var(--band)" />
      )}
      <line x1={L} x2={R} y1={Y(rec.mean)} y2={Y(rec.mean)} stroke="var(--mean-line)" strokeWidth="1.5" strokeDasharray="3 5" />
      <polyline
        points={years.map((yr, i) => `${X(yr).toFixed(1)},${Y(rec.values[i]).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--series-line)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {years.map((yr, i) => (
        <circle
          key={yr}
          cx={X(yr)}
          cy={Y(rec.values[i])}
          r={phone ? 3.5 : 4.5}
          fill={!explore || (yr >= startYear && yr <= endYear) ? "var(--series)" : "var(--series-line)"}
        >
          <title>
            {rec.years[i]}: {rec.values[i]} {rec.units}
          </title>
        </circle>
      ))}
      <line
        x1={X(x0)}
        x2={X(x1)}
        y1={Y(line(x0))}
        y2={Y(line(x1))}
        stroke={explore ? "var(--mean-line)" : "var(--trend)"}
        strokeWidth={explore ? 2 : 3}
        strokeDasharray={explore ? "6 6" : undefined}
        strokeLinecap="round"
      />
      {win && (
        <line
          x1={X(startYear)}
          x2={X(endYear)}
          y1={Y(win.line.slope * startYear + win.line.intercept)}
          y2={Y(win.line.slope * endYear + win.line.intercept)}
          stroke="var(--trend)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/** Card 2: the p-value as the period grows from 15 years to the full record. */
export function MoreYearsChart({ view }: { view: View }) {
  const { points, caption } = view.moreYears;
  const n = points[points.length - 1].n;
  const first = points[0].n;
  const X = (k: number) => 44 + ((k - first) / Math.max(1, n - first)) * 404;
  const Y = (p: number) => 168 - p * 152;
  return (
    <svg
      className="chart chart-side"
      viewBox="0 0 460 200"
      role="img"
      aria-label={`p-value as the period grows from ${first} to ${n} ${view.perWord}s. ${caption}`}
    >
      <line x1="44" x2="448" y1="168" y2="168" stroke="var(--grid)" />
      <line x1="44" x2="448" y1={Y(0.05)} y2={Y(0.05)} stroke="var(--sig-line)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="448" y={Y(0.05) - 6} textAnchor="end" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
        p = 0.05
      </text>
      <text x="38" y="20" textAnchor="end" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
        1.0
      </text>
      <text x="38" y="172" textAnchor="end" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
        0
      </text>
      <polyline
        points={points.map((o) => `${X(o.n).toFixed(1)},${Y(o.p).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--series-line)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {points.map((o) => (
        <circle key={o.n} cx={X(o.n)} cy={Y(o.p)} r="3" fill="var(--series)" />
      ))}
      <text x="44" y="192" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
        {first} {view.perWord}s
      </text>
      <text x="448" y="192" textAnchor="end" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
        {n} {view.perWord}s
      </text>
    </svg>
  );
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Card 3: the average value for each month. */
export function RhythmChart({ view }: { view: View }) {
  const { rec, isTemp, unit } = view;
  const clim = rec.monthly_climatology;
  const cmax = Math.max(...clim);
  const base = isTemp ? Math.floor(Math.min(...clim)) - 3 : 0;
  return (
    <svg
      className="chart chart-side"
      viewBox="0 0 460 190"
      role="img"
      aria-label={`${isTemp ? "Average monthly temperature" : "Average monthly rainfall"}, January to December.`}
    >
      {clim.map((v, i) => {
        const h = Math.max(2, ((v - base) / (cmax - base)) * 150);
        const x = 8 + i * 37.5;
        const strong = isTemp ? i >= 5 && i <= 7 : i <= 2 || i >= 9;
        return (
          <g key={i}>
            <rect x={x} y={168 - h} width="26" height={h} rx="6" fill={strong ? (isTemp ? "var(--trend)" : "var(--series)") : "var(--series-line)"}>
              <title>
                {v} {unit}
              </title>
            </rect>
            <text x={x + 13} y="182" textAnchor="middle" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
              {MONTHS[i]}
            </text>
          </g>
        );
      })}
      <text x="4" y="14" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
        {isTemp ? "Average temperature" : "Average rain"} per month ({unit})
      </text>
    </svg>
  );
}
