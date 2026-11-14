# AquaCosmos

NASA Space Apps Challenge 2026 · Challenge: **Be An Earth System Trend Detective!** · Team **AquaCosmos**

A tool for students and the public to investigate whether rainfall and temperature in Cyprus are changing, using real NASA data.

## Run it

```bash
npm install
npm run dev
```

Other commands: `npm run build`, `npm run lint`, `npm test`.

## What's in the app

| Screen | Address | Purpose |
|---|---|---|
| Welcome | `#/` | Headline and the two ways in |
| Set-up | `#/setup` | Step by step: where, what, how far back |
| Explorer | `#/explore` | The tool: verdict, key numbers, card deck, map |
| Rain map | `#/rain-map` | Map slot for the rain simulation, with a panel for the selected area |
| Case file | `#/case` | What is changing, where, how much, is it significant |
| Data & Method | `#/method` | Datasets, method, all 23 results, limits |

The glossary drawer and the "Watch a case" demo open on top of these screens.

## Where things are

| Path | What it is |
|---|---|
| `src/data/monthly.json` | Monthly NASA series (GPM IMERG and MERRA-2). The only data the app shows. Written by `analysis/build_monthly.py`. |
| `src/data/series.ts` | Look-up for the monthly series: which places and records each variable has |
| `src/data/records.ts` | Analyses a variable, place, record and choice of months in the browser |
| `src/lib/aggregate.ts` | Turns months into yearly or seasonal values (complete years and seasons only) |
| `src/data/all_results.json` | The 23 results from the Python analysis. Used only by the tests, to check the browser gives the same answers. |
| `src/lib/trendStats.ts` | Mann-Kendall test, Sen's slope with its 95% range, and the check for year-to-year dependence |
| `src/lib/trendStats.test.ts` | Checks that the browser reproduces all 23 Python results, and tests the choice of months |
| `src/model.ts` | Turns the chosen settings into the headline, numbers and card contents |
| `src/content.ts` | Wording: questions, places, glossary, demo steps, icons |
| `src/components/RegionMap.tsx` | The map. A drawn placeholder with a fixed interface (see below) |
| `src/components/charts.tsx` | The three SVG charts |
| `src/screens/` | One file per screen |
| `src/index.css` | Colours (light and dark) |

## Choosing what to analyse

The Adjust card in the Explorer has two views. The simple view offers five ready-made questions. "More options" opens the detailed view: pick a variable, any months of the year, a place, a record and a range of years. Every choice is analysed in the browser.

## Adding a variable

1. In NASA Giovanni, download "Time Series, Area-Averaged" (monthly, CSV) for each region and put the files in `data/raw/` at the repository root.
2. Add an entry for them to `SERIES` in `analysis/build_monthly.py` and run `python analysis/build_monthly.py`.
3. Add the variable's name and definition to `BASE_VARS` in `src/content.ts`.

It then appears in the detailed view, with the places and years it has data for.

## Replacing the map

`RegionMap` is isolated so a CesiumJS map can replace its inside. Keep these props:

| Prop | Meaning |
|---|---|
| `fills` | Colour per region id |
| `labels` | Short text per region id |
| `selected` | Region id to outline |
| `onPick(regionId)` | Called when an area is chosen |

Region ids: `troodos`, `nicosia`, `limassol`, `larnaca`, `paphos`.

## Replacing the rain map

`src/components/RainMapSlot.tsx` is the slot for the CesiumJS rain simulation on the Rain map page. Replace its inside and keep its two props: `selectedRegion` and `onPick(regionId)`.

## Method

- Rate of change: **Sen's slope**, per decade, with its 95% confidence range.
- Significance: **Mann-Kendall test**. p < 0.05 is "Significant", otherwise "Not significant".
- The test assumes years are independent. Where one year follows the last too closely, a second p-value is shown that allows for it.
- Temperature and MERRA-2 rainfall exist for the whole island only.
- `analysis/build_results.py` (repository root) reproduces the 23 reference results from `data/raw/`.

Data: NASA GPM IMERG V07, NASA MERRA-2 and the NISAR elevation model (modified Copernicus DEM). NASA does not endorse any non-U.S. Government entity and is not responsible for information on non-U.S. Government websites.
