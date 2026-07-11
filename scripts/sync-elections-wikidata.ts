/**
 * sync-elections-wikidata — populate the `elections` table with national
 * presidential elections (past + future) and source-CONFIRMED future national
 * legislative/general elections, from Wikidata SPARQL.
 *
 * Wikidata is the ONLY assessed source that carries forward-dated national
 * elections as structured, queryable data (see
 * plan/elections-data-sourcing-resolution-v1.md §2b), and the only ungated
 * source with presidential coverage — which IPU Parline structurally lacks.
 * This sync fills those two gaps; IPU (`sync-elections-ipu.ts`) owns the
 * legislative-date + party-results spine.
 *
 * CONSERVATIVE v1 SCOPE (owner Q2 deferred): only SOURCE-CONFIRMED dates go on
 * the public page — never a Civica-computed projection. Wikidata models many
 * future elections at YEAR precision (P585 = `YYYY-01-01`, precision 9), which
 * is a scheduled cycle, not a confirmed calendar date; those render
 * misleadingly as "January 1". So future rows are gated to DAY precision
 * (`timePrecision = 11`). Past rows accept month/day precision. Every row
 * written carries dateConfidence = "confirmed".
 *
 * NATIONAL-ONLY discipline: Wikidata's generic election classes leak
 * sub-national results (US state, Australian state, Navajo Nation, Bosnian
 * entity-level, etc.) that all report `P17` = a sovereign state, so an ISO/QID
 * country filter alone does NOT reject them (§2b data-quality caveat). We gate
 * on (a) the country QID resolving to a Civica sovereign-state jurisdiction AND
 * (b) a curated sub-national label denylist — the same per-entity curation
 * discipline `sync-wikidata-officeholders.ts` applies, not a blind bulk insert.
 * The expensive `?country wdt:P31 wd:Q3624078` SPARQL join times out on the
 * public endpoint for the large legislative class, so this filtering is done in
 * app code against Civica's own jurisdiction spine.
 *
 * Provenance: CC0, wikidata source id. Rows populate `wikidataQid`. A
 * `statements` row per election records per-field provenance. Freshness stamped
 * ONLY via markSourcesSynced("wikidata", …) on a non-empty, non-dry run.
 *
 * Flags: --dry-run (read-only preview), --limit N (cap rows processed).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { jurisdictions } from "../src/lib/db/schema";
import { sparqlQuery, extractQid } from "../src/lib/data/wikidata";
import { markSourcesSynced } from "../src/lib/db/source-freshness";
import { writeElection } from "../src/lib/elections/writer";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

const SOURCE_ID = "wikidata";
const SOURCE_LICENSE = "CC0";
const RETRIEVED_AT = new Date();

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i !== -1 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
})();

// Wikidata election classes (verified live 2026-07-04/05, resolution §2b).
const Q_PRESIDENTIAL = "Q858439";
const Q_LEGISLATIVE = "Q2618461";
const Q_GENERAL = "Q1076105";

/**
 * Sub-national label markers. Wikidata does NOT tag these with P131 and they
 * report `P17` = a sovereign state, so this curated denylist is the reliable
 * gate (resolution §2b). Case-insensitive substring match on the English label.
 * Kept deliberately conservative — a false reject only drops a row, never
 * corrupts data. Extend as new sub-national leakage is observed in QA.
 */
const SUBNATIONAL_LABEL_MARKERS = [
  "state election",
  "state senate",
  "state house",
  "state assembly",
  "state legislature",
  "legislative assembly election", // Indian/Australian state assemblies
  "state general election",
  "gubernatorial",
  "provincial",
  "regional election",
  "municipal",
  "local election",
  "council election",
  "navajo nation",
  "republika srpska",
  "federation of bosnia",
  "cantonal",
  "by-election",
  // Australian states/territories
  "victorian",
  "new south wales",
  "queensland",
  "western australian",
  "south australian",
  "tasmanian",
  "northern territory",
  // US states appearing as "<State> Senate/House election"
  "michigan",
  "wyoming",
  "california",
  "texas",
  "virginia",
  "new jersey",
];

interface RawElection {
  qid: string;
  label: string;
  date: string; // yyyy-mm-dd
  precision: number; // 9 year, 10 month, 11 day
  countryQid: string | null;
  iso2: string | null;
  type: "presidential" | "legislative";
}

