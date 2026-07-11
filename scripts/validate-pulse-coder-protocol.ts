import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PULSE_ADJUDICATION_REASON_CODES,
  PULSE_CODER_PILOT_VERSION,
  PULSE_INDEPENDENT_CODING_PROTOCOL,
  PULSE_INDEPENDENT_CODING_VERSION,
  comparePulseCoderSubmissions,
  pulseCoderPilotErrors,
  pulseCoderSubmissionErrors,
  type PulseCoderPilotPacket,
  type PulseCoderSubmission,
} from "../src/lib/pulse/v2/coder-protocol";
import {
  PULSE_EVENT_ONTOLOGY_VERSION,
  PULSE_EVENT_ONTOLOGY,
} from "../src/lib/pulse/v2/event-ontology";
import { EVENT_CATEGORIES } from "../src/lib/pulse/v2/taxonomy";

const boundaries = JSON.parse(
  readFileSync(
    resolve("data/research/pulse-category-coding-boundaries-v1.json"),
    "utf8",
  ),
);
const pilot = JSON.parse(
  readFileSync(resolve("data/research/pulse-coder-pilot-v1.json"), "utf8"),
);
const codebook = readFileSync(
  resolve("plan/research/pulse-independent-coding-codebook-v1.md"),
  "utf8",
);
const outputSchema = JSON.parse(
  readFileSync(
    resolve("data/research/pulse-coder-submission-output-schema-v1.json"),
    "utf8",
  ),
);
const submissionsA = JSON.parse(
  readFileSync(resolve("data/research/pulse-coder-pilot-sp-a-v1.json"), "utf8"),
) as PulseCoderSubmission[];
const submissionsB = JSON.parse(
  readFileSync(resolve("data/research/pulse-coder-pilot-sp-b-v1.json"), "utf8"),
) as PulseCoderSubmission[];
const pilotResults = JSON.parse(
  readFileSync(
    resolve("data/research/pulse-coder-agent-pilot-results-v1.json"),
    "utf8",
  ),
);

assert.equal(
  PULSE_INDEPENDENT_CODING_PROTOCOL.id,
  PULSE_INDEPENDENT_CODING_VERSION,
);
assert.equal(
  PULSE_INDEPENDENT_CODING_PROTOCOL.ontologyVersion,
  PULSE_EVENT_ONTOLOGY_VERSION,
);
assert.equal(boundaries.schemaVersion, "pulse-category-coding-boundaries/v1");
assert.equal(boundaries.ontologyVersion, PULSE_EVENT_ONTOLOGY_VERSION);
const { semanticSha256: boundaryHash, ...boundaryBody } = boundaries;
assert.equal(
  boundaryHash,
  createHash("sha256").update(JSON.stringify(boundaryBody)).digest("hex"),
);
assert.deepEqual(
  boundaries.categories.map((row: { categoryId: string }) => row.categoryId),
  EVENT_CATEGORIES.map(({ id }) => id),
);
const categoryIds = new Set(EVENT_CATEGORIES.map(({ id }) => id));
for (const row of boundaries.categories as Array<Record<string, unknown>>) {
  for (const field of [
    "operationalDefinition",
    "includeWhen",
    "excludeWhen",
  ]) {
    assert.ok(
      typeof row[field] === "string" && String(row[field]).trim().length >= 25,
      `${row.categoryId}: incomplete ${field}`,
    );
  }
  assert.ok(
    row.commonConfusion === null || categoryIds.has(String(row.commonConfusion)),
    `${row.categoryId}: unknown common confusion`,
  );
  assert.doesNotMatch(
    JSON.stringify(row),
    /country score|moral judgment|inferable political motive/i,
    `${row.categoryId}: boundary overclaims`,
  );
}
assert.equal(
  boundaries.categories.length,
  PULSE_EVENT_ONTOLOGY.categories.length,
);
assert.deepEqual(pulseCoderPilotErrors(pilot), []);
assert.equal(pilot.schemaVersion, PULSE_CODER_PILOT_VERSION);
assert.equal(
  pilot.packets.filter((row: { split: string }) => row.split === "training")
    .length,
  6,
);
assert.equal(
  pilot.packets.filter(
    (row: { split: string }) => row.split === "blind_pilot",
  ).length,
  12,
);
assert.equal(outputSchema.properties.submissions.minItems, 12);
assert.equal(outputSchema.properties.submissions.maxItems, 12);
const blindPackets = (pilot.packets as PulseCoderPilotPacket[]).filter(
  ({ split }) => split === "blind_pilot",
);
for (const [coderId, submissions] of [
  ["SP-CODER-A", submissionsA],
  ["SP-CODER-B", submissionsB],
] as const) {
  assert.equal(submissions.length, blindPackets.length);
  for (const [index, submission] of submissions.entries()) {
    assert.equal(submission.coderId, coderId);
    assert.deepEqual(
      pulseCoderSubmissionErrors(submission, blindPackets[index]),
      [],
    );
  }
}
assert.equal(pilotResults.status, "synthetic_agent_dry_run_not_gold");
assert.equal(pilotResults.pilotSha256, pilot.semanticSha256);
assert.deepEqual(pilotResults.submissions["SP-CODER-A"], submissionsA);
assert.deepEqual(pilotResults.submissions["SP-CODER-B"], submissionsB);
assert.deepEqual(
  pilotResults.comparisons,
  blindPackets.map((_, index) =>
    comparePulseCoderSubmissions(submissionsA[index], submissionsB[index]),
  ),
);
assert.equal(pilotResults.summary.packetOutcomeExactAgreement, 12);
assert.ok(pilotResults.summary.packetsWithDisagreement > 0);
assert.match(pilotResults.summary.interpretation, /not accuracy.*gold truth/i);
const { semanticSha256: resultsHash, ...resultsBody } = pilotResults;
assert.equal(
  resultsHash,
  createHash("sha256").update(JSON.stringify(resultsBody)).digest("hex"),
);
assert.doesNotMatch(
  JSON.stringify(pilotResults),
  /"(?:goldLabel|truth|adjudicatedAnswer|ownerApproval|modelVote)"\s*:/,
);

for (const required of [
  PULSE_INDEPENDENT_CODING_VERSION,
  PULSE_EVENT_ONTOLOGY_VERSION,
  PULSE_CODER_PILOT_VERSION,
  "pulse_retained",
  "audit_search",
  "Search silence is not a true negative",
  "Two-coder majority voting is meaningless and prohibited",
  "dry_run_not_gold",
  "Only qualified human adjudication may enter a later gold release",
  "data/research/pulse-category-coding-boundaries-v1.json",
  ...PULSE_ADJUDICATION_REASON_CODES,
]) {
  assert.ok(codebook.includes(required), `codebook is missing ${required}`);
}
for (const forbidden of [
  "owner decides the gold label",
  "model consensus is ground truth",
  "zero results prove no event",
]) {
  assert.ok(!codebook.toLowerCase().includes(forbidden), `codebook contains ${forbidden}`);
}

console.log(
  `PASS — ${PULSE_INDEPENDENT_CODING_VERSION}: ${boundaries.categories.length} category boundaries, 6 training packets, 12 answer-free blind pilot packets, two valid independent dry-run coders, ${pilotResults.summary.packetsWithDisagreement} visible disagreement packets, ${PULSE_ADJUDICATION_REASON_CODES.length} adjudication reasons, and no owner/model answer key.`,
);
