import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROJECT_DISCLOSURE,
  PROJECT_DISCLOSURE_ARTIFACT_PATH,
  PROJECT_DISCLOSURE_PUBLIC_SECTIONS,
  projectDisclosureErrors,
} from "../src/lib/research/project-disclosure";
import { buildAtlasReviewPacket } from "./generate-atlas-review-packet";
import { buildProjectDisclosureArtifact } from "./generate-project-disclosure";
import { buildGovernanceEvidenceReviewBundle } from "../src/lib/ci/governance-evidence-review-package";

assert.deepEqual(projectDisclosureErrors(), []);
assert.deepEqual(
  JSON.parse(readFileSync(PROJECT_DISCLOSURE_ARTIFACT_PATH, "utf8")),
  buildProjectDisclosureArtifact(),
);

const aboutSource = readFileSync("src/app/about/page.tsx", "utf8");
for (const required of [
  "PROJECT_DISCLOSURE",
  "PROJECT_DISCLOSURE_PUBLIC_SECTIONS",
  'id="project-disclosure"',
])
  assert.ok(aboutSource.includes(required), `About binding missing: ${required}`);
for (const section of PROJECT_DISCLOSURE_PUBLIC_SECTIONS)
  assert.ok(section.text.length > 40, `${section.id}: public text is incomplete`);

const atlas = buildAtlasReviewPacket();
assert.ok(
  atlas.artifacts.some(
    ({ id, path }) =>
      id === "project_disclosure" && path === PROJECT_DISCLOSURE_ARTIFACT_PATH,
  ),
  "Atlas reviewer packet does not bind the canonical disclosure",
);

const index = buildGovernanceEvidenceReviewBundle();
assert.ok(
  index.manifest.inventory.some(
    ({ artifactId, path }) =>
      artifactId === "project-disclosure" &&
      path === PROJECT_DISCLOSURE_ARTIFACT_PATH,
  ),
  "Index reviewer packet does not bind the canonical disclosure",
);

assert.equal(
  PROJECT_DISCLOSURE.publicationAuthorization.reviewerPackets.find(
    ({ product }) => product === "Pulse",
  )?.status,
  "required_when_packet_is_assembled",
  "future Pulse reviewer packet is not fail-closed on disclosure reuse",
);

console.log(
  "PASS — About, Atlas, Index, and the future Pulse packet contract reuse the owner-approved project disclosure unchanged.",
);
