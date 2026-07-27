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
export const PULSE_EVALUATION_PACKET_FROZEN_INPUT_VERSION =
  "pulse-evaluation-packet-frozen-inputs/v1" as const;
export const PULSE_EVALUATION_PACKET_LIVE_AUDIT_VERSION =
  "pulse-evaluation-packet-live-audit/v1" as const;

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

export interface PulseEvaluationPacketFrozenInputs {
  schemaVersion: typeof PULSE_EVALUATION_PACKET_FROZEN_INPUT_VERSION;
  protocolVersion: typeof PULSE_EVALUATION_SAMPLING_VERSION;
  populationFreezeAt: string;
  populationArtifactSha256: string;
  acceptedEventIdentityHash: string;
  systemNegativeIdentityHash: string;
  packetManifestSemanticSha256: string;
  retainedInputSnapshotAt: string;
  reconstructionBasis: "append_only_history_unique_manifest_match";
  rightsPosture: "safe_context_only_no_publisher_payload";
  counts: {
    eventCandidates: number;
    systemNegativePopulation: number;
  };
  eventCandidates: PulseEvaluationPacketInput[];
  systemNegativePopulation: PulseEvaluationPacketInput[];
  semanticSha256: string;
}

export interface PulseEvaluationPacketPopulationReference {
  protocolVersion: string;
  populationFreezeAt: string;
  semanticSha256: string;
  counts: {
    retainedEventCandidateCensus: number;
    systemNegativePopulation: number;
  };
  identityHashes: {
    acceptedEvents: string;
    systemNegatives: string;
  };
}

export interface PulseEvaluationPacketInputDifference {
  frozenCount: number;
  liveCount: number;
  frozenPrimaryStratumCounts: Record<string, number>;
  livePrimaryStratumCounts: Record<string, number>;
  addedUnitRefs: string[];
  removedUnitRefs: string[];
  changedUnitRefs: string[];
  primaryStratumTransitions: Record<string, number>;
}

export interface PulseEvaluationPacketLiveAudit {
  schemaVersion: typeof PULSE_EVALUATION_PACKET_LIVE_AUDIT_VERSION;
  readOnly: true;
  checkedManifestSemanticSha256: string;
  frozenInputSemanticSha256: string;
  liveManifestSemanticSha256: string | null;
  liveManifestStatus: "matches" | "differs" | "cannot_rebuild";
  eventCandidates: PulseEvaluationPacketInputDifference;
  systemNegativePopulation: PulseEvaluationPacketInputDifference;
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
const PUBLISHER_PAYLOAD_KEYS = new Set([
  "title",
  "body",
  "raw",
  "headline",
  "description",
  "sourceUrl",
  "source_url",
  "publisherPayload",
]);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalPacketInput(input: PulseEvaluationPacketInput): PulseEvaluationPacketInput {
  return {
    unitRef: input.unitRef,
    referenceDate: input.referenceDate,
    primaryStratum: input.primaryStratum,
    evidence: [...input.evidence].sort((a, b) =>
      a.evidenceIdentityKey.localeCompare(b.evidenceIdentityKey),
    ),
  };
}

function canonicalPacketInputs(
  inputs: readonly PulseEvaluationPacketInput[],
): PulseEvaluationPacketInput[] {
  return inputs
    .map(canonicalPacketInput)
    .sort((a, b) => a.unitRef.localeCompare(b.unitRef));
}

export function buildPulseEvaluationPacketFrozenInputs(input: {
  populationArtifactSha256: string;
  acceptedEventIdentityHash: string;
  systemNegativeIdentityHash: string;
  packetManifestSemanticSha256: string;
  retainedInputSnapshotAt: string;
  eventCandidates: PulseEvaluationPacketInput[];
  systemNegativePopulation: PulseEvaluationPacketInput[];
}): PulseEvaluationPacketFrozenInputs {
  const eventCandidates = canonicalPacketInputs(input.eventCandidates);
  const systemNegativePopulation = canonicalPacketInputs(input.systemNegativePopulation);
  const body = {
    schemaVersion: PULSE_EVALUATION_PACKET_FROZEN_INPUT_VERSION,
    protocolVersion: PULSE_EVALUATION_SAMPLING_VERSION,
    populationFreezeAt: PULSE_EVALUATION_SAMPLING_PROTOCOL.populationFreezeAt,
    populationArtifactSha256: input.populationArtifactSha256,
    acceptedEventIdentityHash: input.acceptedEventIdentityHash,
    systemNegativeIdentityHash: input.systemNegativeIdentityHash,
    packetManifestSemanticSha256: input.packetManifestSemanticSha256,
    retainedInputSnapshotAt: input.retainedInputSnapshotAt,
    reconstructionBasis: "append_only_history_unique_manifest_match" as const,
    rightsPosture: "safe_context_only_no_publisher_payload" as const,
    counts: {
      eventCandidates: eventCandidates.length,
      systemNegativePopulation: systemNegativePopulation.length,
    },
    eventCandidates,
    systemNegativePopulation,
  };
  return { ...body, semanticSha256: hash(body) };
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

function hasPublisherPayloadKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasPublisherPayloadKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => PUBLISHER_PAYLOAD_KEYS.has(key) || hasPublisherPayloadKey(child),
  );
}

