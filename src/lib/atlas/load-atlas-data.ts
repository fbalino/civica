import { cache } from "react";
import { db } from "@/lib/db";
import { sql, desc, asc, and, inArray } from "drizzle-orm";
import {
  jurisdictions,
  governmentBodies,
  offices,
  terms,
  persons,
  legislatureParties,
  countryFacts,
  countryFactbookSections,
  sources,
  organizations,
  organizationMemberships,
  elections,
} from "@/lib/db/schema";
import { formatGovernmentDisplay } from "@/lib/text/clean";
import { resolvePartyColor } from "@/lib/data/party-colors";
import { readCachedFieldFromRow } from "@/lib/factbook/reconcile/api";
import type {
  CountryFactSource,
  CountryFactValue,
  CountryMastheadFacts,
  CountryMembershipChip,
} from "@/components/atlas/data";
import {
  buildJurisdictionStatusPresentation,
  type JurisdictionStatusPresentation,
} from "@/lib/jurisdictions/status-presentation";
import {
  ELECTION_CORPUS_AUDIT,
  getElectionAuditRow,
  isAuditedPublicElection,
  isPrimaryElectionEvent,
} from "@/lib/elections/corpus-audit-runtime";
import { loadLiveElectionContentFingerprints } from "@/lib/elections/corpus-audit-live";

export interface AtlasCountry {
  id: string;
  slug: string;
  iso2?: string;
  name: string;
  leader: string;
  gov: string;
  govDetail?: string;
  region: string;
  pop: string;
  gdp: string;
  capital: string;
  iso3: string;
  jurisdictionStatus: JurisdictionStatusPresentation;
  featured?: boolean;
  masthead?: CountryMastheadFacts;
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
  "USA",
  "CHN",
  "IND",
  "BRA",
  "GBR",
  "FRA",
  "DEU",
  "JPN",
  "RUS",
  "SAU",
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

function formatArea(n: number | null): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M km²`;
  return `${n.toLocaleString()} km²`;
}

function formatMoneyDollars(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000)
    return `$${(abs / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(0)}M`;
  return `$${abs.toLocaleString()}`;
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&([a-z]+);/gi, (_, entity: string) => {
    const map: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      nbsp: " ",
    };
    return map[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const clean = cleanText(value);
    // Belt-and-braces: as of Bug 3 fix (2026-05-04, see
    // ~/civica/plan/factbook-prose-extraction-v1.md) no live source
    // emits `"[object Object]"` into the canonical fact layer. The
    // seed script's own `extractText` now returns null in that case
    // rather than stringifying. This filter remains as
    // defense-in-depth so any future regression — a new seed-script
    // call site, a sync adapter, a manual DB edit — is caught at
    // the read-time boundary instead of rendered to readers. Not
    // load-bearing for normal operation.
    return clean && clean !== "[object Object]" ? clean : null;
  }
  if (typeof value === "number") return value.toLocaleString();
  if (
    typeof value === "object" &&
    "text" in (value as Record<string, unknown>)
  ) {
    return extractText((value as Record<string, unknown>).text);
  }
  return null;
}

function getNestedValue(data: unknown, ...keys: string[]): unknown {
  let current = data;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    const obj = current as Record<string, unknown>;
    const found = Object.keys(obj).find(
      (candidate) => normalizeKey(candidate) === normalizeKey(key),
    );
    current = found ? obj[found] : undefined;
  }
  return current;
}

function getNestedText(data: unknown, ...keys: string[]): string | null {
  return extractText(getNestedValue(data, ...keys));
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const clean = extractText(value);
    if (clean) return clean;
  }
  return null;
}

function sourceWithValue(
  value: unknown,
  source: CountryFactSource,
): CountryFactValue {
  const clean = extractText(value);
  if (!clean || clean === "—") return { value: null };
  return { value: clean, source };
}

function formatCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const withoutRate = cleanText(raw)
    .replace(/\s+per\s+US\s+dollar.*$/i, "")
    .replace(/\s+-$/i, "")
    .trim();
  const codeMatch = withoutRate.match(/\(([A-Z]{3})\)/);
  const code = codeMatch?.[1];
  const name = withoutRate.replace(/\s*\([A-Z]{3}\)\s*/g, "").trim();
  if (!name) return code ? `(${code})` : null;

  const singulars: Record<string, string> = {
    afghanis: "Afghani",
    baht: "Baht",
    birr: "Birr",
    dinars: "Dinar",
    dollars: "Dollar",
    dong: "Dong",
    euros: "Euro",
    francs: "Franc",
    kwanza: "Kwanza",
    kyats: "Kyat",
    liras: "Lira",
    nairas: "Naira",
    pesos: "Peso",
    pounds: "Pound",
    rand: "Rand",
    reals: "Real",
    rials: "Rial",
    rubles: "Ruble",
    rupees: "Rupee",
    shillings: "Shilling",
    taka: "Taka",
    won: "Won",
    yen: "Yen",
    yuan: "Yuan",
  };

  const words = name.split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase();
  if (last && singulars[last]) words[words.length - 1] = singulars[last];

  const titleName = words
    .map((word) =>
      /^[A-Z]{2,}$/.test(word)
        ? word
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(" ");
  return code ? `${titleName} (${code})` : titleName;
}

function formatGovernmentDetail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return cleanText(raw)
    .split(/\s+/)
    .map((word) =>
      word.length <= 3 && word === word.toUpperCase()
        ? word
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

function formatCommodityList(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const withoutYear = cleanText(raw).replace(
    /\s*\(\d{4}(?:\s+est\.)?\)\s*$/i,
    "",
  );
  const items = withoutYear
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (items.length === 0) return null;
  const joined = items.join(", ");
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}`;
}

function formatConstitution(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = cleanText(raw);
  const latest = text.match(/latest adopted\s+([^,;]+)/i);
  if (latest?.[1]) return latest[1].trim();
  const year = text.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  return year?.[0] ?? text.split(/[.;]/)[0]?.trim() ?? null;
}

function formatTimeZone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return cleanText(raw).split("(")[0]?.trim() || null;
}

