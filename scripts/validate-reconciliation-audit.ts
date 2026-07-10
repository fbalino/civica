import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import report from "../src/lib/factbook/reconcile/reconciliation-audit.generated.json";
import { FACT_KEYS } from "../src/lib/factbook/reconcile/fact-keys";
import { RECONCILIATION_AUDIT_VERSION } from "../src/lib/factbook/reconcile/reconciliation-audit";

const errors: string[] = [];
const fail = (message: string) => errors.push(message);

if (report.schemaVersion !== RECONCILIATION_AUDIT_VERSION) fail("schema version drift");
if (!Number.isFinite(Date.parse(report.generatedAt))) fail("generatedAt is invalid");
if (report.registry.totalFactKeys !== Object.keys(FACT_KEYS).length) {
  fail("not every canonical fact key has an audit row");
}
if (report.factPolicies.length !== report.registry.totalFactKeys) {
  fail("policy rows do not close to registry total");
}
const policyTotal = Object.values(report.registry.policyCounts).reduce(
  (sum, value) => sum + value,
  0,
);
if (policyTotal !== report.registry.totalFactKeys) fail("policy counts do not close");
if (new Set(report.factPolicies.map((row) => row.factKey)).size !== report.factPolicies.length) {
  fail("duplicate fact-key policy rows");
}
if (report.lineage.unverifiedSourceFactPairs !== 0) {
  fail(`${report.lineage.unverifiedSourceFactPairs} active source/fact relationships have unverified lineage`);
}
if (!report.lineage.rule.includes("Republishers share the upstream family")) {
  fail("lineage rule does not state the republisher collapse");
}

const workedExamples = readFileSync(
  resolve(process.cwd(), "src/lib/factbook/reconcile/__tests__/worked-examples.test.ts"),
  "utf8",
);
const workedExampleIds = workedExamples.match(/id:\s*"we\d+"/g) ?? [];
if (workedExampleIds.length !== 8) fail("live resolver contract must retain exactly eight worked examples");

const publicRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/reconciliation-audit/route.ts"),
  "utf8",
);
const coveragePage = readFileSync(
  resolve(process.cwd(), "src/app/(reader)/methodology/provenance-coverage/page.tsx"),
  "utf8",
);
if (!publicRoute.includes("reconciliation-audit.generated.json")) {
  fail("public API route does not serve the checked reconciliation audit");
}
if (!coveragePage.includes('id="reconciliation"')) {
  fail("public provenance page does not explain reconciliation policy coverage");
}

try {
  assert.ok(report.factPolicies.every((row) => row.policy && row.reason));
} catch {
  fail("a fact-key policy is missing its explicit policy or reason");
}

console.log("=== DAT-006 reconciliation coverage ===\n");
console.log(`Canonical fact keys: ${report.registry.totalFactKeys}`);
console.log(`Supported: ${report.registry.supportedFactKeys}`);
console.log(`Unsupported: ${report.registry.unsupportedFactKeys}`);
console.log(`Single-source passthrough: ${report.registry.policyCounts.single_source_passthrough}`);
console.log(`Multi-source resolver: ${report.registry.policyCounts.multi_source_resolver}`);
console.log(`Manual review: ${report.registry.policyCounts.manual_review}`);
console.log(`Active source/fact lineage relationships: ${report.lineage.activeSourceFactPairs}`);
console.log(`Unverified active relationships: ${report.lineage.unverifiedSourceFactPairs}`);
console.log(`Worked-example contracts: ${workedExampleIds.length}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log("\nPASS — every fact key has a policy and active lineage fails closed.");
