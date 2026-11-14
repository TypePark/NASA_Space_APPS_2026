import { useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { MONTHS_LONG } from "../content";
import type { View } from "../model";
import { pShow, rateDigits, signed } from "../model";

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

/**
 * Which point the reader is looking at: the one nearest the pointer (mouse or
 * touch), or the one chosen with the left and right arrow keys.
 */
function useHover(count: number, xOf: (i: number) => number, width: number) {
  const [raw, setRaw] = useState<number | null>(null);
  const index = raw !== null && raw < count ? raw : null;
  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * width;
    let best = 0;
    for (let i = 1; i < count; i++) if (Math.abs(xOf(i) - x) < Math.abs(xOf(best) - x)) best = i;
    setRaw(best);
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setRaw(index === null ? 0 : Math.min(count - 1, index + 1));
    else if (e.key === "ArrowLeft") setRaw(index === null ? count - 1 : Math.max(0, index - 1));
    else if (e.key === "Escape") setRaw(null);
    else return;
    e.preventDefault();
  };
  return {
    index,
    handlers: { tabIndex: 0, onPointerMove: nearest, onPointerDown: nearest, onPointerLeave: () => setRaw(null), onBlur: () => setRaw(null), onKeyDown },
  };
}

/** A small label next to the point being looked at. */
function Tip({ x, y, lines, width, font = 13 }: { x: number; y: number; lines: string[]; width: number; font?: number }) {
  const w = Math.max(...lines.map((l) => l.length)) * font * 0.58 + 20;
  const h = lines.length * font * 1.4 + 12;
  const left = x + 12 + w > width ? x - 12 - w : x + 12;
  const top = Math.max(2, y - h - 10);
  return (
    <g pointerEvents="none" aria-hidden="true">
      <rect x={left} y={top} width={w} height={h} rx="8" fill="var(--ink)" />
      {lines.map((l, i) => (
        <text
          key={i}
          x={left + 10}
          y={top + 6 + font * 1.4 * (i + 0.75)}
          fontSize={font}
          fontWeight={i === 0 ? 600 : 400}
          fill="var(--bg)"
          fontFamily={FONT}
        >
          {l}
        </text>
      ))}
    </g>
  );
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
  // Amounts that are added up (rainfall) cannot go below zero.
  const floor = rec.trend_percent_per_decade !== null && vmin >= 0 ? 0 : -Infinity;
  const nt = niceTicks(Math.max(floor, vmin - pad), vmax + pad, 5);
  const X = (yr: number) => L + ((yr - x0) / (x1 - x0)) * (R - L);
  const Y = (v: number) => B - ((v - nt.lo) / (nt.hi - nt.lo)) * (B - T);
  const line = (yr: number) => rec.trend_line.slope_per_year * yr + rec.trend_line.intercept;
  const step = (R - L) / (x1 - x0);
  const win = view.window;

  const hover = useHover(years.length, (i) => X(years[i]), W);
  const at = hover.index;

  const aria =
    `${rec.variable_label} for ${rec.region}, ${view.periodText}. ` +
    `Trend ${signed(rec.trend_per_decade, rateDigits(rec))} ${rec.trend_units}. ` +
    "Use the left and right arrow keys to read each value.";

  return (
    <svg className="chart chart-hover" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} {...hover.handlers}>
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
        />
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
      {at !== null && (
        <>
          <line x1={X(years[at])} x2={X(years[at])} y1={T} y2={B} stroke="var(--axis)" strokeWidth="1" strokeDasharray="2 4" />
          <circle cx={X(years[at])} cy={Y(rec.values[at])} r={phone ? 6 : 7} fill="var(--trend)" stroke="var(--surface)" strokeWidth="2.5" />
          <Tip
            x={X(years[at])}
            y={Y(rec.values[at])}
            width={W}
            font={font}
            lines={[rec.years[at], `${rec.values[at].toFixed(rateDigits(rec))} ${unit}`, `Trend line: ${line(years[at]).toFixed(rateDigits(rec))} ${unit}`]}
          />
        </>
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
  const hover = useHover(points.length, (i) => X(points[i].n), 460);
  const at = hover.index;
  return (
    <svg
      className="chart chart-side chart-hover"
      viewBox="0 0 460 200"
      role="img"
      aria-label={`p-value as the period grows from ${first} to ${n} ${view.perWord}s. ${caption}`}
      {...hover.handlers}
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
      {at !== null && (
        <>
          <circle cx={X(points[at].n)} cy={Y(points[at].p)} r="5.5" fill="var(--trend)" stroke="var(--surface)" strokeWidth="2" />
          <Tip
            x={X(points[at].n)}
            y={Y(points[at].p)}
            width={460}
            font={12}
            lines={[`Latest ${points[at].n} ${view.perWord}s`, `p = ${pShow(points[at].p)}`]}
          />
        </>
      )}
    </svg>
  );
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Card 3: the average value for each month. */
export function RhythmChart({ view }: { view: View }) {
  const { rec, unit } = view;
  const sums = rec.trend_percent_per_decade !== null;
  const clim = rec.monthly_climatology;
  const cmax = Math.max(...clim);
  const base = sums ? 0 : Math.floor(Math.min(...clim)) - 3;
  const chosen = new Set(view.vdef.months);
  const average = clim.reduce((a, b) => a + b, 0) / 12;
  const barX = (i: number) => 8 + i * 37.5;
  const barH = (v: number) => Math.max(2, ((v - base) / (cmax - base)) * 150);
  const hover = useHover(12, (i) => barX(i) + 13, 460);
  const at = hover.index;
  return (
    <svg
      className="chart chart-side chart-hover"
      viewBox="0 0 460 190"
      role="img"
      aria-label={`Average ${view.base.noun} for each month, January to December.`}
      {...hover.handlers}
    >
      {clim.map((v, i) => {
        const h = barH(v);
        const x = barX(i);
        // Highlight the chosen months; for a whole year, the months above average.
        const strong = chosen.size < 12 ? chosen.has(i + 1) : v >= average;
        return (
          <g key={i}>
            <rect
              x={x}
              y={168 - h}
              width="26"
              height={h}
              rx="6"
              fill={strong ? (sums ? "var(--series)" : "var(--trend)") : "var(--series-line)"}
              stroke={at === i ? "var(--ink)" : "none"}
              strokeWidth="2"
            />
            <text x={x + 13} y="182" textAnchor="middle" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
              {MONTHS[i]}
            </text>
          </g>
        );
      })}
      <text x="4" y="14" fontSize="12" fill="var(--axis)" fontFamily={FONT}>
        Average {view.base.noun} per month ({unit})
      </text>
      {at !== null && (
        <Tip x={barX(at) + 13} y={168 - barH(clim[at])} width={460} font={12} lines={[MONTHS_LONG[at], `${clim[at].toFixed(1)} ${unit}`]} />
      )}
    </svg>
  );
}