function formatElectionDate(
  value: string | Date | null | undefined,
): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function isoTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function sortMemberships(
  items: CountryMembershipChip[],
): CountryMembershipChip[] {
  const priority = new Map(
    [
      "united-nations",
      "un",
      "african-union",
      "european-union",
      "ecowas",
      "nato",
      "who",
      "wto",
      "imf",
      "world-bank",
    ].map((slug, index) => [slug, index]),
  );
  return [...items].sort((a, b) => {
    const pa = priority.get(a.slug) ?? 100;
    const pb = priority.get(b.slug) ?? 100;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

// React `cache()` dedupes calls within a single render. Shell routes for
// /atlas/[slug]/[tab] call this from the page AND from each parallel slot;
// without cache() each tab click triggers 3 identical DB round-trips.
export const loadAtlasData = cache(_loadAtlasData);

async function _loadAtlasData(): Promise<{
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
        AND LOWER(${jurisdictions.name}) <> 'none'`,
    )
    .orderBy(desc(jurisdictions.population), asc(jurisdictions.name));

  const jurisdictionIds = allJurisdictions.map((j) => j.id);

  const sourceRows = await db
    .select({ id: sources.id, lastSyncAt: sources.lastSyncAt })
    .from(sources);
  const sourceById = new Map<string, CountryFactSource>(
    sourceRows.map((s) => [
      s.id,
      { source: s.id, retrievedAt: isoTimestamp(s.lastSyncAt) },
    ]),
  );
  const ciaSource = sourceById.get("cia_factbook") ?? {
    source: "cia_factbook",
    retrievedAt: null,
  };
  const wikidataSource = sourceById.get("wikidata") ?? {
    source: "wikidata",
    retrievedAt: null,
  };
  const curatedSource: CountryFactSource = {
    source: "civica_curated",
    retrievedAt: null,
  };

  // Phase R.12 — `exports_total` / `imports_total` renamed to
  // `exports_goods_services_usd` / `imports_goods_services_usd` per
  // `~/civica/plan/trade-aggregate-fact-keys-v1.md`. The masthead's
  // trade-balance computation reads from the goods+services aggregate
  // (the broader BoP-aligned measure that CIA reports in its Factbook
  // prose; preserves the prior masthead semantics).
  const mastheadFactKeys = [
    "export_commodities",
    "exports_goods_services_usd",
    "imports_goods_services_usd",
    "languages",
    "literacy_rate",
    "religions",
    "total_area",
  ];

  const allCountryFacts =
    jurisdictionIds.length > 0
      ? await db
          .select({
            jurisdictionId: countryFacts.jurisdictionId,
            factKey: countryFacts.factKey,
            factValue: countryFacts.factValue,
            factValueNumeric: countryFacts.factValueNumeric,
            factUnit: countryFacts.factUnit,
            factYear: countryFacts.factYear,
          })
          .from(countryFacts)
          .where(
            sql`${countryFacts.jurisdictionId} IN ${jurisdictionIds}
            AND ${countryFacts.factKey} IN ${mastheadFactKeys}`,
          )
      : [];

  const factbookSectionNames = [
    "communications",
    "economy",
    "government",
    "people_and_society",
  ];
  const mastheadSections =
    jurisdictionIds.length > 0
      ? await db
          .select({
            jurisdictionId: countryFactbookSections.jurisdictionId,
            sectionName: countryFactbookSections.sectionName,
            sectionData: countryFactbookSections.sectionData,
          })
          .from(countryFactbookSections)
          .where(
            sql`${countryFactbookSections.jurisdictionId} IN ${jurisdictionIds}
            AND ${countryFactbookSections.sectionName} IN ${factbookSectionNames}`,
          )
      : [];

  const allMemberships =
    jurisdictionIds.length > 0
      ? await db
          .select({
            jurisdictionId: organizationMemberships.jurisdictionId,
            orgSlug: organizations.slug,
            orgName: organizations.name,
          })
          .from(organizationMemberships)
          .innerJoin(
            organizations,
            sql`${organizationMemberships.orgId} = ${organizations.id}`,
          )
          .where(
            sql`${organizationMemberships.jurisdictionId} IN ${jurisdictionIds}
            AND ${organizationMemberships.status} = 'current'`,
          )
      : [];

  const pastElections =
    jurisdictionIds.length > 0
      ? await db
          .select({
            id: elections.id,
            jurisdictionId: elections.jurisdictionId,
            electionDate: elections.electionDate,
          })
          .from(elections)
          .where(
            sql`${elections.jurisdictionId} IN ${jurisdictionIds}
            AND ${elections.electionDate} <= ${ELECTION_CORPUS_AUDIT.asOf}`,
          )
          .orderBy(desc(elections.electionDate))
      : [];

  const factsByJurisdiction = new Map<
    string,
    Map<string, (typeof allCountryFacts)[number]>
  >();
  for (const fact of allCountryFacts) {
    const facts = factsByJurisdiction.get(fact.jurisdictionId) ?? new Map();
    facts.set(fact.factKey, fact);
    factsByJurisdiction.set(fact.jurisdictionId, facts);
  }

  const sectionsByJurisdiction = new Map<string, Map<string, unknown>>();
  for (const section of mastheadSections) {
    const sections =
      sectionsByJurisdiction.get(section.jurisdictionId) ?? new Map();
    sections.set(section.sectionName, section.sectionData);
    sectionsByJurisdiction.set(section.jurisdictionId, sections);
  }

  const membershipsByJurisdiction = new Map<string, CountryMembershipChip[]>();
  for (const membership of allMemberships) {
    const memberships =
      membershipsByJurisdiction.get(membership.jurisdictionId) ?? [];
    memberships.push({
      name: membership.orgName,
      slug: membership.orgSlug,
      source: curatedSource,
    });
    membershipsByJurisdiction.set(membership.jurisdictionId, memberships);
  }

  const latestElectionByJurisdiction = new Map<
    string,
    (typeof pastElections)[number]
  >();
  const liveElectionFingerprints = await loadLiveElectionContentFingerprints(
    pastElections.map((row) => row.id),
  );
  for (const election of pastElections) {
    if (
      !isAuditedPublicElection(
        election.id,
        liveElectionFingerprints.get(election.id),
      ) ||
      !isPrimaryElectionEvent(election.id)
    )
      continue;
    if (!latestElectionByJurisdiction.has(election.jurisdictionId)) {
      latestElectionByJurisdiction.set(election.jurisdictionId, election);
    }
  }

  // Batch: all legislative bodies
  const allBodies =
    jurisdictionIds.length > 0
      ? await db
          .select()
          .from(governmentBodies)
          .where(
            sql`${governmentBodies.jurisdictionId} IN ${jurisdictionIds} AND ${governmentBodies.branch} = 'legislative'`,
          )
          .orderBy(asc(governmentBodies.hierarchyLevel))
      : [];

  // Batch: all legislature parties
  const bodyIds = allBodies.map((b) => b.id);
  const allParties =
    bodyIds.length > 0
      ? await db
          .select()
          .from(legislatureParties)
          .where(
            sql`${legislatureParties.bodyId} IN ${bodyIds}
              AND ${legislatureParties.isCurrent} = true`,
          )
          .orderBy(desc(legislatureParties.seatCount))
      : [];

  // Batch: all government bodies (for branch labels and executive leader lookup)
  const allGovBodies =
    jurisdictionIds.length > 0
      ? await db
          .select()
          .from(governmentBodies)
          .where(sql`${governmentBodies.jurisdictionId} IN ${jurisdictionIds}`)
          .orderBy(asc(governmentBodies.hierarchyLevel))
      : [];
  const execBodies = allGovBodies.filter((b) => b.branch === "executive");
  const execBodyIds = execBodies.map((b) => b.id);

  const headOffices =
    execBodyIds.length > 0
      ? await db
          .select()
          .from(offices)
          .where(
            sql`${offices.bodyId} IN ${execBodyIds} AND ${offices.officeType} IN ('head_of_state', 'head_of_government')`,
          )
      : [];
  const headOfficeIds = headOffices.map((o) => o.id);

  const currentHeads =
    headOfficeIds.length > 0
      ? await db
          .select({ term: terms, person: persons, officeId: terms.officeId })
          .from(terms)
          .innerJoin(persons, sql`${terms.personId} = ${persons.id}`)
          .where(
            sql`${terms.officeId} IN ${headOfficeIds} AND ${terms.isCurrent} = true`,
          )
      : [];

  // Build leader lookup: jurisdictionId -> leader name (head_of_state takes priority)
  const officeToBody = new Map(headOffices.map((o) => [o.id, o.bodyId]));
  const bodyToJurisdiction = new Map(
    [...allBodies, ...execBodies].map((b) => [b.id, b.jurisdictionId]),
  );
  const officeTypeMap = new Map(headOffices.map((o) => [o.id, o.officeType]));

  const headsByJurisdiction = new Map<
    string,
    { headOfState?: string; headOfGovernment?: string }
  >();
  const leaderByJurisdiction = new Map<
    string,
    { name: string; isHeadOfState: boolean }
  >();
  for (const h of currentHeads) {
    if (/^Q\d+$/.test(h.person.name)) continue;
    const bId = officeToBody.get(h.officeId);
    if (!bId) continue;
    const jId = bodyToJurisdiction.get(bId);
    if (!jId) continue;
    const existing = leaderByJurisdiction.get(jId);
    const isHeadOfState = officeTypeMap.get(h.officeId) === "head_of_state";
    const officeType = officeTypeMap.get(h.officeId);
    const heads = headsByJurisdiction.get(jId) ?? {};
    if (officeType === "head_of_state" && !heads.headOfState) {
      heads.headOfState = h.person.name;
    }
    if (officeType === "head_of_government" && !heads.headOfGovernment) {
      heads.headOfGovernment = h.person.name;
    }
    headsByJurisdiction.set(jId, heads);
    if (!existing || (isHeadOfState && !existing.isHeadOfState)) {
      leaderByJurisdiction.set(jId, { name: h.person.name, isHeadOfState });
    }
  }

  // Build countries
  const countries: AtlasCountry[] = allJurisdictions.map((j) => {
    const government = formatGovernmentDisplay(
      j.governmentTypeDetail || j.governmentType,
      j.name,
    );
    const facts = factsByJurisdiction.get(j.id) ?? new Map();
    const sections = sectionsByJurisdiction.get(j.id) ?? new Map();
    const economySection = sections.get("economy");
    const governmentSection = sections.get("government");
    const communicationsSection = sections.get("communications");
    const peopleSection = sections.get("people_and_society");
    const heads = headsByJurisdiction.get(j.id) ?? {};

    const factText = (key: string) => facts.get(key)?.factValue ?? null;
    const cachedArea = readCachedFieldFromRow(j, "area_total_km2");
    const cachedCapital = readCachedFieldFromRow(j, "capital");
    const cachedLanguages = readCachedFieldFromRow(j, "official_languages");
    const cachedCurrency = readCachedFieldFromRow(j, "currency_code");
    const cachedPopulation = readCachedFieldFromRow(j, "population_total");
    const cachedGdpBillions = readCachedFieldFromRow(j, "gdp_ppp_usd_billions");
    const area =
      formatArea(cachedArea) ??
      formatArea(Math.round(facts.get("total_area")?.factValueNumeric ?? 0)) ??
      factText("total_area");
    // Phase R.12 — read from the goods+services aggregate keys (CIA prose
    // is goods+services per its Factbook glossary; the legacy
    // `exports_total` / `imports_total` aliases were renamed to
    // `exports_goods_services_usd` / `imports_goods_services_usd` in-band
    // with R.12's first sync run). Per
    // `~/civica/plan/trade-aggregate-fact-keys-v1.md` §2d.
    const exportsValue = facts.get(
      "exports_goods_services_usd",
    )?.factValueNumeric;
    const importsValue = facts.get(
      "imports_goods_services_usd",
    )?.factValueNumeric;
    const tradeBalance =
      typeof exportsValue === "number" && typeof importsValue === "number"
        ? `${exportsValue - importsValue >= 0 ? "+" : "-"}${formatMoneyDollars(
            exportsValue - importsValue,
          )}`
        : null;
    const latestElection = latestElectionByJurisdiction.get(j.id);
    const latestElectionAudit = latestElection
      ? getElectionAuditRow(latestElection.id)
      : null;
    const latestElectionSource = latestElectionAudit?.evidence.sourceId
      ? {
          source: latestElectionAudit.evidence.sourceId,
          retrievedAt: latestElectionAudit.evidence.retrievedAt,
        }
      : curatedSource;
    const memberships = sortMemberships(
      membershipsByJurisdiction.get(j.id) ?? [],
    ).slice(0, 6);

    const masthead: CountryMastheadFacts = {
      gov: sourceWithValue(government.label, ciaSource),
      govDetail: sourceWithValue(
        formatGovernmentDetail(government.detail ?? j.governmentTypeDetail),
        ciaSource,
      ),
      headOfState: sourceWithValue(heads.headOfState ?? null, wikidataSource),
      headOfGovernment: sourceWithValue(
        heads.headOfGovernment ?? null,
        wikidataSource,
      ),
      capital: sourceWithValue(cachedCapital, ciaSource),
      language: sourceWithValue(
        firstText(
          cachedLanguages,
          factText("languages"),
          getNestedText(peopleSection, "Languages", "Languages"),
        ),
        ciaSource,
      ),
      currency: sourceWithValue(formatCurrency(cachedCurrency), ciaSource),
      region: sourceWithValue(
        CONTINENT_TO_REGION[j.continent || ""] || j.continent || null,
        ciaSource,
      ),
      area: sourceWithValue(area, ciaSource),
      population: sourceWithValue(formatPop(cachedPopulation), ciaSource),
      gdpPpp: sourceWithValue(formatGdp(cachedGdpBillions), ciaSource),
      mainExport: sourceWithValue(
        formatCommodityList(factText("export_commodities")),
        ciaSource,
      ),
      mainImport: sourceWithValue(
        formatCommodityList(
          getNestedText(economySection, "Imports - commodities"),
        ),
        ciaSource,
      ),
      tradeBalance: sourceWithValue(tradeBalance, ciaSource),
      independence: sourceWithValue(
        getNestedText(governmentSection, "Independence"),
        ciaSource,
      ),
      constitution: sourceWithValue(
        formatConstitution(
          getNestedText(governmentSection, "Constitution", "history"),
        ),
        ciaSource,
      ),
      lastElection: sourceWithValue(
        formatElectionDate(latestElection?.electionDate),
        latestElectionSource,
      ),
      religion: sourceWithValue(factText("religions"), ciaSource),
      literacy: sourceWithValue(factText("literacy_rate"), ciaSource),
      olympicMedals: { value: null },
      callingCode: { value: null },
      tld: sourceWithValue(
        getNestedText(communicationsSection, "Internet country code"),
        ciaSource,
      ),
      timeZone: sourceWithValue(
        formatTimeZone(
          getNestedText(governmentSection, "Capital", "time difference"),
        ),
        ciaSource,
      ),
      iso: sourceWithValue(j.iso3?.toUpperCase() ?? null, ciaSource),
      drivesOn: { value: null },
      anthem: sourceWithValue(
        getNestedText(governmentSection, "National anthem(s)", "title"),
        ciaSource,
      ),
      nationalDay: sourceWithValue(
        getNestedText(governmentSection, "National holiday"),
        ciaSource,
      ),
      memberships,
    };

    return {
      id: j.iso3!.toLowerCase(),
      slug: j.slug,
      iso2: j.iso2 ?? undefined,
      name: j.name,
      leader: leaderByJurisdiction.get(j.id)?.name || "—",
      gov: government.label,
      govDetail: government.detail ?? undefined,
      region: CONTINENT_TO_REGION[j.continent || ""] || j.continent || "—",
      pop: formatPop(cachedPopulation),
      gdp: formatGdp(cachedGdpBillions),
      capital: cachedCapital || "—",
      iso3: j.iso3!,
      jurisdictionStatus: buildJurisdictionStatusPresentation({
        slug: j.slug,
        iso3: j.iso3,
        type: j.type,
        statusSourceIds: j.statusSourceIds,
        statusReviewedAt: j.statusReviewedAt,
        statusNote: j.statusNote,
        administeringJurisdictionIso3: j.administeringJurisdictionIso3,
        statusDisputed: j.statusDisputed,
      }),
      featured: TOP_COUNTRIES.has(j.iso3!.toUpperCase()),
      masthead,
    };
  });

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
    const lowerBody =
      jBodies.find((b) => b.chamberType === "lower") || jBodies[0];
    const upperBody = jBodies.find((b) => b.chamberType === "upper");

    function buildChamber(body: typeof lowerBody): AtlasChamber {
      const bp = allParties.filter((p) => p.bodyId === body.id);
      const seen = new Set<string>();
      const totalSeats =
        body.totalSeats || bp.reduce((sum, p) => sum + p.seatCount, 0);
      const sumPartySeats = bp.reduce((sum, p) => sum + p.seatCount, 0);

      // Data-quality guard. Some IPU/Wikidata syncs end up summing seat
      // counts across multiple elections, so a country like Brazil
      // (513-seat lower house) reports its largest party with 443 seats
      // and other parties on top — total > 2,500. The hemicycle and
      // percentage labels are nonsensical in that state.
      //
      // Heuristic: if the sum of party seats exceeds the chamber total
      // by more than 20%, normalise each party's seat count to be the
      // proportion of the SUM, scaled into the chamber total. The
      // ranking order is preserved, the visualisation gets accurate
      // proportions, and percentages add up to 100%.
      const isAggregated =
        sumPartySeats > 0 && sumPartySeats > totalSeats * 1.2;

      let parties = bp.map((p, i) => {
        let slug = p.partyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        if (!slug || seen.has(slug)) slug = `${slug || "party"}-${i}`;
        seen.add(slug);
        const normalisedSeats = isAggregated
          ? Math.round((p.seatCount / sumPartySeats) * totalSeats)
          : p.seatCount;
        return {
          id: slug,
          name: p.partyName,
          seats: normalisedSeats,
          color: resolvePartyColor(p.partyColor, p.partyName, i),
        };
      });

      // After normalising, drop parties that rounded to zero so the
      // legend doesn't show a pile of "0 · 0.0%" rows.
      if (isAggregated) parties = parties.filter((p) => p.seats > 0);

      return {
        name: body.name,
        total: totalSeats,
        sub: `${totalSeats} seats`,
        parties,
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

/**
 * Per-country data-layer values for the /atlas map choropleth switcher.
 * Keyed by lower-case iso3 (the atlas `Country.id`), so the client can look
 * up a country's regime type and income group without
 * any client-side DB access.
 *
 * Mirrors the query shape of `getAlmanacFilterFacts` (queries.ts):
 *   - regime / income come from the canonical fact layer (`status='active'`
 *     rows of `vdem_row` / `world_bank_income_group`), preserving the
 *     human-readable upstream strings ("Liberal Democracy", "High income").
 */
export interface AtlasLayerValues {
  regimeType: string | null;
  incomeGroup: string | null;
}

/**
 * Provenance shared by every observation in one Atlas map layer. The client
 * receives this alongside the values so a legend and its tabular equivalent
 * can name the publisher and the exact retained source vintage rather than
 * implying that a Civica-derived score is being mapped.
 */
export interface AtlasLayerSource {
  sourceId: string;
  sourceName: string;
  sourceUrl: string | null;
  lastSyncedAt: string | null;
  upstreamVintageLabel: string | null;
  asOf: string | null;
  observedCountries: number;
}

export interface AtlasLayerData {
  values: Record<string, AtlasLayerValues>;
  sources: Record<"regime" | "income", AtlasLayerSource>;
}

export const loadAtlasLayerData = cache(_loadAtlasLayerData);

async function _loadAtlasLayerData(): Promise<AtlasLayerData> {
  // jurisdiction id → lower-case iso3 (atlas Country.id space)
  const juris = await db
    .select({ id: jurisdictions.id, iso3: jurisdictions.iso3 })
    .from(jurisdictions)
    .where(sql`${jurisdictions.iso3} IS NOT NULL`);
  const iso3ById = new Map(juris.map((j) => [j.id, j.iso3!.toLowerCase()]));

  const out: Record<string, AtlasLayerValues> = {};
  const ensure = (iso3: string) => {
    let entry = out[iso3];
    if (!entry) {
      entry = { regimeType: null, incomeGroup: null };
      out[iso3] = entry;
    }
    return entry;
  };

  // Every Atlas jurisdiction exists independently of optional research layers.
  // Missing regime or income observations remain explicit nulls.
  for (const jurisdiction of juris) ensure(jurisdiction.iso3!.toLowerCase());

  const sourceRows = await db
    .select({
      id: sources.id,
      name: sources.name,
      baseUrl: sources.baseUrl,
      lastSyncAt: sources.lastSyncAt,
    })
    .from(sources)
    .where(inArray(sources.id, ["vdem", "world_bank"]));
  const sourceById = new Map(sourceRows.map((source) => [source.id, source]));

  const defaultSource = (
    sourceId: "vdem" | "world_bank",
    sourceName: string,
    sourceUrl: string,
  ): AtlasLayerSource => {
    const source = sourceById.get(sourceId);
    return {
      sourceId,
      sourceName: source?.name ?? sourceName,
      sourceUrl: source?.baseUrl ?? sourceUrl,
      lastSyncedAt: isoTimestamp(source?.lastSyncAt),
      upstreamVintageLabel: null,
      asOf: null,
      observedCountries: 0,
    };
  };
  const layerSources: Record<"regime" | "income", AtlasLayerSource> = {
    regime: defaultSource(
      "vdem",
      "V-Dem",
      "https://www.v-dem.net/data/the-v-dem-dataset/",
    ),
    income: defaultSource(
      "world_bank",
      "World Bank",
      "https://api.worldbank.org/v2",
    ),
  };

  const factRows = await db
    .select({
      jurisdictionId: countryFacts.jurisdictionId,
      factKey: countryFacts.factKey,
      factValue: countryFacts.factValue,
      sourceId: countryFacts.sourceId,
      sourceUrl: countryFacts.sourceUrl,
      upstreamVintageLabel: countryFacts.upstreamVintageLabel,
      asOf: countryFacts.asOf,
    })
    .from(countryFacts)
    .where(
      and(
        sql`${countryFacts.status} = 'active'`,
        sql`(
          (${countryFacts.factKey} = 'vdem_row' AND ${countryFacts.sourceId} = 'vdem')
          OR
          (${countryFacts.factKey} = 'world_bank_income_group' AND ${countryFacts.sourceId} = 'world_bank')
        )`,
      ),
    );

  for (const row of factRows) {
    if (!row.factValue) continue;
    const iso3 = iso3ById.get(row.jurisdictionId);
    if (!iso3) continue;
    const entry = ensure(iso3);
    const layer =
      row.factKey === "vdem_row"
        ? "regime"
        : row.factKey === "world_bank_income_group"
          ? "income"
          : null;
    if (!layer) continue;

    if (layer === "regime") entry.regimeType = row.factValue;
    else entry.incomeGroup = row.factValue;

    const source = sourceById.get(row.sourceId);
    const layerSource = layerSources[layer];
    layerSource.observedCountries += 1;
    // A layer's active rows should share an upstream release. Keep the first
    // non-empty value as the public layer descriptor; individual country
    // rows remain available in their source-linked profile pages.
    if (!layerSource.upstreamVintageLabel && row.upstreamVintageLabel) {
      layerSource.upstreamVintageLabel = row.upstreamVintageLabel;
    }
    if (!layerSource.asOf && row.asOf) {
      layerSource.asOf = isoTimestamp(row.asOf);
    }
    if (source) {
      layerSource.sourceName = source.name;
      layerSource.lastSyncedAt = isoTimestamp(source.lastSyncAt);
    }
    if (row.sourceUrl) layerSource.sourceUrl = row.sourceUrl;
  }

  return { values: out, sources: layerSources };
}
