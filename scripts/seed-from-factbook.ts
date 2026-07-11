import { config } from "dotenv";
config({ path: ".env.local" });

import { execSync } from "child_process";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import {
  jurisdictions,
} from "../src/lib/db/schema";
import { classifyJurisdictionStatus } from "../src/lib/jurisdictions/status-taxonomy";
import countryGalleries from "../src/lib/data/country-galleries.generated.json";
import { markSourcesSynced } from "../src/lib/db/source-freshness";
import { writeAtlasCountry, type AtlasSectionInput } from "../src/lib/factbook/atlas-seed-writer";
import { parseFactbookNumeric } from "../src/lib/factbook/numeric-validation";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const REPO_URL = "https://github.com/factbook/factbook.json.git";
const DATA_DIR = "/tmp/factbook-json";
const DRY_RUN = process.argv.includes("--dry-run");

const FACTBOOK_SLUG_ISO3_OVERRIDES: Record<string, string> = {
  burma: "MMR",
  "cabo-verde": "CPV",
  china: "CHN",
  "congo-brazzaville": "COG",
  czechia: "CZE",
  "c-te-d-ivoire": "CIV",
  drc: "COD",
  "holy-see-vatican-city": "VAT",
  micronesia: "FSM",
  netherlands: "NLD",
  palestine: "PSE",
  "the-dominican": "DOM",
};

const REGIONS = [
  "africa",
  "antarctica",
  "australia-oceania",
  "central-america-n-caribbean",
  "central-asia",
  "east-n-southeast-asia",
  "europe",
  "middle-east",
  "north-america",
  "south-america",
  "south-asia",
];

const REGION_TO_CONTINENT: Record<string, string> = {
  africa: "Africa",
  antarctica: "Antarctica",
  "australia-oceania": "Oceania",
  "central-america-n-caribbean": "North America",
  "central-asia": "Asia",
  "east-n-southeast-asia": "Asia",
  europe: "Europe",
  "middle-east": "Asia",
  "north-america": "North America",
  "south-america": "South America",
  "south-asia": "Asia",
};

const SECTION_ORDER: Record<string, number> = {
  introduction: 0,
  geography: 1,
  "people_and_society": 2,
  environment: 3,
  government: 4,
  economy: 5,
  energy: 6,
  communications: 7,
  transportation: 8,
  "military_and_security": 9,
  space: 10,
  terrorism: 11,
  "transnational_issues": 12,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

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
 * Canonical extraction helper, ported from
 * `src/lib/atlas/load-atlas-data.ts:137–148` per Bug 3 resolution
 * v1.0 (`~/civica/plan/factbook-prose-extraction-v1.md`).
 *
 * Honest about absence: returns `null` when the input is missing,
 * empty, or the literal `"[object Object]"` artifact. Recursively
 * descends `{text}` shapes so wrapped CIA prose
 * (`{Languages: {text}, ...}`) is handled symmetrically with flat
 * (`{text, note}`).
 *
 * The pre-Bug-3 implementation fell through to `String(obj)` on
 * objects without a top-level `text` key and produced the literal
 * `"[object Object]"` for 139 of 235 jurisdictions on the
 * `languages` fact-key (and 1 each on `exports_total` /
 * `imports_total` for Western Sahara). Audit + root-cause analysis
 * documented in the resolution doc § 1 and § 2a.
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

function getNestedValue(data: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = data;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    const obj = current as Record<string, unknown>;
    const found = Object.keys(obj).find(
      (k) => normalizeKey(k) === normalizeKey(key)
    );
    current = found ? obj[found] : undefined;
  }
  return current;
}

interface FactExtraction {
  category: string;
  factKey: string;
  factValue: string;
  factValueNumeric: number | null;
  factUnit: string;
  factYear: number | null;
  sourceNote: string;
  /** Real underlying measurement year when it differs from CIA's prose
   *  stamp (`factYear`). Non-null only for the five demographic keys
   *  whose CIA "(YYYY est.)" stamp is a projection one year ahead of the
   *  measurement vintage. See `CIA_VINTAGE_OFFSET_KEYS` and
   *  `~/civica/plan/cia-stale-vintage-resolution-v1.md` (Option A). */
  dataVintageYear: number | null;
}

