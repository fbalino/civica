/**
 * Machine-readable contract for the Pulse method that is running now.
 *
 * This is deliberately a description of the scheduled production path, not
 * a claim that every historical row was produced by that path. The Pulse
 * ledger predates method-version columns and contains legacy classifier-run
 * shapes. PUL-004 attaches those rows to explicit legacy stage runs without
 * pretending to know their historical method, prompt, model, or source basket.
 *
 * `buildPulseRuntimeMethod` is pure: all runtime facts arrive as input and
 * the result contains no dates derived from the clock, environment values,
 * credentials, database calls, or filesystem calls. The checked JSON
 * snapshot is generated from `CURRENT_PULSE_RUNTIME_FACTS` by
 * `scripts/generate-pulse-runtime-method.ts`.
 */

import { createHash } from "node:crypto";

import {
  DEFAULT_ENSEMBLE,
  DEFAULT_ENSEMBLE_VERIFY,
  PROVIDER_DEFAULT_MODEL,
  type ClassifierProvider,
  type ResolvedProviderConfig,
} from "./provider";
import {
  DELTA_LOWER_BOUND,
  DELTA_UPPER_BOUND,
  EVENT_CATEGORIES,
  HUMAN_REVIEW_TIERS,
  SCORE_WINDOW_DAYS,
} from "./taxonomy";
import {
  PULSE_SCORE_EVENT_LIFECYCLE_POLICY,
  PULSE_SCORE_WINDOW_BOUNDARY,
} from "./event-lifecycle";
import {
  PULSE_DIMENSIONS,
  type PulseDimension,
  type SeverityTier,
} from "./types";
import {
  SUBJECT_ATTRIBUTION_MODEL,
  SUBJECT_ATTRIBUTION_PROVIDER,
} from "./country-attribution";
import {
  PULSE_JURISDICTION_ATTRIBUTION_VERSION,
  PULSE_JURISDICTION_ENTITY_VERSION,
} from "./jurisdiction-entities";
import { PULSE_JURISDICTION_ALIAS_VERSION } from "./country-resolver";
import {
  PULSE_REVIEW_SUMMARY_MODEL,
  PULSE_REVIEW_SUMMARY_PROVIDER,
} from "./summarize";
import { PULSE_EMBEDDING_MODEL } from "./embed";
import { PULSE_EVENT_IDENTITY_VERSION } from "./event-identity";
import {
  PULSE_INCIDENT_COMPARISON_WINDOW_HOURS,
  PULSE_INCIDENT_RESOLUTION_VERSION,
  PULSE_INCIDENT_SEMANTIC_CANDIDATE_THRESHOLD,
  PULSE_INCIDENT_SEMANTIC_ONLY_CANDIDATE_THRESHOLD,
} from "./incident-resolution";
import {
  PULSE_SOURCE_INDEPENDENCE_VERSION,
  SOURCE_INDEPENDENCE_MIN_PRECISION,
  SOURCE_INDEPENDENCE_MIN_RECALL,
} from "./source-independence";
import {
  PULSE_EVENT_OBSERVATION_STATES,
  PULSE_OBSERVABILITY_THRESHOLDS,
  PULSE_OBSERVABILITY_VERSION,
  PULSE_OBSERVATION_STATES,
} from "./observability";
import {
  PULSE_INFORMATION_ENVIRONMENT_POLICY,
  PULSE_INFORMATION_ENVIRONMENT_VERSION,
  RSF_2026_CANDIDATE_RELEASE,
} from "./press-freedom";
import {
  PULSE_INFORMATION_ENVIRONMENT_PIN_METHOD,
  PULSE_INFORMATION_ENVIRONMENT_PIN_VERSION,
  PULSE_INFORMATION_ENVIRONMENT_RELEASE_VERSION,
} from "./information-environment-evidence";
import {
  PULSE_DECISION_KINDS,
  PULSE_DECISION_LEDGER_VERSION,
  type PulseDecisionKind,
} from "./decision-ledger";
import {
  PULSE_CLASSIFICATION_ATTEMPT_VERSION,
  PULSE_CLASSIFICATION_CLAIM_LEASE_MS,
  PULSE_CLASSIFICATION_CONFIG_VERSION,
  PULSE_CLASSIFICATION_RETRY_POLICY,
  PULSE_CLASSIFICATION_STATUSES,
  PULSE_CLASSIFICATION_STATE_VERSION,
} from "./classification-state";
import {
  PULSE_REVIEW_COMPLIANCE_STATES,
  PULSE_REVIEW_HEALTH_STATES,
  PULSE_REVIEW_OBLIGATION_STATES,
  PULSE_REVIEW_PRIORITY_BY_SEVERITY,
  PULSE_REVIEW_SLA_TARGETS,
  PULSE_REVIEW_SLA_VERSION,
} from "./review-sla";

export const PULSE_RUNTIME_CONTRACT_SCHEMA_VERSION = "1.14.0" as const;
export const PULSE_RUNTIME_METHOD_VERSION = "pulse-v2.15-beta" as const;
export const PULSE_TAXONOMY_VERSION = "v2.0" as const;
export const PULSE_ACTIVE_FEEDS_OBSERVED_THROUGH = "2026-07-29" as const;

export type PulseMethodStatus = "experimental";
export type PulseSourceRole = "specialist" | "news";
export type PulseConnectorStatus =
  | "active_observed"
  | "access_gated"
  | "configuration_gated"
  | "sparse_scaffold"
  | "placeholder";

export interface PulseProviderRef {
  provider: ClassifierProvider;
  model: string;
}

export interface PulseConnectorFact {
  feedId: string;
  connectorId: string;
  sourceIds: readonly string[];
  role: PulseSourceRole;
  status: PulseConnectorStatus;
  defaultEnabled: boolean;
  observedInProduction: boolean;
  activation: string;
  blindSpots: readonly string[];
}

export interface PulseCadenceFact {
  stage: "ingest" | "cluster" | "classify" | "score";
  route: string;
  cron: string;
  operations: readonly string[];
}

