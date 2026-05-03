/**
 * PeerLensPanel — visual primitive showing a country's peer-lens
 * cohort with rank, n, fallback indicator, and SourceDot.
 *
 * One panel per lens. Country detail pages (`/civica-index/[slug]`,
 * `/countries/[slug]`) render TWO panels: material peer + governance
 * peer. Each cites a different external source and may display a
 * different vintage — the SourceDot reads from the helper's
 * provenance fields, so this is automatic.
 *
 *   ~/civica/plan/peer-grouping-resolution-v1.md
 *   ~/civica/plan/structural-family-removal-implementation-plan.md §F.10
 */

import { SourceDot } from "@/components/SourceDot";
import {
  PEER_LENS_DISPLAY_NAME,
  PEER_LENS_SOURCE_ID,
  getPeerLensValueMeta,
  type PeerLensName,
} from "@/lib/peer-grouping/lens-metadata";
import type {
  PeerSetFallbackReason,
  PeerSetResult,
} from "@/lib/peer-grouping";

interface PeerLensPanelProps {
  /** Which lens this panel displays. */
  lens: PeerLensName;
  /** Resolved peer-set result from `getMaterialPeerSet()` /
   *  `getGovernancePeerSet()` / `getRegimeAlternateLens()`. */
  peerSet: PeerSetResult;
  /** Subject country's rank within the peer cohort. `null` when
   *  the subject has no CI score yet (still display the cohort). */
  rank?: { position: number; total: number } | null;
}

export function PeerLensPanel({ lens, peerSet, rank }: PeerLensPanelProps) {
  const lensDisplay = PEER_LENS_DISPLAY_NAME[lens];
  const sourceId = peerSet.sourceId || PEER_LENS_SOURCE_ID[lens];

  // Unavailable state — the subject country has no classification on
  // this lens (Taiwan / Vatican / Western Sahara / Phase F not yet
  // synced).
  if (!peerSet.available) {
    return (
      <div className="peer-lens-panel peer-lens-panel--unavailable">
        <div className="peer-lens-panel__header">
          <span className="peer-lens-panel__lens-label">{lensDisplay}</span>
          <SourceDot source={sourceId} retrievedAt={peerSet.retrievedAt} />
        </div>
        <div className="peer-lens-panel__cohort-label peer-lens-panel__cohort-label--muted">
          Limited peer comparison available
        </div>
        <div className="peer-lens-panel__fallback-note">
          {fallbackNote(peerSet.fallbackChain)}
        </div>
      </div>
    );
  }

  // Use the lens that ACTUALLY produced the result for the meta
  // lookup, not the requested lens. When the material-lens fallback
  // chain lands on an income-only cohort, `lensUsed` is
  // `world_bank_income_group` and the cohort value is an income-tier
  // string — looking up via the requested `world_bank_region` lens
  // would return null and render a muted swatch.
  const metaLens =
    peerSet.lensUsed && peerSet.lensUsed !== "global"
      ? peerSet.lensUsed
      : lens;
  const meta = getPeerLensValueMeta(metaLens, peerSet.cohortValue);
  const cohortColor = meta?.colorVar ?? "var(--color-text-30)";

  return (
    <div className="peer-lens-panel">
      <div className="peer-lens-panel__header">
        <span className="peer-lens-panel__lens-label">{lensDisplay}</span>
        <SourceDot source={sourceId} retrievedAt={peerSet.retrievedAt} />
      </div>
      <div
        className="peer-lens-panel__cohort-label"
        style={{ color: cohortColor }}
      >
        <span
          aria-hidden="true"
          className="peer-lens-panel__cohort-swatch"
          style={{ background: cohortColor }}
        />
        {meta?.label ?? peerSet.cohortLabel}
      </div>
      {rank ? (
        <div className="peer-lens-panel__rank">
          <span className="peer-lens-panel__rank-position">
            #{rank.position}
          </span>
          <span className="peer-lens-panel__rank-of">
            of {rank.total}
          </span>
        </div>
      ) : (
        <div className="peer-lens-panel__rank peer-lens-panel__rank--no-score">
          {peerSet.n} {peerSet.n === 1 ? "country" : "countries"} in cohort
        </div>
      )}
      {peerSet.fallbackChain.length > 0 ? (
        <div className="peer-lens-panel__fallback-note">
          {fallbackNote(peerSet.fallbackChain, peerSet.lensUsed)}
        </div>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────── */

function fallbackNote(
  chain: PeerSetFallbackReason[],
  finalLens?: string,
): string {
  if (chain.length === 0) return "";
  const first = chain[0];
  if (first === "non_sovereign_or_uncovered") {
    return "Not classified by the upstream source. See methodology page for coverage limits.";
  }
  if (first === "no_classification") {
    return "No classification yet for this country. Showing global comparison.";
  }
  // n_below_threshold — describe the substitution.
  const used =
    finalLens === "global"
      ? "global"
      : finalLens === "world_bank_region"
        ? "region only"
        : finalLens === "world_bank_income_group"
          ? "income group only"
          : finalLens ?? "broader";
  return `Cohort below n ≥ 8 threshold; using ${used} comparison.`;
}
