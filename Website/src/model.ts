import { BASE_VARS, DATASET_ROLE, MONTHS_LONG, MONTHS_SHORT, REGIONS, VARS } from "./content";
import type { BaseVariable, CardId, IconName, RegionDef, VariableDef } from "./content";
import { getRecord } from "./data/records";
import type { DatasetId, RegionId, ResultRecord, Selection, VariableId } from "./data/records";
import { SERIES, datasetsFor, findSeries, regionalDataset, regionsFor, yearsOf } from "./data/series";
import { isRun } from "./lib/aggregate";
import { analyzeWindow, pValueByLength } from "./lib/trendStats";
import type { TrendStatus } from "./lib/trendStats";

/** What the user has chosen. */
export interface Settings {
  region: RegionId;
  /** One of the five ready-made questions. */
  variable: VariableId;
  /** A variable and months chosen in the detailed view. When set, it replaces `variable`. */
  custom: { variable: string; months: number[] } | null;
  dataset: DatasetId;
  periodMode: "full" | "explore";
  startYear: number;
  endYear: number;
}

export const DEFAULT_SETTINGS: Settings = {
  region: "cyprus_whole",
  variable: "annual_total",
  custom: null,
  dataset: "imerg",
  periodMode: "full",
  startYear: 0,
  endYear: 9999,
};

export const MIN_YEARS = 15;

// ---------- formatting ----------

export function signed(v: number, digits: number): string {
  const s = Math.abs(v).toFixed(digits);
  return (+s === 0 ? "" : v > 0 ? "+" : "−") + s;
}

/** p-value as shown to people. */
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

/** [1,2,3] → "Jan–Mar", [3] → "March", [3,7] → "Mar, Jul", [10..3] → "Oct–Mar". */
export function monthsText(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  if (sorted.length === 12) return "Whole year";
  if (sorted.length === 1) return MONTHS_LONG[sorted[0] - 1];
  if (isRun(sorted)) {
    const set = new Set(sorted);
    const first = sorted.find((m) => !set.has(m === 1 ? 12 : m - 1))!;
    const last = sorted.find((m) => !set.has((m % 12) + 1))!;
    return `${MONTHS_SHORT[first - 1]}–${MONTHS_SHORT[last - 1]}`;
  }
  return sorted.map((m) => MONTHS_SHORT[m - 1]).join(", ");
}

// ---------- what is selected ----------

export function variableDef(id: string): VariableDef {
  return VARS.find((v) => v.id === id) ?? VARS[0];
}

export function baseVariable(id: string): BaseVariable {
  return BASE_VARS.find((b) => b.id === id) ?? BASE_VARS[0];
}

