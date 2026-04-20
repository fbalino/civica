import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sources, metricDefinitions } from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const SOURCES = [
  {
    id: "cia_factbook",
    name: "CIA World Factbook",
    baseUrl: "https://github.com/factbook/factbook.json",
    license: "public_domain",
    isCommercialUseAllowed: true,
    lastSyncAt: new Date("2026-01-23"),
  },
  {
    id: "wikidata",
    name: "Wikidata",
    baseUrl: "https://query.wikidata.org/sparql",
    license: "CC0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "ipu_parline",
    name: "IPU Parline",
    baseUrl: "https://api.data.ipu.org/v1",
    license: "CC-BY-NC-SA-4.0",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "constitute_project",
    name: "Constitute Project",
    baseUrl: "https://www.constituteproject.org/service/",
    license: "non-commercial",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "parlgov",
    name: "ParlGov",
    baseUrl: "https://www.parlgov.org/",
    license: "unspecified",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "congress_gov",
    name: "Congress.gov",
    baseUrl: "https://api.congress.gov/v3",
    license: "public_domain",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "uk_parliament",
    name: "UK Parliament",
    baseUrl: "https://members-api.parliament.uk/api",
    license: "open_parliament_licence",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "eu_parliament",
    name: "European Parliament",
    baseUrl: "https://data.europarl.europa.eu/api/v2",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "undp_hdi",
    name: "UNDP Human Development Reports",
    baseUrl: "https://hdr.undp.org/data-center/documentation-and-downloads",
    license: "CC-BY-3.0-IGO",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "transparency_intl",
    name: "Transparency International CPI",
    baseUrl: "https://www.transparency.org/en/cpi",
    license: "CC-BY-ND-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "world_happiness",
    name: "World Happiness Report",
    baseUrl: "https://worldhappiness.report/data/",
    license: "open_data",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "world_bank",
    name: "World Bank Open Data",
    baseUrl: "https://api.worldbank.org/v2",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "rsf_press_freedom",
    name: "Reporters Without Borders Press Freedom Index",
    baseUrl: "https://rsf.org/en/index",
    license: "open_data",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "unodc",
    name: "UNODC Crime Statistics",
    baseUrl: "https://dataunodc.un.org/",
    license: "open_data",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
];

const METRIC_DEFINITIONS = [
  {
    id: "hdi",
    name: "Human Development Index",
    description: "Composite index of life expectancy, education, and per capita income",
    category: "society",
    unit: "index (0–1)",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 1,
    defaultSourceId: "undp_hdi",
  },
  {
    id: "cpi",
    name: "Corruption Perceptions Index",
    description: "Perceived levels of public sector corruption on a scale of 0 (highly corrupt) to 100 (very clean)",
    category: "governance",
    unit: "score (0–100)",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "transparency_intl",
  },
  {
    id: "happiness_score",
    name: "World Happiness Score",
    description: "Life evaluation score based on the Cantril ladder question (0 worst to 10 best)",
    category: "society",
    unit: "score (0–10)",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 10,
    defaultSourceId: "world_happiness",
  },
  {
    id: "press_freedom",
    name: "Press Freedom Index",
    description: "Score measuring the level of press freedom, lower is better",
    category: "governance",
    unit: "score (0–100)",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "rsf_press_freedom",
  },
  {
    id: "life_expectancy",
    name: "Life Expectancy at Birth",
    description: "Average number of years a newborn is expected to live",
    category: "health",
    unit: "years",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 120,
    defaultSourceId: "world_bank",
  },
  {
    id: "gdp_per_capita",
    name: "GDP per Capita (current US$)",
    description: "Gross domestic product divided by midyear population",
    category: "economy",
    unit: "USD",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: null,
    defaultSourceId: "world_bank",
  },
  {
    id: "unemployment_rate",
    name: "Unemployment Rate",
    description: "Share of the labor force that is without work but available and seeking employment",
    category: "economy",
    unit: "percent",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "world_bank",
  },
  {
    id: "homicide_rate",
    name: "Intentional Homicide Rate",
    description: "Number of intentional homicides per 100,000 population",
    category: "security",
    unit: "per 100k",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: null,
    defaultSourceId: "unodc",
  },
  {
    id: "gini_index",
    name: "Gini Index",
    description: "Measure of income inequality, 0 is perfect equality, 100 is perfect inequality",
    category: "economy",
    unit: "index (0–100)",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "world_bank",
  },
  {
    id: "school_enrollment_tertiary",
    name: "School Enrollment, Tertiary",
    description: "Gross enrollment ratio in tertiary education regardless of age",
    category: "education",
    unit: "percent",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: null,
    defaultSourceId: "world_bank",
  },
];

async function main() {
  console.log("Seeding sources table...");

  for (const source of SOURCES) {
    await db
      .insert(sources)
      .values(source)
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          name: source.name,
          baseUrl: source.baseUrl,
          license: source.license,
          isCommercialUseAllowed: source.isCommercialUseAllowed,
        },
      });
    console.log(`  ✓ ${source.id}`);
  }

  console.log(`Done. ${SOURCES.length} sources seeded.`);

  console.log("\nSeeding metric definitions...");
  for (const metric of METRIC_DEFINITIONS) {
    await db
      .insert(metricDefinitions)
      .values(metric)
      .onConflictDoUpdate({
        target: metricDefinitions.id,
        set: {
          name: metric.name,
          description: metric.description,
          category: metric.category,
          unit: metric.unit,
          higherIsBetter: metric.higherIsBetter,
          valueMin: metric.valueMin,
          valueMax: metric.valueMax,
          defaultSourceId: metric.defaultSourceId,
        },
      });
    console.log(`  ✓ ${metric.id}`);
  }
  console.log(`Done. ${METRIC_DEFINITIONS.length} metric definitions seeded.`);
}

main().catch((err) => {
  console.error("Failed to seed sources:", err);
  process.exit(1);
});