function packetInputErrors(
  input: PulseEvaluationPacketInput,
  context: string,
): string[] {
  const errors: string[] = [];
  if (!input.unitRef) errors.push(`${context}: unit reference is empty`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.referenceDate))
    errors.push(`${context}: reference date is invalid`);
  if (!input.primaryStratum) errors.push(`${context}: primary stratum is empty`);
  if (!input.evidence.length) errors.push(`${context}: evidence is empty`);
  const identities = input.evidence.map(({ evidenceIdentityKey }) => evidenceIdentityKey);
  if (new Set(identities).size !== identities.length)
    errors.push(`${context}: evidence identity is duplicated`);
  if (
    JSON.stringify(input.evidence) !==
    JSON.stringify(canonicalPacketInput(input).evidence)
  )
    errors.push(`${context}: evidence is not canonically ordered`);
  for (const evidence of input.evidence) {
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
      errors.push(`${context}: evidence context is invalid`);
  }
  return errors;
}

export function pulseEvaluationPacketFrozenInputErrors(
  frozen: PulseEvaluationPacketFrozenInputs,
  population?: PulseEvaluationPacketPopulationReference,
): string[] {
  const errors: string[] = [];
  if (frozen.schemaVersion !== PULSE_EVALUATION_PACKET_FROZEN_INPUT_VERSION)
    errors.push("wrong frozen-input version");
  if (frozen.protocolVersion !== PULSE_EVALUATION_SAMPLING_VERSION)
    errors.push("wrong frozen-input sampling protocol");
  if (frozen.populationFreezeAt !== PULSE_EVALUATION_SAMPLING_PROTOCOL.populationFreezeAt)
    errors.push("frozen-input population freeze drifted");
  if (frozen.reconstructionBasis !== "append_only_history_unique_manifest_match")
    errors.push("frozen-input reconstruction basis drifted");
  if (frozen.rightsPosture !== "safe_context_only_no_publisher_payload")
    errors.push("frozen-input rights posture permits publisher payload");
  if (
    Number.isNaN(Date.parse(frozen.retainedInputSnapshotAt)) ||
    new Date(frozen.retainedInputSnapshotAt).toISOString() !== frozen.retainedInputSnapshotAt
  )
    errors.push("frozen-input snapshot timestamp is invalid");
  if (
    frozen.counts.eventCandidates !== frozen.eventCandidates.length ||
    frozen.counts.systemNegativePopulation !== frozen.systemNegativePopulation.length
  )
    errors.push("frozen-input counts drifted");
  if (
    JSON.stringify(frozen.eventCandidates) !==
      JSON.stringify(canonicalPacketInputs(frozen.eventCandidates)) ||
    JSON.stringify(frozen.systemNegativePopulation) !==
      JSON.stringify(canonicalPacketInputs(frozen.systemNegativePopulation))
  )
    errors.push("frozen packet inputs are not canonically ordered");
  const eventIds = frozen.eventCandidates.map(({ unitRef }) => unitRef);
  const negativeIds = frozen.systemNegativePopulation.map(({ unitRef }) => unitRef);
  if (new Set(eventIds).size !== eventIds.length)
    errors.push("frozen event-candidate identity is duplicated");
  if (new Set(negativeIds).size !== negativeIds.length)
    errors.push("frozen system-negative identity is duplicated");
  if (hash(eventIds) !== frozen.acceptedEventIdentityHash)
    errors.push("frozen event-candidate identity hash drifted");
  if (hash(negativeIds.map((unitRef) => `raw:${unitRef}`)) !== frozen.systemNegativeIdentityHash)
    errors.push("frozen system-negative identity hash drifted");
  frozen.eventCandidates.forEach((row, index) =>
    errors.push(...packetInputErrors(row, `eventCandidates[${index}]`)),
  );
  frozen.systemNegativePopulation.forEach((row, index) =>
    errors.push(...packetInputErrors(row, `systemNegativePopulation[${index}]`)),
  );
  if (containsPulseCoderForbiddenField(frozen) || hasProductionOutputKey(frozen))
    errors.push("production, owner, model, review, or answer field leaked into frozen inputs");
  if (hasPublisherPayloadKey(frozen))
    errors.push("publisher payload leaked into frozen inputs");
  if (population) {
    if (
      population.protocolVersion !== frozen.protocolVersion ||
      population.populationFreezeAt !== frozen.populationFreezeAt ||
      population.semanticSha256 !== frozen.populationArtifactSha256
    )
      errors.push("frozen inputs are not linked to the population artifact");
    if (
      population.counts.retainedEventCandidateCensus !== frozen.counts.eventCandidates ||
      population.counts.systemNegativePopulation !== frozen.counts.systemNegativePopulation
    )
      errors.push("frozen inputs do not match population counts");
    if (
      population.identityHashes.acceptedEvents !== frozen.acceptedEventIdentityHash ||
      population.identityHashes.systemNegatives !== frozen.systemNegativeIdentityHash
    )
      errors.push("frozen inputs do not match population identity hashes");
  }
  const body = { ...frozen } as Record<string, unknown>;
  delete body.semanticSha256;
  if (frozen.semanticSha256 !== hash(body)) errors.push("frozen-input hash drifted");
  return errors;
}

