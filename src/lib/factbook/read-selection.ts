import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  countryFactVintageCandidates,
  countryFactVintages,
  countryFactVintageReleases,
} from "@/lib/db/schema";
import { parseAtlasVintageLabel, stableStringify } from "@/lib/data/frozen-vintage";
import {
  ATLAS_EXPORT_VINTAGE_LABEL,
  loadAtlasReleaseRegenerationInputs,
  type AtlasLegacyFactMetadata,
} from "@/lib/exports/atlas-release";
import { candidateContentHash } from "@/lib/factbook/reconcile/candidate-vintage";
import {
  derivationVersionErrors,
  derivationVersionKey,
  matchesVersion,
  type DerivationVersionEnvelope,
  type VersionRef,
} from "@/lib/research/derivation-version";
import type {
  DecisionReason,
  DecisionTraceStep,
  FactRow,
  ResolverOutput,
} from "@/lib/factbook/reconcile/types";

export type AtlasReadSelection =
  | { mode: "live"; asOf: "live" }
  | { mode: "vintage"; asOf: string };

export function parseAtlasReadSelection(value: string | null):
  | { selection: AtlasReadSelection; error: null }
  | { selection: null; error: string } {
  const normalized = value?.trim();
  if (!normalized) return { selection: null, error: "as_of is required; use as_of=live or an immutable vintage label" };
  if (normalized === "live") return { selection: { mode: "live", asOf: "live" }, error: null };
  if (!/^Civica Atlas Reconciled v[^\s]+ — vintage \d{4}-Q[1-4]$/.test(normalized)) {
    return { selection: null, error: "as_of must be live or a complete Civica Atlas immutable vintage label" };
  }
  return { selection: { mode: "vintage", asOf: normalized }, error: null };
}

export interface AtlasSelectionMetadata {
  mode: "live" | "vintage";
  asOf: string;
  vintage: string | null;
  cutoffAt: string | null;
  retrievedThrough: string | null;
  methodologyVersions: string[];
  candidateSetStatus: "live" | "complete_candidates" | "canonical_only_legacy";
  candidateSetChecksum: string | null;
  winnerSetChecksum: string | null;
  resolverVersionHash: string | null;
}

export async function immutableVintageExists(vintageLabel: string): Promise<boolean> {
  const rows = await db.select({ id: countryFactVintageReleases.id }).from(countryFactVintageReleases).where(and(
    eq(countryFactVintageReleases.vintageLabel, vintageLabel),
    inArray(countryFactVintageReleases.completenessStatus, ["complete_candidates", "canonical_only_legacy"]),
  )).limit(1);
  return rows.length > 0;
}

export async function getImmutableVintageMetadata(vintageLabel: string): Promise<{ cutoffAt: string | null; retrievedThrough: string | null; methodologyVersions: string[]; candidateSetStatus: "complete_candidates" | "canonical_only_legacy"; candidateSetChecksum: string | null; winnerSetChecksum: string | null; resolverVersionHash: string | null }> {
  const [rows, releaseRows] = await Promise.all([
    db.select({
      id: countryFactVintages.id,
      jurisdictionId: countryFactVintages.jurisdictionId,
      factKey: countryFactVintages.factKey,
      vintageLabel: countryFactVintages.vintageLabel,
      canonicalCandidateId: countryFactVintages.canonicalCandidateId,
      sourceRetrievedAt: countryFactVintages.sourceRetrievedAt,
      civicaPublicationVersion: countryFactVintages.civicaPublicationVersion,
      methodologyVersion: countryFactVintages.methodologyVersion,
      derivationVersionKey: countryFactVintages.derivationVersionKey,
      derivationVersions: countryFactVintages.derivationVersions,
      cutAtTimestamp: countryFactVintages.cutAtTimestamp,
      contentHash: countryFactVintages.contentHash,
    }).from(countryFactVintages).where(eq(countryFactVintages.vintageLabel, vintageLabel)),
    db.select().from(countryFactVintageReleases).where(eq(countryFactVintageReleases.vintageLabel, vintageLabel)).limit(1),
  ]);
  const release = releaseRows[0];
  if (!release || (release.completenessStatus !== "complete_candidates" && release.completenessStatus !== "canonical_only_legacy")) throw new Error(`Unsupported immutable vintage: ${vintageLabel}`);
  validateFrozenReleaseRows({ release, rows });
  if (rows.length !== release.winnerCount) {
    throw new Error(`Frozen Atlas release winner coverage disagrees for ${vintageLabel}`);
  }
  const retrieved = rows.map((row) => row.sourceRetrievedAt?.toISOString()).filter((value): value is string => Boolean(value)).sort();
  return { cutoffAt: release.cutAtTimestamp.toISOString(), retrievedThrough: retrieved.at(-1) ?? null, methodologyVersions: [release.methodologyVersion], candidateSetStatus: release.completenessStatus, candidateSetChecksum: release.candidateSetChecksum, winnerSetChecksum: release.winnerSetChecksum, resolverVersionHash: release.resolverVersionHash };
}

