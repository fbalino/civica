import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const errors: string[] = [];

const schema = read("src/lib/db/schema.ts");
const writer = read("src/lib/legislatures/composition-writer.ts");
const identity = read("src/lib/parties/identity.ts");
const migration = read("drizzle/authoritative/0031_hot_saracen.sql");
const query = read("src/lib/db/queries-parties.ts");
const ui = read("src/components/parties/PartyExplorer.tsx");
const ipu = read("scripts/sync-ipu-parline.ts");
const wikidata = read("scripts/sync-wikidata-parties.ts");

for (const marker of [
  '"political_parties"',
  '"party_composition_runs"',
  '"party_identity_events"',
  'text("identity_key").notNull()',
  'boolean("is_current").default(true).notNull()',
]) {
  if (!schema.includes(marker)) errors.push(`schema is missing ${marker}`);
}
for (const marker of [
  "party-composition-diff/v1",
  "sourcePartyId",
  "await db.batch(",
  "isCurrent: false",
  "writeSourcedPartyLineageEvent",
]) {
  if (!writer.includes(marker) && !identity.includes(marker)) {
    errors.push(`writer/identity contract is missing ${marker}`);
  }
}
if (/\.delete\s*\(|DELETE\s+FROM/i.test(writer)) {
  errors.push("composition writer contains a destructive delete");
}
for (const marker of [
  "party_composition_runs_append_only",
  "party_identity_events_append_only",
  "political_parties_research_evidence_history",
  "identity_adopted",
  "never infers cross-chamber continuity",
]) {
  if (!migration.includes(marker)) errors.push(`migration is missing ${marker}`);
}
for (const [path, source] of [
  ["scripts/sync-ipu-parline.ts", ipu],
  ["scripts/sync-wikidata-parties.ts", wikidata],
] as const) {
  if (!source.includes("sourcePartyId")) {
    errors.push(`${path} does not supply a publisher party identifier`);
  }
}
for (const marker of [
  "partyCompositionRuns.sourceRetrievedAt",
  "partyCompositionRuns.sourceLicense",
  "partyCompositionRuns.sourceUrl",
  "eq(legislatureParties.isCurrent, true)",
]) {
  if (!query.includes(marker)) errors.push(`party query is missing ${marker}`);
}
for (const marker of [
  "source.license",
  "retrieved {retrieved}",
  "coded ${party.position.codedYear}",
  "Composition source not recorded",
]) {
  if (!ui.includes(marker)) errors.push(`party browser is missing ${marker}`);
}

async function validateLive(): Promise<void> {
  if (!process.argv.includes("--live")) return;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for --live");
  }
  const sql = neon(process.env.DATABASE_URL);
  const [integrity] = await sql`
    SELECT
      (SELECT count(*)::int FROM political_parties) AS parties,
      (SELECT count(*)::int FROM party_composition_runs) AS runs,
      (SELECT count(*)::int FROM party_identity_events) AS events,
      (SELECT count(*)::int FROM legislature_parties WHERE is_current) AS current_rows,
      (SELECT count(*)::int FROM legislature_parties lp
        LEFT JOIN political_parties p ON p.id = lp.party_id
        LEFT JOIN party_composition_runs r ON r.id = lp.composition_run_id
        WHERE p.id IS NULL OR r.id IS NULL OR lp.identity_key IS NULL) AS broken_links,
      (SELECT count(*)::int FROM legislature_parties
        WHERE (is_current AND retired_at IS NOT NULL)
           OR (NOT is_current AND retired_at IS NULL)) AS invalid_lifecycle,
      (SELECT count(*)::int FROM party_positions pp
        LEFT JOIN legislature_parties lp ON lp.id = pp.legislature_party_id
        WHERE lp.id IS NULL) AS orphan_positions,
      (SELECT count(*)::int FROM political_parties
        WHERE identity_status = 'source_verified'
          AND (identity_source_id IS NULL OR identity_external_id IS NULL
            OR identity_source_url IS NULL OR identity_source_license IS NULL
            OR identity_retrieved_at IS NULL)) AS incomplete_verified_identity,
      (SELECT count(*)::int FROM party_identity_events
        WHERE event_type IN ('split_into', 'merged_into', 'succeeded_by')
          AND (predecessor_party_id IS NULL OR successor_party_id IS NULL
            OR predecessor_party_id = successor_party_id
            OR source_id IS NULL OR source_url IS NULL
            OR source_license IS NULL OR source_retrieved_at IS NULL)) AS invalid_lineage
  `;
  const triggers = await sql`
    SELECT tgname
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'political_parties_research_evidence_history',
        'party_composition_runs_append_only',
        'party_identity_events_append_only'
      )
    ORDER BY tgname
  `;

  const value = (key: string) => Number(integrity?.[key] ?? -1);
  if (value("parties") <= 0) errors.push("live political party registry is empty");
  if (value("runs") <= 0) errors.push("live composition-run ledger is empty");
  if (value("events") <= 0) errors.push("live identity-event ledger is empty");
  if (value("current_rows") <= 0) errors.push("live current party composition is empty");
  for (const key of [
    "broken_links",
    "invalid_lifecycle",
    "orphan_positions",
    "incomplete_verified_identity",
    "invalid_lineage",
  ]) {
    if (value(key) !== 0) errors.push(`live ${key} = ${value(key)}, expected 0`);
  }
  if (triggers.length !== 3) {
    errors.push(`live schema has ${triggers.length}/3 party evidence triggers`);
  }
  console.log(
    `Live registry: ${value("parties")} identities, ${value("current_rows")} current chamber rows, ${value("runs")} runs, ${value("events")} events`,
  );
}

async function main(): Promise<void> {
  await validateLive();
  console.log("=== ATL-011 party identity and provenance ===\n");
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(
    "PASS — party identity, retained composition, provenance, and ideology honesty contracts hold.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
