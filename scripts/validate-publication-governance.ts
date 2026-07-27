import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GOVERNANCE_DOMAINS,
  PUBLICATION_GOVERNANCE_CHARTER,
  publicationGovernanceErrors,
} from "../src/lib/research/publication-governance";
import { buildPublicationGovernanceArtifact } from "./generate-publication-governance";

const artifact = JSON.parse(readFileSync("data/research/publication-governance-charter-v1.json", "utf8"));
const policy = readFileSync("plan/research/research-publication-governance-charter-v1.md", "utf8");

assert.deepEqual(publicationGovernanceErrors(), []);
assert.deepEqual(artifact, buildPublicationGovernanceArtifact());
assert.ok(policy.includes(PUBLICATION_GOVERNANCE_CHARTER.schemaVersion));
for (const domain of GOVERNANCE_DOMAINS) assert.ok(policy.includes(`\`${domain}\``));
assert.equal(/accountable(?: human)?:?\s*(?:the )?Civica Team/i.test(policy), false);
assert.ok(policy.includes("Fernando Baliño"));
assert.ok(policy.includes("Agents and models have no decision rights"));

console.log(`PASS — ${artifact.schemaVersion}: all ten domains name one accountable human; anonymous-team and agent authority are absent.`);
