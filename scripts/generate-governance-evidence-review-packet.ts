import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import {
  buildGovernanceEvidenceReviewBundle,
  GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR,
} from "../src/lib/ci/governance-evidence-review-package";
import {
  GOVERNANCE_EVIDENCE_REVIEW_PACKET,
  governanceEvidenceReviewPacketErrors,
} from "../src/lib/ci/governance-evidence-review-packet";

const errors = governanceEvidenceReviewPacketErrors();
if (errors.length > 0) throw new Error(errors.join("\n"));

execFileSync("npm", ["run", "validate:governance-evidence"], {
  cwd: process.cwd(),
  stdio: "inherit",
});

const bundle = buildGovernanceEvidenceReviewBundle();
mkdirSync(GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR, { recursive: true });
for (const document of bundle.docs) writeFileSync(document.path, document.content);
writeFileSync(
  `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/manifest.v1.json`,
  `${JSON.stringify(bundle.manifest, null, 2)}\n`,
);
writeFileSync(
  `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/artifact-inventory.v1.csv`,
  bundle.inventoryCsv,
);
writeFileSync(
  `${GOVERNANCE_EVIDENCE_REVIEW_PACKET_DIR}/checksums.sha256`,
  bundle.checksums,
);

console.log(
  `PASS — ${GOVERNANCE_EVIDENCE_REVIEW_PACKET.releaseId}: ${bundle.manifest.inventory.length} artifacts bound; external review remains pending.`,
);
