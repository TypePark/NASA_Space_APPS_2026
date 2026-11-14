"""
AquaCosmos - reproduce every trend result from the raw NASA Giovanni downloads.

Input : data/raw/*.csv   (Giovanni "Time Series, Area-Averaged" exports)
Output: data/results/*.json, data/results/all_results.json, data/results/summary.csv

Methods
  - Rainfall (mm/hr or kg m-2 s-1) -> mm per month -> yearly / seasonal totals
  - Temperature (K) -> degrees C -> yearly / summer means
  - Rate of change : Sen's slope (per decade)
  - Significance   : Mann-Kendall test, significant if p < 0.05 (NASA challenge standard)
  - Trend line     : ordinary least squares, for drawing only

Run:  pip install pandas numpy scipy pymannkendall
      python analysis/build_results.py
"""
import csv
import json
import os

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "results")
os.makedirs(OUT, exist_ok=True)

REGIONS = {
    "cyprus_whole": "Whole island",
    "troodos": "Troodos",
    "nicosia": "Nicosia / Lefkoşa",
    "limassol": "Limassol",
    "larnaca": "Larnaca",
    "paphos": "Paphos",
}
IMERG_SRC = "NASA GPM IMERG V07 Final Run monthly (GPM_3IMERGM), Giovanni area-averaged"
MERRA_RAIN_SRC = ("NASA MERRA-2 bias-corrected total precipitation (M2TMNXFLX v5.12.4 PRECTOTCORR), "
                  "monthly, Giovanni area-averaged over Cyprus")
MERRA_TEMP_SRC = ("NASA MERRA-2 2-meter air temperature (M2TMNXSLV v5.12.4 T2M), "
                  "monthly, Giovanni area-averaged over Cyprus")


def read_giovanni(name):
    """Read a Giovanni area-averaged time-series CSV (8 header lines, then time,value)."""
    df = pd.read_csv(os.path.join(RAW, name + ".csv"), skiprows=8)
    df.columns = ["time", "value"]
    df["time"] = pd.to_datetime(df["time"])
    assert (df["value"].abs() < 1e10).all(), f"fill values found in {name}"
    df["y"] = df["time"].dt.year
    df["m"] = df["time"].dt.month
    return df


def p_display(p):
    if p < 0.001:
        return "< 0.001"
    if 0.045 <= p < 0.055:
        return f"{p:.4f}"
    return f"{p:.3f}" if p < 0.1 else f"{p:.2f}"


def result(region_id, dataset, variable, label, units, source, index, labels, values, clim, clim_units):
    index = [int(i) for i in index]
    values = [float(v) for v in values]
    test = mk.original_test(values)
    line = stats.linregress(index, values)
    mean = float(np.mean(values))
    temp = "°C" in units
    sen10 = float(test.slope * 10)
    span = index[-1] - index[0]
    p = float(test.p)
    sig = p < 0.05
    place = "Cyprus" if region_id == "cyprus_whole" else REGIONS[region_id]
    per = "season" if "season" in variable else "year"

    if temp:
        change = round(sen10 / 10 * span, 1)
        variability = round(float(np.std(values, ddof=1)), 2)
        text = f"{label} has changed by {sen10:+.2f} °C per decade, about {change:+.1f} °C in total since {index[0]}. "
    else:
        change = round(sen10 / 10 * span / mean * 100, 1)
        variability = round(float(np.std(values, ddof=1)) / mean * 100, 1)
        text = (f"{label} in {place} has changed by {sen10:+.1f} mm per decade ({sen10 / mean * 100:+.1f}%). "
                f"It usually swings about ±{variability:.0f}% from one {per} to the next. ")

    shown = p_display(p)
    text += ("p " + shown if shown.startswith("<") else "p = " + shown) + ", which "
    text += ("meets the 0.05 standard: this is a significant trend." if sig else
             "does not meet the 0.05 standard for significance. "
             "That doesn’t mean there is no trend; a longer record may be needed.")

    suffix = "_merra2" if dataset == "MERRA-2" else ""
    digits = 2 if temp else 1
    return {
        "id": f"{region_id}_{variable}{suffix}",
        "region": REGIONS[region_id],
        "region_id": region_id,
        "dataset": dataset,
        "variable": variable,
        "variable_label": label,
        "units": units,
        "source": source,
        "years": labels,
        "year_numeric": index,
        "values": [round(v, 2) for v in values],
        "mean": round(mean, digits),
        "monthly_climatology": clim,
        "monthly_climatology_units": clim_units,
        "trend_per_decade": round(sen10, digits),
        "trend_percent_per_decade": None if temp else round(sen10 / mean * 100, 1),
        "trend_units": "°C per decade" if temp else "mm per decade",
        "change_over_period": change,
        "change_over_period_units": "°C" if temp else "% of average",
        "trend_line": {
            "slope_per_year": round(float(line.slope), 4),
            "intercept": round(float(line.intercept), 2),
            "method": "linear regression (for drawing only)",
        },
        "p_value": round(p, 4) if p >= 0.0001 else float(f"{p:.2e}"),
        "p_value_display": shown,
        "kendall_tau": round(float(test.Tau), 3),
        "significant": bool(sig),
        "status": "significant" if sig else "not_significant",
        "year_to_year_variability": variability,
        "year_to_year_variability_units": "± °C" if temp else "± % of average",
        "explanation": text.replace(" -", " −").replace("(-", "(−"),
    }


