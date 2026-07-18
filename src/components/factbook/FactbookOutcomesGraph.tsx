import { getCountryOutcomes } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";

/**
 * Factbook · Outcomes (dense peer-band graph)
 *
 * One row per indicator. Each row is ~44px tall and reads left-to-right:
 *
 *   Indicator label · material-peer range with median tick + country dot · value · rank · peer position
 *
 * The whole section fits ~10 indicators in the same vertical space the
 * legacy `<CountryOutcomeBars>` used for 2 — the user explicitly asked
 * for the dense graph, NOT a polish of the editorial bars.
 *
 * Peer position is computed from `rank / totalRanked` percentile,
 * direction-aware via `higher_is_better`. It is a relative location label,
 * not a qualitative country verdict; every marker uses neutral blue.
 *
 * Returns `null` when the country has no metrics so the parent hides
 * the entire section.
 */

interface FactbookOutcomesGraphProps {
  jurisdictionId: string;
  countryName: string;
  year?: number;
}

interface MetricRow {
  metricId: string;
  name: string;
  category: string | null;
  unit: string | null;
  higherIsBetter: boolean;
  value: number;
  asOfYear: number;
  rank: number | null;
  totalRanked: number | null;
  isStale: boolean;
}

interface PeerBand {
  metricId: string;
  peerCount: number;
  peerMin: number;
  peerMedian: number;
  peerMax: number;
  attemptedN: number;
  finalN: number;
  eligibleN: number;
  cohortLabel: string;
  fallbackChain: string[];
  upstreamVintage: string | null;
  sourceId: string;
  retrievedAt: string | null;
}

function positionFromRank(rank: number, total: number): string {
  const pct = rank / total;
  if (pct <= 0.1) return "Top 10%";
  if (pct <= 0.33) return "Above median";
  if (pct <= 0.5) return "Upper middle";
  if (pct <= 0.75) return "Below median";
  return "Bottom quartile";
}

// Fallback position derivation when `rank` is null in the DB. Uses the
// country's value position within the peer band (peerMin → peerMax)
// adjusted for direction.
function positionFromValue(
  value: number,
  peer: PeerBand,
  higherIsBetter: boolean
): string {
  const range = peer.peerMax - peer.peerMin;
  if (range <= 0) return "Midpoint";
  let pct = (value - peer.peerMin) / range;
  // For "lower is better" metrics (e.g. unemployment, child mortality),
  // invert so a low value reads as top-quartile.
  if (!higherIsBetter) pct = 1 - pct;
  if (pct >= 0.9) return "Top 10%";
  if (pct >= 0.66) return "Above median";
  if (pct >= 0.5) return "Upper middle";
  if (pct >= 0.25) return "Below median";
  return "Bottom quartile";
}

function peerPositionOf(
  rank: number | null,
  total: number | null,
  value: number,
  peer: PeerBand | undefined,
  higherIsBetter: boolean
): string | null {
  if (rank != null && total != null && total > 0) {
    return positionFromRank(rank, total);
  }
  // Degenerate peer bands (peerCount ≤ 1, e.g. a country with a unique
  // govType like USA's "constitutional_federal_republic") collapse to a
  // single point — comparison is meaningless. Fall through to null so
  // the row renders without a peer-position label.
  if (peer && peer.peerCount > 1 && peer.peerMax > peer.peerMin) {
    return positionFromValue(value, peer, higherIsBetter);
  }
  return null;
}

