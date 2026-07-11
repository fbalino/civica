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
  PULSE_DIMENSIONS,
  type PulseDimension,
  type SeverityTier,
} from "./types";
import {
  SUBJECT_ATTRIBUTION_MODEL,
  SUBJECT_ATTRIBUTION_PROVIDER,
} from "./country-attribution";
import {
  PULSE_REVIEW_SUMMARY_MODEL,
  PULSE_REVIEW_SUMMARY_PROVIDER,
} from "./summarize";
import { PULSE_EMBEDDING_MODEL } from "./embed";
import { PULSE_EVENT_IDENTITY_VERSION } from "./event-identity";
import {
  PULSE_SOURCE_INDEPENDENCE_VERSION,
  SOURCE_INDEPENDENCE_MIN_PRECISION,
  SOURCE_INDEPENDENCE_MIN_RECALL,
} from "./source-independence";

export const PULSE_RUNTIME_CONTRACT_SCHEMA_VERSION = "1.2.0" as const;
export const PULSE_RUNTIME_METHOD_VERSION = "pulse-v2.3-beta" as const;
export const PULSE_TAXONOMY_VERSION = "v2.0" as const;
export const PULSE_ACTIVE_FEEDS_OBSERVED_THROUGH = "2026-07-11" as const;

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
    lexicalThreshold: number;
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
  providers: {
    classify: {
      mode: "cross_vendor_ensemble";
      engines: PulseProviderRef[];
      decode: "deterministic";
      categoryConsensus: "strict_majority_of_successful_voters";
      minimumQuorum: 2;
      selfConfidenceRange: { lower: 0; upper: 1 };
      invalidSelfConfidencePolicy: "reject_response_as_unusable";
      severityValuePolicy: "require_finite_number_then_tier_clamp";
      degradedRunsRecorded: false;
      successfulProviderRunsRecorded: true;
      configuredProviderSetPersisted: false;
      providerFailuresPersisted: false;
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
      role: "attribute_event_by_subject_country";
      runsAfterClassification: true;
      acceptedScopes: ["single"];
      acceptedConfidence: ["high", "medium"];
      responseValidation: "strict_scope_confidence_and_iso3_shape";
      failurePolicy: "retain_ingest_attribution";
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
    activeDefinition: string;
    activeProduction: {
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
    }>;
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
    strategy: "semantic_or_lexical_fallback";
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
    };
    lexicalFallback: {
      condition: "embedding_model_unavailable";
      metric: "jaccard_token_similarity";
      threshold: number;
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
  };
  publicationPolicy: {
    majorityNone: "drop_not_governance_event";
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
    };
  };
  numericDeltas: {
    publicStatus: "public_experimental";
    shape: "per_dimension";
    scalar: "none";
    dimensions: PulseDimension[];
    includedEvents: "published_only";
    inputMethodCoverage: "row_level_versioned_with_explicit_legacy";
    trailingWindowDays: number;
    boundsPerDimension: {
      lower: number;
      upper: number;
    };
    impactFormula: "severity_value * corroboration_confidence * exp(-ln(2) * days_since_event / category_half_life_days)";
    scoreStageOrder: ["corroborate", "score"];
    absorbedIntoIndexPolicy: "non_durable_zero_then_daily_recompute_can_restore";
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
    }))
    .sort((a, b) => a.feedId.localeCompare(b.feedId));

  const activeProductionSourceIds = uniqueSorted(
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
    providers: {
      classify: {
        mode: "cross_vendor_ensemble",
        engines: facts.classifyEngines.map(providerRef),
        decode: "deterministic",
        categoryConsensus: "strict_majority_of_successful_voters",
        minimumQuorum: 2,
        selfConfidenceRange: { lower: 0, upper: 1 },
        invalidSelfConfidencePolicy: "reject_response_as_unusable",
        severityValuePolicy: "require_finite_number_then_tier_clamp",
        degradedRunsRecorded: false,
        successfulProviderRunsRecorded: true,
        configuredProviderSetPersisted: false,
        providerFailuresPersisted: false,
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
        role: "attribute_event_by_subject_country",
        runsAfterClassification: true,
        acceptedScopes: ["single"],
        acceptedConfidence: ["high", "medium"],
        responseValidation: "strict_scope_confidence_and_iso3_shape",
        failurePolicy: "retain_ingest_attribution",
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
      activeDefinition:
        "A production-active feed is a source ID observed in raw_events by the stated evidence cut. A connector, configured source, or sync in another Civica pipeline does not qualify by itself.",
      activeProduction: {
        observedThrough: facts.activeFeedsObservedThrough,
        sourceIds: activeProductionSourceIds,
      },
      connectors,
    },
    cadence: {
      frequency: "daily",
      timezone: "UTC",
      continuous: false,
      stages,
    },
    clustering: {
      strategy: "semantic_or_lexical_fallback",
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
      },
      lexicalFallback: {
        condition: "embedding_model_unavailable",
        metric: "jaccard_token_similarity",
        threshold: facts.clustering.lexicalThreshold,
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
    },
    publicationPolicy: {
      majorityNone: "drop_not_governance_event",
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
      },
    },
    numericDeltas: {
      publicStatus: "public_experimental",
      shape: "per_dimension",
      scalar: "none",
      dimensions: [...facts.dimensions],
      includedEvents: "published_only",
      inputMethodCoverage: "row_level_versioned_with_explicit_legacy",
      trailingWindowDays: facts.scoreWindowDays,
      boundsPerDimension: {
        lower: facts.deltaBounds.lower,
        upper: facts.deltaBounds.upper,
      },
      impactFormula:
        "severity_value * corroboration_confidence * exp(-ln(2) * days_since_event / category_half_life_days)",
      scoreStageOrder: ["corroborate", "score"],
      absorbedIntoIndexPolicy:
        "non_durable_zero_then_daily_recompute_can_restore",
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
    },
    {
      feedId: "amnesty",
      connectorId: "hrw_amnesty",
      sourceIds: ["amnesty"],
      role: "specialist",
      status: "active_observed",
      defaultEnabled: true,
      observedInProduction: true,
      activation: "Default Amnesty International RSS feed.",
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
    },
    {
      feedId: "hrw",
      connectorId: "hrw_amnesty",
      sourceIds: ["hrw"],
      role: "specialist",
      status: "active_observed",
      defaultEnabled: true,
      observedInProduction: true,
      activation: "Default Human Rights Watch RSS feed.",
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
    dateWindowHours: 48,
    semanticThreshold: 0.75,
    lexicalThreshold: 0.42,
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
