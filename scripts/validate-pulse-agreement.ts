import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  deriveStoredEnsemble,
  storedRunsPermitAutomaticPublication,
} from "../src/lib/pulse/v2/stored-ensemble";
import type { ClassifierRun } from "../src/lib/pulse/v2/types";

config({ path: ".env.local", override: true });

function fail(message: string): never {
  throw new Error(`PUL-036 agreement validation failed: ${message}`);
}

const classify = readFileSync("src/lib/pulse/v2/classify.ts", "utf8");
const stored = readFileSync("src/lib/pulse/v2/stored-ensemble.ts", "utf8");
const subscription = readFileSync(
  "scripts/pulse-apply-classifications.ts",
  "utf8",
);
const gate = readFileSync("src/lib/pulse/v2/publication-gate.ts", "utf8");

for (const marker of [
  "deriveStoredEnsemble(classifyRuns)",
  "storedRunsPermitAutomaticPublication",
  "configuredEngineCount: CLASSIFY_ENSEMBLE.length",
  'role: "classify"',
  'role: "verify"',
  "Automatic publication requires stored provider-distinct versioned votes",
]) {
  if (!classify.includes(marker)) fail(`classifier is missing ${marker}`);
}
for (const marker of [
  "duplicate_provider_not_independent",
  '"promptVersion",',
  "fewer_than_two_independent_classify_runs",
  "computeConsensus(runs, configuredEngineCount)",
]) {
  if (!stored.includes(marker)) fail(`stored-run derivation is missing ${marker}`);
}
if (!gate.includes("return true")) {
  fail("single-engine classification is not forced to review");
}
if (
  /classifierAgreement\s*:\s*"(?:all|two_of_three)"/.test(subscription) ||
  !subscription.includes('classifierAgreement: "none"') ||
  !subscription.includes("autoPublished: false")
) {
  fail("subscription-agent path can manufacture ensemble agreement or publication");
}

const writerPaths = [
  "src/lib/pulse/v2/classify.ts",
  "scripts/pulse-apply-classifications.ts",
  "scripts/reattribute-pulse-country.ts",
  "scripts/repair-pulse-incidents.ts",
  "src/app/api/admin/pulse-review/[id]/route.ts",
];
for (const path of writerPaths) {
  const source = readFileSync(path, "utf8");
  if (/classifierAgreement\s*:\s*"(?:all|two_of_three)"/.test(source)) {
    fail(`${path} writes a literal supported-agreement label`);
  }
}

for (const path of [
  "src/app/api/v1/pulse/[country_slug]/dimensions/route.ts",
  "src/app/api/v1/pulse/[country_slug]/events/route.ts",
  "src/app/api/v1/pulse/changelog/v2/route.ts",
]) {
  const source = readFileSync(path, "utf8");
  if (!source.includes("PULSE_METHODOLOGY_META") || source.includes("CI_METHODOLOGY_META")) {
    fail(`${path} does not use Pulse-specific methodology metadata`);
  }
}

async function validateLive(): Promise<void> {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const rows = (await sql.query(
    `SELECT id, classifier_agreement, classifier_runs, published,
            human_reviewed, review_status
       FROM pulse_events_v2 ORDER BY id`,
    [],
  )) as Array<{
    id: string;
    classifier_agreement: string;
    classifier_runs: ClassifierRun[];
    published: boolean;
    human_reviewed: boolean;
    review_status: string;
  }>;
  let mismatchedAgreement = 0;
  let unsupportedAutomatic = 0;
  let oneRunAutomatic = 0;
  let humanPublished = 0;
  for (const row of rows) {
    const derived = deriveStoredEnsemble(row.classifier_runs);
    if (row.classifier_agreement !== derived.consensus.agreement) {
      mismatchedAgreement++;
    }
    if (row.published && row.human_reviewed) humanPublished++;
    if (
      row.published &&
      !row.human_reviewed &&
      !storedRunsPermitAutomaticPublication(row.classifier_runs)
    ) {
      unsupportedAutomatic++;
      if (derived.classifyRunCount < 2) oneRunAutomatic++;
    }
  }
  if (mismatchedAgreement) fail(`live mismatched agreement rows=${mismatchedAgreement}`);
  if (unsupportedAutomatic) fail(`live unsupported automatic rows=${unsupportedAutomatic}`);
  if (oneRunAutomatic) fail(`live one-run automatic rows=${oneRunAutomatic}`);
  console.log(
    `Live agreement: ${rows.length} rows; ${humanPublished} human-published; zero unsupported automatic rows.`,
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--live")) await validateLive();
  console.log(
    "PASS — pulse-stored-ensemble/v1 derives agreement and automatic eligibility only from stored provider-distinct prompt-versioned runs; Pulse APIs use Pulse metadata.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
