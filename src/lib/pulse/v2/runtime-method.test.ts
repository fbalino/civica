import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  CURRENT_PULSE_RUNTIME_FACTS,
  CURRENT_PULSE_RUNTIME_METHOD,
  buildPulseRuntimeMethod,
  createPulseRuntimeMethodSnapshot,
  pulseContractHash,
  renderPulseRuntimeMethodSnapshot,
  type PulseRuntimeFacts,
  type PulseRuntimeMethodContract,
} from "./runtime-contract";

const GENERATED_PATH = fileURLToPath(
  new URL("./runtime-method.generated.json", import.meta.url),
);

test("current contract states the non-negotiable publication boundaries", () => {
  const method = CURRENT_PULSE_RUNTIME_METHOD;

  assert.equal(method.version, "pulse-v2.15-beta");
  assert.equal(method.taxonomy.version, "v2.0");
  assert.equal(method.status, "experimental");
  assert.equal(method.mixed_legacy_unversioned, false);
  assert.equal(method.numericDeltas.publicStatus, "public_experimental");
  assert.equal(method.numericDeltas.shape, "per_dimension");
  assert.equal(method.numericDeltas.scalar, "none");
  assert.equal(
    method.numericDeltas.inputMethodCoverage,
    "row_level_versioned_with_explicit_legacy",
  );
  assert.deepEqual(method.numericDeltas.boundsPerDimension, {
    lower: -15,
    upper: 10,
  });
  assert.equal(
    method.observability.noEventRule,
    "only_when_observation_is_sufficient",
  );
  assert.equal(method.observability.approximatePressFreedomEligible, false);
  assert.equal(method.observability.absentNumericEffect, "withheld");
  assert.equal(method.observability.countryQualityInference, "prohibited");
  assert.equal(method.numericDeltas.trailingWindowDays, 730);
  assert.equal(
    method.numericDeltas.windowBoundary,
    "inclusive_maximum_configured_half_life_days_future_excluded",
  );
  assert.deepEqual(method.numericDeltas.eventLifecycle, {
    version: "pulse-event-lifecycle/v1",
    supersession: "current_projection_only_with_retained_superseded_history",
    persistence:
      "never_inferred_from_an_earlier_event_or_extended_without_new_evidence",
    recurrence:
      "separately_accepted_later_event_with_its_own_date_and_incident",
  });
  assert.equal(
    method.numericDeltas.noEventState,
    "zero_tombstone_internal_public_null",
  );
  assert.equal(
    method.numericDeltas.outputHistory,
    "append_only_per_score_run_jurisdiction_dimension",
  );
  assert.equal(
    method.numericDeltas.writeAtomicity,
    "history_projection_and_run_completion_one_transaction",
  );
  assert.equal(
    method.numericDeltas.absorptionEvidence,
    "append_only_explicit_event_link_fixed_scale",
  );
  assert.equal(
    method.numericDeltas.currentAbsorptionStanding,
    "none_no_sequential_comparable_release",
  );
  assert.equal(
    method.numericDeltas.absorbedIntoIndexPolicy,
    "separate_versioned_decision_never_mutates_corroboration",
  );
  assert.equal(method.evaluation.backtestMatchesCurrentProduction, false);
  assert.equal(
    method.evaluation.currentProductionValidatedByExistingBacktest,
    false,
  );
  assert.equal(method.clustering.countryPartitioned, false);
  assert.equal(
    method.clustering.identityNormalization.provisionalJurisdictionRole,
    "diagnostic_not_partition",
  );
  assert.equal(
    method.clustering.semantic.model,
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  );
  assert.equal(method.corroboration.countingUnit, "independent_evidence_group");
  assert.equal(
    method.corroboration.sourceIndependence.unresolvedPublisherPolicy,
    "collapse_within_event",
  );
  assert.deepEqual(
    method.corroboration.sourceIndependence.reviewedPairThresholds,
    { precision: 0.95, recall: 0.9 },
  );
  assert.equal(
    method.corroboration.informationEnvironment.productionUse,
    "disabled_pending_rights_and_validation",
  );
  assert.equal(
    method.corroboration.informationEnvironment.coveragePolicy,
    "one_observed_or_missing_row_per_supported_jurisdiction",
  );
  assert.equal(
    method.corroboration.informationEnvironment.rerunPolicy,
    "classification_pin_is_append_only",
  );
  assert.equal(
    method.corroboration.informationEnvironment.observabilityUse,
    "disabled_until_rights_and_validation_pass",
  );
  assert.equal(
    method.corroboration.informationEnvironment.missingValuePolicy,
    "no_multiplier",
  );
  assert.equal(
    method.corroboration.informationEnvironment.validationStanding,
    "not_calibrated_bias_correction",
  );
  assert.equal(
    method.corroboration.informationEnvironment.candidateRelease.publisherRows,
    180,
  );
  assert.deepEqual(method.decisionLedger.decisionKinds, [
    "event_existence",
    "subject_attribution",
    "category_labels",
    "severity",
    "calibration",
    "corroboration",
    "publication",
  ]);
  assert.equal(method.decisionLedger.genericConfidenceField, "prohibited");
  assert.equal(
    method.decisionLedger.currentEventRowRole,
    "current_state_projection_not_decision_history",
  );
  assert.equal(
    method.providers.subject.attributionVersion,
    "pulse-jurisdiction-attribution/v2",
  );
  assert.deepEqual(method.providers.subject.acceptedScopes, [
    "single",
    "multi",
  ]);
  assert.equal(
    method.providers.subject.inputContext,
    "human_readable_versioned_entity_candidates",
  );
});