export function regionDef(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

function sameMonths(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/** The ready-made question that matches a variable and months, if there is one. */
export function presetFor(variable: string, months: number[]): VariableDef | undefined {
  return VARS.find((v) => v.base === variable && sameMonths(v.months, months));
}

/** The question being asked: a ready-made one, or one built from a custom choice. */
export function activeDef(s: Settings): VariableDef {
  if (!s.custom) return variableDef(s.variable);
  const base = baseVariable(s.custom.variable);
  const label = s.custom.months.length === 12 ? base.name : `${monthsText(s.custom.months)} ${base.noun}`;
  return {
    id: "custom",
    base: base.id,
    months: s.custom.months,
    label,
    q: `Is ${label.charAt(0).toLowerCase() + label.slice(1)} changing?`,
    def: base.def,
    icon: base.icon,
    short: label,
  };
}

function selectionOf(def: VariableDef): Selection {
  return { variable: def.base, months: def.months, key: def.id, label: def.label };
}

/** A custom choice that equals a ready-made question becomes that question. */
export function normalise(s: Settings): Settings {
  if (!s.custom) return s;
  const preset = presetFor(s.custom.variable, s.custom.months);
  return preset ? { ...s, variable: preset.id as VariableId, custom: null } : s;
}

/**
 * Apply the availability rules from the data: a place or record the variable
 * doesn't have is never used. Falls back to the whole island and to the
 * first record that exists.
 */
export function resolve(s: Settings): { region: RegionId; dataset: DatasetId } {
  const base = activeDef(s).base;
  const region = regionsFor(base).includes(s.region) ? s.region : "cyprus_whole";
  const sets = datasetsFor(base, region);
  return { region, dataset: sets.includes(s.dataset) ? s.dataset : sets[0] };
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
  /** Signed size used for the bar: percent per decade, or the rate itself. */
  amount: number;
  value: string;
  badge: Badge;
  fill: string;
}

export interface CompareRow {
  /** Variable key, e.g. "rainfall". */
  id: string;
  name: string;
  icon: IconName;
  /** True for the variable currently shown. */
  current: boolean;
  sub: string;
  value: string;
  direction: IconName;
  badge: Badge;
}

/** "a", "a and b", "a, b and c". */
function listOf(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export interface View {
  rec: ResultRecord;
  vdef: VariableDef;
  base: BaseVariable;
  /** True when the user chose their own months. */
  custom: boolean;
  region: RegionDef;
  dataset: DatasetId;
  /** Places this variable has data for. */
  places: RegionDef[];
  /** Records that exist for this variable and place. */
  datasets: { id: DatasetId; name: string; since: number }[];
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
  /** Plain warnings shown under the badges. */
  cautions: string[];
  periodText: string;
  rate: string;
  rateSub: string;
  total: string;
  pDisplay: string;
  pSub: string;
  window: ReturnType<typeof analyzeWindow>;
  windowText: string;
  moreYears: { points: { n: number; p: number }[]; caption: string };
  sure: { range: string; rangeNote: string; depend: string };
  /** Null when the variable has data for one place only. */
  where: { intro: string; caption: string; rows: RegionRow[]; scale: number } | null;
  mapFills: Record<string, string>;
  mapLabels: Record<string, string>;
  second: { rows: { name: string; sub: string; value: string; badge: Badge }[]; note: string } | null;
  /** The same place and months for every variable. */
  compare: { rows: CompareRow[]; note: string };
  rhythmText: string;
  cards: { id: CardId; title: string }[];
}

function trendFill(rec: ResultRecord): string {
  const pct = rec.trend_percent_per_decade;
  if (pct !== null && Math.abs(pct) < 1) return "var(--neutral)";
  if (rec.trend_per_decade < 0) return rec.significant ? "var(--dry-strong)" : "var(--dry)";
  return rec.significant ? "var(--wet-strong)" : "var(--wet)";
}


export function buildView(s: Settings): View {
  const vdef = activeDef(s);
  const base = baseVariable(vdef.base);
  const sel = selectionOf(vdef);
  const { region: regionId, dataset } = resolve(s);
  const fallback = getRecord("cyprus_whole", selectionOf(VARS[0]), "imerg")!;
  const rec = getRecord(regionId, sel, dataset) ?? fallback;
  const region = regionDef(rec.region_id);
  const unit = unitOf(rec);
  const digits = rateDigits(rec);
  const perWord = vdef.months.length === 12 ? "year" : "season";
  const years = rec.year_numeric;
  const x0 = years[0];
  const x1 = years[years.length - 1];

  const places = REGIONS.filter((r) => regionsFor(base.id).includes(r.id));
  const datasets = datasetsFor(base.id, rec.region_id).map((id) => {
    const series = findSeries(base.id, rec.region_id, id)!;
    return { id, name: series.dataset_name, since: yearsOf(series)[0] };
  });

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
  if (rec.status === "significant" && pct === null && base.id === "temperature") {
    const who =
      vdef.id === "annual_mean_temperature" ? "Cyprus has" : vdef.id === "summer_mean_temperature" ? "Summers in Cyprus have" : `${lab} in Cyprus has`;
    const verb = vdef.id === "custom" ? (falling ? "fallen" : "risen") : falling ? "cooled" : "warmed";
    headline = `${who} ${verb} by about ${Math.abs(rec.change_over_period).toFixed(1)} ${rec.change_over_period_units} since ${x0}.`;
  } else if (rec.status === "significant") {
    headline = `${lab} in ${place} has ${falling ? "decreased" : "increased"} by about ${Math.abs(rec.trend_per_decade).toFixed(pct === null ? digits : 0)} ${unit} per decade.`;
  } else if (pct !== null && Math.abs(pct) < 2) {
    headline = `${lab} in ${place} shows no significant change.`;
  } else {
    headline = `${lab} in ${place} is ${falling ? "decreasing" : "increasing"}, but the trend is not significant.`;
  }

  const cautions: string[] = [];
  if (rec.significant && rec.p_value >= 0.01)
    cautions.push(`This result is close to the line (p = ${pShow(rec.p_value)}). We tested many places and seasons, and about 1 test in 20 passes by luck, so treat this one with care.`);
  if (rec.significant && rec.dependent && rec.p_adjusted >= 0.05)
    cautions.push(`Allowing for years that depend on each other, the p-value rises to ${pShow(rec.p_adjusted)}, which is not significant.`);
  if (vdef.id === "custom" && vdef.months.length < 12)
    cautions.push("You picked these months yourself. If you keep trying different months until one shows “Significant”, that result is probably luck: about 1 try in 20 passes even when nothing is changing.");

  // chosen period, recalculated in the browser
  const window = explore ? analyzeWindow(years, rec.values, startYear, endYear, MIN_YEARS) : null;
  const windowText = window
    ? `${startYear}–${endYear} (${window.nYears} ${perWord}s): ${signed(window.trendPerDecade, digits)} ${rec.trend_units} · p = ${pShow(window.pValue)}`
    : "";

  // does a longer record change the answer?
  const points = pValueByLength(years, rec.values, MIN_YEARS).map((o) => ({ n: o.nYears, p: o.pValue }));
  const firstP = points[0].p;
  const lastP = points[points.length - 1].p;
  const maxP = Math.max(...points.map((o) => o.p));
  let caption: string;
  if (maxP < 0.05) caption = "Significant whichever length of record we use. This trend is clear.";
  else if (lastP < 0.05) caption = "Significant with the full record, but not with every shorter one. It sits close to the line.";
  else if (lastP < firstP * 0.5 && lastP < 0.2) caption = "A longer record brings it closer to significant, but it isn’t there.";
  else caption = `A longer record hasn’t brought it closer to significant. Any trend is still hidden by the swings from one ${perWord} to the next.`;

  // how sure are we?
  const [lo, hi] = rec.range_per_decade;
  const range = `${signed(lo, digits)} to ${signed(hi, digits)} ${rec.trend_units}`;
  const rangeNote =
    lo > 0 || hi < 0
      ? `The whole range is ${hi < 0 ? "below" : "above"} zero, so the direction is clear.`
      : "The range includes zero, so the data cannot tell a rise from a fall.";
  const r = signed(rec.lag1, 2).replace("+", "");
  const depend = !rec.dependent
    ? `The test needs each ${perWord} to be independent of the one before. Here they are (r = ${r}), so the p-value can be trusted.`
    : `The test needs each ${perWord} to be independent of the one before. Here a high or low ${perWord} tends to be followed by another (r = ${r}), which makes the test too confident. Allowing for that, the p-value is ${pShow(rec.p_adjusted)}: ${rec.p_adjusted < 0.05 ? "still significant" : "not significant"}.`;

  // where is it changing? (from the record that covers the most places)
  const whereSet = regionalDataset(base.id);
  const rows: RegionRow[] = [];
  const mapFills: Record<string, string> = {};
  const mapLabels: Record<string, string> = {};
  for (const rg of REGIONS) {
    const rr = whereSet ? getRecord(rg.id, sel, whereSet) : undefined;
    if (!rr) {
      if (rg.id !== "cyprus_whole") mapFills[rg.id] = whereSet ? "var(--neutral)" : "var(--warm)";
      continue;
    }
    const p = rr.trend_percent_per_decade;
    const fill = trendFill(rr);
    if (rg.id !== "cyprus_whole") {
      mapFills[rg.id] = fill;
      mapLabels[rg.id] = p !== null ? `${signed(p, 0)}%` : `${signed(rr.trend_per_decade, digits)}`;
    }
    rows.push({
      id: rg.id,
      name: rg.name,
      amount: p ?? rr.trend_per_decade,
      value: p !== null ? `${signed(p, 1)}%` : `${signed(rr.trend_per_decade, digits)} ${unit}`,
      badge: badgeFor(rr.status),
      fill,
    });
  }
  let where: View["where"] = null;
  if (whereSet && rows.length > 1) {
    const whereName = findSeries(base.id, "cyprus_whole", whereSet)?.dataset_name ?? "";
    const intro =
      dataset !== whereSet
        ? `Each area, from the ${whereName} record.`
        : rows.every((x) => x.amount < 0)
          ? `Every area is leaning ${base.down}.`
          : rows.every((x) => x.amount > 0)
            ? `Every area is leaning ${base.up}.`
            : "Areas are changing in different directions.";
    where = {
      intro,
      caption: `Change per decade, NASA ${whereName}. Bars to the left are ${base.down}, to the right ${base.up}.`,
      rows,
      scale: pct !== null ? 25 : Math.max(...rows.map((x) => Math.abs(x.amount))) * 1.25 || 1,
    };
  }

  // second opinion: every record for this place
  let second: View["second"] = null;
  if (datasets.length > 1) {
    const recs = datasets.map((d) => getRecord(rec.region_id, sel, d.id)).filter((x): x is ResultRecord => !!x);
    if (recs.length > 1) {
      const sig = recs.filter((x) => x.significant).length;
      const opposite = recs.some((x) => x.trend_per_decade < 0) && recs.some((x) => x.trend_per_decade > 0);
      const note =
        sig === recs.length
          ? "Two NASA records agree: both show a significant trend."
          : sig > 0
            ? "Two NASA records, two answers: only one of them shows a significant trend."
            : opposite
              ? "The two NASA records point in opposite directions, and neither is significant. The data cannot tell us which way this is going."
              : "Two NASA records agree: neither shows a significant trend.";
      second = {
        rows: recs.map((x) => ({
          name: `${DATASET_ROLE[x.dataset_id] ?? "Record"} (${x.dataset})`,
          sub: periodText(x),
          value: `${signed(x.trend_per_decade, 1)} ${x.trend_units}`,
          badge: badgeFor(x.status),
        })),
        note,
      };
    }
  }

  // compare variables: the same place and months for each one
  const compareRows: (CompareRow & { noun: string; falling: boolean })[] = [];
  for (const bv of BASE_VARS) {
    const rg = regionsFor(bv.id).includes(rec.region_id) ? rec.region_id : "cyprus_whole";
    const def = bv.id === base.id ? vdef : (presetFor(bv.id, vdef.months) ?? activeDef({ ...s, custom: { variable: bv.id, months: vdef.months } }));
    const r = getRecord(rg, selectionOf(def), bv.id === base.id ? dataset : datasetsFor(bv.id, rg)[0]);
    if (!r) continue;
    const rp = r.trend_percent_per_decade;
    compareRows.push({
      id: bv.id,
      name: bv.name,
      icon: bv.icon,
      current: bv.id === base.id,
      sub: `${r.region_id !== rec.region_id ? `${r.region} · ` : ""}NASA ${r.dataset}, ${periodText(r)}`,
      value: `${formatRate(r)} per decade` + (rp !== null ? ` (${signed(rp, 1)}%)` : ""),
      direction: r.trend_per_decade < 0 ? "down" : "trend",
      badge: badgeFor(r.status),
      noun: bv.noun,
      falling: r.trend_per_decade < 0,
    });
  }
  const up = compareRows.filter((x) => !x.falling).map((x) => x.noun);
  const down = compareRows.filter((x) => x.falling).map((x) => x.noun);
  const verb = (n: number) => (n === 1 ? "is" : "are");
  const sentence =
    up.length && down.length
      ? `${listOf(up)} ${verb(up.length)} rising while ${listOf(down)} ${verb(down.length)} falling.`
      : `${listOf(up.length ? up : down)} ${verb(compareRows.length)} all ${up.length ? "rising" : "falling"}.`;
  const compare: View["compare"] = {
    rows: compareRows,
    note: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} Check each badge: a direction only counts as a trend when it is significant.`,
  };

  // yearly rhythm: read the highest and lowest months from the data
  const clim = rec.monthly_climatology;
  const hiMonth = MONTHS_LONG[clim.indexOf(Math.max(...clim))];
  const loMonth = MONTHS_LONG[clim.indexOf(Math.min(...clim))];
  const rhythmText = `${base.name} is usually highest in ${hiMonth} and lowest in ${loMonth}. Comparing the same months each year keeps this regular rhythm from hiding a trend.`;

  const cards: View["cards"] = [
    { id: "series", title: rec.variable_label },
    { id: "sure", title: "How sure are we?" },
    { id: "compare", title: "Compare variables" },
    { id: "years", title: "Does a longer record change the answer?" },
    { id: "rhythm", title: "The yearly rhythm" },
  ];
  if (second) cards.push({ id: "second", title: "Second opinion: two NASA records" });

  return {
    rec,
    vdef,
    base,
    custom: vdef.id === "custom",
    region,
    dataset,
    places,
    datasets,
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
    cautions,
    periodText: periodText(rec),
    rate: formatRate(rec),
    rateSub: hasPercent(rec) ? `${signed(rec.trend_percent_per_decade, 1)}% of the average` : "",
    total: formatChange(rec, hasPercent(rec) ? 0 : 1),
    pDisplay: pShow(rec.p_value),
    pSub: rec.significant ? "below 0.05" : "0.05 or above",
    window,
    windowText,
    moreYears: { points, caption },
    sure: { range, rangeNote, depend },
    where,
    mapFills,
    mapLabels,
    second,
    compare,
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
  if (!v.where) where = "The whole island.";
  else {
    const whole = v.region.id === "cyprus_whole" && v.dataset !== regionalDataset(v.base.id);
    const areas = v.where.rows.filter((r) => r.id !== "cyprus_whole");
    const strongest = areas.reduce<RegionRow | null>((a, r) => (!a || Math.abs(r.amount) > Math.abs(a.amount) ? r : a), null);
    const lean = areas.every((r) => r.amount < 0)
      ? `Across Cyprus every area is leaning ${v.base.down}`
      : areas.every((r) => r.amount > 0)
        ? `Across Cyprus every area is leaning ${v.base.up}`
        : "Across Cyprus the areas are changing in different directions";
    where = whole
      ? `The whole island, over the long record from ${v.x0}.`
      : `${v.region.id === "cyprus_whole" ? "The whole island" : v.region.name}.` + (strongest ? ` ${lean}; the largest change is in ${strongest.name} (${strongest.value} per decade).` : "");
  }

  const d = rateDigits(rec);
  const howMuch =
    `${signed(rec.trend_per_decade, d)} ${rec.trend_units}` +
    (pct !== null ? ` (${signed(pct, 1)}%)` : "") +
    `. The likely range is ${signed(rec.range_per_decade[0], d)} to ${signed(rec.range_per_decade[1], d)} ${rec.trend_units}. ` +
    `Along the trend line, that is about ${formatChange(rec, 1)} over ${v.periodText}.`;

  const p = pShow(rec.p_value);
  let significant = rec.significant
    ? `Yes. The p-value is ${p}, below 0.05.`
    : `No. The p-value is ${p}, not below 0.05. That doesn’t mean there is no trend: a longer record may be needed.`;
  if (v.cautions.length) significant += ` ${v.cautions[0]}`;

  return [
    { q: "What is changing?", text: what, icon: v.vdef.icon, tone: "plain" },
    { q: "Where?", text: where, icon: "pin", tone: "plain" },
    { q: "How much? (Sen’s slope)", text: howMuch, icon: v.direction.icon, tone: "plain" },
    { q: "Is it significant? (Mann-Kendall test)", text: significant, icon: v.badge.icon, tone: rec.status },
    { q: "How does it compare with the other variables?", text: v.compare.note, icon: "layers", tone: "plain" },
  ];
}

/** Every ready-made question, for every place and record that has data. */
export function allResultRows() {
  const rows = [];
  // The ready-made questions, plus a whole-year entry for every other variable.
  const extra = BASE_VARS.filter((bv) => !VARS.some((v) => v.base === bv.id)).map((bv) =>
    activeDef({ ...DEFAULT_SETTINGS, custom: { variable: bv.id, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } }),
  );
  for (const def of [...VARS, ...extra]) {
    for (const s of SERIES.filter((x) => x.variable === def.base)) {
      const r = getRecord(s.region_id, selectionOf(def), s.dataset);
      if (!r) continue;
      rows.push({
        id: `${def.id}|${s.id}`,
        place: r.region,
        measure: r.variable_label,
        record: r.dataset,
        trend: formatRate(r),
        range: `${signed(r.range_per_decade[0], rateDigits(r))} to ${signed(r.range_per_decade[1], rateDigits(r))}`,
        p: pShow(r.p_value),
        badge: badgeFor(r.status),
        sortKey: (s.dataset === "merra2" ? "0" : s.dataset === "imerg" ? "1" : "2") + s.region_id + def.id,
      });
    }
  }
  return rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
}

/** The record behind one ready-made question (used by the tests). */
export function presetRecord(region: RegionId, variable: VariableId, dataset: DatasetId): ResultRecord | undefined {
  return getRecord(region, selectionOf(variableDef(variable)), dataset);
}

// ---------- facts read from the data, for wording ----------

function spread(values: number[]): { mean: number; sd: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
  return { mean, sd };
}

const MONTH_ABBR = MONTHS_SHORT;

/** "Jan 1998 – Sep 2025" for one variable in one record, read from its series. */
export function coverage(variable: string, dataset: string): string {
  const all = SERIES.filter((x) => x.variable === variable && x.dataset === dataset);
  if (!all.length) return "";
  const first = Math.min(...all.map((x) => x.start[0] * 12 + x.start[1] - 1));
  const last = Math.max(...all.map((x) => x.start[0] * 12 + x.start[1] - 1 + x.values.length - 1));
  const show = (m: number) => `${MONTH_ABBR[m % 12]} ${Math.floor(m / 12)}`;
  return `${show(first)} – ${show(last)}`;
}

/** The longest record in the app, in complete years. */
export function longestRecordYears(): number {
  return Math.max(...VARS.flatMap((def) => SERIES.filter((x) => x.variable === def.base).map((x) => getRecord(x.region_id, selectionOf(def), x.dataset)?.values.length ?? 0)));
}

let factCache: Record<string, string> | null = null;

/** Numbers quoted in the glossary and the limitations, all calculated from the data. */
export function facts(): Record<string, string> {
  if (factCache) return factCache;
  const yearly = (variable: string) =>
    SERIES.filter((x) => x.variable === variable)
      .map((x) => getRecord(x.region_id, { variable, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], key: "year", label: "" }, x.dataset))
      .filter((r): r is ResultRecord => !!r);
  const rain = yearly("rainfall").map((r) => {
    const { mean, sd } = spread(r.values);
    return Math.round((sd / mean) * 100);
  });
  const temp = yearly("temperature").map((r) => spread(r.values).sd);
  const lo = Math.min(...rain);
  const hi = Math.max(...rain);
  const startOf = (dataset: string) => String(Math.min(...SERIES.filter((x) => x.dataset === dataset).map((x) => x.start[0])));
  factCache = {
    rain_swing: lo === hi ? `${lo}%` : `${lo}–${hi}%`,
    temp_swing: `${Math.max(...temp).toFixed(1)} °C`,
    imerg_start: startOf("imerg"),
    merra2_start: startOf("merra2"),
    fldas_start: startOf("fldas"),
  };
  return factCache;
}

/** Replace {name} in a sentence with the matching fact. */
export function fill(text: string): string {
  const f = facts();
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => f[key] ?? whole);
}
