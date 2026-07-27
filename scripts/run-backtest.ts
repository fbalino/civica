/**
 * Phase 5.8 — backtest runner.
 *
 *   npm run backtest:run                # one bounded seeded case
 *   npm run backtest:run -- --case <id> # single case
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { runBacktest, runAllBacktests } from "../src/lib/pulse/v2/backtest";

async function main() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient, schema });

  const caseFlag = process.argv.findIndex((a) => a === "--case");
  const caseArg = caseFlag >= 0 ? process.argv[caseFlag + 1] : undefined;

  const start = Date.now();

  const results = caseArg
    ? await (async () => {
        console.log(`\nBacktesting ${caseArg}…`);
        const r = await runBacktest(db, caseArg);
        return r ? [r] : [];
      })()
    : await runAllBacktests(db);

  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

  console.log("\n──────────────────────────────────────────────────────");
  console.log("Backtest summary");
  console.log("──────────────────────────────────────────────────────");
  for (const r of results) {
    console.log(
      `  ${r.verdict.padEnd(8)} ${r.caseId.padEnd(20)}  events ${r.classified.length}, samples ${r.trajectorySamples}`
    );
    for (const d of r.detail) {
      const mark = d.pass ? "✓" : "✕";
      console.log(
        `    ${mark} ${d.expected.dimension.padEnd(20)}  expected ${d.expected.magnitude} ${d.expected.direction}, peak ${d.peakDelta.toFixed(2)} on day ${d.peakDay}`
      );
    }
  }
  const passed = results.filter((r) => r.verdict === "pass").length;
  const partial = results.filter((r) => r.verdict === "partial").length;
  const failed = results.filter((r) => r.verdict === "fail").length;
  console.log("──────────────────────────────────────────────────────");
  console.log(
    `  pass ${passed}  partial ${partial}  fail ${failed}  · elapsed ${elapsedSec}s`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
