import type { RegionId } from "./data/records";

/** Line icons (SVG path data, 24 × 24 viewBox). */
export const ICON = {
  drop: 'M12 3c3.5 4.2 6 7.3 6 10.5a6 6 0 0 1-12 0C6 10.3 8.5 7.2 12 3Z',
  check: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0ZM8 12.2l2.8 2.8L16 9.5',
  search: 'M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14ZM20.5 20.5l-4.5-4.5',
  hourglass: 'M7 3h10M7 21h10M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  arrowL: 'M19 12H5M11 6l-6 6 6 6',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 23H20',
  play: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0ZM10 8.5v7l6-3.5-6-3.5Z',
  rain: 'M7 15a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 18 8.5a3.5 3.5 0 0 1-1 6.5H7ZM8 18l-1 3M12 18l-1 3M16 18l-1 3',
  sun: 'M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  thermo: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0ZM12 17.5v-7',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21ZM12 7.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4Z',
  calendar: 'M4 6h16v15H4ZM4 10h16M8 3v4M16 3v4',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  x: 'M6 6l12 12M18 6L6 18',
  info: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0ZM12 11v5.5M12 7.8v.4',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  layers: 'M12 3l9 5-9 5-9-5 9-5ZM3 13l9 5 9-5',
  file: 'M14 3H6v18h12V7l-4-4ZM14 3v4h4M9 12h6M9 16h6',
  chevron: 'M6 9l6 6 6-6',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  minus: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0ZM8 12h8',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  sound: 'M4 10v4h3l5 4V6L7 10H4ZM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mute: 'M4 10v4h3l5 4V6L7 10H4ZM16.5 9.5l5 5M21.5 9.5l-5 5',
  pause: 'M8 5v14M16 5v14',
  down: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  flat: 'M4 12h16M15 7l5 5-5 5'
} as const;

export type IconName = keyof typeof ICON;

/** One of the five ready-made questions: a variable plus the months to use. */
export interface VariableDef {
  id: string;
  /** Variable key in the data, e.g. "rainfall". */
  base: string;
  /** Months 1–12. */
  months: number[];
  /** Name of the measure, e.g. "Annual rainfall". */
  label: string;
  q: string;
  def: string;
  icon: IconName;
  short: string;
}

/** A variable the user can choose in the detailed view. */
export interface BaseVariable {
  id: string;
  group: string;
  name: string;
  /** Used in sentences: "March rainfall". */
  noun: string;
  def: string;
  icon: IconName;
  /** Words for a falling and a rising value across places. */
  down: string;
  up: string;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  hint: string;
}

export type TourTarget = "case" | "headline" | "badges" | "numbers" | "deck" | "where" | "adjust" | "verdict";
export type CardId = "series" | "sure" | "compare" | "years" | "rhythm" | "second";


export interface GlossaryEntry {
  id: string;
  term: string;
  /** The short answer. */
  text: string;
  /** How it works, for readers who want the real meaning. */
  more: string;
}

/** The five questions users can ask. */
const YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WET = [10, 11, 12, 1, 2, 3];
const DRY = [4, 5, 6, 7, 8, 9];
const SUMMER = [6, 7, 8];

export const VARS: VariableDef[] = [
  { id: "annual_total", base: "rainfall", months: YEAR, label: "Annual rainfall", q: "Is it getting drier overall?", def: "Yearly rainfall: all the rain in a year, added up.", icon: "drop", short: "Yearly rainfall" },
  { id: "wet_season_total", base: "rainfall", months: WET, label: "Wet-season rainfall (Oct–Mar)", q: "Is the rainy season changing?", def: "Rain from October to March, the months that refill reservoirs.", icon: "rain", short: "Wet-season rainfall" },
  { id: "dry_season_total", base: "rainfall", months: DRY, label: "Dry-season rainfall (Apr–Sep)", q: "Is spring and summer rain changing?", def: "Rain from April to September, small amounts that matter for crops.", icon: "sun", short: "Dry-season rainfall" },
  { id: "annual_evapotranspiration", base: "evapotranspiration", months: YEAR, label: "Annual evapotranspiration", q: "Is the land giving more water back to the air?", def: "Evapotranspiration: the water that soil and plants return to the air, over a whole year.", icon: "layers", short: "Evapotranspiration" },
  { id: "annual_mean_temperature", base: "temperature", months: YEAR, label: "Average air temperature", q: "Is it getting hotter?", def: "The average air temperature over a whole year.", icon: "thermo", short: "Average temperature" },
  { id: "summer_mean_temperature", base: "temperature", months: SUMMER, label: "Summer air temperature (Jun–Aug)", q: "Are summers getting hotter?", def: "The average air temperature in June, July and August.", icon: "sun", short: "Summer temperature" },
];

