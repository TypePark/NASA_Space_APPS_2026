<<<<<<< HEAD
# AquaCosmos

NASA Space Apps Challenge 2026 · Challenge: **Be An Earth System Trend Detective** · Team **AquaCosmos**

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
| Case file | `#/case` | What is changing, where, how much, is it significant |
| Data & Method | `#/method` | Datasets, method, all 23 results, limits |

The glossary drawer and the "Watch a case" demo open on top of these screens.

## Where things are

| Path | What it is |
|---|---|
| `src/data/all_results.json` | The 23 analysed results (NASA GPM IMERG and MERRA-2). The only data in the app. |
| `src/data/records.ts` | Types and look-up for the results |
| `src/lib/trendStats.ts` | Mann-Kendall test and Sen's slope, used for "Choose years" and "Would more years help?" |
| `src/lib/trendStats.test.ts` | Checks every stored result against a fresh calculation |
| `src/model.ts` | Turns the chosen settings into the headline, numbers and card contents |
| `src/content.ts` | Wording: questions, places, glossary, demo steps, icons |
| `src/components/RegionMap.tsx` | The map. A drawn placeholder with a fixed interface (see below) |
| `src/components/charts.tsx` | The three SVG charts |
| `src/screens/` | One file per screen |
| `src/index.css` | Colours (light and dark) |

## Replacing the map

`RegionMap` is isolated so a CesiumJS map can replace its inside. Keep these props:

| Prop | Meaning |
|---|---|
| `fills` | Colour per region id |
| `labels` | Short text per region id |
| `selected` | Region id to outline |
| `onPick(regionId)` | Called when an area is chosen |

Region ids: `troodos`, `nicosia`, `limassol`, `larnaca`, `paphos`.

## Method

- Rate of change: **Sen's slope**, per decade.
- Significance: **Mann-Kendall test**. p < 0.05 is "Significant", otherwise "Not significant".
- Temperature and MERRA-2 rainfall exist for the whole island only.

Data: NASA GPM IMERG V07, NASA MERRA-2 and NASA SRTM. NASA does not endorse any non-U.S. Government entity and is not responsible for information on non-U.S. Government websites.
=======
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
>>>>>>> main
