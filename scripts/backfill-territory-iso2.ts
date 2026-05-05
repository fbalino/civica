import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { jurisdictions } from "../src/lib/db/schema";
import { TERRITORY_ISO2_BY_SLUG } from "../src/lib/data/territory-iso2";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("=== Territory ISO2 backfill ===");
  console.log(dryRun ? "Mode: dry run" : "Mode: write");

  const rows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions);

  let updated = 0;
  let alreadySet = 0;
  let missing = 0;
  const wouldUpdate: Array<{ slug: string; name: string; iso2: string }> = [];

  for (const [slug, iso2] of Object.entries(TERRITORY_ISO2_BY_SLUG)) {
    const row = rows.find((candidate) => candidate.slug === slug);
    if (!row) {
      missing++;
      console.log(`  ! ${slug}: jurisdiction row not found`);
      continue;
    }

    if (row.iso3) {
      throw new Error(
        `${slug} already has iso3=${row.iso3}; refusing ISO2-only territory backfill`
      );
    }

    if (row.iso2) {
      alreadySet++;
      if (row.iso2 !== iso2) {
        throw new Error(`${slug} has iso2=${row.iso2}, expected ${iso2}`);
      }
      continue;
    }

    wouldUpdate.push({ slug, name: row.name, iso2 });
    if (!dryRun) {
      await db
        .update(jurisdictions)
        .set({ iso2, updatedAt: new Date() })
        .where(eq(jurisdictions.id, row.id));
    }
    updated++;
    console.log(`  ${dryRun ? "would set" : "set"} ${row.name}: iso2=${iso2}`);
  }

  console.log("\n=== Done ===");
  console.log(`Updated:     ${updated}`);
  console.log(`Already set: ${alreadySet}`);
  console.log(`Missing:     ${missing}`);

  if (dryRun && wouldUpdate.length > 0) {
    console.log("\nDry-run rows:");
    console.table(wouldUpdate);
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
