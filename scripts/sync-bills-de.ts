import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { runBillsSync } from "../src/lib/bills/sync";
import { fetchDEBillsForSync } from "../src/lib/bills/sources/bundestag-dip";

async function main() {
  console.log("=== Civica Bills · Germany (Bundestag DIP) sync ===\n");
  const summary = await runBillsSync(db, {
    jurisdictionSlug: "germany",
    iso2: "DE",
    fetchDrafts: ({ jurisdictionId }) =>
      fetchDEBillsForSync({ jurisdictionId, db, limit: 100 }),
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
