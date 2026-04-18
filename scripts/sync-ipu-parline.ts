import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql, and } from "drizzle-orm";
import {
  jurisdictions,
  governmentBodies,
  legislatureParties,
  statements,
  sources,
} from "../src/lib/db/schema";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

const IPU_BASE = "https://api.data.ipu.org/v1";
const PAGE_SIZE = 50;
const SOURCE_ID = "ipu_parline";
const RETRIEVED_AT = new Date();

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
    statutory_members_number: IpuValue<number>;
    current_members_number: IpuValue<number>;
    struct_parl_status: IpuValue<{ term: string }>;
    last_election: IpuValue<{ from: string }>;
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

const COUNTRY_CODE_TO_ISO2: Record<string, string> = {};

async function ipuFetch<T>(path: string): Promise<T> {
  const url = `${IPU_BASE}${path}`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`IPU API ${resp.status}: ${url}`);
  return resp.json() as Promise<T>;
}

async function fetchAllPages<T>(
  path: string,
  dataKey: "data" = "data"
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let total = Infinity;

  while (items.length < total) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await ipuFetch<{
      meta: { total: number };
      [key: string]: unknown;
    }>(`${path}${sep}page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`);
    total = data.meta.total;
    const pageItems = data[dataKey] as T[];
    if (!pageItems || pageItems.length === 0) break;
    items.push(...pageItems);
    page++;
    await sleep(300);
  }

  return items;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractLatestValue<T>(field: IpuValue<T> | IpuValue<T>[] | undefined): T | null {
  if (!field) return null;
  if (Array.isArray(field)) {
    const last = field[field.length - 1];
    return last?.value ?? null;
  }
  return (field as IpuValue<T>).value ?? null;
}

