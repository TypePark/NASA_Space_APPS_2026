import type { CardId, TourTarget } from "./content";
import type { Settings, View } from "./model";

/** What the tour can see: the current result, the open card and the screen. */
export interface TourContext {
  view: View;
  card: CardId;
  screen: string;
}

export interface TourStep {
  /** Heading shown above the step. */
  part: string;
  /** Which part of the Explorer to highlight. */
  target?: TourTarget;
  /** Screen shown when the step opens. Defaults to the Explorer. */
  screen?: "explore" | "case" | "method" | "map3d";
  /** Settings applied when the step opens, so every step starts from a known place. */
  settings: Partial<Settings>;
  /** Card shown when the step opens. */
  card?: CardId;
  /** What the step says. For a task, this is the instruction. */
  text: (c: TourContext) => string;
  /** A "your turn" step: the visitor does something, and the tour explains the result. */
  task?: {
    done: (c: TourContext) => boolean;
    after: (c: TourContext) => string;
  };
}

const PART_1 = "Part 1 of 3 · Reading a result";
const PART_2 = "Part 2 of 3 · Asking your own question";
const PART_3 = "Part 3 of 3 · Closing the case";

// Starting points. Every step names its own, so Back and Next always land in the same place.
const ISLAND_RAIN: Partial<Settings> = { region: "cyprus_whole", variable: "annual_total", custom: null, dataset: "imerg", periodMode: "full" };
const PAPHOS_RAIN: Partial<Settings> = { ...ISLAND_RAIN, region: "paphos" };
const PAPHOS_DRY: Partial<Settings> = { ...PAPHOS_RAIN, variable: "dry_season_total" };
const PAPHOS_SUMMER: Partial<Settings> = { ...PAPHOS_RAIN, custom: { variable: "rainfall", months: [6, 7, 8] } };
const SUMMER_HEAT: Partial<Settings> = { ...ISLAND_RAIN, variable: "summer_mean_temperature", dataset: "merra2" };

/** The lowest and highest values on the chart, with their years. */
function extremes(v: View) {
  const { values, years } = v.rec;
  const lo = values.indexOf(Math.min(...values));
  const hi = values.indexOf(Math.max(...values));
  const digits = v.rec.trend_percent_per_decade !== null ? 0 : 1;
  return { low: `${values[lo].toFixed(digits)} ${v.unit} in ${years[lo]}`, high: `${values[hi].toFixed(digits)} ${v.unit} in ${years[hi]}` };
}

/**
 * The guided tour. Every number and verdict it quotes is read from the
 * current result, so the tour stays correct when the data changes.
 */
