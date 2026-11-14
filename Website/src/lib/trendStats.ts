/**
 * AquaCosmos – trend statistics for the browser (no dependencies).
 * Matches the Python analysis (pymannkendall original_test + Sen's slope).
 */

export type TrendStatus = "significant" | "not_significant";

export interface WindowResult {
  startYear: number;
  endYear: number;
  nYears: number;
  trendPerDecade: number;
  trendPercentPerDecade: number;
  pValue: number;
  tau: number;
  status: TrendStatus;
  /** The line to draw: Sen's slope through the middle of the points. */
  line: { slope: number; intercept: number };
  /** 95% confidence range of Sen's slope, per decade. */
  rangePerDecade: [number, number];
  /** How strongly one year follows the year before (lag-1 autocorrelation of the detrended values). */
  lag1: number;
  /** True when that link is too strong to be chance. */
  dependent: boolean;
  /** p-value after allowing for that link. Equal to pValue when the link is weak. */
  pAdjusted: number;
  shortPeriodWarning: boolean;
}

// Standard normal CDF (Abramowitz–Stegun 7.1.26 erf approximation, error < 1.5e-7)
function normCdf(z: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Mann-Kendall test with tie correction. */
export function mannKendall(values: number[]) {
  const n = values.length;
  let s = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) s += Math.sign(values[j] - values[i]);
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let tieTerm = 0;
  counts.forEach((t) => {
    if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);
  });
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  const z = s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const tau = s / (0.5 * n * (n - 1));
  const trend = p < 0.05 ? (z > 0 ? "increasing" : "decreasing") : "no trend";
  return { s, tau, z, p, trend, varS };
}

function median(sorted: number[]): number {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function pairSlopes(x: number[], y: number[]): number[] {
  const slopes: number[] = [];
  for (let i = 0; i < y.length - 1; i++)
    for (let j = i + 1; j < y.length; j++)
      if (x[j] !== x[i]) slopes.push((y[j] - y[i]) / (x[j] - x[i]));
  return slopes.sort((a, b) => a - b);
}

/** Sen's slope (median of pairwise slopes), per unit of x (per year). */
export function sensSlope(x: number[], y: number[]): number {
  return median(pairSlopes(x, y));
}

/**
 * 95% confidence range of Sen's slope (Sen 1968; Gilbert 1987), per unit of x.
 * varS is the variance of the Mann-Kendall S statistic for the same values.
 */
export function sensSlopeRange(x: number[], y: number[], varS: number): [number, number] {
  const slopes = pairSlopes(x, y);
  const n = slopes.length;
  const c = 1.959964 * Math.sqrt(varS);
  const lo = Math.max(0, Math.min(n - 1, Math.round((n - c) / 2) - 1));
  const hi = Math.max(0, Math.min(n - 1, Math.round((n + c) / 2)));
  return [slopes[lo], slopes[hi]];
}

/** Sen's line: Sen's slope, placed through the middle of the points. */
export function sensLine(x: number[], y: number[]) {
  const slope = sensSlope(x, y);
  const intercept = median(y.map((v, i) => v - slope * x[i]).sort((a, b) => a - b));
  return { slope, intercept };
}

/**
 * Check whether one year depends on the year before, which makes the
 * Mann-Kendall test too confident. Uses the lag-1 autocorrelation of the
 * detrended values and, when it is positive and too strong to be chance,
 * widens the variance of S (Yue & Wang 2004) and recalculates p.
 */
export function dependenceCheck(x: number[], y: number[]) {
  const mk = mannKendall(y);
  const line = sensLine(x, y);
  const res = y.map((v, i) => v - (line.slope * x[i] + line.intercept));
  const n = res.length;
  const mean = res.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (res[i] - mean) ** 2;
    if (i < n - 1) num += (res[i] - mean) * (res[i + 1] - mean);
  }
  const lag1 = den === 0 ? 0 : num / den;
  const dependent = lag1 > 1.96 / Math.sqrt(n);
  if (!dependent) return { lag1, dependent, pAdjusted: mk.p };
  let factor = 1;
  for (let k = 1; k < n; k++) factor += 2 * (1 - k / n) * lag1 ** k;
  const sd = Math.sqrt(mk.varS * factor);
  const z = mk.s > 0 ? (mk.s - 1) / sd : mk.s < 0 ? (mk.s + 1) / sd : 0;
  return { lag1, dependent, pAdjusted: 2 * (1 - normCdf(Math.abs(z))) };
}

/** Ordinary least-squares line (kept for comparison; the app draws Sen's line). */
export function linearFit(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

/** Status, NASA challenge standard: p < 0.05 is a significant trend. */
export function statusFor(p: number): TrendStatus {
  return p < 0.05 ? "significant" : "not_significant";
}

/**
 * Analyze a chosen period. years = record.year_numeric, values = record.values.
 * Returns null if the window is shorter than minYears (default 15).
 */
export function analyzeWindow(
  years: number[],
  values: number[],
  startYear: number,
  endYear: number,
  minYears = 15,
): WindowResult | null {
  const idx = years.map((_, i) => i).filter((i) => years[i] >= startYear && years[i] <= endYear);
  if (idx.length < minYears) return null;
  const x = idx.map((i) => years[i]);
  const y = idx.map((i) => values[i]);
  const mk = mannKendall(y);
  const line = sensLine(x, y);
  const sen = line.slope;
  const range = sensSlopeRange(x, y, mk.varS);
  const dep = dependenceCheck(x, y);
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  return {
    startYear: x[0],
    endYear: x[x.length - 1],
    nYears: y.length,
    trendPerDecade: sen * 10,
    trendPercentPerDecade: ((sen * 10) / mean) * 100,
    pValue: mk.p,
    tau: mk.tau,
    status: statusFor(mk.p),
    line,
    rangePerDecade: [range[0] * 10, range[1] * 10],
    lag1: dep.lag1,
    dependent: dep.dependent,
    pAdjusted: dep.pAdjusted,
    shortPeriodWarning: y.length < 20,
  };
}

/**
 * "Would more years help?": p-value as the period grows backwards from the
 * latest year, from minYears up to the full record.
 */
export function pValueByLength(years: number[], values: number[], minYears = 15) {
  const end = years[years.length - 1];
  const out: { nYears: number; startYear: number; pValue: number; trendPerDecade: number }[] = [];
  for (let n = minYears; n <= years.length; n++) {
    const start = years[years.length - n];
    const r = analyzeWindow(years, values, start, end, minYears);
    if (r) out.push({ nYears: n, startYear: start, pValue: r.pValue, trendPerDecade: r.trendPerDecade });
  }
  return out;
}