export function buildPulseEvaluationPacketManifestFromFrozenInputs(
  frozen: PulseEvaluationPacketFrozenInputs,
): PulseEvaluationPacketManifest {
  const errors = pulseEvaluationPacketFrozenInputErrors(frozen);
  if (errors.length)
    throw new Error(`invalid frozen evaluation-packet inputs: ${errors.join("; ")}`);
  return buildPulseEvaluationPacketManifest({
    populationArtifactSha256: frozen.populationArtifactSha256,
    acceptedEventIdentityHash: frozen.acceptedEventIdentityHash,
    systemNegativeIdentityHash: frozen.systemNegativeIdentityHash,
    eventCandidates: frozen.eventCandidates,
    systemNegativePopulation: frozen.systemNegativePopulation,
  });
}

export function pulseEvaluationPacketReleaseErrors(input: {
  frozenInputs: PulseEvaluationPacketFrozenInputs;
  manifest: PulseEvaluationPacketManifest;
  population?: PulseEvaluationPacketPopulationReference;
}): string[] {
  const errors = [
    ...pulseEvaluationPacketFrozenInputErrors(input.frozenInputs, input.population),
    ...pulseEvaluationPacketManifestErrors(input.manifest),
  ];
  if (
    input.manifest.populationArtifactSha256 !== input.frozenInputs.populationArtifactSha256 ||
    input.manifest.populationFreezeAt !== input.frozenInputs.populationFreezeAt
  )
    errors.push("packet manifest is not linked to the frozen inputs");
  if (
    input.manifest.semanticSha256 !==
    input.frozenInputs.packetManifestSemanticSha256
  )
    errors.push("packet manifest does not match the frozen-input release pin");
  if (!errors.length) {
    const rebuilt = buildPulseEvaluationPacketManifestFromFrozenInputs(input.frozenInputs);
    if (JSON.stringify(rebuilt) !== JSON.stringify(input.manifest))
      errors.push("packet manifest does not reproduce from retained frozen inputs");
  }
  return errors;
}

