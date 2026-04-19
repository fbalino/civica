import { db } from "@/lib/db";
import { sql, desc, asc } from "drizzle-orm";
import {
  jurisdictions,
  governmentBodies,
  offices,
  terms,
  persons,
  legislatureParties,
} from "@/lib/db/schema";
import { formatGovernmentType } from "@/lib/text/clean";
import { resolvePartyColor } from "@/lib/data/party-colors";

export interface AtlasCountry {
  id: string;
  slug: string;
  iso2?: string;
  name: string;
  leader: string;
  gov: string;
  region: string;
  pop: string;
  gdp: string;
  capital: string;
  iso3: string;
  featured?: boolean;
}

export interface AtlasParty {
  id: string;
  name: string;
  seats: number;
  color: string;
}

export interface AtlasChamber {
  name: string;
  total: number;
  sub: string;
  parties: AtlasParty[];
}

export interface AtlasChamberData {
  lower: AtlasChamber;
  upper: AtlasChamber | null;
  branches?: { exec: string; legis: string; jud: string };
}

const CONTINENT_TO_REGION: Record<string, string> = {
  "North America": "Americas",
  "South America": "Americas",
  "Central America": "Americas",
  Europe: "Europe",
  Africa: "Africa",
  Asia: "Asia",
  Oceania: "Oceania",
  Antarctica: "Oceania",
};

const TOP_COUNTRIES = new Set([
  "USA", "CHN", "IND", "BRA", "GBR", "FRA", "DEU", "JPN", "RUS", "SAU",
]);

function formatPop(n: number | null): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatGdp(b: number | null): string {
  if (!b) return "—";
  if (b >= 1000) return `$${(b / 1000).toFixed(1)}T`;
  return `$${b.toFixed(0)}B`;
}


