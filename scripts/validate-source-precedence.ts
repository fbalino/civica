import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SOURCE_PRECEDENCE_VERSION } from "../src/lib/factbook/reconcile/resolver";

const root = process.cwd();
const resolution = readFileSync(
  resolve(root, "plan/decisions/source-precedence-v1.md"),
  "utf8",
);
const resolver = readFileSync(
  resolve(root, "src/lib/factbook/reconcile/resolver.ts"),
  "utf8",
);
const types = readFileSync(
  resolve(root, "src/lib/factbook/reconcile/types.ts"),
  "utf8",
);
const api = readFileSync(
  resolve(root, "src/lib/factbook/reconcile/api.ts"),
  "utf8",
);
const methodology = readFileSync(
  resolve(root, "src/app/(reader)/country/methodology/reconciliation/page.tsx"),
  "utf8",
);
const fixtures = readFileSync(
  resolve(root, "src/lib/factbook/reconcile/source-precedence.test.ts"),
  "utf8",
);

const errors: string[] = [];
for (const phrase of [
  "Eligibility",
  "Measurement before projection",
  "Group A and C incumbent policy",
  "Group B freshness",
  "Equal-vintage precedence",
  "Material-error guard",
  "Reference-quality guard",
  "Comparability exception",
  "Republication disclosure",
]) {
  if (!resolution.includes(phrase)) errors.push(`resolution missing ${phrase}`);
}
if (!resolution.includes(SOURCE_PRECEDENCE_VERSION)) errors.push("version mismatch");
for (const code of [
  "row_eligibility",
  "measurement_partition",
  "source_lineage",
  "precedence_rule",
  "guard_result",
  "canonical_selection",
]) {
  if (!types.includes(`| "${code}"`) && !types.includes(`=\n  | "${code}"`)) {
    errors.push(`trace code missing from type: ${code}`);
  }
  if (!resolver.includes(`code: "${code}"`)) errors.push(`resolver never emits ${code}`);
}
if (!api.includes("decisionTrace: output.decisionTrace")) {
  errors.push("public provenance omits decisionTrace");
}
if (!methodology.includes("source-precedence/v1")) {
  errors.push("public methodology omits the adopted contract version");
}
const fixtureCount = (fixtures.match(/^test\(/gm) ?? []).length;
if (fixtureCount < 9) errors.push(`only ${fixtureCount} precedence fixtures found`);

console.log("=== DAT-007 source precedence ===\n");
console.log(`Contract: ${SOURCE_PRECEDENCE_VERSION}`);
console.log(`Focused fixtures: ${fixtureCount}`);
console.log("Trace steps: 6");
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log("\nPASS — precedence contract, traces, API, prose, and fixtures agree.");
