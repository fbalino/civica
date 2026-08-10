import assert from "node:assert/strict";
import test from "node:test";
import {
  PULSE_CODING_WORKSPACE_VERSION,
  pulseCodingAdjudicationErrors,
  pulseCodingCanAdjudicate,
  pulseCodingCanReadPeerSubmission,
  pulseCodingStudyExportIsTerminal,
  pulseCodingPacketErrors,
  pulseCodingPacketHash,
  pulseCodingSubmissionErrors,
  comparePulseCodingSubmissions,
  type PulseCodingAccessContext,
  type PulseCodingPacketSnapshot,
  type PulseCodingStudyContract,
  type PulseCodingSubmissionEnvelope,
} from "./coding-workspace";
import { PULSE_INDEPENDENT_CODING_VERSION } from "./coder-protocol";
import { PULSE_EVENT_ONTOLOGY_VERSION } from "./event-ontology";

const study: PulseCodingStudyContract = {
  schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
  id: "study-1",
  title: "Synthetic double-coding fixture",
  purpose: "instruction_pilot",
  protocolVersion: PULSE_INDEPENDENT_CODING_VERSION,
  codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
  ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
  datasetVersion: "fixture/v1",
  packetSetSha256: "a".repeat(64),
  traceSetSha256: null,
  status: "active",
};

const packetBody: Omit<PulseCodingPacketSnapshot, "packetSnapshotSha256"> = {
  schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
  studyId: study.id,
  datasetVersion: study.datasetVersion,
  packetSetSha256: study.packetSetSha256,
  id: "packet-1",
  date: "2026-04-01",
  jurisdiction: { id: "j-1", name: "Republic of Example", iso3: "EXA" },
  analysisStatus: "pilot",
  searchFamilies: ["institutions", "accountabilitySecurity", "broadCountryDay"],
  telemetry: { outage: false, note: "No outage recorded." },
  informationEnvironment: "not_supplied",
  evidence: [
    {
      id: "e-1",
      channel: "audit_search",
      sourceFamilyId: "wire-a",
      accessState: "metadata_only",
      reportedDate: "2026-04-01",
      text: "Election commission certified the result.",
    },
  ],
};
const packet: PulseCodingPacketSnapshot = {
  ...packetBody,
  packetSnapshotSha256: pulseCodingPacketHash(packetBody),
};

const submission: PulseCodingSubmissionEnvelope = {
  schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
  protocolVersion: PULSE_INDEPENDENT_CODING_VERSION,
  codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
  ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
  datasetVersion: study.datasetVersion,
  packetId: packet.id,
  packetSnapshotSha256: packet.packetSnapshotSha256,
  coderId: "coder-a",
  coderType: "qualified_human",
  useStatus: "dry_run_not_gold",
  submittedAt: "2026-07-11T20:00:00.000Z",
  locked: true,
  evidenceAssessments: [
    {
      evidenceId: "e-1",
      accessState: "accessible",
      dateRelevance: "relevant",
      reportedDate: "2026-04-01",
      sourceFamilyId: "wire-a",
      notes: "Accessible and date-relevant.",
    },
  ],
  addedEvidence: [],
  answer: {
    packetOutcome: "insufficient_observation",
    observationState: "low_coverage",
    observationRationale: "Only one independent source family is accessible.",
    events: [],
    candidateEvents: [
      {
        candidateId: "possible-transfer",
        eventDate: "2026-04-01",
        evidenceIds: ["e-1"],
        candidateLabels: [
          { categoryId: "peaceful_transfer", reason: "Handover is not yet evidenced." },
        ],
        ambiguityReason: "Certification alone does not establish an actual transfer.",
      },
    ],
    excludedEvidenceIds: [],
    coderNotes: "Synthetic instruction pilot.",
  },
};

function context(
  overrides: Partial<PulseCodingAccessContext> = {},
): PulseCodingAccessContext {
  return {
    participantId: "coder-a",
    role: "coder",
    assignedCoderIds: ["coder-a", "coder-b"],
    assignedAdjudicatorId: "judge-1",
    ownSubmissionLocked: false,
    bothSubmissionsLocked: false,
    adjudicationTerminal: false,
    ...overrides,
  };
}

test("workspace packet pins its blind snapshot", () => {
  assert.deepEqual(pulseCodingPacketErrors(packet, study), []);
  assert.ok(
    pulseCodingPacketErrors(
      { ...packet, jurisdiction: { ...packet.jurisdiction, name: "Changed" } },
      study,
    ).includes("packet snapshot hash drifted"),
  );
});

