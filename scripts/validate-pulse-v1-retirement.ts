import { config } from "dotenv";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", override: true });

const RETIRED_RELATIONS = ["pulse_daily_scores", "pulse_changelog"] as const;
const RETIRED_SCHEMA_EXPORTS = ["pulseDailyScores", "pulseChangelog"] as const;
const RETIRED_RUNTIME_TOKENS = [
  "pulse_daily_scores",
  "pulse_changelog",
  "pulseDailyScores",
] as const;

function fail(message: string): never {
  throw new Error(`PUL-034 Pulse v1 retirement validation failed: ${message}`);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(name)) files.push(path);
  }
  return files;
}

const schema = read("src/lib/db/schema.ts");
const dictionaryRegistry = read("src/lib/data-dictionary/registry.ts");
const migration = read("drizzle/authoritative/0026_magenta_xavin.sql");
const packageJson = read("package.json");
const vercel = JSON.parse(read("vercel.json")) as {
  crons?: Array<{ path?: string }>;
};

for (const token of [...RETIRED_RELATIONS, ...RETIRED_SCHEMA_EXPORTS]) {
  if (schema.includes(token)) fail(`Drizzle schema still exposes ${token}`);
  if (dictionaryRegistry.includes(token))
    fail(`current data dictionary still exposes ${token}`);
}

for (const marker of [
  "to_regclass('public.pulse_daily_scores')",
  "to_regclass('public.pulse_changelog')",
  "score_rows <> 0 OR changelog_rows <> 0",
  "refuses to drop nonempty legacy Pulse outputs",
  'DROP TABLE "pulse_changelog"',
  'DROP TABLE "pulse_daily_scores"',
  "civica-affected-relations: pulse_changelog,pulse_daily_scores",
]) {
  if (!migration.includes(marker))
    fail(`retirement migration is missing ${marker}`);
}
if (/DROP TABLE[^;]+CASCADE/i.test(migration)) {
  fail("retirement migration must not cascade into unreviewed objects");
}

if (existsSync("src/lib/pulse/calculate.ts")) {
  fail("the executable scalar calculator module still exists");
}

const runtimeFiles = [
  ...sourceFiles("src/app"),
  ...sourceFiles("src/components"),
  ...sourceFiles("src/lib"),
];
for (const path of runtimeFiles) {
  const source = read(path);
  for (const token of RETIRED_RUNTIME_TOKENS) {
    if (source.includes(token)) fail(`${path} retains runtime token ${token}`);
  }
  if (source.includes("calculatePulseScores")) {
    fail(`${path} retains the executable scalar calculator`);
  }
}

for (const path of [
  "scripts/ingest-pulse-events.ts",
  "scripts/classify-pulse-events.ts",
  "scripts/calculate-pulse-scores.ts",
]) {
  const source = read(path);
  if (!source.includes("pulseV1RetirementMessage"))
    fail(`${path} does not fail through the shared retirement contract`);
  if (/src\/lib\/pulse\/(?:ingest|classify|calculate)/.test(source))
    fail(`${path} still imports the legacy pipeline`);
}

if (packageJson.includes('"ingest:pulse:events"')) {
  fail("package.json still advertises the legacy Pulse v1 ingest command");
}
for (const cron of vercel.crons ?? []) {
  if (
    cron.path?.startsWith("/api/cron/pulse/") &&
    !cron.path.includes("/v2/")
  ) {
    fail(`vercel.json schedules retired route ${cron.path}`);
  }
}

const rankings = read("src/app/api/v1/index/rankings/route.ts");
const requestContracts = read("src/lib/api/request-contract.ts");
if (
  !rankings.includes('query.data.sort === "cp"') ||
  !rankings.includes("retiredPulseScalarResponse") ||
  !rankings.includes('"v1-index-rankings-query/v1"') ||
  !requestContracts.includes('.pipe(z.enum(["ci", "cp"]))')
) {
  fail("rankings does not distinguish retired CP from unknown sort values");
}

const embed = read("src/app/embed/[slug]/route.ts");
for (const marker of [
  '"Cache-Control": "no-store"',
  '"CDN-Cache-Control": "no-store"',
  '"Vercel-CDN-Cache-Control": "no-store"',
]) {
  if (!embed.includes(marker)) fail(`embed tombstone is missing ${marker}`);
}

const apiDocs = read("src/app/api-docs/page.tsx");
for (const stalePromise of [
  "Embed a live Civica Index widget",
  "Widgets update every 5 minutes",
  "Copy-paste examples",
]) {
  if (apiDocs.includes(stalePromise))
    fail(`API docs retain stale widget promise: ${stalePromise}`);
}
if (!apiDocs.includes("retired") || !apiDocs.includes("Governance Evidence")) {
  fail("API docs do not name the embed retirement and successor");
}

async function validateLive(): Promise<void> {
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT
      to_regclass('public.pulse_daily_scores')::text AS pulse_daily_scores,
      to_regclass('public.pulse_changelog')::text AS pulse_changelog,
      (SELECT count(*)::int FROM pulse_events) AS retained_legacy_events
  `;
  const row = rows[0];
  if (row?.pulse_daily_scores !== null || row?.pulse_changelog !== null) {
    fail("retired scalar relations still exist in the live database");
  }
  if (Number(row?.retained_legacy_events) <= 0) {
    fail("the retained legacy pulse_events evidence unexpectedly disappeared");
  }
  console.log(
    `Live retirement: scalar relations absent; ${row?.retained_legacy_events} legacy event rows retained.`,
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--live")) await validateLive();
  console.log(
    "PASS — pulse-v1-retirement/v1 removes scalar Pulse readers, writers, storage, cache residue, and stale documentation while retaining legacy event evidence.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
