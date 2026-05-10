export type V2BarChartRow = {
  rank: number;
  country: string;
  iso2: string;
  score: number;
};

// Indicator ramp — quantile-mapped to bar score so high values
// land in the deep-navy tone and low values in the warm-sand tone.
// (Same ramp as the choropleth legend.)
const RAMP = [
  "var(--v2-ramp-indicator-1)",
  "var(--v2-ramp-indicator-2)",
  "var(--v2-ramp-indicator-3)",
  "var(--v2-ramp-indicator-4)",
  "var(--v2-ramp-indicator-5)",
];

function rampColor(score: number, max: number): string {
  const t = Math.max(0, Math.min(1, score / max));
  const idx = Math.min(RAMP.length - 1, Math.floor(t * RAMP.length));
  return RAMP[idx];
}

export function V2BarChart({
  rows,
  max = 100,
}: {
  rows: V2BarChartRow[];
  max?: number;
}) {
  return (
    <div className="v2-bar-chart" role="table" aria-label="Civica Index leaderboard">
      {rows.map((row) => {
        const pct = Math.max(0, Math.min(100, (row.score / max) * 100));
        return (
          <div key={row.country} className="v2-bar-chart__row" role="row">
            <span className="v2-bar-chart__rank" role="cell">{row.rank}</span>
            <span className="v2-bar-chart__country" role="cell">
              <span className="v2-bar-chart__country-flag" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://flagcdn.com/w40/${row.iso2.toLowerCase()}.png`}
                  alt=""
                  loading="lazy"
                />
              </span>
              {row.country}
            </span>
            <span className="v2-bar-chart__bar-track" role="cell" aria-hidden>
              <span
                className="v2-bar-chart__bar-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: rampColor(row.score, max),
                }}
              />
            </span>
            <span className="v2-bar-chart__score" role="cell">
              {row.score.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
