import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  comparePulseCoderSubmissions,
  PULSE_CODER_PILOT_VERSION,
  PULSE_INDEPENDENT_CODING_VERSION,
  pulseCoderPilotErrors,
  pulseCoderSubmissionErrors,
  type PulseCoderPilotPacket,
  type PulseCoderSubmission,
} from "./coder-protocol";
import { PULSE_EVENT_ONTOLOGY_VERSION } from "./event-ontology";

const pilot = JSON.parse(
  readFileSync("data/research/pulse-coder-pilot-v1.json", "utf8"),
);
const packet = pilot.packets.find(
  (row: PulseCoderPilotPacket) => row.id === "PILOT-002",
) as PulseCoderPilotPacket;

function submission(
  coderId: string,
  overrides: Partial<PulseCoderSubmission> = {},
): PulseCoderSubmission {
  return {
    schemaVersion: PULSE_INDEPENDENT_CODING_VERSION,
    pilotVersion: PULSE_CODER_PILOT_VERSION,
    packetId: packet.id,
    coderId,
    coderType: "agent_dry_pilot",
    useStatus: "dry_run_not_gold",
    submittedAt: "2026-07-11T23:00:00.000Z",
    locked: true,
    packetOutcome: "retrieval_miss",
    observationState: "low_coverage",
    observationRationale: "Two audit sources support an event, but general coverage is below the no-event threshold.",
    events: [
      {
        eventId: "internet-outage",
        eventDate: packet.date,
        datePrecision: "exact",
        primaryJurisdiction: packet.countryAlias,
        affectedJurisdictions: [],
        evidenceIds: ["h1", "h2"],
        retrievalStatus: "audit_search_only",
        annotation: {
          ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
          disposition: "qualifying_event",
          labels: [
            {
              categoryId: "internet_shutdown",
              facetId: "national-connectivity",
              effectDirection: "restrictive",
              severity: "material",
              evidenceIds: ["h1", "h2"],
              rationale: "The evidence documents an intentional national connectivity outage.",
            },
          ],
          candidateLabels: [],
          ambiguityReason: null,
        },
      },
    ],
    candidateEvents: [],
    excludedEvidenceIds: [],
    coderNotes: "Synthetic pilot only.",
    ...overrides,
  };
}

test("pilot separates teaching answers from blind cases", () => {
  assert.deepEqual(pulseCoderPilotErrors(pilot), []);
  const corrupted = structuredClone(pilot);
  const blind = corrupted.packets.find(
    (row: PulseCoderPilotPacket) => row.split === "blind_pilot",
  );
  blind.teachingAnswer = { packetOutcome: "true_negative" };
  assert.ok(
    pulseCoderPilotErrors(corrupted).some((error) =>
      error.includes("answer leaked"),
    ),
  );
});

test("agent pilot submissions are permanently non-gold", () => {
  const valid = submission("SP-CODER-A");
  assert.deepEqual(pulseCoderSubmissionErrors(valid, packet), []);
  assert.ok(
    pulseCoderSubmissionErrors(
      submission("SP-CODER-A", { useStatus: "evaluation_candidate" }),
      packet,
    ).some((error) => error.includes("cannot become evaluation gold")),
  );
});

test("packet outcomes enforce event, retrieval, and observability rules", () => {
  assert.ok(
    pulseCoderSubmissionErrors(
      submission("CODER-A", {
        packetOutcome: "true_negative",
        observationState: "low_coverage",
        events: [],
      }),
      packet,
    ).some((error) => error.includes("requires sufficient observation")),
  );
  assert.ok(
    pulseCoderSubmissionErrors(
      submission("CODER-A", {
        events: submission("CODER-A").events.map((event) => ({
          ...event,
          retrievalStatus: "pulse_retained",
        })),
      }),
      packet,
    ).some((error) => error.includes("requires audit-search-only")),
  );
});

test("coder disagreement remains an explicit multi-axis record", () => {
  const left = submission("SP-CODER-A");
  const right = submission("CX-CODER-B", {
    packetOutcome: "insufficient_observation",
    observationState: "undetermined",
    events: [],
    candidateEvents: [
      {
        candidateId: "possible-outage",
        eventDate: packet.date,
        evidenceIds: ["h1"],
        candidateLabels: [
          {
            categoryId: "internet_shutdown",
            reason: "Authority intent is unresolved.",
          },
        ],
        ambiguityReason:
          "The second coder does not treat authority intent as established.",
      },
    ],
  });
  const disagreement = comparePulseCoderSubmissions(left, right);
  assert.deepEqual(disagreement.axes, [
    "packet_outcome",
    "observability",
    "event_identity",
    "candidate_labels",
  ]);
  assert.equal(disagreement.submissionsRemainVisible, true);
});
