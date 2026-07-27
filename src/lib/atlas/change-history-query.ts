import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  atlasEntityChangeHistory,
  correctionLog,
} from "@/lib/db/schema";
import type { EntityCitation } from "@/lib/citations/stable-identity";
import {
  buildAtlasEntityChangeHistoryDocument,
  type AtlasHistoryEntityType,
} from "./change-history";

export async function getAtlasEntityChangeHistory(input: {
  citation: Pick<
    EntityCitation,
    "entityType" | "id" | "label" | "citationUrl" | "readerUrl"
  >;
  limit: number;
  offset: number;
}) {
  const rows = await db
    .select({
      id: atlasEntityChangeHistory.id,
      operation: atlasEntityChangeHistory.operation,
      changeKind: atlasEntityChangeHistory.changeKind,
      changes: atlasEntityChangeHistory.changes,
      reason: atlasEntityChangeHistory.reason,
      methodologyVersion: atlasEntityChangeHistory.methodologyVersion,
      releaseId: atlasEntityChangeHistory.releaseId,
      publicCorrectionId: correctionLog.id,
      publicCorrectionStatus: correctionLog.status,
      recordedAt: atlasEntityChangeHistory.recordedAt,
    })
    .from(atlasEntityChangeHistory)
    .leftJoin(
      correctionLog,
      and(
        eq(atlasEntityChangeHistory.correctionLogId, correctionLog.id),
        eq(correctionLog.isPublic, true),
      ),
    )
    .where(
      and(
        eq(
          atlasEntityChangeHistory.entityType,
          input.citation.entityType as AtlasHistoryEntityType,
        ),
        eq(atlasEntityChangeHistory.entityId, input.citation.id),
      ),
    )
    .orderBy(desc(atlasEntityChangeHistory.recordedAt))
    .limit(input.limit + 1)
    .offset(input.offset);

  return buildAtlasEntityChangeHistoryDocument({
    citation: input.citation,
    rows,
    limit: input.limit,
    offset: input.offset,
  });
}
