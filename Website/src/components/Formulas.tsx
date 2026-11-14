import type { ReactNode } from "react";

/** A fraction, drawn with the numerator above the denominator. */
function Frac({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className="frac">
      <span>{top}</span>
      <span>{bottom}</span>
    </span>
  );
}

/** A sum sign with what it runs over written underneath. */
function Sum({ over }: { over: ReactNode }) {
  return (
    <span className="sum">
      <span className="sum-sign">Σ</span>
      <span className="sum-over">{over}</span>
    </span>
  );
}

interface Step {
  title: string;
  /** One or more formula lines. */
  lines: ReactNode[];
  where: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "1 · From NASA’s units to monthly values",
    lines: [
      <>
        <i>P</i> = <i>r</i> × 24 × <i>d</i>
      </>,
      <>
        <i>P</i> = <i>f</i> × 86 400 × <i>d</i>
      </>,
      <>
        <i>T</i>
        <sub>°C</sub> = <i>T</i>
        <sub>K</sub> − 273.15
      </>,
    ],
    where: (
      <>
        <i>P</i> is rainfall in mm for the month and <i>d</i> is the number of days in it. GPM IMERG gives a rate <i>r</i> in mm per hour.
        MERRA-2 rainfall and FLDAS evapotranspiration are fluxes <i>f</i> in kg m<sup>−2</sup> s<sup>−1</sup>, and 1 kg of water on 1 m<sup>2</sup> is 1 mm deep. Temperature
        arrives in kelvin.
      </>
    ),
  },
  {
    title: "2 · One value per year or season",
    lines: [
      <>
        <i>X</i>
        <sub>y</sub> = <Sum over="m ∈ M" /> <i>x</i>
        <sub>y,m</sub>
      </>,
      <>
        <i>X</i>
        <sub>y</sub> = <Frac top="1" bottom="|M|" /> <Sum over="m ∈ M" /> <i>x</i>
        <sub>y,m</sub>
      </>,
    ],
    where: (
      <>
        <i>M</i> is the set of months chosen and <i>x</i>
        <sub>y,m</sub> is the value for month <i>m</i> of year <i>y</i>. Rainfall and evapotranspiration are added up (first line); temperature is averaged
        (second line). A year or season with any month missing is left out. A season that crosses the New Year, such as October to March,
        belongs to the year it starts in. This step removes the seasonal cycle.
      </>
    ),
  },
  {
    title: "3 · Mann-Kendall statistic",
    lines: [
      <>
        <i>S</i> = <Sum over="i < j" /> sgn(<i>X</i>
        <sub>j</sub> − <i>X</i>
        <sub>i</sub>)
      </>,
    ],
    where: (
      <>
        Every year is compared with every later year. sgn is +1 if the later value is higher, −1 if it is lower and 0 if they are equal.
        With <i>n</i> years there are <i>n</i>(<i>n</i> − 1)/2 pairs. A large positive <i>S</i> means mostly rises; a large negative{" "}
        <i>S</i> means mostly falls.
      </>
    ),
  },
  {
    title: "4 · How much S varies by chance",
    lines: [
      <>
        Var(<i>S</i>) ={" "}
        <Frac
          top={
            <>
              <i>n</i>(<i>n</i> − 1)(2<i>n</i> + 5) − <Sum over="g" /> <i>t</i>
              <sub>g</sub>(<i>t</i>
              <sub>g</sub> − 1)(2<i>t</i>
              <sub>g</sub> + 5)
            </>
          }
          bottom="18"
        />
      </>,
    ],
    where: (
      <>
        This is the spread <i>S</i> would have if there were no trend. The second term corrects for ties: <i>t</i>
        <sub>g</sub> is the number of years sharing the <i>g</i>-th repeated value.
      </>
    ),
  },
  {
    title: "5 · Test statistic and p-value",
    lines: [
      <>
        <i>Z</i> = <Frac top={<><i>S</i> − 1</>} bottom={<>√Var(<i>S</i>)</>} /> if <i>S</i> &gt; 0, &nbsp; 0 if <i>S</i> = 0, &nbsp;{" "}
        <Frac top={<><i>S</i> + 1</>} bottom={<>√Var(<i>S</i>)</>} /> if <i>S</i> &lt; 0
      </>,
      <>
        <i>p</i> = 2 [1 − Φ(|<i>Z</i>|)]
      </>,
    ],
    where: (
      <>
        Φ is the standard normal distribution. <i>p</i> is the chance of an <i>S</i> at least this far from zero if nothing were changing
        (a two-sided test). We call the trend <b>significant when <i>p</i> &lt; 0.05</b>.
      </>
    ),
  },
  {
    title: "6 · Sen’s slope: the rate of change",
    lines: [
      <>
        <i>β</i> = median{" "}
        <span className="brace">
          <Frac
            top={
              <>
                <i>X</i>
                <sub>j</sub> − <i>X</i>
                <sub>i</sub>
              </>
            }
            bottom={
              <>
                <i>t</i>
                <sub>j</sub> − <i>t</i>
                <sub>i</sub>
              </>
            }
          />{" "}
          for all <i>i</i> &lt; <i>j</i>
        </span>
      </>,
      <>
        change per decade = 10 <i>β</i>, &nbsp; percent per decade = 100 × <Frac top={<>10 <i>β</i></>} bottom={<i>X̄</i>} />
      </>,
    ],
    where: (
      <>
        <i>t</i> is the year and <i>X̄</i> is the average of all the yearly values. The slope between every pair of years is calculated,
        and the middle one is used, so one extreme year cannot pull the answer.
      </>
    ),
  },
  {
    title: "7 · Trend line and change along it",
    lines: [
      <>
        <i>X̂</i>(<i>t</i>) = <i>β</i> <i>t</i> + <i>a</i>, &nbsp; <i>a</i> = median(<i>X</i>
        <sub>i</sub> − <i>β</i> <i>t</i>
        <sub>i</sub>)
      </>,
      <>
        Δ = <i>β</i> (<i>t</i>
        <sub>last</sub> − <i>t</i>
        <sub>first</sub>)
      </>,
    ],
    where: (
      <>
        The line on the chart has Sen’s slope and sits so that half the points are above it and half below. Δ is the change along that
        line over the whole record; for rainfall it is shown as a percent of the average, 100 × Δ / <i>X̄</i>. It is a summary of the
        trend, not a measured drop between two years.
      </>
    ),
  },
  {
    title: "8 · Likely range of the rate (95%)",
    lines: [
      <>
        <i>C</i> = 1.96 √Var(<i>S</i>), &nbsp; <i>N</i> = <Frac top={<><i>n</i>(<i>n</i> − 1)</>} bottom="2" />
      </>,
      <>
        <i>M</i>
        <sub>1</sub> = <Frac top={<><i>N</i> − <i>C</i></>} bottom="2" />, &nbsp; <i>M</i>
        <sub>2</sub> = <Frac top={<><i>N</i> + <i>C</i></>} bottom="2" />
      </>,
    ],
    where: (
      <>
        The <i>N</i> pair slopes are sorted from lowest to highest. The range runs from the <i>M</i>
        <sub>1</sub>-th to the (<i>M</i>
        <sub>2</sub> + 1)-th of them. If the range includes zero, the data cannot tell a rise from a fall.
      </>
    ),
  },
  {
    title: "9 · Check for year-to-year dependence",
    lines: [
      <>
        <i>r</i>
        <sub>1</sub> ={" "}
        <Frac
          top={
            <>
              <Sum over="i" /> (<i>e</i>
              <sub>i</sub> − <i>ē</i>)(<i>e</i>
              <sub>i+1</sub> − <i>ē</i>)
            </>
          }
          bottom={
            <>
              <Sum over="i" /> (<i>e</i>
              <sub>i</sub> − <i>ē</i>)<sup>2</sup>
            </>
          }
        />
        , &nbsp; <i>e</i>
        <sub>i</sub> = <i>X</i>
        <sub>i</sub> − <i>X̂</i>(<i>t</i>
        <sub>i</sub>)
      </>,
      <>
        Var*(<i>S</i>) = Var(<i>S</i>) × <span className="brace">1 + 2 <Sum over="k = 1 … n−1" /> (1 − <Frac top="k" bottom="n" />) <i>r</i>
        <sub>1</sub>
        <sup>k</sup></span>
      </>,
    ],
    where: (
      <>
        <i>e</i> is what is left after removing the trend line, and <i>r</i>
        <sub>1</sub> measures how closely each year follows the one before. The test assumes <i>r</i>
        <sub>1</sub> is about zero. If <i>r</i>
        <sub>1</sub> &gt; 1.96 / √<i>n</i>, we widen the variance as shown (Yue &amp; Wang, 2004), recalculate <i>Z</i> and <i>p</i>, and
        show the second p-value as well.
      </>
    ),
  },
];

/** "The maths": every formula behind the numbers, in the order it is applied. */
export default function Formulas() {
  return (
    <ol className="formulas">
      {STEPS.map((s) => (
        <li key={s.title} className="formula-step">
          <h3 className="strong">{s.title}</h3>
          <div className="formula" role="math">
            {s.lines.map((line, i) => (
              <div key={i} className="formula-line">
                {line}
              </div>
            ))}
          </div>
          <p className="small muted">{s.where}</p>
        </li>
      ))}
    </ol>
  );
}
