import type { CivicaDb } from "@/lib/db";
import { atlasEntityChangeHistory } from "@/lib/db/schema";
import { ATLAS_HISTORY_ENTITY_TABLES, projectPublicHistoryDiff, type AtlasChangeKind, type AtlasHistoryEntityType } from "./change-history";

export async function appendAtlasEntityChange(
  database: Pick<CivicaDb, "insert">,
  input: {
    entityType: AtlasHistoryEntityType; entityId: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null;
    operation: "insert" | "update" | "delete"; changeKind: AtlasChangeKind; reason: string; methodologyVersion: string; releaseId: string;
    correctionLogId?: string | null; correctionStatus?: "open" | "in_review" | "resolved_corrected" | "resolved_no_change" | "rejected" | null;
  },
) {
  const changes = projectPublicHistoryDiff(input.entityType, input.before, input.after);
  if (changes.length === 0) return null;
  const [event] = await database.insert(atlasEntityChangeHistory).values({
    entityType: input.entityType, entityId: input.entityId, entityTable: ATLAS_HISTORY_ENTITY_TABLES[input.entityType], operation: input.operation,
    changeKind: input.changeKind, changes, reason: input.reason, methodologyVersion: input.methodologyVersion, releaseId: input.releaseId,
    correctionLogId: input.correctionLogId ?? null, correctionStatus: input.correctionStatus ?? null,
  }).returning({ id: atlasEntityChangeHistory.id });
  return event.id;
}
