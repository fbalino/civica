import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  LEADER_DIRECTORY_QUERY_CONTRACT,
  LEADER_DIRECTORY_RELEASE_SCHEMA,
  leaderDirectoryIdentityHash,
  type LeaderDirectoryRelease,
} from "@/lib/leaders/release";

const ARTIFACT = "data/leaders-directory-release.v1.json";
const REFRESH_PLAN =
  "plan/evidence/ATL-010/production-refresh-plan.json";
const artifact = JSON.parse(
  readFileSync(ARTIFACT, "utf8"),
) as LeaderDirectoryRelease;
const errors: string[] = [];
const refreshPlan = JSON.parse(readFileSync(REFRESH_PLAN, "utf8")) as {
  schemaVersion: string;
  taskId: string;
  mode: string;
  releaseReady: boolean;
  discrepancyCount: number;
  ambiguousRoleCount: number;
  semanticSha256: string;
};

if (artifact.schemaVersion !== LEADER_DIRECTORY_RELEASE_SCHEMA) {
  errors.push("release schema version drifted");
}
if (artifact.queryContract !== LEADER_DIRECTORY_QUERY_CONTRACT) {
  errors.push("release query contract drifted");
}
if (!Number.isFinite(Date.parse(artifact.generatedAt))) {
  errors.push("generatedAt is invalid");
}
if (artifact.provenance.sourceId !== "wikidata") {
  errors.push("release source must remain Wikidata");
}
if (
  artifact.publicationStatus !== "blocked_source_refresh" &&
  artifact.publicationStatus !== "ready"
) {
  errors.push("publication status is invalid");
}
const { semanticSha256, ...refreshWithoutHash } = refreshPlan;
const refreshHash = createHash("sha256")
  .update(JSON.stringify(refreshWithoutHash))
  .digest("hex");
if (
  refreshPlan.schemaVersion !==
  "civica-leader-directory-refresh-plan/v1"
) {
  errors.push("refresh-plan schema version drifted");
}
if (refreshPlan.taskId !== "ATL-010" || refreshPlan.mode !== "zero_write") {
  errors.push("refresh plan must remain zero-write ATL-010 evidence");
}
if (semanticSha256 !== refreshHash) {
  errors.push("refresh-plan semantic hash drifted");
}
if (artifact.publicationStatus === "ready" && !refreshPlan.releaseReady) {
  errors.push(
    "publication cannot be ready while the source refresh plan is blocked",
  );
}
if (artifact.provenance.upstreamVintage !== null) {
  errors.push("Wikidata must not be assigned an invented named vintage");
}
if (artifact.counts.rows !== artifact.rowIdentities.length) {
  errors.push("release row count does not match the identity ledger");
}
if (
  new Set(artifact.rowIdentities.map((row) => row.personId)).size !==
  artifact.counts.people
) {
  errors.push("release people count does not match the identity ledger");
}
if (
  new Set(artifact.rowIdentities.map((row) => row.jurisdictionId)).size !==
  artifact.counts.jurisdictions
) {
  errors.push("release jurisdiction count does not match the identity ledger");
}
if (
  artifact.rowIdentitySha256 !==
  leaderDirectoryIdentityHash(artifact.rowIdentities)
) {
  errors.push("release row-identity hash drifted");
}
for (const row of artifact.rowIdentities) {
  if (
    row.officeType !== "head_of_state" &&
    row.officeType !== "head_of_government"
  ) {
    errors.push(`${row.termId} is not a principal office`);
  }
  if (!Number.isFinite(Date.parse(row.sourceRetrievedAt))) {
    errors.push(`${row.termId} lacks a valid source retrieval timestamp`);
  }
}

const sourceContracts: Array<[string, string[]]> = [
  [
    "src/lib/leaders/query.ts",
    [
      "eq(terms.isCurrent, true)",
      "eq(statements.sourceId, \"wikidata\")",
      "PRINCIPAL_LEADER_OFFICE_TYPES",
    ],
  ],
  [
    "src/components/leaders/WorldLeadersDirectoryClient.tsx",
    [
      "SearchField",
      "SortableDataTable",
      "co-leadership",
      "dual office",
      "SourceDot",
      "/api/citations/person/",
    ],
  ],
  [
    "src/app/(reader)/leaders/page.tsx",
    [
      "Missing portraits, dates, or records remain missing",
      "Wikidata does not publish a named dataset",
    ],
  ],
];
for (const [path, fragments] of sourceContracts) {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment)) errors.push(`${path} lacks ${fragment}`);
  }
}
if (artifact.publicationStatus === "blocked_source_refresh") {
  for (const path of [
    "src/components/exploreNavItems.ts",
    "src/components/SiteFooter.tsx",
    "src/app/sitemap.ts",
  ]) {
    if (readFileSync(path, "utf8").includes('"/leaders"')) {
      errors.push(`${path} publishes the source-blocked directory`);
    }
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log(
  artifact.publicationStatus === "ready"
    ? `PASS — ATL-010 directory contract and ${artifact.releaseId}: ${artifact.counts.rows} source-verified records across ${artifact.counts.jurisdictions} jurisdictions.`
    : `PASS — ATL-010 implementation is safely publication-blocked: the retained roster has ${refreshPlan.discrepancyCount} source discrepancies and ${refreshPlan.ambiguousRoleCount} unresolved source role(s).`,
);