function chamberTypeFromIpu(term: string | null): string | null {
  if (!term) return null;
  switch (term) {
    case "lower_chamber":
      return "lower";
    case "upper_chamber":
      return "upper";
    case "unicameral_parliament":
      return "unicameral";
    default:
      return null;
  }
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

async function main() {
  console.log("=== IPU Parline Sync ===\n");

  // 1. Fetch all political parties for name lookup
  console.log("Fetching political parties for name lookup...");
  const allParties = await fetchAllPages<IpuParty>("/political_parties");
  const partyNames = new Map<string, string>();
  for (const p of allParties) {
    partyNames.set(p.political_party_code, p.party_name.en);
  }
  console.log(`  Loaded ${partyNames.size} party names\n`);

  // 2. Fetch all chambers
  console.log("Fetching chambers...");
  const allChambers = await fetchAllPages<IpuChamber>("/chambers");
  console.log(`  Found ${allChambers.length} chambers\n`);

  // 3. Load existing jurisdictions for ISO2 mapping
  const allJurisdictions = await db
    .select({ id: jurisdictions.id, iso2: jurisdictions.iso2, slug: jurisdictions.slug })
    .from(jurisdictions)
    .where(sql`${jurisdictions.type} = 'sovereign_state'`);
  const iso2ToJurisdiction = new Map(
    allJurisdictions
      .filter((j) => j.iso2)
      .map((j) => [j.iso2!.toUpperCase(), j])
  );
  console.log(`  Loaded ${iso2ToJurisdiction.size} jurisdictions with ISO2 codes\n`);

  let chambersProcessed = 0;
  let partiesInserted = 0;
  let chambersSkipped = 0;
  let electionsFailed = 0;

  for (const chamber of allChambers) {
    const chamberCode = extractLatestValue(chamber.attributes.chamber_code);
    const countryCode = extractLatestValue(chamber.attributes.parliament);
    const chamberNameObj = extractLatestValue(chamber.attributes.chamber_name);
    const chamberName = chamberNameObj?.en ?? chamber.id;
    const seatCount =
      extractLatestValue(chamber.attributes.statutory_members_number) ??
      extractLatestValue(chamber.attributes.current_members_number);
    const statusObj = extractLatestValue(chamber.attributes.struct_parl_status);
    const chamberType = chamberTypeFromIpu(statusObj?.term ?? null);
    const lastElectionObj = extractLatestValue(chamber.attributes.last_election);

    if (!countryCode || !chamberCode) {
      chambersSkipped++;
      continue;
    }

    const jurisdiction = iso2ToJurisdiction.get(countryCode.toUpperCase());
    if (!jurisdiction) {
      chambersSkipped++;
      continue;
    }

    // Upsert government body for this chamber
    const existingBodies = await db
      .select()
      .from(governmentBodies)
      .where(
        and(
          eq(governmentBodies.jurisdictionId, jurisdiction.id),
          eq(governmentBodies.ipuParlineId, chamberCode)
        )
      );

    let bodyId: string;
    if (existingBodies.length > 0) {
      bodyId = existingBodies[0].id;
      await db
        .update(governmentBodies)
        .set({
          name: chamberName,
          totalSeats: seatCount,
          chamberType,
        })
        .where(eq(governmentBodies.id, bodyId));
    } else {
      // Check if there's already a legislative body with similar name
      const similarBodies = await db
        .select()
        .from(governmentBodies)
        .where(
          and(
            eq(governmentBodies.jurisdictionId, jurisdiction.id),
            eq(governmentBodies.branch, "legislative")
          )
        );

      const matchingBody = similarBodies.find(
        (b) =>
          b.name.toLowerCase() === chamberName.toLowerCase() ||
          (b.chamberType === chamberType && chamberType !== null)
      );

      if (matchingBody) {
        bodyId = matchingBody.id;
        await db
          .update(governmentBodies)
          .set({
            ipuParlineId: chamberCode,
            totalSeats: seatCount ?? matchingBody.totalSeats,
            chamberType: chamberType ?? matchingBody.chamberType,
          })
          .where(eq(governmentBodies.id, bodyId));
      } else {
        const inserted = await db
          .insert(governmentBodies)
          .values({
            jurisdictionId: jurisdiction.id,
            name: chamberName,
            bodyType: "legislature",
            chamberType,
            totalSeats: seatCount,
            branch: "legislative",
            ipuParlineId: chamberCode,
            hierarchyLevel: chamberType === "upper" ? 1 : 2,
          })
          .returning({ id: governmentBodies.id });
        bodyId = inserted[0].id;
      }
    }

    // Fetch latest election for party seat data
    if (!lastElectionObj?.from) {
      chambersSkipped++;
      chambersProcessed++;
      continue;
    }

    const electionId = electionIdFromChamberAndDate(
      chamberCode,
      lastElectionObj.from
    );

    try {
      const electionData = await ipuFetch<{ data: IpuElection }>(
        `/elections/${electionId}`
      );
      const spp = electionData.data.attributes.seats_per_parties;
      const partyResults = extractLatestValue(spp);

      if (partyResults && partyResults.length > 0) {
        // Clear existing parties for this body
        await db
          .delete(legislatureParties)
          .where(eq(legislatureParties.bodyId, bodyId));

        for (const result of partyResults) {
          const partyCode = result.party;
          const partyName = partyNames.get(partyCode) ?? partyCode;

          // Use "Full composition" from vote_breakdown if available (for partial elections like Senate)
          const fullComp = result.vote_breakdown.find(
            (vb) => vb.label.en === "Full composition"
          );
          const seats = fullComp ? fullComp.value : result.total_number_of_seats;

          if (seats <= 0) continue;

          await db.insert(legislatureParties).values({
            bodyId,
            partyName,
            seatCount: seats,
          });
          partiesInserted++;
        }

        // Add provenance statement
        await db.insert(statements).values({
          subjectTable: "legislature_parties",
          subjectId: bodyId,
          predicate: "seats_per_parties",
          objectValue: JSON.stringify(partyResults),
          sourceId: SOURCE_ID,
          sourceUrl: `${IPU_BASE}/elections/${electionId}`,
          sourceLicense: "CC-BY-NC-SA-4.0",
          retrievedAt: RETRIEVED_AT,
          confidence: 1.0,
        });
      }
    } catch {
      electionsFailed++;
    }

    chambersProcessed++;
    if (chambersProcessed % 20 === 0) {
      console.log(
        `  Progress: ${chambersProcessed}/${allChambers.length} chambers`
      );
    }
    await sleep(200);
  }

  // Update source sync timestamp
  await db
    .update(sources)
    .set({ lastSyncAt: RETRIEVED_AT })
    .where(eq(sources.id, SOURCE_ID));

  console.log(`\n=== IPU Parline Sync Complete ===`);
  console.log(`  Chambers processed: ${chambersProcessed}`);
  console.log(`  Chambers skipped: ${chambersSkipped}`);
  console.log(`  Parties inserted: ${partiesInserted}`);
  console.log(`  Elections not found: ${electionsFailed}`);
}

main().catch((err) => {
  console.error("IPU sync failed:", err);
  process.exit(1);
});
