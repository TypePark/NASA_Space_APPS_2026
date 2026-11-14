import { aggregate, climatology } from "../lib/aggregate";
import { analyzeWindow } from "../lib/trendStats";
import type { TrendStatus } from "../lib/trendStats";
import { findSeries } from "./series";
import type { DatasetId, RegionId } from "./series";

export type { DatasetId, RegionId };

/** The ready-made questions. */
export type VariableId =
  | "annual_total"
  | "wet_season_total"
  | "dry_season_total"
  | "annual_evapotranspiration"
  | "annual_mean_temperature"
  | "summer_mean_temperature";

/** What to analyse: a variable and the months of the year to use. */
export interface Selection {
  /** Variable key from the data, e.g. "rainfall". */
  variable: string;
  /** Months 1–12. */
  months: number[];
  /** Key for this choice: one of the ready-made questions, or "custom". */
  key: string;
  /** Display label, e.g. "Annual rainfall". */
  label: string;
}

/** One analysed result, calculated in the browser from the monthly series. */
export interface ResultRecord {
  id: string;
  region: string;
  region_id: RegionId;
  /** Dataset display name, e.g. "GPM IMERG". */
  dataset: string;
  dataset_id: DatasetId;
  variable: string;
  variable_label: string;
  units: string;
  source: string;
  years: string[];
  year_numeric: number[];
  values: number[];
  mean: number;
  monthly_climatology: number[];
  trend_per_decade: number;
  /** Null when a percent makes no sense for the variable (temperature). */
  trend_percent_per_decade: number | null;
  trend_units: string;
  change_over_period: number;
  change_over_period_units: string;
  /** Sen's line, for drawing. */
  trend_line: { slope_per_year: number; intercept: number };
  /** 95% confidence range of Sen's slope, per decade. */
  range_per_decade: [number, number];
  p_value: number;
  /** Lag-1 autocorrelation of the detrended values. */
  lag1: number;
  dependent: boolean;
  p_adjusted: number;
  significant: boolean;
  status: TrendStatus;
}

const cache = new Map<string, ResultRecord | undefined>();

/**
 * Analyse one variable, for one place and one record, over the chosen months.
 * Returns undefined when there is no such series or too few complete years.
 */
export function getRecord(region: RegionId, sel: Selection, dataset: DatasetId): ResultRecord | undefined {
  const id = `${region}|${sel.variable}|${dataset}|${sel.months.join(",")}`;
  if (cache.has(id)) return cache.get(id);

  let rec: ResultRecord | undefined;
  const series = findSeries(sel.variable, region, dataset);
  if (series) {
    const agg = aggregate(series.start, series.values, sel.months, series.aggregate);
    const first = agg.years[0];
    const last = agg.years[agg.years.length - 1];
    const w = agg.years.length ? analyzeWindow(agg.years, agg.values, first, last) : null;
    if (w) {
      const mean = agg.values.reduce((a, b) => a + b, 0) / agg.values.length;
      const change = (w.trendPerDecade / 10) * (last - first);
      const per = sel.months.length === 12 ? "year" : "season";
      rec = {
        id,
        region: series.region,
        region_id: series.region_id,
        dataset: series.dataset_name,
        dataset_id: series.dataset,
        variable: sel.key,
        variable_label: sel.label,
        units: series.aggregate === "sum" ? `${series.units} per ${per}` : series.units,
        source: series.source,
        years: agg.labels,
        year_numeric: agg.years,
        values: agg.values,
        mean,
        monthly_climatology: climatology(series.start, series.values),
        trend_per_decade: w.trendPerDecade,
        trend_percent_per_decade: series.percent ? w.trendPercentPerDecade : null,
        trend_units: `${series.units} per decade`,
        change_over_period: series.percent ? (change / mean) * 100 : change,
        change_over_period_units: series.percent ? "% of average" : series.units,
        trend_line: { slope_per_year: w.line.slope, intercept: w.line.intercept },
        range_per_decade: w.rangePerDecade,
        p_value: w.pValue,
        lag1: w.lag1,
        dependent: w.dependent,
        p_adjusted: w.pAdjusted,
        significant: w.status === "significant",
        status: w.status,
      };
    }
  }
  cache.set(id, rec);
  return rec;
}
