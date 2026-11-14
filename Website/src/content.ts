import type { DatasetId, RegionId, VariableId } from "./data/records";

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
  down: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  flat: 'M4 12h16M15 7l5 5-5 5'
} as const;

export type IconName = keyof typeof ICON;

export interface VariableDef {
  id: VariableId;
  kind: "rain" | "temp";
  q: string;
  def: string;
  icon: IconName;
  short: string;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  hint: string;
}

export type CaseId = "A" | "B";
export type DemoTarget = "case" | "headline" | "chart" | "numbers" | "deck";
export type CardId = "series" | "years" | "rhythm" | "second";

export interface CaseDef {
  label: string;
  region: RegionId;
  variable: VariableId;
  dataset: DatasetId;
  steps: { target: DemoTarget; card: CardId; text: string }[];
}

export interface GlossaryEntry {
  id: string;
  term: string;
  text: string;
}

/** The five questions users can ask. */
export const VARS: VariableDef[] = [
  { id: 'annual_total', kind: 'rain', q: 'Is it getting drier overall?', def: 'Yearly rainfall: all the rain in a year, added up.', icon: 'drop', short: 'Yearly rainfall' },
  { id: 'wet_season_total', kind: 'rain', q: 'Is the rainy season changing?', def: 'Rain from October to March, the months that refill reservoirs.', icon: 'rain', short: 'Wet-season rainfall' },
  { id: 'dry_season_total', kind: 'rain', q: 'Is spring and summer rain changing?', def: 'Rain from April to September, small amounts that matter for crops.', icon: 'sun', short: 'Dry-season rainfall' },
  { id: 'annual_mean_temperature', kind: 'temp', q: 'Is it getting hotter?', def: 'The average air temperature over a whole year.', icon: 'thermo', short: 'Average temperature' },
  { id: 'summer_mean_temperature', kind: 'temp', q: 'Are summers getting hotter?', def: 'The average air temperature in June, July and August.', icon: 'sun', short: 'Summer temperature' }
];

/** The six places, with a one-line reason to look at each. */
export const REGIONS: RegionDef[] = [
  { id: 'cyprus_whole', name: 'Whole island', hint: 'The big picture: all of Cyprus averaged together. A good place to start.' },
  { id: 'troodos', name: 'Troodos', hint: 'The mountains catch the most rain and feed the island’s dams.' },
  { id: 'nicosia', name: 'Nicosia / Lefkoşa', hint: 'The inland plain between two mountain ranges, with the island’s hottest summers.' },
  { id: 'limassol', name: 'Limassol', hint: 'The south coast below the Troodos mountains, home to Cyprus’s second-largest city.' },
  { id: 'larnaca', name: 'Larnaca', hint: 'The drier east coast, around the salt lake and the island’s main airport.' },
  { id: 'paphos', name: 'Paphos', hint: 'The west coast, the first land that winter storms reach from the sea.' }
];

/** "Watch a case": the two guided demos. */
export const CASES: Record<CaseId, CaseDef> = {
  A: { label: 'Case 1 · Is Cyprus getting drier?', region: 'cyprus_whole', variable: 'annual_total', dataset: 'imerg', steps: [
    { target: 'chart', card: 'series', text: 'Each dot is one year of rainfall from NASA’s GPM satellites. The totals swing wildly: about 275 mm in 2008, almost 790 mm in 2012.' },
    { target: 'numbers', card: 'series', text: 'The trend is slightly down, about −7 mm per decade. But the p-value is 0.77, far above 0.05: not significant.' },
    { target: 'deck', card: 'years', text: 'Would more years help? A steady trend gets closer to significant as years are added. This one doesn’t.' },
    { target: 'deck', card: 'second', text: 'A second NASA record going back to 1980 agrees: no significant trend. That doesn’t mean nothing is changing, only that it isn’t proven.' } ] },
  B: { label: 'Case 2 · Is Cyprus getting hotter?', region: 'cyprus_whole', variable: 'annual_mean_temperature', dataset: 'merra2', steps: [
    { target: 'case', card: 'series', text: 'Now temperature. The settings are filled in for us: average temperature, whole island, NASA’s MERRA-2 record from 1980.' },
    { target: 'chart', card: 'series', text: 'Each dot is one year’s average temperature. Years bounce around, but the orange trend line climbs steadily.' },
    { target: 'numbers', card: 'series', text: 'About +0.34 °C per decade, roughly 1.5 °C since 1980. The p-value is below 0.001: a significant trend.' },
    { target: 'headline', card: 'series', text: 'Verdict: rainfall is not significantly changing, but Cyprus is significantly warmer.' } ] }
};

