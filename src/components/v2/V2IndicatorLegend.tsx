/*
 * Indicator legend with two presentations:
 *   - "expanded" — continuous gradient ramp (low → high)
 *   - "binned"   — five discrete chips with quantile labels
 *
 * Both apply paper-grain texture INSIDE the colored areas via the
 * .v2-legend__bar::after / .v2-legend__bin-chip::after overlays in
 * v2.css.
 */

const RAMP_COLORS = [
  "var(--v2-ramp-indicator-1)",
  "var(--v2-ramp-indicator-2)",
  "var(--v2-ramp-indicator-3)",
  "var(--v2-ramp-indicator-4)",
  "var(--v2-ramp-indicator-5)",
];

export type V2IndicatorLegendProps = {
  title: string;
  unit?: string;
  variant: "expanded" | "binned";
  bins?: string[]; // labels for binned variant
  scaleLabels?: { low: string; high: string };
  showNoData?: boolean;
};

export function V2IndicatorLegend({
  title,
  unit,
  variant,
  bins,
  scaleLabels = { low: "Low", high: "High" },
  showNoData = true,
}: V2IndicatorLegendProps) {
  return (
    <div className="v2-legend">
      <div className="v2-legend__head">
        <span className="v2-legend__title">{title}</span>
        {unit && <span className="v2-legend__unit">{unit}</span>}
      </div>

      {variant === "expanded" ? (
        <>
          <div className="v2-legend__bar" aria-hidden />
          <div className="v2-legend__row">
            <div className="v2-legend__scale" style={{ flex: 1 }}>
              <span>{scaleLabels.low}</span>
              <span>{scaleLabels.high}</span>
            </div>
            {showNoData && (
              <div className="v2-legend__nodata">
                <span>No data</span>
                <span className="v2-legend__nodata-chip" aria-hidden />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="v2-legend__bins">
            {RAMP_COLORS.map((color, i) => (
              <div key={i} className="v2-legend__bin">
                <div
                  className="v2-legend__bin-chip"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="v2-legend__bin-label">
                  {bins?.[i] ?? ""}
                </span>
              </div>
            ))}
          </div>
          {showNoData && (
            <div className="v2-legend__row" style={{ justifyContent: "flex-end" }}>
              <div className="v2-legend__nodata">
                <span>No data</span>
                <span className="v2-legend__nodata-chip" aria-hidden />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