export async function getFrozenDisplayFactsForJurisdictions(
  jurisdictionIds: string[],
  factKeys: string[],
  vintageLabel: string,
): Promise<Map<string, Map<string, { text: string | null; numeric: number | null }>>> {
  const output = new Map<string, Map<string, { text: string | null; numeric: number | null }>>();
  if (!jurisdictionIds.length || !factKeys.length) return output;
  const [rows, releaseRows] = await Promise.all([
    db.select().from(countryFactVintages).where(and(
      inArray(countryFactVintages.jurisdictionId, jurisdictionIds),
      inArray(countryFactVintages.factKey, factKeys),
      eq(countryFactVintages.vintageLabel, vintageLabel),
    )),
    db.select().from(countryFactVintageReleases).where(and(
      eq(countryFactVintageReleases.vintageLabel, vintageLabel),
      inArray(countryFactVintageReleases.completenessStatus, ["complete_candidates", "canonical_only_legacy"]),
    )).limit(1),
  ]);
  const release = releaseRows[0];
  if (!release) throw new Error(`Unsupported immutable vintage: ${vintageLabel}`);
  validateFrozenReleaseRows({ release, rows });
  for (const row of rows) {
    const facts = output.get(row.jurisdictionId) ?? new Map();
    facts.set(row.factKey, { text: row.valueText, numeric: row.valueNumeric == null ? null : Number(row.valueNumeric) });
    output.set(row.jurisdictionId, facts);
  }
  return output;
}

export function metadataFromResolutions(
  selection: AtlasReadSelection,
  resolutions: Record<string, ResolverOutput>,
  frozen?: { cutoffAt: string | null; retrievedThrough?: string | null; methodologyVersions: string[]; candidateSetStatus: "complete_candidates" | "canonical_only_legacy"; candidateSetChecksum?: string | null; winnerSetChecksum?: string | null; resolverVersionHash?: string | null },
): AtlasSelectionMetadata {
  if (selection.mode === "vintage") {
    if (!frozen) {
      throw new Error(`Frozen Atlas selection metadata is unavailable for ${selection.asOf}`);
    }
    return {
      mode: "vintage",
      asOf: selection.asOf,
      vintage: selection.asOf,
      cutoffAt: frozen.cutoffAt,
      retrievedThrough: frozen.retrievedThrough ?? null,
      methodologyVersions: [...new Set(frozen.methodologyVersions)].sort(),
      candidateSetStatus: frozen.candidateSetStatus,
      candidateSetChecksum: frozen.candidateSetChecksum ?? null,
      winnerSetChecksum: frozen.winnerSetChecksum ?? null,
      resolverVersionHash: frozen.resolverVersionHash ?? null,
    };
  }
  const rows = Object.values(resolutions).flatMap((resolution) => resolution.all);
  const retrieved = rows.map((row) => row.retrievedAt).filter(Boolean).sort();
  return {
    mode: "live",
    asOf: "live",
    vintage: null,
    cutoffAt: null,
    retrievedThrough: retrieved.at(-1) ?? null,
    methodologyVersions: [...new Set(rows.map((row) => row.methodologyVersion))].sort(),
    candidateSetStatus: "live",
    candidateSetChecksum: null,
    winnerSetChecksum: null,
    resolverVersionHash: null,
  };
}

