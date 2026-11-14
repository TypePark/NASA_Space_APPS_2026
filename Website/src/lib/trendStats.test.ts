import { describe, expect, it } from "vitest";
import stored from "../data/all_results.json";
import { getRecord } from "../data/records";
import type { DatasetId, RegionId, VariableId } from "../data/records";
import { DEFAULT_SETTINGS, buildView, facts, normalise, presetRecord } from "../model";
import { TOUR } from "../tour";
import { aggregate, seasonStart } from "./aggregate";
import { analyzeWindow, pValueByLength } from "./trendStats";

interface Stored {
  id: string;
  region_id: RegionId;
  variable: VariableId;
  years: (number | string)[];
  values: number[];
  trend_per_decade: number;
  trend_percent_per_decade: number | null;
  change_over_period: number;
  p_value: number;
  status: string;
}

// The 23 results from the Python analysis (analysis/build_results.py).
const STORED = stored as unknown as Stored[];

describe("live analysis against the stored Python results", () => {
  it("has all 23 stored results", () => {
    expect(STORED).toHaveLength(23);
  });

  it.each(STORED.map((r) => [r.id, r] as const))("%s: the browser gives the same result", (_id, r) => {
    const dataset: DatasetId = r.id.endsWith("_merra2") ? "merra2" : "imerg";
    const live = presetRecord(r.region_id, r.variable, dataset);
    expect(live).toBeDefined();
    expect(live!.status).toBe(r.status);
    expect(live!.years).toEqual(r.years.map(String));
    live!.values.forEach((v, i) => expect(v).toBeCloseTo(r.values[i], 1));
    expect(live!.trend_per_decade).toBeCloseTo(r.trend_per_decade, 1);
    expect(Math.abs(live!.p_value - r.p_value)).toBeLessThan(0.0006);
    expect(live!.change_over_period).toBeCloseTo(r.change_over_period, 0);
    if (r.trend_percent_per_decade !== null) expect(live!.trend_percent_per_decade).toBeCloseTo(r.trend_percent_per_decade, 0);
    // The likely range always contains the rate itself.
    expect(live!.range_per_decade[0]).toBeLessThanOrEqual(live!.trend_per_decade);
    expect(live!.range_per_decade[1]).toBeGreaterThanOrEqual(live!.trend_per_decade);
  });
});

describe("choosing months", () => {
  it("labels a season that crosses the New Year by the year it starts", () => {
    expect(seasonStart([10, 11, 12, 1, 2, 3])).toBe(10);
    expect(seasonStart([12, 1, 2])).toBe(12);
    expect(seasonStart([4, 5, 6])).toBeNull();
    expect(seasonStart([1, 12, 6])).toBeNull();
  });

  it("keeps only complete years and seasons", () => {
    // 14 months starting in November 2000: one complete Dec–Feb season, one complete calendar year.
    const values = Array.from({ length: 14 }, (_, i) => i + 1);
    expect(aggregate([2000, 11], values, [12, 1, 2], "sum")).toEqual({ years: [2000], labels: ["2000/01"], values: [2 + 3 + 4] });
    expect(aggregate([2000, 11], values, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "mean").years).toEqual([2001]);
  });

  it("analyses a single month for any place", () => {
    const rec = getRecord("troodos", { variable: "rainfall", months: [3], key: "custom", label: "March rainfall" }, "imerg");
    expect(rec).toBeDefined();
    expect(rec!.values.length).toBeGreaterThanOrEqual(27);
    expect(rec!.units).toBe("mm per season");
  });
});

describe("periods", () => {
  const r = presetRecord("cyprus_whole", "annual_total", "imerg")!;

  it("refuses periods shorter than 15 years", () => {
    expect(analyzeWindow(r.year_numeric, r.values, 2000, 2010)).toBeNull();
  });

  it("grows the period from 15 years to the full record", () => {
    const curve = pValueByLength(r.year_numeric, r.values);
    expect(curve[0].nYears).toBe(15);
    expect(curve[curve.length - 1].nYears).toBe(r.values.length);
  });
});

describe("guided tour", () => {
  it("every step opens in a valid state and has something to say", () => {
    TOUR.forEach((step) => {
      const view = buildView(normalise({ ...DEFAULT_SETTINGS, ...step.settings }));
      const card = step.card ?? "series";
      if (step.card) expect(view.cards.map((c) => c.id)).toContain(step.card);
      const context = { view, card, screen: step.screen ?? "explore" };
      expect(step.text(context).length).toBeGreaterThan(20);
      // A task must not already be complete when its step opens.
      if (step.task) expect(step.task.done(context)).toBe(false);
    });
  });
});

describe("facts quoted in the wording", () => {
  it("are calculated from the data", () => {
    const f = facts();
    expect(f.rain_swing).toMatch(/^\d+(–\d+)?%$/);
    expect(f.temp_swing).toMatch(/^\d\.\d °C$/);
    expect(Number(f.imerg_start)).toBeGreaterThan(1990);
  });
});
