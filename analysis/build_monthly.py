"""
AquaCosmos - turn the raw NASA Giovanni downloads into the monthly series the app analyses.

Input : data/raw/*.csv   (Giovanni "Time Series, Area-Averaged" exports, monthly)
Output: Website/src/data/monthly.json

The app adds the months up (or averages them) for whatever months the user
chooses, then runs the Mann-Kendall test and Sen's slope in the browser.

To add a variable: download one CSV per region from Giovanni, put the files in
data/raw/, add an entry to SERIES below, and run this script again.

Run:  python analysis/build_monthly.py      (no packages needed)
"""
import calendar
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "Website", "src", "data", "monthly.json")

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


def mm_per_hour(value, year, month):
    """GPM IMERG: mm/hr -> mm per month."""
    return value * 24 * calendar.monthrange(year, month)[1]


def kg_m2_s(value, year, month):
    """MERRA-2 rainfall: kg m-2 s-1 -> mm per month."""
    return value * 86400 * calendar.monthrange(year, month)[1]


def kelvin(value, year, month):
    """Kelvin -> degrees Celsius."""
    return value - 273.15


# One entry per downloaded file.
#   aggregate: "sum"  -> months are added up (rainfall)
#              "mean" -> months are averaged (temperature)
#   percent  : also report the change as a percent of the average
SERIES = [
    *[dict(file=region, variable="rainfall", dataset="imerg", dataset_name="GPM IMERG", region_id=region,
           units="mm", aggregate="sum", percent=True, convert=mm_per_hour, source=IMERG_SRC, digits=4)
      for region in REGIONS],
    dict(file="cyprus_merra2_rain", variable="rainfall", dataset="merra2", dataset_name="MERRA-2",
         region_id="cyprus_whole", units="mm", aggregate="sum", percent=True, convert=kg_m2_s,
         source=MERRA_RAIN_SRC, digits=4),
    dict(file="cyprus_merra2_temperature", variable="temperature", dataset="merra2", dataset_name="MERRA-2",
         region_id="cyprus_whole", units="°C", aggregate="mean", percent=False, convert=kelvin,
         source=MERRA_TEMP_SRC, digits=3),
]


def read_giovanni(name):
    """Read a Giovanni area-averaged time-series CSV (8 header lines, then time,value)."""
    rows = []
    with open(os.path.join(RAW, name + ".csv"), encoding="utf-8") as f:
        for line in list(csv.reader(f))[9:]:
            if len(line) < 2:
                continue
            year, month = int(line[0][0:4]), int(line[0][5:7])
            value = float(line[1])
            assert abs(value) < 1e10, f"fill value found in {name}"
            rows.append((year, month, value))
    return rows


def main():
    out = []
    for s in SERIES:
        rows = read_giovanni(s["file"])
        # The app needs an unbroken run of months.
        for (y1, m1, _), (y2, m2, _) in zip(rows, rows[1:]):
            assert (y2 * 12 + m2) - (y1 * 12 + m1) == 1, f"missing month in {s['file']} after {y1}-{m1}"
        out.append({
            "id": f"{s['variable']}_{s['dataset']}_{s['region_id']}",
            "variable": s["variable"],
            "dataset": s["dataset"],
            "dataset_name": s["dataset_name"],
            "region_id": s["region_id"],
            "region": REGIONS[s["region_id"]],
            "units": s["units"],
            "aggregate": s["aggregate"],
            "percent": s["percent"],
            "source": s["source"],
            "start": [rows[0][0], rows[0][1]],
            "values": [round(s["convert"](v, y, m), s["digits"]) for y, m, v in rows],
        })
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(out)} monthly series to {OUT}")


if __name__ == "__main__":
    main()
