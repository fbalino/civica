/**
 * BRD-013 terms-conditions validator. Deterministic, DB-free, network-free.
 *
 *   Run with: npx tsx scripts/validate-terms-conditions.ts
 *             (wired as `npm run validate:terms-conditions`)
 *
 * Reads src/app/terms/page.tsx, src/app/api-docs/page.tsx, and
 * src/app/licensing/page.tsx from disk and calls the pure
 * `validateTermsConditions` in src/lib/policy/terms-contract.ts. Fails
 * closed (nonzero exit) if any of the ten registered Terms clauses is
 * missing its section anchor, missing its required phrase in the terms
 * prose, or contradicted by a claim anywhere across the three surfaces.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { validateTermsConditions } from "../src/lib/policy/terms-contract";

const SOURCES = {
  termsSource: "src/app/terms/page.tsx",
  apiDocsSource: "src/app/api-docs/page.tsx",
  licensingSource: "src/app/licensing/page.tsx",
} as const;

function readRequired(relPath: string): string {
  const abs = path.resolve(process.cwd(), relPath);
  if (!existsSync(abs)) {
    console.error(`FAILED — required file does not exist: ${relPath}`);
    process.exit(1);
  }
  return readFileSync(abs, "utf8");
}

function main(): void {
  console.log("=== Civica terms-conditions validation (BRD-013) ===\n");

  const termsSource = readRequired(SOURCES.termsSource);
  const apiDocsSource = readRequired(SOURCES.apiDocsSource);
  const licensingSource = readRequired(SOURCES.licensingSource);

  console.log(`Terms:     ${SOURCES.termsSource} (${termsSource.length} bytes)`);
  console.log(`API Docs:  ${SOURCES.apiDocsSource} (${apiDocsSource.length} bytes)`);
  console.log(`Licensing: ${SOURCES.licensingSource} (${licensingSource.length} bytes)`);

  const issues = validateTermsConditions({
    termsSource,
    apiDocsSource,
    licensingSource,
  });

  if (issues.length > 0) {
    console.error(`\nFAILED — ${issues.length} problem(s):`);
    for (const issue of issues) {
      const clause = issue.clauseId ? ` (${issue.clauseId})` : "";
      console.error(`- [${issue.code}]${clause} ${issue.message}`);
    }
    process.exit(1);
  }

  console.log("\nPASS — terms/API-docs/licensing surfaces match the clause registry.");
}

main();
