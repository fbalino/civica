/**
 * Phase R.21 — dispute severity helpers.
 *
 * The "severity" of a `material_error` dispute is defined as
 *   |a - b| / fire_threshold
 * where `fire_threshold` is whatever the resolver's `isMaterialError`
 * guard used to fire the dispute in the first place — a percentage-
 * point absolute (`materialErrorPpThreshold`) for percentage-shaped
 * fact-keys, or a relative fraction (`materialErrorPctThreshold`) of
 * `max(|a|, |b|)` for count / USD / index-shaped fact-keys.
 *
 * A severity of 1.0 means "right at the fire threshold." Anything
 * below 1.0 means the resolver wouldn't currently fire — the dispute
 * is stale (typically a pre-threshold-raise leftover). Values above
 * 1.0 indicate genuinely critical disagreements; 2.0+ usually means
 * different upstreams are measuring different things or one is wildly
 * out of date.
 *
 * Severity is presentational only — it never changes the resolver's
 * canonical pick. Used by the operator queue UI for sort + filter.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2c.
 */

import { getFactKey } from "@/lib/factbook/reconcile/fact-keys";

export type SeverityBucket = "lo" | "mid" | "hi" | "xhi";

export const SEVERITY_BUCKETS: SeverityBucket[] = ["lo", "mid", "hi", "xhi"];

export const SEVERITY_BUCKET_LABELS: Record<SeverityBucket, string> = {
  lo: "Low",
  mid: "Mid",
  hi: "High",
  xhi: "Extreme",
};

/**
 * Bucket boundaries — half-open intervals.
 *   lo   < 0.5  (sub-threshold; usually stale)
 *   mid  0.5–1.5
 *   hi   1.5–3.0
 *   xhi  ≥ 3.0
 *
 * The `lo` bucket is below the resolver's strict-greater-than fire
 * threshold by design: stale disputes from prior thresholds land here.
 * The `mid` bucket straddles the threshold (0.5–1.5×) — fresh disputes
 * that are real but borderline.
 */
export const SEVERITY_BUCKET_RANGES: Record<
  SeverityBucket,
  { min: number; maxExclusive: number | null }
> = {
  lo: { min: 0, maxExclusive: 0.5 },
  mid: { min: 0.5, maxExclusive: 1.5 },
  hi: { min: 1.5, maxExclusive: 3.0 },
  xhi: { min: 3.0, maxExclusive: null },
};

export interface SeverityScore {
  /** Normalised severity (`|gap| / threshold`). `null` for non-numeric
   *  or for fact-keys that don't register a material-error threshold. */
  severity: number | null;
  /** Bucket — or `null` if severity is unavailable. */
  bucket: SeverityBucket | null;
  /** Absolute gap (`|a - b|`). `null` if either value is missing. */
  gap: number | null;
  /** The threshold the resolver used to fire — either `pp` or `pct`. */
  thresholdValue: number | null;
  /** "pp" for absolute percentage-point, "pct" for relative fraction. */
  thresholdKind: "pp" | "pct" | null;
}

/**
 * Compute the severity score for a `material_error` dispute. Returns
 * `null`-shaped score when the inputs are non-numeric or the fact-key
 * doesn't register a material-error threshold (e.g., Group A identity
 * disputes).
 */
export function computeSeverity(
  factKey: string,
  valueA: number | null,
  valueB: number | null,
): SeverityScore {
  if (valueA == null || valueB == null) {
    return {
      severity: null,
      bucket: null,
      gap: null,
      thresholdValue: null,
      thresholdKind: null,
    };
  }

  const def = getFactKey(factKey);
  if (!def) {
    return {
      severity: null,
      bucket: null,
      gap: Math.abs(valueA - valueB),
      thresholdValue: null,
      thresholdKind: null,
    };
  }

  const gap = Math.abs(valueA - valueB);

  // Mirror `resolver.ts::isMaterialError` precedence: pp threshold
  // wins when registered; pct threshold is the fallback.
  if (def.materialErrorPpThreshold != null) {
    const t = def.materialErrorPpThreshold;
    return {
      severity: t > 0 ? gap / t : null,
      bucket: t > 0 ? bucketFor(gap / t) : null,
      gap,
      thresholdValue: t,
      thresholdKind: "pp",
    };
  }

  if (def.materialErrorPctThreshold != null) {
    const denom = Math.max(Math.abs(valueA), Math.abs(valueB));
    if (denom === 0) {
      return {
        severity: null,
        bucket: null,
        gap,
        thresholdValue: def.materialErrorPctThreshold,
        thresholdKind: "pct",
      };
    }
    const effectiveThreshold = def.materialErrorPctThreshold * denom;
    return {
      severity: gap / effectiveThreshold,
      bucket: bucketFor(gap / effectiveThreshold),
      gap,
      thresholdValue: def.materialErrorPctThreshold,
      thresholdKind: "pct",
    };
  }

  return {
    severity: null,
    bucket: null,
    gap,
    thresholdValue: null,
    thresholdKind: null,
  };
}

function bucketFor(severity: number): SeverityBucket {
  if (severity >= SEVERITY_BUCKET_RANGES.xhi.min) return "xhi";
  if (severity >= SEVERITY_BUCKET_RANGES.hi.min) return "hi";
  if (severity >= SEVERITY_BUCKET_RANGES.mid.min) return "mid";
  return "lo";
}

/**
 * Pretty-print a severity for the queue UI badge.
 *   1.20 → "1.20× threshold"
 *   null → "—"
 */
export function formatSeverity(score: SeverityScore): string {
  if (score.severity == null) return "—";
  return `${score.severity.toFixed(2)}× threshold`;
}