type FrozenVintageResolutionRow = Pick<
  typeof countryFactVintages.$inferSelect,
  | "id"
  | "jurisdictionId"
  | "factKey"
  | "vintageLabel"
  | "canonicalFactId"
  | "canonicalCandidateId"
  | "valueText"
  | "valueNumeric"
  | "valueUnit"
  | "valueJson"
  | "asOf"
  | "observationReferenceYear"
  | "sourceId"
  | "sourceRetrievedAt"
  | "snapshotAt"
  | "upstreamDatasetRelease"
  | "civicaPublicationVersion"
  | "methodologyVersion"
  | "derivationVersionKey"
  | "derivationVersions"
  | "cutAtTimestamp"
  | "contentHash"
  | "isDisputedAtCut"
  | "supersedesVintageLabel"
>;

type FrozenVintageIdentityRow = Pick<
  typeof countryFactVintages.$inferSelect,
  | "id"
  | "jurisdictionId"
  | "factKey"
  | "vintageLabel"
  | "canonicalCandidateId"
  | "civicaPublicationVersion"
  | "methodologyVersion"
  | "derivationVersionKey"
  | "derivationVersions"
  | "cutAtTimestamp"
  | "contentHash"
>;

type FrozenCandidateResolutionRow = Pick<
  typeof countryFactVintageCandidates.$inferSelect,
  | "id"
  | "vintageLabel"
  | "cutAtTimestamp"
  | "jurisdictionId"
  | "factKey"
  | "sourceId"
  | "sourceRowId"
  | "inputEvidenceKind"
  | "inputEvidenceHash"
  | "adapterVersionHash"
  | "candidateContentHash"
  | "candidateStatus"
  | "candidatePayload"
  | "isCanonicalAtCut"
  | "decisionReason"
  | "decisionTrace"
>;

type FrozenReleaseRow = Pick<
  typeof countryFactVintageReleases.$inferSelect,
  | "vintageLabel"
  | "cutAtTimestamp"
  | "methodologyVersion"
  | "resolverVersionHash"
  | "completenessStatus"
  | "candidateCount"
  | "winnerCount"
  | "candidateSetChecksum"
  | "winnerSetChecksum"
  | "inputManifest"
>;

const SHA256 = /^[a-f0-9]{64}$/;