/**
 * Presidential elections (past + future) for elections whose P17 country is a
 * sovereign state. Q858439 is a small class, so the sovereign-state join is
 * affordable here and yields clean national-only rows (no sub-national leak).
 */
function presidentialQuery(): string {
  return `
SELECT ?election ?electionLabel ?date ?prec ?country ?iso WHERE {
  ?election wdt:P31/wdt:P279* wd:${Q_PRESIDENTIAL} .
  ?election wdt:P17 ?country .
  ?country wdt:P31 wd:Q3624078 .
  OPTIONAL { ?country wdt:P297 ?iso . }
  ?election p:P585 ?st .
  ?st psv:P585 ?dv .
  ?dv wikibase:timeValue ?date .
  ?dv wikibase:timePrecision ?prec .
  FILTER(?date >= "2015-01-01T00:00:00Z"^^xsd:dateTime)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?date)
`;
}

/**
 * Future-dated legislative/general elections. The sovereign-state join times
 * out on the public endpoint for the large legislative class, so we omit it
 * here and filter to real jurisdictions + drop sub-national labels in app code.
 */
function futureLegislativeQuery(classQid: string): string {
  return `
SELECT ?election ?electionLabel ?date ?prec ?country ?iso WHERE {
  ?election wdt:P31 wd:${classQid} .
  ?election p:P585 ?st .
  ?st psv:P585 ?dv .
  ?dv wikibase:timeValue ?date .
  ?dv wikibase:timePrecision ?prec .
  FILTER(?date > NOW())
  OPTIONAL { ?election wdt:P17 ?country . OPTIONAL { ?country wdt:P297 ?iso . } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?date
`;
}

function isSubnational(label: string): boolean {
  const l = label.toLowerCase();
  return SUBNATIONAL_LABEL_MARKERS.some((m) => l.includes(m));
}

function toRawElections(
  bindings: Awaited<ReturnType<typeof sparqlQuery>>,
  type: "presidential" | "legislative"
): RawElection[] {
  const out: RawElection[] = [];
  for (const b of bindings) {
    if (!b.election?.value || !b.date?.value) continue;
    out.push({
      qid: extractQid(b.election.value),
      label: b.electionLabel?.value ?? extractQid(b.election.value),
      date: b.date.value.slice(0, 10),
      precision: b.prec?.value ? Number(b.prec.value) : 11,
      countryQid: b.country?.value ? extractQid(b.country.value) : null,
      iso2: b.iso?.value ?? null,
      type,
    });
  }
  return out;
}

