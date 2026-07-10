/**
 * Validate the replication-package status surface (CLM-010).
 *
 * `replicationPackage` in `src/lib/content/site-state.ts` is the single
 * source of truth the `/civica-index/replication` route renders from. This
 * script re-runs the pure invariants from
 * `src/lib/content/replication-surface.ts` against the live object, then
 * scans the route's rendered prose and the component copy itself for
 * language that would imply a package exists before it does.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  findProhibitedReplicationLanguage,
  validateReplicationPackage,
} from "../src/lib/content/replication-surface";
import { replicationPackage } from "../src/lib/content/site-state";

const PAGE_PATH = "src/app/(reader)/civica-index/replication/page.tsx";

function main(): void {
  const errors: string[] = [];

  for (const issue of validateReplicationPackage(replicationPackage)) {
    errors.push(`${issue.code}: ${issue.message}`);
  }

  const pageSource = readFileSync(
    path.resolve(process.cwd(), PAGE_PATH),
    "utf8",
  );
  for (const match of findProhibitedReplicationLanguage(pageSource)) {
    errors.push(
      `prohibited availability phrase "${match.phrase}" (matched ${JSON.stringify(match.match)}) in ${PAGE_PATH}`,
    );
  }

  const componentCopy = replicationPackage.components
    .map((c) => `${c.label} — ${c.owner} — ${c.whatRemains}`)
    .join("\n");
  for (const match of findProhibitedReplicationLanguage(componentCopy)) {
    errors.push(
      `prohibited availability phrase "${match.phrase}" (matched ${JSON.stringify(match.match)}) in replicationPackage component copy`,
    );
  }

  console.log("=== Civica replication-surface validation ===\n");
  console.log(`Page status: ${replicationPackage.pageStatus}`);
  console.log(`Components: ${replicationPackage.components.length}`);

  if (errors.length > 0) {
    console.error(`\nFAILED — ${errors.length} problem(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    "\nPASS — replication surface invariants hold and no prohibited availability language found.",
  );
}

main();
