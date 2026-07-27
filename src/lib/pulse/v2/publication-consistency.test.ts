import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPulsePublishedDeltaRows,
  assertPulsePublishedEvidence,
  assertPulseScorePublication,
  PULSE_DIMENSIONS_PUBLICATION_COMPONENTS,
  pulsePublishedDeltaLineageStatus,
  PulseReleaseConsistencyError,
  withPulsePublicationLineageCoverage,
  type PulsePublicationPointerRow,
  type PulsePublishedDeltaContractRow,
} from "./publication-consistency";
import {
  derivationVersionKey,
  legacyDerivationVersionEnvelope,
} from "@/lib/research/derivation-version";
import {
  createPulsePipelineRunRef,
  pulseStageLegacyJsonVersionKey,
  pulseStageVersionKey,
  type PulseStageVersionEnvelope,
} from "./pipeline-version";
import {
  pulseDeltaVersionEnvelope,
  pulseEventVersionEnvelope,
} from "./versioning";
import { PULSE_DIMENSIONS } from "./types";

const RUN_ID = "00000000-0000-4000-8000-000000000014";

function pointer(): PulsePublicationPointerRow {
  const run = createPulsePipelineRunRef("score", {
    id: RUN_ID,
    sourceIds: ["source-a"],
    inputIds: ["event:event-a", "jurisdiction:jur-a"],
    inputFingerprint:
      "pulse-stage-input/sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  return {
    product: "pulse_dimensions",
    computationRunId: run.id,
    versionKey: run.versionKey,
    scoreAsOf: "2026-07-14",
    publishedAt: "2026-07-14T12:00:00.000Z",
    runStatus: "completed",
    runStage: "score",
    runVersionKey: run.versionKey,
    runVersions: run.versions,
    runCompletedAt: "2026-07-14T12:00:00.000Z",
  };
}

function rows(): PulsePublishedDeltaContractRow[] {
  return PULSE_DIMENSIONS.map((dimension, index) => {
    const contributingEventIds = index === 0 ? ["event-a"] : [];
    const version = pulseDeltaVersionEnvelope(
      index === 0 ? [pulseEventVersionEnvelope(["source-a"]).envelope] : [],
      index === 0 ? ["source-a"] : [],
    );
    return {
      schemaVersion: "pulse-dimensional-delta-history/v1",
      jurisdictionId: "jur-a",
      dimension,
      computationRunId: RUN_ID,
      scoreAsOf: "2026-07-14",
      contributingEventIds,
      derivationVersionKey: version.key,
      derivationVersions: version.envelope,
    };
  });
}

test("one completed pointer and one complete dimensional panel validate", () => {
  const publication = assertPulseScorePublication(pointer());
  assert.equal(publication.versionIdentity.runId, RUN_ID);
  assert.equal(
    publication.versionIdentity.versionKeySerialization,
    "stable_json_v1",
  );
  assert.doesNotThrow(() => assertPulsePublishedDeltaRows(publication, rows()));
  assert.doesNotThrow(() =>
    assertPulsePublishedEvidence(rows(), [
      {
        id: "event-a",
        jurisdictionId: "jur-a",
        dimension: "democratic_quality",
        sourceIds: ["source-a"],
        headline: "Original headline",
        eventDate: "2026-07-01",
        severityTier: "moderate_neg",
        severityValue: -2,
        corroborationConfidence: 0.8,
      },
    ]),
  );
});

test("a torn pointer fails closed", () => {
  const value = pointer();
  value.runVersionKey = value.runVersionKey.replace(/.$/, "0");
  assert.throws(
    () => assertPulseScorePublication(value),
    PulseReleaseConsistencyError,
  );
});

test("a self-consistent but obsolete score-run method cannot be published", () => {
  const value = pointer();
  value.runVersions = {
    ...value.runVersions,
    methodology: { state: "versioned", id: "pulse-obsolete" },
  };
  value.runVersionKey = pulseStageVersionKey(value.runVersions);
  value.versionKey = value.runVersionKey;
  assert.throws(
    () => assertPulseScorePublication(value),
    /score-run methodology/,
  );
});

test("the retained r2.15 publication verifies under the named legacy serialization", () => {
  const liveRetainedEnvelope: PulseStageVersionEnvelope = {
    schemaVersion: "pulse-stage-version-envelope/v1",
    stage: "score",
    methodology: { state: "versioned", id: "pulse-v2.15-beta" },
    ontology: { state: "versioned", id: "v2.0" },
    pipeline: {
      state: "versioned",
      id: "pulse-pipeline/versioned-lineage-v1",
    },
    algorithm: {
      state: "versioned",
      id: "pulse-delta/decay-window-v2.4+incident-resolution-v1+output-history-v1+absorption-evidence-v1",
    },
    prompt: {
      state: "not_applicable",
      reason: "score does not use a language-model decision prompt.",
    },
    sourceBasket: {
      state: "versioned",
      id: "source-basket/sha256:60d9497437eafcdd",
    },
    sourceIds: ["amnesty", "civicus_monitor", "hrw"],
    models: [],
    upstreamRunIds: [
      "00000000-0000-4000-8000-000000000003",
      "5517b156-272b-42d9-954d-07f1ccfed84f",
    ],
  };
  const retainedKey =
    "pulse-stage/sha256:9fd5e959138fb90abad8cc1ff04b1f5469f79684e35bb1132f9b7dd22a98f64b";
  assert.equal(pulseStageLegacyJsonVersionKey(liveRetainedEnvelope), retainedKey);
  const publication = assertPulseScorePublication({
    product: "pulse_dimensions",
    computationRunId: "4bdd6f46-5451-4cc4-a149-e4453914ac36",
    versionKey: retainedKey,
    scoreAsOf: "2026-07-12",
    publishedAt: "2026-07-12T14:26:10.262Z",
    runStatus: "completed",
    runStage: "score",
    runVersionKey: retainedKey,
    runVersions: liveRetainedEnvelope,
    runCompletedAt: "2026-07-12T14:26:10.262Z",
  });
  assert.equal(
    publication.versionIdentity.versionKeySerialization,
    "legacy_insertion_order_json_v1",
  );

  assert.throws(
    () =>
      assertPulseScorePublication({
        product: "pulse_dimensions",
        computationRunId: publication.versionIdentity.runId,
        versionKey: retainedKey,
        scoreAsOf: publication.scoreAsOf,
        publishedAt: publication.publishedAt,
        runStatus: "completed",
        runStage: "score",
        runVersionKey: retainedKey,
        runVersions: {
          ...liveRetainedEnvelope,
          sourceIds: [...liveRetainedEnvelope.sourceIds, "unknown-source"],
        },
        runCompletedAt: publication.completedAt,
      }),
    /does not match its key|source basket does not match/,
  );
});

test("a PLT-010 input snapshot can never downgrade to legacy serialization", () => {
  const current = pointer();
  assert.equal(pulseStageLegacyJsonVersionKey(current.runVersions), null);
  current.versionKey =
    "pulse-stage/sha256:9fd5e959138fb90abad8cc1ff04b1f5469f79684e35bb1132f9b7dd22a98f64b";
  current.runVersionKey = current.versionKey;
  assert.throws(
    () => assertPulseScorePublication(current),
    /does not match its key/,
  );
});

test("rows from an old and new score run cannot mix", () => {
  const publication = assertPulseScorePublication(pointer());
  const mixed = rows();
  mixed[2] = { ...mixed[2], computationRunId: "old-run" };
  assert.throws(
    () => assertPulsePublishedDeltaRows(publication, mixed),
    /another score run/,
  );
});

test("a partial dimensional panel cannot masquerade as a release", () => {
  const publication = assertPulseScorePublication(pointer());
  assert.throws(
    () => assertPulsePublishedDeltaRows(publication, rows().slice(0, 4)),
    /row is missing|expected 5/,
  );
});

test("a current run must cover every jurisdiction in its frozen input snapshot", () => {
  const publication = assertPulseScorePublication(pointer());
  publication.versionIdentity.versions = {
    ...publication.versionIdentity.versions,
    inputIds: [
      ...(publication.versionIdentity.versions.inputIds ?? []),
      "jurisdiction:jur-b",
    ],
  };
  assert.throws(
    () => withPulsePublicationLineageCoverage(publication, rows()),
    /does not match its jurisdiction input snapshot: missing 1; unexpected 0/,
  );
});

test("a row source outside the selected score-run basket fails closed", () => {
  const publication = assertPulseScorePublication(pointer());
  const mixed = rows();
  const version = pulseDeltaVersionEnvelope(
    [pulseEventVersionEnvelope(["source-b"]).envelope],
    ["source-b"],
  );
  mixed[0] = {
    ...mixed[0],
    derivationVersionKey: version.key,
    derivationVersions: version.envelope,
  };
  assert.throws(
    () => assertPulsePublishedDeltaRows(publication, mixed),
    /absent from the score run/,
  );
});

test("current and explicit legacy input rows remain distinct and visible", () => {
  const publication = assertPulseScorePublication(pointer());
  const mixed = rows();
  const legacy = pulseDeltaVersionEnvelope(
    [legacyDerivationVersionEnvelope("Retained event predates row lineage.")],
    ["source-a"],
  );
  mixed[0] = {
    ...mixed[0],
    derivationVersionKey: legacy.key,
    derivationVersions: legacy.envelope,
  };
  assert.doesNotThrow(() =>
    assertPulsePublishedDeltaRows(publication, mixed),
  );
  assert.equal(
    pulsePublishedDeltaLineageStatus(mixed[0]),
    "legacy_input_lineage",
  );
  assert.equal(
    pulsePublishedDeltaLineageStatus(mixed[1]),
    "current_versioned",
  );
  assert.deepEqual(
    withPulsePublicationLineageCoverage(publication, mixed).lineageCoverage,
    {
      schemaVersion: "pulse-score-lineage-coverage/v1",
      state: "mixed_current_and_legacy_input_lineage",
      totalRows: 5,
      totalJurisdictions: 1,
      currentVersionedRows: 4,
      legacyInputLineageRows: 1,
      legacyInputLineageJurisdictions: 1,
    },
  );

  const alteredEnvelope = {
    ...legacy.envelope,
    methodology: {
      state: "legacy_unversioned" as const,
      reason: "A guessed legacy state must not pass.",
    },
  };
  mixed[0] = {
    ...mixed[0],
    derivationVersions: alteredEnvelope,
    derivationVersionKey: derivationVersionKey(alteredEnvelope),
  };
  assert.throws(
    () => assertPulsePublishedDeltaRows(publication, mixed),
    /closed legacy-input state/,
  );
});

test("post-publication event or source edits fail the evidence check", () => {
  assert.throws(
    () =>
      assertPulsePublishedEvidence(rows(), [
        {
          id: "event-a",
          jurisdictionId: "jur-a",
          dimension: "rule_of_law",
          sourceIds: ["source-b"],
          headline: "Original headline",
          eventDate: "2026-07-01",
          severityTier: "moderate_neg",
          severityValue: -2,
          corroborationConfidence: 0.8,
        },
      ]),
    /changed dimension|source basket drifted/,
  );
});

test("mutable event details are honestly labeled live, not frozen evidence", () => {
  assert.deepEqual(PULSE_DIMENSIONS_PUBLICATION_COMPONENTS, {
    dimensionalScores: "frozen_score_publication",
    contributingEventIds: "frozen_score_publication",
    derivationLineage: "frozen_explicit_current_or_legacy_input_lineage",
    drivingEventDetails: "live_context",
    evidenceQualifiers: "live_context",
    scoreEvidenceLinkage:
      "live_context_id_jurisdiction_dimension_sources_checked",
    jurisdictionIdentity: "live_context",
    observability: "live_context",
    informationEnvironment: "live_context",
  });
  assert.doesNotThrow(() =>
    assertPulsePublishedEvidence(rows(), [
      {
        id: "event-a",
        jurisdictionId: "jur-a",
        dimension: "democratic_quality",
        sourceIds: ["source-a"],
        headline: "Edited after score publication",
        eventDate: "2026-07-02",
        severityTier: "major_neg",
        severityValue: -7,
        corroborationConfidence: 0.2,
      },
    ]),
  );
});

test("event jurisdiction drift still fails the live linkage check", () => {
  assert.throws(
    () =>
      assertPulsePublishedEvidence(rows(), [
        {
          id: "event-a",
          jurisdictionId: "jur-b",
          dimension: "democratic_quality",
          sourceIds: ["source-a"],
          headline: "Same event",
          eventDate: "2026-07-01",
          severityTier: "moderate_neg",
          severityValue: -2,
          corroborationConfidence: 0.8,
        },
      ]),
    /changed jurisdiction/,
  );
});
