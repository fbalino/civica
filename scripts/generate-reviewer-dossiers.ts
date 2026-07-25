import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  REVIEWER_DOSSIER_V1_SIGNATORY,
  buildReviewerDossiers,
  reviewerDossierErrors,
  reviewerDossierHash,
} from "../src/lib/research/reviewer-dossiers";

const OUTPUT = resolve("data/research/reviewer-dossiers-v1.json");
const DIR = resolve("plan/research/reviewer-dossiers-v1");
const WRITE = process.argv.includes("--write");

export function buildReviewerDossierArtifact() {
  const body = buildReviewerDossiers(REVIEWER_DOSSIER_V1_SIGNATORY);
  return { ...body, semanticSha256: reviewerDossierHash(body) };
}

export function renderDossier(dossier: ReturnType<typeof buildReviewerDossiers>["dossiers"][number], hash: string): string {
  return `# ${dossier.name} — independent review dossier

**Status:** ${dossier.shortlistStatus}; draft only; no contact

**Lane:** ${dossier.lane}

**Bundle:** ${hash}

## Why this person

${dossier.whyThisPerson}

## Bounded assignment

**Packet:** ${dossier.packet}

**Exact question:** ${dossier.exactQuestion}

**Expected time:** ${dossier.expectedTime}

**Deliverable:** ${dossier.deliverable}

**Artifacts:**

${dossier.artifacts.map((path) => `- \`${path}\``).join("\n")}

## Independence, publication, and payment

${dossier.conflictTerms}

${dossier.publicationTerms}

${dossier.honorariumTerms}

## Unsent contact draft

**Subject:** ${dossier.contactDraft.subject}

${dossier.contactDraft.body}
`;
}

function main() {
  const artifact = buildReviewerDossierArtifact();
  assert.deepEqual(reviewerDossierErrors(artifact), []);
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
    rmSync(DIR, { recursive: true, force: true });
    mkdirSync(DIR, { recursive: true });
    for (const dossier of artifact.dossiers) writeFileSync(resolve(DIR, `${dossier.candidateId}.md`), renderDossier(dossier, artifact.semanticSha256));
  } else {
    assert.ok(existsSync(OUTPUT) && existsSync(DIR), "checked dossier bundle is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
    for (const dossier of artifact.dossiers) assert.equal(readFileSync(resolve(DIR, `${dossier.candidateId}.md`), "utf8"), renderDossier(dossier, artifact.semanticSha256));
  }
  console.log(`PASS — ${artifact.dossiers.length} bounded dossiers; contacted=0; ${artifact.semanticSha256}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
