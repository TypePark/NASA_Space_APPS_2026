/**
 * Turn a monthly series into one value per year (or per season) for the
 * months the user chose. Only complete years and seasons are kept.
 */

export interface Aggregated {
  /** Numbers for the x-axis and the statistics. */
  years: number[];
  /** Labels for people: "1998", or "1998/99" for a season that crosses the New Year. */
  labels: string[];
  values: number[];
}

export const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** True when the months form one unbroken run, allowing a run across December–January. */
export function isRun(months: number[]): boolean {
  const set = new Set(months);
  if (set.size === 12) return true;
  let ends = 0;
  for (const m of set) if (!set.has((m % 12) + 1)) ends++;
  return ends === 1;
}

/**
 * The month a season starts in, when the chosen months run across the New Year
 * (for example October to March). Otherwise null: the calendar year is used.
 */
export function seasonStart(months: number[]): number | null {
  const set = new Set(months);
  if (set.size === 12 || !set.has(12) || !set.has(1) || !isRun(months)) return null;
  for (const m of set) if (!set.has(m === 1 ? 12 : m - 1)) return m;
  return null;
}

export function aggregate(start: [number, number], values: number[], months: number[], how: "sum" | "mean"): Aggregated {
  const chosen = new Set(months);
  const first = seasonStart(months);
  const groups = new Map<number, { total: number; count: number }>();
  values.forEach((v, i) => {
    const index = start[1] - 1 + i;
    const year = start[0] + Math.floor(index / 12);
    const month = (index % 12) + 1;
    if (!chosen.has(month)) return;
    // A season that crosses the New Year is labelled by the year it starts in.
    const key = first !== null && month < first ? year - 1 : year;
    const g = groups.get(key) ?? { total: 0, count: 0 };
    g.total += v;
    g.count += 1;
    groups.set(key, g);
  });
  const years = [...groups.keys()].filter((y) => groups.get(y)!.count === chosen.size).sort((a, b) => a - b);
  return {
    years,
    labels: years.map((y) => (first !== null ? `${y}/${String((y + 1) % 100).padStart(2, "0")}` : String(y))),
    values: years.map((y) => {
      const g = groups.get(y)!;
      return how === "sum" ? g.total : g.total / g.count;
    }),
  };
}

/** Average for each calendar month (January to December), over the complete calendar years. */
export function climatology(start: [number, number], values: number[]): number[] {
  const byYear = new Map<number, number[]>();
  values.forEach((v, i) => {
    const index = start[1] - 1 + i;
    const year = start[0] + Math.floor(index / 12);
    const row = byYear.get(year) ?? [];
    row[index % 12] = v;
    byYear.set(year, row);
  });
  const full = [...byYear.values()].filter((row) => row.filter((v) => v !== undefined).length === 12);
  return ALL_MONTHS.map((m) => full.reduce((a, row) => a + row[m - 1], 0) / full.length);
}
