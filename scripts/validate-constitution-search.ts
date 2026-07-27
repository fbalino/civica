import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const read = (path: string) => readFileSync(path, "utf8");
const schema = read("src/lib/db/schema.ts");
const migration = read("drizzle/authoritative/0030_cute_namora.sql");
const sync = read("src/lib/constitute/sync-constitutions.ts");
const query = read("src/lib/db/queries-constitution-search.ts");
const oldApi = read("src/app/api/countries/[slug]/constitution/route.ts");
const rights = read("src/lib/rights/manifest.ts");

function requireText(source: string, value: string, label: string) {
  if (!source.includes(value)) throw new Error(`ATL-009 missing ${label}`);
}
for (const [source, value, label] of [
  [schema, '"constitution_passages"', "passage schema"],
  [migration, 'USING gin ("search_vector")', "GIN text index"],
  [migration, 'USING gin ("topic_keys")', "GIN topic index"],
  [
    migration,
    "constitution_passages_dat_016_retain_mutation",
    "retention trigger",
  ],
  [
    migration,
    "evidence_id text := COALESCE(after_row->>'passage_id', before_row->>'passage_id')",
    "canonical passage history identity",
  ],
  [sync, "replaceCurrentConstitutionPassages", "sync writer"],
  [query, "websearch_to_tsquery", "English websearch query"],
  [query, "query.transaction", "Neon HTTP atomic transaction"],
  [rights, "CC-BY-NC-3.0", "verified Constitute license"],
  [rights, "https://www.constituteproject.org/content/terms", "official terms"],
] as const)
  requireText(source, value, label);

if (/\.transaction\s*\(/.test(sync)) {
  throw new Error("ATL-009 sync cannot use unsupported drizzle transactions");
}
if (/fullTextHtml\s*:/.test(oldApi)) {
  throw new Error("Legacy country constitution API still emits fullTextHtml");
}

async function live() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const [counts] = await sql`
    SELECT count(*) FILTER (WHERE is_current)::int AS current,
      count(*) FILTER (WHERE NOT is_current)::int AS superseded,
      count(*) FILTER (WHERE is_current AND superseded_at IS NOT NULL)::int AS invalid_current,
      count(*) FILTER (WHERE NOT is_current AND superseded_at IS NULL)::int AS invalid_superseded,
      count(DISTINCT constitution_id) FILTER (WHERE is_current)::int AS constitutions
    FROM constitution_passages
  `;
  if (
    Number(counts.current) !== 96_126 ||
    Number(counts.constitutions) !== 186
  ) {
    throw new Error(
      `ATL-009 live passage coverage drift: ${JSON.stringify(counts)}`,
    );
  }
  if (Number(counts.invalid_current) || Number(counts.invalid_superseded)) {
    throw new Error(
      `ATL-009 live supersession state invalid: ${JSON.stringify(counts)}`,
    );
  }
  const indexes =
    await sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='constitution_passages'`;
  for (const name of [
    "idx_constitution_passages_search",
    "idx_constitution_passages_topics",
    "idx_constitution_passages_current_section",
  ]) {
    if (!indexes.some((row) => row.indexname === name))
      throw new Error(`Missing live index ${name}`);
  }
  const plan =
    await sql`EXPLAIN (FORMAT JSON) SELECT passage_id FROM constitution_passages WHERE is_current = true AND search_vector @@ websearch_to_tsquery('english', 'freedom of expression') LIMIT 21`;
  if (!JSON.stringify(plan).includes("idx_constitution_passages_search")) {
    throw new Error(
      "Selective constitution search plan does not use the GIN index",
    );
  }
  console.log(
    `ATL-009 live corpus OK: ${counts.current} current, ${counts.superseded} superseded`,
  );
}

async function main() {
  if (process.argv.includes("--live")) await live();
  else console.log("ATL-009 static constitution-search contract OK");
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
