import { createHash } from "node:crypto";

import { PULSE_RUNTIME_METHOD_VERSION } from "./runtime-contract";
import {
  SUBSCRIPTION_ENSEMBLE_CONFIGS,
  SUBSCRIPTION_VERIFY_PROVIDER_CONFIG,
} from "./provider";
import { SUBSCRIPTION_SUBJECT_ATTRIBUTION_MODEL } from "./country-attribution";

/** v1 remains the preserved, superseded preregistration; its checked artifact
 * (`data/research/pulse-validation-protocol-v1.json`) is never rewritten. */
export const SUPERSEDED_PULSE_VALIDATION_PROTOCOL_VERSION =
  "pulse-validation-protocol/v1" as const;

export const PULSE_VALIDATION_PROTOCOL_VERSION =
  "pulse-validation-protocol/v2" as const;

export const PULSE_REGRESSION_CASE_IDS = [
  "afghanistan-2021",
  "brazil-2023",
  "colombia-2016",
  "ethiopia-2020",
  "hungary-2010",
  "myanmar-2021",
  "niger-2023",
  "poland-2023",
  "sri-lanka-2022",
  "tunisia-2021",
] as const;

export const PULSE_PROSPECTIVE_WINDOW_DAYS = 90;

export const PULSE_VALIDATION_PROTOCOL = Object.freeze({
  schemaVersion: PULSE_VALIDATION_PROTOCOL_VERSION,
  lockedAt: "2026-08-17T20:30:00.000Z",
  status: "preregistered_not_started" as const,
  currentRuntimeMethod: PULSE_RUNTIME_METHOD_VERSION,
  // Pre-start supersession (IDX-038 precedent): v1 froze the paid HTTP
  // ensemble; no window ever started under it. v2 freezes the owner-approved
  // subscription-CLI configuration before any window start
  // (plan/pulse-subscription-runtime-resolution-v1.md, 2026-08-17). All v1
  // artifacts are preserved unchanged.
  supersedes: {
    version: SUPERSEDED_PULSE_VALIDATION_PROTOCOL_VERSION,
    checkedArtifact: "data/research/pulse-validation-protocol-v1.json",
    windowStartedUnderPrior: false,
    reason:
      "The classification configuration moved to the owner-Mac subscription-CLI transport under the owner's $0 authority before any prospective window started.",
  },
  classifierConfiguration: {
    transport: "subscription-cli" as const,
    classifyPanel: SUBSCRIPTION_ENSEMBLE_CONFIGS.map(
      ({ provider, model }) => ({ provider, model }),
    ),
    verifyEngine: {
      provider: SUBSCRIPTION_VERIFY_PROVIDER_CONFIG.provider,
      model: SUBSCRIPTION_VERIFY_PROVIDER_CONFIG.model,
    },
    subjectAttribution: {
      provider: "anthropic" as const,
      model: SUBSCRIPTION_SUBJECT_ATTRIBUTION_MODEL,
    },
    decodingDisclosure:
      "Subscription CLIs expose model selection but not temperature/seed; runs execute under provider-default decoding, recorded per run.",
    publicationRule:
      "Subscription-transport classifications always queue for human review and never publish automatically (PUL-036).",
    paidTransportAuthority:
      "The paid HTTP classifier path is disabled with a $0 cap; the scheduled classify route refuses non-subscription transports.",
  },
  labelPolicy: {
    ownerAndModelOutputsAreGold: false,
    independentHumanGoldRequired: true,
    prospectiveLabelEmbargo:
      "No prospective human label may be opened until the retained window outputs and sampling frame are frozen.",
    prohibited: [
      "tuning_on_prospective_labels",
      "dropping_pipeline_failures",
      "reclassifying_misses_as_out_of_scope_after_labels",
      "changing_thresholds_without_a_new_protocol_version",
      "substituting_famous_cases_for_probability_samples",
    ],
  },
  lanes: {
    regression: {
      purpose:
        "Named historical shocks guard known taxonomy, parser, direction, and lifecycle behavior.",
      cases: PULSE_REGRESSION_CASE_IDS,
      selection: "hand_curated_famous_cases",
      inferentialUse: "none",
      currentLegacyHarness:
        "single_engine_smoke_test_not_current_production_validation",
      requiredCurrentRun:
        "The exact frozen production ingestion-to-publication pipeline must also process the fixtures before any current-method claim.",
      failureMeaning:
        "A failed known-case expectation is a regression defect; a pass supplies no population performance estimate.",
    },
    retrospectiveValidity: {
      purpose:
        "Estimate full-pipeline errors on label-blind frozen probability samples from the retained pre-lock period.",
      period: { start: "2026-04-13", end: "2026-07-11", days: 90 },
      frozenProtocol: "pulse-evaluation-sampling-frame/v1",
      frames: [
        {
          id: "retained_event_candidate_census",
          initialDraw: 384,
          analysisTarget: 384,
          errorRoles: [
            "false_positive",
            "wrong_category_or_dimension",
            "spurious_extra_dimension",
            "wrong_severity",
            "wrong_jurisdiction",
            "publication_error",
          ],
        },
        {
          id: "system_negative_probability",
          initialDraw: 536,
          analysisTarget: 482,
          errorRoles: [
            "missed_event",
            "false_abstention",
            "deduplication_error",
            "invalid_input_handling",
          ],
        },
        {
          id: "country_day_retrieval_probability",
          initialDraw: 536,
          analysisTarget: 482,
          errorRoles: [
            "retrieval_miss",
            "false_no_event",
            "insufficient_observation_misstatement",
            "source_outage_effect",
          ],
        },
      ],
      pipelineRequirement:
        "Evaluate retrieval, clustering, attribution, classification, severity, abstention, publication, and observability separately and end to end.",
      failureRetention:
        "Every sampled failure remains in denominators and error ledgers.",
    },
    prospectiveShadow: {
      purpose:
        "Measure the frozen current pipeline on future evidence that was unavailable when the method was locked.",
      durationDays: PULSE_PROSPECTIVE_WINDOW_DAYS,
      extensionRule:
        "The window ends after 90 consecutive UTC days. An underpowered yield is reported as underpowered; dates are not extended after labels.",
      population:
        "All retrieved items, clusters, attempts, decisions, incident assignments, events, review obligations, and dimensional outputs created inside the window.",
      sampling:
        "After window closure, construct label-blind event-candidate, system-negative, and country-day frames with the frozen v1 allocator and seed derived only from the window identity.",
      requiredPipelineStages: [
        "ingest",
        "cluster",
        "classify",
        "corroborate",
        "review",
        "score",
      ],
      outputRetention:
        "Stage runs and all evidence-bearing inputs, attempts, decisions, projections, history, exclusions, and failures are retained before labels exist.",
      methodChangeRule:
        "Any semantic pipeline, prompt, model panel, ontology, source-basket, threshold, or publication-rule change ends the current window and requires a new protocol version/window.",
      providerModelChangePolicy:
        "Predeclared: subscription models are pinned by name and every run records the CLI-reported model identifier. A provider-side change in what a pinned name serves is not a Civica method change; it is detected from the run-level model logs and reported as a within-window configuration segment with segment-split sensitivity analyses. A Civica-side configuration change still ends the window under methodChangeRule.",
      reportingRule:
        "Publish the frozen results and limitations regardless of whether thresholds pass.",
    },
  },
  startPrerequisites: [
    "protocol_artifact_and_hash_checked_in",
    "runtime_method_and_every_stage_version_frozen",
    "scheduled_ingest_cluster_classify_score_and_review_sla_routes_enabled",
    "one_successful_current_version_run_for_each_automatic_stage",
    "append_only_evidence_and_output_history_live_validators_pass",
    "source_coverage_and_observability_snapshot_recorded",
    "no_prospective_human_labels_exist",
    "start_instant_and_planned_end_date_recorded_before_first_eligible_retrieval",
  ],
  analysisBoundary: {
    currentEnsembleRequired: true,
    fullPipelineRequired: true,
    agreementIsPerformanceMetric: false,
    regressionCanPromoteMethod: false,
    noResultIsAllowed: true,
  },
});

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function pulseValidationProtocolHash(
  protocol: unknown = PULSE_VALIDATION_PROTOCOL,
): string {
  return createHash("sha256").update(canonical(protocol)).digest("hex");
}

export function renderPulseValidationProtocol(): string {
  return `${JSON.stringify(
    {
      ...PULSE_VALIDATION_PROTOCOL,
      semanticSha256: pulseValidationProtocolHash(),
    },
    null,
    2,
  )}\n`;
}
