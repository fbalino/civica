import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/data/frozen-vintage";

export interface ElectionIntegrityResult {
  id: string;
  partyName: string | null;
  partyColor: string | null;
  partyWikidataQid: string | null;
  candidateName: string | null;
  votesCount: number | null;
  votesPercent: number | null;
  seatsWon: number | null;
  isWinner: boolean | null;
}

export interface ElectionIntegrityStatement {
  id: string;
  predicate: string;
  sourceId: string;
  sourceLicense: string | null;
  sourceUrl: string | null;
  retrievedAt: string;
  objectValue: string | null;
  sourceHash: string | null;
}

export interface ElectionIntegrityContent {
  id: string;
  jurisdictionId: string;
  jurisdictionStatus: string;
  electionDate: string | null;
  electionType: string | null;
  electionName: string | null;
  electoralSystem: string | null;
  bodyId: string | null;
  turnoutPercent: number | null;
  registeredVoters: number | null;
  totalValidVotes: number | null;
  wikidataQid: string | null;
  dateConfidence: string | null;
  jurisdictionIdentity: {
    basis: string;
    sourceId: string | null;
    sourceRecordId: string | null;
    expectedJurisdictionId: string | null;
    observedJurisdictionIds: string[];
    observedScopeJurisdictionIds: string[];
    statusReason: string;
    status: string;
  } | null;
  results: ElectionIntegrityResult[];
  statements: ElectionIntegrityStatement[];
}

export interface ElectionIntegritySource {
  id: string;
  license: string;
  lastSyncAt: string | null;
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function sorted<T>(values: T[]) {
  return [...values].sort((a, b) =>
    stableStringify(a).localeCompare(stableStringify(b)),
  );
}

export function electionIntegrityFingerprint(
  content: ElectionIntegrityContent,
) {
  return sha256({
    ...content,
    results: sorted(content.results),
    statements: sorted(content.statements),
  });
}

export function electionCorpusIntegrityFingerprint(input: {
  rowFingerprints: Record<string, string>;
  sources: ElectionIntegritySource[];
}) {
  return sha256({
    rows: Object.entries(input.rowFingerprints).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
    sources: sorted(input.sources),
  });
}
