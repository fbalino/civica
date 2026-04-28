import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { runBillsSync } from "../src/lib/bills/sync";
import { fetchUSBillsForSync } from "../src/lib/bills/sources/us-congress";

async function main() {
  console.log("=== Civica Bills · US Congress sync ===\n");
  const summary = await runBillsSync(db, {
    jurisdictionSlug: "united-states",
    iso2: "US",
    fetchDrafts: ({ jurisdictionId }) =>
      fetchUSBillsForSync({ jurisdictionId, limit: 100 }),
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
