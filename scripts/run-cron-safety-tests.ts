import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function testEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env, NODE_ENV: "test" };
  // The production build can supply a nonempty DATABASE_URL solely to satisfy
  // environment validation. These focused fixture tests must never inherit it:
  // their route seams deliberately use disposable in-process stores instead.
  delete env.DATABASE_URL;
  return env;
}

const exactTests = [
  "scripts/validate-cron-safety.test.ts",
  "src/lib/api/__tests__/route-authorization.test.ts",
  "src/lib/api/cron-effective-inputs.test.ts",
  "src/lib/api/cron-execution-postgres.test.ts",
  "src/lib/api/cron-input.test.ts",
  "src/lib/api/cron-job.test.ts",
  "src/lib/api/cron-routes-integration.test.ts",
  "src/lib/api/cron-schedule.test.ts",
  "src/lib/bills/sources/source-fixtures.test.ts",
  "src/lib/bills/sync.test.ts",
  "src/lib/bills/upsert-postgres.test.ts",
  "src/lib/bills/upsert.test.ts",
  "src/lib/data/factbook-external-sync-contract.test.ts",
  "src/lib/factbook/__tests__/cia-cabinets-plan-failures.test.ts",
  "src/lib/factbook/__tests__/person-portraits-success-honesty.test.ts",
  "src/lib/factbook/cron-outcomes.test.ts",
  "src/lib/factbook/reconcile/__tests__/classification-freshness.test.ts",
  "src/lib/factbook/reconcile/__tests__/external-sync-freshness-ordering.test.ts",
  "src/lib/factbook/reconcile/__tests__/snapshot-candidate-release-retry.test.ts",
  "src/lib/pulse/v1-retirement.test.ts",
  "src/lib/pulse/v2/classification-publication.test.ts",
  "src/lib/pulse/v2/cluster-publish.test.ts",
  "src/lib/pulse/v2/cluster.test.ts",
  "src/lib/pulse/v2/cron-dry-run-contract.test.ts",
  "src/lib/pulse/v2/cron-outcomes.test.ts",
  "src/lib/pulse/v2/ingest.test.ts",
  "src/lib/pulse/v2/late-evidence-repair.test.ts",
  "src/lib/pulse/v2/pipeline-version.test.ts",
  "src/lib/pulse/v2/sources/failure-honesty.test.ts",
  "src/lib/pulse/v2/upsert.test.ts",
] as const;

function matchingTests(directory: string, pattern: RegExp): string[] {
  return readdirSync(path.join(ROOT, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

const testFiles = [
  ...exactTests,
  ...matchingTests("src/lib/factbook/__tests__", /-repeatability\.test\.ts$/),
  ...matchingTests(
    "src/lib/factbook/reconcile/__tests__",
    /-repeatability\.test\.ts$/,
  ),
  ...matchingTests("src/lib/pulse/v2", /-cron-retry\.test\.ts$/),
].sort();

const duplicates = testFiles.filter(
  (testFile, index) => testFiles.indexOf(testFile) !== index,
);
if (duplicates.length > 0) {
  throw new Error(
    `cron-safety test manifest contains duplicates: ${[...new Set(duplicates)].join(", ")}`,
  );
}

for (const testFile of testFiles) {
  if (!existsSync(path.join(ROOT, testFile))) {
    throw new Error(`cron-safety test is missing: ${testFile}`);
  }
}

console.log(`[cron-safety] running ${testFiles.length} focused test files`);
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  {
    cwd: ROOT,
    env: testEnvironment(),
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
