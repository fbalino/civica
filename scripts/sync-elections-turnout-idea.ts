/**
 * sync-elections-turnout-idea — match International IDEA voter-turnout figures
 * onto Civica's existing `elections` rows.
 *
 * International IDEA's Voter Turnout Database is the most comprehensive global
 * collection of presidential + parliamentary turnout since 1945 (resolution
 * §2c). It has no public JSON API, but the site serves a bulk .xlsx export of
 * every country/election in one file:
 *
 *   https://www.idea.int/data-tools/export?type=region_only&themeId=293&world=all
 *
 * License: CC BY-NC-SA 4.0 (https://www.idea.int/creative-commons-licence) —
 * attribution required, NON-COMMERCIAL only. Same license class as ipu_parline,
 * accepted per the owner-adopted resolution Q1 (Civica is a non-commercial,
 * pre-launch reference work).
 *
 * WHAT IT DOES
 *   1. Fetches the bulk .xlsx (or reads a local file via --file for offline runs).
 *   2. Parses it (fflate unzip + regex over the OOXML — no xlsx dependency; every
 *      data cell is a shared-string reference, so this is robust and cheap).
 *   3. Indexes IDEA rows by (ISO2, electionType) and, for each of our PAST
 *      `elections` rows with an ISO2 country, finds the IDEA record for the same
 *      country+type whose date is NEAREST ours, accepting a match only within
 *      MATCH_TOLERANCE_DAYS. (A two-round race can hold its first-round date on
 *      our side while IDEA records a final-round date weeks later, so an exact
 *      date match is too strict; 45 days is the documented window.)
 *   4. Updates `turnout_percent` (and `registered_voters` / `total_valid_votes`
 *      where IDEA reports clean integers) on the matched election. Writes a
 *      per-election `statements` provenance row (subjectTable "elections",
 *      predicate "idea_voter_turnout").
 *   5. Stamps freshness ONLY via markSourcesSynced("international_idea", …) on a
 *      non-dry run that actually wrote rows.
 *
 * IDEMPOTENT: re-running re-matches the same rows and overwrites the same
 * turnout + statement in place; nothing is duplicated. Unmatched elections are
 * left turnout-less (never faked). Hand-seeded turnout values are overwritten
 * only when IDEA has a matching record — a deliberate upgrade to a citable
 * source; the provenance statement records that.
 *
 * MATCH RATE is reported honestly at the end (measured ~54% of past elections
 * at the 45-day window on 2026-07-05 — the unmatched remainder is mostly recent
 * 2025/2026 elections IDEA has not yet recorded, plus presidential rows whose
 * dates don't line up).
 *
 * Flags:
 *   --dry-run     read-only preview; writes nothing, never stamps freshness.
 *   --limit N     process only the first N matched elections (quick sampling).
 *   --file PATH   parse a local .xlsx instead of fetching (offline / CI).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import { unzipSync, strFromU8 } from "fflate";
import { jurisdictions, elections, sources } from "../src/lib/db/schema";
import { markSourcesSynced } from "../src/lib/db/source-freshness";
import { resolveAtlasReleaseId } from "../src/lib/factbook/country-fact-history-writer";
import { updateElectionTurnoutWithHistory } from "../src/lib/elections/writer";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

const SOURCE_ID = "international_idea";
const SOURCE_LICENSE = "CC-BY-NC-SA-4.0";
const SOURCE_PAGE = "https://www.idea.int/data-tools/data/voter-turnout-database";
const EXPORT_URL =
  "https://www.idea.int/data-tools/export?type=region_only&themeId=293&world=all&loc=home";
const RETRIEVED_AT = new Date();

/** A two-round race can span ~4 weeks; 45 days absorbs the round-1/round-2 gap. */
const MATCH_TOLERANCE_DAYS = 45;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const DRY_RUN = process.argv.includes("--dry-run");
const ATLAS_RELEASE_ID = DRY_RUN
  ? null
  : resolveAtlasReleaseId(
      process.argv
        .find((arg) => arg.startsWith("--release-id="))
        ?.slice("--release-id=".length)
    );
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i !== -1 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
})();
const LOCAL_FILE = (() => {
  const i = process.argv.indexOf("--file");
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
})();

interface IdeaRecord {
  iso2: string;
  type: "legislative" | "presidential";
  date: string; // yyyy-mm-dd
  turnoutPercent: number | null;
  totalVote: number | null;
  registration: number | null;
}