export interface PulseRuntimeFacts {
  methodologyVersion: string;
  taxonomyVersion: string;
  categoryCount: number;
  dimensions: readonly PulseDimension[];
  status: PulseMethodStatus;
  activeFeedsObservedThrough: string;
  connectors: readonly PulseConnectorFact[];
  cadence: readonly PulseCadenceFact[];
  classifyEngines: readonly ResolvedProviderConfig[];
  verifyEngine: ResolvedProviderConfig;
  subjectEngine: PulseProviderRef;
  reviewSummaryEngine: PulseProviderRef;
  backtestEngine: PulseProviderRef;
  humanReviewTiers: readonly SeverityTier[];
  scoreWindowDays: number;
  deltaBounds: Readonly<{ lower: number; upper: number }>;
  clustering: Readonly<{
    countryPartitioned: boolean;
    identityVersion: string;
    embeddingModel: string;
    dateWindowHours: number;
    semanticThreshold: number;
    semanticOnlyThreshold: number;
    lexicalTokenThreshold: number;
    lexicalAnchorThreshold: number;
  }>;
}

export interface PulseRuntimeMethodContract {
  schemaVersion: typeof PULSE_RUNTIME_CONTRACT_SCHEMA_VERSION;
  methodology: {
    id: "civica-pulse";
    name: "Civica Pulse";
    currentContractScope: string;
  };
  version: string;
  taxonomy: {
    version: string;
    categoryCount: number;
    dimensions: PulseDimension[];
  };
  status: PulseMethodStatus;
  mixed_legacy_unversioned: false;
  ledgerHistory: {
    currentRows: string;
    legacyRows: string;
    comparisonWarning: string;
  };
  evidenceIdentity: {
    schemaVersion: "pulse-raw-evidence/v1";
    rawItemSnapshot: "immutable_private_payload_plus_hash";
    requiredMetadata: string[];
    unknownLanguage: "und";
    eventTrace: "pulse_sources_to_raw_events";
    publicPayloadDistribution: "blocked";
    rightsRule: string;
    legacyRule: string;
  };
  decisionLedger: {
    schemaVersion: typeof PULSE_DECISION_LEDGER_VERSION;
    storage: "append_only";
    decisionKinds: PulseDecisionKind[];
    currentEventRowRole: "current_state_projection_not_decision_history";
    verifierAxes: [
      "event_existence",
      "subject_attribution",
      "category_labels",
      "severity",
    ];
    genericConfidenceField: "prohibited";
    corroborationStanding: "heuristic_weight_not_probability";
    supersessionRule: "same_axis_only_other_axes_unchanged";
    legacyRule: string;
  };
  providers: {
    classify: {
      mode: "cross_vendor_ensemble";
      engines: PulseProviderRef[];
      decode: "deterministic";
      categoryConsensus: "strict_majority_of_successful_voters";
      minimumQuorum: 2;
      agreementEvidence: "stored_provider_distinct_prompt_versioned_classify_runs";
      publisherInputBoundary: "explicit_untrusted_json_evidence_never_instructions";
      automaticEvidenceBinding: "exact_retained_quote_per_supporting_classifier";
      singleEnginePublication: "queue_only";
      legacyAgreementPolicy: "unsupported_labels_cleared_and_automatic_rows_quarantined";
      selfConfidenceRange: { lower: 0; upper: 1 };
      invalidSelfConfidencePolicy: "reject_response_as_unusable";
      severityValuePolicy: "require_finite_number_then_tier_clamp";
      degradedRunsRecorded: false;
      successfulProviderRunsRecorded: true;
      configuredProviderSetPersisted: true;
      providerFailuresPersisted: false;
      stateSchemaVersion: typeof PULSE_CLASSIFICATION_STATE_VERSION;
      attemptSchemaVersion: typeof PULSE_CLASSIFICATION_ATTEMPT_VERSION;
      configSchemaVersion: typeof PULSE_CLASSIFICATION_CONFIG_VERSION;
      statuses: string[];
      queueOrder: "new_then_due_retry_oldest_first";
      retryExhaustionDisposition: "terminal_failure";
      noneDisposition: "terminal_none_not_failure";
      claimLeaseMinutes: number;
      retryPolicy: {
        maxAttempts: number;
        initialDelayMinutes: number;
        multiplier: number;
        maximumDelayHours: number;
      };
    };
    verify: {
      engine: PulseProviderRef;
      role: "adversarial_signal_not_absolute_veto";
      runsForAgreement: ["all", "two_of_three"];
      skippedFor: ["deadlock_or_no_quorum", "invalid_consensus_category"];
      malformedVerdictOrAxesPolicy: "reject_as_failed_objection";
      invalidConfidencePolicy: "coerce_to_low_confidence_objection";
    };
    subject: {
      engine: PulseProviderRef;
      role: "attribute_primary_and_affected_jurisdictions";
      runsAfterClassification: true;
      attributionVersion: typeof PULSE_JURISDICTION_ATTRIBUTION_VERSION;
      entityCatalogVersion: typeof PULSE_JURISDICTION_ENTITY_VERSION;
      aliasVersion: typeof PULSE_JURISDICTION_ALIAS_VERSION;
      inputContext: "human_readable_versioned_entity_candidates";
      acceptedScopes: ["single", "multi"];
      output: "one_primary_zero_or_more_affected_with_rationales_evidence_refs_and_exact_quotes";
      responseValidation: "strict_scope_roles_iso3_rationale_exact_retained_quote_and_entity_match";
      failurePolicy: "unresolved_no_automatic_publication";
      projectionRule: "primary_only_affected_are_descriptive_not_scored";
      legacyRule: string;
    };
    reviewSummary: {
      engine: PulseProviderRef;
      role: "optional_cached_admin_and_public_ledger_summary_aid";
      affectsClassification: false;
      affectsNumericDelta: false;
    };
    backtest: {
      engine: PulseProviderRef;
      mode: "single_engine_classify_verify";
      matchesCurrentProduction: false;
      differences: string[];
    };
  };
  feeds: {
    observedEvidenceDefinition: string;
    observedEvidence: {
      observedThrough: string;
      sourceIds: string[];
    };
    connectors: Array<{
      feedId: string;
      connectorId: string;
      sourceIds: string[];
      role: PulseSourceRole;
      status: PulseConnectorStatus;
      defaultEnabled: boolean;
      observedInProduction: boolean;
      activation: string;
      blindSpots: string[];
    }>;
  };
  observability: {
    schemaVersion: typeof PULSE_OBSERVABILITY_VERSION;
    periodBasis: "retrieval_time";
    observationStates: Array<(typeof PULSE_OBSERVATION_STATES)[number]>;
    eventObservationStates: Array<
      (typeof PULSE_EVENT_OBSERVATION_STATES)[number]
    >;
    minimumObservedFeedFamilies: number;
    minimumRetainedDocuments: number;
    noEventRule: "only_when_observation_is_sufficient";
    restrictedEnvironmentRule: "requires_sourced_versioned_context";
    approximatePressFreedomEligible: false;
    absentNumericEffect: "withheld";
    countryQualityInference: "prohibited";
    validationStanding: "operational_threshold_not_retrieval_validation";
  };
  cadence: {
    frequency: "daily";
    timezone: "UTC";
    continuous: false;
    stages: Array<{
      stage: PulseCadenceFact["stage"];
      route: string;
      cron: string;
      operations: string[];
    }>;
  };
  clustering: {
    strategy: "stable_incident_resolution";
    resolutionVersion: string;
    persistedComparison: "incoming_against_recent_active_incidents";
    automaticMergeRule: "exact_full_identity_inside_window_or_exact_headline_same_resolved_country_and_date_with_compatible_labels";
    candidateLedger: "semantic_and_strong_anchor_matches_require_review";
    countryPartitioned: boolean;
    identityNormalization: {
      version: string;
      provisionalJurisdictionRole: "diagnostic_not_partition";
      sharedAnchorRequired: true;
    };
    dateWindowHours: number;
    semantic: {
      metric: "cosine_similarity";
      model: string;
      threshold: number;
      unanchoredThreshold: number;
      result: "candidate_only";
    };
    lexicalFallback: {
      condition: "embedding_model_unavailable";
      metric: "jaccard_token_similarity";
      threshold: number;
      anchorOverlapThreshold: number;
      result: "candidate_only";
    };
  };
  corroboration: {
    standing: "heuristic_not_probability";
    countingUnit: "independent_evidence_group";
    sourceIndependence: {
      version: string;
      dependentSignals: [
        "same_snapshot",
        "same_canonical_url",
        "same_publisher_family",
        "same_declared_origin",
        "near_verbatim_republication",
      ];
      unresolvedPublisherPolicy: "collapse_within_event";
      reviewedPairThresholds: {
        precision: number;
        recall: number;
      };
      validationStanding: "reviewed_regression_fixture_not_external_validation";
    };
    informationEnvironment: {
      schemaVersion: typeof PULSE_INFORMATION_ENVIRONMENT_VERSION;
      releaseSchemaVersion: typeof PULSE_INFORMATION_ENVIRONMENT_RELEASE_VERSION;
      eventPinSchemaVersion: typeof PULSE_INFORMATION_ENVIRONMENT_PIN_VERSION;
      eventPinMethodVersion: typeof PULSE_INFORMATION_ENVIRONMENT_PIN_METHOD;
      policyVersion: string;
      coveragePolicy: "one_observed_or_missing_row_per_supported_jurisdiction";
      historicalPinPolicy: "unrecoverable_remains_missing";
      rerunPolicy: "classification_pin_is_append_only";
      observabilityUse: "disabled_until_rights_and_validation_pass";
      productionUse: "disabled_pending_rights_and_validation";
      missingValuePolicy: "no_multiplier";
      validationStanding: "not_calibrated_bias_correction";
      candidateRelease: {
        sourceId: string;
        sourceUrl: string;
        methodologyUrl: string;
        termsUrl: string;
        upstreamRelease: string;
        observationYear: number;
        retrievedAt: string;
        contentSha256: string;
        publisherRows: number;
        redistributionPosture: "restricted-no-redistribution";
        rightsStatus: "pending";
      };
      sensitivityOnly: {
        status: "legacy_multiplier_scenario_only";
        partialAllEvents: number;
        restrictedNewsOnly: number;
        restrictedPositiveThinEvidence: number;
      };
    };
  };
  publicationPolicy: {
    automaticEligibility: "stored_ensemble_gate_resolved_subject_and_deterministic_retained_evidence";
    indirectInstructionSignal: "non_none_queue_none_retry_then_terminal_failure";
    majorityNone: "drop_only_without_indirect_instruction_signal";
    severityAggregation: "majority_with_ties_to_more_severe";
    numericSeverityAggregation: "median_of_winning_category_voters_then_tier_clamp";
    reviewGates: {
      absoluteSeverityTiers: SeverityTier[];
      deadlock: true;
      noQuorum: true;
      invalidConsensusCategory: true;
      invalidConsensusCategoryPersistence: "normalize_to_none_unresolved";
      verifierObjectionWithWeakConsensus: {
        verifierObjectionIncludes: [
          "low_confidence",
          "failed",
          "verdict_revised",
          "verdict_rejected",
          "category_not_ok",
          "severity_not_ok",
          "subject_not_ok",
          "not_event",
        ];
        weakConsensusRequiresNonUnanimous: true;
        selfConfidenceAggregation: "maximum_among_winning_category_voters";
        selfConfidenceBelow: 0.7;
        degradedRunAlsoWeak: true;
      };
    };
    states: {
      autoPublished: {
        published: true;
        reviewStatus: "approved";
        humanReviewed: false;
      };
      queuedForReview: {
        published: false;
        reviewStatus: "pending";
        humanReviewed: false;
      };
      humanApproved: {
        published: true;
        reviewStatus: "approved";
        humanReviewed: true;
      };
      humanEdited: {
        published: true;
        reviewStatus: "edited";
        humanReviewed: true;
      };
      humanRejected: {
        published: false;
        reviewStatus: "rejected";
        humanReviewed: true;
      };
      legacyRejectedUnverified: {
        published: false;
        reviewStatus: "rejected";
        humanReviewed: false;
      };
      legacyQuarantined: {
        published: false;
        reviewStatus: "legacy_quarantined";
        humanReviewed: false;
      };
    };
  };
  reviewServiceLevel: {
    version: typeof PULSE_REVIEW_SLA_VERSION;
    priorityBySeverity: typeof PULSE_REVIEW_PRIORITY_BY_SEVERITY;
    targets: typeof PULSE_REVIEW_SLA_TARGETS;
    obligationStates: string[];
    complianceStates: string[];
    healthStates: string[];
    queueOrder: "priority_then_due_then_queued_then_id";
    monitor: {
      route: "/api/cron/pulse/v2/review-sla";
      cron: "10 */6 * * *";
      delivery: "persisted_idempotent_event_plus_structured_server_log";
    };
    exceptionRule: "append_only_bounded_explanation_never_restores_completeness";
    dailyCompletenessRule: "withheld_on_breach_or_unknown";
    reportClockArithmetic: "explicit_timestamp_cast_before_interval";
    legacyRule: string;
  };
  numericDeltas: {
    publicStatus: "public_experimental";
    shape: "per_dimension";
    scalar: "none";
    dimensions: PulseDimension[];
    includedEvents: "published_only";
    inputMethodCoverage: "row_level_versioned_with_explicit_legacy";
    trailingWindowDays: number;
    windowBoundary: typeof PULSE_SCORE_WINDOW_BOUNDARY;
    eventLifecycle: typeof PULSE_SCORE_EVENT_LIFECYCLE_POLICY;
    currentProjection: "one_row_per_jurisdiction_dimension";
    noEventState: "zero_tombstone_internal_public_null";
    outputHistory: "append_only_per_score_run_jurisdiction_dimension";
    writeAtomicity: "history_projection_and_run_completion_one_transaction";
    boundsPerDimension: {
      lower: number;
      upper: number;
    };
    impactFormula: "severity_value * corroboration_confidence * absorption_multiplier * exp(-ln(2) * days_since_event / category_half_life_days)";
    scoreStageOrder: ["corroborate", "score"];
    absorptionEvidence: "append_only_explicit_event_link_fixed_scale";
    absorptionMultiplier: "absorbed_zero_otherwise_one";
    currentAbsorptionStanding: "none_no_sequential_comparable_release";
    absorbedIntoIndexPolicy: "separate_versioned_decision_never_mutates_corroboration";
  };
  evaluation: {
    backtestMatchesCurrentProduction: false;
    currentProductionValidatedByExistingBacktest: false;
    externalValidation: "not_completed";
    statusReason: string;
  };
}

