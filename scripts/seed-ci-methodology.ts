import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { ciMethodologyVersions, sources } from "../src/lib/db/schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sqlClient });

async function main() {
  console.log("Seeding CI methodology v1.0 and CI data sources...\n");

  await db
    .insert(ciMethodologyVersions)
    .values({
      id: "v1.0",
      publishedAt: new Date("2026-04-20"),
      weights: {
        democratic_quality: 0.3,
        rule_of_law: 0.2,
        human_development: 0.15,
        freedom_rights: 0.15,
        corruption_control: 0.1,
        stability_security: 0.1,
      },
      notes: "Initial CI methodology — 6 dimensions, min-max normalization",
    })
    .onConflictDoNothing();

  const ciSources = [
    {
      id: "vdem",
      name: "V-Dem (Varieties of Democracy)",
      baseUrl: "https://www.v-dem.net",
      license: "CC-BY-4.0",
      isCommercialUseAllowed: true,
    },
    {
      id: "worldbank_wgi",
      name: "World Bank Worldwide Governance Indicators",
      baseUrl: "https://info.worldbank.org/governance/wgi/",
      license: "CC-BY-4.0",
      isCommercialUseAllowed: true,
    },
    {
      id: "freedom_house",
      name: "Freedom House",
      baseUrl: "https://freedomhouse.org",
      license: "CC-BY-4.0",
      isCommercialUseAllowed: true,
    },
    {
      id: "global_peace_index",
      name: "Global Peace Index (IEP)",
      baseUrl: "https://www.visionofhumanity.org/maps/",
      license: "public-data",
      isCommercialUseAllowed: true,
    },
    {
      id: "fragile_states_index",
      name: "Fragile States Index (Fund for Peace)",
      baseUrl: "https://fragilestatesindex.org",
      license: "public-data",
      isCommercialUseAllowed: true,
    },
  ];

  for (const src of ciSources) {
    await db.insert(sources).values(src).onConflictDoNothing();
  }

  console.log("Done: methodology v1.0 + 5 new CI sources seeded.");
  console.log(
    "(undp_hdi and transparency_intl sources already exist from prior sync scripts)"
  );
}

main().catch(console.error);