def rain_results(df, region_id, dataset, source, last_full_year):
    """df needs a column 'mm' holding mm per month."""
    full = df[df.y <= last_full_year]
    clim = [round(float(v), 1) for v in full.groupby("m").mm.mean()]
    clim_units = f"mm per month ({int(df.y.min())}–{last_full_year} average)"
    out = []

    annual = full.groupby("y").mm.sum()
    out.append(result(region_id, dataset, "annual_total", "Annual rainfall", "mm per year", source,
                      annual.index, [int(y) for y in annual.index], annual.values, clim, clim_units))

    d = df.copy()
    d["season"] = np.where(d.m >= 10, d.y, d.y - 1)  # a wet season is labelled by the year it starts
    wet = d[d.m.isin([10, 11, 12, 1, 2, 3])]
    complete = wet.groupby("season").mm.count()
    wet = wet[wet.season.isin(complete[complete == 6].index)].groupby("season").mm.sum()
    out.append(result(region_id, dataset, "wet_season_total", "Wet-season rainfall (Oct–Mar)", "mm per season", source,
                      wet.index, [f"{int(y)}/{str(int(y) + 1)[2:]}" for y in wet.index], wet.values, clim, clim_units))

    dry = df[df.m.between(4, 9)]
    complete = dry.groupby("y").mm.count()
    dry = dry[dry.y.isin(complete[complete == 6].index)].groupby("y").mm.sum()
    out.append(result(region_id, dataset, "dry_season_total", "Dry-season rainfall (Apr–Sep)", "mm per season", source,
                      dry.index, [int(y) for y in dry.index], dry.values, clim, clim_units))
    return out


def main():
    results = []

    # GPM IMERG rainfall: mm/hr -> mm per month
    for region_id in REGIONS:
        df = read_giovanni(region_id)
        df["mm"] = df["value"] * 24 * df["time"].dt.days_in_month
        results += rain_results(df, region_id, "GPM IMERG", IMERG_SRC, last_full_year=2024)

    # MERRA-2 rainfall: kg m-2 s-1 -> mm per month
    df = read_giovanni("cyprus_merra2_rain")
    df["mm"] = df["value"] * 86400 * df["time"].dt.days_in_month
    results += rain_results(df, "cyprus_whole", "MERRA-2", MERRA_RAIN_SRC, last_full_year=2025)

    # MERRA-2 temperature: K -> degrees C
    df = read_giovanni("cyprus_merra2_temperature")
    df["c"] = df["value"] - 273.15
    clim = [round(float(v), 1) for v in df[df.y <= 2025].groupby("m").c.mean()]
    annual = df[df.y <= 2025].groupby("y").c.mean()
    results.append(result("cyprus_whole", "MERRA-2", "annual_mean_temperature", "Average air temperature", "°C",
                          MERRA_TEMP_SRC, annual.index, [int(y) for y in annual.index], annual.values,
                          clim, "°C (1980–2025 average)"))
    summer = df[df.m.isin([6, 7, 8])].groupby("y").c.mean()
    results.append(result("cyprus_whole", "MERRA-2", "summer_mean_temperature", "Summer air temperature (Jun–Aug)", "°C",
                          MERRA_TEMP_SRC, summer.index, [int(y) for y in summer.index], summer.values,
                          clim, "°C (1980–2025 average)"))

    for r in results:
        with open(os.path.join(OUT, r["id"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "all_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "summary.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Region", "Dataset", "Measure", "Period", "Mean", "Sen's slope per decade",
                    "p-value (Mann-Kendall)", "Significant (p < 0.05)"])
        for r in results:
            w.writerow([r["region"], r["dataset"], r["variable_label"], f"{r['years'][0]}–{r['years'][-1]}", r["mean"],
                        f"{r['trend_per_decade']} {r['trend_units'].replace(' per decade', '')}",
                        r["p_value_display"], "Yes" if r["significant"] else "No"])
    print(f"Wrote {len(results)} results to {OUT}")


if __name__ == "__main__":
    main()
