import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/data/frozen-vintage";

export const PULSE_DRIFT_MONITOR_VERSION = "pulse-drift-monitor/v1" as const;
export const PULSE_DRIFT_THRESHOLD_VERSION =
  "pulse-drift-thresholds/v1" as const;
export const PULSE_DRIFT_BASELINE_SCHEMA_VERSION =
  "pulse-drift-baseline/v1" as const;
export const PULSE_DRIFT_OBSERVATION_SCHEMA_VERSION =
  "pulse-drift-observation/v1" as const;
export const PULSE_DRIFT_ALERT_SCHEMA_VERSION =
  "pulse-drift-alert/v1" as const;

/** The monitor looks at a fixed trailing period. It never advances a
 * baseline itself: a baseline is an explicit, immutable capture. */
export const PULSE_DRIFT_WINDOW_DAYS = 28;
export const PULSE_DRIFT_MINIMUM_CORE_ROWS = 100;
export const PULSE_DRIFT_MINIMUM_METRIC_ROWS = 20;

export const PULSE_DRIFT_METRICS = [
  "source_mix",
  "language_mix",
  "model_versions",
  "taxonomy_labels",
  "corroboration_weight",
  "abstention",
  "review_overturns",
] as const;

export type PulseDriftMetric = (typeof PULSE_DRIFT_METRICS)[number];

export const PULSE_DRIFT_THRESHOLDS: Readonly<
  Record<PulseDriftMetric, number>
> = {
  source_mix: 0.3,
  language_mix: 0.3,
  // A changed model/version is also a dedicated hard alert below. The
  // distance threshold catches a materially different mix of known models.
  model_versions: 0.15,
  taxonomy_labels: 0.35,
  corroboration_weight: 0.25,
  abstention: 0.15,
  review_overturns: 0.15,
};

export type PulseDriftStanding =
  | "no_baseline"
  | "insufficient_evidence"
  | "within_threshold"
  | "alerts_open";

export interface PulseDriftRowRef {
  relation: string;
  ids: string[];
}

export interface PulseDriftBucketInput {
  key: string;
  count: number;
  rowRef: PulseDriftRowRef;
}

export interface PulseDriftBucket extends PulseDriftBucketInput {
  share: number;
}

export interface PulseDriftMetricSnapshot {
  metric: PulseDriftMetric;
  total: number;
  buckets: PulseDriftBucket[];
}

export interface PulseDriftSnapshot {
  schemaVersion: typeof PULSE_DRIFT_MONITOR_VERSION;
  thresholdVersion: typeof PULSE_DRIFT_THRESHOLD_VERSION;
  thresholds: Readonly<Record<PulseDriftMetric, number>>;
  runtimeMethodVersion: string;
  windowStart: string;
  windowEnd: string;
  metrics: PulseDriftMetricSnapshot[];
}

export interface PulseDriftAlertCandidate {
  metric: PulseDriftMetric;
  distance: number;
  threshold: number;
  reason: "distribution_shift" | "novel_model_version";
  affectedBuckets: Array<{
    key: string;
    baselineShare: number;
    observedShare: number;
    rowRef: PulseDriftRowRef;
  }>;
  remediationPath: string;
}

export interface PulseDriftAssessment {
  standing: PulseDriftStanding;
  metricStates: Array<{
    metric: PulseDriftMetric;
    total: number;
    baselineTotal: number | null;
    status: "not_evaluated" | "insufficient_evidence" | "within_threshold" | "alert";
    distance: number | null;
    threshold: number;
  }>;
  alerts: PulseDriftAlertCandidate[];
}

export interface PulseDriftBaseline {
  id: string;
  baselineKey: string;
  runtimeMethodVersion: string;
  snapshot: PulseDriftSnapshot;
  createdAt: string;
}

function canonicalTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid Pulse drift timestamp: ${value}`);
  }
  return date.toISOString();
}

function assertMetric(metric: string): asserts metric is PulseDriftMetric {
  if (!PULSE_DRIFT_METRICS.includes(metric as PulseDriftMetric)) {
    throw new Error(`Unsupported Pulse drift metric: ${metric}`);
  }
}

function normalizedRef(rowRef: PulseDriftRowRef): PulseDriftRowRef {
  const relation = rowRef.relation.trim();
  if (!/^[a-z][a-z0-9_]{0,99}$/.test(relation)) {
    throw new Error(`Pulse drift row reference has invalid relation: ${relation}`);
  }
  const ids = [...new Set(rowRef.ids.map((id) => id.trim()).filter(Boolean))]
    .sort()
    .slice(0, 20);
  return { relation, ids };
}

function normalizedBuckets(
  rows: readonly PulseDriftBucketInput[],
): PulseDriftBucket[] {
  const byKey = new Map<
    string,
    { count: number; rowRef: PulseDriftRowRef }
  >();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key || key.length > 160) {
      throw new Error("Pulse drift bucket keys must be non-empty and bounded");
    }
    if (!Number.isSafeInteger(row.count) || row.count < 0) {
      throw new Error(`Pulse drift bucket ${key} has an invalid count`);
    }
    const rowRef = normalizedRef(row.rowRef);
    const existing = byKey.get(key);
    if (existing && existing.rowRef.relation !== rowRef.relation) {
      throw new Error(`Pulse drift bucket ${key} mixes source relations`);
    }
    if (existing) {
      existing.count += row.count;
      existing.rowRef.ids = [...new Set([...existing.rowRef.ids, ...rowRef.ids])]
        .sort()
        .slice(0, 20);
    } else {
      byKey.set(key, { count: row.count, rowRef });
    }
  }
  const total = [...byKey.values()].reduce((sum, row) => sum + row.count, 0);
  return [...byKey.entries()]
    .map(([key, value]) => ({
      key,
      count: value.count,
      rowRef: value.rowRef,
      share: total === 0 ? 0 : value.count / total,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

/** Build a canonical, aggregate-only monitoring snapshot. The caller supplies
 * bounded row identifiers solely so an operational alert can point back to
 * the affected evidence without copying source payloads. */
export function buildPulseDriftSnapshot(input: {
  runtimeMethodVersion: string;
  windowStart: string;
  windowEnd: string;
  metricRows: Readonly<Record<PulseDriftMetric, readonly PulseDriftBucketInput[]>>;
}): PulseDriftSnapshot {
  const runtimeMethodVersion = input.runtimeMethodVersion.trim();
  if (!runtimeMethodVersion) throw new Error("Pulse drift runtime method is required");
  const windowStart = canonicalTimestamp(input.windowStart);
  const windowEnd = canonicalTimestamp(input.windowEnd);
  if (windowStart >= windowEnd) {
    throw new Error("Pulse drift window must end after it starts");
  }
  const metrics = PULSE_DRIFT_METRICS.map((metric) => {
    const buckets = normalizedBuckets(input.metricRows[metric]);
    return {
      metric,
      total: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
      buckets,
    };
  });
  return {
    schemaVersion: PULSE_DRIFT_MONITOR_VERSION,
    thresholdVersion: PULSE_DRIFT_THRESHOLD_VERSION,
    thresholds: { ...PULSE_DRIFT_THRESHOLDS },
    runtimeMethodVersion,
    windowStart,
    windowEnd,
    metrics,
  };
}

export function pulseDriftSnapshotSha256(snapshot: PulseDriftSnapshot): string {
  return createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

export function pulseDriftBaselineKey(snapshot: PulseDriftSnapshot): string {
  return `pulse-drift-baseline/sha256:${pulseDriftSnapshotSha256(snapshot)}`;
}

export function pulseDriftObservationKey(input: {
  scoreRunId: string;
  baselineId: string | null;
  snapshot: PulseDriftSnapshot;
}): string {
  return `pulse-drift-observation/sha256:${createHash("sha256")
    .update(
      stableStringify({
        scoreRunId: input.scoreRunId,
        baselineId: input.baselineId,
        snapshot: input.snapshot,
      }),
    )
    .digest("hex")}`;
}

export function pulseDriftAlertKey(input: {
  observationKey: string;
  alert: PulseDriftAlertCandidate;
}): string {
  return `pulse-drift-alert/sha256:${createHash("sha256")
    .update(
      stableStringify({
        observationKey: input.observationKey,
        metric: input.alert.metric,
        reason: input.alert.reason,
        affectedBuckets: input.alert.affectedBuckets.map((bucket) => bucket.key),
      }),
    )
    .digest("hex")}`;
}

export function pulseDriftRemediationPath(metric: PulseDriftMetric): string {
  assertMetric(metric);
  return `data/PULSE-DRIFT-MONITORING.md#${metric.replaceAll("_", "-")}`;
}

function metricByName(
  snapshot: PulseDriftSnapshot,
  metric: PulseDriftMetric,
): PulseDriftMetricSnapshot {
  const found = snapshot.metrics.find((row) => row.metric === metric);
  if (!found) throw new Error(`Pulse drift snapshot is missing ${metric}`);
  return found;
}

function shareByKey(metric: PulseDriftMetricSnapshot): Map<string, number> {
  return new Map(metric.buckets.map((bucket) => [bucket.key, bucket.share]));
}

function totalVariationDistance(
  baseline: PulseDriftMetricSnapshot,
  observed: PulseDriftMetricSnapshot,
): number {
  const baselineShares = shareByKey(baseline);
  const observedShares = shareByKey(observed);
  const keys = new Set([...baselineShares.keys(), ...observedShares.keys()]);
  return [...keys].reduce(
    (sum, key) =>
      sum + Math.abs((baselineShares.get(key) ?? 0) - (observedShares.get(key) ?? 0)),
    0,
  ) / 2;
}

