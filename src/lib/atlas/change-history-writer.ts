import type { CivicaDb } from "@/lib/db";
import { atlasEntityChangeHistory } from "@/lib/db/schema";
import { isValidEntityId } from "@/lib/citations/stable-identity";
import {
  ATLAS_CHANGE_HISTORY_SCHEMA_VERSION,
  ATLAS_CHANGE_KINDS,
  ATLAS_CHANGE_OPERATIONS,
  ATLAS_CORRECTION_STATUSES,
  ATLAS_HISTORY_ENTITY_TABLES,
  projectPublicHistoryDiff,
  type AtlasChangeKind,
  type AtlasCorrectionStatus,
  type AtlasHistoryEntityType,
} from "./change-history";

const RELEASE_ID_PATTERN = /^[A-Za-z0-9._-]{1,96}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AtlasChangeDescriptor {
  operation: "insert" | "update" | "delete";
  changeKind: AtlasChangeKind;
  reason: string;
  methodologyVersion: string;
  releaseId: string;
  correctionLogId?: string | null;
  correctionStatus?: AtlasCorrectionStatus | null;
}

export interface AtlasEntityChangeInput extends AtlasChangeDescriptor {
  entityType: AtlasHistoryEntityType;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/**
 * Validates the writer-supplied editorial classification. Change kind is
 * intentionally never inferred from the diff: a routine refresh must not
 * silently become a correction, and a correction/retraction requires a
 * retained correction-log reference.
 */
export function validateAtlasChangeDescriptor(
  input: AtlasChangeDescriptor,
): Required<
  Pick<
    AtlasChangeDescriptor,
    "operation" | "changeKind" | "reason" | "methodologyVersion" | "releaseId"
  >
> & {
  correctionLogId: string | null;
  correctionStatus: AtlasCorrectionStatus | null;
} {
  if (!(ATLAS_CHANGE_OPERATIONS as readonly string[]).includes(input.operation)) {
    throw new Error(`Unsupported Atlas history operation: ${input.operation}`);
  }
  if (!(ATLAS_CHANGE_KINDS as readonly string[]).includes(input.changeKind)) {
    throw new Error(`Unsupported Atlas history change kind: ${input.changeKind}`);
  }

  const reason = input.reason.trim();
  const methodologyVersion = input.methodologyVersion.trim();
  const releaseId = input.releaseId.trim();
  if (!reason) throw new Error("Atlas history reason is required");
  if (!methodologyVersion) {
    throw new Error("Atlas history methodology version is required");
  }
  if (!RELEASE_ID_PATTERN.test(releaseId)) {
    throw new Error("Atlas history release ID is invalid");
  }

  const correctionLogId = input.correctionLogId ?? null;
  const correctionStatus = input.correctionStatus ?? null;
  if ((correctionLogId === null) !== (correctionStatus === null)) {
    throw new Error(
      "Atlas history correction ID and status must be supplied together",
    );
  }
  if (correctionLogId && !UUID_PATTERN.test(correctionLogId)) {
    throw new Error("Atlas history correction ID is invalid");
  }
  if (
    correctionStatus &&
    !(ATLAS_CORRECTION_STATUSES as readonly string[]).includes(correctionStatus)
  ) {
    throw new Error("Atlas history correction status is invalid");
  }

  const correctionClassified =
    input.changeKind === "correction" || input.changeKind === "retraction";
  if (correctionClassified && !correctionLogId) {
    throw new Error(
      `${input.changeKind} history requires a retained correction-log reference`,
    );
  }
  if (!correctionClassified && correctionLogId) {
    throw new Error(
      `${input.changeKind} history cannot carry a correction-log reference`,
    );
  }

  return {
    operation: input.operation,
    changeKind: input.changeKind,
    reason,
    methodologyVersion,
    releaseId,
    correctionLogId,
    correctionStatus,
  };
}

export function prepareAtlasEntityChange(input: AtlasEntityChangeInput) {
  if (!isValidEntityId(input.entityType, input.entityId)) {
    throw new Error(
      `Invalid stable ${input.entityType} identity for ${ATLAS_CHANGE_HISTORY_SCHEMA_VERSION}`,
    );
  }
  const descriptor = validateAtlasChangeDescriptor(input);
  const changes = projectPublicHistoryDiff(
    input.entityType,
    input.before,
    input.after,
  );
  if (changes.length === 0) return null;
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    entityTable: ATLAS_HISTORY_ENTITY_TABLES[input.entityType],
    operation: descriptor.operation,
    changeKind: descriptor.changeKind,
    changes,
    reason: descriptor.reason,
    methodologyVersion: descriptor.methodologyVersion,
    releaseId: descriptor.releaseId,
    correctionLogId: descriptor.correctionLogId,
    correctionStatus: descriptor.correctionStatus,
  } satisfies typeof atlasEntityChangeHistory.$inferInsert;
}

export function buildAtlasEntityChangeInsert(
  database: Pick<CivicaDb, "insert">,
  input: AtlasEntityChangeInput,
) {
  const values = prepareAtlasEntityChange(input);
  if (!values) return null;
  return database
    .insert(atlasEntityChangeHistory)
    .values(values)
    .returning({ id: atlasEntityChangeHistory.id });
}

export async function appendAtlasEntityChange(
  database: Pick<CivicaDb, "insert">,
  input: AtlasEntityChangeInput,
) {
  const query = buildAtlasEntityChangeInsert(database, input);
  if (!query) return null;
  const [event] = await query;
  return event.id;
}
