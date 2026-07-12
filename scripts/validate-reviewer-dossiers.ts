import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewerDossierErrors } from "../src/lib/research/reviewer-dossiers";
import { buildReviewerDossierArtifact } from "./generate-reviewer-dossiers";

const checked = JSON.parse(readFileSync("data/research/reviewer-dossiers-v1.json", "utf8"));
assert.deepEqual(checked, buildReviewerDossierArtifact());
assert.deepEqual(reviewerDossierErrors(checked), []);
assert.equal(checked.dossiers.length, 18);
console.log("PASS — 18 personalized, bounded, conflict-aware, honorarium-pending, unsent reviewer dossiers.");
