import { config } from "dotenv";
config({ path: ".env.local" });

import { pathToFileURL } from "node:url";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql, and } from "drizzle-orm";
import {
  jurisdictions,
  governmentBodies,
} from "../src/lib/db/schema";
import { writeLegislatureComposition, type PartyCompositionRow } from "../src/lib/legislatures/composition-writer";
import { markSourcesSynced } from "../src/lib/db/source-freshness";
import { resolveAtlasReleaseId } from "../src/lib/factbook/country-fact-history-writer";
import {
  upsertGovernmentBodyWithHistory,
  type GovernmentBodyHistoryWrite,
} from "../src/lib/factbook/government-entity-history-writer";

const IPU_BASE = "https://api.data.ipu.org/v1";
const PAGE_SIZE = 50;
const SOURCE_ID = "ipu_parline";
const DRY_RUN = process.argv.includes("--dry-run");
const EXPLICIT_RELEASE_ID = process.argv
  .find((arg) => arg.startsWith("--release-id="))
  ?.slice("--release-id=".length);

type GovernmentBodyHistoryDatabase = Parameters<
  typeof upsertGovernmentBodyWithHistory
>[0];
type GovernmentBodyHistoryWriter = typeof upsertGovernmentBodyWithHistory;

export async function writeIpuGovernmentBody(
  database: GovernmentBodyHistoryDatabase,
  input: Omit<GovernmentBodyHistoryWrite, "history">,
  options: {
    dryRun?: boolean;
    atlasReleaseId?: string | null;
    writer?: GovernmentBodyHistoryWriter;
  } = {},
): Promise<string | null> {
  if (options.dryRun) return input.stableId ?? null;
  const releaseId = resolveAtlasReleaseId(options.atlasReleaseId);
  return (options.writer ?? upsertGovernmentBodyWithHistory)(database, {
    ...input,
    history: {
      changeKind: "routine_refresh",
      reason: "IPU Parline legislature metadata routine refresh",
      methodologyVersion: "ipu-parline-legislature-sync/v1",
      releaseId,
    },
  });
}

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
  const atlasReleaseId = DRY_RUN
    ? null
    : resolveAtlasReleaseId(EXPLICIT_RELEASE_ID);
  const neonSql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: neonSql });

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

    // Electoral-system classification (IPU's own two-level taxonomy). We store
    // IPU's snake_case terms verbatim — no invented Civica labels. `family` is
    // one of plurality_majority / proportional_representation / mixed_system /
    // other_systems; `subsystem` is the sub-type (fptp, list_pr, trs, mmp,
    // parallel_systems, av, stv, sntv, block_vote_bv, other, …). Both nullable:
    // IPU leaves many appointed/indirect upper chambers unclassified.
    const electoralSystemObj = extractLatestValue(
      chamber.attributes.electoral_system
    );
    const electoralSubsystemObj = extractLatestValue(
      chamber.attributes.electoral_subsystem
    );
    const electoralSystemFamily = electoralSystemObj?.term ?? null;
    const electoralSubsystem = electoralSubsystemObj?.term ?? null;

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

    let bodyId: string | null;
    if (existingBodies.length > 0) {
      const existingBody = existingBodies[0];
      bodyId = await writeIpuGovernmentBody(
        db,
        {
          stableId: existingBody.id,
          jurisdictionId: jurisdiction.id,
          name: chamberName,
          bodyType: existingBody.bodyType,
          chamberType,
          totalSeats: seatCount,
          branch: existingBody.branch ?? "legislative",
          wikidataQid: existingBody.wikidataQid,
          ipuParlineId: chamberCode,
          hierarchyLevel: existingBody.hierarchyLevel,
          electoralSystemFamily,
          electoralSubsystem,
        },
        { dryRun: DRY_RUN, atlasReleaseId },
      );
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
        bodyId = await writeIpuGovernmentBody(
          db,
          {
            stableId: matchingBody.id,
            jurisdictionId: jurisdiction.id,
            name: matchingBody.name,
            bodyType: matchingBody.bodyType,
            chamberType: chamberType ?? matchingBody.chamberType,
            totalSeats: seatCount ?? matchingBody.totalSeats,
            branch: matchingBody.branch ?? "legislative",
            wikidataQid: matchingBody.wikidataQid,
            ipuParlineId: chamberCode,
            hierarchyLevel: matchingBody.hierarchyLevel,
            electoralSystemFamily,
            electoralSubsystem,
          },
          { dryRun: DRY_RUN, atlasReleaseId },
        );
      } else {
        bodyId = await writeIpuGovernmentBody(
          db,
          {
            jurisdictionId: jurisdiction.id,
            name: chamberName,
            bodyType: "legislature",
            chamberType,
            totalSeats: seatCount,
            branch: "legislative",
            ipuParlineId: chamberCode,
            hierarchyLevel: chamberType === "upper" ? 1 : 2,
            electoralSystemFamily,
            electoralSubsystem,
            identityMode: "exact_name",
          },
          { dryRun: DRY_RUN, atlasReleaseId },
        );
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
        const proposed: PartyCompositionRow[] = [];

        for (const result of partyResults) {
          const partyCode = result.party;
          const partyName = partyNames.get(partyCode) ?? partyCode;

          // Use "Full composition" from vote_breakdown if available (for partial elections like Senate)
          const fullComp = result.vote_breakdown.find(
            (vb) => vb.label.en === "Full composition"
          );
          const seats = fullComp ? fullComp.value : result.total_number_of_seats;

          if (seats <= 0) continue;

          proposed.push({
            sourcePartyId: partyCode,
            partyName,
            seatCount: seats,
          });
        }
        if (proposed.length > 0) {
          if (bodyId) {
            await writeLegislatureComposition(db as never, { bodyId, jurisdictionId: jurisdiction.id, parties: proposed, sourceId: SOURCE_ID, sourceUrl: `${IPU_BASE}/elections/${electionId}`, sourceLicense: "CC-BY-NC-SA-4.0", rawPayload: partyResults }, { dryRun: DRY_RUN, stampFreshness: false });
          }
          partiesInserted += proposed.length;
        }
      }
    } catch (error) {
      console.error(
        `  Party composition failed for ${jurisdiction.slug} ${chamberName}:`,
        error,
      );
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

  await markSourcesSynced(SOURCE_ID, {
    rowsWritten: electionsFailed === 0 ? partiesInserted : 0,
    dryRun: DRY_RUN,
  });

  console.log(`\n=== IPU Parline Sync Complete ===`);
  console.log(`  Chambers processed: ${chambersProcessed}`);
  console.log(`  Chambers skipped: ${chambersSkipped}`);
  console.log(`  Parties inserted: ${partiesInserted}`);
  console.log(`  Elections not found: ${electionsFailed}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error("IPU sync failed:", err);
    process.exit(1);
  });
}
