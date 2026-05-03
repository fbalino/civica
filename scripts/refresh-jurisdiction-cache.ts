/**
 * Phase F.3.5 — CLI driver for jurisdictions cache refresh.
 *
 * Wraps `refreshJurisdictionCache()` from
 * `src/lib/factbook/reconcile/cache.ts` for local + CI runs.
 * The Vercel cron at `/api/cron/factbook/refresh-cache` calls
 * the same library function.
 *
 * Usage:
 *   npm run refresh:jurisdiction-cache
 *   npx tsx scripts/refresh-jurisdiction-cache.ts --jurisdiction-id=<uuid>
 *
 * Methodology + plan: see header of cache.ts.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { refreshJurisdictionCache } from "../src/lib/factbook/reconcile/cache";

interface CliArgs {
  jurisdictionId?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let jurisdictionId: string | undefined;
  for (const a of args) {
    if (a.startsWith("--jurisdiction-id=")) {
      jurisdictionId = a.slice("--jurisdiction-id=".length);
    }
  }
  return { jurisdictionId };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase F.3.5 — jurisdictions cache refresh${
      args.jurisdictionId ? ` (id=${args.jurisdictionId})` : ""
    }`
  );

  const summary = await refreshJurisdictionCache(db, {
    jurisdictionId: args.jurisdictionId,
    onProgress: (line) => console.log(`  ${line}`),
  });

  const elapsed = (summary.durationMs / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s.`);
  console.log(`  Jurisdictions refreshed: ${summary.jurisdictionsRefreshed}`);
  console.log(`  Fields written:          ${summary.fieldsWritten}`);
  console.log(`  Errors:                  ${summary.errors.length}`);
  if (summary.errors.length > 0) {
    console.log("  First 5 errors:");
    summary.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
