import raw from "./monthly.json";

export type RegionId = "cyprus_whole" | "troodos" | "nicosia" | "limassol" | "larnaca" | "paphos";
export type DatasetId = "imerg" | "merra2";

/** One monthly series from NASA Giovanni, as written by analysis/build_monthly.py. */
export interface MonthlySeries {
  id: string;
  /** Variable key, e.g. "rainfall" or "temperature". */
  variable: string;
  dataset: DatasetId;
  dataset_name: string;
  region_id: RegionId;
  region: string;
  units: string;
  /** "sum": months are added up. "mean": months are averaged. */
  aggregate: "sum" | "mean";
  /** Also report the change as a percent of the average. */
  percent: boolean;
  source: string;
  /** Year and month (1–12) of the first value. */
  start: [number, number];
  values: number[];
}

export const SERIES = raw as unknown as MonthlySeries[];

export function findSeries(variable: string, region: RegionId, dataset: DatasetId): MonthlySeries | undefined {
  return SERIES.find((s) => s.variable === variable && s.region_id === region && s.dataset === dataset);
}

/** The records that hold this variable for this place, most detailed first. */
export function datasetsFor(variable: string, region: RegionId): DatasetId[] {
  return SERIES.filter((s) => s.variable === variable && s.region_id === region).map((s) => s.dataset);
}

/** Every place this variable has data for. */
export function regionsFor(variable: string): RegionId[] {
  return [...new Set(SERIES.filter((s) => s.variable === variable).map((s) => s.region_id))];
}

/** The record that covers the most places for this variable (used for "Where is it changing?"). */
export function regionalDataset(variable: string): DatasetId | null {
  const count = new Map<DatasetId, number>();
  for (const s of SERIES) if (s.variable === variable) count.set(s.dataset, (count.get(s.dataset) ?? 0) + 1);
  let best: DatasetId | null = null;
  for (const [d, n] of count) if (n > 1 && (best === null || n > (count.get(best) ?? 0))) best = d;
  return best;
}

/** First and last year a series covers. */
export function yearsOf(s: MonthlySeries): [number, number] {
  const last = s.start[0] * 12 + (s.start[1] - 1) + s.values.length - 1;
  return [s.start[0], Math.floor(last / 12)];
}