/**
 * CIA constructs these five demographic estimates as current-year
 * projections off prior-year UN World Population Prospects / US Census
 * reference data, and stamps them "(YYYY est.)". The true measurement
 * vintage is one year older than the stamp, so a future re-sync records
 * `data_vintage_year = factYear - 1` for these keys — WITHOUT mutating
 * CIA's original `factYear`. The seed-time key for population is the
 * legacy `population` alias (bridged to `population_total` downstream by
 * `scripts/bridge-cia-legacy-to-canonical.ts`, which carries this value
 * across); the other four seed directly under their canonical names.
 *
 * Every other CIA fact-key leaves `data_vintage_year` NULL — its stamp
 * IS its measurement year, and the resolver falls back to the standard
 * `as_of || fact_year || retrieved_at` freshness ladder. No false
 * precision. Contract: `~/civica/plan/cia-stale-vintage-resolution-v1.md`.
 */
const CIA_VINTAGE_OFFSET_KEYS = new Set<string>([
  "population",
  "birth_rate",
  "death_rate",
  "population_growth_rate",
  "median_age",
]);

function extractFacts(data: Record<string, unknown>): FactExtraction[] {
  const facts: FactExtraction[] = [];

  function addFact(
    category: string,
    factKey: string,
    raw: unknown,
    overrideUnit?: string
  ) {
    const text = extractText(raw);
    if (!text) return;
    const parsed = parseFactbookNumeric(text, overrideUnit);
    // CIA's "(YYYY est.)" stamp on the five demographic keys is a
    // projection year one ahead of the underlying measurement vintage.
    // Record the real measurement year so the resolver's freshness
    // comparator ranks a primary publisher's actual measurement ahead
    // of CIA's republication stamp.
    //
    // Gate on the "est." qualifier: only an ESTIMATE stamp is a
    // current-year projection off prior-year data. A bare "(YYYY)" stamp
    // (or "(YYYY census)") is a real measurement in that year — leaving
    // its vintage NULL keeps a genuine census figure (Falkland Islands,
    // Vatican City, Norfolk Island…) from being wrongly aged below a
    // UN/WB nowcast. This is Risk 1 in the resolution doc
    // (~/civica/plan/cia-stale-vintage-resolution-v1.md §7). Only when a
    // year was parsed AND the stamp is an estimate (no false precision).
    const isEstimateStamp = /\best\.?/i.test(parsed.note ?? "");
    const dataVintageYear =
      parsed.year != null &&
      CIA_VINTAGE_OFFSET_KEYS.has(factKey) &&
      isEstimateStamp
        ? parsed.year - 1
        : null;
    facts.push({
      category,
      factKey,
      factValue: text,
      factValueNumeric: parsed.value,
      factUnit: overrideUnit ?? parsed.unit,
      factYear: parsed.year,
      sourceNote: parsed.note,
      dataVintageYear,
    });
  }

  // Economy
  const economy = data["Economy"] as Record<string, unknown> | undefined;
  if (economy) {
    const gdpPPP = getNestedValue(economy, "Real GDP (purchasing power parity)");
    if (gdpPPP && typeof gdpPPP === "object") {
      const gdpEntries = Object.entries(gdpPPP as Record<string, unknown>);
      if (gdpEntries.length > 0) addFact("economy", "gdp_ppp", gdpEntries[0][1], "$");
    }

    const gdpGrowth = getNestedValue(economy, "Real GDP growth rate");
    if (gdpGrowth && typeof gdpGrowth === "object") {
      const entries = Object.entries(gdpGrowth as Record<string, unknown>);
      if (entries.length > 0) addFact("economy", "gdp_growth_rate", entries[0][1], "%");
    }

    const gdpPerCapita = getNestedValue(economy, "Real GDP per capita");
    if (gdpPerCapita && typeof gdpPerCapita === "object") {
      const entries = Object.entries(gdpPerCapita as Record<string, unknown>);
      if (entries.length > 0) addFact("economy", "gdp_per_capita_ppp", entries[0][1], "$");
    }

    const inflation = getNestedValue(economy, "Inflation rate (consumer prices)");
    if (inflation && typeof inflation === "object") {
      const entries = Object.entries(inflation as Record<string, unknown>);
      if (entries.length > 0) addFact("economy", "inflation_rate", entries[0][1], "%");
    }

    const unemployment = getNestedValue(economy, "Unemployment rate");
    if (unemployment && typeof unemployment === "object") {
      const entries = Object.entries(unemployment as Record<string, unknown>);
      if (entries.length > 0) addFact("economy", "unemployment_rate", entries[0][1], "%");
    }

    const exportsObj = getNestedValue(economy, "Exports");
    if (exportsObj && typeof exportsObj === "object") {
      const entries = Object.entries(exportsObj as Record<string, unknown>).filter(([k]) => k !== "note");
      if (entries.length > 0) addFact("economy", "exports_total", entries[0][1], "$");
    }
    const importsObj = getNestedValue(economy, "Imports");
    if (importsObj && typeof importsObj === "object") {
      const entries = Object.entries(importsObj as Record<string, unknown>).filter(([k]) => k !== "note");
      if (entries.length > 0) addFact("economy", "imports_total", entries[0][1], "$");
    }

    const publicDebt = getNestedValue(economy, "Public debt");
    if (publicDebt && typeof publicDebt === "object") {
      const entries = Object.entries(publicDebt as Record<string, unknown>);
      if (entries.length > 0) addFact("economy", "public_debt_pct_gdp", entries[0][1], "% of GDP");
    }

    addFact("economy", "industries", getNestedValue(economy, "Industries"));
    addFact("economy", "agriculture_products", getNestedValue(economy, "Agricultural products"));

    const exportPartners = getNestedValue(economy, "Exports - partners");
    addFact("economy", "export_partners", exportPartners);
    const importPartners = getNestedValue(economy, "Imports - partners");
    addFact("economy", "import_partners", importPartners);
    const exportCommodities = getNestedValue(economy, "Exports - commodities");
    addFact("economy", "export_commodities", exportCommodities);

    const budget = getNestedValue(economy, "Budget");
    if (budget && typeof budget === "object") {
      const b = budget as Record<string, unknown>;
      addFact("economy", "budget_revenue", b["revenues"], "$");
      addFact("economy", "budget_expenditure", b["expenditures"], "$");
    }
  }

  // Demographics
  const people = data["People and Society"] as Record<string, unknown> | undefined;
  if (people) {
    const pop = getNestedValue(people, "Population", "total");
    addFact("demographics", "population", pop, "persons");

    const popGrowth = getNestedValue(people, "Population growth rate");
    addFact("demographics", "population_growth_rate", popGrowth, "%");

    const birthRate = getNestedValue(people, "Birth rate");
    addFact("demographics", "birth_rate", birthRate, "per 1000");

    const deathRate = getNestedValue(people, "Death rate");
    addFact("demographics", "death_rate", deathRate, "per 1000");

    const medianAge = getNestedValue(people, "Median age", "total");
    addFact("demographics", "median_age", medianAge, "years");

    const lifeExp = getNestedValue(people, "Life expectancy at birth", "total population");
    addFact("demographics", "life_expectancy", lifeExp, "years");

    const literacy = getNestedValue(people, "Literacy", "total population");
    addFact("demographics", "literacy_rate", literacy, "%");

    const urbanization = getNestedValue(people, "Urbanization", "urban population");
    addFact("demographics", "urbanization_rate", urbanization, "%");

    addFact("demographics", "ethnic_groups", getNestedValue(people, "Ethnic groups"));
    addFact("demographics", "religions", getNestedValue(people, "Religions"));

    // CIA prose has two mutually exclusive shapes for `Languages`
    // (audit Section 2a in `~/civica/plan/factbook-prose-extraction-v1.md`):
    //   - flat (96 jurisdictions): {text, note}
    //   - wrapped (139 jurisdictions): {Languages: {text}, "major-language sample(s)": {...}, note}
    // Try wrapped first (descends two levels) and fall back to flat
    // (one level). `extractText` correctly descends a `{text}` shape;
    // the previous `getNestedValue(people, "Languages")`-only call
    // was the source of the 139-row `[object Object]` corruption.
    const langWrapped = getNestedValue(people, "Languages", "Languages");
    const langFlat = getNestedValue(people, "Languages");
    addFact("demographics", "languages", langWrapped ?? langFlat);
  }

  // Geography
  const geo = data["Geography"] as Record<string, unknown> | undefined;
  if (geo) {
    const area = getNestedValue(geo, "Area", "total");
    addFact("geography", "total_area", area, "sq km");
    const land = getNestedValue(geo, "Area", "land");
    addFact("geography", "land_area", land, "sq km");
    const water = getNestedValue(geo, "Area", "water");
    addFact("geography", "water_area", water, "sq km");
    const coastline = getNestedValue(geo, "Coastline");
    addFact("geography", "coastline", coastline, "km");
    addFact("geography", "natural_resources", getNestedValue(geo, "Natural resources"));
    addFact("geography", "climate", getNestedValue(geo, "Climate"));
    addFact("geography", "terrain", getNestedValue(geo, "Terrain"));
  }

  // Military
  const military = data["Military and Security"] as Record<string, unknown> | undefined;
  if (military) {
    const milExp = getNestedValue(military, "Military expenditures");
    if (milExp && typeof milExp === "object") {
      const entries = Object.entries(milExp as Record<string, unknown>);
      if (entries.length > 0) addFact("military", "military_expenditure_pct_gdp", entries[0][1], "% of GDP");
    }
    addFact("military", "military_branches", getNestedValue(military, "Military and security forces"));
    addFact("military", "military_service_age", getNestedValue(military, "Military service age and obligation"));
  }

  // Energy
  const energy = data["Energy"] as Record<string, unknown> | undefined;
  if (energy) {
    const elecAccess = getNestedValue(energy, "Electricity access", "electrification - total population");
    addFact("energy", "electricity_access", elecAccess, "%");
    const co2 = getNestedValue(energy, "Carbon dioxide emissions");
    if (co2 && typeof co2 === "object") {
      const entries = Object.entries(co2 as Record<string, unknown>);
      if (entries.length > 0) addFact("energy", "co2_emissions", entries[0][1], "metric tonnes");
    }
  }

  return facts;
}