/** The variables offered in the detailed view. Add an entry here when new data is added. */
export const BASE_VARS: BaseVariable[] = [
  { id: "rainfall", group: "Water", name: "Rainfall", noun: "rainfall", def: "How much rain falls, added up over the months you choose.", icon: "drop", down: "drier", up: "wetter" },
  { id: "evapotranspiration", group: "Water", name: "Evapotranspiration", noun: "evapotranspiration", def: "Water that returns to the air from soil and plants, added up over the months you choose.", icon: "layers", down: "lower", up: "higher" },
  { id: "temperature", group: "Heat", name: "Air temperature", noun: "air temperature", def: "How warm the air is 2 metres above the ground, averaged over the months you choose.", icon: "thermo", down: "cooler", up: "warmer" },
];

/** Quick choices of months in the detailed view. */
export const MONTH_SETS: { id: string; label: string; months: number[] }[] = [
  { id: "year", label: "Whole year", months: YEAR },
  { id: "wet", label: "Wet season · Oct–Mar", months: WET },
  { id: "dry", label: "Dry season · Apr–Sep", months: DRY },
  { id: "summer", label: "Summer · Jun–Aug", months: SUMMER },
];

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** What each NASA record is, in a few words. */
export const DATASET_ROLE: Record<string, string> = {
  imerg: "Satellite record",
  merra2: "Long model record",
  fldas: "Land model record",
};

/** The six places, with a one-line reason to look at each. */
export const REGIONS: RegionDef[] = [
  { id: "cyprus_whole", name: "Whole island", hint: "The big picture: all of Cyprus averaged together. A good place to start." },
  { id: "troodos", name: "Troodos", hint: "The mountains in the middle of the island, where the rivers that fill the dams begin." },
  { id: "nicosia", name: "Nicosia / Lefkoşa", hint: "The capital, on the inland plain between the two mountain ranges." },
  { id: "limassol", name: "Limassol", hint: "The south coast below the Troodos mountains, around the island’s main port." },
  { id: "larnaca", name: "Larnaca", hint: "The south-east coast, around the salt lake and the international airport." },
  { id: "paphos", name: "Paphos", hint: "The west coast, facing the open sea." },
];


