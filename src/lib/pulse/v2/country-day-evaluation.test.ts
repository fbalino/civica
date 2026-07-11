import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  countryDayEvaluationSetErrors,
  countryDaySampleErrors,
  countryDayTraceSetErrors,
  PULSE_COUNTRY_DAY_SAMPLE_VERSION,
  PULSE_COUNTRY_DAY_SET_VERSION,
  PULSE_COUNTRY_DAY_TRACE_VERSION,
} from "./country-day-evaluation";

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validSample() {
  const stratumPopulation = 17_460;
  const stratumDraw = 536;
  const rows = Array.from({ length: 536 }, (_, index) => ({
    id: `sample-${index}`,
    stratum: "Africa|2026-04",
    continent: "Africa",
    month: "2026-04",
    analysisStatus: index < 482 ? "analysis_candidate" : "reserve",
    searchQueries: { institutions: "q1", accountabilitySecurity: "q2", broadCountryDay: "q3" },
    evidenceRefs: [],
    mediaEvidenceEnvironment: index < 5 ? "multi_family_5plus" : index < 35 ? "observed_below_threshold" : "no_retained_documents",
    primaryStratumDrawFraction: stratumDraw / stratumPopulation,
    primaryBaseWeight: stratumPopulation / stratumDraw,
    analysisWeightStatus: "requires_calibration_for_secondary_margin_repair",
    stratumPopulation,
    stratumDraw,
    stratumAnalysisTarget: 482,
  }));
  const body = { schemaVersion: PULSE_COUNTRY_DAY_SAMPLE_VERSION, frame: "country_day_retrieval_probability", seed: "test-seed", population: stratumPopulation, initialDraw: 536, analysisTarget: 482, reserveTarget: 54, quotas: { "Africa|2026-04": 536 }, rows };
  return { ...body, semanticSha256: digest(body) };
}

test("country-day packets accept a complete unlabeled weighted draw", () => {
  assert.deepEqual(countryDaySampleErrors(validSample()), []);
});

test("country-day packets reject labels and bad weights", () => {
  const row = { id: "x", analysisStatus: "analysis_candidate", searchQueries: { a: "q", b: "q", c: "q" }, evidenceRefs: [], mediaEvidenceEnvironment: "no_retained_documents", primaryStratumDrawFraction: 0.5, primaryBaseWeight: 3, analysisWeightStatus: "requires_calibration_for_secondary_margin_repair", goldLabel: "no_event" };
  const sample = { schemaVersion: PULSE_COUNTRY_DAY_SAMPLE_VERSION, initialDraw: 536, analysisTarget: 482, reserveTarget: 54, rows: [row], semanticSha256: "bad" };
  const errors = countryDaySampleErrors(sample);
  assert.ok(errors.some((error) => error.includes("label leaked")));
  assert.ok(errors.some((error) => error.includes("weight")));
});

test("evaluation packets must preserve exact sample and search-trace linkage", () => {
  const sample = validSample();
  const traces = sample.rows.map((row) => {
    const queryTraces = Object.entries(row.searchQueries).map(([family, query]) => {
      const body = { schemaVersion: "pulse-country-day-search-query-trace/v1", family, query, provider: "firecrawl-search/news", cliVersion: "test", capturedAt: "2026-07-11T00:00:00.000Z", resultLimit: 5, resultCount: 0, results: [] };
      return { ...body, queryTraceSha256: digest(body) };
    });
    const body = { schemaVersion: PULSE_COUNTRY_DAY_TRACE_VERSION, sampleId: row.id, queryTraces, totalResultCount: 0, contentPolicy: "url_title_date_only_no_snippet_or_page_body" };
    return { ...body, traceSha256: digest(body) };
  });
  const traceBody = { schemaVersion: "pulse-country-day-search-trace-set/v1", sampleVersion: sample.schemaVersion, sampleSha256: sample.semanticSha256, completed: true, traceCount: traces.length, traces };
  const traceSet = { ...traceBody, semanticSha256: digest(traceBody) };
  const setBody = {
    schemaVersion: PULSE_COUNTRY_DAY_SET_VERSION,
    protocolVersion: "pulse-evaluation-sampling-frame/v1",
    sampleSha256: sample.semanticSha256,
    traceSetSha256: traceSet.semanticSha256,
    labelStatus: "unlabeled",
    allowedCoderOutcomes: ["qualifying_event", "true_negative", "retrieval_miss", "insufficient_observation", "out_of_scope"],
    rows: sample.rows.map((row, index) => ({ sampleId: row.id, analysisStatus: row.analysisStatus, evidenceRefs: row.evidenceRefs, searchTraceSha256: traces[index].traceSha256 })),
  };
  const set = { ...setBody, semanticSha256: digest(setBody) };
  assert.deepEqual(countryDayTraceSetErrors(traceSet, sample), []);
  assert.deepEqual(countryDayEvaluationSetErrors(set, sample, traceSet), []);
  set.rows[0].analysisStatus = "reserve";
  const errors = countryDayEvaluationSetErrors(set, sample, traceSet);
  assert.ok(errors.some((error) => error.includes("analysis status drifted")));
  assert.ok(errors.some((error) => error.includes("semantic hash drifted")));
});
