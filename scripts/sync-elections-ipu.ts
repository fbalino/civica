/**
 * sync-elections-ipu — populate the `elections` + `election_results` tables
 * with per-chamber most-recent legislative elections from IPU Parline.
 *
 * This is the elections-calendar sibling of `sync-ipu-parline.ts` (which only
 * populates *current* `legislature_parties` composition). It reuses the same
 * IPU JSON:API endpoints, the same 200-300ms self-throttle, and the same
 * `markSourcesSynced("ipu_parline", …)` freshness discipline.
 *
 * What it writes, per IPU chamber that resolves to a Civica `government_bodies`
 * row (matched on `ipu_parline_id = chamber_code`):
 *   - one `elections` row for the chamber's `last_election` date, keyed
 *     idempotently on (jurisdictionId, bodyId, electionDate). electionType is
 *     always "legislative" (IPU is a union of parliaments — no presidential
 *     concept). dateConfidence is "confirmed" (an IPU-published date, never a
 *     projection). electoralSystem is the human display label for IPU's own
 *     verbatim subtype/family term (via IPU_SUBTYPE_LABEL / IPU_FAMILY_LABEL —
 *     the same 1:1 mapping /elections/systems uses).
 *   - `election_results` rows from the same `seats_per_parties` payload the
 *     legislature sync already fetches (currently discarded after populating
 *     current composition). Seats only — IPU carries no vote-share on the
 *     election record and no turnout at all.
 *   - a `statements` provenance row per election (subjectTable "elections",
 *     predicate "ipu_last_election"), mirroring the existing seats_per_parties
 *     provenance write.
 *
 * ESTIMATED NEXT ELECTION (owner-adopted in elections round 2): in addition to
 * the confirmed past-date rows, this sync derives a Civica-computed "next
 * election due" row per chamber from `last_election + parliamentary_term` years
 * (IPU carries the term length but NOT a next-election date). These rows carry
 * `dateConfidence = "estimated"` and are visually distinguished on the page
 * (muted, with an InfoTip disclosing they are a Civica projection, not a
 * source-confirmed date). An estimate is written ONLY when it lands in the
 * future AND no source-confirmed upcoming election already exists for that
 * jurisdiction — a real scheduled date always wins. Estimates never carry
 * results and are excluded from the "Recent Results" section by the query
 * layer. Suppress them with --no-estimates. See resolution §3, §6.1 (the
 * earlier "Q2 deferred / no estimates" posture is now superseded by the owner's
 * round-2 adoption).
 *
 * Turnout is still NOT ingested here — that is `sync-elections-turnout-idea.ts`.
 *
 * Idempotent: re-running matches existing (jurisdictionId, bodyId,
 * electionDate) rows and updates them in place; result rows for a matched
 * election are replaced deterministically. The single estimated row per
 * (jurisdictionId, bodyId) is replaced deterministically each run. Existing
 * hand-seeded rows (bodyId NULL) are never touched — they collide on neither key.
 *
 * Flags: --dry-run (read-only preview, writes nothing, never stamps freshness),
 *        --limit N (process only the first N chambers — for quick sampling),
 *        --no-estimates (skip the estimated-next-election derivation).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  jurisdictions,
  governmentBodies,
  elections,
  electionResults,
  statements,
} from "../src/lib/db/schema";
import { markSourcesSynced } from "../src/lib/db/source-freshness";
import {
  IPU_SUBTYPE_LABEL,
  IPU_FAMILY_LABEL,
} from "../src/lib/elections/electoral-systems";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

const IPU_BASE = "https://api.data.ipu.org/v1";
const PAGE_SIZE = 50;
const SOURCE_ID = "ipu_parline";
const SOURCE_LICENSE = "CC-BY-NC-SA-4.0";
const RETRIEVED_AT = new Date();

const DRY_RUN = process.argv.includes("--dry-run");
const NO_ESTIMATES = process.argv.includes("--no-estimates");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i !== -1 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
})();

interface IpuValue<T> {
  value: T;
  date_from?: string;
  date_to?: string;
  missing_reason?: string;
}

interface IpuChamber {
  type: string;
  id: string;
  attributes: {
    chamber_code: IpuValue<string>;
    chamber_name: IpuValue<{ en: string; fr: string }>;
    parliament: IpuValue<string>;
    last_election: IpuValue<{ from: string }>;
    /** Term length in years — an array of dated values; we take the latest. */
    parliamentary_term?: IpuValue<number> | IpuValue<number>[];
    electoral_system: IpuValue<{ term: string }> | IpuValue<{ term: string }>[];
    electoral_subsystem:
      | IpuValue<{ term: string }>
      | IpuValue<{ term: string }>[];
    [key: string]: unknown;
  };
}

