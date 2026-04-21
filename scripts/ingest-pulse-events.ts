import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createDb,
  fetchGdeltArticles,
  ingestPulseEvents,
} from "../src/lib/pulse/gdelt";

async function main() {
  console.log("Civica Pulse — GDELT event ingestion");
  console.log(`Started: ${new Date().toISOString()}`);

  const timespan = process.argv[2] || "24h";
  const maxRecords = parseInt(process.argv[3] || "250", 10);

  const db = createDb();
  const articles = await fetchGdeltArticles(timespan, maxRecords);
  const summary = await ingestPulseEvents(db, articles);

  console.log(`\nDone:`);
  console.log(`  Fetched:          ${summary.fetched}`);
  console.log(`  Ingested:         ${summary.ingested}`);
  console.log(`  Skipped (no ISO): ${summary.skippedNoMatch}`);
  console.log(`  Skipped (dupes):  ${summary.skippedDuplicate}`);
  console.log(`Finished: ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
