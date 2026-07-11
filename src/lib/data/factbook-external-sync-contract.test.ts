import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";

const adapters = [
  ["classifications", "sync-classifications.ts"],
  ["wdi", "sync-wdi.ts"],
  ["imf-weo", "sync-imf-weo.ts"],
  ["un-data", "sync-un-data.ts"],
  ["who-gho", "sync-who-gho.ts"],
  ["unesco-uis", "sync-unesco-uis.ts"],
  ["undp-hdi", "sync-undp-hdi.ts"],
  ["oecd-stat", "sync-oecd-stat.ts"],
  ["fao-faostat", "sync-fao-faostat.ts"],
  ["ilo-ilostat", "sync-ilo-ilostat.ts"],
  ["eurostat", "sync-eurostat.ts"],
  ["wto-stats", "sync-wto-stats.ts"],
  ["insee-fr", "sync-insee-fr.ts"],
  ["us-census", "sync-us-census.ts"],
  ["ons-uk", "sync-ons-uk.ts"],
  ["ibge-br", "sync-ibge-br.ts"],
  ["statcan-ca", "sync-statcan-ca.ts"],
  ["stats-sa", "sync-stats-sa.ts"],
] as const;

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("all external factbook cron adapters expose dry-run and fail-closed outcomes", () => {
  for (const [routeId, implementation] of adapters) {
    const route = read(`src/app/api/cron/factbook/sync-${routeId}/route.ts`);
    assert.match(route, /searchParams\.get\("dryRun"\) === "1"/, `${routeId} has no cron dry-run`);
    assert.match(route, /assertExternalSyncSucceeded\(/, `${routeId} can still return ok on an error or empty result`);

    const source = read(`src/lib/factbook/reconcile/${implementation}`);
    assert.match(source, /errors\.length === 0 \? [^\n]+ : 0/, `${implementation} can stamp freshness after a partial failure`);
  }
});