interface IpuPartyResult {
  party: string;
  total_number_of_seats: number;
  vote_breakdown: Array<{ label: { en: string }; value: number }>;
}

interface IpuElection {
  type: string;
  id: string;
  attributes: {
    seats_per_parties: IpuValue<IpuPartyResult[]>;
    chamber: IpuValue<string>;
    election_date: IpuValue<{ from: string }>;
    [key: string]: unknown;
  };
}

interface IpuParty {
  political_party_code: string;
  party_name: { en: string; fr: string };
  political_party_country: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ipuFetch<T>(path: string): Promise<T> {
  const url = `${IPU_BASE}${path}`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`IPU API ${resp.status}: ${url}`);
  return resp.json() as Promise<T>;
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let total = Infinity;
  while (items.length < total) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await ipuFetch<{ meta: { total: number }; data: T[] }>(
      `${path}${sep}page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`
    );
    total = data.meta.total;
    const pageItems = data.data;
    if (!pageItems || pageItems.length === 0) break;
    items.push(...pageItems);
    page++;
    await sleep(300);
  }
  return items;
}

function extractLatestValue<T>(
  field: IpuValue<T> | IpuValue<T>[] | undefined
): T | null {
  if (!field) return null;
  if (Array.isArray(field)) {
    const last = field[field.length - 1];
    return last?.value ?? null;
  }
  return (field as IpuValue<T>).value ?? null;
}

/** ISO date (yyyy-mm-dd) for a `date` column, from an IPU datetime string. */
function toIsoDate(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10);
}

/**
 * Seat count for a party result. Prefers the "Full composition" line from the
 * `vote_breakdown` array (used for partial renewals like a Senate), else the
 * headline `total_number_of_seats`. `vote_breakdown` is sometimes null/absent
 * on the IPU payload, so guard it.
 */
function seatsForParty(r: IpuPartyResult): number {
  const fullComp = Array.isArray(r.vote_breakdown)
    ? r.vote_breakdown.find((vb) => vb.label?.en === "Full composition")
    : undefined;
  return fullComp ? fullComp.value : r.total_number_of_seats ?? 0;
}

