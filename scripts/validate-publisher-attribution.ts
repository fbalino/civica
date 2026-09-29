/**
 * validate-publisher-attribution — CLM-020 static gate (DB-free, network-free).
 *
 *   npm run validate:publisher-attribution
 *   npm run validate:publisher-attribution -- --print-registry
 *   npm run validate:publisher-attribution -- --update-baseline
 *   npx tsx scripts/validate-publisher-attribution.ts \
 *     --source-override=src/lib/db/queries-scores.ts=/path/to/other-copy.ts
 *
 * Rule (publisher-attribution/v1, APR-D174): a number shown beside a
 * publisher's name is that publisher's own figure or carries the visible
 * Civica-calculation marker; a category produced by applying the publisher's
 * published rule carries its rule note.
 *
 * Order of work:
 *   1. Self-proof. The value check must reject the former Freedom House row
 *      ("Free (100/100)") and accept the current rows, and every seeded
 *      source mutation must introduce an issue with its own scan rule. A
 *      broken rule can therefore never report a clean repository.
 *   2. The real scan over every application source file, the rendered-module
 *      ledger, the master checklist, follow-ups, decisions, the frozen
 *      Conditions parameter contract, SCORE_ROW_IDS, and the baseline.
 *
 * It never opens a database connection and runs no test files, so it is safe
 * inside `validate:claims-docs` with the build's environment; the unit tests
 * run in that gate's credential-free `npm test` child.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  DERIVED_FIELD_READERS,
  LIVE_CHECK_EXCEPTIONS,
  PROVENANCE_RENDERERS,
  PUBLISHER_ATTRIBUTION_SURFACES,
  baselineFromRegistry,
} from "../src/lib/provenance/publisher-attribution-registry";
import {
  PUBLISHER_ATTRIBUTION_SCAN_RULES,
  scanPublisherAttribution,
} from "../src/lib/provenance/publisher-attribution-scan";
import {
  PUBLISHER_ATTRIBUTION_BASELINE_PATH,
  PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS,
  formatPublisherAttributionIssue,
  proveScan,
  proveValueCheck,
  readPublisherAttributionScanInput,
} from "../src/lib/provenance/publisher-attribution-selfproof";

const ROOT = process.cwd();

function sourceOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  for (const argument of process.argv) {
    if (!argument.startsWith("--source-override=")) continue;
    const value = argument.slice("--source-override=".length);
    const separator = value.indexOf("=");
    if (separator <= 0) {
      throw new Error(`Malformed ${argument}; use --source-override=<repoPath>=<file>`);
    }
    overrides.set(value.slice(0, separator), readFileSync(value.slice(separator + 1), "utf8"));
  }
  return overrides;
}

function printRegistry(): void {
  const snapshot = {
    schemaVersion: "publisher-attribution-registry-snapshot/v1",
    rules: PUBLISHER_ATTRIBUTION_SCAN_RULES,
    surfaces: PUBLISHER_ATTRIBUTION_SURFACES,
    provenanceRenderers: PROVENANCE_RENDERERS,
    derivedFieldReaders: DERIVED_FIELD_READERS,
    liveCheckExceptions: LIVE_CHECK_EXCEPTIONS,
    baseline: baselineFromRegistry(),
  };
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

function main(): void {
  if (process.argv.includes("--print-registry")) {
    printRegistry();
    return;
  }
  const overrides = sourceOverrides();
  const input = readPublisherAttributionScanInput(ROOT, overrides);
  if (overrides.size === 0) {
    // The self-proof runs against the registry's own baseline, so it proves
    // the rules even while the checked baseline file is being updated.
    const problems = [
      ...proveValueCheck(),
      ...proveScan({ ...input, baseline: baselineFromRegistry() }),
    ];
    if (problems.length > 0) {
      console.error("FAILED — publisher-attribution self-proof did not fail closed:");
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(
      `Self-proof: the former "Free (100/100)" row fails the value check, the current rows pass, and ${PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS.length} seeded source mutations each fail with their rule.`,
    );
  } else {
    console.log(`Scanning with ${overrides.size} source override(s): ${[...overrides.keys()].join(", ")}`);
  }

  const issues = scanPublisherAttribution(input);
  if (process.argv.includes("--update-baseline")) {
    const blocking = issues.filter((issue) => issue.rule !== "registry-baseline-drift");
    if (blocking.length > 0) {
      console.error("Refusing to update the baseline while other rules fail:");
      for (const issue of blocking) console.error(`- ${formatPublisherAttributionIssue(issue)}`);
      process.exit(1);
    }
    writeFileSync(
      path.join(ROOT, PUBLISHER_ATTRIBUTION_BASELINE_PATH),
      `${JSON.stringify(baselineFromRegistry(), null, 2)}\n`,
    );
    console.log(`Updated ${PUBLISHER_ATTRIBUTION_BASELINE_PATH}.`);
    return;
  }
  if (issues.length > 0) {
    console.error(`FAILED — publisher-attribution/v1 found ${issues.length} issue(s):`);
    for (const issue of issues) console.error(`- ${formatPublisherAttributionIssue(issue)}`);
    process.exit(1);
  }
  const exceptions = PUBLISHER_ATTRIBUTION_SURFACES.filter((surface) => surface.exception).length;
  console.log(
    `PASS — publisher-attribution/v1: ${PUBLISHER_ATTRIBUTION_SURFACES.length} surfaces (${exceptions} registered exceptions), ${PROVENANCE_RENDERERS.length} provenance renderers, ${DERIVED_FIELD_READERS.length} derived-field readers, ${LIVE_CHECK_EXCEPTIONS.length} live exception, ${input.sources.size} source files scanned.`,
  );
}

main();
