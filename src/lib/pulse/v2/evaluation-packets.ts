import { createHash } from "node:crypto";
import {
  PULSE_INDEPENDENT_CODING_PROTOCOL,
  PULSE_INDEPENDENT_CODING_VERSION,
  containsPulseCoderForbiddenField,
} from "./coder-protocol";
import {
  PULSE_EVENT_ONTOLOGY,
  PULSE_EVENT_ONTOLOGY_VERSION,
} from "./event-ontology";
import {
  PULSE_EVALUATION_SAMPLING_PROTOCOL,
  PULSE_EVALUATION_SAMPLING_VERSION,
} from "./evaluation-sampling";

export const PULSE_EVALUATION_PACKET_MANIFEST_VERSION =
  "pulse-evaluation-packet-manifest/v1" as const;

export type PulseEvaluationPacketFrame =
  | "retained_event_candidate_census"
  | "system_negative_probability";

export interface PulseEvaluationEvidenceRef {
  evidenceIdentityKey: string;
  evidenceContentHash: string;
  sourceFamilyId: string;
  sourceType: "specialist" | "news";
  language: string;
  reportedDate: string | null;
  retrievedAt: string;
}

export interface PulseEvaluationPacketInput {
  unitRef: string;
  referenceDate: string;
  primaryStratum: string;
  evidence: PulseEvaluationEvidenceRef[];
}

export interface PulseEvaluationPacketManifestRow {
  packetKey: string;
  frame: PulseEvaluationPacketFrame;
  unitRef: string;
  analysisStatus: "analysis_candidate" | "reserve";
  referenceDate: string;
  primaryStratum: string;
  stratumPopulation: number;
  stratumDraw: number;
  inclusionProbability: number;
  primaryBaseWeight: number;
  requiredSearchFamilies: string[];
  evidenceRefs: PulseEvaluationEvidenceRef[];
  evidenceIdentityKeys: string[];
  evidenceContentHashes: string[];
  sourceFamilyIds: string[];
  sourceTypes: string[];
  languages: string[];
  packetMaterialSha256: string;
}

export interface PulseEvaluationPacketManifest {
  schemaVersion: typeof PULSE_EVALUATION_PACKET_MANIFEST_VERSION;
  protocolVersion: typeof PULSE_EVALUATION_SAMPLING_VERSION;
  codebookVersion: typeof PULSE_INDEPENDENT_CODING_VERSION;
  codebookSha256: string;
  ontologyVersion: typeof PULSE_EVENT_ONTOLOGY_VERSION;
  ontologySha256: string;
  populationFreezeAt: string;
  populationArtifactSha256: string;
  labelStatus: "unlabeled";
  rightsPosture: "private_rehydration_only_no_publisher_payload";
  counts: {
    eventCensus: number;
    systemNegativeInitialDraw: number;
    systemNegativeAnalysisTarget: number;
    systemNegativeReserve: number;
    totalPackets: number;
  };
  packets: PulseEvaluationPacketManifestRow[];
  semanticSha256: string;
}

