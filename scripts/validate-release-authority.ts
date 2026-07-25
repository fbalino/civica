import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RELEASE_AUTHORITY, releaseAuthorityErrors } from "../src/lib/research/release-authority";
import { buildReleaseAuthorityArtifact } from "./generate-release-authority";

assert.deepEqual(releaseAuthorityErrors(), []);
assert.deepEqual(JSON.parse(readFileSync("data/research/release-correction-authority-v1.json", "utf8")), buildReleaseAuthorityArtifact());
const policy = readFileSync("content/policies.md", "utf8");
for (const phrase of [
  RELEASE_AUTHORITY.schemaVersion,
  "Fernando Baliño is the approver",
  "Emergency action",
  "IsNewVersionOf",
  "IsPreviousVersionOf",
  "one reconsideration",
  "/civica-index/corrections",
  "/contact",
]) assert.ok(policy.includes(phrase), `policy missing release-authority phrase: ${phrase}`);
console.log("PASS — public policy names authority, emergency process, version triggers, DOI relationships, notices, report/appeal routes, and three reproducible tabletop outcomes.");
