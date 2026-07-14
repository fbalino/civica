import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/**
 * Exact DB-free regression manifest for PLT-012. Keeping this list closed
 * prevents a misspelled glob or moved test from silently turning the security
 * gate into a zero-test pass.
 */
const testFiles = [
  "src/lib/admin/logout.test.ts",
  "src/lib/admin/mutation-error-profile.test.ts",
  "src/lib/admin/mutation.test.ts",
  "src/lib/api/admin-feed-shapes.test.ts",
  "src/lib/api/admin-mutation-request-guard.test.ts",
  "src/lib/api/artifact-response.test.ts",
  "src/lib/api/contract/__tests__/contract.test.ts",
  "src/lib/api/cron-input.test.ts",
  "src/lib/api/cron-job.test.ts",
  "src/lib/api/cron-output.test.ts",
  "src/lib/api/problem-response.test.ts",
  "src/lib/api/pulse-coding-problem.test.ts",
  "src/lib/api/request-body-schemas.test.ts",
  "src/lib/api/request-body.test.ts",
  "src/lib/api/request-contract.test.ts",
  "src/lib/api/route-io-policy/route-io-policy.test.ts",
  "src/lib/ci/governance-evidence.test.ts",
  "src/lib/ci/index-change-control-nonsemantic.test.ts",
  "src/lib/constitution/sanitize-html.test.ts",
  "src/lib/constitution/search-error-response.test.ts",
  "src/lib/constitution/search-rate-limit-response.test.ts",
  "src/lib/db/queries-constitution-outage.test.ts",
  "src/lib/exports/csv.test.ts",
  "src/lib/exports/country-research-export.test.ts",
  "src/lib/net/public-http.test.ts",
  "src/lib/pulse/v2/coding-export.test.ts",
] as const;

const duplicates = testFiles.filter(
  (testFile, index) => testFiles.indexOf(testFile) !== index,
);
if (duplicates.length > 0) {
  throw new Error(
    `route-I/O test manifest contains duplicates: ${[
      ...new Set(duplicates),
    ].join(", ")}`,
  );
}

for (const testFile of testFiles) {
  if (!existsSync(path.join(ROOT, testFile))) {
    throw new Error(`route-I/O test is missing: ${testFile}`);
  }
}

console.log(`[route-io-policy] running ${testFiles.length} focused test files`);
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