const PRODUCTION_OUTPUT_KEYS = new Set([
  "category",
  "dimension",
  "severityTier",
  "severityValue",
  "classifierRuns",
  "classifierAgreement",
  "reviewStatus",
  "published",
  "humanReviewed",
  "corroborationConfidence",
]);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stableKey(frame: string, unitRef: string): string {
  return hash({ seed: PULSE_EVALUATION_SAMPLING_PROTOCOL.selection.seed, frame, unitRef });
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function manifestRow(
  frame: PulseEvaluationPacketFrame,
  input: PulseEvaluationPacketInput,
  analysisStatus: PulseEvaluationPacketManifestRow["analysisStatus"],
  sampling: { stratumPopulation: number; stratumDraw: number },
): PulseEvaluationPacketManifestRow {
  const evidence = [...input.evidence].sort((a, b) =>
    a.evidenceIdentityKey.localeCompare(b.evidenceIdentityKey),
  );
  const material = {
    frame,
    unitRef: input.unitRef,
    referenceDate: input.referenceDate,
    primaryStratum: input.primaryStratum,
    evidence,
  };
  const inclusionProbability = sampling.stratumDraw / sampling.stratumPopulation;
  return {
    packetKey: `PKT-${stableKey(frame, input.unitRef).slice(0, 20)}`,
    frame,
    unitRef: input.unitRef,
    analysisStatus,
    referenceDate: input.referenceDate,
    primaryStratum: input.primaryStratum,
    stratumPopulation: sampling.stratumPopulation,
    stratumDraw: sampling.stratumDraw,
    inclusionProbability,
    primaryBaseWeight: 1 / inclusionProbability,
    requiredSearchFamilies: [
      ...PULSE_INDEPENDENT_CODING_PROTOCOL.sufficientObservation.requiredSearchFamilies,
    ],
    evidenceRefs: evidence,
    evidenceIdentityKeys: evidence.map(({ evidenceIdentityKey }) => evidenceIdentityKey),
    evidenceContentHashes: evidence.map(({ evidenceContentHash }) => evidenceContentHash),
    sourceFamilyIds: uniqueSorted(evidence.map(({ sourceFamilyId }) => sourceFamilyId)),
    sourceTypes: uniqueSorted(evidence.map(({ sourceType }) => sourceType)),
    languages: uniqueSorted(evidence.map(({ language }) => language)),
    packetMaterialSha256: hash(material),
  };
}

export function buildPulseEvaluationPacketManifest(input: {
  populationArtifactSha256: string;
  acceptedEventIdentityHash: string;
  systemNegativeIdentityHash: string;
  eventCandidates: PulseEvaluationPacketInput[];
  systemNegativePopulation: PulseEvaluationPacketInput[];
}): PulseEvaluationPacketManifest {
  const eventCandidates = [...input.eventCandidates].sort((a, b) =>
    a.unitRef.localeCompare(b.unitRef),
  );
  const negativePopulation = [...input.systemNegativePopulation].sort((a, b) =>
    a.unitRef.localeCompare(b.unitRef),
  );
  if (hash(eventCandidates.map(({ unitRef }) => unitRef)) !== input.acceptedEventIdentityHash)
    throw new Error("event-candidate identity hash drifted");
  if (
    hash(negativePopulation.map(({ unitRef }) => `raw:${unitRef}`)) !==
    input.systemNegativeIdentityHash
  )
    throw new Error("system-negative identity hash drifted");

  const eventPackets = eventCandidates.map((row) =>
    manifestRow("retained_event_candidate_census", row, "analysis_candidate", {
      stratumPopulation: eventCandidates.filter(
        ({ primaryStratum }) => primaryStratum === row.primaryStratum,
      ).length,
      stratumDraw: eventCandidates.filter(
        ({ primaryStratum }) => primaryStratum === row.primaryStratum,
      ).length,
    }),
  );
  const negativeStrata = new Map<string, PulseEvaluationPacketInput[]>();
  for (const row of negativePopulation)
    negativeStrata.set(row.primaryStratum, [
      ...(negativeStrata.get(row.primaryStratum) ?? []),
      row,
    ]);
  const target = PULSE_EVALUATION_SAMPLING_PROTOCOL.precision.initialDrawPerProbabilityFrame;
  const quotas = Object.fromEntries(
    [...negativeStrata.entries()].map(([stratum, rows]) => [
      stratum,
      Math.floor((target * rows.length) / negativePopulation.length),
    ]),
  );
  let remaining = target - Object.values(quotas).reduce((sum, value) => sum + value, 0);
  for (const [stratum, rows] of [...negativeStrata.entries()].sort((a, b) => {
    const aRemainder = (target * a[1].length) / negativePopulation.length - quotas[a[0]];
    const bRemainder = (target * b[1].length) / negativePopulation.length - quotas[b[0]];
    return bRemainder - aRemainder || a[0].localeCompare(b[0]);
  })) {
    if (!remaining) break;
    if (quotas[stratum] < rows.length) {
      quotas[stratum]++;
      remaining--;
    }
  }
  const negativeDraw = [...negativeStrata.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([stratum, rows]) =>
      rows
        .map((row) => ({
          row,
          key: stableKey(`system_negative_probability|${stratum}`, row.unitRef),
        }))
        .sort((a, b) => a.key.localeCompare(b.key) || a.row.unitRef.localeCompare(b.row.unitRef))
        .slice(0, quotas[stratum]),
    )
    .sort((a, b) => a.key.localeCompare(b.key) || a.row.unitRef.localeCompare(b.row.unitRef))
    .map(({ row }, index) =>
      manifestRow(
        "system_negative_probability",
        row,
        index < PULSE_EVALUATION_SAMPLING_PROTOCOL.precision.validRequiredPerProbabilityFrame
          ? "analysis_candidate"
          : "reserve",
        {
          stratumPopulation: negativeStrata.get(row.primaryStratum)?.length ?? 0,
          stratumDraw: quotas[row.primaryStratum],
        },
      ),
    );
  const packets = [...eventPackets, ...negativeDraw];
  const body = {
    schemaVersion: PULSE_EVALUATION_PACKET_MANIFEST_VERSION,
    protocolVersion: PULSE_EVALUATION_SAMPLING_VERSION,
    codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
    codebookSha256: hash(PULSE_INDEPENDENT_CODING_PROTOCOL),
    ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
    ontologySha256: hash(PULSE_EVENT_ONTOLOGY),
    populationFreezeAt: PULSE_EVALUATION_SAMPLING_PROTOCOL.populationFreezeAt,
    populationArtifactSha256: input.populationArtifactSha256,
    labelStatus: "unlabeled" as const,
    rightsPosture: "private_rehydration_only_no_publisher_payload" as const,
    counts: {
      eventCensus: eventPackets.length,
      systemNegativeInitialDraw: negativeDraw.length,
      systemNegativeAnalysisTarget: negativeDraw.filter(
        ({ analysisStatus }) => analysisStatus === "analysis_candidate",
      ).length,
      systemNegativeReserve: negativeDraw.filter(
        ({ analysisStatus }) => analysisStatus === "reserve",
      ).length,
      totalPackets: packets.length,
    },
    packets,
  };
  return { ...body, semanticSha256: hash(body) };
}

function hasProductionOutputKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasProductionOutputKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => PRODUCTION_OUTPUT_KEYS.has(key) || hasProductionOutputKey(child),
  );
}