export async function loadAtlasData(): Promise<{
  countries: AtlasCountry[];
  chambers: Record<string, AtlasChamberData>;
}> {
  const allJurisdictions = await db
    .select()
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state'
        AND ${jurisdictions.population} IS NOT NULL
        AND ${jurisdictions.population} > 0
        AND ${jurisdictions.iso3} IS NOT NULL
        AND LOWER(${jurisdictions.name}) <> 'none'`
    )
    .orderBy(desc(jurisdictions.population), asc(jurisdictions.name));

  const jurisdictionIds = allJurisdictions.map((j) => j.id);

  // Batch: all legislative bodies
  const allBodies = jurisdictionIds.length > 0
    ? await db
        .select()
        .from(governmentBodies)
        .where(sql`${governmentBodies.jurisdictionId} IN ${jurisdictionIds} AND ${governmentBodies.branch} = 'legislative'`)
        .orderBy(asc(governmentBodies.hierarchyLevel))
    : [];

  // Batch: all legislature parties
  const bodyIds = allBodies.map((b) => b.id);
  const allParties = bodyIds.length > 0
    ? await db
        .select()
        .from(legislatureParties)
        .where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)
        .orderBy(desc(legislatureParties.seatCount))
    : [];

  // Batch: all government bodies (for branch labels and executive leader lookup)
  const allGovBodies = jurisdictionIds.length > 0
    ? await db
        .select()
        .from(governmentBodies)
        .where(sql`${governmentBodies.jurisdictionId} IN ${jurisdictionIds}`)
        .orderBy(asc(governmentBodies.hierarchyLevel))
    : [];
  const execBodies = allGovBodies.filter((b) => b.branch === "executive");
  const execBodyIds = execBodies.map((b) => b.id);

  const headOffices = execBodyIds.length > 0
    ? await db
        .select()
        .from(offices)
        .where(sql`${offices.bodyId} IN ${execBodyIds}`)
    : [];
  const headOfficeIds = headOffices.map((o) => o.id);

  const currentHeads = headOfficeIds.length > 0
    ? await db
        .select({ term: terms, person: persons, officeId: terms.officeId })
        .from(terms)
        .innerJoin(persons, sql`${terms.personId} = ${persons.id}`)
        .where(sql`${terms.officeId} IN ${headOfficeIds} AND ${terms.isCurrent} = true`)
    : [];

  // Build leader lookup: jurisdictionId -> leader name
  const officeToBody = new Map(headOffices.map((o) => [o.id, o.bodyId]));
  const bodyToJurisdiction = new Map([...allBodies, ...execBodies].map((b) => [b.id, b.jurisdictionId]));
  const officeName = new Map(headOffices.map((o) => [o.id, o.name]));

  const leaderByJurisdiction = new Map<string, string>();
  for (const h of currentHeads) {
    if (/^Q\d+$/.test(h.person.name)) continue;
    const bId = officeToBody.get(h.officeId);
    if (!bId) continue;
    const jId = bodyToJurisdiction.get(bId);
    if (!jId) continue;
    const existing = leaderByJurisdiction.get(jId);
    const title = officeName.get(h.officeId) || "";
    if (!existing || title.toLowerCase().includes("president") || title.toLowerCase().includes("prime minister")) {
      leaderByJurisdiction.set(jId, h.person.name);
    }
  }

  // Build countries
  const countries: AtlasCountry[] = allJurisdictions.map((j) => ({
    id: j.iso3!.toLowerCase(),
    slug: j.slug,
    iso2: j.iso2 ?? undefined,
    name: j.name,
    leader: leaderByJurisdiction.get(j.id) || "—",
    gov: formatGovernmentType(j.governmentType || j.governmentTypeDetail) || "—",
    region: CONTINENT_TO_REGION[j.continent || ""] || j.continent || "—",
    pop: formatPop(j.population),
    gdp: formatGdp(j.gdpBillions),
    capital: j.capital || "—",
    iso3: j.iso3!,
    featured: TOP_COUNTRIES.has(j.iso3!.toUpperCase()),
  }));

  // Build chambers: keyed by iso3 lowercase
  const chambers: Record<string, AtlasChamberData> = {};
  const bodiesByJurisdiction = new Map<string, typeof allBodies>();
  for (const b of allBodies) {
    const existing = bodiesByJurisdiction.get(b.jurisdictionId) || [];
    existing.push(b);
    bodiesByJurisdiction.set(b.jurisdictionId, existing);
  }

  for (const j of allJurisdictions) {
    const jBodies = bodiesByJurisdiction.get(j.id);
    if (!jBodies || jBodies.length === 0) continue;

    const iso3 = j.iso3!.toLowerCase();
    const lowerBody = jBodies.find((b) => b.chamberType === "lower") || jBodies[0];
    const upperBody = jBodies.find((b) => b.chamberType === "upper");

    function buildChamber(body: typeof lowerBody): AtlasChamber {
      const bp = allParties.filter((p) => p.bodyId === body.id);
      const seen = new Set<string>();
      return {
        name: body.name,
        total: body.totalSeats || bp.reduce((sum, p) => sum + p.seatCount, 0),
        sub: `${body.totalSeats || "?"} seats`,
        parties: bp.map((p, i) => {
          let slug = p.partyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          if (!slug || seen.has(slug)) slug = `${slug || "party"}-${i}`;
          seen.add(slug);
          return {
            id: slug,
            name: p.partyName,
            seats: p.seatCount,
            color: resolvePartyColor(p.partyColor, p.partyName, i),
          };
        }),
      };
    }

    const jGovBodies = allGovBodies.filter((b) => b.jurisdictionId === j.id);
    const execBody = jGovBodies.find((b) => b.branch === "executive");
    const legisBody = jGovBodies.find((b) => b.branch === "legislative");
    const judBody = jGovBodies.find((b) => b.branch === "judicial");

    chambers[iso3] = {
      lower: buildChamber(lowerBody),
      upper: upperBody ? buildChamber(upperBody) : null,
      branches: {
        exec: execBody?.name ?? "—",
        legis: legisBody?.name ?? "—",
        jud: judBody?.name ?? "—",
      },
    };
  }

  return { countries, chambers };
}
