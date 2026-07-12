import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  REVIEWER_LONGLIST,
  reviewerLonglistErrors,
  reviewerLonglistHash,
} from "../src/lib/research/reviewer-longlist";

const OUTPUT = resolve("data/research/reviewer-longlist-v1.json");
const REPORT = resolve("plan/research/reviewer-longlist-v1.md");
const WRITE = process.argv.includes("--write");

export function buildReviewerLonglistArtifact() {
  const body = { ...REVIEWER_LONGLIST };
  return { ...body, semanticSha256: reviewerLonglistHash(body) };
}

export function renderReviewerLonglistReport(
  artifact = buildReviewerLonglistArtifact(),
): string {
  const lanes = [
    ["governance_measurement", "Governance measurement"],
    ["political_event_data", "Political event data"],
    ["research_data_curation", "Research-data curation and open science"],
  ] as const;
  const sections = lanes.map(([laneId, label]) => {
    const candidates = artifact.candidates
      .filter((candidate) => candidate.lane === laneId)
      .map(
        (candidate) => `### ${candidate.name}

- **Current role:** ${candidate.currentAffiliation}
- **Institutional perspective:** ${candidate.institutionalBase} (${candidate.geographicGroup})
- **Current evidence:** [${candidate.currentActivity.title}](${candidate.currentActivity.url}) (${candidate.currentActivity.year})
- **Method contribution:** ${candidate.methodContribution}
- **Exact fit:** ${candidate.exactFit}
- **Conflicts/dependencies:** ${candidate.conflictsAndDependencies} (${candidate.conflictTier})
- **Method perspective:** ${candidate.methodPerspective}
- **Public professional channel:** [institutional/professional page](${candidate.publicProfessionalContactUrl})
- **Affiliation source:** [public source](${candidate.affiliationSourceUrl})`,
      )
      .join("\n\n");
    return `## ${label}\n\n${candidates}`;
  });
  return `# Civica external-review longlist — verified core lanes

**Contract:** ${artifact.schemaVersion}

**Criteria:** ${artifact.criteriaVersion}

**Verified:** ${artifact.verifiedAt}

**Semantic SHA-256:** ${artifact.semanticSha256}

No candidate has been contacted. These links are public professional evidence, not permission to contact anyone before GOV-016 and owner approval. Availability, willingness, and complete conflicts remain unknown until that gate opens.

This v1 list records eight candidates in each core scholarly lane. It does not rank them. GOV-010 owns scoring and alternates; GOV-011 owns narrow asks; GOV-012 owns honoraria. Direct email addresses, phone numbers, home addresses, personal accounts, inferred traits, and availability guesses are excluded.

${sections.join("\n\n")}
`;
}

function main() {
  assert.deepEqual(reviewerLonglistErrors(), []);
  const artifact = buildReviewerLonglistArtifact();
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
    writeFileSync(REPORT, renderReviewerLonglistReport(artifact));
  } else {
    assert.ok(existsSync(OUTPUT), "checked reviewer longlist is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
    assert.ok(existsSync(REPORT), "checked human-readable reviewer longlist is missing");
    assert.equal(readFileSync(REPORT, "utf8"), renderReviewerLonglistReport(artifact));
  }
  console.log(
    `PASS — ${artifact.candidates.length} verified public-evidence candidates; contacted=0; ${artifact.semanticSha256}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