export function pulseEvaluationPacketManifestErrors(
  manifest: PulseEvaluationPacketManifest,
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== PULSE_EVALUATION_PACKET_MANIFEST_VERSION)
    errors.push("wrong packet-manifest version");
  if (manifest.protocolVersion !== PULSE_EVALUATION_SAMPLING_VERSION)
    errors.push("wrong sampling protocol");
  if (
    manifest.codebookVersion !== PULSE_INDEPENDENT_CODING_VERSION ||
    manifest.codebookSha256 !== hash(PULSE_INDEPENDENT_CODING_PROTOCOL)
  )
    errors.push("codebook contract drifted");
  if (
    manifest.ontologyVersion !== PULSE_EVENT_ONTOLOGY_VERSION ||
    manifest.ontologySha256 !== hash(PULSE_EVENT_ONTOLOGY)
  )
    errors.push("ontology contract drifted");
  if (manifest.populationFreezeAt !== PULSE_EVALUATION_SAMPLING_PROTOCOL.populationFreezeAt)
    errors.push("population freeze drifted");
  if (manifest.labelStatus !== "unlabeled") errors.push("manifest contains labels");
  if (manifest.rightsPosture !== "private_rehydration_only_no_publisher_payload")
    errors.push("rights posture permits publisher payload");
  if (
    manifest.counts.eventCensus !== 384 ||
    manifest.counts.systemNegativeInitialDraw !== 536 ||
    manifest.counts.systemNegativeAnalysisTarget !== 482 ||
    manifest.counts.systemNegativeReserve !== 54 ||
    manifest.counts.totalPackets !== 920 ||
    manifest.packets.length !== 920
  )
    errors.push("packet counts drifted");
  const packetKeys = new Set<string>();
  for (const packet of manifest.packets) {
    if (packetKeys.has(packet.packetKey)) errors.push(`duplicate ${packet.packetKey}`);
    packetKeys.add(packet.packetKey);
    if (!/^PKT-[a-f0-9]{20}$/.test(packet.packetKey))
      errors.push(`${packet.packetKey}: packet key is not opaque`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(packet.referenceDate))
      errors.push(`${packet.packetKey}: reference date is invalid`);
    if (
      !packet.primaryStratum ||
      packet.stratumPopulation < packet.stratumDraw ||
      packet.stratumDraw < 1 ||
      Math.abs(packet.inclusionProbability - packet.stratumDraw / packet.stratumPopulation) >
        1e-12 ||
      Math.abs(packet.primaryBaseWeight - 1 / packet.inclusionProbability) > 1e-9
    )
      errors.push(`${packet.packetKey}: sampling weight is invalid`);
    if (
      JSON.stringify([...packet.requiredSearchFamilies].sort()) !==
      JSON.stringify(
        [...PULSE_INDEPENDENT_CODING_PROTOCOL.sufficientObservation.requiredSearchFamilies].sort(),
      )
    )
      errors.push(`${packet.packetKey}: search-family context drifted`);
    if (!packet.evidenceIdentityKeys.length)
      errors.push(`${packet.packetKey}: evidence is empty`);
    if (
      packet.evidenceRefs.length !== packet.evidenceIdentityKeys.length ||
      JSON.stringify(packet.evidenceRefs.map(({ evidenceIdentityKey }) => evidenceIdentityKey)) !==
        JSON.stringify(packet.evidenceIdentityKeys) ||
      JSON.stringify(packet.evidenceRefs.map(({ evidenceContentHash }) => evidenceContentHash)) !==
        JSON.stringify(packet.evidenceContentHashes) ||
      packet.evidenceIdentityKeys.length !== packet.evidenceContentHashes.length ||
      packet.evidenceContentHashes.some((value) => !/^[a-f0-9]{64}$/.test(value))
    )
      errors.push(`${packet.packetKey}: evidence hashes are invalid`);
    for (const evidence of packet.evidenceRefs) {
      if (
        !/^pulse-evidence\/sha256:[a-f0-9]{64}$/.test(evidence.evidenceIdentityKey) ||
        !/^[a-f0-9]{64}$/.test(evidence.evidenceContentHash) ||
        !evidence.sourceFamilyId ||
        !["specialist", "news"].includes(evidence.sourceType) ||
        !evidence.language ||
        (evidence.reportedDate !== null &&
          !/^\d{4}-\d{2}-\d{2}$/.test(evidence.reportedDate)) ||
        Number.isNaN(Date.parse(evidence.retrievedAt))
      )
        errors.push(`${packet.packetKey}: evidence context is invalid`);
    }
    if (
      JSON.stringify(packet.sourceFamilyIds) !==
        JSON.stringify(uniqueSorted(packet.evidenceRefs.map(({ sourceFamilyId }) => sourceFamilyId))) ||
      JSON.stringify(packet.sourceTypes) !==
        JSON.stringify(uniqueSorted(packet.evidenceRefs.map(({ sourceType }) => sourceType))) ||
      JSON.stringify(packet.languages) !==
        JSON.stringify(uniqueSorted(packet.evidenceRefs.map(({ language }) => language)))
    )
      errors.push(`${packet.packetKey}: aggregate evidence context drifted`);
    const expectedMaterial = hash({
      frame: packet.frame,
      unitRef: packet.unitRef,
      referenceDate: packet.referenceDate,
      primaryStratum: packet.primaryStratum,
      evidence: packet.evidenceRefs,
    });
    if (packet.packetMaterialSha256 !== expectedMaterial)
      errors.push(`${packet.packetKey}: packet material hash drifted`);
  }
  if (containsPulseCoderForbiddenField(manifest) || hasProductionOutputKey(manifest))
    errors.push("production, owner, model, review, or answer field leaked");
  const body = { ...manifest } as Record<string, unknown>;
  delete body.semanticSha256;
  if (manifest.semanticSha256 !== hash(body)) errors.push("manifest hash drifted");
  return errors;
}