/** Decode the small set of XML entities OOXML shared strings can carry. */
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Parse an IDEA numeric cell: strip "%", commas, whitespace. Empty → null. */
function parseNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/%/g, "").replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "N/A" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse the IDEA .xlsx into flat records. The workbook's "All" sheet (sheet1)
 * holds every election; columns are A Country, B ISO2, C ISO3, D Election Type,
 * E Year (a full yyyy-mm-dd date), F Voter Turnout (%), G Total vote, H
 * Registration. Every data cell is a shared-string reference (`t="s"`).
 */
function parseIdeaWorkbook(buf: Buffer | Uint8Array): IdeaRecord[] {
  const files = unzipSync(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const ssFile = files["xl/sharedStrings.xml"];
  const sheetFile = files["xl/worksheets/sheet1.xml"];
  if (!ssFile || !sheetFile) {
    throw new Error(
      "IDEA export missing expected OOXML parts (sharedStrings / sheet1) — export format may have changed."
    );
  }
  const ssXml = strFromU8(ssFile);
  // One <si> per shared string; a string can span multiple <t> runs → join them.
  const sharedStrings = ssXml
    .split(/<si>/)
    .slice(1)
    .map((chunk) =>
      [...chunk.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")
    );

  const sheetXml = strFromU8(sheetFile);
  const records: IdeaRecord[] = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const cellMatch of rowMatch[1].matchAll(
      /<c r="([A-Z]+)\d+"(?:\s+t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g
    )) {
      const col = cellMatch[1];
      const type = cellMatch[2];
      const raw = cellMatch[3];
      if (raw == null) {
        cells[col] = "";
      } else if (type === "s") {
        cells[col] = decodeXml(sharedStrings[Number(raw)] ?? "");
      } else {
        cells[col] = raw;
      }
    }

    const typeLabel = cells.D;
    const type =
      typeLabel === "Parliamentary"
        ? "legislative"
        : typeLabel === "Presidential"
          ? "presidential"
          : null;
    if (!type) continue; // header row, EU-Parliament rows, or other categories
    const date = cells.E;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue; // year-only or blank dates
    const iso2 = (cells.B || "").toUpperCase();
    if (!iso2) continue;

    records.push({
      iso2,
      type,
      date,
      turnoutPercent: parseNum(cells.F),
      totalVote: parseNum(cells.G),
      registration: parseNum(cells.H),
    });
  }
  return records;
}

async function loadWorkbook(): Promise<Buffer> {
  if (LOCAL_FILE) {
    console.log(`Reading local IDEA export: ${LOCAL_FILE}`);
    return readFileSync(LOCAL_FILE);
  }
  console.log(`Fetching IDEA bulk export…\n  ${EXPORT_URL}`);
  const resp = await fetch(EXPORT_URL, {
    headers: {
      // IDEA's CloudFront edge 403s a bare fetch UA; a browser UA is served.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
    },
  });
  if (!resp.ok) throw new Error(`IDEA export ${resp.status}: ${EXPORT_URL}`);
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

async function main() {
  console.log("=== International IDEA Turnout Sync ===");
  console.log(
    `mode: ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY"}${
      LIMIT ? `, limit ${LIMIT} matches` : ""
    }\n`
  );

  // Defensive source upsert (mirrors the ONS/IBGE sync convention) so a cron
  // deploy without a fresh `seed:sources` run still has the row + license.
  if (!DRY_RUN) {
    await db
      .insert(sources)
      .values({
        id: SOURCE_ID,
        name: "International IDEA Voter Turnout Database",
        baseUrl: SOURCE_PAGE,
        license: SOURCE_LICENSE,
        isCommercialUseAllowed: false,
      })
      .onConflictDoNothing({ target: sources.id });
  }

  const buf = await loadWorkbook();
  const idea = parseIdeaWorkbook(buf);
  console.log(`  Parsed ${idea.length} IDEA turnout records\n`);

  // Index by (ISO2, type) for nearest-date lookup.
  const ideaByKey = new Map<string, IdeaRecord[]>();
  for (const rec of idea) {
    const key = `${rec.iso2}|${rec.type}`;
    const arr = ideaByKey.get(key);
    if (arr) arr.push(rec);
    else ideaByKey.set(key, [rec]);
  }

  // Our PAST elections with an ISO2 country. (Turnout is a past-election fact;
  // upcoming elections have no turnout to match.)
  const ours = await db
    .select({
      id: elections.id,
      iso2: jurisdictions.iso2,
      country: jurisdictions.name,
      type: sql<string>`LOWER(${elections.electionType})`,
      date: sql<string>`${elections.electionDate}::text`,
      existingTurnout: elections.turnoutPercent,
    })
    .from(elections)
    .innerJoin(jurisdictions, eq(elections.jurisdictionId, jurisdictions.id))
    .where(
      sql`${elections.electionDate} < CURRENT_DATE AND ${jurisdictions.iso2} IS NOT NULL AND ${elections.electionType} IS NOT NULL`
    );
  console.log(`  Our past elections with a country ISO2: ${ours.length}\n`);

  let matched = 0;
  let updated = 0;
  let unmatched = 0;
  let noKey = 0;
  const samples: string[] = [];

  for (const e of ours) {
    const key = `${(e.iso2 ?? "").toUpperCase()}|${e.type}`;
    const cands = ideaByKey.get(key);
    if (!cands || cands.length === 0) {
      noKey++;
      unmatched++;
      continue;
    }

    const targetMs = new Date(`${e.date}T00:00:00Z`).getTime();
    let best: IdeaRecord | null = null;
    let bestDiffDays = Infinity;
    for (const c of cands) {
      const diff =
        Math.abs(new Date(`${c.date}T00:00:00Z`).getTime() - targetMs) /
        MS_PER_DAY;
      if (diff < bestDiffDays) {
        bestDiffDays = diff;
        best = c;
      }
    }

    if (!best || bestDiffDays > MATCH_TOLERANCE_DAYS) {
      unmatched++;
      continue;
    }
    if (best.turnoutPercent == null) {
      // A matched record with no turnout figure is not a usable match.
      unmatched++;
      continue;
    }

    matched++;
    if (LIMIT && matched > LIMIT) {
      matched--;
      break;
    }

    if (samples.length < 15) {
      samples.push(
        `  ${e.country} · ${e.type} · ours ${e.date} ↔ IDEA ${best.date} (${Math.round(
          bestDiffDays
        )}d) · turnout ${best.turnoutPercent}%${
          e.existingTurnout != null ? ` (was ${e.existingTurnout}%)` : ""
        }`
      );
    }

    if (DRY_RUN) continue;

    // Update the election. registered_voters / total_valid_votes only when IDEA
    // reports a clean integer (they are integer columns).
    const registeredVoters =
      best.registration != null && Number.isInteger(best.registration)
        ? best.registration
        : null;
    const totalValidVotes =
      best.totalVote != null && Number.isInteger(best.totalVote)
        ? best.totalVote
        : null;

    // Election, provenance, and its bounded ATL-020 history event share one
    // PostgreSQL statement and therefore one commit boundary.
    const stmtValue = JSON.stringify({
      idea_election_date: best.date,
      voter_turnout_percent: best.turnoutPercent,
      total_vote: best.totalVote,
      registration: best.registration,
      matched_within_days: Math.round(bestDiffDays),
    });
    const outcome = await updateElectionTurnoutWithHistory(
      db,
      {
        electionId: e.id,
        turnoutPercent: best.turnoutPercent,
        registeredVoters,
        totalValidVotes,
      },
      {
        predicate: "idea_voter_turnout",
        objectValue: stmtValue,
        sourceId: SOURCE_ID,
        sourceUrl: SOURCE_PAGE,
        sourceLicense: SOURCE_LICENSE,
      },
      {
        changeKind: "routine_refresh",
        reason: "International IDEA voter-turnout refresh",
        methodologyVersion: "elections-turnout-idea/v1",
        releaseId: ATLAS_RELEASE_ID!,
      }
    );
    updated += outcome.updated;
  }

  // Freshness — single sanctioned path, only on a non-dry run that wrote rows.
  const stamped = await markSourcesSynced(SOURCE_ID, {
    rowsWritten: DRY_RUN ? 0 : updated,
    at: RETRIEVED_AT,
  });

  const matchRate = ours.length > 0 ? (matched / ours.length) * 100 : 0;
  console.log(`\n=== IDEA Turnout Sync Complete ===`);
  console.log(`  Matched elections:    ${matched} (${matchRate.toFixed(1)}% of ${ours.length})`);
  if (!DRY_RUN) console.log(`  Turnout rows written: ${updated}`);
  console.log(`  Unmatched:            ${unmatched}`);
  console.log(`    · no ISO2+type in IDEA: ${noKey}`);
  console.log(`  Match tolerance:      ±${MATCH_TOLERANCE_DAYS} days`);
  console.log(`  Freshness stamped:    ${stamped.length > 0 ? "yes" : "no"}`);
  console.log(`\nSample matches:`);
  for (const s of samples) console.log(s);
}

main().catch((err) => {
  console.error("IDEA turnout sync failed:", err);
  process.exit(1);
});
