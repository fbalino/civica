import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, classifyPulseEvents } from "../src/lib/pulse/classify";

async function main() {
  console.log("Civica Pulse — LLM event classification");
  console.log(`Started: ${new Date().toISOString()}`);

  const db = createDb();
  const summary = await classifyPulseEvents(db, { batchSize: 20, batchDelayMs: 1000 });

  console.log(`\nDone: ${summary.succeeded}/${summary.total} events classified`);
  if (summary.failed > 0) {
    console.warn(`${summary.failed} event(s) failed — check warnings above`);
  }
  console.log(`Finished: ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
