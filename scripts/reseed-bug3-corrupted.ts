/**
 * Bug 3 — targeted re-seed of seed-layer corrupted fact-keys.
 *
 * Re-extracts the four affected fact-keys from existing CIA prose
 * already stored in `country_factbook_sections.section_data` (no
 * upstream re-fetch), and rewrites the corrupt rows in
 * `country_facts` and `jurisdictions` cache columns.
 *
 * Affected:
 *   - country_facts.languages (139 rows: '[object Object]')
 *   - country_facts.official_languages (139 rows: bridged from
 *     languages — refreshed via npm run bridge:cia-canonical
 *     after this script)
 *   - country_facts.exports_total (1 row: Western Sahara)
 *   - country_facts.imports_total (1 row: Western Sahara)
 *   - jurisdictions.languages cache (139 corrupt + 14 NULL probe)
 *   - jurisdictions.currency cache (218 exchange-rate-text rows
 *     → null, deferred to WB sync per OQ2)
 *
 * F.5.1 invariant honoured: only updates `factValue`,
 * `factValueNumeric`, `factUnit`, `factYear`, `sourceNote`,
 * `retrievedAt`. Skips rows with `status != 'active'` so reviewer
 * demotions survive.
 *
 * See ~/civica/plan/factbook-prose-extraction-v1.md (ADOPTED
 * 2026-05-04) for the methodology resolution.
 *
 * Usage:
 *   npx tsx scripts/reseed-bug3-corrupted.ts
 *   npx tsx scripts/reseed-bug3-corrupted.ts --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql, and, eq, isNull } from "drizzle-orm";
import {
  countryFacts,
  countryFactbookSections,
  jurisdictions,
  dataDisputes,
} from "../src/lib/db/schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sqlClient });

const DRY_RUN = process.argv.includes("--dry-run");

// ───────────────────────────────────────────────────────────────
// Ported helpers from scripts/seed-from-factbook.ts (Bug 3 fix).
// Single source of truth for extraction is the seed script; this
// file re-implements the same logic for a targeted DB rewrite.
// ───────────────────────────────────────────────────────────────

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

/**
 * Canonical extraction helper, mirrors
 * scripts/seed-from-factbook.ts (post-Bug-3-fix). Returns null on
 * absence rather than stringifying objects.
 */
function extractText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const clean = decodeHtmlEntities(value).trim();
    return clean && clean !== "[object Object]" ? clean : null;
  }
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return extractText((value as Record<string, unknown>).text);
  }
  return null;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function getNestedValue(data: unknown, ...keys: string[]): unknown {
  let current: unknown = data;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    const obj = current as Record<string, unknown>;
    const found = Object.keys(obj).find((k) => normalizeKey(k) === normalizeKey(key));
    current = found ? obj[found] : undefined;
  }
  return current;
}

