import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sources } from "../src/lib/db/schema";

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
}

main().catch((err) => {
  console.error("Failed to seed sources:", err);
  process.exit(1);
});
