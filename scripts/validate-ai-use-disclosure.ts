import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AI_USE_DISCLOSURE, aiUseDisclosureErrors } from "../src/lib/research/ai-use-disclosure";
import { buildAiUseDisclosureArtifact } from "./generate-ai-use-disclosure";

assert.deepEqual(aiUseDisclosureErrors(), []);
assert.deepEqual(JSON.parse(readFileSync("data/research/ai-use-disclosure-v1.json", "utf8")), buildAiUseDisclosureArtifact());
const about = readFileSync("content/about.md", "utf8");
for (const phrase of [
  AI_USE_DISCLOSURE.schemaVersion,
  "Code, planning, and internal audits",
  "Production research systems",
  "Prose and illustrations",
  "not independent peer review",
  "Fernando Baliño remains responsible",
]) assert.ok(about.includes(phrase), `About disclosure missing: ${phrase}`);
for (const model of ["DeepSeek V4 Flash", "GLM 4.7", "Claude Haiku 4.5", "Claude Sonnet 4.6", "GPT-5.3 Codex Spark"])
  assert.ok(about.includes(model), `About disclosure missing material model: ${model}`);
console.log(`PASS — public About disclosure and ${AI_USE_DISCLOSURE.uses.length} machine-readable roles distinguish assistance, production use, limits, and human responsibility.`);