function parseNumeric(text: string | null | undefined): { value: number | null; unit: string; year: number | null; note: string } {
  if (!text) return { value: null, unit: "", year: null, note: "" };
  let note = "";
  const yearMatch = text.match(/\((\d{4})\s*(?:est\.?|census)?\)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  if (yearMatch) note = yearMatch[0];
  let cleaned = text.replace(/\(.*?\)/g, "").trim();
  let unit = "";
  if (cleaned.startsWith("$")) { unit = "$"; cleaned = cleaned.slice(1).trim(); }
  if (cleaned.endsWith("%")) { unit = "%"; cleaned = cleaned.replace(/%$/, "").trim(); }
  cleaned = cleaned.replace(/,/g, "");
  let multiplier = 1;
  if (/trillion/i.test(cleaned)) { multiplier = 1e12; cleaned = cleaned.replace(/\s*trillion/i, ""); }
  else if (/billion/i.test(cleaned)) { multiplier = 1e9; cleaned = cleaned.replace(/\s*billion/i, ""); }
  else if (/million/i.test(cleaned)) { multiplier = 1e6; cleaned = cleaned.replace(/\s*million/i, ""); }
  const numMatch = cleaned.match(/-?[\d.]+/);
  const value = numMatch ? parseFloat(numMatch[0]) * multiplier : null;
  return { value, unit, year, note };
}

// ───────────────────────────────────────────────────────────────
// Main runner.
// ───────────────────────────────────────────────────────────────

interface UpdateRow {
  jurisdictionId: string;
  slug: string;
  iso3: string | null;
  factKey: string;
  newValue: string | null;
  newNumeric: number | null;
  newUnit: string;
  newYear: number | null;
  newSourceNote: string;
}

async function run() {
  console.log(`\n=== Bug 3 targeted re-seed${DRY_RUN ? " (DRY RUN)" : ""} ===`);

  // Step 1: pre-flight — F.5.1 invariant audit. Are there any
  // open or resolved disputes touching languages / official_languages
  // / exports_total / imports_total? If so, document them; the
  // re-seed below skips status != 'active' anyway.
  console.log("\n[1] F.5.1 invariant: dispute scan on affected fact-keys...");
  const disputes = await db
    .select({
      id: dataDisputes.id,
      jurisdictionId: dataDisputes.jurisdictionId,
      factKey: dataDisputes.factKey,
      status: dataDisputes.status,
      disputeKind: dataDisputes.disputeKind,
    })
    .from(dataDisputes)
    .where(
      sql`${dataDisputes.factKey} IN ('languages', 'official_languages', 'exports_total', 'imports_total')`,
    );
  console.log(`    Disputes found: ${disputes.length}`);
  for (const d of disputes) {
    console.log(`      [${d.status}] ${d.factKey} jurisdiction=${d.jurisdictionId} kind=${d.disputeKind}`);
  }

  // Step 2: pull all CIA people_and_society + economy sections.
  console.log("\n[2] Loading country_factbook_sections...");
  const peopleSections = await db
    .select({
      jurisdictionId: countryFactbookSections.jurisdictionId,
      sectionData: countryFactbookSections.sectionData,
    })
    .from(countryFactbookSections)
    .where(eq(countryFactbookSections.sectionName, "people_and_society"));
  const economySections = await db
    .select({
      jurisdictionId: countryFactbookSections.jurisdictionId,
      sectionData: countryFactbookSections.sectionData,
    })
    .from(countryFactbookSections)
    .where(eq(countryFactbookSections.sectionName, "economy"));
  console.log(`    people_and_society sections: ${peopleSections.length}`);
  console.log(`    economy sections: ${economySections.length}`);

  // Step 3: Load all jurisdictions for slug/iso3 lookups.
  const allJurisdictions = await db
    .select({ id: jurisdictions.id, slug: jurisdictions.slug, iso3: jurisdictions.iso3 })
    .from(jurisdictions);
  const jById = new Map(allJurisdictions.map((j) => [j.id, j]));

  // Step 4: re-extract languages from people_and_society.
  console.log("\n[3] Re-extracting `languages`...");
  const languageUpdates: UpdateRow[] = [];
  let nullCount = 0;
  let extractedCount = 0;
  const stillNullJurisdictions: { slug: string; iso3: string | null }[] = [];

  for (const sec of peopleSections) {
    const j = jById.get(sec.jurisdictionId);
    if (!j) continue;
    const data = sec.sectionData as Record<string, unknown>;
    // Wrapped-then-flat shape probe (mirrors seed-from-factbook.ts fix).
    const wrapped = getNestedValue(data, "Languages", "Languages");
    const flat = getNestedValue(data, "Languages");
    const text = extractText(wrapped) ?? extractText(flat);
    if (!text) {
      nullCount++;
      stillNullJurisdictions.push({ slug: j.slug, iso3: j.iso3 });
      continue;
    }
    extractedCount++;
    const parsed = parseNumeric(text);
    languageUpdates.push({
      jurisdictionId: j.id,
      slug: j.slug,
      iso3: j.iso3,
      factKey: "languages",
      newValue: text,
      newNumeric: parsed.value,
      newUnit: parsed.unit,
      newYear: parsed.year,
      newSourceNote: parsed.note,
    });
  }
  console.log(`    Extracted: ${extractedCount}`);
  console.log(`    Still null (no Languages in prose): ${nullCount}`);

  // Step 5: investigate the still-null jurisdictions.
  console.log("\n[4] OQ4 investigation: jurisdictions with people_and_society but no extractable Languages...");
  for (const stillNull of stillNullJurisdictions) {
    // Read the actual prose to confirm.
    const sec = peopleSections.find((s) => jById.get(s.jurisdictionId)?.slug === stillNull.slug);
    if (!sec) continue;
    const data = sec.sectionData as Record<string, unknown>;
    const langField = (data as Record<string, unknown>)["Languages"];
    const hasField = "Languages" in data;
    const fieldType = langField === null ? "null" : typeof langField;
    let langKeys: string[] = [];
    if (langField && typeof langField === "object") {
      langKeys = Object.keys(langField as Record<string, unknown>);
    }
    console.log(
      `    ${stillNull.iso3 ?? "---"} ${stillNull.slug}: hasField=${hasField}, type=${fieldType}, keys=${JSON.stringify(langKeys)}`,
    );
  }

  // Step 6: re-extract exports_total / imports_total from economy.
  console.log("\n[5] Re-extracting `exports_total` / `imports_total`...");
  const tradeUpdates: UpdateRow[] = [];
  for (const sec of economySections) {
    const j = jById.get(sec.jurisdictionId);
    if (!j) continue;
    const data = sec.sectionData as Record<string, unknown>;
    for (const [key, factKey] of [
      ["Exports", "exports_total"],
      ["Imports", "imports_total"],
    ] as const) {
      const obj = getNestedValue(data, key);
      if (!obj || typeof obj !== "object") continue;
      const entries = Object.entries(obj as Record<string, unknown>).filter(([k]) => k !== "note");
      if (entries.length === 0) continue;
      const text = extractText(entries[0][1]);
      if (!text) continue; // rare — extractText now returns null when no `text` descendant
      const parsed = parseNumeric(text);
      tradeUpdates.push({
        jurisdictionId: j.id,
        slug: j.slug,
        iso3: j.iso3,
        factKey,
        newValue: text,
        newNumeric: parsed.value,
        newUnit: parsed.unit,
        newYear: parsed.year,
        newSourceNote: parsed.note,
      });
    }
  }
  console.log(`    Trade rows refreshed: ${tradeUpdates.length}`);

  // Step 7: write updates to country_facts.
  console.log(`\n[6] Writing country_facts updates (${DRY_RUN ? "DRY RUN" : "LIVE"})...`);
  let writes = 0;
  let skippedDemoted = 0;
  const now = new Date();
  const allUpdates = [...languageUpdates, ...tradeUpdates];
  for (const u of allUpdates) {
    if (DRY_RUN) {
      writes++;
      continue;
    }
    // Honour F.5.1 invariant: only update active rows. Demoted /
    // rejected rows survive untouched.
    const result = await db
      .update(countryFacts)
      .set({
        factValue: u.newValue ?? "",
        factValueNumeric: u.newNumeric,
        factUnit: u.newUnit,
        factYear: u.newYear,
        sourceNote: u.newSourceNote,
        retrievedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(countryFacts.jurisdictionId, u.jurisdictionId),
          eq(countryFacts.factKey, u.factKey),
          eq(countryFacts.sourceId, "cia_factbook"),
          eq(countryFacts.status, "active"),
        ),
      )
      .returning({ id: countryFacts.id });
    if (result.length === 0) {
      // Row did not exist OR was non-active. Distinguish via a probe.
      const probe = await db
        .select({ id: countryFacts.id, status: countryFacts.status })
        .from(countryFacts)
        .where(
          and(
            eq(countryFacts.jurisdictionId, u.jurisdictionId),
            eq(countryFacts.factKey, u.factKey),
            eq(countryFacts.sourceId, "cia_factbook"),
          ),
        )
        .limit(1);
      if (probe.length > 0 && probe[0].status !== "active") {
        skippedDemoted++;
        continue;
      }
      // No row exists; insert. (Edge case: a jurisdiction that had
      // no CIA-sourced row before — unusual but possible.)
      await db.insert(countryFacts).values({
        jurisdictionId: u.jurisdictionId,
        sourceId: "cia_factbook",
        category: u.factKey === "languages" ? "demographics" : "economy",
        factKey: u.factKey,
        factGroup: u.factKey === "languages" ? "C" : "B",
        factValue: u.newValue ?? "",
        factValueNumeric: u.newNumeric,
        factUnit: u.newUnit,
        factYear: u.newYear,
        sourceNote: u.newSourceNote,
        retrievedAt: now,
      });
      writes++;
    } else {
      writes++;
    }
  }
  console.log(`    Updated rows: ${writes}`);
  console.log(`    Skipped (status != 'active'): ${skippedDemoted}`);

  // Step 8: clear corrupt jurisdictions.languages cache (will be
  // rebuilt by refresh-jurisdiction-cache from the canonical
  // official_languages row after the bridge runs). Also clear
  // the 218 corrupt jurisdictions.currency cells per OQ2.
  console.log(`\n[7] Cache cleanup (${DRY_RUN ? "DRY RUN" : "LIVE"})...`);
  if (DRY_RUN) {
    const probeLangCorrupt = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(eq(jurisdictions.languages, "[object Object]"));
    console.log(`    [dry] would clear jurisdictions.languages on ${probeLangCorrupt.length} rows`);
    const probeCurrency = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(sql`${jurisdictions.currency} LIKE '%per US dollar%'`);
    console.log(`    [dry] would null jurisdictions.currency on ${probeCurrency.length} rows`);
  } else {
    // Set the 139 corrupt language cells to null. The cache
    // refresher (npm run refresh:jurisdiction-cache) will repopulate
    // them from the canonical `official_languages` row after the
    // bridge runs.
    const langCacheCleared = await db
      .update(jurisdictions)
      .set({ languages: null, updatedAt: new Date() })
      .where(eq(jurisdictions.languages, "[object Object]"))
      .returning({ id: jurisdictions.id });
    console.log(`    Cleared jurisdictions.languages on ${langCacheCleared.length} rows`);

    // Set the 218 exchange-rate currency cells to null. Per OQ2,
    // currency_code is canonically deferred to WB sync. The atlas
    // formatCurrency helper degrades gracefully to "—" on null.
    const currencyCleared = await db
      .update(jurisdictions)
      .set({ currency: null, updatedAt: new Date() })
      .where(sql`${jurisdictions.currency} LIKE '%per US dollar%'`)
      .returning({ id: jurisdictions.id });
    console.log(`    Cleared jurisdictions.currency (exchange-rate text) on ${currencyCleared.length} rows`);
  }

  // Step 9: Stamp source last_sync_at — the seed script does this
  // at end of full re-seed; targeted re-seed similarly stamps.
  console.log("\n[8] Stamping cia_factbook source.last_sync_at...");
  if (!DRY_RUN) {
    await sqlClient`
      UPDATE sources SET last_sync_at = NOW() WHERE id = 'cia_factbook'
    `;
    console.log("    Stamped.");
  } else {
    console.log("    [dry] would stamp cia_factbook last_sync_at.");
  }

  console.log("\n=== Re-seed complete ===");
  console.log(`Languages refreshed: ${languageUpdates.length} (still-null: ${nullCount})`);
  console.log(`Trade rows refreshed: ${tradeUpdates.length}`);
  console.log(`Total writes: ${writes}`);
  console.log(`F.5.1 demoted skips: ${skippedDemoted}`);

  console.log("\nNext steps:");
  console.log("  1. Run: npm run bridge:cia-canonical");
  console.log("     (propagates fixed `languages` rows into `official_languages`)");
  console.log("  2. Run: npm run refresh:jurisdiction-cache");
  console.log("     (rebuilds `jurisdictions.languages` cache from canonical row)");
}

run().catch((err) => {
  console.error("Re-seed failed:", err);
  process.exit(1);
});
