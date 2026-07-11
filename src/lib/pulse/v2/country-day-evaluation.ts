import { createHash } from "node:crypto";

export const PULSE_COUNTRY_DAY_SAMPLE_VERSION = "pulse-country-day-evaluation-sample/v1" as const;
export const PULSE_COUNTRY_DAY_TRACE_VERSION = "pulse-country-day-search-trace/v2" as const;
export const PULSE_COUNTRY_DAY_SET_VERSION = "pulse-country-day-evaluation-set/v1" as const;

function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function hashSerialized(value: string) { return createHash("sha256").update(value).digest("hex"); }

type Artifact = Record<string, unknown>;

interface CountryDaySampleRow extends Artifact {
  id: string;
  stratum: string;
  continent: string;
  month: string;
  analysisStatus: string;
  searchQueries?: Record<string, string>;
  evidenceRefs?: unknown[];
  primaryStratumDrawFraction: number;
  primaryBaseWeight: number;
  analysisWeightStatus: string;
  stratumPopulation: number;
  stratumDraw: number;
  stratumAnalysisTarget: number;
  mediaEvidenceEnvironment: string;
}

interface SearchResult extends Artifact {
  rank: number;
  title: string;
  url: string;
}

interface QueryTrace extends Artifact {
  schemaVersion: string;
  family: string;
  query: string;
  provider: string;
  cliVersion: string;
  capturedAt: string;
  resultLimit: number;
  resultCount: number;
  queryTraceSha256: string;
  results?: SearchResult[];
}

interface CountryDayTrace extends Artifact {
  schemaVersion: string;
  sampleId: string;
  contentPolicy: string;
  traceSha256: string;
  totalResultCount: number;
  queryTraces?: QueryTrace[];
}

interface EvaluationRow extends Artifact {
  sampleId: string;
  analysisStatus: string;
  evidenceRefs: unknown[];
  searchTraceSha256: string;
}

const ALLOWED_CODER_OUTCOMES = [
  "qualifying_event",
  "true_negative",
  "retrieval_miss",
  "insufficient_observation",
  "out_of_scope",
] as const;

function withoutHash(artifact: Artifact, key: string): Artifact {
  const body = { ...artifact };
  delete body[key];
  return body;
}

export function countryDaySampleErrors(sample: Artifact, population?: Artifact): string[] {
  const errors: string[] = [];
  if (sample.schemaVersion !== PULSE_COUNTRY_DAY_SAMPLE_VERSION) errors.push("wrong sample version");
  if (population) {
    const identityHashes = population.identityHashes as Artifact | undefined;
    const counts = population.counts as Artifact | undefined;
    if (sample.protocolVersion !== population.protocolVersion || sample.populationFreezeAt !== population.populationFreezeAt || sample.populationArtifactSha256 !== population.semanticSha256 || sample.countryDayFrameSha256 !== identityHashes?.countryDayCartesianFrame || sample.population !== counts?.countryDays) errors.push("sample is not linked to the frozen population");
  }
  if (sample.initialDraw !== 536 || sample.analysisTarget !== 482 || sample.reserveTarget !== 54) errors.push("sample targets drifted");
  if (sample.frame !== "country_day_retrieval_probability" || typeof sample.seed !== "string" || !sample.seed) errors.push("sample frame or seed drifted");
  if (!Array.isArray(sample.rows) || sample.rows.length !== 536) errors.push("sample must contain 536 rows");
  const rows = Array.isArray(sample.rows) ? sample.rows as CountryDaySampleRow[] : [];
  const quotas = sample.quotas && typeof sample.quotas === "object" ? sample.quotas as Record<string, number> : {};
  if (Object.values(quotas).reduce((sum, value) => sum + value, 0) !== 536) errors.push("primary quotas do not sum to the draw");
  const ids = new Set<string>();
  const stratumCounts = new Map<string, number>();
  const analysisCounts = new Map<string, number>();
  let analysis = 0;
  for (const row of rows) {
    if (ids.has(row.id)) errors.push(`duplicate sample id ${row.id}`);
    ids.add(row.id);
    stratumCounts.set(row.stratum, (stratumCounts.get(row.stratum) ?? 0) + 1);
    if (row.analysisStatus === "analysis_candidate") {
      analysis++;
      analysisCounts.set(row.stratum, (analysisCounts.get(row.stratum) ?? 0) + 1);
    }
    else if (row.analysisStatus !== "reserve") errors.push(`${row.id}: invalid analysis status`);
    if (!row.searchQueries || JSON.stringify(Object.keys(row.searchQueries).sort()) !== JSON.stringify(["accountabilitySecurity", "broadCountryDay", "institutions"]) || !row.evidenceRefs || !Array.isArray(row.evidenceRefs)) errors.push(`${row.id}: incomplete evidence packet`);
    if (row.stratum !== `${row.continent}|${row.month}` || quotas[row.stratum] !== row.stratumDraw || row.stratumDraw > row.stratumPopulation || Math.abs(row.primaryStratumDrawFraction - row.stratumDraw / row.stratumPopulation) > 1e-12 || Math.abs(row.primaryBaseWeight - 1 / row.primaryStratumDrawFraction) > 1e-9 || row.analysisWeightStatus !== "requires_calibration_for_secondary_margin_repair") errors.push(`${row.id}: invalid primary base weight`);
    if ("goldLabel" in row || "truth" in row || "modelCorrect" in row) errors.push(`${row.id}: label leaked into selection artifact`);
  }
  if (analysis !== 482) errors.push(`analysis count is ${analysis}`);
  for (const [stratum, quota] of Object.entries(quotas)) {
    if (stratumCounts.get(stratum) !== quota) errors.push(`${stratum}: primary quota drifted`);
    const target = rows.find((row) => row.stratum === stratum)?.stratumAnalysisTarget;
    if (analysisCounts.get(stratum) !== target) errors.push(`${stratum}: analysis target drifted`);
  }
  const environments = Object.fromEntries(["multi_family_5plus", "observed_below_threshold", "no_retained_documents"].map((key) => [key, rows.filter((row) => row.mediaEvidenceEnvironment === key).length]));
  if (environments.multi_family_5plus !== 5 || environments.observed_below_threshold !== 30 || environments.no_retained_documents !== 501) errors.push("media-evidence margins are incomplete");
  if (sample.semanticSha256 !== hash(withoutHash(sample, "semanticSha256"))) errors.push("sample semantic hash drifted");
  return errors;
}