async function main() {
  console.log("=== Wikidata Elections Sync ===");
  console.log(
    `mode: ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY"}${
      LIMIT ? `, limit ${LIMIT} rows` : ""
    }\n`
  );

  // Jurisdiction spine: ISO2 → id, QID → id (sovereign states only). This is
  // the national-only gate — a Wikidata election whose country doesn't resolve
  // to a sovereign jurisdiction here is dropped.
  const jRows = await db
    .select({
      id: jurisdictions.id,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      qid: jurisdictions.wikidataQid,
    })
    .from(jurisdictions)
    .where(sql`${jurisdictions.type} = 'sovereign_state'`);
  const byIso = new Map<string, { id: string; name: string }>();
  const byQid = new Map<string, { id: string; name: string }>();
  for (const j of jRows) {
    if (j.iso2) byIso.set(j.iso2.toUpperCase(), { id: j.id, name: j.name });
    if (j.qid) byQid.set(j.qid, { id: j.id, name: j.name });
  }
  console.log(
    `  Jurisdiction spine: ${byIso.size} by ISO2, ${byQid.size} by QID\n`
  );

  // Fetch the three source queries.
  console.log("Querying Wikidata (presidential past+future)...");
  const presidential = toRawElections(
    await sparqlQuery(presidentialQuery()),
    "presidential"
  );
  console.log(`  ${presidential.length} presidential rows`);

  console.log("Querying Wikidata (future legislative)...");
  const futureLeg = toRawElections(
    await sparqlQuery(futureLegislativeQuery(Q_LEGISLATIVE)),
    "legislative"
  );
  console.log(`  ${futureLeg.length} future legislative rows`);

  console.log("Querying Wikidata (future general)...");
  const futureGen = toRawElections(
    await sparqlQuery(futureLegislativeQuery(Q_GENERAL)),
    "legislative"
  );
  console.log(`  ${futureGen.length} future general rows\n`);

  // Merge; dedup by election QID keeping the EARLIEST date (multi-round entities
  // carry two P585 values — round 1 is the election date we want).
  const byQidRaw = new Map<string, RawElection>();
  for (const r of [...presidential, ...futureLeg, ...futureGen]) {
    const existing = byQidRaw.get(r.qid);
    if (!existing || r.date < existing.date) byQidRaw.set(r.qid, r);
  }

  const nowIso = RETRIEVED_AT.toISOString().slice(0, 10);

  // Filter: national-only + precision gate.
  let droppedSubnational = 0;
  let droppedNoJurisdiction = 0;
  let droppedYearPrecisionFuture = 0;
  const resolved: Array<RawElection & { jurisdictionId: string; country: string }> = [];

  for (const r of byQidRaw.values()) {
    if (isSubnational(r.label)) {
      droppedSubnational++;
      continue;
    }
    // Resolve to a sovereign jurisdiction (ISO2 first, then country QID).
    const j =
      (r.iso2 && byIso.get(r.iso2.toUpperCase())) ||
      (r.countryQid && byQid.get(r.countryQid)) ||
      null;
    if (!j) {
      droppedNoJurisdiction++;
      continue;
    }
    // Conservative scope: future dates must be DAY precision (source-confirmed
    // calendar date), never a year-precision cycle placeholder.
    const isFuture = r.date >= nowIso;
    if (isFuture && r.precision < 11) {
      droppedYearPrecisionFuture++;
      continue;
    }
    resolved.push({ ...r, jurisdictionId: j.id, country: j.name });
  }

  // Sort: future first (ascending), then past (descending) — stable sampling.
  resolved.sort((a, b) => a.date.localeCompare(b.date));
  const limited = LIMIT ? resolved.slice(0, LIMIT) : resolved;

  console.log(`Candidate national elections: ${resolved.length}`);
  console.log(`  dropped sub-national (label):        ${droppedSubnational}`);
  console.log(`  dropped no sovereign jurisdiction:   ${droppedNoJurisdiction}`);
  console.log(`  dropped future year-precision cycle: ${droppedYearPrecisionFuture}\n`);

  let inserted = 0;
  let updated = 0;
  const samples: string[] = [];

  for (const r of limited) {
    const electionName = r.label
      .replace(/^next\s+/i, "")
      .replace(/^Next\s+/, "");
    const sourceUrl = `https://www.wikidata.org/wiki/${r.qid}`;

    if (samples.length < 15) {
      samples.push(
        `  ${r.country} · ${r.type} · ${r.date}${
          r.date >= nowIso ? " (upcoming)" : ""
        } · ${r.qid}`
      );
    }

    if (DRY_RUN) {
      inserted++;
      continue;
    }

    const stmtValue = JSON.stringify({
      wikidata_qid: r.qid,
      election_date: r.date,
      election_type: r.type,
      date_precision: r.precision,
    });
    const outcome = await writeElection(db as never, { election: { jurisdictionId: r.jurisdictionId, electionDate: r.date, electionType: r.type, electionName, wikidataQid: r.qid, dateConfidence: "confirmed" }, provenance: { predicate: "wikidata_election_date", objectValue: stmtValue, sourceId: SOURCE_ID, sourceUrl, sourceLicense: SOURCE_LICENSE } });
    inserted += outcome.inserted;
    updated += outcome.updated;
  }

  const rowsWritten = inserted + updated;
  const stamped = await markSourcesSynced(SOURCE_ID, {
    rowsWritten: DRY_RUN ? 0 : rowsWritten,
    at: RETRIEVED_AT,
  });

  console.log(`\n=== Wikidata Elections Sync Complete ===`);
  console.log(`  Rows ${DRY_RUN ? "would upsert" : "upserted"}: ${DRY_RUN ? limited.length : rowsWritten}`);
  if (!DRY_RUN) {
    console.log(`    · inserted: ${inserted}`);
    console.log(`    · updated:  ${updated}`);
  }
  console.log(`  Freshness stamped: ${stamped.length > 0 ? "yes" : "no"}`);
  console.log(`\nSample:`);
  for (const s of samples) console.log(s);
}

main().catch((err) => {
  console.error("Wikidata elections sync failed:", err);
  process.exit(1);
});