function affectedBuckets(input: {
  baseline: PulseDriftMetricSnapshot;
  observed: PulseDriftMetricSnapshot;
  threshold: number;
}): PulseDriftAlertCandidate["affectedBuckets"] {
  const baselineShares = shareByKey(input.baseline);
  const floor = Math.max(0.01, input.threshold / 4);
  const changed = input.observed.buckets
    .map((bucket) => ({
      key: bucket.key,
      baselineShare: baselineShares.get(bucket.key) ?? 0,
      observedShare: bucket.share,
      rowRef: bucket.rowRef,
    }))
    .filter((bucket) => Math.abs(bucket.observedShare - bucket.baselineShare) >= floor)
    .sort(
      (left, right) =>
        Math.abs(right.observedShare - right.baselineShare) -
          Math.abs(left.observedShare - left.baselineShare) ||
        left.key.localeCompare(right.key),
    );
  return (changed.length ? changed : input.observed.buckets.slice(0, 1).map((bucket) => ({
    key: bucket.key,
    baselineShare: baselineShares.get(bucket.key) ?? 0,
    observedShare: bucket.share,
    rowRef: bucket.rowRef,
  }))).slice(0, 10);
}

/** Compare one snapshot against one explicitly captured baseline. A monitor
 * never treats a missing or small metric as a zero; it reports that state as
 * insufficient evidence instead. */
export function assessPulseDrift(input: {
  baseline: PulseDriftSnapshot | null;
  observed: PulseDriftSnapshot;
}): PulseDriftAssessment {
  if (!input.baseline) {
    return {
      standing: "no_baseline",
      metricStates: PULSE_DRIFT_METRICS.map((metric) => ({
        metric,
        total: metricByName(input.observed, metric).total,
        baselineTotal: null,
        status: "not_evaluated",
        distance: null,
        threshold: input.observed.thresholds[metric],
      })),
      alerts: [],
    };
  }
  if (input.baseline.runtimeMethodVersion !== input.observed.runtimeMethodVersion) {
    throw new Error("Pulse drift baseline and observation use different methods");
  }
  if (
    input.baseline.thresholdVersion !== input.observed.thresholdVersion ||
    stableStringify(input.baseline.thresholds) !==
      stableStringify(input.observed.thresholds)
  ) {
    throw new Error("Pulse drift baseline and observation use different thresholds");
  }

  const alerts: PulseDriftAlertCandidate[] = [];
  const metricStates = PULSE_DRIFT_METRICS.map((metric) => {
    const baseline = metricByName(input.baseline!, metric);
    const observed = metricByName(input.observed, metric);
    const threshold = input.observed.thresholds[metric];
    if (
      baseline.total < PULSE_DRIFT_MINIMUM_METRIC_ROWS ||
      observed.total < PULSE_DRIFT_MINIMUM_METRIC_ROWS
    ) {
      return {
        metric,
        total: observed.total,
        baselineTotal: baseline.total,
        status: "insufficient_evidence" as const,
        distance: null,
        threshold,
      };
    }
    const distance = totalVariationDistance(baseline, observed);
    const baselineKeys = new Set(baseline.buckets.map((bucket) => bucket.key));
    const hasNovelModel =
      metric === "model_versions" &&
      observed.buckets.some((bucket) => !baselineKeys.has(bucket.key));
    if (distance >= threshold || hasNovelModel) {
      alerts.push({
        metric,
        distance,
        threshold,
        reason: hasNovelModel ? "novel_model_version" : "distribution_shift",
        affectedBuckets: affectedBuckets({ baseline, observed, threshold }),
        remediationPath: pulseDriftRemediationPath(metric),
      });
      return {
        metric,
        total: observed.total,
        baselineTotal: baseline.total,
        status: "alert" as const,
        distance,
        threshold,
      };
    }
    return {
      metric,
      total: observed.total,
      baselineTotal: baseline.total,
      status: "within_threshold" as const,
      distance,
      threshold,
    };
  });
  return {
    standing: alerts.length
      ? "alerts_open"
      : metricStates.some((metric) => metric.status === "insufficient_evidence")
        ? "insufficient_evidence"
        : "within_threshold",
    metricStates,
    alerts,
  };
}

/** A baseline needs enough retained source evidence to make its central
 * source/language/model distributions meaningful. Sparse review outcomes are
 * deliberately retained as insufficient-evidence metrics rather than blocking
 * baseline creation forever before independent review begins. */
export function pulseDriftBaselineEligibility(
  snapshot: PulseDriftSnapshot,
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const metric of ["source_mix", "language_mix", "model_versions"] as const) {
    if (metricByName(snapshot, metric).total < PULSE_DRIFT_MINIMUM_CORE_ROWS) {
      reasons.push(`${metric} has fewer than ${PULSE_DRIFT_MINIMUM_CORE_ROWS} retained rows`);
    }
  }
  return { eligible: reasons.length === 0, reasons };
}