// Format a metric value with sensible precision per scale + unit.
function formatValue(value: number, unit: string | null): string {
  const u = (unit ?? "").toLowerCase();
  if (u.includes("usd") || u.includes("$") || u.includes("dollar")) {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (Math.abs(value) >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6)  return `$${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3)  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return `$${value.toFixed(0)}`;
  }
  if (u.includes("%") || u.includes("percent")) {
    return `${value.toFixed(1)}%`;
  }
  if (Math.abs(value) >= 10000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 100)   return value.toFixed(0);
  if (Math.abs(value) >= 10)    return value.toFixed(1);
  if (Math.abs(value) >= 1)     return value.toFixed(2);
  return value.toFixed(3);
}

// Position 0..100 along the peer band. Clamped so an outlier (e.g.
// USA GDP-per-capita > peerMax) still renders a dot at the edge instead
// of escaping the track.
function dotPercent(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const raw = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, raw));
}

export async function FactbookOutcomesGraph({
  jurisdictionId,
  year,
}: FactbookOutcomesGraphProps) {
  const targetYear = year ?? new Date().getFullYear();
  const result = await getCountryOutcomes(jurisdictionId, targetYear).catch(
    () => null
  );
  if (!result) return null;

  // `getCountryOutcomes` is typed as NeonHttpQueryResult, but at runtime
  // returns either a row array or `{ rows: [...] }`. Convert via unknown
  // to satisfy strict TS while preserving the runtime check.
  const metricsRaw = Array.isArray(result.metrics)
    ? (result.metrics as unknown as MetricRow[])
    : ((result.metrics as unknown as { rows?: MetricRow[] })?.rows ?? []);

  if (!metricsRaw || metricsRaw.length === 0) return null;

  const peerBandsRaw = Array.isArray(result.peerBands)
    ? (result.peerBands as unknown as PeerBand[])
    : ((result.peerBands as unknown as { rows?: PeerBand[] })?.rows ?? []);

  const peerMap = new Map<string, PeerBand>(
    (peerBandsRaw ?? []).map((p) => [p.metricId, p])
  );

  // Stable sort: by category, then by relative rank (lowest position first within category
  // — surfaces the most actionable indicators at the top of each group).
  const metrics = [...metricsRaw].sort((a, b) => {
    const ca = (a.category ?? "").toLowerCase();
    const cb = (b.category ?? "").toLowerCase();
    if (ca !== cb) return ca.localeCompare(cb);
    const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
    return rb - ra; // larger rank first = worse first within group
  });

  return (
    <div className="factbook-outcomes-graph">
      <div className="factbook-outcomes-graph-head" role="presentation">
        <span>Indicator</span>
        <span>Material peer range</span>
        <span>Value</span>
        <span>Rank</span>
        <span>Position</span>
      </div>
      {metrics.map((m) => {
        const peer = peerMap.get(m.metricId);
        const peerPosition = peerPositionOf(
          m.rank,
          m.totalRanked,
          m.value,
          peer,
          m.higherIsBetter,
        );
        // Only render the band + dot when there's a real spread to plot
        // against (more than one peer with non-zero range). Otherwise
        // the cell shows just the country's own value with no false
        // "you're average" implication.
        const hasUsefulBand =
          !!peer && peer.peerCount > 1 && peer.peerMax > peer.peerMin;
        const dotPct = hasUsefulBand
          ? dotPercent(m.value, peer.peerMin, peer.peerMax)
          : null;
        const medianPct = hasUsefulBand
          ? dotPercent(peer.peerMedian, peer.peerMin, peer.peerMax)
          : null;
        return (
          <div
            key={m.metricId}
            className="factbook-outcomes-row"
          >
            <div className="factbook-outcomes-label">
              <span className="factbook-outcomes-name">{m.name}</span>
              {m.unit && (
                <span className="factbook-outcomes-unit">{m.unit}</span>
              )}
            </div>

            <div
              className="factbook-outcomes-band"
              role="img"
              aria-label={
                peer
                  ? `${m.name}: country value ${m.value}, ${peer.cohortLabel} material peers, ${peer.attemptedN} attempted and ${peer.finalN} final from ${peer.eligibleN} observed eligible jurisdictions, peer range ${peer.peerMin} to ${peer.peerMax}, peer median ${peer.peerMedian}${peer.upstreamVintage ? `, classification vintage ${peer.upstreamVintage}` : ""}`
                  : `${m.name}: ${m.value} (no peer comparison)`
              }
            >
              <div className="factbook-outcomes-track" />
              {medianPct != null && (
                <div
                  className="factbook-outcomes-median"
                  style={{ left: `${medianPct}%` }}
                  aria-hidden
                />
              )}
              {dotPct != null && (
                <div
                  className="factbook-outcomes-dot"
                  style={{ left: `${dotPct}%` }}
                  aria-hidden
                />
              )}
            </div>

            <div className="factbook-outcomes-value">
              {formatValue(m.value, m.unit)}
              {(m.isStale || peer) && (
                <span className="factbook-outcomes-asof">
                  {m.asOfYear}
                  {peer
                    ? ` · n ${peer.attemptedN} → ${peer.finalN} · ${peer.upstreamVintage ?? "vintage not recorded"}`
                    : ""}
                </span>
              )}
            </div>

            <div className="factbook-outcomes-rank">
              {m.rank != null && m.totalRanked != null
                ? `${m.rank}/${m.totalRanked}`
                : "—"}
            </div>

            <div className="factbook-outcomes-position" aria-hidden={peerPosition == null}>
              {peerPosition ?? ""}
              <SourceDot
                source={peer?.sourceId ?? "3rd-party indicator"}
                retrievedAt={peer?.retrievedAt ?? null}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