function electionIdFromChamberAndDate(
  chamberCode: string,
  dateStr: string
): string {
  const d = new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${chamberCode}-E${yyyy}${mm}${dd}`;
}

/**
 * Display label for the chamber's electoral system, from IPU's own verbatim
 * subtype/family terms (the 1:1 map /elections/systems already uses). Prefers
 * the more-specific subtype; falls back to the family; null when unclassified.
 */
function electoralSystemLabel(
  family: string | null,
  subsystem: string | null
): string | null {
  if (subsystem && IPU_SUBTYPE_LABEL[subsystem]) return IPU_SUBTYPE_LABEL[subsystem];
  if (family && IPU_FAMILY_LABEL[family]) return IPU_FAMILY_LABEL[family];
  return null;
}

async function main() {
  console.log("=== IPU Parline Elections Sync ===");
  console.log(
    `mode: ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY"}${
      LIMIT ? `, limit ${LIMIT} chambers` : ""
    }\n`
  );

  // 1. Party name lookup (same as sync-ipu-parline). ~2,900 parties is the
  //    slowest fetch; skip it on a limited dry-run (a preview only needs party
  //    counts, not names). A real apply always loads names so result rows carry
  //    readable party labels.
  const partyNames = new Map<string, string>();
  if (!(DRY_RUN && LIMIT)) {
    console.log("Fetching political parties for name lookup...");
    const allParties = await fetchAllPages<IpuParty>("/political_parties");
    for (const p of allParties) partyNames.set(p.political_party_code, p.party_name.en);
    console.log(`  Loaded ${partyNames.size} party names\n`);
  } else {
    console.log("Skipping party-name prefetch (limited dry run)\n");
  }

  // 2. All chambers.
  console.log("Fetching chambers...");
  let allChambers = await fetchAllPages<IpuChamber>("/chambers");
  console.log(`  Found ${allChambers.length} chambers\n`);
  if (LIMIT) allChambers = allChambers.slice(0, LIMIT);

  // 3. Resolve chambers to existing government_bodies rows via ipu_parline_id.
  //    sync-ipu-parline already populated these (280 bodies / 193 countries).
  const bodyRows = await db
    .select({
      bodyId: governmentBodies.id,
      ipuParlineId: governmentBodies.ipuParlineId,
      jurisdictionId: governmentBodies.jurisdictionId,
      country: jurisdictions.name,
      slug: jurisdictions.slug,
    })
    .from(governmentBodies)
    .innerJoin(
      jurisdictions,
      eq(governmentBodies.jurisdictionId, jurisdictions.id)
    )
    .where(sql`${governmentBodies.ipuParlineId} IS NOT NULL`);
  const bodyByChamberCode = new Map(
    bodyRows.map((b) => [b.ipuParlineId!, b])
  );
  console.log(`  Loaded ${bodyByChamberCode.size} IPU-linked government bodies\n`);

  let electionsUpserted = 0;
  let electionsInserted = 0;
  let electionsUpdated = 0;
  let resultsWritten = 0;
  let chambersNoDate = 0;
  let chambersNoBody = 0;
  let electionsFailed = 0;
  const samples: string[] = [];

  // Collected during the main loop, consumed by the estimated-next-election
  // pass below: one entry per chamber that has BOTH a last_election date and a
  // parliamentary_term. Deduped by bodyId (a body maps to exactly one chamber).
  const estimateInputs = new Map<
    string,
    {
      jurisdictionId: string;
      bodyId: string;
      country: string;
      chamberName: string;
      lastElectionDate: string;
      termYears: number;
      systemLabel: string | null;
    }
  >();

  for (const chamber of allChambers) {
    const chamberCode = extractLatestValue(chamber.attributes.chamber_code);
    const chamberNameObj = extractLatestValue(chamber.attributes.chamber_name);
    const chamberName = chamberNameObj?.en ?? chamber.id;
    const lastElectionObj = extractLatestValue(chamber.attributes.last_election);

    const family =
      extractLatestValue(chamber.attributes.electoral_system)?.term ?? null;
    const subsystem =
      extractLatestValue(chamber.attributes.electoral_subsystem)?.term ?? null;
    const systemLabel = electoralSystemLabel(family, subsystem);

    if (!chamberCode) continue;
    const body = bodyByChamberCode.get(chamberCode);
    if (!body) {
      chambersNoBody++;
      continue;
    }
    if (!lastElectionObj?.from) {
      chambersNoDate++;
      continue;
    }

    const electionDate = toIsoDate(lastElectionObj.from);
    const electionName = `${new Date(electionDate).getUTCFullYear()} ${chamberName} election`;
    const ipuElectionId = electionIdFromChamberAndDate(chamberCode, lastElectionObj.from);
    const sourceUrl = `${IPU_BASE}/elections/${ipuElectionId}`;

    // Record term length for the estimated-next-election pass (owner-adopted).
    // `parliamentary_term` is a dated array; take the latest positive integer.
    const termYears = extractLatestValue(chamber.attributes.parliamentary_term);
    if (!NO_ESTIMATES && typeof termYears === "number" && termYears > 0) {
      estimateInputs.set(body.bodyId, {
        jurisdictionId: body.jurisdictionId,
        bodyId: body.bodyId,
        country: body.country,
        chamberName,
        lastElectionDate: electionDate,
        termYears,
        systemLabel,
      });
    }

    // Fetch party seat results for this election (same call as the legislature
    // sync). If the election record is missing we still upsert the date row.
    let partyResults: IpuPartyResult[] | null = null;
    try {
      const electionData = await ipuFetch<{ data: IpuElection }>(
        `/elections/${ipuElectionId}`
      );
      partyResults = extractLatestValue(
        electionData.data.attributes.seats_per_parties
      );
    } catch {
      electionsFailed++;
    }

    if (DRY_RUN) {
      electionsUpserted++;
      if (partyResults) resultsWritten += partyResults.length;
      if (samples.length < 12) {
        samples.push(
          `  ${body.country} · ${chamberName} · ${electionDate} · ${
            systemLabel ?? "(unclassified)"
          } · ${partyResults?.length ?? 0} parties`
        );
      }
      await sleep(200);
      continue;
    }

    // Upsert the elections row, keyed idempotently on (jurisdiction, body, date).
    const existing = await db
      .select({ id: elections.id })
      .from(elections)
      .where(
        and(
          eq(elections.jurisdictionId, body.jurisdictionId),
          eq(elections.bodyId, body.bodyId),
          eq(elections.electionDate, electionDate)
        )
      )
      .limit(1);

    let electionRowId: string;
    if (existing.length > 0) {
      electionRowId = existing[0].id;
      await db
        .update(elections)
        .set({
          electionType: "legislative",
          electionName,
          electoralSystem: systemLabel,
          dateConfidence: "confirmed",
        })
        .where(eq(elections.id, electionRowId));
      electionsUpdated++;
    } else {
      const inserted = await db
        .insert(elections)
        .values({
          jurisdictionId: body.jurisdictionId,
          bodyId: body.bodyId,
          electionDate,
          electionType: "legislative",
          electionName,
          electoralSystem: systemLabel,
          dateConfidence: "confirmed",
        })
        .returning({ id: elections.id });
      electionRowId = inserted[0].id;
      electionsInserted++;
    }
    electionsUpserted++;

    // Replace this election's result rows deterministically from IPU seats.
    if (partyResults && partyResults.length > 0) {
      await db
        .delete(electionResults)
        .where(eq(electionResults.electionId, electionRowId));

      const totalSeats = partyResults.reduce(
        (sum, r) => sum + seatsForParty(r),
        0
      );

      // Winner = the single largest party (plurality). Seats only — IPU carries
      // no vote share on the election record.
      let maxSeats = -1;
      for (const r of partyResults) {
        const seats = seatsForParty(r);
        if (seats > maxSeats) maxSeats = seats;
      }

      let winnerAssigned = false;
      for (const r of partyResults) {
        const partyName = partyNames.get(r.party) ?? r.party;
        const seats = seatsForParty(r);
        if (seats <= 0) continue;
        const isWinner = !winnerAssigned && seats === maxSeats;
        if (isWinner) winnerAssigned = true;
        await db.insert(electionResults).values({
          electionId: electionRowId,
          partyName,
          seatsWon: seats,
          // Derive a seat-share % so the results bar renders (IPU has no vote %).
          votesPercent:
            totalSeats > 0 ? Math.round((seats / totalSeats) * 1000) / 10 : null,
          isWinner,
        });
        resultsWritten++;
      }
    }

    // Provenance: one statement per election (subjectTable "elections").
    const existingStmt = await db
      .select({ id: statements.id })
      .from(statements)
      .where(
        and(
          eq(statements.subjectTable, "elections"),
          eq(statements.subjectId, electionRowId),
          eq(statements.predicate, "ipu_last_election")
        )
      )
      .limit(1);
    const stmtValue = JSON.stringify({
      election_date: electionDate,
      electoral_system: subsystem ?? family,
      seats_per_parties: partyResults ?? [],
    });
    if (existingStmt.length > 0) {
      await db
        .update(statements)
        .set({
          objectValue: stmtValue,
          sourceId: SOURCE_ID,
          sourceUrl,
          sourceLicense: SOURCE_LICENSE,
          retrievedAt: RETRIEVED_AT,
        })
        .where(eq(statements.id, existingStmt[0].id));
    } else {
      await db.insert(statements).values({
        subjectTable: "elections",
        subjectId: electionRowId,
        predicate: "ipu_last_election",
        objectValue: stmtValue,
        sourceId: SOURCE_ID,
        sourceUrl,
        sourceLicense: SOURCE_LICENSE,
        retrievedAt: RETRIEVED_AT,
        confidence: 1.0,
      });
    }

    if (samples.length < 12) {
      samples.push(
        `  ${body.country} · ${chamberName} · ${electionDate} · ${
          systemLabel ?? "(unclassified)"
        } · ${partyResults?.length ?? 0} parties`
      );
    }
    if (electionsUpserted % 25 === 0) {
      console.log(`  Progress: ${electionsUpserted} elections upserted...`);
    }
    await sleep(200);
  }

  // ── Estimated next election (owner-adopted) ────────────────────────────────
  // For each chamber with last_election + parliamentary_term, project the next
  // due date. Write it as dateConfidence="estimated" ONLY when it is in the
  // future AND no SOURCE-CONFIRMED upcoming election already exists for that
  // jurisdiction (a real scheduled date always wins — no double calendar entry).
  // One estimated row per (jurisdictionId, bodyId): replaced deterministically
  // each run, so re-runs never duplicate.
  let estimatesWritten = 0;
  let estimatesSkippedPast = 0;
  let estimatesSkippedConfirmed = 0;
  const estimateSamples: string[] = [];
  const todayIso = RETRIEVED_AT.toISOString().slice(0, 10);

  if (!NO_ESTIMATES) {
    for (const est of estimateInputs.values()) {
      // last_election + term years, same month/day.
      const base = new Date(`${est.lastElectionDate}T00:00:00Z`);
      const projected = new Date(base);
      projected.setUTCFullYear(projected.getUTCFullYear() + est.termYears);
      const estimatedDate = projected.toISOString().slice(0, 10);

      // Only a FUTURE estimate is useful (a past-due estimate is just noise).
      if (estimatedDate <= todayIso) {
        estimatesSkippedPast++;
        continue;
      }

      // Any REAL (non-estimated) upcoming legislative/general election for this
      // jurisdiction supersedes the projection — a dated source row always wins
      // over a term-length estimate, even a Wikidata row whose dateConfidence is
      // null. Only our own "estimated" rows are ignored here (so the estimate
      // can replace its own prior projection on re-run).
      const confirmedFuture = await db
        .select({ id: elections.id })
        .from(elections)
        .where(
          and(
            eq(elections.jurisdictionId, est.jurisdictionId),
            sql`${elections.electionDate} >= CURRENT_DATE`,
            sql`${elections.dateConfidence} IS DISTINCT FROM 'estimated'`,
            sql`LOWER(${elections.electionType}) IN ('legislative', 'general')`
          )
        )
        .limit(1);
      if (confirmedFuture.length > 0) {
        estimatesSkippedConfirmed++;
        // Clean up a now-superseded estimate we may have written on a prior run.
        if (!DRY_RUN) {
          await db
            .delete(elections)
            .where(
              and(
                eq(elections.jurisdictionId, est.jurisdictionId),
                eq(elections.bodyId, est.bodyId),
                eq(elections.dateConfidence, "estimated")
              )
            );
        }
        continue;
      }

      if (estimateSamples.length < 10) {
        estimateSamples.push(
          `  ${est.country} · ${est.chamberName} · last ${est.lastElectionDate} + ${est.termYears}y → est. ${estimatedDate}`
        );
      }

      if (DRY_RUN) {
        estimatesWritten++;
        continue;
      }

      const estimatedName = `Next ${est.chamberName} election (estimated)`;
      // Idempotent: match the single estimated row for this (jurisdiction, body).
      const existingEst = await db
        .select({ id: elections.id })
        .from(elections)
        .where(
          and(
            eq(elections.jurisdictionId, est.jurisdictionId),
            eq(elections.bodyId, est.bodyId),
            eq(elections.dateConfidence, "estimated")
          )
        )
        .limit(1);

      let estRowId: string;
      if (existingEst.length > 0) {
        estRowId = existingEst[0].id;
        await db
          .update(elections)
          .set({
            electionDate: estimatedDate,
            electionType: "legislative",
            electionName: estimatedName,
            electoralSystem: est.systemLabel,
            dateConfidence: "estimated",
          })
          .where(eq(elections.id, estRowId));
      } else {
        const ins = await db
          .insert(elections)
          .values({
            jurisdictionId: est.jurisdictionId,
            bodyId: est.bodyId,
            electionDate: estimatedDate,
            electionType: "legislative",
            electionName: estimatedName,
            electoralSystem: est.systemLabel,
            dateConfidence: "estimated",
          })
          .returning({ id: elections.id });
        estRowId = ins[0].id;
      }
      estimatesWritten++;

      // Provenance: the estimate derives from IPU's own last_election + term,
      // but is a Civica computation — record it as such (predicate makes the
      // derivation explicit; it is NOT an IPU-asserted next date).
      const estStmtValue = JSON.stringify({
        derived_from: "ipu last_election + parliamentary_term",
        last_election: est.lastElectionDate,
        parliamentary_term_years: est.termYears,
        estimated_next_election: estimatedDate,
        note: "Civica-computed estimate, not a source-confirmed date.",
      });
      const existingEstStmt = await db
        .select({ id: statements.id })
        .from(statements)
        .where(
          and(
            eq(statements.subjectTable, "elections"),
            eq(statements.subjectId, estRowId),
            eq(statements.predicate, "civica_estimated_next_election")
          )
        )
        .limit(1);
      if (existingEstStmt.length > 0) {
        await db
          .update(statements)
          .set({
            objectValue: estStmtValue,
            sourceId: SOURCE_ID,
            sourceUrl: `${IPU_BASE}/chambers`,
            sourceLicense: SOURCE_LICENSE,
            retrievedAt: RETRIEVED_AT,
          })
          .where(eq(statements.id, existingEstStmt[0].id));
      } else {
        await db.insert(statements).values({
          subjectTable: "elections",
          subjectId: estRowId,
          predicate: "civica_estimated_next_election",
          objectValue: estStmtValue,
          sourceId: SOURCE_ID,
          sourceUrl: `${IPU_BASE}/chambers`,
          sourceLicense: SOURCE_LICENSE,
          retrievedAt: RETRIEVED_AT,
          confidence: 0.5,
        });
      }
    }
  }

  // Freshness — single sanctioned path, only on a non-dry-run that wrote rows.
  const stamped = await markSourcesSynced(SOURCE_ID, {
    rowsWritten: DRY_RUN ? 0 : electionsUpserted + estimatesWritten,
    at: RETRIEVED_AT,
  });

  console.log(`\n=== IPU Elections Sync Complete ===`);
  console.log(`  Elections upserted:   ${electionsUpserted}`);
  if (!DRY_RUN) {
    console.log(`    · inserted:         ${electionsInserted}`);
    console.log(`    · updated:          ${electionsUpdated}`);
  }
  console.log(`  Result rows written:  ${resultsWritten}`);
  console.log(`  Chambers no date:     ${chambersNoDate}`);
  console.log(`  Chambers no body:     ${chambersNoBody}`);
  console.log(`  Election records 404: ${electionsFailed}`);
  if (!NO_ESTIMATES) {
    console.log(`  Estimated next rows:  ${estimatesWritten}`);
    console.log(`    · skipped (past-due):        ${estimatesSkippedPast}`);
    console.log(`    · skipped (confirmed wins):  ${estimatesSkippedConfirmed}`);
  }
  console.log(`  Freshness stamped:    ${stamped.length > 0 ? "yes" : "no"}`);
  console.log(`\nSample:`);
  for (const s of samples) console.log(s);
  if (!NO_ESTIMATES && estimateSamples.length > 0) {
    console.log(`\nEstimated next elections:`);
    for (const s of estimateSamples) console.log(s);
  }
}

main().catch((err) => {
  console.error("IPU elections sync failed:", err);
  process.exit(1);
});
