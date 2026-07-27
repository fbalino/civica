import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  electionResults,
  elections,
  jurisdictions,
  sources,
  statements,
} from "@/lib/db/schema";
import {
  electionCorpusIntegrityFingerprint,
  electionIntegrityFingerprint,
  type ElectionIntegrityContent,
  type ElectionIntegrityResult,
  type ElectionIntegrityStatement,
} from "./corpus-audit-integrity";
import { ELECTION_CORPUS_AUDIT } from "./corpus-audit-runtime";
import jurisdictionIdentityArtifact from "./jurisdiction-identity.generated.json";

const isoDate = (value: string | Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;
const isoInstant = (value: string | Date | null) =>
  value ? new Date(value).toISOString() : null;

export async function loadLiveElectionContentFingerprints(ids: string[]) {
  const uniqueIds = [...new Set(ids)].sort();
  if (uniqueIds.length === 0) return new Map<string, string>();

  const [electionRows, resultRows, statementRows] = await Promise.all([
    db
      .select({
        id: elections.id,
        jurisdictionId: elections.jurisdictionId,
        jurisdictionStatus: jurisdictions.type,
        electionDate: elections.electionDate,
        electionType: elections.electionType,
        electionName: elections.electionName,
        electoralSystem: elections.electoralSystem,
        bodyId: elections.bodyId,
        turnoutPercent: elections.turnoutPercent,
        registeredVoters: elections.registeredVoters,
        totalValidVotes: elections.totalValidVotes,
        wikidataQid: elections.wikidataQid,
        dateConfidence: elections.dateConfidence,
      })
      .from(elections)
      .innerJoin(jurisdictions, eq(elections.jurisdictionId, jurisdictions.id))
      .where(inArray(elections.id, uniqueIds)),
    db
      .select()
      .from(electionResults)
      .where(inArray(electionResults.electionId, uniqueIds)),
    db
      .select()
      .from(statements)
      .where(
        and(
          eq(statements.subjectTable, "elections"),
          inArray(statements.subjectId, uniqueIds),
        ),
      ),
  ]);
  const jurisdictionIdentityByElection = new Map(
    jurisdictionIdentityArtifact.rows.map((row) => [row.rowId, row]),
  );

  const resultsByElection = new Map<string, ElectionIntegrityResult[]>();
  for (const row of resultRows) {
    const result: ElectionIntegrityResult = {
      id: row.id,
      partyName: row.partyName,
      partyColor: row.partyColor,
      partyWikidataQid: row.partyWikidataQid,
      candidateName: row.candidateName,
      votesCount: row.votesCount,
      votesPercent: row.votesPercent,
      seatsWon: row.seatsWon,
      isWinner: row.isWinner,
    };
    const values = resultsByElection.get(row.electionId) ?? [];
    values.push(result);
    resultsByElection.set(row.electionId, values);
  }

  const statementsByElection = new Map<string, ElectionIntegrityStatement[]>();
  for (const row of statementRows) {
    const statement: ElectionIntegrityStatement = {
      id: row.id,
      predicate: row.predicate,
      sourceId: row.sourceId,
      sourceLicense: row.sourceLicense,
      sourceUrl: row.sourceUrl,
      retrievedAt: isoInstant(row.retrievedAt)!,
      objectValue: row.objectValue,
      sourceHash: row.sourceHash,
    };
    const values = statementsByElection.get(row.subjectId) ?? [];
    values.push(statement);
    statementsByElection.set(row.subjectId, values);
  }

  return new Map(
    electionRows.map((row) => {
      const content: ElectionIntegrityContent = {
        ...row,
        electionDate: isoDate(row.electionDate),
        turnoutPercent:
          row.turnoutPercent == null ? null : Number(row.turnoutPercent),
        jurisdictionIdentity:
          jurisdictionIdentityByElection.get(row.id) ?? null,
        results: resultsByElection.get(row.id) ?? [],
        statements: statementsByElection.get(row.id) ?? [],
      };
      return [row.id, electionIntegrityFingerprint(content)];
    }),
  );
}

export async function loadLiveElectionCorpusFingerprint() {
  const liveElectionIds = await db.select({ id: elections.id }).from(elections);
  const rowFingerprints = Object.fromEntries(
    await loadLiveElectionContentFingerprints(
      liveElectionIds.map((row) => row.id),
    ),
  );
  const liveStatementSources = await db
    .select({ sourceId: statements.sourceId })
    .from(statements)
    .where(eq(statements.subjectTable, "elections"));
  const referencedSourceIds = [
    ...new Set(liveStatementSources.map((row) => row.sourceId)),
  ].sort();
  const sourceRows = referencedSourceIds.length
    ? await db
        .select({
          id: sources.id,
          license: sources.license,
          lastSyncAt: sources.lastSyncAt,
        })
        .from(sources)
        .where(inArray(sources.id, referencedSourceIds))
    : [];
  return electionCorpusIntegrityFingerprint({
    rowFingerprints,
    sources: sourceRows.map((row) => ({
      id: row.id,
      license: row.license,
      lastSyncAt: isoInstant(row.lastSyncAt),
    })),
  });
}

export async function assertLiveElectionCorpusFingerprint() {
  const live = await loadLiveElectionCorpusFingerprint();
  if (live !== ELECTION_CORPUS_AUDIT.baseline.fingerprintSha256) {
    throw new Error(
      `Live election corpus fingerprint ${live} differs from checked audit ${ELECTION_CORPUS_AUDIT.baseline.fingerprintSha256}`,
    );
  }
  return live;
}