export function countryDayTraceSetErrors(traceSet: Artifact, sample: Artifact): string[] {
  const errors: string[] = [];
  if (traceSet.schemaVersion !== "pulse-country-day-search-trace-set/v1") errors.push("wrong trace-set version");
  if (traceSet.sampleSha256 !== sample.semanticSha256) errors.push("trace set points to another sample");
  const traces = Array.isArray(traceSet.traces) ? traceSet.traces as CountryDayTrace[] : [];
  if (traceSet.completed !== true || traceSet.traceCount !== 536 || traces.length !== 536) errors.push("trace set is incomplete");
  const sampleRows = Array.isArray(sample.rows) ? sample.rows as CountryDaySampleRow[] : [];
  const sampleById = new Map(sampleRows.map((row) => [row.id, row]));
  const sampleIds = new Set(sampleById.keys());
  const traceIds = new Set<string>();
  for (const trace of traces) {
    if (trace.schemaVersion !== PULSE_COUNTRY_DAY_TRACE_VERSION) errors.push(`${trace.sampleId}: wrong trace version`);
    if (!sampleIds.has(trace.sampleId) || traceIds.has(trace.sampleId)) errors.push(`${trace.sampleId}: unmatched or duplicate trace`);
    traceIds.add(trace.sampleId);
    const sampled = sampleById.get(trace.sampleId);
    if (trace.contentPolicy !== "url_title_date_only_no_snippet_or_page_body") errors.push(`${trace.sampleId}: unsafe content policy`);
    const queryTraces = Array.isArray(trace.queryTraces) ? trace.queryTraces : [];
    const families = queryTraces.map((row) => row.family).sort();
    const expectedFamilies = Object.keys(sampled?.searchQueries ?? {}).sort();
    if (queryTraces.length !== 3 || new Set(families).size !== 3 || JSON.stringify(families) !== JSON.stringify(expectedFamilies)) errors.push(`${trace.sampleId}: query families are incomplete`);
    const serialized = JSON.stringify(trace);
    if (/"(?:snippet|markdown|html|imageUrl|pageBody|raw)"\s*:/i.test(serialized)) errors.push(`${trace.sampleId}: publisher payload leaked`);
    if (trace.traceSha256 !== hashSerialized(JSON.stringify(withoutHash(trace, "traceSha256")))) errors.push(`${trace.sampleId}: trace hash drifted`);
    for (const queryTrace of queryTraces) {
      const queryBody = withoutHash(queryTrace, "queryTraceSha256");
      const results = Array.isArray(queryTrace.results) ? queryTrace.results : [];
      const queryMatches = sampled?.searchQueries?.[queryTrace.family] === queryTrace.query;
      const metadataValid = queryTrace.schemaVersion === "pulse-country-day-search-query-trace/v1" && Boolean(queryTrace.cliVersion) && !Number.isNaN(Date.parse(queryTrace.capturedAt)) && queryTrace.resultLimit === 5 && queryTrace.resultCount === results.length && results.length <= queryTrace.resultLimit;
      if (!queryMatches || !metadataValid || !["firecrawl-search/news", "firecrawl-search/web-fallback"].includes(queryTrace.provider) || queryTrace.queryTraceSha256 !== hashSerialized(JSON.stringify(queryBody))) errors.push(`${trace.sampleId}/${queryTrace.family}: query trace drifted`);
      for (const [index, result] of results.entries()) {
        if (result.rank !== index + 1 || !/^https?:\/\//.test(result.url) || !result.title) errors.push(`${trace.sampleId}/${queryTrace.family}: malformed result ${index + 1}`);
      }
    }
    if (trace.totalResultCount !== queryTraces.reduce((sum, queryTrace) => sum + queryTrace.resultCount, 0)) errors.push(`${trace.sampleId}: aggregate result count drifted`);
  }
  if (traceSet.semanticSha256 !== hashSerialized(JSON.stringify(withoutHash(traceSet, "semanticSha256")))) errors.push("trace-set semantic hash drifted");
  return errors;
}

export function countryDayEvaluationSetErrors(set: Artifact, sample: Artifact, traceSet: Artifact): string[] {
  const errors: string[] = [];
  if (set.schemaVersion !== PULSE_COUNTRY_DAY_SET_VERSION) errors.push("wrong evaluation-set version");
  if (set.sampleSha256 !== sample.semanticSha256) errors.push("evaluation set points to another sample");
  if (set.traceSetSha256 !== traceSet.semanticSha256) errors.push("evaluation set points to another trace set");
  if (set.labelStatus !== "unlabeled") errors.push("evaluation set was labeled before independent coding");
  if (JSON.stringify(set.allowedCoderOutcomes) !== JSON.stringify(ALLOWED_CODER_OUTCOMES)) errors.push("coder outcomes drifted");

  const sampleRows = Array.isArray(sample.rows) ? sample.rows as CountryDaySampleRow[] : [];
  const traces = Array.isArray(traceSet.traces) ? traceSet.traces as CountryDayTrace[] : [];
  const rows = Array.isArray(set.rows) ? set.rows as EvaluationRow[] : [];
  if (rows.length !== 536) errors.push("evaluation set must contain 536 packets");
  const sampleById = new Map(sampleRows.map((row) => [row.id, row]));
  const traceById = new Map(traces.map((trace) => [trace.sampleId, trace]));
  const ids = new Set<string>();
  for (const row of rows) {
    const sampled = sampleById.get(row.sampleId);
    const trace = traceById.get(row.sampleId);
    if (ids.has(row.sampleId)) errors.push(`${row.sampleId}: duplicate evaluation packet`);
    ids.add(row.sampleId);
    if (!sampled || !trace) {
      errors.push(`${row.sampleId}: packet is not linked to the frozen inputs`);
      continue;
    }
    if (row.analysisStatus !== sampled.analysisStatus) errors.push(`${row.sampleId}: analysis status drifted`);
    if (JSON.stringify(row.evidenceRefs) !== JSON.stringify(sampled.evidenceRefs)) errors.push(`${row.sampleId}: evidence references drifted`);
    if (row.searchTraceSha256 !== trace.traceSha256) errors.push(`${row.sampleId}: search trace drifted`);
    if (["coderOutcome", "goldLabel", "truth", "adjudicatedLabel"].some((key) => key in row)) errors.push(`${row.sampleId}: label leaked into evaluation packet`);
  }
  if (ids.size !== sampleRows.length || sampleRows.some((row) => !ids.has(row.id))) errors.push("evaluation set does not cover the frozen sample exactly");
  if (set.semanticSha256 !== hashSerialized(JSON.stringify(withoutHash(set, "semanticSha256")))) errors.push("evaluation-set semantic hash drifted");
  return errors;
}
