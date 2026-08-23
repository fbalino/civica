/**
 * backfill-jurisdiction-capitals — populate the empty `jurisdictions.capital`
 * column from CIA Factbook section data already stored in this database.
 *
 *   Dry-run (default):  npx tsx scripts/backfill-jurisdiction-capitals.ts --dry-run
 *   Apply:              npx tsx scripts/backfill-jurisdiction-capitals.ts --apply
 *
 * ── Why this exists ──
 * `jurisdictions.capital` is NULL for every row, and `jurisdictions` has not
 * been written since 2026-05-05, so this is a never-populated column rather
 * than lost data. The checked `src/lib/jurisdictions/directory.generated.json`
 * (CAC/Option A, 2026-08-17) DOES carry capitals, so
 * `npm run validate:jurisdiction-directory` fails its live diff on every
 * Vercel build and has blocked production deploys since that artifact landed.
 *
 * The capitals themselves were never missing: the raw CIA payload is retained
 * in `country_factbook_sections.section_data` for the `government` section,
 * where `Capital.name.text` holds the value. Reading it back reproduces all
 * 253 checked rows exactly, so this restores the column from evidence Civica
 * already holds instead of re-importing the upstream Factbook (which would
 * also rewrite population, area, GDP, and languages).
 *
 * ── Discipline ──
 * - Touches ONE column on `jurisdictions`. No other field is read or written.
 * - Writes no `last_sync_at`: this is a correction, not a sync, so it must not
 *   pass through the `markSourcesSynced*` family.
 * - Idempotent: only rows whose stored capital differs from the column are
 *   updated, so a content-identical rerun writes nothing.
 * - Neon HTTP has no interactive transactions; the apply path uses a single
 *   `sql.transaction([...])` batch.
 * - Extraction mirrors `scripts/seed-from-factbook.ts` (`decodeHtmlEntities` +
 *   `extractText`) so the value matches what the seed itself would have
 *   written.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

/** Ported verbatim from `scripts/seed-from-factbook.ts`. */
function decodeHtmlEntities(str: string): string {
  return str.replace(/&([a-z]+);/gi, (_, entity: string) => {
    const map: Record<string, string> = {
      amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
      ocirc: "ô", eacute: "é", egrave: "è", agrave: "à", uuml: "ü",
      ouml: "ö", auml: "ä", ntilde: "ñ", ccedil: "ç", iacute: "í",
      aacute: "á", oacute: "ó", uacute: "ú", nbsp: " ",
    };
    return map[entity.toLowerCase()] ?? `&${entity};`;
  });
}

/** Same absence discipline as the seed: empty and `[object Object]` are null. */
function cleanCapital(raw: string | null): string | null {
  if (raw == null) return null;
  const clean = decodeHtmlEntities(raw).trim();
  return clean && clean !== "[object Object]" ? clean : null;
}

function parseArgs(): { apply: boolean } {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) {
    console.error("Pass either --apply or --dry-run, not both.");
    process.exit(1);
  }
  return { apply };
}

async function main() {
  const { apply } = parseArgs();
  console.log("=== backfill-jurisdiction-capitals ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN (no writes)"}\n`);

  const rows = (await sql`
    SELECT j.id, j.slug, j.capital AS current,
           s.section_data->'Capital'->'name'->>'text' AS stored
    FROM jurisdictions j
    JOIN country_factbook_sections s ON s.jurisdiction_id = j.id
    WHERE s.section_name = 'government'
    ORDER BY j.slug ASC`) as {
    id: string;
    slug: string;
    current: string | null;
    stored: string | null;
  }[];

  const changes = rows
    .map((row) => ({ ...row, next: cleanCapital(row.stored) }))
    .filter((row) => row.next !== null && row.next !== row.current);

  const unresolved = rows.filter((row) => cleanCapital(row.stored) === null);

  console.log(`government sections scanned : ${rows.length}`);
  console.log(`rows to set                 : ${changes.length}`);
  console.log(`no capital in stored payload: ${unresolved.length} (left NULL)\n`);

  for (const row of changes.slice(0, 10)) {
    console.log(`  ${row.slug}: ${row.current ?? "NULL"} -> ${row.next}`);
  }
  if (changes.length > 10) console.log(`  … and ${changes.length - 10} more`);

  if (!apply) {
    console.log("\nDRY-RUN complete. No rows were written.");
    return;
  }
  if (changes.length === 0) {
    console.log("\nNothing to do; the column already matches stored evidence.");
    return;
  }

  // One batch, one implicit transaction per statement set (Neon HTTP has no
  // interactive transaction support).
  await sql.transaction(
    changes.map(
      (row) =>
        sql`UPDATE jurisdictions
            SET capital = ${row.next}, updated_at = NOW()
            WHERE id = ${row.id}`,
    ),
  );

  const [{ filled }] = (await sql`
    SELECT count(capital)::int AS filled FROM jurisdictions`) as {
    filled: number;
  }[];
  console.log(`\nAPPLIED. jurisdictions.capital now populated on ${filled} rows.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
