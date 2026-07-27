import { config } from "dotenv";
config({ path: ".env.local" });

import { pathToFileURL } from "node:url";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { sparqlQuery, extractQid } from "../src/lib/data/wikidata";
import { writeLegislatureComposition, type PartyCompositionRow } from "../src/lib/legislatures/composition-writer";
import { markSourcesSynced } from "../src/lib/db/source-freshness";
import { resolveAtlasReleaseId } from "../src/lib/factbook/country-fact-history-writer";
import {
  upsertGovernmentBodyWithHistory,
  type GovernmentBodyHistoryWrite,
} from "../src/lib/factbook/government-entity-history-writer";

const DRY_RUN = process.argv.includes("--dry-run");
const EXPLICIT_RELEASE_ID = process.argv
  .find((arg) => arg.startsWith("--release-id="))
  ?.slice("--release-id=".length);

type GovernmentBodyHistoryDatabase = Parameters<
  typeof upsertGovernmentBodyWithHistory
>[0];
type GovernmentBodyHistoryWriter = typeof upsertGovernmentBodyWithHistory;

export async function writeWikidataGovernmentBodyLink(
  database: GovernmentBodyHistoryDatabase,
  input: Omit<GovernmentBodyHistoryWrite, "history">,
  options: {
    dryRun?: boolean;
    atlasReleaseId?: string | null;
    writer?: GovernmentBodyHistoryWriter;
  } = {},
): Promise<string> {
  if (options.dryRun) {
    if (!input.stableId) {
      throw new Error("Wikidata legislature linking requires a stable body UUID");
    }
    return input.stableId;
  }
  const releaseId = resolveAtlasReleaseId(options.atlasReleaseId);
  return (options.writer ?? upsertGovernmentBodyWithHistory)(database, {
    ...input,
    history: {
      changeKind: "routine_refresh",
      reason: "Wikidata legislature identity routine refresh",
      methodologyVersion: "wikidata-legislature-qid-sync/v1",
      releaseId,
    },
  });
}

// Query Wikidata for party seat composition of a specific legislature
// Uses P4100 (legislative body) membership on parliamentary group items
// Falls back to counting members by party affiliation
function buildPartySeatsQuery(legislatureQid: string): string {
  return `
SELECT ?party ?partyLabel ?seats ?color WHERE {
  ?party wdt:P31/wdt:P279* wd:Q7278 .
  ?party p:P1410 ?seatsStatement .
  ?seatsStatement ps:P1410 ?seats .
  ?seatsStatement pq:P194 wd:${legislatureQid} .
  FILTER NOT EXISTS { ?seatsStatement pq:P582 ?endDate . }
  OPTIONAL { ?party wdt:P462 ?colorEntity . ?colorEntity wdt:P465 ?color . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?seats)
`;
}

// Alternate: count current members by party
function buildMemberCountQuery(legislatureQid: string): string {
  return `
SELECT ?party ?partyLabel (COUNT(?member) AS ?seats) ?color WHERE {
  ?member p:P39 ?posStatement .
  ?posStatement ps:P39 ?position .
  ?position wdt:P361* wd:${legislatureQid} .
  FILTER NOT EXISTS { ?posStatement pq:P582 ?endDate . }
  ?member wdt:P102 ?party .
  OPTIONAL { ?party wdt:P462 ?colorEntity . ?colorEntity wdt:P465 ?color . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?party ?partyLabel ?color
ORDER BY DESC(?seats)
`;
}

