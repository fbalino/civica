import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  countryFacts,
  countryFactVintageCandidates,
  countryFactVintageReleases,
  countryFactVintages,
  dataDisputes,
} from "@/lib/db/schema";
import { parseAtlasVintageLabel } from "@/lib/data/frozen-vintage";
import { buildCandidateReleasePackage } from "./candidate-vintage";
import { computeContentHash, dbRowToFactRow, type FactRowDb } from "./snapshot-vintage";
import { getFactKey } from "./fact-keys";
import { reconciliationVersionEnvelope } from "./versioning";
import type { FactRow } from "./types";

type Db = typeof defaultDb;

export interface CompleteCandidateSnapshotSummary {
  vintageLabel: string;
  cutAt: string;
  candidateCount: number;
  winnerCount: number;
  candidateSetChecksum: string;
  winnerSetChecksum: string;
  unchanged: boolean;
  dryRun: boolean;
}

function chunks<T>(rows: readonly T[], size = 500): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < rows.length; i += size) output.push(rows.slice(i, i + size));
  return output;
}

export function deterministicCandidateId(
  vintageLabel: string,
  contentHash: string,
): string {
  const digest = createHash("sha256")
    .update("civica-candidate-release-row/v1\0")
    .update(vintageLabel)
    .update("\0")
    .update(contentHash)
    .digest("hex");
  const chars = digest.slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Freeze every resolver candidate and winner under one release manifest.
 * All computation is offline after the single database read; publication is
 * one transaction, so a partial candidate set can never become visible.
 */
export async function snapshotCompleteCandidateRelease(input: {
  vintageLabel: string;
  cutDate: Date;
  dryRun?: boolean;
  /** Credential-free integration seam; production reads country_facts. */
  fixture?: {
    rows: ReadonlyArray<{
      candidate: FactRow;
      sourceHash: string | null;
      sourceSnapshotId: string | null;
    }>;
    adapterHashes: ReadonlyMap<string, string>;
    resolverHash: string;
    disputedKeys?: ReadonlySet<string>;
  };
}, dbInstance: Db = defaultDb): Promise<CompleteCandidateSnapshotSummary> {
  const identity = parseAtlasVintageLabel(input.vintageLabel);
  const existing = await dbInstance.select().from(countryFactVintageReleases).where(eq(countryFactVintageReleases.vintageLabel, input.vintageLabel)).limit(1);
  if (existing[0]?.completenessStatus === "complete_candidates") {
    return {
      vintageLabel: existing[0].vintageLabel,
      cutAt: existing[0].cutAtTimestamp.toISOString(),
      candidateCount: existing[0].candidateCount ?? 0,
      winnerCount: existing[0].winnerCount,
      candidateSetChecksum: existing[0].candidateSetChecksum ?? "",
      winnerSetChecksum: existing[0].winnerSetChecksum,
      unchanged: true,
      dryRun: false,
    };
  }
  if (existing[0] && existing[0].completenessStatus !== "staging") {
    throw new Error(
      `Frozen candidate release conflict for ${input.vintageLabel}; publish a new superseding version.`,
    );
  }

  // A staging release owns its original cut. Retries never recompute against
  // a later clock or admit rows retrieved after that durable cutoff.
  const cutDate = existing[0]?.cutAtTimestamp ?? input.cutDate;
  if (!Number.isFinite(cutDate.getTime())) {
    throw new RangeError("Candidate release cutoff is invalid");
  }
  const cutAt = cutDate.toISOString();
  const packageRows = input.fixture
    ? [...input.fixture.rows]
    : ((await dbInstance.select().from(countryFacts)) as unknown as Array<
        FactRowDb & { sourceHash: string | null; snapshotId: string | null }
      >)
        .filter((row) => getFactKey(row.factKey))
        .map((row) => ({
          candidate: dbRowToFactRow(row),
          sourceHash: row.sourceHash,
          sourceSnapshotId: row.snapshotId,
        }));
  const eligibleRows = packageRows.filter(
    ({ candidate }) => Date.parse(candidate.retrievedAt) <= cutDate.getTime(),
  );
  const release = buildCandidateReleasePackage({
    vintageLabel: input.vintageLabel,
    cutAt,
    methodologyVersion: identity.methodologyVersion,
    rows: eligibleRows,
    adapterHashes: input.fixture?.adapterHashes,
    resolverHash: input.fixture?.resolverHash,
  });
  if (input.dryRun) {
    return { ...release.manifest, unchanged: false, dryRun: true };
  }

  if (existing[0]) {
    if (
      existing[0].cutAtTimestamp.toISOString() !== release.manifest.cutAt ||
      existing[0].candidateSetChecksum !==
        release.manifest.candidateSetChecksum ||
      existing[0].winnerSetChecksum !== release.manifest.winnerSetChecksum
    ) {
      throw new Error(`Frozen candidate release conflict for ${input.vintageLabel}; publish a new superseding version.`);
    }
  }

  const disputed = input.fixture?.disputedKeys
    ? new Set(input.fixture.disputedKeys)
    : new Set(
        (
          await dbInstance
            .select({
              jurisdictionId: dataDisputes.jurisdictionId,
              factKey: dataDisputes.factKey,
            })
            .from(dataDisputes)
            .where(inArray(dataDisputes.status, ["open", "in_review"]))
        ).map((row) => `${row.jurisdictionId}\0${row.factKey}`),
      );

  const releaseValue = {
      vintageLabel: input.vintageLabel,
      cutAtTimestamp: cutDate,
      methodologyVersion: identity.methodologyVersion,
      resolverVersionHash: release.manifest.resolverVersionHash,
      completenessStatus: "staging",
      candidateCount: release.manifest.candidateCount,
      winnerCount: release.manifest.winnerCount,
      candidateSetChecksum: release.manifest.candidateSetChecksum,
      winnerSetChecksum: release.manifest.winnerSetChecksum,
      inputManifest: release.inputManifest,
  };

  const candidateIds = new Map<string, string>();
  const candidateValues = release.candidates.map((frozen) => {
      const key = `${frozen.candidate.jurisdictionId}\0${frozen.candidate.factKey}`;
      const resolution = release.resolutions[key];
      const isCanonicalAtCut = resolution?.canonical?.id === frozen.sourceRowId;
      const id = deterministicCandidateId(
        input.vintageLabel,
        frozen.candidateContentHash,
      );
      candidateIds.set(frozen.sourceRowId, id);
      return {
        id,
        vintageLabel: input.vintageLabel,
        cutAtTimestamp: cutDate,
        jurisdictionId: frozen.candidate.jurisdictionId,
        factKey: frozen.candidate.factKey,
        sourceId: frozen.candidate.sourceId,
        sourceRowId: frozen.sourceRowId,
        sourceHash: frozen.sourceHash,
        sourceSnapshotId: frozen.sourceSnapshotId,
        inputEvidenceKind: frozen.inputEvidenceKind,
        inputEvidenceHash: frozen.inputEvidenceHash,
        adapterVersionHash: frozen.adapterVersionHash,
        candidateContentHash: frozen.candidateContentHash,
        candidateStatus: frozen.candidate.status,
        candidatePayload: frozen.candidate,
        isCanonicalAtCut,
        decisionReason: isCanonicalAtCut ? resolution.decisionReason : null,
        decisionTrace: isCanonicalAtCut ? resolution.decisionTrace : null,
      };
  });

  const winners = Object.values(release.resolutions).flatMap((resolution) => resolution.canonical ? [resolution] : []);
  const vintageValues = winners.map((resolution) => {
      const canonical = resolution.canonical!;
      const canonicalCandidateId = candidateIds.get(canonical.id);
      if (!canonicalCandidateId) throw new Error(`Missing immutable candidate pointer for winner ${canonical.id}`);
      const versions = reconciliationVersionEnvelope({ methodologyVersion: identity.methodologyVersion, sourceIds: resolution.all.map((row) => row.sourceId) });
      return {
        jurisdictionId: canonical.jurisdictionId,
        factKey: canonical.factKey,
        vintageLabel: input.vintageLabel,
        supersedesVintageLabel: null,
        observationReferenceYear: canonical.dataVintageYear ?? canonical.factYear ?? (canonical.asOf ? Number(canonical.asOf.slice(0, 4)) : null),
        upstreamDatasetRelease: canonical.upstreamVintageLabel,
        sourceRetrievedAt: new Date(canonical.retrievedAt),
        civicaPublicationVersion: input.vintageLabel,
        canonicalFactId: canonical.id,
        canonicalCandidateId,
        valueText: canonical.factValue,
        valueNumeric: canonical.factValueNumeric,
        valueUnit: canonical.factUnit,
        valueJson: canonical.valueJson as object | null,
        asOf: canonical.asOf,
        sourceId: canonical.sourceId,
        methodologyVersion: identity.methodologyVersion,
        derivationVersionKey: versions.key,
        derivationVersions: versions.envelope,
        cutAtTimestamp: cutDate,
        contentHash: computeContentHash({ sourceId: canonical.sourceId, valueText: canonical.factValue, valueNumeric: canonical.factValueNumeric, asOf: canonical.asOf, methodologyVersion: identity.methodologyVersion }),
        isDisputedAtCut: disputed.has(`${canonical.jurisdictionId}\0${canonical.factKey}`),
      };
  });

  const publicationQueries = [
    ...(!existing[0]
      ? [dbInstance.insert(countryFactVintageReleases).values(releaseValue)]
      : []),
    ...chunks(candidateValues, 250).map((batch) =>
      dbInstance
        .insert(countryFactVintageCandidates)
        .values(batch)
        .onConflictDoNothing(),
    ),
    ...chunks(vintageValues, 250).map((batch) =>
      dbInstance
        .insert(countryFactVintages)
        .values(batch)
        .onConflictDoNothing(),
    ),
    dbInstance
      .update(countryFactVintageReleases)
      .set({ completenessStatus: "complete_candidates" })
      .where(
        and(
          eq(
            countryFactVintageReleases.vintageLabel,
            input.vintageLabel,
          ),
          eq(countryFactVintageReleases.completenessStatus, "staging"),
        ),
      ),
    dbInstance.select({
      finalizedGuard: sql<number>`1 / CASE WHEN EXISTS (
        SELECT 1
        FROM country_fact_vintage_releases
        WHERE vintage_label = ${input.vintageLabel}
          AND completeness_status = 'complete_candidates'
      ) THEN 1 ELSE 0 END`,
    })
      .from(countryFactVintageReleases)
      .where(
        eq(
          countryFactVintageReleases.vintageLabel,
          input.vintageLabel,
        ),
      )
      .limit(1),
  ] as unknown as Parameters<typeof dbInstance.batch>[0];
  await dbInstance.batch(publicationQueries);

  return { ...release.manifest, unchanged: false, dryRun: false };
}