function extractProfileFields(data: Record<string, unknown>) {
  const gov = data["Government"] as Record<string, unknown> | undefined;
  const geo = data["Geography"] as Record<string, unknown> | undefined;
  const people = data["People and Society"] as Record<string, unknown> | undefined;
  const econ = data["Economy"] as Record<string, unknown> | undefined;

  const countryName = extractText(
    getNestedValue(gov ?? {}, "Country name", "conventional short form")
  );

  const govType = extractText(getNestedValue(gov ?? {}, "Government type"));
  const capital = extractText(getNestedValue(gov ?? {}, "Capital", "name"));

  const popText = extractText(getNestedValue(people ?? {}, "Population", "total"));
  const popParsed = parseFactbookNumeric(popText, "people");

  const areaText = extractText(getNestedValue(geo ?? {}, "Area", "total"));
  const areaParsed = parseFactbookNumeric(areaText, "sq km");

  const gdpText = (() => {
    const gdpPPP = getNestedValue(econ ?? {}, "Real GDP (purchasing power parity)");
    if (gdpPPP && typeof gdpPPP === "object") {
      const entries = Object.entries(gdpPPP as Record<string, unknown>);
      return entries.length > 0 ? extractText(entries[0][1]) : null;
    }
    return null;
  })();
  const gdpParsed = parseFactbookNumeric(gdpText, "$ ");
  const gdpBillions = gdpParsed.value ? gdpParsed.value / 1e9 : null;

  // Same wrapped-then-flat shape-awareness as extractFacts() above.
  // Pre-Bug-3 the wrapped-only path silently returned null for
  // flat-shape jurisdictions (Andorra, Angola, US, Nigeria, ...) —
  // a separate, smaller bug masked by the fact that those
  // jurisdictions also had a working `country_facts.languages` row
  // via the flat-shape path in extractFacts().
  const languages =
    extractText(getNestedValue(people ?? {}, "Languages", "Languages")) ??
    extractText(getNestedValue(people ?? {}, "Languages"));

  // Currency: decoupled per Bug 3 resolution v1.0 § 2f, OQ2.
  // CIA's `Economy.Exchange rates.Currency` field is the
  // exchange-rate-denominator description (e.g.
  // "nairas (NGN) per US dollar -"), not an ISO 4217 code.
  // Phase F's canonical `currency_code` ingests from World Bank
  // (Phase R.6/R.7). Until then, `jurisdictions.currency` stays
  // null and the atlas masthead's `formatCurrency` helper degrades
  // gracefully to "—".
  const currency: string | null = null;

  return {
    name: countryName,
    governmentType: govType ? slugify(govType).replace(/-/g, "_") || null : null,
    governmentTypeDetail: govType || null,
    capital: capital || null,
    population: popParsed.value ? Math.round(popParsed.value) : null,
    areaSqKm: areaParsed.value ? Math.round(areaParsed.value) : null,
    gdpBillions,
    languages: languages || null,
    currency,
  };
}