test("the runtime snapshot distinguishes observed evidence from operating state", () => {
  assert.equal(
    CURRENT_PULSE_RUNTIME_METHOD.feeds.observedEvidence.observedThrough,
    "2026-07-26",
  );
  assert.deepEqual(
    CURRENT_PULSE_RUNTIME_METHOD.feeds.observedEvidence.sourceIds,
    ["amnesty", "civicus_monitor", "gdelt", "hrw"],
  );

  const inactive = CURRENT_PULSE_RUNTIME_METHOD.feeds.connectors
    .filter((connector) => !connector.observedInProduction)
    .map((connector) => [connector.feedId, connector.status]);
  assert.deepEqual(inactive, [
    ["acled", "access_gated"],
    ["ap", "configuration_gated"],
    ["ipu", "sparse_scaffold"],
    ["reuters", "configuration_gated"],
    ["rsf", "configuration_gated"],
    ["vdem", "placeholder"],
  ]);
});

test("provider roles distinguish current ensemble, subject pass, review aid, and old backtest", () => {
  const providers = CURRENT_PULSE_RUNTIME_METHOD.providers;
  assert.deepEqual(providers.classify.engines, [
    { provider: "deepseek", model: "deepseek-v4-flash" },
    { provider: "glm", model: "glm-4.7" },
    { provider: "anthropic", model: "claude-haiku-4-5" },
  ]);
  assert.deepEqual(providers.verify.engine, {
    provider: "anthropic",
    model: "claude-haiku-4-5",
  });
  assert.deepEqual(providers.subject.engine, {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  });
  assert.equal(
    providers.subject.responseValidation,
    "strict_scope_roles_iso3_rationale_and_evidence_shape",
  );
  assert.equal(
    providers.subject.failurePolicy,
    "unresolved_no_automatic_publication",
  );
  assert.equal(providers.reviewSummary.affectsClassification, false);
  assert.equal(providers.reviewSummary.affectsNumericDelta, false);
  assert.equal(providers.backtest.mode, "single_engine_classify_verify");
  assert.equal(providers.backtest.matchesCurrentProduction, false);
  assert.deepEqual(providers.classify.selfConfidenceRange, {
    lower: 0,
    upper: 1,
  });
  assert.equal(
    providers.classify.invalidSelfConfidencePolicy,
    "reject_response_as_unusable",
  );
  assert.equal(
    providers.classify.severityValuePolicy,
    "require_finite_number_then_tier_clamp",
  );
  assert.equal(providers.classify.degradedRunsRecorded, false);
  assert.equal(providers.classify.successfulProviderRunsRecorded, true);
  assert.equal(providers.classify.configuredProviderSetPersisted, true);
  assert.equal(providers.classify.providerFailuresPersisted, false);
  assert.equal(
    providers.classify.agreementEvidence,
    "stored_provider_distinct_prompt_versioned_classify_runs",
  );
  assert.equal(providers.classify.singleEnginePublication, "queue_only");
  assert.equal(
    CURRENT_PULSE_RUNTIME_METHOD.publicationPolicy.automaticEligibility,
    "stored_ensemble_and_gate_and_resolved_subject",
  );
  assert.equal(
    providers.classify.stateSchemaVersion,
    "pulse-classification-state/v1",
  );
  assert.deepEqual(providers.classify.statuses, [
    "classified",
    "none",
    "retryable_failure",
    "terminal_failure",
  ]);
  assert.equal(
    providers.classify.queueOrder,
    "new_then_due_retry_oldest_first",
  );
  assert.equal(
    providers.classify.retryExhaustionDisposition,
    "terminal_failure",
  );
  assert.equal(providers.classify.noneDisposition, "terminal_none_not_failure");
  assert.equal(providers.classify.retryPolicy.maxAttempts, 3);
  assert.equal(
    providers.verify.malformedVerdictOrAxesPolicy,
    "reject_as_failed_objection",
  );
  assert.equal(
    providers.verify.invalidConfidencePolicy,
    "coerce_to_low_confidence_objection",
  );
});

