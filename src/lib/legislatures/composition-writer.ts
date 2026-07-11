import { and, eq } from "drizzle-orm";
import { legislatureParties, statements } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
type Db = typeof import("@/lib/db").db;
export interface PartyCompositionRow { partyName: string; partyColor?: string | null; seatCount: number }
export async function writeLegislatureComposition(db: Db, input: { bodyId: string; parties: PartyCompositionRow[]; sourceId: string; sourceUrl: string; sourceLicense: string; rawPayload: unknown }, options: { dryRun?: boolean; stampFreshness?: boolean; markSynced?: typeof markSourcesSynced } = {}) {
  if (input.parties.length === 0) throw new Error(`Empty party composition for ${input.bodyId}`);
  const names = new Set<string>();
  for (const row of input.parties) { if (!row.partyName.trim() || !Number.isSafeInteger(row.seatCount) || row.seatCount <= 0) throw new Error(`Malformed party row for ${input.bodyId}`); if (names.has(row.partyName)) throw new Error(`Duplicate party ${row.partyName}`); names.add(row.partyName); }
  if (!options.dryRun) {
    await db.delete(legislatureParties).where(eq(legislatureParties.bodyId, input.bodyId));
    for (const row of input.parties) await db.insert(legislatureParties).values({ bodyId: input.bodyId, ...row });
    const existing = await db.select({ id: statements.id }).from(statements).where(and(eq(statements.subjectTable, "legislature_parties"), eq(statements.subjectId, input.bodyId), eq(statements.predicate, "seats_per_parties"), eq(statements.sourceId, input.sourceId))).limit(1);
    const value = { objectValue: JSON.stringify(input.rawPayload), sourceId: input.sourceId, sourceUrl: input.sourceUrl, sourceLicense: input.sourceLicense, retrievedAt: new Date() };
    if (existing[0]) await db.update(statements).set(value).where(eq(statements.id, existing[0].id));
    else await db.insert(statements).values({ subjectTable: "legislature_parties", subjectId: input.bodyId, predicate: "seats_per_parties", ...value });
  }
  if (options.stampFreshness !== false) await (options.markSynced ?? markSourcesSynced)(input.sourceId, { rowsWritten: input.parties.length, dryRun: options.dryRun });
  return { proposed: input.parties.length, written: options.dryRun ? 0 : input.parties.length };
}
