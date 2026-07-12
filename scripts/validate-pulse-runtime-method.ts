/**
 * Validate the generated Pulse runtime-method snapshot against the code that
 * actually runs the pipeline.
 *
 * Offline (default):
 *   - byte-compare the generated snapshot with a fresh deterministic render
 *   - recompute the self-excluding SHA-256 contract hash
 *   - compare Vercel cron cadence, provider/taxonomy/scoring constants, and
 *     source-code-only runtime seams that are not exported as constants
 *   - reject credential-like fields or values
 *
 * Optional live mode (`--live`) additionally compares the source IDs present
 * in Neon `raw_events` with the contract's observed-evidence source set. No
 * connection string, credential, event text, count, or URL is printed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { config as dotenvConfig } from "dotenv";
import { neon } from "@neondatabase/serverless";

import {
  CURRENT_PULSE_RUNTIME_METHOD,
  createPulseRuntimeMethodSnapshot,
  pulseContractHash,
  renderPulseRuntimeMethodSnapshot,
  type PulseRuntimeMethodSnapshot,
} from "../src/lib/pulse/v2/runtime-contract";
import {
  DEFAULT_ENSEMBLE,
  DEFAULT_ENSEMBLE_VERIFY,
  PROVIDER_DEFAULT_MODEL,
} from "../src/lib/pulse/v2/provider";
import {
  DELTA_LOWER_BOUND,
  DELTA_UPPER_BOUND,
  EVENT_CATEGORIES,
  HUMAN_REVIEW_TIERS,
  SCORE_WINDOW_DAYS,
} from "../src/lib/pulse/v2/taxonomy";
import { PULSE_DIMENSIONS } from "../src/lib/pulse/v2/types";

const ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(
  ROOT,
  "src/lib/pulse/v2/runtime-method.generated.json",
);

interface VercelConfig {
  crons?: Array<{ path: string; schedule: string }>;
}

interface ValidationState {
  checks: number;
  errors: string[];
}

function parseArgs(argv: readonly string[]): { live: boolean } {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      [
        "Validate Civica Pulse's generated runtime-method contract.",
        "",
        "Usage:",
        "  npx tsx scripts/validate-pulse-runtime-method.ts",
        "  npx tsx scripts/validate-pulse-runtime-method.ts --live",
        "",
        "--live compares contract-active source IDs with Neon raw_events.",
      ].join("\n"),
    );
    process.exit(0);
  }
  const unknown = args.filter((arg) => arg !== "--live");
  if (unknown.length > 0) {
    throw new Error(
      `Unknown argument${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
    );
  }
  return { live: args.includes("--live") };
}

function relative(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function check(
  state: ValidationState,
  condition: boolean,
  message: string,
): void {
  state.checks += 1;
  if (!condition) state.errors.push(message);
}

function checkEqual(
  state: ValidationState,
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  check(
    state,
    isDeepStrictEqual(actual, expected),
    `${message}; expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

function sorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function validateNoSecrets(
  state: ValidationState,
  value: unknown,
  location = "snapshot",
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateNoSecrets(state, item, `${location}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      check(
        state,
        !/(?:api[_-]?key|secret|password|access[_-]?token|credential)$/i.test(
          key,
        ),
        `${location}.${key} looks like a credential-bearing field`,
      );
      validateNoSecrets(state, child, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === "string") {
    check(
      state,
      !/(?:postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._-]+|\bsk-[a-z0-9_-]{12,})/i.test(
        value,
      ),
      `${location} contains a credential-like value`,
    );
  }
}

function validateSnapshot(state: ValidationState): PulseRuntimeMethodSnapshot {
  const expectedSnapshot = createPulseRuntimeMethodSnapshot();
  const expectedBytes = renderPulseRuntimeMethodSnapshot(expectedSnapshot);
  let actualBytes = "";
  try {
    actualBytes = readFileSync(SNAPSHOT_PATH, "utf8");
  } catch {
    state.errors.push(
      "Generated snapshot is missing; run npx tsx scripts/generate-pulse-runtime-method.ts",
    );
    return expectedSnapshot;
  }

  check(
    state,
    actualBytes === expectedBytes,
    "Generated snapshot is stale or not canonical; rerun the generator",
  );

  let parsed: PulseRuntimeMethodSnapshot;
  try {
    parsed = JSON.parse(actualBytes) as PulseRuntimeMethodSnapshot;
  } catch (error) {
    state.errors.push(
      `Generated snapshot is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return expectedSnapshot;
  }

  check(
    state,
    /^[a-f0-9]{64}$/.test(parsed.contractHash),
    "contractHash must be a lowercase SHA-256 hex digest",
  );
  checkEqual(
    state,
    parsed.contractHash,
    pulseContractHash(parsed),
    "contractHash must hash the canonical body with contractHash omitted",
  );
  validateNoSecrets(state, parsed);
  return parsed;
}

function validateCadence(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): void {
  const vercel = JSON.parse(relative("vercel.json")) as VercelConfig;
  const actual = (vercel.crons ?? [])
    .filter((cron) => cron.path.startsWith("/api/cron/pulse/"))
    .map((cron) => ({ path: cron.path, schedule: cron.schedule }));
  const expected = snapshot.cadence.stages.map((stage) => ({
    path: stage.route,
    schedule: stage.cron,
  }));
  checkEqual(
    state,
    actual,
    expected,
    "Vercel Pulse cron routes and schedules must match the contract exactly",
  );

  const scoreStage = snapshot.cadence.stages.find(
    (stage) => stage.stage === "score",
  );
  checkEqual(
    state,
    scoreStage?.operations,
    ["corroborate", "score"],
    "The daily score stage must declare corroboration before scoring",
  );
  const scoreRoute = relative("src/app/api/cron/pulse/v2/score/route.ts");
  const corroborateAt = scoreRoute.indexOf("await corroborateEvents(db)");
  const scoreAt = scoreRoute.indexOf("await calculateDimensionalDeltas(db)");
  check(
    state,
    corroborateAt >= 0 && scoreAt > corroborateAt,
    "The scheduled score route must execute corroboration before dimensional scoring",
  );
}

function validateExportedRuntimeConstants(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): void {
  checkEqual(
    state,
    snapshot.providers.classify.engines,
    DEFAULT_ENSEMBLE,
    "Classify engines must match DEFAULT_ENSEMBLE",
  );
  checkEqual(
    state,
    snapshot.providers.verify.engine,
    DEFAULT_ENSEMBLE_VERIFY,
    "Verify engine must match DEFAULT_ENSEMBLE_VERIFY",
  );
  checkEqual(
    state,
    snapshot.providers.backtest.engine,
    { provider: "anthropic", model: PROVIDER_DEFAULT_MODEL.anthropic },
    "Backtest default must remain a separate Anthropic single-engine diagnostic",
  );
  checkEqual(
    state,
    snapshot.taxonomy.categoryCount,
    EVENT_CATEGORIES.length,
    "Taxonomy category count must match EVENT_CATEGORIES",
  );
  checkEqual(
    state,
    snapshot.taxonomy.dimensions,
    PULSE_DIMENSIONS,
    "Taxonomy dimensions must match PULSE_DIMENSIONS",
  );
  checkEqual(
    state,
    snapshot.publicationPolicy.reviewGates.absoluteSeverityTiers,
    sorted([...HUMAN_REVIEW_TIERS]),
    "Absolute human-review tiers must match HUMAN_REVIEW_TIERS",
  );
  checkEqual(
    state,
    snapshot.numericDeltas.trailingWindowDays,
    SCORE_WINDOW_DAYS,
    "Scoring window must match SCORE_WINDOW_DAYS",
  );
  checkEqual(
    state,
    snapshot.numericDeltas.boundsPerDimension,
    { lower: DELTA_LOWER_BOUND, upper: DELTA_UPPER_BOUND },
    "Per-dimension bounds must match taxonomy constants",
  );
}

function validateClassifierAndReview(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): void {
  const classify = relative("src/lib/pulse/v2/classify.ts");
  const classifierPrompt = relative("src/lib/pulse/v2/classifier-prompt.ts");
  const ensemble = relative("src/lib/pulse/v2/ensemble.ts");
  const publicationGate = relative("src/lib/pulse/v2/publication-gate.ts");
  const subject = relative("src/lib/pulse/v2/country-attribution.ts");
  const schema = relative("src/lib/db/schema.ts");
  const reviewRoute = relative("src/app/api/admin/pulse-review/[id]/route.ts");

  for (const [fragment, message] of [
    [
      "HUMAN_REVIEW_TIERS.has(consensus.severityTier)",
      "Ensemble review must retain the absolute severity-tier gate",
    ],
    [
      'consensus.agreement !== "all"',
      "Weak consensus must require a non-unanimous classifier result",
    ],
    [
      "consensus.selfConfidence < 0.7 || consensus.degraded",
      "Weak consensus must use the 0.7 confidence threshold or degradation",
    ],
    [
      "opts.forceReview ||",
      "Deadlock and invalid-category paths must be able to force review",
    ],
  ] as const) {
    check(state, publicationGate.includes(fragment), message);
  }

  check(
    state,
    [
      'verify.confidence === "low"',
      'verify.verdict === "revised"',
      'verify.verdict === "rejected"',
      "!verify.categoryOk",
      "!verify.severityOk",
      "!verify.subjectOk",
      "!verify.isEvent",
    ].every((fragment) => publicationGate.includes(fragment)),
    "Verifier objection must include low confidence, revised/rejected verdicts, and every negative axis",
  );
  check(
    state,
    classify.includes("singleEngineRequiresReview(") &&
      publicationGate.includes("export function singleEngineRequiresReview") &&
      publicationGate.includes("verifierObjects(verify)"),
    "Single-engine mode must route every verifier objection to review",
  );
  check(
    state,
    classify.includes("normalizeInvalidConsensusForReview(consensus)") &&
      publicationGate.includes('category: "none"') &&
      snapshot.publicationPolicy.reviewGates
        .invalidConsensusCategoryPersistence === "normalize_to_none_unresolved",
    "Invalid consensus categories must persist as unresolved rather than leak through a fallback dimension",
  );
  check(
    state,
    classifierPrompt.includes('typeof selfConfidence !== "number"') &&
      classifierPrompt.includes("!Number.isFinite(selfConfidence)") &&
      classifierPrompt.includes("selfConfidence < 0") &&
      classifierPrompt.includes("selfConfidence > 1") &&
      classifierPrompt.includes('typeof severityValue !== "number"') &&
      classifierPrompt.includes("!Number.isFinite(severityValue)"),
    "Classifier parser must reject nonnumeric, non-finite, or out-of-range gate inputs",
  );
  check(
    state,
    snapshot.providers.classify.invalidSelfConfidencePolicy ===
      "reject_response_as_unusable" &&
      snapshot.providers.classify.severityValuePolicy ===
        "require_finite_number_then_tier_clamp" &&
      snapshot.providers.verify.malformedVerdictOrAxesPolicy ===
        "reject_as_failed_objection",
    "Contract must disclose classifier and verifier malformed-response policies",
  );
  check(
    state,
    subject.includes("export function parseSubjectVerdict") &&
      subject.includes("/^[A-Z]{3}$/") &&
      subject.includes('candidate.evidence_refs.length === 0') &&
      snapshot.providers.subject.responseValidation ===
        "strict_scope_roles_iso3_rationale_and_evidence_shape",
    "Subject attribution must validate scope, roles, ISO3, rationale, and evidence references",
  );

  for (const [fragment, message] of [
    [
      'reviewStatus: result.autoPublished ? "approved" : "pending"',
      "Classifier writes must distinguish auto-published and queued states",
    ],
    [
      "const subject = await resolveSubject(",
      "Current classifications must run subject-country attribution",
    ],
  ] as const) {
    check(state, classify.includes(fragment), message);
  }
  check(
    state,
    classify.includes("opts.resolveSubject ?? resolveSubjectJurisdiction"),
    "Production classification must default to the subject-country attribution implementation",
  );

  check(
    state,
    ensemble.includes("strict majority (> half of successful voters)") &&
      ensemble.includes("if (voterCount < 2)") &&
      ensemble.includes("winningCount > voterCount / 2"),
    "Ensemble code must retain strict-majority consensus with a two-voter minimum quorum",
  );
  check(
    state,
    schema.includes(
      'humanReviewed: boolean("human_reviewed").notNull().default(false)',
    ) && !/humanReviewed\s*:\s*true/.test(classify),
    "Auto-published classifier rows must not be represented as human-reviewed",
  );
  check(
    state,
    reviewRoute.includes("validatePulseClassification") &&
      reviewRoute.includes('body.action !== "reject"') &&
      reviewRoute.includes("validation.classification"),
    "Human approval/edit must validate a resolved taxonomy-consistent classification",
  );
  check(
    state,
    snapshot.publicationPolicy.reviewGates.verifierObjectionWithWeakConsensus
      .selfConfidenceBelow === 0.7,
    "Contract weak-consensus threshold must remain exact",
  );
  check(
    state,
    snapshot.publicationPolicy.reviewGates.verifierObjectionWithWeakConsensus
      .selfConfidenceAggregation === "maximum_among_winning_category_voters",
    "Contract must name the actual winning-voter confidence aggregation",
  );
  check(
    state,
    snapshot.providers.classify.degradedRunsRecorded === false &&
      snapshot.providers.classify.successfulProviderRunsRecorded === true &&
      snapshot.providers.classify.configuredProviderSetPersisted === true &&
      snapshot.providers.classify.providerFailuresPersisted === false,
    "Contract must distinguish persisted configuration from missing per-provider failure detail",
  );
  check(
    state,
    snapshot.publicationPolicy.states.humanApproved.humanReviewed === true &&
      snapshot.publicationPolicy.states.humanEdited.reviewStatus === "edited" &&
      snapshot.publicationPolicy.states.humanRejected.published === false &&
      snapshot.publicationPolicy.states.humanRejected.reviewStatus ===
        "rejected",
    "Contract must include approved, edited, and rejected human-review outcomes",
  );
}

function validateProviderRoles(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): void {
  const subject = relative("src/lib/pulse/v2/country-attribution.ts");
  const entities = relative("src/lib/pulse/v2/jurisdiction-entities.ts");
  const summary = relative("src/lib/pulse/v2/summarize.ts");
  const backtest = relative("src/lib/pulse/v2/backtest.ts");

  check(
    state,
    subject.includes(
      `export const SUBJECT_ATTRIBUTION_MODEL = "${snapshot.providers.subject.engine.model}"`,
    ) ||
      subject.includes(
        `const MODEL = "${snapshot.providers.subject.engine.model}"`,
      ),
    "Subject-attribution model must match the runtime contract",
  );
  check(
    state,
    subject.includes('input.verdict.scope === "unclear"') &&
      subject.includes('input.verdict.scope === "supranational"') &&
      subject.includes('input.verdict.scope === "multi"') &&
      entities.includes("humanReadableJurisdictionContext") &&
      snapshot.providers.subject.inputContext ===
        "human_readable_versioned_entity_candidates",
    "Subject attribution must support cross-border roles, abstain explicitly, and receive human-readable versioned entity context",
  );
  check(
    state,
    summary.includes(
      `export const PULSE_REVIEW_SUMMARY_MODEL = "${snapshot.providers.reviewSummary.engine.model}"`,
    ) ||
      summary.includes(
        `const SUMMARY_MODEL = "${snapshot.providers.reviewSummary.engine.model}"`,
      ),
    "Review-summary model must match the runtime contract",
  );
  check(
    state,
    backtest.includes("const BACKTEST_CONFIG = resolveBacktestConfig()") &&
      backtest.includes(': "anthropic";') &&
      backtest.includes("PROVIDER_DEFAULT_MODEL[provider]"),
    "Backtest must remain a separately resolved, Anthropic-default single engine",
  );
  check(
    state,
    snapshot.providers.backtest.matchesCurrentProduction === false &&
      snapshot.evaluation.backtestMatchesCurrentProduction === false &&
      snapshot.evaluation.currentProductionValidatedByExistingBacktest ===
        false,
    "The snapshot must not misrepresent the old single-engine backtest as current-production validation",
  );
}

function validateConnectors(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): void {
  const ingest = relative("src/lib/pulse/v2/ingest.ts");
  const scheduledConnectorIds = sorted(
    [...ingest.matchAll(/\{\s*source:\s*"([a-z_]+)",\s*fetcher:/g)].map(
      (match) => match[1],
    ),
  );
  const contractConnectorIds = sorted(
    snapshot.feeds.connectors.map((connector) => connector.connectorId),
  );
  checkEqual(
    state,
    scheduledConnectorIds,
    contractConnectorIds,
    "Every ingest connector must appear in the contract and vice versa",
  );

  const sourceFiles = [
    "src/lib/pulse/v2/sources/acled.ts",
    "src/lib/pulse/v2/sources/civicus.ts",
    "src/lib/pulse/v2/sources/gdelt.ts",
    "src/lib/pulse/v2/sources/hrw-amnesty.ts",
    "src/lib/pulse/v2/sources/ipu-actions.ts",
    "src/lib/pulse/v2/sources/reuters-ap.ts",
    "src/lib/pulse/v2/sources/rsf.ts",
    "src/lib/pulse/v2/sources/vdem-pulse.ts",
  ];
  const sourceText = sourceFiles.map(relative).join("\n");
  const declaredSourceIds = [
    ...sourceText.matchAll(/const SOURCE_ID = "([a-z_]+)"/g),
    ...sourceText.matchAll(/fetchOne\([^\n]+, "([a-z_]+)", map\)/g),
  ].map((match) => match[1]);
  const contractSourceIds = snapshot.feeds.connectors.flatMap(
    (connector) => connector.sourceIds,
  );
  checkEqual(
    state,
    sorted(declaredSourceIds),
    sorted(contractSourceIds),
    "Connector-emitted source IDs must match the contract",
  );

  checkEqual(
    state,
    snapshot.feeds.observedEvidence.sourceIds,
    ["amnesty", "civicus_monitor", "gdelt", "hrw"],
    "Only production-observed raw-event feeds may be listed as active",
  );
  check(
    state,
    relative("src/lib/pulse/v2/sources/acled.ts").includes(
      "if (!apiKey || !email)",
    ) &&
      relative("src/lib/pulse/v2/sources/rsf.ts").includes("if (!FEED_URL)") &&
      relative("src/lib/pulse/v2/sources/reuters-ap.ts").includes(
        'process.env.REUTERS_RSS_URL ?? ""',
      ) &&
      relative("src/lib/pulse/v2/sources/reuters-ap.ts").includes(
        'process.env.AP_RSS_URL ?? ""',
      ),
    "Access/configuration-gated connector statuses must remain true in code",
  );
  check(
    state,
    relative("src/lib/pulse/v2/sources/vdem-pulse.ts").includes(
      "return { rows: [], fetched: 0 }",
    ) &&
      relative("src/lib/pulse/v2/sources/ipu-actions.ts").includes(
        "STATUS: scaffold only",
      ),
    "Placeholder and sparse-scaffold connector statuses must remain true in code",
  );
}

function validateClusteringAndScoring(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): void {
  const cluster = relative("src/lib/pulse/v2/cluster.ts");
  const resolution = relative("src/lib/pulse/v2/incident-resolution.ts");
  const incidentStore = relative("src/lib/pulse/v2/incident-store.ts");
  check(
    state,
    resolution.includes(
      `PULSE_INCIDENT_SEMANTIC_CANDIDATE_THRESHOLD = ${snapshot.clustering.semantic.threshold}`,
    ) &&
      resolution.includes(
        `PULSE_INCIDENT_SEMANTIC_ONLY_CANDIDATE_THRESHOLD = ${snapshot.clustering.semantic.unanchoredThreshold}`,
      ) &&
      resolution.includes("identity.tokenSimilarity >= 0.45") &&
      resolution.includes("identity.anchorOverlap >= 0.8") &&
      cluster.includes(
        `export const CLUSTER_DATE_WINDOW_HOURS = ${snapshot.clustering.dateWindowHours}`,
      ),
    "Clustering thresholds and date window must match the contract",
  );
  check(
    state,
    cluster.includes("? (opts.embeddingResult ?? null)") &&
      cluster.includes(": await tryEmbedBatch(texts)") &&
      cluster.includes("const useEmbeddings = embeddings !== null") &&
      cluster.includes("loadActiveIncidentCandidates") &&
      cluster.includes("planIncidentResolution(incidentCandidates)") &&
      cluster.includes('finding.disposition !== "confirmed_merge"') &&
      resolution.includes('disposition = "candidate_merge"') &&
      resolution.includes("exact_normalized_within_window_classification_compatible") &&
      incidentStore.includes('eq(pulseEventsV2.projectionStatus, "current")') &&
      snapshot.clustering.countryPartitioned === false,
    "Clustering must compare persisted stable incidents, auto-merge only exact identities, and retain semantic/lexical candidates without a country partition",
  );

  const score = relative("src/lib/pulse/v2/score.ts");
  check(
    state,
    score.includes("WHERE published = true") &&
      score.includes("review_status IN ('approved', 'edited')") &&
      score.includes("category <> 'none'") &&
      score.includes("isPulseClassificationValid") &&
      score.includes("decayedImpact(") &&
      score.includes("DELTA_LOWER_BOUND") &&
      score.includes("DELTA_UPPER_BOUND"),
    "Dimensional scoring must use only published, decayed, bounded events",
  );
  check(
    state,
    score.includes("SELECT DISTINCT jurisdiction_id") &&
      score.includes("existingJurisdictionIds") &&
      score.includes("countriesSeen.add(jurisdictionId)"),
    "Dimensional scoring must revisit existing delta jurisdictions so aged-out rows clear",
  );
  check(
    state,
    !relative("content/methodology-pulse.md").includes(
      "stale rows are not yet reliably cleared",
    ),
    "Public methodology must not retain the superseded stale-delta-row limitation",
  );
  const pulseQueries = relative("src/lib/db/queries-pulse-v2.ts");
  check(
    state,
    pulseQueries.includes("SCORE_WINDOW_DAYS") &&
      pulseQueries.includes("eventDate} <= CURRENT_DATE") &&
      pulseQueries.includes("reviewStatus} IN ('approved', 'edited')") &&
      pulseQueries.includes("category} <> 'none'") &&
      pulseQueries.includes("delta: nEvents > 0 && deltaRow ?"),
    "Country Pulse evidence must use the scorer window/eligibility rules and null unsupported deltas",
  );
  const decouple = relative("src/lib/pulse/v2/decouple.ts");
  const calculateIndex = relative("scripts/calculate-ci-v2.ts");
  check(
    state,
    decouple.includes("corroborationConfidence: 0") &&
      calculateIndex.includes("decoupleAbsorbedEvents"),
    "Events absorbed into an Index recompute must be zeroed before Pulse recomputation",
  );
}

function validatePublicSurfaces(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): void {
  const pulseRoutes = [
    "src/app/api/v1/pulse/[country_slug]/dimensions/route.ts",
    "src/app/api/v1/pulse/[country_slug]/events/route.ts",
    "src/app/api/v1/pulse/changelog/v2/route.ts",
  ];
  for (const route of pulseRoutes) {
    const source = relative(route);
    check(
      state,
      source.includes("PULSE_METHODOLOGY_META") &&
        !source.includes("CI_METHODOLOGY_META"),
      `${route} must expose Pulse-specific methodology metadata`,
    );
  }

  const methodologyRoute = relative(
    "src/app/api/v1/pulse/methodology/route.ts",
  );
  check(
    state,
    methodologyRoute.includes("createPulseRuntimeMethodSnapshot"),
    "The public Pulse methodology endpoint must return the generated runtime contract",
  );

  const methodPage = relative(
    "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
  );
  const methodContent = relative("content/methodology-pulse.md");
  for (const marker of [
    "{{ctx.methodologyVersion}}",
    "{{ctx.sourceCoverageGeneratedAt}}",
    "{{ctx.operatingSourceCoverageRecords}}",
    "{{ctx.degradedFeedsProse}}",
    "{{ctx.inactiveFeedsProse}}",
    "{{ctx.classifyVotersProse}}",
    "{{ctx.verifierProse}}",
    "{{ctx.subjectAttributorProse}}",
    "{{ctx.reviewTiersProse}}",
    "{{ctx.scheduleProse}}",
    "{{ctx.scoreWindowDays}}",
    "{{ctx.deltaLowerBound}}",
    "{{ctx.deltaUpperBound}}",
  ]) {
    check(
      state,
      methodContent.includes(marker),
      `Pulse methodology must bind ${marker} from the runtime contract`,
    );
  }
  check(
    state,
    methodPage.includes("CURRENT_PULSE_RUNTIME_METHOD") &&
      methodPage.includes("loadPulseSourceCoverageReport") &&
      methodPage.includes("operatingSourceCoverageRecords") &&
      methodPage.includes("scheduleProse"),
    "The Pulse methodology page must materialize runtime-contract and live source-coverage values",
  );

  // CLM-012: api-docs/page.tsx no longer hand-imports
  // createPulseRuntimeMethodSnapshot itself — every example (including
  // pulse/methodology's) renders via renderExample(exampleId) from
  // src/lib/api/contract/examples.ts, which is where the runtime
  // snapshot is actually generated and schema-validated. Check both:
  // examples.ts does the generation, and page.tsx wires the endpoint
  // in without ever publishing a forbidden scalar Pulse ranking.
  const apiDocs = relative("src/app/api-docs/page.tsx");
  const contractExamples = relative("src/lib/api/contract/examples.ts");
  const contractRegistry = relative("src/lib/api/contract/registry.ts");
  check(
    state,
    contractRegistry.includes("/api/v1/pulse/methodology") &&
      contractExamples.includes("createPulseRuntimeMethodSnapshot") &&
      apiDocs.includes('"pulseMethodology"') &&
      !apiDocs.includes("sort=cp") &&
      !apiDocs.includes("ci | cp") &&
      !contractRegistry.includes("sort=cp") &&
      !contractRegistry.includes("ci | cp"),
    "API docs must generate the Pulse runtime example and publish no scalar ranking contract",
  );

  const backtestPage = relative(
    "src/app/(reader)/civica-index/methodology/pulse/backtest/page.tsx",
  );
  check(
    state,
    backtestPage.includes("These are not current-runtime validation results") &&
      backtestPage.includes("hand-curated") &&
      !backtestPage.includes("Current standing"),
    "The public backtest must be labelled as an earlier diagnostic, not current validation",
  );

  const changelogPage = relative(
    "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
  );
  const normalizedChangelogPage = changelogPage
    .toLowerCase()
    .replace(/\s+/g, " ");
  check(
    state,
    changelogPage.includes("high-positive") &&
      changelogPage.includes("severe-negative") &&
      changelogPage.includes("catastrophic-negative") &&
      changelogPage.includes("failed/unavailable verification") &&
      normalizedChangelogPage.includes("queued") &&
      normalizedChangelogPage.includes("rejected") &&
      normalizedChangelogPage.includes("legacy rejection") &&
      normalizedChangelogPage.includes("unverified") &&
      normalizedChangelogPage.includes("does not mean “human-reviewed"),
    "The changelog must state every review gate and distinguish auto, queued, and rejected outcomes",
  );

  const changelogApi = relative("src/app/api/v1/pulse/changelog/v2/route.ts");
  const pulseQueries = relative("src/lib/db/queries-pulse-v2.ts");
  check(
    state,
    changelogApi.includes('row.category === "none"') &&
      changelogApi.includes("dimension: null") &&
      changelogApi.includes("severityTier: null") &&
      changelogApi.includes("severityValue: null") &&
      pulseQueries.includes('e.category === "none" ? null : e.dimension') &&
      pulseQueries.includes('e.category === "none" ? null : e.severityTier') &&
      pulseQueries.includes(
        'category === "none" ? null : String(r.severity_tier)',
      ) &&
      pulseQueries.includes("publicationOriginFor") &&
      pulseQueries.includes("p.category <> 'none'") &&
      pulseQueries.includes("p.event_date <= CURRENT_DATE") &&
      pulseQueries.includes("filters.deltaEligibleOnly") &&
      pulseQueries.includes("p.review_status IN ('approved', 'edited')"),
    "Public Pulse APIs must not expose compatibility dimension/severity values as resolved classifications",
  );

  const publicScalarPaths = [
    "src/app/(reader)/country/[slug]/layout.tsx",
    "src/components/factbook/FactbookHeaderStrip.tsx",
    "src/lib/db/queries-scores.ts",
    "src/app/api/v1/index/rankings/route.ts",
    "src/app/api/v1/countries/[code]/route.ts",
    "src/app/embed/[slug]/route.ts",
  ];
  const prohibitedScalarFragments = [
    "cpDelta",
    "cpTrend",
    "pulseDailyScores",
    "pulseScore",
    "civicaPulse",
    'includeSet.has("cp")',
  ];
  for (const pathName of publicScalarPaths) {
    const source = relative(pathName);
    for (const fragment of prohibitedScalarFragments) {
      check(
        state,
        !source.includes(fragment),
        `${pathName} must not retain scalar Pulse fragment ${fragment}`,
      );
    }
  }

  const readmeTemplate = relative("README.template.md");
  check(
    state,
    readmeTemplate.includes("named per-dimension deltas") &&
      readmeTemplate.includes(
        "does not publish a merged Pulse score or Pulse ranking",
      ) &&
      readmeTemplate.includes("DeepSeek, GLM, and Anthropic voters"),
    "README template must match the public experimental dimensional contract and provider roles",
  );

  const siteState = relative("src/lib/content/site-state.ts");
  check(
    state,
    siteState.includes(`version: "${snapshot.taxonomy.version}"`) &&
      siteState.includes(`categoryCount: ${snapshot.taxonomy.categoryCount}`),
    "Reader site-state taxonomy version/count must match the runtime snapshot",
  );
  check(
    state,
    !siteState.includes("graduationThresholdRatio") &&
      siteState.includes("experimental governance-event ledger"),
    "Reader site-state must not preserve the obsolete smoke-test graduation gate",
  );

  const indexMethod = relative("content/methodology-civica-index.md");
  const agentDocs = relative("AGENTS.md");
  check(
    state,
    indexMethod.includes("/api/v1/pulse/source-coverage") &&
      agentDocs.includes("/api/v1/pulse/source-coverage") &&
      agentDocs.includes("not an operating verdict"),
    "Secondary docs must defer operating-feed truth to the live source-coverage contract",
  );

  check(
    state,
    methodContent.includes("failed/unavailable verification") &&
      methodContent.includes("not comparable as one method series") &&
      methodContent.includes("failed provider") &&
      methodContent.includes("independent evidence groups") &&
      methodContent.includes(
        "does not establish state ownership or full editorial independence",
      ) &&
      methodContent.includes("{{ctx.sourceIndependenceVersion}}"),
    "Pulse methodology must disclose failed verification, explicit mixed/legacy version boundaries, persistence limits, and evidence-group semantics",
  );
}

async function validateLiveFeeds(
  state: ValidationState,
  snapshot: PulseRuntimeMethodSnapshot,
): Promise<"checked" | "skipped"> {
  dotenvConfig({
    path: path.join(ROOT, ".env.local"),
    override: true,
    quiet: true,
  });
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.warn(
      "Live Pulse feed check skipped: DATABASE_URL is not configured.",
    );
    return "skipped";
  }

  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT DISTINCT source_id
    FROM raw_events
    ORDER BY source_id
  `;
  const actual = sorted(
    rows.map((row) => String((row as Record<string, unknown>).source_id)),
  );
  checkEqual(
    state,
    actual,
    snapshot.feeds.observedEvidence.sourceIds,
    "Live raw_events source IDs must match the observed-evidence source set",
  );
  const latestRows = await sql`
    SELECT MAX(created_at)::date::text AS observed_through
    FROM raw_events
  `;
  const observedThrough = latestRows[0]
    ? String((latestRows[0] as Record<string, unknown>).observed_through ?? "")
    : "";
  checkEqual(
    state,
    observedThrough,
    snapshot.feeds.observedEvidence.observedThrough,
    "Live raw_events evidence cut must match observedEvidence.observedThrough",
  );
  return "checked";
}

async function main(): Promise<void> {
  const { live } = parseArgs(process.argv);
  const state: ValidationState = { checks: 0, errors: [] };
  const snapshot = validateSnapshot(state);

  checkEqual(
    state,
    CURRENT_PULSE_RUNTIME_METHOD.version,
    snapshot.version,
    "In-memory method version must match the checked snapshot",
  );
  check(
    state,
    snapshot.status === "experimental" &&
      snapshot.mixed_legacy_unversioned === false &&
      snapshot.numericDeltas.publicStatus === "public_experimental" &&
      snapshot.numericDeltas.inputMethodCoverage ===
        "row_level_versioned_with_explicit_legacy" &&
      snapshot.numericDeltas.scalar === "none",
    "Experimental status, explicit row-level legacy identity, public per-dimension deltas, and no scalar must remain explicit",
  );

  validateCadence(state, snapshot);
  validateExportedRuntimeConstants(state, snapshot);
  validateClassifierAndReview(state, snapshot);
  validateProviderRoles(state, snapshot);
  validateConnectors(state, snapshot);
  validateClusteringAndScoring(state, snapshot);
  validatePublicSurfaces(state, snapshot);

  let liveStatus: "not-requested" | "checked" | "skipped" = "not-requested";
  if (live) liveStatus = await validateLiveFeeds(state, snapshot);

  if (state.errors.length > 0) {
    console.error(
      `Pulse runtime-method validation failed (${state.errors.length} error${state.errors.length === 1 ? "" : "s"}):`,
    );
    for (const error of state.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Pulse runtime-method validation OK (${state.checks} checks; live=${liveStatus}; hash=${snapshot.contractHash}).`,
  );
}

main().catch((error) => {
  console.error(
    `Pulse runtime-method validation crashed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