test("review gates encode the actual ensemble boolean logic", () => {
  const policy = CURRENT_PULSE_RUNTIME_METHOD.publicationPolicy;
  assert.deepEqual(policy.reviewGates.absoluteSeverityTiers, [
    "catastrophic_neg",
    "high_pos",
    "severe_neg",
  ]);
  assert.equal(policy.reviewGates.deadlock, true);
  assert.equal(policy.reviewGates.noQuorum, true);
  assert.equal(
    policy.reviewGates.invalidConsensusCategoryPersistence,
    "normalize_to_none_unresolved",
  );
  assert.deepEqual(policy.reviewGates.verifierObjectionWithWeakConsensus, {
    verifierObjectionIncludes: [
      "low_confidence",
      "failed",
      "verdict_revised",
      "verdict_rejected",
      "category_not_ok",
      "severity_not_ok",
      "subject_not_ok",
      "not_event",
    ],
    weakConsensusRequiresNonUnanimous: true,
    selfConfidenceAggregation: "maximum_among_winning_category_voters",
    selfConfidenceBelow: 0.7,
    degradedRunAlsoWeak: true,
  });
  assert.deepEqual(policy.states.autoPublished, {
    published: true,
    reviewStatus: "approved",
    humanReviewed: false,
  });
  assert.deepEqual(policy.states.humanApproved, {
    published: true,
    reviewStatus: "approved",
    humanReviewed: true,
  });
  assert.deepEqual(policy.states.humanEdited, {
    published: true,
    reviewStatus: "edited",
    humanReviewed: true,
  });
  assert.deepEqual(policy.states.humanRejected, {
    published: false,
    reviewStatus: "rejected",
    humanReviewed: true,
  });
  assert.deepEqual(policy.states.legacyRejectedUnverified, {
    published: false,
    reviewStatus: "rejected",
    humanReviewed: false,
  });
  assert.deepEqual(policy.states.legacyQuarantined, {
    published: false,
    reviewStatus: "legacy_quarantined",
    humanReviewed: false,
  });
  assert.equal(
    CURRENT_PULSE_RUNTIME_METHOD.reviewServiceLevel.version,
    "pulse-review-sla/v1",
  );
  assert.deepEqual(CURRENT_PULSE_RUNTIME_METHOD.reviewServiceLevel.targets, {
    critical: { escalationAfterMs: 0, dueAfterMs: 86_400_000 },
    urgent: { escalationAfterMs: 86_400_000, dueAfterMs: 259_200_000 },
    standard: { escalationAfterMs: 432_000_000, dueAfterMs: 604_800_000 },
  });
  assert.equal(
    CURRENT_PULSE_RUNTIME_METHOD.reviewServiceLevel.dailyCompletenessRule,
    "withheld_on_breach_or_unknown",
  );
  assert.equal(
    CURRENT_PULSE_RUNTIME_METHOD.reviewServiceLevel.reportClockArithmetic,
    "explicit_timestamp_cast_before_interval",
  );
});

test("daily cadence includes corroboration and scoring in the score route", () => {
  assert.deepEqual(
    CURRENT_PULSE_RUNTIME_METHOD.cadence.stages.map((stage) => ({
      stage: stage.stage,
      cron: stage.cron,
      operations: stage.operations,
    })),
    [
      { stage: "ingest", cron: "0 8 * * *", operations: ["ingest"] },
      { stage: "cluster", cron: "20 8 * * *", operations: ["cluster"] },
      {
        stage: "classify",
        cron: "40 8 * * *",
        operations: ["classify", "verify", "subject_attribute"],
      },
      {
        stage: "score",
        cron: "0 9 * * *",
        operations: ["corroborate", "score"],
      },
    ],
  );
});

test("pure builder normalizes set-like fields without mutating its input", () => {
  const facts = structuredClone(
    CURRENT_PULSE_RUNTIME_FACTS,
  ) as PulseRuntimeFacts;
  const reversed: PulseRuntimeFacts = {
    ...facts,
    connectors: [...facts.connectors].reverse(),
    cadence: [...facts.cadence].reverse(),
    humanReviewTiers: [...facts.humanReviewTiers].reverse(),
  };
  const before = JSON.stringify(reversed);
  const built = buildPulseRuntimeMethod(reversed);

  assert.equal(JSON.stringify(reversed), before, "builder mutated its input");
  assert.deepEqual(
    built.feeds.connectors.map((connector) => connector.feedId),
    [...built.feeds.connectors.map((connector) => connector.feedId)].sort(),
  );
  assert.deepEqual(
    built.cadence.stages.map((stage) => stage.stage),
    ["ingest", "cluster", "classify", "score"],
  );
  assert.deepEqual(built.feeds.observedEvidence.sourceIds, [
    "amnesty",
    "civicus_monitor",
    "gdelt",
    "hrw",
  ]);
});

test("contract hash omits its own field and changes when contract content changes", () => {
  const snapshot = createPulseRuntimeMethodSnapshot();
  assert.equal(snapshot.contractHash, pulseContractHash(snapshot));
  assert.equal(
    pulseContractHash({ ...snapshot, contractHash: "tampered" }),
    snapshot.contractHash,
    "hash field accidentally participated in its own digest",
  );

  const changed: PulseRuntimeMethodContract = {
    ...CURRENT_PULSE_RUNTIME_METHOD,
    version: "pulse-v2.8-beta-test-change",
  };
  assert.notEqual(pulseContractHash(changed), snapshot.contractHash);
});

test("checked JSON is the exact canonical generator output", () => {
  const expected = renderPulseRuntimeMethodSnapshot();
  const actual = readFileSync(GENERATED_PATH, "utf8");
  assert.equal(actual, expected);
  assert.equal(actual.endsWith("\n"), true);
});
