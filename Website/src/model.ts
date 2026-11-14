import { CASES, REGIONS, VARS } from "./content";
import type { CardId, CaseId, IconName, RegionDef, VariableDef } from "./content";
import { RECORDS, datasetIdOf, findRecord } from "./data/records";
import type { DatasetId, RegionId, ResultRecord, VariableId } from "./data/records";
import { analyzeWindow, pValueByLength, statusFor } from "./lib/trendStats";
import type { TrendStatus } from "./lib/trendStats";

/** What the user has chosen. */
export interface Settings {
  region: RegionId;
  variable: VariableId;
  dataset: DatasetId;
  periodMode: "full" | "explore";
  startYear: number;
  endYear: number;
}

export const DEFAULT_SETTINGS: Settings = {
  region: "cyprus_whole",
  variable: "annual_total",
  dataset: "imerg",
  periodMode: "full",
  startYear: 0,
  endYear: 9999,
};

export const MIN_YEARS = 15;

// ---------- formatting ----------

export function signed(v: number, digits: number): string {
  const s = Math.abs(v).toFixed(digits);
  return (v > 0 ? "+" : v < 0 ? "−" : "") + s;
}

/** p-value for a recalculated period, in the same style as the stored display strings. */
export function pShow(p: number): string {
  if (p < 0.001) return "< 0.001";
  if (p >= 0.045 && p < 0.055) return p.toFixed(4);
  return p < 0.1 ? p.toFixed(3) : p.toFixed(2);
}

/** "mm per decade" → "mm". Units always come from the data. */
export function unitOf(rec: ResultRecord): string {
  return rec.trend_units.replace(/ per decade$/, "");
}

/** "% of average" → "+12%", "°C" → "+1.5 °C". */
export function formatChange(rec: ResultRecord, digits: number): string {
  const u = rec.change_over_period_units;
  return u.startsWith("%") ? `${signed(rec.change_over_period, digits)}%` : `${signed(rec.change_over_period, digits)} ${u}`;
}

export function hasPercent(rec: ResultRecord): rec is ResultRecord & { trend_percent_per_decade: number } {
  return rec.trend_percent_per_decade !== null;
}

/** Decimals used for a rate in this record's units (rainfall 1, temperature 2). */
export function rateDigits(rec: ResultRecord): number {
  return hasPercent(rec) ? 1 : 2;
}

export function formatRate(rec: ResultRecord): string {
  return `${signed(rec.trend_per_decade, rateDigits(rec))} ${unitOf(rec)}`;
}

export function periodText(rec: ResultRecord): string {
  return `${rec.years[0]} to ${rec.years[rec.years.length - 1]}`;
}

export function shortLabel(rec: ResultRecord): string {
  return rec.variable_label.replace(/ \(.*\)$/, "");
}

export function recordName(rec: ResultRecord): string {
  return `NASA ${rec.dataset}`;
}

// ---------- settings rules ----------

export function variableDef(id: VariableId): VariableDef {
  return VARS.find((v) => v.id === id) ?? VARS[0];
}

