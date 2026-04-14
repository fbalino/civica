import { config } from "dotenv";
config({ path: ".env.local" });

import { execSync } from "child_process";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import {
  jurisdictions,
  countryFactbookSections,
  countryFacts,
  statements,
} from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const REPO_URL = "https://github.com/factbook/factbook.json.git";
const DATA_DIR = "/tmp/factbook-json";
const RETRIEVED_AT = new Date("2026-01-23");

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

function parseNumeric(text: string): { value: number | null; unit: string; year: number | null; note: string } {
  if (!text) return { value: null, unit: "", year: null, note: "" };

  let note = "";
  const yearMatch = text.match(/\((\d{4})\s*(?:est\.?|census)?\)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  if (yearMatch) note = yearMatch[0];

  let cleaned = text.replace(/\(.*?\)/g, "").trim();
  let unit = "";

  if (cleaned.startsWith("$")) {
    unit = "$";
    cleaned = cleaned.slice(1).trim();
  }

  if (cleaned.endsWith("%")) {
    unit = "%";
    cleaned = cleaned.replace(/%$/, "").trim();
  }

  cleaned = cleaned.replace(/,/g, "");

  let multiplier = 1;
  if (/trillion/i.test(cleaned)) {
    multiplier = 1e12;
    cleaned = cleaned.replace(/\s*trillion/i, "");
  } else if (/billion/i.test(cleaned)) {
    multiplier = 1e9;
    cleaned = cleaned.replace(/\s*billion/i, "");
  } else if (/million/i.test(cleaned)) {
    multiplier = 1e6;
    cleaned = cleaned.replace(/\s*million/i, "");
  }

  const numMatch = cleaned.match(/-?[\d.]+/);
  const value = numMatch ? parseFloat(numMatch[0]) * multiplier : null;

  return { value, unit, year, note };
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

function extractText(obj: unknown): string {
  if (!obj) return "";
  if (typeof obj === "string") return decodeHtmlEntities(obj);
  if (typeof obj === "object" && "text" in (obj as Record<string, unknown>)) {
    return decodeHtmlEntities(String((obj as Record<string, unknown>).text));
  }
  return decodeHtmlEntities(String(obj));
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
}

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
    const parsed = parseNumeric(text);
    facts.push({
      category,
      factKey,
      factValue: text,
      factValueNumeric: parsed.value,
      factUnit: overrideUnit ?? parsed.unit,
      factYear: parsed.year,
      sourceNote: parsed.note,
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
    addFact("demographics", "languages", getNestedValue(people, "Languages"));
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
  const popParsed = parseNumeric(popText);

  const areaText = extractText(getNestedValue(geo ?? {}, "Area", "total"));
  const areaParsed = parseNumeric(areaText);

  const gdpText = (() => {
    const gdpPPP = getNestedValue(econ ?? {}, "Real GDP (purchasing power parity)");
    if (gdpPPP && typeof gdpPPP === "object") {
      const entries = Object.entries(gdpPPP as Record<string, unknown>);
      return entries.length > 0 ? extractText(entries[0][1]) : "";
    }
    return "";
  })();
  const gdpParsed = parseNumeric(gdpText);
  const gdpBillions = gdpParsed.value ? gdpParsed.value / 1e9 : null;

  const languages = extractText(getNestedValue(people ?? {}, "Languages", "Languages"));
  const currency = extractText(getNestedValue(econ ?? {}, "Exchange rates", "Currency"));

  return {
    name: countryName,
    governmentType: slugify(govType).replace(/-/g, "_") || null,
    governmentTypeDetail: govType || null,
    capital: capital || null,
    population: popParsed.value ? Math.round(popParsed.value) : null,
    areaSqKm: areaParsed.value ? Math.round(areaParsed.value) : null,
    gdpBillions,
    languages: languages || null,
    currency: currency || null,
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

  const profile = extractProfileFields(data);
  if (!profile.name) {
    return;
  }

  const slug = slugify(profile.name);
  const continent = REGION_TO_CONTINENT[region] ?? "Unknown";

  // Upsert jurisdiction
  const existing = await db
    .select({ id: jurisdictions.id })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);

  let jurisdictionId: string;

  if (existing.length > 0) {
    jurisdictionId = existing[0].id;
    await db
      .update(jurisdictions)
      .set({
        ...profile,
        continent,
        type: "sovereign_state",
        updatedAt: new Date(),
      })
      .where(eq(jurisdictions.id, jurisdictionId));
  } else {
    const inserted = await db
      .insert(jurisdictions)
      .values({
        slug,
        ...profile,
        continent,
        type: "sovereign_state",
      })
      .returning({ id: jurisdictions.id });
    jurisdictionId = inserted[0].id;
  }

  // Import all sections as JSONB
  const sectionKeys = Object.keys(data);
  for (const sectionKey of sectionKeys) {
    const normalizedSection = normalizeKey(sectionKey);
    const sectionData = data[sectionKey];
    if (!sectionData || typeof sectionData !== "object") continue;

    const displayOrder = SECTION_ORDER[normalizedSection] ?? 99;

    await db
      .insert(countryFactbookSections)
      .values({
        jurisdictionId,
        sectionName: normalizedSection,
        sectionData,
        displayOrder,
        importPhase: 1,
      })
      .onConflictDoUpdate({
        target: [
          countryFactbookSections.jurisdictionId,
          countryFactbookSections.sectionName,
        ],
        set: {
          sectionData,
          displayOrder,
          updatedAt: new Date(),
        },
      });
    stats.sections++;
  }

  // Extract queryable facts
  const facts = extractFacts(data);
  for (const fact of facts) {
    if (!fact.factValue) continue;

    await db
      .insert(countryFacts)
      .values({
        jurisdictionId,
        ...fact,
      })
      .onConflictDoUpdate({
        target: [countryFacts.jurisdictionId, countryFacts.factKey],
        set: {
          factValue: fact.factValue,
          factValueNumeric: fact.factValueNumeric,
          factUnit: fact.factUnit,
          factYear: fact.factYear,
          sourceNote: fact.sourceNote,
        },
      });
    stats.facts++;
  }

  // Provenance statement for the jurisdiction
  await db.insert(statements).values({
    subjectTable: "jurisdictions",
    subjectId: jurisdictionId,
    predicate: "factbook_import",
    objectValue: `Imported from CIA World Factbook archive`,
    sourceId: "cia_factbook",
    sourceLicense: "public_domain",
    retrievedAt: RETRIEVED_AT,
  });

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
