import { createHash } from "node:crypto";

import {
  leaderDirectoryCountSummary,
  type LeaderDirectoryRow,
} from "./directory";

export const LEADER_DIRECTORY_RELEASE_SCHEMA =
  "civica-leader-directory-release/v1" as const;
export const LEADER_DIRECTORY_QUERY_CONTRACT =
  "current principal offices joined to current terms, people, jurisdictions, and retained Wikidata term statements" as const;

export interface LeaderDirectoryReleaseIdentity {
  termId: string;
  personId: string;
  jurisdictionId: string;
  officeType: LeaderDirectoryRow["officeType"];
  sourceRetrievedAt: string;
}

export interface LeaderDirectoryRelease {
  schemaVersion: typeof LEADER_DIRECTORY_RELEASE_SCHEMA;
  releaseId: string;
  generatedAt: string;
  publicationStatus: "blocked_source_refresh" | "ready";
  queryContract: typeof LEADER_DIRECTORY_QUERY_CONTRACT;
  scope: string;
  provenance: {
    sourceId: "wikidata";
    license: string;
    upstreamVintage: null;
    retrievedFrom: string | null;
    retrievedThrough: string | null;
    sourceLastSyncAt: string | null;
  };
  counts: ReturnType<typeof leaderDirectoryCountSummary>;
  rowIdentities: LeaderDirectoryReleaseIdentity[];
  rowIdentitySha256: string;
}

export function leaderDirectoryIdentityHash(
  rows: LeaderDirectoryReleaseIdentity[],
): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function minOrNull(values: string[]): string | null {
  return values.length ? values.sort()[0] : null;
}

function maxOrNull(values: string[]): string | null {
  return values.length ? values.sort().at(-1)! : null;
}

export function buildLeaderDirectoryRelease(
  rows: LeaderDirectoryRow[],
  generatedAt: string,
  publicationStatus: LeaderDirectoryRelease["publicationStatus"] =
    "blocked_source_refresh",
): LeaderDirectoryRelease {
  const rowIdentities = rows
    .map((row) => ({
      termId: row.termId,
      personId: row.personId,
      jurisdictionId: row.jurisdictionId,
      officeType: row.officeType,
      sourceRetrievedAt: row.sourceRetrievedAt,
    }))
    .sort((a, b) =>
      [
        a.jurisdictionId,
        a.officeType,
        a.personId,
        a.termId,
        a.sourceRetrievedAt,
      ]
        .join("\u0000")
        .localeCompare(
          [
            b.jurisdictionId,
            b.officeType,
            b.personId,
            b.termId,
            b.sourceRetrievedAt,
          ].join("\u0000"),
        ),
    );
  const retrieved = rows.map((row) => row.sourceRetrievedAt).filter(Boolean);
  const synced = rows
    .map((row) => row.sourceLastSyncAt)
    .filter((value): value is string => Boolean(value));
  const licenses = [...new Set(rows.map((row) => row.sourceLicense))].sort();
  const releaseDate = generatedAt.slice(0, 10);

  return {
    schemaVersion: LEADER_DIRECTORY_RELEASE_SCHEMA,
    releaseId: `leaders-${releaseDate}`,
    generatedAt,
    publicationStatus,
    queryContract: LEADER_DIRECTORY_QUERY_CONTRACT,
    scope:
      "Verified current heads of state and heads of government. Missing records, dates, portraits, or capacity labels remain explicit noncoverage and are never converted to absence claims.",
    provenance: {
      sourceId: "wikidata",
      license: licenses.join(", "),
      upstreamVintage: null,
      retrievedFrom: minOrNull(retrieved),
      retrievedThrough: maxOrNull(retrieved),
      sourceLastSyncAt: maxOrNull(synced),
    },
    counts: leaderDirectoryCountSummary(rows),
    rowIdentities,
    rowIdentitySha256: leaderDirectoryIdentityHash(rowIdentities),
  };
}