function sameInstant(a: Date | null, b: Date): boolean {
  return Boolean(a) && a!.getTime() === b.getTime();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function orderedVersionRef(ref: VersionRef): VersionRef {
  return ref.state === "versioned"
    ? { state: ref.state, id: ref.id }
    : { state: ref.state, reason: ref.reason };
}

/** PostgreSQL jsonb does not preserve object-key order; recreate the writer's
 * declared envelope order before checking the historical JSON.stringify key. */
function storedDerivationVersionKey(versions: DerivationVersionEnvelope): string {
  return derivationVersionKey({
    schemaVersion: versions.schemaVersion,
    methodology: orderedVersionRef(versions.methodology),
    algorithm: orderedVersionRef(versions.algorithm),
    prompt: orderedVersionRef(versions.prompt),
    taxonomy: orderedVersionRef(versions.taxonomy),
    sourceBasket: orderedVersionRef(versions.sourceBasket),
    sourceIds: versions.sourceIds,
  });
}

function assertPublishedFrozenRelease(release: FrozenReleaseRow): void {
  const identity = parseAtlasVintageLabel(release.vintageLabel);
  if (identity.methodologyVersion !== release.methodologyVersion) {
    throw new Error(`Frozen Atlas release methodology disagrees with ${release.vintageLabel}`);
  }
  if (
    !Number.isFinite(release.cutAtTimestamp.getTime()) ||
    release.winnerCount <= 0 ||
    !SHA256.test(release.winnerSetChecksum)
  ) {
    throw new Error(`Frozen Atlas release header is incomplete for ${release.vintageLabel}`);
  }
  if (release.completenessStatus === "complete_candidates") {
    if (
      release.candidateCount == null ||
      release.candidateCount <= 0 ||
      !release.candidateSetChecksum ||
      !SHA256.test(release.candidateSetChecksum) ||
      !SHA256.test(release.resolverVersionHash) ||
      !isRecord(release.inputManifest) ||
      release.inputManifest.schemaVersion !== "reconciliation-candidate-input-manifest/v1" ||
      !Array.isArray(release.inputManifest.sources)
    ) {
      throw new Error(`Complete candidate Atlas release header is incomplete for ${release.vintageLabel}`);
    }
    return;
  }
  if (
    release.completenessStatus !== "canonical_only_legacy" ||
    release.vintageLabel !== ATLAS_EXPORT_VINTAGE_LABEL ||
    release.candidateCount !== null ||
    release.candidateSetChecksum !== null ||
    release.resolverVersionHash !== "legacy-unrecorded" ||
    !isRecord(release.inputManifest) ||
    release.inputManifest.schemaVersion !== "reconciliation-candidate-input-manifest/v1" ||
    release.inputManifest.status !== "historical-inputs-not-retained"
  ) {
    throw new Error(`Atlas release is unpublished or its canonical-only limitation is not explicit: ${release.vintageLabel}`);
  }
}

export function validateFrozenReleaseRows(input: {
  release: FrozenReleaseRow;
  jurisdictionId?: string;
  rows: readonly FrozenVintageIdentityRow[];
}): void {
  assertPublishedFrozenRelease(input.release);
  const rowIds = new Set<string>();
  const factKeys = new Set<string>();
  for (const row of input.rows) {
    const hasVersionEnvelope = isRecord(row.derivationVersions);
    const versions = row.derivationVersions as DerivationVersionEnvelope;
    const versionErrors = derivationVersionErrors(versions, {
      allowLegacy: input.release.completenessStatus === "canonical_only_legacy",
    });
    const derivationKeyMatches = hasVersionEnvelope && (
      input.release.completenessStatus === "canonical_only_legacy"
        ? row.derivationVersionKey === "derivation/legacy-unversioned/country_fact_vintages"
        : storedDerivationVersionKey(versions) === row.derivationVersionKey
    );
    if (
      row.vintageLabel !== input.release.vintageLabel ||
      row.civicaPublicationVersion !== input.release.vintageLabel ||
      row.methodologyVersion !== input.release.methodologyVersion ||
      !sameInstant(row.cutAtTimestamp, input.release.cutAtTimestamp) ||
      typeof row.contentHash !== "string" ||
      !SHA256.test(row.contentHash) ||
      !hasVersionEnvelope ||
      versionErrors.length > 0 ||
      !derivationKeyMatches ||
      (input.release.completenessStatus === "complete_candidates" &&
        !matchesVersion(versions, "methodology", input.release.methodologyVersion))
    ) {
      throw new Error(`Frozen Atlas row identity disagrees for ${row.id}`);
    }
    if (input.jurisdictionId && row.jurisdictionId !== input.jurisdictionId) {
      throw new Error(`Frozen Atlas row ${row.id} belongs to another jurisdiction`);
    }
    const factIdentity = `${row.jurisdictionId}\0${row.factKey}`;
    if (rowIds.has(row.id) || factKeys.has(factIdentity)) {
      throw new Error(`Frozen Atlas release contains a duplicate row identity for ${row.factKey}`);
    }
    rowIds.add(row.id);
    factKeys.add(factIdentity);
    if (
      (input.release.completenessStatus === "complete_candidates" && !row.canonicalCandidateId) ||
      (input.release.completenessStatus === "canonical_only_legacy" && row.canonicalCandidateId !== null)
    ) {
      throw new Error(`Frozen Atlas winner pointer disagrees for ${row.factKey}`);
    }
  }
}

const DECISION_REASONS = new Set<DecisionReason>([
  "single_source",
  "agreement",
  "fresher_winner",
  "incumbent_held",
  "cia_default_group_a",
  "cia_default_group_c",
  "no_active_rows",
]);

const DECISION_TRACE_CODES = new Set<DecisionTraceStep["code"]>([
  "row_eligibility",
  "measurement_partition",
  "source_lineage",
  "precedence_rule",
  "guard_result",
  "canonical_selection",
]);

function retainedDecisionReason(value: string | null): DecisionReason {
  if (!value || !DECISION_REASONS.has(value as DecisionReason)) {
    throw new Error("Complete candidate vintage winner is missing a valid retained decision reason");
  }
  return value as DecisionReason;
}

function retainedDecisionTrace(value: unknown): DecisionTraceStep[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((step) => {
    if (!step || typeof step !== "object") return false;
    const candidate = step as Partial<DecisionTraceStep>;
    return (
      typeof candidate.code === "string" &&
      DECISION_TRACE_CODES.has(candidate.code as DecisionTraceStep["code"]) &&
      typeof candidate.outcome === "string" &&
      typeof candidate.detail === "string" &&
      Array.isArray(candidate.sourceIds) &&
      candidate.sourceIds.every((sourceId) => typeof sourceId === "string")
    );
  })) {
    throw new Error("Complete candidate vintage winner is missing a valid retained decision trace");
  }
  return value as DecisionTraceStep[];
}

