import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildReviewerRanking,
  reviewerRankingErrors,
  reviewerRankingHash,
} from "../src/lib/research/reviewer-ranking";

const OUTPUT = resolve("data/research/reviewer-ranking-v1.json");
const REPORT = resolve("plan/research/reviewer-ranking-v1.md");
const WRITE = process.argv.includes("--write");

export function buildReviewerRankingArtifact() {
  const body = buildReviewerRanking();
  return { ...body, semanticSha256: reviewerRankingHash(body) };
}

export function renderReviewerRanking(artifact = buildReviewerRankingArtifact()): string {
  const sections = artifact.lanes.map((lane) => {
    const rows = lane.ranked
      .map(
        (row) =>
          `| ${row.rank} | ${row.name} | ${row.disposition} | ${row.total.toFixed(2)} | ${row.scores.expertise} | ${row.scores.exactTaskFit} | ${row.scores.independence} | ${row.scores.conflictManageability} | ${row.scores.perspectiveContribution} | unknown | unknown |`,
      )
      .join("\n");
    return `## ${lane.lane}

| Rank | Candidate | Status | Total / 100 | Expertise | Fit | Independence | Conflict | Perspective | Availability | Burden |
|---:|---|---|---:|---:|---:|---:|---:|---:|---|---|
${rows}`;
  });
  return `# Civica reviewer ranking — owner-approval draft

**Contract:** ${artifact.schemaVersion}

**Criteria:** ${artifact.criteriaVersion}

**Longlist:** ${artifact.longlistVersion}

**Semantic SHA-256:** ${artifact.semanticSha256}

No candidate has been contacted. "Proposed primary" is a ranking status, not an invitation. GOV-016 and owner approval still block contact.

Scores use the checked public evidence. Availability and communication burden remain unknown for everyone and receive zero points without being treated as negative findings. The maximum observable pre-contact score is therefore 90/100. GOV-010 does not infer willingness from seniority, a public page, recent publication, or presumed bandwidth.

Each lane retains three proposed primaries, three alternates, and two reserves. Final panel composition must preserve non-affiliated judgment where a source conflict overlaps the question. Owner approval may reject a proposed ordering only with a recorded reason under the same rubric; it cannot manufacture availability or waive an exclusion.

${sections.join("\n\n")}
`;
}

function main() {
  const artifact = buildReviewerRankingArtifact();
  assert.deepEqual(reviewerRankingErrors(artifact), []);
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
    writeFileSync(REPORT, renderReviewerRanking(artifact));
  } else {
    assert.ok(existsSync(OUTPUT) && existsSync(REPORT), "checked ranking artifacts are missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
    assert.equal(readFileSync(REPORT, "utf8"), renderReviewerRanking(artifact));
  }
  console.log(`PASS — three ranked lanes; 9 primaries; 9 alternates; contact=none; ${artifact.semanticSha256}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
