import raw from "./all_results.json";

export type RegionId = "cyprus_whole" | "troodos" | "nicosia" | "limassol" | "larnaca" | "paphos";
export type VariableId =
  | "annual_total"
  | "wet_season_total"
  | "dry_season_total"
  | "annual_mean_temperature"
  | "summer_mean_temperature";
export type DatasetId = "imerg" | "merra2";

/** One analysed result, exactly as stored in all_results.json. */
export interface ResultRecord {
  id: string;
  region: string;
  region_id: RegionId;
  dataset: string;
  variable: VariableId;
  variable_label: string;
  units: string;
  source: string;
  years: (number | string)[];
  year_numeric: number[];
  values: number[];
  mean: number;
  monthly_climatology: number[];
  monthly_climatology_units: string;
  trend_per_decade: number;
  trend_percent_per_decade: number | null;
  trend_units: string;
  change_over_period: number;
  change_over_period_units: string;
  trend_line: { slope_per_year: number; intercept: number };
  p_value: number;
  p_value_display: string;
  significant: boolean;
  status: "significant" | "not_significant";
  explanation: string;
}

export const RECORDS = raw as unknown as ResultRecord[];

const BY_ID = new Map(RECORDS.map((r) => [r.id, r]));

/** Record key: region_id + variable, with `_merra2` for MERRA-2. */
export function recordId(region: RegionId, variable: VariableId, dataset: DatasetId): string {
  return `${region}_${variable}${dataset === "merra2" ? "_merra2" : ""}`;
}

export function findRecord(region: RegionId, variable: VariableId, dataset: DatasetId): ResultRecord | undefined {
  return BY_ID.get(recordId(region, variable, dataset));
}

export function datasetIdOf(r: ResultRecord): DatasetId {
  return r.id.endsWith("_merra2") ? "merra2" : "imerg";
}