function legacyFrozenResolution(
  row: FrozenVintageResolutionRow,
  metadata: AtlasLegacyFactMetadata | undefined,
): ResolverOutput {
  if (!metadata) {
    throw new Error(`Canonical-only legacy Atlas fact ${row.id} lacks checked frozen metadata`);
  }
  const retrievedAt = (row.sourceRetrievedAt ?? row.snapshotAt).toISOString();
  const fact: FactRow = {
    id: row.canonicalFactId,
    jurisdictionId: row.jurisdictionId,
    factKey: row.factKey,
    factGroup: metadata.factGroup,
    category: metadata.category,
    sourceId: row.sourceId,
    sourceUrl: metadata.sourceUrl,
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: null,
    factValue: row.valueText,
    factValueNumeric: row.valueNumeric == null ? null : Number(row.valueNumeric),
    factUnit: row.valueUnit,
    factYear: row.observationReferenceYear,
    valueJson: row.valueJson,
    valueStatus: metadata.valueStatus,
    valueStatusReason: metadata.valueStatusReason,
    asOf: row.asOf,
    dataVintageYear: row.observationReferenceYear,
    retrievedAt,
    upstreamVintageLabel: row.upstreamDatasetRelease,
    methodologyVersion: row.methodologyVersion,
    status: "active",
    statusReason: null,
    sourceNote: null,
    valueType: metadata.valueType,
    growthMethodology: metadata.growthMethodology,
  };
  return {
    jurisdictionId: row.jurisdictionId,
    factKey: row.factKey,
    canonical: fact,
    alternates: [fact],
    all: [fact],
    isDisputed: row.isDisputedAtCut ?? false,
    decisionReason: "canonical_only_legacy",
    decisionTrace: [{
      code: "canonical_selection",
      outcome: "canonical_only_legacy_selection",
      detail: `Published canonical selection from ${row.vintageLabel}. Historical alternates, candidate counts, and the cut-time decision reason were not retained and are not reconstructed from current rows.`,
      sourceIds: [row.sourceId],
    }],
    proposedDisputes: [],
    canonicalIsProjection: metadata.valueType === "projected",
  };
}

/**
 * Rehydrates immutable resolver output without consulting current fact-key
 * definitions or mutable country_facts rows for complete-candidate releases.
 * Exported as a fixture seam so regressions can be proved without a database.
 */