async function main() {
  const atlasReleaseId = DRY_RUN
    ? null
    : resolveAtlasReleaseId(EXPLICIT_RELEASE_ID);
  const neonSql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: neonSql });

  console.log("=== Wikidata Party Composition Fallback ===\n");

  // Find legislative bodies that have no party data
  const bodiesWithoutParties = await db.execute(sql`
    SELECT gb.id, gb.name, gb.body_type, gb.chamber_type, gb.wikidata_qid,
           gb.ipu_parline_id, gb.jurisdiction_id, gb.total_seats, gb.branch,
           gb.hierarchy_level, gb.electoral_system_family,
           gb.electoral_subsystem,
           j.name as country_name, j.iso2, j.wikidata_qid as country_qid
    FROM government_bodies gb
    JOIN jurisdictions j ON gb.jurisdiction_id = j.id
    WHERE gb.branch = 'legislative'
      AND gb.id NOT IN (
        SELECT DISTINCT body_id FROM legislature_parties WHERE is_current = true
      )
    ORDER BY j.population DESC NULLS LAST
  `);

  const rows = (bodiesWithoutParties as { rows?: unknown[] }).rows ?? bodiesWithoutParties;
  console.log(`Found ${(rows as unknown[]).length} legislative bodies without party data\n`);

  // First, enrich bodies with Wikidata QIDs if missing
  const bodiesNeedingQid = (rows as Array<{
    id: string;
    name: string;
    body_type: string;
    chamber_type: string | null;
    wikidata_qid: string | null;
    ipu_parline_id: string | null;
    jurisdiction_id: string;
    total_seats: number | null;
    branch: string | null;
    hierarchy_level: number | null;
    electoral_system_family: string | null;
    electoral_subsystem: string | null;
    country_name: string;
    iso2: string | null;
    country_qid: string | null;
  }>).filter((b) => !b.wikidata_qid && b.country_qid);

  if (bodiesNeedingQid.length > 0) {
    console.log("Fetching legislature QIDs from Wikidata...");
    const legQuery = `
SELECT ?state ?stateLabel ?leg ?legLabel WHERE {
  ?state wdt:P31 wd:Q3624078 .
  ?state wdt:P194 ?leg .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;
    try {
      const legBindings = await sparqlQuery(legQuery);
      const countryToLegs = new Map<string, Array<{ qid: string; name: string }>>();
      for (const b of legBindings) {
        const stateQid = extractQid(b.state.value);
        const legQid = extractQid(b.leg.value);
        const legName = b.legLabel?.value ?? legQid;
        if (!countryToLegs.has(stateQid)) countryToLegs.set(stateQid, []);
        countryToLegs.get(stateQid)!.push({ qid: legQid, name: legName });
      }

      for (const body of bodiesNeedingQid) {
        const legs = countryToLegs.get(body.country_qid!) ?? [];
        // Match by name similarity
        const match = legs.find(
          (l) =>
            l.name.toLowerCase().includes(body.name.toLowerCase()) ||
            body.name.toLowerCase().includes(l.name.toLowerCase())
        ) ?? (legs.length === 1 ? legs[0] : null);

        if (match) {
          await writeWikidataGovernmentBodyLink(
            db,
            {
              stableId: body.id,
              jurisdictionId: body.jurisdiction_id,
              name: body.name,
              bodyType: body.body_type,
              chamberType: body.chamber_type,
              totalSeats: body.total_seats,
              branch: body.branch ?? "legislative",
              wikidataQid: match.qid,
              ipuParlineId: body.ipu_parline_id,
              hierarchyLevel: body.hierarchy_level,
              electoralSystemFamily: body.electoral_system_family,
              electoralSubsystem: body.electoral_subsystem,
            },
            { dryRun: DRY_RUN, atlasReleaseId },
          );
          body.wikidata_qid = match.qid;
          console.log(
            `  ${DRY_RUN ? "Would link" : "Linked"} ${body.country_name} ${body.name} -> ${match.qid} (${match.name})`,
          );
        }
      }
    } catch (err) {
      console.error("  Failed to fetch legislature QIDs:", err);
    }
  }

  // Now try to get party composition for each body
  let synced = 0;
  let failed = 0;

  for (const body of rows as Array<{
    id: string;
    name: string;
    body_type: string;
    chamber_type: string | null;
    wikidata_qid: string | null;
    ipu_parline_id: string | null;
    jurisdiction_id: string;
    total_seats: number | null;
    branch: string | null;
    hierarchy_level: number | null;
    electoral_system_family: string | null;
    electoral_subsystem: string | null;
    country_name: string;
    iso2: string | null;
    country_qid: string | null;
  }>) {
    if (!body.wikidata_qid) {
      console.log(`  Skip ${body.country_name} ${body.name} — no Wikidata QID`);
      failed++;
      continue;
    }

    console.log(`  Querying ${body.country_name} ${body.name} (${body.wikidata_qid})...`);

    try {
      // Try direct party seats query first
      let bindings = await sparqlQuery(buildPartySeatsQuery(body.wikidata_qid));

      // Fallback to member count if no direct data
      if (bindings.length === 0) {
        bindings = await sparqlQuery(buildMemberCountQuery(body.wikidata_qid));
      }

      if (bindings.length === 0) {
        console.log(`    No party data found`);
        failed++;
        continue;
      }

      const proposed: PartyCompositionRow[] = [];
      for (const b of bindings) {
        const partyName = b.partyLabel?.value ?? extractQid(b.party.value);
        const seats = parseInt(b.seats?.value ?? "0", 10);
        const color = b.color?.value ? `#${b.color.value}` : null;

        if (seats <= 0 || /^Q\d+$/.test(partyName)) continue;

        const partyQid = extractQid(b.party.value);
        proposed.push({
          sourcePartyId: partyQid,
          partyName,
          partyColor: color,
          seatCount: seats,
          wikidataQid: partyQid,
        });
      }
      await writeLegislatureComposition(db as never, { bodyId: body.id, jurisdictionId: body.jurisdiction_id, parties: proposed, sourceId: "wikidata", sourceUrl: `https://www.wikidata.org/wiki/${body.wikidata_qid}`, sourceLicense: "CC0", rawPayload: bindings.map((b) => ({ partyId: extractQid(b.party.value), party: b.partyLabel?.value, seats: b.seats?.value })) }, { dryRun: DRY_RUN, stampFreshness: false });

      synced++;
      console.log(`    Added ${bindings.length} parties`);
    } catch (err) {
      console.log(`    Error: ${(err as Error).message}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== Wikidata Party Sync Complete ===`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Failed/skipped: ${failed}`);

  await markSourcesSynced("wikidata", {
    rowsWritten: failed === 0 ? synced : 0,
    dryRun: DRY_RUN,
  });

}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