export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "rainfall",
    term: "Rainfall (mm)",
    text: "How deep the rain would be if it all stayed where it fell. 10 mm of rain on one square metre is 10 litres of water.",
    more: "We show totals: all the rain in a year or a season, averaged over an area. Satellites estimate rain from above and do not collect it in a gauge, so the amounts tend to be too low over mountains. How rainfall changes over time is more reliable than the exact amount.",
  },
  {
    id: "temperature",
    term: "Air temperature (°C)",
    text: "How warm the air is 2 metres above the ground, averaged over the island.",
    more: "It comes from NASA’s MERRA-2 model, whose grid is too coarse to separate the five areas, so we show the whole island only. A yearly value is the average of the twelve months. A summer value is the average of June, July and August.",
  },
  {
    id: "evapotranspiration",
    term: "Evapotranspiration (mm)",
    text: "Water that goes back into the air: evaporation from soil and water, plus the water plants release through their leaves.",
    more: "It is measured in millimetres, like rainfall, so the two can be compared: rain is water arriving, evapotranspiration is water leaving. In a dry climate it is limited by how much water the soil holds, so it tends to rise after wet winters and fall in dry years. Our values come from NASA’s FLDAS land model, which calculates them from rainfall, temperature, sunshine and soil.",
  },
  {
    id: "area_average",
    term: "Area average",
    text: "One value for a whole area: the average of every grid cell inside it.",
    more: "The whole island uses the outline of Cyprus. The five areas are rectangles drawn around each place, so the coastal ones include some sea. Averaging hides differences inside an area, such as a wet mountain next to a dry plain.",
  },
  {
    id: "trend",
    term: "Trend",
    text: "A steady change in one direction over many years, such as rising temperature.",
    more: "We look for values that tend to go up, or tend to go down, across the whole record. It does not have to be a perfect straight line. A few unusual years are not a trend, and a trend in the past is not a forecast of the future.",
  },
  {
    id: "sens_slope",
    term: "Sen’s slope",
    text: "How fast something changes. We take the slope between every pair of years and use the middle value, so one extreme year can’t pull the answer around.",
    more: "Example: 27 years make 351 pairs of years. For each pair we divide the change in value by the number of years between them. We sort those 351 slopes and take the middle one. Multiplied by 10, it is the change per decade. An ordinary straight-line fit can be dragged up or down by one very wet or very dry year; the middle value cannot. Named after the statistician Pranab Kumar Sen (1968).",
  },
  {
    id: "percent_per_decade",
    term: "Percent per decade",
    text: "The change per decade divided by that place’s average. It lets us compare wet places with dry ones.",
    more: "A loss of 15 mm per decade is small where 500 mm falls in a year, and large where only 75 mm falls in a season. Be careful with big percentages of small amounts: dry-season rain is a small part of the year’s total.",
  },
  {
    id: "trend_line",
    term: "Trend line on the chart",
    text: "A straight line through the yearly values, drawn to guide the eye.",
    more: "The line uses Sen’s slope, the same rate of change shown in the numbers, and is placed so that half the points lie above it and half below.",
  },
  {
    id: "range",
    term: "Likely range",
    text: "The rate of change is an estimate. The likely range shows how far the true rate could reasonably be from it.",
    more: "It is a 95% confidence range for Sen’s slope: if we could repeat the measurement many times, about 95 in 100 such ranges would contain the true rate. A narrow range means the data pin the rate down well. If the range includes zero, the data cannot tell a rise from a fall.",
  },
  {
    id: "dependence",
    term: "Year-to-year dependence",
    text: "When a warm or wet year tends to be followed by another one. It can make a trend look more certain than it is.",
    more: "The Mann-Kendall test assumes each year is independent of the year before. We check this by removing the trend and measuring how closely each year follows the last (the lag-1 autocorrelation). If the link is too strong to be chance, we recalculate the p-value with a wider margin and show both.",
  },
  {
    id: "mann_kendall",
    term: "Mann-Kendall test",
    text: "A standard test for trends. It checks whether values go up or down over the years more often than chance would explain, and gives the p-value.",
    more: "It compares every year with every later year and counts how often the value went up and how often it went down. If nothing is changing, ups and downs roughly cancel. A large surplus of one over the other is unlikely to happen by chance, and the test turns the size of that surplus into a p-value. It uses only the order of the values, not their size, so extreme years do not distort it. It assumes that one year does not depend strongly on the year before.",
  },
  {
    id: "p_value",
    term: "p-value",
    text: "How likely it is to see a trend this strong by chance if nothing were really changing. Smaller means stronger evidence.",
    more: "It is a number between 0 and 1. A p-value of 0.03 means: if there were no real trend, the usual swings from year to year would produce a trend at least this strong about 3 times in 100. It is not the chance that the trend is real, and it says nothing about how big the change is. A small change can have a tiny p-value when the data are steady. A big change can have a large p-value when the data swing a lot.",
  },
  {
    id: "significant",
    term: "Significant",
    text: "The p-value is below 0.05, so the trend meets the scientific standard for significance.",
    more: "The 0.05 line is a convention: we accept a 1 in 20 risk of calling a trend real when it is only chance. Significant does not mean large or important. It means unlikely to be an accident. This tool tests many places and seasons, and when many tests are run a few can pass by luck, so treat a result just below 0.05 with care.",
  },
  {
    id: "not_significant",
    term: "Not significant",
    text: "The p-value is 0.05 or more, so the trend does not meet the standard. That doesn’t mean there is no trend, or that it isn’t important: sometimes a longer record is all that’s needed.",
    more: "There are three possible reasons: nothing is changing; something is changing, but slowly compared with the swings from year to year; or the record is too short to tell. The “Does a longer record change the answer?” card shows what happens as the record gets longer.",
  },
  {
    id: "variability",
    term: "Year-to-year variability",
    text: "How much a value usually swings from one year to the next. Big swings can hide a slow trend.",
    more: "Yearly rainfall in Cyprus swings by about {rain_swing} of its average. Yearly temperature swings by about {temp_swing}. This is why warming shows up clearly, while a rainfall change of a few percent per decade is hard to prove.",
  },
  {
    id: "wet_season",
    term: "Wet and dry seasons",
    text: "In Cyprus most rain falls from October to March (wet season). April to September is the dry season.",
    more: "A wet season runs across the New Year, so it is labelled with both years: a season labelled 1998/99 runs from October 1998 to March 1999. We only count complete seasons. Wet-season rain refills reservoirs and groundwater. Dry-season rain is small, but it matters for crops and fire risk.",
  },
  {
    id: "seasonal_cycle",
    term: "Seasonal cycle",
    text: "The regular pattern every year: wet, mild winters and dry, hot summers. We add up whole years or seasons so this rhythm doesn’t hide a trend.",
    more: "If we tested the monthly values directly, the large difference between winter and summer would drown out any slow change. Adding up a whole year, or comparing the same season in each year, removes it.",
  },
  {
    id: "records",
    term: "Satellite record vs model record",
    text: "GPM IMERG measures rain from satellites since {imerg_start}, in detail. MERRA-2 and FLDAS are NASA models that combine many observations, back to {merra2_start} and {fldas_start}.",
    more: "IMERG and FLDAS have a grid of about 10 km, fine enough to separate the five areas. MERRA-2 has a grid of about 50 km, so we use it for the whole island only. A model record is consistent over a long time, but it is not a direct measurement. When two records give the same answer, as on the “Second opinion” card, we can trust it more.",
  },
];

