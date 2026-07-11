import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  comparePulseCoderSubmissions,
  PULSE_CODER_PILOT_VERSION,
  PULSE_INDEPENDENT_CODING_VERSION,
  pulseCoderSubmissionErrors,
  type PulseCoderPilotPacket,
  type PulseCoderSubmission,
} from "../src/lib/pulse/v2/coder-protocol";

const pilot = JSON.parse(
  readFileSync(resolve("data/research/pulse-coder-pilot-v1.json"), "utf8"),
);
const submissionsA = JSON.parse(
  readFileSync(
    resolve("data/research/pulse-coder-pilot-sp-a-v1.json"),
    "utf8",
  ),
) as PulseCoderSubmission[];
const submissionsB = JSON.parse(
  readFileSync(
    resolve("data/research/pulse-coder-pilot-sp-b-v1.json"),
    "utf8",
  ),
) as PulseCoderSubmission[];
const packets = (pilot.packets as PulseCoderPilotPacket[]).filter(
  ({ split }) => split === "blind_pilot",
);
const packetById = new Map(packets.map((packet) => [packet.id, packet]));

for (const [coder, submissions] of [
  ["SP-CODER-A", submissionsA],
  ["SP-CODER-B", submissionsB],
] as const) {
  if (submissions.length !== packets.length)
    throw new Error(`${coder}: expected ${packets.length} submissions`);
  if (
    JSON.stringify(submissions.map(({ packetId }) => packetId)) !==
    JSON.stringify(packets.map(({ id }) => id))
  )
    throw new Error(`${coder}: packet order or coverage drifted`);
  for (const submission of submissions) {
    if (submission.coderId !== coder)
      throw new Error(`${submission.packetId}: wrong coder id`);
    const errors = pulseCoderSubmissionErrors(
      submission,
      packetById.get(submission.packetId),
    );
    if (errors.length)
      throw new Error(`${coder}/${submission.packetId}: ${errors.join("; ")}`);
  }
}

const comparisons = packets.map((packet, index) =>
  comparePulseCoderSubmissions(submissionsA[index], submissionsB[index]),
);
const axisCounts = Object.fromEntries(
  [...new Set(comparisons.flatMap(({ axes }) => axes))]
    .sort()
    .map((axis) => [
      axis,
      comparisons.filter(({ axes }) => axes.includes(axis)).length,
    ]),
);
const body = {
  schemaVersion: "pulse-coder-agent-pilot-results/v1",
  codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
  pilotVersion: PULSE_CODER_PILOT_VERSION,
  pilotSha256: pilot.semanticSha256,
  status: "synthetic_agent_dry_run_not_gold",
  coders: [
    {
      coderId: "SP-CODER-A",
      model: "gpt-5.3-codex-spark",
      role: "independent_blind_pilot_coder",
    },
    {
      coderId: "SP-CODER-B",
      model: "gpt-5.3-codex-spark",
      role: "independent_blind_pilot_coder",
    },
  ],
  submissions: {
    "SP-CODER-A": submissionsA,
    "SP-CODER-B": submissionsB,
  },
  comparisons,
  summary: {
    packets: packets.length,
    packetOutcomeExactAgreement: comparisons.filter(
      ({ axes }) => !axes.includes("packet_outcome"),
    ).length,
    allTrackedAxesExactAgreement: comparisons.filter(
      ({ axes }) => axes.length === 0,
    ).length,
    packetsWithDisagreement: comparisons.filter(({ axes }) => axes.length > 0)
      .length,
    axisCounts,
    interpretation:
      "Instruction and schema diagnostic only. Agent agreement or disagreement is not accuracy, reliability, validity, or gold truth.",
  },
};
const artifact = {
  ...body,
  semanticSha256: createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex"),
};
const output = resolve(
  "data/research/pulse-coder-agent-pilot-results-v1.json",
);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(
  `Wrote ${output}: ${artifact.summary.packetOutcomeExactAgreement}/${artifact.summary.packets} outcome agreement, ${artifact.summary.packetsWithDisagreement} packets with a tracked disagreement; hash ${artifact.semanticSha256}`,
);
