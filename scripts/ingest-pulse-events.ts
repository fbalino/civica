import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, ingestPulseEvents } from "../src/lib/pulse/ingest";

async function main() {
  console.log("=== Civica Pulse: GDELT Event Ingest ===\n");
  const db = createDb();
  const summary = await ingestPulseEvents(db, { hoursBack: 24 });

  console.log("=== Ingest Complete ===");
  console.log(`Fetched:              ${summary.fetched}`);
  console.log(`Inserted:             ${summary.inserted}`);
  console.log(`Skipped (duplicate):  ${summary.skippedDuplicate}`);
  console.log(`Unmatched (country):  ${summary.unmatchedCountry}`);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