/** "Next lead" on the case file: which variable to look at next, and why. */
export const NEXT_LEADS: Record<string, { text: string; button: string }> = {
  rainfall: { text: "Is rainfall changing too?", button: "Check rainfall" },
  evapotranspiration: { text: "Rain is only half of the water story. How much water goes back into the air?", button: "Check evapotranspiration" },
  temperature: { text: "Heat drives how fast the land dries. Is it getting hotter?", button: "Check temperature" },
};

export const HOW_STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "search", title: "Ask", text: "Choose a question, like “Is it getting hotter?”" },
  { icon: "pin", title: "Look", text: "Pick a place and see decades of NASA data." },
  { icon: "check", title: "Decide", text: "Find out whether the change is real." },
];

/**
 * The datasets behind the app. Rows with `variable` and `dataset` get their
 * period from the data itself.
 */
export const DATASETS: { name: string; what: string; detail: string; variable?: string; dataset?: string; period?: string }[] = [
  { name: "GPM IMERG V07", variable: "rainfall", dataset: "imerg", what: "Rainfall from satellites (Final Run, monthly)", detail: "About 10 km grid. Used for the five areas and the whole island. Its long-term average is the rainfall layer on the 3D map." },
  { name: "MERRA-2", variable: "rainfall", dataset: "merra2", what: "Rainfall (bias-corrected) from NASA’s reanalysis model", detail: "About 50 km grid. Whole island only. Used as a long record and a second opinion." },
  { name: "FLDAS Noah", variable: "evapotranspiration", dataset: "fldas", what: "Evapotranspiration from NASA’s land surface model", detail: "About 10 km grid. Used for the five areas and the whole island." },
  { name: "MERRA-2", variable: "temperature", dataset: "merra2", what: "Air temperature 2 m above the ground", detail: "About 50 km grid. Whole island only." },
  { name: "NISAR DEM v1.2", what: "Terrain height for the 3D map", period: "Copernicus GLO-30, 2011–2015", detail: "About 30 m. Modified Copernicus DEM, adapted by NASA/JPL for NISAR." },
];

export const METHOD_STEPS = [
  { title: "1 · Add up whole years and seasons", text: "Monthly values become one value per year or per season. Rainfall and evapotranspiration are added up. Temperature is averaged. This removes the regular seasonal cycle." },
  { title: "2 · Measure the rate of change", text: "Sen’s slope: the middle value of the slopes between every pair of years, so one extreme year cannot distort it. The line on the chart uses the same slope. We also give its likely range (95% confidence)." },
  { title: "3 · Test whether it’s real", text: "The Mann-Kendall test asks whether values go up or down more often than chance allows. Below p = 0.05 we call the trend significant." },
  { title: "4 · Apply the standard", text: "p below 0.05 is a significant trend. p of 0.05 or more does not meet the standard, which doesn’t mean there is no trend: a longer record may be needed." },
  { title: "5 · Check the assumptions", text: "The test assumes each year is independent. We measure how closely one year follows the last and, where the link is strong, recalculate the p-value with a wider margin (Yue & Wang, 2004)." },
  { title: "6 · Be careful with many tests", text: "Every combination of place, months and years is a new test. About 1 in 20 passes by chance, so a result just below 0.05 is weak evidence on its own." },
];

/** Words in {braces} are filled in from the data when shown. */
export const LIMITS = [
  "Yearly rainfall in Cyprus swings by about {rain_swing} of its average from one year to the next, so small trends are hard to detect.",
  "Satellites tend to underestimate rain over mountains such as the Troodos, so we focus on change, not exact amounts.",
  "Each area is a rectangle averaged as a whole. The coastal rectangles include some sea.",
  "MERRA-2 has a grid of about 50 km, so temperature is shown for the whole island only.",
  "Evapotranspiration comes from a land model (FLDAS), not from a direct measurement.",
  "The satellite rainfall record starts in {imerg_start}. Its years before 2014 come from the earlier TRMM mission and its partner satellites.",
];

