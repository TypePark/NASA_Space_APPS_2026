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
| 3D Map | `#/map3d` | 3D terrain of Cyprus with the average rainfall map and a rain simulation |
| Case file | `#/case` | What is changing, where, how much, is it significant |
| Data & Method | `#/method` | Datasets, method, all 23 results, limits |

The glossary drawer and the guided tour open on top of these screens.

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
| `src/content.ts` | Wording: questions, places, glossary, references, icons |
| `src/tour.ts` | The guided tour: its steps, "your turn" tasks and what it says |
| `src/components/RegionMap.tsx` | The map. A drawn placeholder with a fixed interface (see below) |
| `src/components/charts.tsx` | The three SVG charts |
| `src/screens/` | One file per screen |
| `src/index.css` | Colours (light and dark) |

## Choosing what to analyse

The Adjust card in the Explorer has two views. The simple view offers the ready-made questions. "More options" opens the detailed view: pick a variable, any months of the year, a place, a record and a range of years. Every choice is analysed in the browser.

## Guided tour

"Guided tour" in the menu walks a visitor through the Explorer, the case file, the 3D map and Data & Method in 17 steps. Some steps ask the visitor to do something (open a card, pick a place, choose months) and explain the result once it is done. Every number the tour quotes is read from the current result.

## Facts in the wording

Record lengths, first years and year-to-year swings quoted on the welcome page, in the glossary and in the limitations are calculated from `monthly.json` (see `facts()` and `coverage()` in `src/model.ts`). Nothing of that kind is typed in by hand.

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

## The 3D map

`src/screens/Map3D.tsx` shows `src/components/TerrainMap3D.tsx`, which loads the map code in `Map3D/` (see `Map3D/README.md`). It needs an internet connection: CesiumJS and the satellite imagery are fetched when the page opens.

## Method

- Rate of change: **Sen's slope**, per decade, with its 95% confidence range.
- Significance: **Mann-Kendall test**. p < 0.05 is "Significant", otherwise "Not significant".
- The test assumes years are independent. Where one year follows the last too closely, a second p-value is shown that allows for it.
- Temperature and MERRA-2 rainfall exist for the whole island only.
- `analysis/build_results.py` (repository root) reproduces the 23 reference results from `data/raw/`.

Data: NASA GPM IMERG V07, NASA MERRA-2 and the NISAR elevation model (modified Copernicus DEM). NASA does not endorse any non-U.S. Government entity and is not responsible for information on non-U.S. Government websites.