export function regionDef(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

/**
 * Apply the availability rules:
 * temperature is whole island + MERRA-2; MERRA-2 rainfall is whole island only.
 */
export function resolve(s: Settings): { region: RegionId; dataset: DatasetId; isTemp: boolean } {
  const isTemp = variableDef(s.variable).kind === "temp";
  if (isTemp) return { region: "cyprus_whole", dataset: "merra2", isTemp };
  return { region: s.region, dataset: s.region === "cyprus_whole" ? s.dataset : "imerg", isTemp };
}

export function settingsForCase(id: CaseId): Settings {
  const c = CASES[id];
  return { ...DEFAULT_SETTINGS, region: c.region, variable: c.variable, dataset: c.dataset };
}

// ---------- the view of one record ----------

export interface Badge {
  status: TrendStatus;
  label: "Significant" | "Not significant";
  icon: IconName;
}

export function badgeFor(status: TrendStatus): Badge {
  return status === "significant"
    ? { status, label: "Significant", icon: "check" }
    : { status, label: "Not significant", icon: "minus" };
}

export interface RegionRow {
  id: RegionId;
  name: string;
  percent: number;
  value: string;
  badge: Badge;
  fill: string;
}

export interface View {
  rec: ResultRecord;
  vdef: VariableDef;
  region: RegionDef;
  dataset: DatasetId;
  isTemp: boolean;
  unit: string;
  perWord: "year" | "season";
  x0: number;
  x1: number;
  explore: boolean;
  startYear: number;
  endYear: number;
  badge: Badge;
  direction: { label: string; icon: IconName };
  headline: string;
  periodText: string;
  rate: string;
  rateSub: string;
  total: string;
  pSub: string;
  window: ReturnType<typeof analyzeWindow>;
  windowText: string;
  moreYears: { points: { n: number; p: number }[]; caption: string };
  regionRows: RegionRow[];
  mapFills: Record<string, string>;
  mapLabels: Record<string, string>;
  whereIntro: string;
  second: { rows: { name: string; sub: string; value: string; badge: Badge }[]; note: string } | null;
  rhythmText: string;
  cards: { id: CardId; title: string }[];
}

function trendFill(percent: number, significant: boolean): string {
  if (Math.abs(percent) < 1) return "var(--neutral)";
  if (percent < 0) return significant ? "var(--dry-strong)" : "var(--dry)";
  return significant ? "var(--wet-strong)" : "var(--wet)";
}

export function buildView(s: Settings): View {
  const { region: regionId, dataset, isTemp } = resolve(s);
  const vdef = variableDef(s.variable);
  const rec = findRecord(regionId, vdef.id, dataset) ?? RECORDS[0];
  const region = regionDef(rec.region_id);
  const unit = unitOf(rec);
  const perWord = rec.units.includes("season") ? "season" : "year";
  const years = rec.year_numeric;
  const x0 = years[0];
  const x1 = years[years.length - 1];

  // period
  const startYear = Math.max(x0, Math.min(x1 - (MIN_YEARS - 1), s.startYear));
  const endYear = Math.min(x1, Math.max(startYear + (MIN_YEARS - 1), s.endYear));
  const explore = s.periodMode === "explore";

  // verdict for the full record
  const badge = badgeFor(rec.status);
  const place = rec.region_id === "cyprus_whole" ? "Cyprus" : region.name;
  const lab = shortLabel(rec);
  const pct = rec.trend_percent_per_decade;
  const flat = pct !== null && Math.abs(pct) < 1;
  const falling = rec.trend_per_decade < 0;
  const direction: View["direction"] = flat
    ? { label: "No clear direction", icon: "flat" }
    : falling
      ? { label: "Decreasing trend", icon: "down" }
      : { label: "Increasing trend", icon: "trend" };

  let headline: string;
  if (pct === null) {
    const who = rec.variable === "summer_mean_temperature" ? "Summers in Cyprus have warmed" : "Cyprus has warmed";
    headline = `${who} by about ${Math.abs(rec.change_over_period).toFixed(1)} ${rec.change_over_period_units} since ${x0}.`;
  } else if (rec.status === "significant") {
    headline = `${lab} in ${place} has ${falling ? "decreased" : "increased"} by about ${Math.abs(pct).toFixed(0)}% per decade.`;
  } else if (Math.abs(pct) < 2) {
    headline = `${lab} in ${place} shows no significant change.`;
  } else {
    headline = `${lab} in ${place} is ${falling ? "decreasing" : "increasing"}, but the trend is not significant.`;
  }

  // chosen period, recalculated in the browser
  const window = explore ? analyzeWindow(years, rec.values, startYear, endYear, MIN_YEARS) : null;
  const windowText = window
    ? `${startYear}–${endYear} (${window.nYears} ${perWord}s): ${signed(window.trendPerDecade, rateDigits(rec))} ${rec.trend_units} · p = ${pShow(window.pValue)}`
    : "";

  // would more years help?
  const points = pValueByLength(years, rec.values, MIN_YEARS).map((o) => ({ n: o.nYears, p: o.pValue }));
  const firstP = points[0].p;
  const lastP = points[points.length - 1].p;
  const maxP = Math.max(...points.map((o) => o.p));
  let caption: string;
  if (maxP < 0.05) caption = "Significant whichever period we use. This trend is clear.";
  else if (lastP < 0.05) caption = "Significant with the full record, but not with every shorter period. It sits close to the line.";
  else if (lastP < firstP * 0.5 && lastP < 0.2) caption = "Adding years is bringing it closer to significant, but it isn’t there.";
  else caption = `Adding years hasn’t brought it closer to significant. Any trend is still hidden by the swings from one ${perWord} to the next.`;

  // where is it changing? (rainfall, satellite record)
  const regionRows: RegionRow[] = [];
  const mapFills: Record<string, string> = {};
  const mapLabels: Record<string, string> = {};
  for (const rg of REGIONS) {
    const rr = isTemp ? undefined : findRecord(rg.id, vdef.id, "imerg");
    if (!rr || !hasPercent(rr)) {
      if (rg.id !== "cyprus_whole") mapFills[rg.id] = isTemp ? "var(--warm)" : "var(--neutral)";
      continue;
    }
    const fill = trendFill(rr.trend_percent_per_decade, rr.significant);
    if (rg.id !== "cyprus_whole") {
      mapFills[rg.id] = fill;
      mapLabels[rg.id] = `${signed(rr.trend_percent_per_decade, 0)}%`;
    }
    regionRows.push({
      id: rg.id,
      name: rg.name,
      percent: rr.trend_percent_per_decade,
      value: `${signed(rr.trend_percent_per_decade, 1)}%`,
      badge: badgeFor(rr.status),
      fill,
    });
  }
  let whereIntro = "";
  if (!isTemp) {
    if (dataset === "merra2") whereIntro = "Each area, from the satellite record.";
    else whereIntro = regionRows.every((r) => r.percent < 0) ? "Every area is leaning drier." : "Areas can change in different directions.";
  }

  // second opinion: both whole-island rainfall records
  let second: View["second"] = null;
  if (!isTemp && rec.region_id === "cyprus_whole") {
    const rows = (["imerg", "merra2"] as const)
      .map((d) => findRecord("cyprus_whole", vdef.id, d))
      .filter((r): r is ResultRecord => !!r)
      .map((r) => ({
        name: datasetIdOf(r) === "imerg" ? `Satellite record (${r.dataset})` : `Long model record (${r.dataset})`,
        sub: periodText(r),
        value: `${signed(r.trend_per_decade, 1)} ${r.trend_units}`,
        badge: badgeFor(r.status),
      }));
    if (rows.length > 1) {
      const sig = rows.filter((r) => r.badge.status === "significant").length;
      const note =
        sig === 0
          ? "Two NASA records agree: neither shows a significant trend."
          : sig === rows.length
            ? "Two NASA records agree: both show a significant trend."
            : "Two NASA records, two answers: only one of them shows a significant trend.";
      second = { rows, note };
    }
  }

  // yearly rhythm
  const clim = rec.monthly_climatology;
  const rhythmText = isTemp
    ? `Summers are about ${Math.round(Math.max(...clim) - Math.min(...clim))} ${unit} warmer than winters. Comparing yearly averages keeps that regular rhythm from hiding the trend.`
    : "Most rain falls from October to March, and summers are almost dry. Adding up whole years and seasons keeps this regular rhythm from hiding a trend.";

  const cards: View["cards"] = [
    { id: "series", title: rec.variable_label },
    { id: "years", title: "Would more years help?" },
    { id: "rhythm", title: "The yearly rhythm" },
  ];
  if (second) cards.push({ id: "second", title: "Second opinion: two NASA records" });

  return {
    rec,
    vdef,
    region,
    dataset,
    isTemp,
    unit,
    perWord,
    x0,
    x1,
    explore,
    startYear,
    endYear,
    badge,
    direction,
    headline,
    periodText: periodText(rec),
    rate: formatRate(rec),
    rateSub: hasPercent(rec) ? `${signed(rec.trend_percent_per_decade, 1)}% of the average` : "",
    total: formatChange(rec, hasPercent(rec) ? 0 : 1),
    pSub: rec.significant ? "below 0.05" : "0.05 or above",
    window,
    windowText,
    moreYears: { points, caption },
    regionRows,
    mapFills,
    mapLabels,
    whereIntro,
    second,
    rhythmText,
    cards,
  };
}

// ---------- case file ----------

export interface Answer {
  q: string;
  text: string;
  icon: IconName;
  tone: "plain" | TrendStatus;
}

export function buildAnswers(v: View): Answer[] {
  const { rec } = v;
  const lab = shortLabel(rec);
  const pct = rec.trend_percent_per_decade;
  const falling = rec.trend_per_decade < 0;

  const what =
    pct === null
      ? `${lab} is ${falling ? "falling" : "rising"}.`
      : Math.abs(pct) < 2
        ? `${lab}: no clear change.`
        : `${lab} is ${falling ? "decreasing" : "increasing"}.`;

  let where: string;
  if (v.isTemp) where = "The whole island.";
  else if (v.dataset === "merra2") where = `The whole island, over the long record from ${v.x0}.`;
  else {
    const areas = v.regionRows.filter((r) => r.id !== "cyprus_whole");
    const strongest = areas.reduce<RegionRow | null>((a, r) => (!a || Math.abs(r.percent) > Math.abs(a.percent) ? r : a), null);
    const lean = areas.every((r) => r.percent < 0)
      ? "Across Cyprus every area is leaning drier"
      : areas.every((r) => r.percent > 0)
        ? "Across Cyprus every area is leaning wetter"
        : "Across Cyprus the areas are changing in different directions";
    where = `${v.region.name}.` + (strongest ? ` ${lean}; the largest change is in ${strongest.name} (${strongest.value} per decade).` : "");
  }

  const howMuch =
    `${signed(rec.trend_per_decade, rateDigits(rec))} ${rec.trend_units}` +
    (pct !== null ? ` (${signed(pct, 1)}%)` : "") +
    `, about ${formatChange(rec, 1)} over ${v.periodText}.`;

  const significant = rec.significant
    ? `Yes. The p-value is ${rec.p_value_display}, below 0.05.`
    : `No. The p-value is ${rec.p_value_display}, not below 0.05. That doesn’t mean there is no trend: a longer record may be needed.`;

  return [
    { q: "What is changing?", text: what, icon: v.vdef.icon, tone: "plain" },
    { q: "Where?", text: where, icon: "pin", tone: "plain" },
    { q: "How much? (Sen’s slope)", text: howMuch, icon: v.direction.icon, tone: "plain" },
    { q: "Is it significant? (Mann-Kendall test)", text: significant, icon: v.badge.icon, tone: rec.status },
  ];
}

/** All 23 results for the Data & Method table: MERRA-2 first, then by place and measure. */
export function allResultRows() {
  return RECORDS.map((r) => ({
    id: r.id,
    place: r.region,
    measure: r.variable_label,
    record: r.dataset,
    trend: formatRate(r),
    p: r.p_value_display,
    badge: badgeFor(r.status),
    sortKey: (datasetIdOf(r) === "merra2" ? "0" : "1") + r.region_id + r.variable,
  })).sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
}

export { statusFor };