export const STUDY_AREA = "Study area: 34.41917° N, 32.15293° E (south-west) to 35.7758° N, 34.73326° E (north-east).";

/** References for Data & Method. DOIs are turned into links when shown. */
export const REFERENCES = [
  "Huffman, G. J., Stocker, E. F., Bolvin, D. T., Nelkin, E. J., & Tan, J. (2023). GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07 (GPM_3IMERGM) [Data set]. NASA Goddard Earth Sciences Data and Information Services Center (GES DISC). Accessed November 14, 2026. https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07",
  "Huffman, G. J., Stocker, E. F., Bolvin, D. T., Nelkin, E. J., Tan, J., & Savtchenko, A. (Ed.). (2023). GPM IMERG Final Precipitation L3 1 day 0.1 degree x 0.1 degree V07 (GPM_3IMERGDF) [Data set]. NASA Goddard Earth Sciences Data and Information Services Center (GES DISC). Accessed November 14, 2026. https://doi.org/10.5067/GPM/IMERGDF/DAY/07",
  "Global Modeling and Assimilation Office (GMAO). (2015). MERRA-2 tavgM_2d_flx_Nx: 2d, Monthly mean, Time-Averaged, Single-Level, Assimilation, Surface Flux Diagnostics V5.12.4 (M2TMNXFLX) [Data set]. NASA Goddard Earth Sciences Data and Information Services Center (GES DISC). Accessed November 14, 2026. https://doi.org/10.5067/0JRLVL8YV2Y4",
  "Global Modeling and Assimilation Office (GMAO). (2015). MERRA-2 tavgM_2d_slv_Nx: 2d, Monthly mean, Time-Averaged, Single-Level, Assimilation, Single-Level Diagnostics V5.12.4 (M2TMNXSLV) [Data set]. NASA Goddard Earth Sciences Data and Information Services Center (GES DISC). Accessed November 14, 2026. https://doi.org/10.5067/AP1B0BA5PD2K",
  "Gelaro, R., et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). Journal of Climate, 30(14), 5419–5454. https://doi.org/10.1175/JCLI-D-16-0758.1",
  "NASA/JPL/NISAR. (2026). Modified Copernicus Digital Elevation Models used by the NASA-ISRO Synthetic Aperture Radar (NISAR) Mission (Version 1.2) [Data set]. NASA Alaska Satellite Facility Distributed Active Archive Center (ASF DAAC). Accessed November 14, 2026. https://doi.org/10.5067/NIDEM-1 (Derived from European Space Agency Copernicus DEM, https://doi.org/10.5270/esa-c5d3d65.)",
  "Acker, J. G., & Leptoukh, G. (2007). Online analysis enhances use of NASA Earth science data. Eos, Transactions American Geophysical Union, 88(2), 14–17. https://doi.org/10.1029/2007EO020003 Time series, spatial subsetting and time-averaged maps (1998-01-01 to 2025-10-01) were produced with the NASA Giovanni online data system, developed and maintained by NASA GES DISC.",
  "Mann, H. B. (1945). Nonparametric tests against trend. Econometrica, 13(3), 245–259. https://doi.org/10.2307/1907187 See also Kendall, M. G. (1975). Rank Correlation Methods. London: Charles Griffin.",
  "Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. Journal of the American Statistical Association, 63(324), 1379–1389. https://doi.org/10.1080/01621459.1968.10480934",
  "McNally, A., & NASA/GSFC/HSL. (2018). FLDAS Noah Land Surface Model L4 Global Monthly 0.1 x 0.1 degree (MERRA-2 and CHIRPS) (FLDAS_NOAH01_C_GL_M) [Data set]. NASA Goddard Earth Sciences Data and Information Services Center (GES DISC). Accessed November 14, 2026. https://doi.org/10.5067/5NHC22T9375G",
  "Yue, S., & Wang, C. Y. (2004). The Mann-Kendall test modified by effective sample size to detect trend in serially correlated hydrological series. Water Resources Management, 18(3), 201–218. https://doi.org/10.1023/B:WARM.0000043140.61082.60",
];

export const DEM_LICENSE =
  "Contains modified Copernicus Digital Elevation Model (GLO-30) data [2011–2015], produced using Copernicus data and information funded by the European Union — EU-DEM layers, adapted by NASA/JPL for NISAR.";

export const TEAM = ["Batuhan Meriç", "Kemal Efe Demir", "Mehmet Enes Gedikoğlu", "Aishah Mabayoje"];
