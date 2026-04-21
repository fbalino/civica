import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, calculatePulseScores } from "../src/lib/pulse/calculate";

async function main() {
  console.log("Civica Pulse — daily score calculation");
  console.log(`Started: ${new Date().toISOString()}`);

  const targetIso3 = process.argv[2] || undefined;
  if (targetIso3) console.log(`Target jurisdiction: ${targetIso3}`);

  const db = createDb();
  const summary = await calculatePulseScores(db, targetIso3);

  console.log(`\nDone:`);
  console.log(`  Jurisdictions processed: ${summary.jurisdictionsProcessed}`);
  console.log(`  Scores written:          ${summary.scoresWritten}`);
  console.log(`  Events expired:          ${summary.eventsExpired}`);
  console.log(`Finished: ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
