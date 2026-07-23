import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { atlasEntityChangeHistory } from "@/lib/db/schema";
import { ATLAS_CHANGE_HISTORY_SCHEMA_VERSION, type AtlasHistoryEntityType } from "./change-history";

export async function getAtlasEntityChangeHistory(input: {
  entityType: AtlasHistoryEntityType;
  entityId: string;
  limit: number;
  offset: number;
}) {
  const rows = await db
    .select({ id: atlasEntityChangeHistory.id, operation: atlasEntityChangeHistory.operation, changeKind: atlasEntityChangeHistory.changeKind, changes: atlasEntityChangeHistory.changes, reason: atlasEntityChangeHistory.reason, methodologyVersion: atlasEntityChangeHistory.methodologyVersion, releaseId: atlasEntityChangeHistory.releaseId, correctionLogId: atlasEntityChangeHistory.correctionLogId, correctionStatus: atlasEntityChangeHistory.correctionStatus, recordedAt: atlasEntityChangeHistory.recordedAt })
    .from(atlasEntityChangeHistory)
    .where(and(eq(atlasEntityChangeHistory.entityType, input.entityType), eq(atlasEntityChangeHistory.entityId, input.entityId)))
    .orderBy(desc(atlasEntityChangeHistory.recordedAt))
    .limit(input.limit + 1)
    .offset(input.offset);
  const hasMore = rows.length > input.limit;
  return {
    schemaVersion: ATLAS_CHANGE_HISTORY_SCHEMA_VERSION,
    events: rows.slice(0, input.limit).map((row) => ({ ...row, recordedAt: row.recordedAt.toISOString() })),
    pagination: { limit: input.limit, offset: input.offset, hasMore },
  };
}