export function frozenResolutionsFromRows(input: {
  jurisdictionId: string;
  candidateSetStatus: "complete_candidates" | "canonical_only_legacy";
  vintageRows: readonly FrozenVintageResolutionRow[];
  candidateRows: readonly FrozenCandidateResolutionRow[];
  legacyMetadataBySnapshotId?: Readonly<Record<string, AtlasLegacyFactMetadata>>;
}): Record<string, ResolverOutput> {
  const resolutions: Record<string, ResolverOutput> = {};
  if (input.candidateSetStatus === "canonical_only_legacy") {
    for (const row of input.vintageRows) {
      if (resolutions[row.factKey]) {
        throw new Error(`Canonical-only legacy Atlas release contains duplicate ${row.factKey} rows`);
      }
      resolutions[row.factKey] = legacyFrozenResolution(
        row,
        input.legacyMetadataBySnapshotId?.[row.id],
      );
    }
    return resolutions;
  }

  const candidatesByFactKey = new Map<string, FrozenCandidateResolutionRow[]>();
  const candidateIds = new Set<string>();
  const candidateIdentities = new Set<string>();
  for (const row of input.candidateRows) {
    if (row.jurisdictionId !== input.jurisdictionId) {
      throw new Error(`Complete candidate vintage contains a candidate for the wrong jurisdiction: ${row.id}`);
    }
    const candidateIdentity = `${row.factKey}\0${row.sourceId}`;
    if (candidateIds.has(row.id) || candidateIdentities.has(candidateIdentity)) {
      throw new Error(`Complete candidate vintage contains duplicate candidate ${row.id}`);
    }
    candidateIds.add(row.id);
    candidateIdentities.add(candidateIdentity);
    const payload = row.candidatePayload as unknown;
    if (!isRecord(payload)) {
      throw new Error(`Complete candidate vintage candidate ${row.id} lacks a retained payload`);
    }
    const candidate = payload as unknown as FactRow;
    if (
      row.vintageLabel !== input.vintageRows[0]?.vintageLabel ||
      !sameInstant(row.cutAtTimestamp, input.vintageRows[0]?.cutAtTimestamp ?? row.cutAtTimestamp) ||
      row.sourceRowId !== candidate.id ||
      row.jurisdictionId !== candidate.jurisdictionId ||
      row.factKey !== candidate.factKey ||
      row.sourceId !== candidate.sourceId ||
      row.candidateStatus !== candidate.status ||
      candidateContentHash(candidate) !== row.candidateContentHash ||
      (row.inputEvidenceKind !== "source_payload_hash" &&
        row.inputEvidenceKind !== "normalized_observation_hash") ||
      !SHA256.test(row.inputEvidenceHash) ||
      !SHA256.test(row.adapterVersionHash) ||
      !SHA256.test(row.candidateContentHash) ||
      !Number.isFinite(Date.parse(candidate.retrievedAt)) ||
      Date.parse(candidate.retrievedAt) > row.cutAtTimestamp.getTime()
    ) {
      throw new Error(`Complete candidate vintage candidate identity or evidence disagrees: ${row.id}`);
    }
    const rows = candidatesByFactKey.get(row.factKey) ?? [];
    rows.push(row);
    candidatesByFactKey.set(row.factKey, rows);
  }

  const vintageFactKeys = new Set<string>();
  for (const vintage of input.vintageRows) {
    if (vintage.jurisdictionId !== input.jurisdictionId) {
      throw new Error(`Complete candidate vintage contains a winner for the wrong jurisdiction: ${vintage.id}`);
    }
    if (vintageFactKeys.has(vintage.factKey)) {
      throw new Error(`Complete candidate vintage contains duplicate winner rows for ${vintage.factKey}`);
    }
    vintageFactKeys.add(vintage.factKey);
    if (!vintage.canonicalCandidateId) {
      throw new Error(`Complete candidate vintage is missing a winner pointer for ${vintage.factKey}`);
    }
    const candidates = candidatesByFactKey.get(vintage.factKey) ?? [];
    const winner = candidates.find((candidate) => candidate.id === vintage.canonicalCandidateId);
    const flaggedWinners = candidates.filter((candidate) => candidate.isCanonicalAtCut);
    if (!winner || !winner.isCanonicalAtCut || flaggedWinners.length !== 1) {
      throw new Error(`Complete candidate vintage is missing its retained winner for ${vintage.factKey}`);
    }
    const canonical = winner.candidatePayload;
    const expectedObservationYear =
      canonical.dataVintageYear ??
      canonical.factYear ??
      (canonical.asOf ? Number(canonical.asOf.slice(0, 4)) : null);
    if (
      winner.sourceRowId !== canonical.id ||
      winner.sourceId !== canonical.sourceId ||
      winner.candidateStatus !== canonical.status ||
      canonical.status !== "active" ||
      vintage.canonicalFactId !== canonical.id ||
      canonical.jurisdictionId !== vintage.jurisdictionId ||
      canonical.factKey !== vintage.factKey ||
      canonical.sourceId !== vintage.sourceId ||
      canonical.factValue !== vintage.valueText ||
      canonical.factValueNumeric !== (vintage.valueNumeric == null ? null : Number(vintage.valueNumeric)) ||
      canonical.factUnit !== vintage.valueUnit ||
      stableStringify(canonical.valueJson) !== stableStringify(vintage.valueJson) ||
      canonical.asOf !== vintage.asOf ||
      canonical.upstreamVintageLabel !== vintage.upstreamDatasetRelease ||
      expectedObservationYear !== vintage.observationReferenceYear ||
      !vintage.sourceRetrievedAt ||
      Date.parse(canonical.retrievedAt) !== vintage.sourceRetrievedAt.getTime()
    ) {
      throw new Error(`Complete candidate vintage winner identity disagrees for ${vintage.factKey}`);
    }
    const all = candidates
      .map((candidate) => candidate.candidatePayload)
      .sort((a, b) => {
        if (a.id === canonical.id) return -1;
        if (b.id === canonical.id) return 1;
        return `${a.sourceId}\0${a.id}`.localeCompare(`${b.sourceId}\0${b.id}`);
      });
    const alternates = [
      canonical,
      ...all.filter((candidate) => candidate.id !== canonical.id && candidate.status === "active"),
    ];
    resolutions[vintage.factKey] = {
      jurisdictionId: vintage.jurisdictionId,
      factKey: vintage.factKey,
      canonical,
      alternates,
      all,
      isDisputed: vintage.isDisputedAtCut ?? false,
      decisionReason: retainedDecisionReason(winner.decisionReason),
      decisionTrace: retainedDecisionTrace(winner.decisionTrace),
      proposedDisputes: [],
      canonicalIsProjection: canonical.valueType === "projected",
    };
  }
  return resolutions;
}

