import { config } from "dotenv";
// override: true so values in .env.local win over a shell that may
// have empty placeholders (e.g. `ANTHROPIC_API_KEY=` exported globally).
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { runBillsSync } from "../src/lib/bills/sync";
import { fetchCABillsForSync } from "../src/lib/bills/sources/legisinfo-ca";

async function main() {
  console.log("=== Civica Bills · Canada (LEGISinfo) sync ===\n");
  const summary = await runBillsSync(db, {
    jurisdictionSlug: "canada",
    iso2: "CA",
    fetchDrafts: ({ jurisdictionId }) =>
      fetchCABillsForSync({ jurisdictionId, db, limit: 100 }),
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
