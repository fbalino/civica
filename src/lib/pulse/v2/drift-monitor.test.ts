import assert from "node:assert/strict";
import test from "node:test";

import {
  assessPulseDrift,
  buildPulseDriftSnapshot,
  pulseDriftBaselineEligibility,
  pulseDriftBaselineKey,
  pulseDriftObservationKey,
  type PulseDriftMetric,
  type PulseDriftBucketInput,
} from "./drift-monitor";

const METRICS = [
  "source_mix",
  "language_mix",
  "model_versions",
  "taxonomy_labels",
  "corroboration_weight",
  "abstention",
  "review_overturns",
] as const satisfies readonly PulseDriftMetric[];

function rows(
  relation: string,
  entries: Array<[string, number]>,
): PulseDriftBucketInput[] {
  return entries.map(([key, count], index) => ({
    key,
    count,
    rowRef: { relation, ids: [`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`] },
  }));
}

function snapshot(overrides: Partial<Record<PulseDriftMetric, PulseDriftBucketInput[]>> = {}) {
  const metricRows = Object.fromEntries(
    METRICS.map((metric) => [
      metric,
      overrides[metric] ?? rows("pulse_events_v2", [["stable", 50], ["other", 50]]),
    ]),
  ) as Record<PulseDriftMetric, PulseDriftBucketInput[]>;
  return buildPulseDriftSnapshot({
    runtimeMethodVersion: "pulse-v2.15-beta",
    windowStart: "2026-07-01T00:00:00.000Z",
    windowEnd: "2026-07-29T00:00:00.000Z",
    metricRows,
  });
}

test("drift snapshots normalize buckets and stable keys", () => {
  const value = snapshot({
    source_mix: [
      ...rows("raw_events", [["gdelt", 30]]),
      ...rows("raw_events", [["gdelt", 20], ["civicus", 50]]),
    ],
  });
  const source = value.metrics.find((metric) => metric.metric === "source_mix");
  assert.deepEqual(source?.buckets.map(({ key, count, share }) => ({ key, count, share })), [
    { key: "civicus", count: 50, share: 0.5 },
    { key: "gdelt", count: 50, share: 0.5 },
  ]);
  assert.equal(pulseDriftBaselineKey(value), pulseDriftBaselineKey(value));
  assert.equal(
    pulseDriftObservationKey({ scoreRunId: "score-run", baselineId: null, snapshot: value }),
    pulseDriftObservationKey({ scoreRunId: "score-run", baselineId: null, snapshot: value }),
  );
});

test("a seeded source-mix shift produces a bounded alert with affected row references", () => {
  const baseline = snapshot({
    source_mix: rows("raw_events", [["gdelt", 50], ["civicus", 50]]),
  });
  const observed = snapshot({
    source_mix: rows("raw_events", [["gdelt", 90], ["civicus", 10]]),
  });
  const result = assessPulseDrift({ baseline, observed });
  assert.equal(result.standing, "alerts_open");
  const alert = result.alerts.find((candidate) => candidate.metric === "source_mix");
  assert.ok(alert);
  assert.equal(alert.reason, "distribution_shift");
  assert.ok(alert.distance >= alert.threshold);
  assert.equal(alert.affectedBuckets[0]?.rowRef.relation, "raw_events");
  assert.match(alert.remediationPath, /#source-mix$/);
});

test("a new model version alerts even when its share is below the categorical threshold", () => {
  const baseline = snapshot({
    model_versions: rows("pulse_pipeline_runs", [["classify:one/a", 100]]),
  });
  const observed = snapshot({
    model_versions: rows("pulse_pipeline_runs", [["classify:one/a", 90], ["classify:two/b", 10]]),
  });
  const result = assessPulseDrift({ baseline, observed });
  const alert = result.alerts.find((candidate) => candidate.metric === "model_versions");
  assert.ok(alert);
  assert.equal(alert.reason, "novel_model_version");
});

test("missing baseline and sparse metrics never become an invented zero", () => {
  const observed = snapshot({
    review_overturns: rows("pulse_event_decisions", [["overturned", 3]]),
  });
  assert.equal(assessPulseDrift({ baseline: null, observed }).standing, "no_baseline");
  const baseline = snapshot({
    review_overturns: rows("pulse_event_decisions", [["overturned", 2]]),
  });
  const result = assessPulseDrift({ baseline, observed });
  const review = result.metricStates.find((metric) => metric.metric === "review_overturns");
  assert.equal(review?.status, "insufficient_evidence");
  assert.equal(result.alerts.some((alert) => alert.metric === "review_overturns"), false);
});

test("a snapshot cannot silently compare under changed thresholds", () => {
  const baseline = snapshot();
  const original = snapshot();
  const observed = {
    ...original,
    thresholds: { ...original.thresholds, source_mix: 0.1 },
  };
  assert.throws(
    () => assessPulseDrift({ baseline, observed }),
    /different thresholds/,
  );
});

test("baseline eligibility requires retained core distributions but not human-review outcomes", () => {
  const ready = snapshot({
    source_mix: rows("raw_events", [["gdelt", 100]]),
    language_mix: rows("raw_events", [["en", 100]]),
    model_versions: rows("pulse_pipeline_runs", [["classify:one/a", 100]]),
    review_overturns: [],
  });
  assert.deepEqual(pulseDriftBaselineEligibility(ready), { eligible: true, reasons: [] });
  const sparse = snapshot({ source_mix: rows("raw_events", [["gdelt", 99]]) });
  assert.equal(pulseDriftBaselineEligibility(sparse).eligible, false);
});
