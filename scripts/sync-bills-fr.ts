import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { runBillsSync } from "../src/lib/bills/sync";
import { fetchFRBillsForSync } from "../src/lib/bills/sources/an-senat-fr";

async function main() {
  console.log("=== Civica Bills · France (Assemblée + Sénat) sync ===\n");
  const summary = await runBillsSync(db, {
    jurisdictionSlug: "france",
    iso2: "FR",
    fetchDrafts: ({ jurisdictionId }) =>
      fetchFRBillsForSync({ jurisdictionId, db, limit: 50 }),
  });

  console.log("=== Sync complete ===");
  console.log(`Jurisdiction:         ${summary.jurisdictionId}`);
  console.log(`Fetched:              ${summary.fetched}`);
  console.log(`Inserted:             ${summary.inserted}`);
  console.log(`Updated:              ${summary.updated}`);
  console.log(`Summarised (new):     ${summary.summarised}`);
  console.log(`Sources stamped:      ${summary.sourcesStamped.join(", ")}`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
