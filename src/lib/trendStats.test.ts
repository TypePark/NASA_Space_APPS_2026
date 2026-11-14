import { describe, expect, it } from "vitest";
import { RECORDS } from "../data/records";
import { analyzeWindow, pValueByLength } from "./trendStats";

describe("trendStats against the stored NASA results", () => {
  it("has all 23 records", () => {
    expect(RECORDS).toHaveLength(23);
  });

  it.each(RECORDS.map((r) => [r.id, r] as const))("%s: full record matches the stored result", (_id, r) => {
    const first = r.year_numeric[0];
    const last = r.year_numeric[r.year_numeric.length - 1];
    const w = analyzeWindow(r.year_numeric, r.values, first, last);
    expect(w).not.toBeNull();
    expect(w!.status).toBe(r.status);
    expect(w!.nYears).toBe(r.values.length);
    // The stored values are rounded to 2 decimals, which can create a tie the
    // original analysis did not have, so allow a small difference in p.
    expect(Math.abs(w!.pValue - r.p_value)).toBeLessThan(0.01);
    expect(w!.trendPerDecade).toBeCloseTo(r.trend_per_decade, 1);
  });

  it("refuses periods shorter than 15 years", () => {
    const r = RECORDS[0];
    expect(analyzeWindow(r.year_numeric, r.values, 2000, 2010)).toBeNull();
  });

  it("grows the period from 15 years to the full record", () => {
    const r = RECORDS[0];
    const curve = pValueByLength(r.year_numeric, r.values);
    expect(curve[0].nYears).toBe(15);
    expect(curve[curve.length - 1].nYears).toBe(r.values.length);
  });
});