export const GLOSSARY: GlossaryEntry[] = [
  { id: 'rainfall', term: 'Rainfall (mm)', text: 'How deep the rain would be if it all stayed where it fell. 10 mm of rain on one square metre is 10 litres of water.' },
  { id: 'temperature', term: 'Air temperature (°C)', text: 'How warm the air is 2 metres above the ground, averaged over the island.' },
  { id: 'trend', term: 'Trend', text: 'A steady change in one direction over many years, such as rising temperature.' },
  { id: 'sens_slope', term: 'Sen’s slope', text: 'How fast something changes. We take the slope between every pair of years and use the middle value, so one extreme year can’t pull the answer around.' },
  { id: 'mann_kendall', term: 'Mann-Kendall test', text: 'A standard test for trends. It checks whether values go up or down over the years more often than chance would explain, and gives the p-value.' },
  { id: 'p_value', term: 'p-value', text: 'How likely it is to see a trend this strong by chance if nothing were really changing. Smaller means stronger evidence.' },
  { id: 'significant', term: 'Significant', text: 'The p-value is below 0.05, so the trend meets the scientific standard for significance.' },
  { id: 'not_significant', term: 'Not significant', text: 'The p-value is 0.05 or more, so the trend does not meet the standard. That doesn’t mean there is no trend, or that it isn’t important: sometimes a longer record is all that’s needed.' },
  { id: 'variability', term: 'Year-to-year variability', text: 'How much a value usually swings from one year to the next. Big swings can hide a slow trend.' },
  { id: 'wet_season', term: 'Wet and dry seasons', text: 'In Cyprus most rain falls from October to March (wet season). April to September is the dry season.' },
  { id: 'seasonal_cycle', term: 'Seasonal cycle', text: 'The regular pattern every year: wet, mild winters and dry, hot summers. We add up whole years or seasons so this rhythm doesn’t hide a trend.' },
  { id: 'records', term: 'Satellite record vs model record', text: 'GPM IMERG measures rain from satellites since 1998, in detail. MERRA-2 is a NASA model that combines many observations back to 1980, in less detail.' }
];

export const HOW_STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "search", title: "Ask", text: "Choose a question, like “Is it getting hotter?”" },
  { icon: "pin", title: "Look", text: "Pick a place and see decades of NASA data." },
  { icon: "check", title: "Decide", text: "Find out whether the change is real." },
];

export const DATASETS = [
  { name: "GPM IMERG V07", what: "Rainfall from satellites (Final Run, monthly)", period: "Jan 1998 – Sep 2025", detail: "About 10 km grid. Used for the five areas and the whole island." },
  { name: "GPM IMERG V07 daily", what: "Daily rainfall from satellites (Final Run)", period: "Daily grid", detail: "About 10 km grid. Used for the rain map." },
  { name: "MERRA-2", what: "Rainfall (bias-corrected) from NASA’s reanalysis model", period: "Jan 1980 – Sep 2026", detail: "About 50 km grid. Whole island only; used as a long record and a second opinion." },
  { name: "MERRA-2", what: "Air temperature 2 m above the ground", period: "Jan 1980 – Sep 2026", detail: "About 50 km grid. Whole island only." },
  { name: "NISAR DEM v1.2", what: "Terrain height for the maps", period: "Copernicus GLO-30, 2011–2015", detail: "About 30 m. Modified Copernicus DEM, adapted by NASA/JPL for NISAR." },
];

export const METHOD_STEPS = [
  { title: "1 · Add up whole years and seasons", text: "Monthly values become yearly totals, wet-season totals (Oct–Mar) and dry-season totals (Apr–Sep), or yearly averages for temperature. This removes the regular seasonal cycle." },
  { title: "2 · Measure the rate of change", text: "Sen’s slope: the middle value of the slopes between every pair of years. Robust to single extreme years. The straight line on the chart is a simple linear fit, for drawing only." },
  { title: "3 · Test whether it’s real", text: "The Mann-Kendall test asks whether values go up or down more often than chance allows. Below p = 0.05 we call the trend significant." },
  { title: "4 · Apply the standard", text: "p below 0.05 is a significant trend. p of 0.05 or more does not meet the standard, which doesn’t mean there is no trend: a longer record may be needed." },
];

export const LIMITS = [
  "Rainfall in Cyprus swings by about ±25–40% from year to year, so small trends are hard to detect.",
  "Satellite rainfall is too low over the Troodos mountains, so we focus on change, not exact amounts.",
  "Areas are boxes averaged together; coastal boxes include some sea.",
  "MERRA-2 is coarse (about 50 km), so temperature is for the whole island only.",
  "Satellite data before mid-2000 comes from the older TRMM era.",
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
  "Acker, J. G., & Leptoukh, G. (2007). Online analysis enhances use of NASA Earth science data. Eos, Transactions American Geophysical Union, 88(2), 14–17. https://doi.org/10.1029/2007EO020003 — Time series, spatial subsetting and time-averaged maps (1998-01-01 to 2025-10-01) were produced with the NASA Giovanni online data system, developed and maintained by NASA GES DISC.",
  "Mann, H. B. (1945). Nonparametric tests against trend. Econometrica, 13(3), 245–259. https://doi.org/10.2307/1907187 — Kendall, M. G. (1975). Rank Correlation Methods. London: Charles Griffin.",
  "Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. Journal of the American Statistical Association, 63(324), 1379–1389. https://doi.org/10.1080/01621459.1968.10480934",
];

export const DEM_LICENSE =
  "Contains modified Copernicus Digital Elevation Model (GLO-30) data [2011–2015], produced using Copernicus data and information funded by the European Union — EU-DEM layers, adapted by NASA/JPL for NISAR.";