function inputDifference(
  frozenRows: readonly PulseEvaluationPacketInput[],
  liveRows: readonly PulseEvaluationPacketInput[],
): PulseEvaluationPacketInputDifference {
  const frozen = new Map(
    canonicalPacketInputs(frozenRows).map((row) => [row.unitRef, row]),
  );
  const live = new Map(canonicalPacketInputs(liveRows).map((row) => [row.unitRef, row]));
  const addedUnitRefs = [...live.keys()].filter((unitRef) => !frozen.has(unitRef)).sort();
  const removedUnitRefs = [...frozen.keys()].filter((unitRef) => !live.has(unitRef)).sort();
  const changedUnitRefs: string[] = [];
  const primaryStratumTransitions: Record<string, number> = {};
  const stratumCounts = (rows: Iterable<PulseEvaluationPacketInput>) => {
    const counts: Record<string, number> = {};
    for (const row of rows)
      counts[row.primaryStratum] = (counts[row.primaryStratum] ?? 0) + 1;
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  };
  for (const [unitRef, frozenRow] of frozen) {
    const liveRow = live.get(unitRef);
    if (!liveRow || JSON.stringify(frozenRow) === JSON.stringify(liveRow)) continue;
    changedUnitRefs.push(unitRef);
    if (frozenRow.primaryStratum !== liveRow.primaryStratum) {
      const transition = `${frozenRow.primaryStratum}->${liveRow.primaryStratum}`;
      primaryStratumTransitions[transition] =
        (primaryStratumTransitions[transition] ?? 0) + 1;
    }
  }
  return {
    frozenCount: frozen.size,
    liveCount: live.size,
    frozenPrimaryStratumCounts: stratumCounts(frozen.values()),
    livePrimaryStratumCounts: stratumCounts(live.values()),
    addedUnitRefs,
    removedUnitRefs,
    changedUnitRefs: changedUnitRefs.sort(),
    primaryStratumTransitions: Object.fromEntries(
      Object.entries(primaryStratumTransitions).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

export function auditPulseEvaluationPacketLiveDifferences(input: {
  frozenInputs: PulseEvaluationPacketFrozenInputs;
  checkedManifest: PulseEvaluationPacketManifest;
  liveEventCandidates: PulseEvaluationPacketInput[];
  liveSystemNegativePopulation: PulseEvaluationPacketInput[];
}): PulseEvaluationPacketLiveAudit {
  let liveManifestSemanticSha256: string | null = null;
  let liveManifestStatus: PulseEvaluationPacketLiveAudit["liveManifestStatus"] =
    "cannot_rebuild";
  try {
    const live = buildPulseEvaluationPacketManifest({
      populationArtifactSha256: input.frozenInputs.populationArtifactSha256,
      acceptedEventIdentityHash: input.frozenInputs.acceptedEventIdentityHash,
      systemNegativeIdentityHash: input.frozenInputs.systemNegativeIdentityHash,
      eventCandidates: input.liveEventCandidates,
      systemNegativePopulation: input.liveSystemNegativePopulation,
    });
    liveManifestSemanticSha256 = live.semanticSha256;
    liveManifestStatus =
      live.semanticSha256 === input.checkedManifest.semanticSha256 ? "matches" : "differs";
  } catch {
    // A changed live identity frame is itself a reportable difference. The
    // frozen release validator never consumes this mutable comparison.
  }
  return {
    schemaVersion: PULSE_EVALUATION_PACKET_LIVE_AUDIT_VERSION,
    readOnly: true,
    checkedManifestSemanticSha256: input.checkedManifest.semanticSha256,
    frozenInputSemanticSha256: input.frozenInputs.semanticSha256,
    liveManifestSemanticSha256,
    liveManifestStatus,
    eventCandidates: inputDifference(
      input.frozenInputs.eventCandidates,
      input.liveEventCandidates,
    ),
    systemNegativePopulation: inputDifference(
      input.frozenInputs.systemNegativePopulation,
      input.liveSystemNegativePopulation,
    ),
  };
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
  if (hasPublisherPayloadKey(manifest)) errors.push("publisher payload leaked");
  const body = { ...manifest } as Record<string, unknown>;
  delete body.semanticSha256;
  if (manifest.semanticSha256 !== hash(body)) errors.push("manifest hash drifted");
  return errors;
}