export const TOUR: TourStep[] = [
  {
    part: PART_1,
    target: "headline",
    settings: ISLAND_RAIN,
    card: "series",
    text: ({ view }) =>
      `Welcome to the Explorer. Every result starts with one sentence that answers the question. For yearly rainfall across the whole island it reads: “${view.headline}”`,
  },
  {
    part: PART_1,
    target: "case",
    settings: ISLAND_RAIN,
    card: "series",
    text: ({ view }) =>
      `This chip always shows what you are looking at: the measure (${view.vdef.short}), the place (${view.region.name}) and the years (${view.periodText}).`,
  },
  {
    part: PART_1,
    target: "badges",
    settings: ISLAND_RAIN,
    card: "series",
    text: ({ view }) =>
      `Two badges sum up the answer. The first gives the direction: “${view.direction.label}”. The second says whether the change is significant, which means it is unlikely to be chance: “${view.badge.label}”. Tap a badge to read what it means.`,
  },
  {
    part: PART_1,
    target: "numbers",
    settings: ISLAND_RAIN,
    card: "series",
    text: ({ view }) =>
      `Three numbers back the badges up. The rate of change is ${view.rate} per decade, and its likely range is ${view.sure.range}. The p-value is ${view.pDisplay}. ` +
      (view.rec.significant
        ? "That is below 0.05, so the trend counts as significant."
        : "That is not below 0.05, so the trend does not count as significant. This does not prove that nothing is changing."),
  },
  {
    part: PART_1,
    target: "deck",
    settings: ISLAND_RAIN,
    card: "series",
    text: ({ view }) => {
      const x = extremes(view);
      return `Each dot is one ${view.perWord}. The lowest was ${x.low} and the highest was ${x.high}. The orange line is the trend and the dashed line is the average. Move over the chart, or tap it, to read any ${view.perWord}.`;
    },
  },
  {
    part: PART_1,
    target: "deck",
    settings: ISLAND_RAIN,
    card: "series",
    text: () => "Your turn. Press the arrow on the card to open the next card.",
    task: {
      done: ({ card }) => card === "sure",
      after: ({ view }) => `This card asks how far to trust the rate. ${view.sure.rangeNote} ${view.sure.depend}`,
    },
  },
  {
    part: PART_1,
    target: "deck",
    settings: ISLAND_RAIN,
    card: "compare",
    text: ({ view }) => `This card puts every variable side by side, for the same place and the same months. ${view.compare.note}`,
  },
  {
    part: PART_1,
    target: "deck",
    settings: ISLAND_RAIN,
    card: "years",
    text: ({ view }) =>
      `This card repeats the test with only the latest 15 ${view.perWord}s, then 16, and so on up to the full record. ${view.moreYears.caption}`,
  },
  {
    part: PART_1,
    target: "where",
    settings: ISLAND_RAIN,
    card: "series",
    text: ({ view }) =>
      `This panel answers “where?”. The map and the bars show the change in each area, and the icon on the right shows which areas are significant. ${view.where?.intro ?? ""}`,
  },
  {
    part: PART_2,
    target: "adjust",
    settings: ISLAND_RAIN,
    card: "series",
    text: () => "Your turn. Press Adjust, at the top right, and choose Paphos under Place.",
    task: {
      done: ({ view }) => view.region.id === "paphos",
      after: ({ view }) => `Everything now describes Paphos. ${view.headline}`,
    },
  },
  {
    part: PART_2,
    target: "adjust",
    settings: PAPHOS_RAIN,
    card: "series",
    text: () => "Now change the question. In Adjust, choose “Dry-season rainfall”.",
    task: {
      done: ({ view }) => view.vdef.id === "dry_season_total",
      after: ({ view }) => [view.headline, ...view.cautions].join(" "),
    },
  },
  {
    part: PART_2,
    target: "adjust",
    settings: PAPHOS_DRY,
    card: "series",
    text: () => "Now ask a question of your own. In Adjust, press “More options”, then choose “Summer · Jun–Aug”.",
    task: {
      done: ({ view }) => view.base.id === "rainfall" && view.vdef.months.join() === "6,7,8",
      after: ({ view }) =>
        `${view.headline} You can tap single months to build any season, and choose the years as well. Each choice is tested on the spot.`,
    },
  },
  {
    part: PART_2,
    target: "deck",
    settings: PAPHOS_SUMMER,
    card: "compare",
    text: () => "Compare the variables. On this card, choose “Air temperature”.",
    task: {
      done: ({ view }) => view.base.id === "temperature",
      after: ({ view }) =>
        `${view.headline}` + (view.region.id === "cyprus_whole" ? " Temperature is measured for the whole island only, so the place changed too." : ""),
    },
  },
  {
    part: PART_3,
    target: "verdict",
    settings: SUMMER_HEAT,
    card: "series",
    text: () => "Press “Close the case: see the verdict”, below the cards.",
    task: {
      done: ({ screen }) => screen === "case",
      after: () => "The case file answers the questions of the challenge in plain words: what is changing, where, how much, and whether it is significant.",
    },
  },
  {
    part: PART_3,
    screen: "map3d",
    settings: SUMMER_HEAT,
    text: () =>
      "This is Cyprus in 3D: the shape of the land, with the average yearly rainfall from NASA GPM IMERG laid over it. Drag to turn the map and scroll to zoom. The panel on the map switches its layers on and off.",
  },
  {
    part: PART_3,
    screen: "method",
    settings: SUMMER_HEAT,
    text: () =>
      "Data & Method lists every NASA dataset, the formulas and all the results, so anyone can check the work. In the Explorer, any underlined word opens the glossary.",
  },
  {
    part: PART_3,
    target: "adjust",
    settings: ISLAND_RAIN,
    card: "series",
    text: () =>
      "That is the tour. Now explore on your own: every variable, place, choice of months and range of years gives a real result from NASA data.",
  },
];