test("workspace submission records coder evidence judgments and stays non-gold", () => {
  assert.deepEqual(pulseCodingSubmissionErrors(submission, packet, study), []);
  assert.ok(
    pulseCodingSubmissionErrors(
      {
        ...submission,
        coderType: "agent_dry_pilot",
        useStatus: "evaluation_candidate",
      },
      packet,
      study,
    ).some((error) => error.includes("cannot become evaluation gold")),
  );
});

test("peer labels stay hidden from coders even after the pair locks", () => {
  assert.equal(pulseCodingCanReadPeerSubmission(context()), false);
  assert.equal(
    pulseCodingCanReadPeerSubmission(
      context({ ownSubmissionLocked: true, bothSubmissionsLocked: false }),
    ),
    false,
  );
  assert.equal(
    pulseCodingCanReadPeerSubmission(
      context({ ownSubmissionLocked: true, bothSubmissionsLocked: true }),
    ),
    false,
  );
});

test("adjudicator must be separate and both submissions must be locked", () => {
  const valid = context({
    participantId: "judge-1",
    role: "adjudicator",
    ownSubmissionLocked: false,
    bothSubmissionsLocked: true,
    adjudicationTerminal: false,
  });
  assert.equal(pulseCodingCanAdjudicate(valid), true);
  assert.deepEqual(
    pulseCodingAdjudicationErrors(
      {
        schemaVersion: PULSE_CODING_WORKSPACE_VERSION,
        packetId: packet.id,
        comparisonSha256: "b".repeat(64),
        adjudicatorId: "judge-1",
        status: "unresolved",
        reasonCodes: ["insufficient_context"],
        resolution: {
          kind: "unresolved",
          rationale: "The frozen evidence does not resolve the event date.",
        },
        recordedAt: "2026-07-11T20:30:00.000Z",
      },
      valid,
    ),
    [],
  );
  assert.equal(
    pulseCodingCanAdjudicate(
      context({
        participantId: "coder-a",
        role: "adjudicator",
        assignedAdjudicatorId: "coder-a",
        bothSubmissionsLocked: true,
      }),
    ),
    false,
  );
});

test("whole-study exports wait for a closed and terminal evidence set", () => {
  const base = {
    studyStatus: "closed",
    packetIds: ["packet-a", "packet-b"],
    comparisons: [
      {
        id: "comparison-a",
        packetId: "packet-a",
        disagreementAxes: [],
      },
      {
        id: "comparison-b",
        packetId: "packet-b",
        disagreementAxes: ["packet_outcome"],
      },
    ],
    adjudications: [
      { comparisonId: "comparison-b", status: "resolved" },
    ],
  };

  assert.equal(pulseCodingStudyExportIsTerminal(base), true);
  assert.equal(
    pulseCodingStudyExportIsTerminal({ ...base, studyStatus: "active" }),
    false,
  );
  assert.equal(
    pulseCodingStudyExportIsTerminal({ ...base, comparisons: [] }),
    false,
  );
  assert.equal(
    pulseCodingStudyExportIsTerminal({ ...base, adjudications: [] }),
    false,
  );
});

test("forbidden production labels fail coder and adjudicator payloads", () => {
  const leaked = structuredClone(submission) as PulseCodingSubmissionEnvelope & {
    productionLabel?: string;
  };
  leaked.productionLabel = "owner-approved";
  assert.ok(
    pulseCodingSubmissionErrors(leaked, packet, study).some((error) =>
      error.includes("forbidden blind field"),
    ),
  );
});

test("comparison requires two locked submissions and preserves raw hashes", () => {
  const right = structuredClone(submission);
  right.coderId = "coder-b";
  right.answer.packetOutcome = "true_negative";
  right.answer.observationState = "sufficient_observation";
  right.answer.observationRationale = "The complete audit found no event.";
  right.answer.candidateEvents = [];
  const { comparison, sha256 } = comparePulseCodingSubmissions(
    submission,
    right,
  );
  assert.deepEqual(comparison.disagreementAxes, [
    "packet_outcome",
    "observability",
    "candidate_labels",
  ]);
  assert.equal(comparison.rawSubmissionsRemainImmutable, true);
  assert.match(sha256, /^[a-f0-9]{64}$/);
  assert.throws(
    () =>
      comparePulseCodingSubmissions(
        { ...submission, locked: false, submittedAt: null },
        right,
      ),
    /two locked submissions/,
  );
});
