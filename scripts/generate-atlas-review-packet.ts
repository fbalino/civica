import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ATLAS_REVIEW_ARTIFACTS, ATLAS_REVIEW_PACKET_VERSION, ATLAS_REVIEW_QUESTIONS, atlasReviewPacketErrors } from "../src/lib/research/atlas-review-packet";

const DIR = resolve("data/releases/civica-atlas-review-packet-2026-07-v1");
const MANIFEST = resolve(DIR, "manifest.v1.json");
const QUESTIONS = resolve(DIR, "review-questionnaire.md");
const README = resolve(DIR, "README.md");
const WRITE = process.argv.includes("--write");
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export function buildAtlasReviewPacket() {
  const artifacts = ATLAS_REVIEW_ARTIFACTS.map((artifact) => {
    const bytes = readFileSync(resolve(artifact.path));
    return { ...artifact, bytes: bytes.length, sha256: sha(bytes) };
  });
  const body = {
    schemaVersion: ATLAS_REVIEW_PACKET_VERSION,
    releaseId: "atlas-2026-07-11-g2-rc1",
    status: "ready_for_independent_review_not_endorsed",
    reviewerTerms: "Independent criticism is requested. A favorable conclusion is not required. Review does not imply endorsement, authorship, advisory-board service, or validation of unrelated Civica products.",
    artifacts,
    questions: [...ATLAS_REVIEW_QUESTIONS],
  };
  return { ...body, semanticSha256: sha(JSON.stringify(body)) };
}

export function renderAtlasQuestions(packet = buildAtlasReviewPacket()) {
  return `# Civica Atlas data-curation review questionnaire

**Packet:** ${packet.schemaVersion}

Please disclose relevant conflicts before review. Cite the artifact used for each answer and assign one finding level: blocking, major, minor, or no concern. A favorable conclusion is not required.

${packet.questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Requested output: one bounded written review answering these questions, with evidence references, finding levels, and any unresolved limitation.
`;
}

export function renderAtlasReadme(packet = buildAtlasReviewPacket()) {
  return `# Civica Atlas external data-curation review packet

This versioned wrapper binds the frozen G2 Atlas release candidate to its codebook, complete schema dictionary, rights and source-input manifests, checksums, clean-room evidence, coverage and quality reports, limitations, citation metadata, correction policy, and bounded review questions.

Status: ready for independent review, not endorsed. No review has yet occurred.

Run from the repository root:

\`\`\`sh
npm run validate:atlas-review-packet
npm run validate:g2-atlas
npm run validate:clean-room
\`\`\`

The manifest contains exact repository-relative paths, byte counts, and SHA-256 hashes. The frozen archive remains at \`data/releases/atlas-2026-07-11-g2-rc1.zip\`; restricted publisher payloads are not added to this wrapper.

Semantic SHA-256: \`${packet.semanticSha256}\`.
`;
}

function main() {
  assert.deepEqual(atlasReviewPacketErrors(), []);
  const packet = buildAtlasReviewPacket();
  if (WRITE) {
    mkdirSync(dirname(MANIFEST), { recursive: true });
    writeFileSync(MANIFEST, `${JSON.stringify(packet, null, 2)}\n`);
    writeFileSync(QUESTIONS, renderAtlasQuestions(packet));
    writeFileSync(README, renderAtlasReadme(packet));
  } else {
    assert.ok(existsSync(MANIFEST) && existsSync(QUESTIONS) && existsSync(README), "checked Atlas review packet is missing");
    assert.deepEqual(JSON.parse(readFileSync(MANIFEST, "utf8")), packet);
    assert.equal(readFileSync(QUESTIONS, "utf8"), renderAtlasQuestions(packet));
    assert.equal(readFileSync(README, "utf8"), renderAtlasReadme(packet));
  }
  console.log(`PASS — ${packet.artifacts.length} linked artifacts, ${packet.questions.length} bounded questions; ${packet.semanticSha256}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
