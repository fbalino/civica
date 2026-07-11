import { governmentTaxonomies } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
type Db = typeof import("@/lib/db").db;
export type GovernmentTaxonomyInput = typeof governmentTaxonomies.$inferInsert;
export async function writeGovernmentTaxonomies(db: Db, rows: GovernmentTaxonomyInput[], options: { dryRun?: boolean; sourceId?: string; markSynced?: typeof markSourcesSynced } = {}) {
  if (rows.length === 0) throw new Error("Government taxonomy input produced zero rows");
  const keys = new Set<string>(); for (const row of rows) { const key=`${row.jurisdictionId}:${row.taxonomyVersion}`; if(keys.has(key)) throw new Error(`Duplicate government taxonomy: ${key}`); keys.add(key); if(!row.derivationVersionKey || !row.derivationVersions) throw new Error(`Missing derivation version: ${key}`); if(row.regimeTypeCgv && (!row.regimeYear || !row.regimeDatasetVersion || !row.regimeSourceDatasetVersion || !row.regimeRetrievedAt || !row.civicaPublicationVersion)) throw new Error(`Incomplete regime temporal metadata: ${key}`); }
  if (!options.dryRun) for (const row of rows) await db.insert(governmentTaxonomies).values(row).onConflictDoUpdate({ target: [governmentTaxonomies.jurisdictionId, governmentTaxonomies.taxonomyVersion], set: { ...row, updatedAt: row.updatedAt ?? new Date() } });
  if (options.sourceId) await (options.markSynced ?? markSourcesSynced)(options.sourceId,{rowsWritten:rows.length,dryRun:options.dryRun});
  return { proposed: rows.length, written: options.dryRun ? 0 : rows.length };
}