export interface PulseRuntimeMethodSnapshot extends PulseRuntimeMethodContract {
  contractHash: string;
}

function providerRef(config: ResolvedProviderConfig): PulseProviderRef {
  return { provider: config.provider, model: config.model };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function cronMinuteOfDay(cron: string): number {
  const [minute, hour] = cron.trim().split(/\s+/).map(Number);
  return Number.isFinite(minute) && Number.isFinite(hour)
    ? hour * 60 + minute
    : Number.MAX_SAFE_INTEGER;
}

/** Build a complete contract from explicit facts. Pure and deterministic. */
export function buildPulseRuntimeMethod(
  facts: PulseRuntimeFacts,
): PulseRuntimeMethodContract {
  const connectors = facts.connectors
    .map((connector) => ({
      ...connector,
      sourceIds: uniqueSorted(connector.sourceIds),
      blindSpots: [...connector.blindSpots],
    }))
    .sort((a, b) => a.feedId.localeCompare(b.feedId));

  const observedEvidenceSourceIds = uniqueSorted(
    connectors
      .filter((connector) => connector.observedInProduction)
      .flatMap((connector) => connector.sourceIds),
  );

  const stages = facts.cadence
    .map((stage) => ({ ...stage, operations: [...stage.operations] }))
    .sort((a, b) => cronMinuteOfDay(a.cron) - cronMinuteOfDay(b.cron));

  return {
    schemaVersion: PULSE_RUNTIME_CONTRACT_SCHEMA_VERSION,
    methodology: {
      id: "civica-pulse",
      name: "Civica Pulse",
      currentContractScope:
        "New classifications produced by the declared scheduled Pulse v2 pipeline; not a retroactive description of every stored ledger row.",
    },
    version: facts.methodologyVersion,
    taxonomy: {
      version: facts.taxonomyVersion,
      categoryCount: facts.categoryCount,
      dimensions: [...facts.dimensions],
    },
    status: facts.status,
    mixed_legacy_unversioned: false,
    ledgerHistory: {
      currentRows:
        "Every new ingest, cluster, classification, corroboration, review/publication, and score row points to a content-addressed pipeline run with method, ontology, prompt, provider/model, source-basket, algorithm, and pipeline identity.",
      legacyRows:
        "Older single-model, temperature-variant, and agent-generated rows point to fixed legacy stage runs whose version axes remain explicitly legacy_unversioned.",
      comparisonWarning:
        "API version-set metadata marks legacy or mixed results as not comparable as one method series.",
    },
    evidenceIdentity: {
      schemaVersion: "pulse-raw-evidence/v1",
      rawItemSnapshot: "immutable_private_payload_plus_hash",
      requiredMetadata: [
        "exact_item_url",
        "source_family",
        "publisher",
        "retrieval_time",
        "content_hash",
        "language_or_und",
        "jurisdiction_attribution_evidence",
        "captured_rights_posture",
      ],
      unknownLanguage: "und",
      eventTrace: "pulse_sources_to_raw_events",
      publicPayloadDistribution: "blocked",
      rightsRule:
        "Free access, indexing, or citation never grants public redistribution of the retained publisher payload; a separate verified rights decision is required.",
      legacyRule:
        "Retained rows preserve their exact stored payload and ingest-time metadata under an explicit legacy hash/attribution method rather than receiving invented current provenance.",
    },
    decisionLedger: {
      schemaVersion: PULSE_DECISION_LEDGER_VERSION,
      storage: "append_only",
      decisionKinds: [...PULSE_DECISION_KINDS],
      currentEventRowRole: "current_state_projection_not_decision_history",
      verifierAxes: [
        "event_existence",
        "subject_attribution",
        "category_labels",
        "severity",
      ],
      genericConfidenceField: "prohibited",
      corroborationStanding: "heuristic_weight_not_probability",
      supersessionRule: "same_axis_only_other_axes_unchanged",
      legacyRule:
        "Retained event fields are captured as legacy_projection decisions; an unresolved verdict marks any axis whose original independent judgment cannot be reconstructed.",
    },
    providers: {
      classify: {
        mode: "cross_vendor_ensemble",
        engines: facts.classifyEngines.map(providerRef),
        decode: "deterministic",
        categoryConsensus: "strict_majority_of_successful_voters",
        minimumQuorum: 2,
        agreementEvidence:
          "stored_provider_distinct_prompt_versioned_classify_runs",
        publisherInputBoundary:
          "explicit_untrusted_json_evidence_never_instructions",
        automaticEvidenceBinding:
          "exact_retained_quote_per_supporting_classifier",
        singleEnginePublication: "queue_only",
        legacyAgreementPolicy:
          "unsupported_labels_cleared_and_automatic_rows_quarantined",
        selfConfidenceRange: { lower: 0, upper: 1 },
        invalidSelfConfidencePolicy: "reject_response_as_unusable",
        severityValuePolicy: "require_finite_number_then_tier_clamp",
        degradedRunsRecorded: false,
        successfulProviderRunsRecorded: true,
        configuredProviderSetPersisted: true,
        providerFailuresPersisted: false,
        stateSchemaVersion: PULSE_CLASSIFICATION_STATE_VERSION,
        attemptSchemaVersion: PULSE_CLASSIFICATION_ATTEMPT_VERSION,
        configSchemaVersion: PULSE_CLASSIFICATION_CONFIG_VERSION,
        statuses: [...PULSE_CLASSIFICATION_STATUSES],
        queueOrder: "new_then_due_retry_oldest_first",
        retryExhaustionDisposition: "terminal_failure",
        noneDisposition: "terminal_none_not_failure",
        claimLeaseMinutes: PULSE_CLASSIFICATION_CLAIM_LEASE_MS / 60_000,
        retryPolicy: {
          maxAttempts: PULSE_CLASSIFICATION_RETRY_POLICY.maxAttempts,
          initialDelayMinutes:
            PULSE_CLASSIFICATION_RETRY_POLICY.initialDelayMs / 60_000,
          multiplier: PULSE_CLASSIFICATION_RETRY_POLICY.multiplier,
          maximumDelayHours:
            PULSE_CLASSIFICATION_RETRY_POLICY.maxDelayMs / 3_600_000,
        },
      },
      verify: {
        engine: providerRef(facts.verifyEngine),
        role: "adversarial_signal_not_absolute_veto",
        runsForAgreement: ["all", "two_of_three"],
        skippedFor: ["deadlock_or_no_quorum", "invalid_consensus_category"],
        malformedVerdictOrAxesPolicy: "reject_as_failed_objection",
        invalidConfidencePolicy: "coerce_to_low_confidence_objection",
      },
      subject: {
        engine: { ...facts.subjectEngine },
        role: "attribute_primary_and_affected_jurisdictions",
        runsAfterClassification: true,
        attributionVersion: PULSE_JURISDICTION_ATTRIBUTION_VERSION,
        entityCatalogVersion: PULSE_JURISDICTION_ENTITY_VERSION,
        aliasVersion: PULSE_JURISDICTION_ALIAS_VERSION,
        inputContext: "human_readable_versioned_entity_candidates",
        acceptedScopes: ["single", "multi"],
        output:
          "one_primary_zero_or_more_affected_with_rationales_evidence_refs_and_exact_quotes",
        responseValidation:
          "strict_scope_roles_iso3_rationale_exact_retained_quote_and_entity_match",
        failurePolicy: "unresolved_no_automatic_publication",
        projectionRule: "primary_only_affected_are_descriptive_not_scored",
        legacyRule:
          "Retained single-jurisdiction rows remain explicit legacy projections without invented historical alias/entity inputs.",
      },
      reviewSummary: {
        engine: { ...facts.reviewSummaryEngine },
        role: "optional_cached_admin_and_public_ledger_summary_aid",
        affectsClassification: false,
        affectsNumericDelta: false,
      },
      backtest: {
        engine: { ...facts.backtestEngine },
        mode: "single_engine_classify_verify",
        matchesCurrentProduction: false,
        differences: [
          "The existing backtest uses one engine for classify and verify rather than the current cross-vendor classify ensemble.",
          "It uses curated single-source events rather than production ingestion, clustering, and source attribution.",
          "It simplifies corroboration and assumes review-gated events receive perfect approval.",
        ],
      },
    },
    feeds: {
      observedEvidenceDefinition:
        "This is the source-ID set retained in raw_events by the stated evidence cut, not a current operating-feed verdict. The live source-coverage contract decides operating, degraded, and inactive states from retrieval telemetry, evidence, and rights.",
      observedEvidence: {
        observedThrough: facts.activeFeedsObservedThrough,
        sourceIds: observedEvidenceSourceIds,
      },
      connectors,
    },
    observability: {
      schemaVersion: PULSE_OBSERVABILITY_VERSION,
      periodBasis: "retrieval_time",
      observationStates: [...PULSE_OBSERVATION_STATES],
      eventObservationStates: [...PULSE_EVENT_OBSERVATION_STATES],
      minimumObservedFeedFamilies:
        PULSE_OBSERVABILITY_THRESHOLDS.minimumObservedFeedFamilies,
      minimumRetainedDocuments:
        PULSE_OBSERVABILITY_THRESHOLDS.minimumRetainedDocuments,
      noEventRule: "only_when_observation_is_sufficient",
      restrictedEnvironmentRule: "requires_sourced_versioned_context",
      approximatePressFreedomEligible: false,
      absentNumericEffect: "withheld",
      countryQualityInference: "prohibited",
      validationStanding: "operational_threshold_not_retrieval_validation",
    },
    cadence: {
      frequency: "daily",
      timezone: "UTC",
      continuous: false,
      stages,
    },
    clustering: {
      strategy: "stable_incident_resolution",
      resolutionVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
      persistedComparison: "incoming_against_recent_active_incidents",
      automaticMergeRule:
        "exact_full_identity_inside_window_or_exact_headline_same_resolved_country_and_date_with_compatible_labels",
      candidateLedger: "semantic_and_strong_anchor_matches_require_review",
      countryPartitioned: facts.clustering.countryPartitioned,
      identityNormalization: {
        version: facts.clustering.identityVersion,
        provisionalJurisdictionRole: "diagnostic_not_partition",
        sharedAnchorRequired: true,
      },
      dateWindowHours: facts.clustering.dateWindowHours,
      semantic: {
        metric: "cosine_similarity",
        model: facts.clustering.embeddingModel,
        threshold: facts.clustering.semanticThreshold,
        unanchoredThreshold: facts.clustering.semanticOnlyThreshold,
        result: "candidate_only",
      },
      lexicalFallback: {
        condition: "embedding_model_unavailable",
        metric: "jaccard_token_similarity",
        threshold: facts.clustering.lexicalTokenThreshold,
        anchorOverlapThreshold: facts.clustering.lexicalAnchorThreshold,
        result: "candidate_only",
      },
    },
    corroboration: {
      standing: "heuristic_not_probability",
      countingUnit: "independent_evidence_group",
      sourceIndependence: {
        version: PULSE_SOURCE_INDEPENDENCE_VERSION,
        dependentSignals: [
          "same_snapshot",
          "same_canonical_url",
          "same_publisher_family",
          "same_declared_origin",
          "near_verbatim_republication",
        ],
        unresolvedPublisherPolicy: "collapse_within_event",
        reviewedPairThresholds: {
          precision: SOURCE_INDEPENDENCE_MIN_PRECISION,
          recall: SOURCE_INDEPENDENCE_MIN_RECALL,
        },
        validationStanding:
          "reviewed_regression_fixture_not_external_validation",
      },
      informationEnvironment: {
        schemaVersion: PULSE_INFORMATION_ENVIRONMENT_VERSION,
        releaseSchemaVersion: PULSE_INFORMATION_ENVIRONMENT_RELEASE_VERSION,
        eventPinSchemaVersion: PULSE_INFORMATION_ENVIRONMENT_PIN_VERSION,
        eventPinMethodVersion: PULSE_INFORMATION_ENVIRONMENT_PIN_METHOD,
        policyVersion: PULSE_INFORMATION_ENVIRONMENT_POLICY.version,
        coveragePolicy:
          "one_observed_or_missing_row_per_supported_jurisdiction",
        historicalPinPolicy: "unrecoverable_remains_missing",
        rerunPolicy: "classification_pin_is_append_only",
        observabilityUse: "disabled_until_rights_and_validation_pass",
        productionUse: "disabled_pending_rights_and_validation",
        missingValuePolicy: "no_multiplier",
        validationStanding: "not_calibrated_bias_correction",
        candidateRelease: {
          sourceId: RSF_2026_CANDIDATE_RELEASE.sourceId,
          sourceUrl: RSF_2026_CANDIDATE_RELEASE.sourceUrl,
          methodologyUrl: RSF_2026_CANDIDATE_RELEASE.methodologyUrl,
          termsUrl: RSF_2026_CANDIDATE_RELEASE.termsUrl,
          upstreamRelease: RSF_2026_CANDIDATE_RELEASE.upstreamRelease,
          observationYear: RSF_2026_CANDIDATE_RELEASE.observationYear,
          retrievedAt: RSF_2026_CANDIDATE_RELEASE.retrievedAt,
          contentSha256: RSF_2026_CANDIDATE_RELEASE.contentSha256,
          publisherRows: RSF_2026_CANDIDATE_RELEASE.publisherRows,
          redistributionPosture:
            RSF_2026_CANDIDATE_RELEASE.redistributionPosture,
          rightsStatus: RSF_2026_CANDIDATE_RELEASE.rightsStatus,
        },
        sensitivityOnly: {
          status: PULSE_INFORMATION_ENVIRONMENT_POLICY.sensitivityMode,
          ...PULSE_INFORMATION_ENVIRONMENT_POLICY.multipliers,
        },
      },
    },
    publicationPolicy: {
      automaticEligibility:
        "stored_ensemble_gate_resolved_subject_and_deterministic_retained_evidence",
      indirectInstructionSignal:
        "non_none_queue_none_retry_then_terminal_failure",
      majorityNone: "drop_only_without_indirect_instruction_signal",
      severityAggregation: "majority_with_ties_to_more_severe",
      numericSeverityAggregation:
        "median_of_winning_category_voters_then_tier_clamp",
      reviewGates: {
        absoluteSeverityTiers: uniqueSorted(
          facts.humanReviewTiers,
        ) as SeverityTier[],
        deadlock: true,
        noQuorum: true,
        invalidConsensusCategory: true,
        invalidConsensusCategoryPersistence: "normalize_to_none_unresolved",
        verifierObjectionWithWeakConsensus: {
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
        },
      },
      states: {
        autoPublished: {
          published: true,
          reviewStatus: "approved",
          humanReviewed: false,
        },
        queuedForReview: {
          published: false,
          reviewStatus: "pending",
          humanReviewed: false,
        },
        humanApproved: {
          published: true,
          reviewStatus: "approved",
          humanReviewed: true,
        },
        humanEdited: {
          published: true,
          reviewStatus: "edited",
          humanReviewed: true,
        },
        humanRejected: {
          published: false,
          reviewStatus: "rejected",
          humanReviewed: true,
        },
        legacyRejectedUnverified: {
          published: false,
          reviewStatus: "rejected",
          humanReviewed: false,
        },
        legacyQuarantined: {
          published: false,
          reviewStatus: "legacy_quarantined",
          humanReviewed: false,
        },
      },
    },
    reviewServiceLevel: {
      version: PULSE_REVIEW_SLA_VERSION,
      priorityBySeverity: PULSE_REVIEW_PRIORITY_BY_SEVERITY,
      targets: PULSE_REVIEW_SLA_TARGETS,
      obligationStates: [...PULSE_REVIEW_OBLIGATION_STATES],
      complianceStates: [...PULSE_REVIEW_COMPLIANCE_STATES],
      healthStates: [...PULSE_REVIEW_HEALTH_STATES],
      queueOrder: "priority_then_due_then_queued_then_id",
      monitor: {
        route: "/api/cron/pulse/v2/review-sla",
        cron: "10 */6 * * *",
        delivery: "persisted_idempotent_event_plus_structured_server_log",
      },
      exceptionRule:
        "append_only_bounded_explanation_never_restores_completeness",
      dailyCompletenessRule: "withheld_on_breach_or_unknown",
      reportClockArithmetic: "explicit_timestamp_cast_before_interval",
      legacyRule:
        "Pre-contract pending items remain unpublished in legacy quarantine and are not counted as reviewed, approved, rejected, or SLA-compliant.",
    },
    numericDeltas: {
      publicStatus: "public_experimental",
      shape: "per_dimension",
      scalar: "none",
      dimensions: [...facts.dimensions],
      includedEvents: "published_only",
      inputMethodCoverage: "row_level_versioned_with_explicit_legacy",
      trailingWindowDays: facts.scoreWindowDays,
      windowBoundary: PULSE_SCORE_WINDOW_BOUNDARY,
      eventLifecycle: PULSE_SCORE_EVENT_LIFECYCLE_POLICY,
      currentProjection: "one_row_per_jurisdiction_dimension",
      noEventState: "zero_tombstone_internal_public_null",
      outputHistory: "append_only_per_score_run_jurisdiction_dimension",
      writeAtomicity:
        "history_projection_and_run_completion_one_transaction",
      boundsPerDimension: {
        lower: facts.deltaBounds.lower,
        upper: facts.deltaBounds.upper,
      },
      impactFormula:
        "severity_value * corroboration_confidence * absorption_multiplier * exp(-ln(2) * days_since_event / category_half_life_days)",
      scoreStageOrder: ["corroborate", "score"],
      absorptionEvidence: "append_only_explicit_event_link_fixed_scale",
      absorptionMultiplier: "absorbed_zero_otherwise_one",
      currentAbsorptionStanding: "none_no_sequential_comparable_release",
      absorbedIntoIndexPolicy:
        "separate_versioned_decision_never_mutates_corroboration",
    },
    evaluation: {
      backtestMatchesCurrentProduction: false,
      currentProductionValidatedByExistingBacktest: false,
      externalValidation: "not_completed",
      statusReason:
        "Numeric Pulse deltas are public experiments, not validated measurements; the current ensemble still requires a method-matched replay, calibration, and external review.",
    },
  };
}

/**
 * Declared facts for the method currently scheduled in production.
 *
 * Provider values are the checked-in production defaults. If deployment
 * overrides change them, this contract and its snapshot must change in the
 * same release; the validator catches checked-in runtime drift.
 */
export const CURRENT_PULSE_RUNTIME_FACTS: PulseRuntimeFacts = {
  methodologyVersion: PULSE_RUNTIME_METHOD_VERSION,
  taxonomyVersion: PULSE_TAXONOMY_VERSION,
  categoryCount: EVENT_CATEGORIES.length,
  dimensions: PULSE_DIMENSIONS,
  status: "experimental",
  activeFeedsObservedThrough: PULSE_ACTIVE_FEEDS_OBSERVED_THROUGH,
  connectors: [
    {
      feedId: "acled",
      connectorId: "acled",
      sourceIds: ["acled"],
      role: "specialist",
      status: "access_gated",
      defaultEnabled: false,
      observedInProduction: false,
      activation:
        "Requires licensed academic API access and a registered account email.",
      blindSpots: ["Not operating; no Pulse retrieval coverage is available."],
    },
    {
      feedId: "amnesty",
      connectorId: "amnesty",
      sourceIds: ["amnesty"],
      role: "specialist",
      status: "active_observed",
      defaultEnabled: true,
      observedInProduction: true,
      activation: "Default Amnesty International RSS feed.",
      blindSpots: [
        "RSS selection and publisher cadence do not provide a complete Amnesty corpus.",
      ],
    },
    {
      feedId: "ap",
      connectorId: "reuters_ap",
      sourceIds: ["ap_wire"],
      role: "news",
      status: "configuration_gated",
      defaultEnabled: false,
      observedInProduction: false,
      activation:
        "No working default feed; requires an explicitly configured feed URL.",
      blindSpots: [
        "Not operating; no AP Pulse retrieval coverage is available.",
      ],
    },
    {
      feedId: "civicus",
      connectorId: "civicus",
      sourceIds: ["civicus_monitor"],
      role: "specialist",
      status: "active_observed",
      defaultEnabled: true,
      observedInProduction: true,
      activation: "Default CIVICUS Monitor RSS feed.",
      blindSpots: [
        "RSS selection and publisher geography do not provide a country-complete sampling frame.",
      ],
    },
    {
      feedId: "gdelt",
      connectorId: "gdelt",
      sourceIds: ["gdelt"],
      role: "news",
      status: "active_observed",
      defaultEnabled: true,
      observedInProduction: true,
      activation:
        "Default GDELT document API query with best-effort article enrichment.",
      blindSpots: [
        "Query terms, GDELT indexing, publisher access, paywalls, language, and enrichment failures constrain recall.",
      ],
    },
    {
      feedId: "hrw",
      connectorId: "hrw",
      sourceIds: ["hrw"],
      role: "specialist",
      status: "active_observed",
      defaultEnabled: true,
      observedInProduction: true,
      activation: "Default Human Rights Watch RSS feed.",
      blindSpots: [
        "RSS selection and publisher cadence do not provide a complete Human Rights Watch corpus.",
      ],
    },
    {
      feedId: "ipu",
      connectorId: "ipu",
      sourceIds: ["ipu_parline"],
      role: "specialist",
      status: "sparse_scaffold",
      defaultEnabled: true,
      observedInProduction: false,
      activation:
        "Scheduled elections-endpoint scaffold; no daily parliamentary-actions feed exists.",
      blindSpots: ["Not operating as a daily parliamentary-actions feed."],
    },
    {
      feedId: "reuters",
      connectorId: "reuters_ap",
      sourceIds: ["reuters_wire"],
      role: "news",
      status: "configuration_gated",
      defaultEnabled: false,
      observedInProduction: false,
      activation:
        "No working default feed; requires an explicitly configured feed URL.",
      blindSpots: [
        "Not operating; no Reuters Pulse retrieval coverage is available.",
      ],
    },
    {
      feedId: "rsf",
      connectorId: "rsf",
      sourceIds: ["rsf_alerts"],
      role: "specialist",
      status: "configuration_gated",
      defaultEnabled: false,
      observedInProduction: false,
      activation:
        "No public feed is configured; requires an approved ingestion surface.",
      blindSpots: [
        "Not operating; no RSF Pulse retrieval coverage is available.",
      ],
    },
    {
      feedId: "vdem",
      connectorId: "vdem_pulse",
      sourceIds: [],
      role: "specialist",
      status: "placeholder",
      defaultEnabled: true,
      observedInProduction: false,
      activation:
        "Placeholder returns no rows because V-Dem has no daily Pulse feed.",
      blindSpots: [
        "Placeholder only; it supplies no event retrieval coverage.",
      ],
    },
  ],
  cadence: [
    {
      stage: "ingest",
      route: "/api/cron/pulse/v2/ingest",
      cron: "0 8 * * *",
      operations: ["ingest"],
    },
    {
      stage: "cluster",
      route: "/api/cron/pulse/v2/cluster",
      cron: "20 8 * * *",
      operations: ["cluster"],
    },
    {
      stage: "classify",
      route: "/api/cron/pulse/v2/classify",
      cron: "40 8 * * *",
      operations: ["classify", "verify", "subject_attribute"],
    },
    {
      stage: "score",
      route: "/api/cron/pulse/v2/score",
      cron: "0 9 * * *",
      operations: ["corroborate", "score"],
    },
  ],
  classifyEngines: DEFAULT_ENSEMBLE,
  verifyEngine: DEFAULT_ENSEMBLE_VERIFY,
  subjectEngine: {
    provider: SUBJECT_ATTRIBUTION_PROVIDER,
    model: SUBJECT_ATTRIBUTION_MODEL,
  },
  reviewSummaryEngine: {
    provider: PULSE_REVIEW_SUMMARY_PROVIDER,
    model: PULSE_REVIEW_SUMMARY_MODEL,
  },
  backtestEngine: {
    provider: "anthropic",
    model: PROVIDER_DEFAULT_MODEL.anthropic,
  },
  humanReviewTiers: [...HUMAN_REVIEW_TIERS],
  scoreWindowDays: SCORE_WINDOW_DAYS,
  deltaBounds: { lower: DELTA_LOWER_BOUND, upper: DELTA_UPPER_BOUND },
  clustering: {
    countryPartitioned: false,
    identityVersion: PULSE_EVENT_IDENTITY_VERSION,
    embeddingModel: PULSE_EMBEDDING_MODEL,
    dateWindowHours: PULSE_INCIDENT_COMPARISON_WINDOW_HOURS,
    semanticThreshold: PULSE_INCIDENT_SEMANTIC_CANDIDATE_THRESHOLD,
    semanticOnlyThreshold: PULSE_INCIDENT_SEMANTIC_ONLY_CANDIDATE_THRESHOLD,
    lexicalTokenThreshold: 0.45,
    lexicalAnchorThreshold: 0.8,
  },
};

export const CURRENT_PULSE_RUNTIME_METHOD = buildPulseRuntimeMethod(
  CURRENT_PULSE_RUNTIME_FACTS,
);

type JsonPrimitive = string | number | boolean | null;
type JsonLike =
  JsonPrimitive | readonly JsonLike[] | { readonly [key: string]: JsonLike };

/** Recursively sort object keys while preserving semantically ordered arrays. */
export function canonicalizeJson<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = canonicalizeJson((value as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }
  return value;
}

export function stableStringify(value: JsonLike | object): string {
  return JSON.stringify(canonicalizeJson(value), null, 2);
}

/** Hash only the contract body; `contractHash` is intentionally excluded. */
export function pulseContractHash(
  value: PulseRuntimeMethodContract | PulseRuntimeMethodSnapshot,
): string {
  const { contractHash: _ignored, ...contract } =
    value as PulseRuntimeMethodSnapshot;
  void _ignored;
  return createHash("sha256").update(stableStringify(contract)).digest("hex");
}

export function createPulseRuntimeMethodSnapshot(
  contract: PulseRuntimeMethodContract = CURRENT_PULSE_RUNTIME_METHOD,
): PulseRuntimeMethodSnapshot {
  return {
    ...contract,
    contractHash: pulseContractHash(contract),
  };
}

export function renderPulseRuntimeMethodSnapshot(
  snapshot: PulseRuntimeMethodSnapshot = createPulseRuntimeMethodSnapshot(),
): string {
  return `${stableStringify(snapshot)}\n`;
}
