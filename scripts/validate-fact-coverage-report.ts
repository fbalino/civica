import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import report from "../src/lib/provenance/fact-coverage.generated.json";
import { FACT_COVERAGE_VERSION } from "../src/lib/provenance/fact-coverage";

const root = process.cwd();
const errors: string[] = [];
const sum = <T>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

if (report.schemaVersion !== FACT_COVERAGE_VERSION) {
  errors.push(`schema version is ${report.schemaVersion}`);
}
if (!Number.isFinite(Date.parse(report.generatedAt))) {
  errors.push("generatedAt is not an ISO timestamp");
}
if (report.byCountry.length !== report.facts.distinctJurisdictions) {
  errors.push("country breakdown length disagrees with summary");
}
if (report.byFactKey.length !== report.facts.distinctFactKeys) {
  errors.push("fact-key breakdown length disagrees with summary");
}
for (const [label, actual] of [
  ["country facts", sum(report.byCountry, (row) => row.facts)],
  ["fact-key facts", sum(report.byFactKey, (row) => row.facts)],
] as const) {
  if (actual !== report.facts.total) {
    errors.push(`${label} sum ${actual} disagrees with ${report.facts.total}`);
  }
}
if (report.facts.sourceLinked > report.facts.total) {
  errors.push("source-linked facts exceed total facts");
}
if (report.facts.oneSource > report.facts.total) {
  errors.push("single-source facts exceed total facts");
}
if (report.facts.twoPlusIndependentSources > report.facts.total) {
  errors.push("two-plus-independent facts exceed total facts");
}
if (
  report.statements.sourceLinked + report.statements.unlinked !==
  report.statements.total
) {
  errors.push("statement linkage counts do not close");
}

const page = readFileSync(
  resolve(root, "src/app/(reader)/methodology/provenance-coverage/page.tsx"),
  "utf8",
);
const route = readFileSync(
  resolve(root, "src/app/api/provenance-coverage/route.ts"),
  "utf8",
);
const approach = readFileSync(
  resolve(root, "content/data-approach.md"),
  "utf8",
);
if (!page.includes("PUBLIC_CLAIM: methodology.dataset-provenance-coverage")) {
  errors.push("reader page is missing the registered public-claim marker");
}
if (!route.includes("fact-coverage.generated.json")) {
  errors.push("machine route does not serve the checked report");
}
if (!approach.includes("/methodology/provenance-coverage")) {
  errors.push("data-approach page does not link the dataset-wide report");
}
if (/DAT-005 owns the later dataset-wide/i.test(approach)) {
  errors.push(
    "data-approach still describes the completed report as future work",
  );
}

console.log("=== DAT-005 fact provenance coverage ===\n");
console.log(`Facts: ${report.facts.sourceLinked}/${report.facts.total} linked`);
console.log(`Single source: ${report.facts.oneSource}`);
console.log(`Two-plus independent: ${report.facts.twoPlusIndependentSources}`);
console.log(`Unresolved disputes: ${report.facts.unresolvedDisputes}`);
console.log(`Stale live rows: ${report.facts.staleRows}`);
console.log(
  `Statements: ${report.statements.sourceLinked}/${report.statements.total} linked`,
);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(
  "\nPASS — generated report, breakdowns, and public surfaces agree.",
);