async function cloneFactbook() {
  if (existsSync(join(DATA_DIR, ".git"))) {
    console.log("Factbook repo already cloned, pulling latest...");
    execSync("git pull", { cwd: DATA_DIR, stdio: "inherit" });
  } else {
    console.log("Cloning factbook.json repository...");
    if (existsSync(DATA_DIR)) {
      execSync(`rm -rf ${DATA_DIR}`);
    }
    execSync(`git clone --depth 1 ${REPO_URL} ${DATA_DIR}`, {
      stdio: "inherit",
    });
  }
}

async function processCountryFile(
  filePath: string,
  region: string,
  stats: { countries: number; sections: number; facts: number; errors: number }
) {
  const raw = readFileSync(filePath, "utf-8");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`  ✗ Failed to parse: ${filePath}`);
    stats.errors++;
    return;
  }

  const gov = data["Government"] as Record<string, unknown> | undefined;
  if (!gov) {
    return;
  }

  const rawProfile = extractProfileFields(data);
  if (!rawProfile.name) {
    return;
  }
  // Narrow `name` from `string | null` to `string` for the
  // schema's notNull() constraint. The earlier `if (!rawProfile.name)`
  // guard already filters CIA entries with no resolvable country
  // name (territories without Government sections are filtered
  // upstream at line 461).
  const profile = { ...rawProfile, name: rawProfile.name };

  const slug = slugify(profile.name);
  const continent = REGION_TO_CONTINENT[region] ?? "Unknown";

  const dependencyStatus =
    (gov["Dependency status"] as { text?: string } | undefined)?.text
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? null;

  // Upsert jurisdiction
  const existing = await db
    .select({ id: jurisdictions.id, iso3: jurisdictions.iso3 })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);

  const catalogIso3 =
    existing[0]?.iso3 ??
    FACTBOOK_SLUG_ISO3_OVERRIDES[slug] ??
    countryGalleries.slugIndex[
      slug as keyof typeof countryGalleries.slugIndex
    ] ??
    null;
  const status = classifyJurisdictionStatus({
    slug,
    iso3: catalogIso3,
    dependencyStatus,
  });
  const statusFields = {
    type: status.type,
    statusSourceIds: status.sourceIds,
    statusReviewedAt: status.reviewedAt,
    statusNote: status.note,
    administeringJurisdictionIso3: status.administeringJurisdictionIso3,
    statusDisputed: status.disputed,
    iso3:
      status.type === "sovereign_state" ||
      status.type === "disputed_or_limited_recognition"
        ? catalogIso3
        : existing[0]?.iso3 ?? null,
  };

  const sectionKeys = Object.keys(data);
  const sectionInputs: AtlasSectionInput[] = [];
  for (const sectionKey of sectionKeys) {
    const normalizedSection = normalizeKey(sectionKey);
    const sectionData = data[sectionKey];
    if (!sectionData || typeof sectionData !== "object") continue;

    const displayOrder = SECTION_ORDER[normalizedSection] ?? 99;

    sectionInputs.push({ sectionName: normalizedSection, sectionData, displayOrder });
    stats.sections++;
  }

  // Extract queryable facts
  const facts = extractFacts(data);
  const validFacts = facts.filter((fact) => Boolean(fact.factValue));
  stats.facts += validFacts.length;
  await writeAtlasCountry(db as never, { existingId: existing[0]?.id ?? null, jurisdiction: { slug, ...profile, continent, ...statusFields }, sections: sectionInputs, facts: validFacts }, { dryRun: DRY_RUN });

  stats.countries++;
  console.log(
    `  ✓ ${profile.name} (${slug}) — ${sectionKeys.length} sections, ${facts.length} facts`
  );
}

async function main() {
  console.log("=== CIA World Factbook Seed Script ===\n");

  await cloneFactbook();

  const stats = { countries: 0, sections: 0, facts: 0, errors: 0 };

  for (const region of REGIONS) {
    const regionDir = join(DATA_DIR, region);
    if (!existsSync(regionDir)) {
      console.log(`Skipping ${region} (not found)`);
      continue;
    }

    console.log(`\nProcessing region: ${region}`);
    const files = readdirSync(regionDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      await processCountryFile(join(regionDir, file), region, stats);
    }
  }

  await markSourcesSynced("cia_factbook", { rowsWritten: stats.facts, dryRun: DRY_RUN });

  console.log("\n=== Import Complete ===");
  console.log(`Countries: ${stats.countries}`);
  console.log(`Sections:  ${stats.sections}`);
  console.log(`Facts:     ${stats.facts}`);
  console.log(`Errors:    ${stats.errors}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