export async function getFrozenFactsForJurisdiction(
  jurisdictionId: string,
  factKeys: string[],
  vintageLabel: string,
): Promise<{
  exists: boolean;
  resolutions: Record<string, ResolverOutput>;
  cutoffAt: string | null;
  retrievedThrough: string | null;
  methodologyVersions: string[];
  candidateSetStatus: "complete_candidates" | "canonical_only_legacy";
  candidateSetChecksum: string | null;
  winnerSetChecksum: string | null;
  resolverVersionHash: string | null;
}> {
  const labelRows = await db.select().from(countryFactVintageReleases).where(and(
    eq(countryFactVintageReleases.vintageLabel, vintageLabel),
    inArray(countryFactVintageReleases.completenessStatus, ["complete_candidates", "canonical_only_legacy"]),
  )).limit(1);
  const release = labelRows[0];
  if (!release) {
    return {
      exists: false,
      resolutions: {},
      cutoffAt: null,
      retrievedThrough: null,
      methodologyVersions: [],
      candidateSetStatus: "canonical_only_legacy",
      candidateSetChecksum: null,
      winnerSetChecksum: null,
      resolverVersionHash: null,
    };
  }
  assertPublishedFrozenRelease(release);
  const rows = await db.select().from(countryFactVintages).where(and(
    eq(countryFactVintages.jurisdictionId, jurisdictionId),
    eq(countryFactVintages.vintageLabel, vintageLabel),
    ...(factKeys.length ? [inArray(countryFactVintages.factKey, factKeys)] : []),
  ));
  validateFrozenReleaseRows({ release, jurisdictionId, rows });
  const candidateSetStatus = release.completenessStatus === "complete_candidates"
    ? "complete_candidates"
    : "canonical_only_legacy";
  const candidateRows = candidateSetStatus === "complete_candidates" && rows.length
    ? await db.select().from(countryFactVintageCandidates).where(and(
        eq(countryFactVintageCandidates.jurisdictionId, jurisdictionId),
        eq(countryFactVintageCandidates.vintageLabel, vintageLabel),
        ...(factKeys.length ? [inArray(countryFactVintageCandidates.factKey, factKeys)] : []),
      ))
    : [];
  let legacyMetadataBySnapshotId: Readonly<Record<string, AtlasLegacyFactMetadata>> | undefined;
  if (candidateSetStatus === "canonical_only_legacy") {
    if (vintageLabel !== ATLAS_EXPORT_VINTAGE_LABEL) {
      throw new Error(`Canonical-only legacy vintage ${vintageLabel} has no checked frozen metadata sidecar`);
    }
    legacyMetadataBySnapshotId = loadAtlasReleaseRegenerationInputs().factMetadataBySnapshotId;
  }
  const resolutions = frozenResolutionsFromRows({
    jurisdictionId,
    candidateSetStatus,
    vintageRows: rows,
    candidateRows,
    legacyMetadataBySnapshotId,
  });
  const retrieved = rows.map((row) => row.sourceRetrievedAt?.toISOString()).filter((value): value is string => Boolean(value)).sort();
  return {
    exists: true,
    resolutions,
    cutoffAt: release.cutAtTimestamp.toISOString(),
    retrievedThrough: retrieved.at(-1) ?? null,
    methodologyVersions: [release.methodologyVersion],
    candidateSetStatus,
    candidateSetChecksum: release.candidateSetChecksum,
    winnerSetChecksum: release.winnerSetChecksum,
    resolverVersionHash: release.resolverVersionHash,
  };
}
