import {
  getAllSources,
  getIndicatorHistoryForCountry,
  type IndicatorHistorySeries,
} from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { sourceLabel } from "@/lib/data/sources";
import {
  IndicatorTrendChart,
  type TrendSeriesInput,
} from "./IndicatorTrendChart";

/**
 * CountryTrendSection — server component. Fetches the long-run
 * `indicator_history` series for a country and renders the multi-series
 * <IndicatorTrendChart> as a numbered-section-consistent block on the
 * Civica Data tab (joining the quarterly CI history block, which stays).
 *
 * Soft-fail: if the country has no history rows (or none drawable), the
 * whole section renders NOTHING — no empty frame, no phantom anchor.
 * Mirrors the CivicaIndexPanel's every-fetch-soft-fails discipline.
 */

export async function CountryTrendSection({ slug }: { slug: string }) {
  let series: IndicatorHistorySeries[] = [];
  try {
    series = await getIndicatorHistoryForCountry(slug);
  } catch {
    return null;
  }

  // Each source's REAL last_sync_at feeds its SourceDot (frozen vintages
  // render amber). Soft-fails to an empty map — the dot then shows its
  // no-date state rather than a fabricated stamp.
  const syncedAtBySource = new Map<string, string>();
  try {
    const sources = await getAllSources();
    for (const s of sources) {
      if (s.lastSyncAt) syncedAtBySource.set(s.id, s.lastSyncAt.toISOString());
    }
  } catch {}

  const drawable = series.filter((s) => s.points.length >= 2);
  if (drawable.length === 0) return null;

  const chartSeries: TrendSeriesInput[] = drawable.map((s) => ({
    dimension: s.dimension,
    indicator: s.indicator,
    sourceId: s.sourceId,
    nativeMin: s.nativeMin,
    nativeMax: s.nativeMax,
    isInverted: s.isInverted,
    points: s.points,
    sourceLabel: sourceLabel(s.sourceId),
  }));

  // Provenance row: one SourceDot per distinct source in the chart.
  const distinctSources = Array.from(
    new Set(drawable.map((s) => s.sourceId))
  );

  // Overall span across every series, for the eyebrow summary.
  const allYears = drawable.flatMap((s) => s.points.map((p) => p.year));
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);

  return (
    <section id="ci-long-run">
      <div className="ci-country-section-eyebrow">
        <span>Long-run indicators · source history</span>
        <small>
          {drawable.length} series · {minYear}–{maxYear}
        </small>
      </div>
      <h3 className="ci-country-section-title">
        How the underlying indicators have moved over the decades.
      </h3>

      <IndicatorTrendChart series={chartSeries} />

      <div className="ci-country-long-run-sources">
        {distinctSources.map((sourceId) => (
          <span key={sourceId} className="ci-country-long-run-source">
            <SourceDot source={sourceId} retrievedAt={syncedAtBySource.get(sourceId) ?? null} />
            <span>{sourceLabel(sourceId)}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
