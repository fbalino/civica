import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  governmentBodies,
  legislatureParties,
  partyCompositionRuns,
  partyIdentityEvents,
  politicalParties,
  statements,
} from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import {
  PARTY_COMPOSITION_WRITER_VERSION,
  PARTY_IDENTITY_METHOD_VERSION,
  partyCompositionRunKey,
  partyIdentityDigest,
  planPartyComposition,
  validateSourcedPartyLineageEvent,
  type ExistingLegislatureParty,
  type ExistingPartyEntity,
  type PartyCompositionObservation,
  type SourcedPartyLineageEventInput,
} from "@/lib/parties/identity";

type Db = typeof import("@/lib/db").db;

export type PartyCompositionRow = PartyCompositionObservation;

export interface LegislatureCompositionInput {
  bodyId: string;
  jurisdictionId: string;
  parties: PartyCompositionRow[];
  sourceId: string;
  sourceUrl: string;
  sourceLicense: string;
  rawPayload: unknown;
}

export interface LegislatureCompositionResult {
  proposed: number;
  written: number;
  inserted: number;
  updated: number;
  retired: number;
  events: number;
}

/**
 * Records an explicitly sourced rename/split/merge/succession edge. The
 * composition writer never calls this by inference; callers must supply the
 * publisher evidence and effective date (when known).
 */
export async function writeSourcedPartyLineageEvent(
  db: Db,
  input: SourcedPartyLineageEventInput,
): Promise<{ eventKey: string; written: boolean }> {
  const event = validateSourcedPartyLineageEvent(input);
  const rows = await db
    .insert(partyIdentityEvents)
    .values({
      ...event,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      sourceLicense: input.sourceLicense,
      sourceRetrievedAt: input.sourceRetrievedAt,
      methodVersion: PARTY_IDENTITY_METHOD_VERSION,
      recordedAt: input.sourceRetrievedAt,
    })
    .onConflictDoNothing({ target: partyIdentityEvents.eventKey })
    .returning({ id: partyIdentityEvents.id });
  return { eventKey: event.eventKey, written: rows.length > 0 };
}

function validateInput(input: LegislatureCompositionInput): void {
  if (input.parties.length === 0) {
    throw new Error(`Empty party composition for ${input.bodyId}`);
  }
  const sourceIds = new Set<string>();
  for (const row of input.parties) {
    const sourcePartyId = row.sourcePartyId.trim();
    if (
      !sourcePartyId ||
      !row.partyName.trim() ||
      !Number.isSafeInteger(row.seatCount) ||
      row.seatCount <= 0
    ) {
      throw new Error(`Malformed party row for ${input.bodyId}`);
    }
    if (sourceIds.has(sourcePartyId)) {
      throw new Error(`Duplicate party source identifier ${sourcePartyId}`);
    }
    sourceIds.add(sourcePartyId);
  }
  if (!input.sourceId || !input.sourceUrl || !input.sourceLicense) {
    throw new Error(`Incomplete composition provenance for ${input.bodyId}`);
  }
}

/**
 * Source-keyed, append-audited composition writer. It preserves the UUID of an
 * unchanged chamber row, soft-retires missing rows, and records the source
 * retrieval that produced every displayed seat and coalition value. Split and
 * merge relationships are never inferred from a missing name; those require a
 * separately sourced `party_identity_events` edge.
 */
export async function writeLegislatureComposition(
  db: Db,
  input: LegislatureCompositionInput,
  options: {
    dryRun?: boolean;
    stampFreshness?: boolean;
    markSynced?: typeof markSourcesSynced;
    observedAt?: Date;
    idFactory?: () => string;
  } = {},
): Promise<LegislatureCompositionResult> {
  validateInput(input);
  const observedAt = options.observedAt ?? new Date();
  const payloadSha256 = partyIdentityDigest(input.rawPayload);
  const runKey = partyCompositionRunKey({
    bodyId: input.bodyId,
    sourceId: input.sourceId,
    payloadSha256,
  });

  const [bodyRows, currentRows, existingRuns] = await Promise.all([
    db
      .select({ jurisdictionId: governmentBodies.jurisdictionId })
      .from(governmentBodies)
      .where(eq(governmentBodies.id, input.bodyId))
      .limit(1),
    db
      .select({
        id: legislatureParties.id,
        bodyId: legislatureParties.bodyId,
        partyId: legislatureParties.partyId,
        compositionRunId: legislatureParties.compositionRunId,
        identityKey: legislatureParties.identityKey,
        partyName: legislatureParties.partyName,
        partyColor: legislatureParties.partyColor,
        seatCount: legislatureParties.seatCount,
        isRulingCoalition: legislatureParties.isRulingCoalition,
        wikidataQid: legislatureParties.wikidataQid,
        isCurrent: legislatureParties.isCurrent,
        firstRecordedAt: legislatureParties.firstRecordedAt,
        entityId: politicalParties.id,
        entityJurisdictionId: politicalParties.jurisdictionId,
        canonicalName: politicalParties.canonicalName,
        identityStatus: politicalParties.identityStatus,
        identitySourceId: politicalParties.identitySourceId,
        identityExternalId: politicalParties.identityExternalId,
      })
      .from(legislatureParties)
      .innerJoin(
        politicalParties,
        eq(legislatureParties.partyId, politicalParties.id),
      )
      .where(eq(legislatureParties.bodyId, input.bodyId)),
    db
      .select({ id: partyCompositionRuns.id })
      .from(partyCompositionRuns)
      .where(eq(partyCompositionRuns.runKey, runKey))
      .limit(1),
  ]);

  if (!bodyRows[0] || bodyRows[0].jurisdictionId !== input.jurisdictionId) {
    throw new Error(
      `Composition body/jurisdiction mismatch for ${input.bodyId}`,
    );
  }

  const externalIds = input.parties.map((party) => party.sourcePartyId.trim());
  const sourceEntityRows = externalIds.length
    ? await db
        .select({
          id: politicalParties.id,
          jurisdictionId: politicalParties.jurisdictionId,
          canonicalName: politicalParties.canonicalName,
          identityStatus: politicalParties.identityStatus,
          identitySourceId: politicalParties.identitySourceId,
          identityExternalId: politicalParties.identityExternalId,
        })
        .from(politicalParties)
        .where(
          and(
            eq(politicalParties.identitySourceId, input.sourceId),
            inArray(politicalParties.identityExternalId, externalIds),
          ),
        )
    : [];

  const existingRows: ExistingLegislatureParty[] = currentRows.map((row) => ({
    id: row.id,
    bodyId: row.bodyId,
    partyId: row.partyId,
    compositionRunId: row.compositionRunId,
    identityKey: row.identityKey,
    partyName: row.partyName,
    partyColor: row.partyColor,
    seatCount: row.seatCount,
    isRulingCoalition: row.isRulingCoalition ?? false,
    wikidataQid: row.wikidataQid,
    isCurrent: row.isCurrent,
    firstRecordedAt: row.firstRecordedAt,
    party: {
      id: row.entityId,
      jurisdictionId: row.entityJurisdictionId,
      canonicalName: row.canonicalName,
      identityStatus:
        row.identityStatus as ExistingPartyEntity["identityStatus"],
      identitySourceId: row.identitySourceId,
      identityExternalId: row.identityExternalId,
    },
  }));
  const sourceEntities: ExistingPartyEntity[] = sourceEntityRows.map((row) => ({
    ...row,
    identityStatus: row.identityStatus as ExistingPartyEntity["identityStatus"],
  }));
  const runId =
    existingRuns[0]?.id ?? options.idFactory?.() ?? crypto.randomUUID();
  const plan = planPartyComposition({
    bodyId: input.bodyId,
    jurisdictionId: input.jurisdictionId,
    sourceId: input.sourceId,
    compositionRunId: runId,
    observedAt,
    parties: input.parties,
    existingRows,
    sourceEntities,
    idFactory: options.idFactory,
  });

  const inserted = plan.legislatureInserts.length;
  const updated = plan.legislatureUpdates.length;
  const retired = plan.retirements.length;
  const plannedEvents = plan.events.length;
  const needsRunInsert = !existingRuns[0];
  const changed =
    needsRunInsert ||
    plan.entityInserts.length > 0 ||
    plan.entityUpdates.length > 0 ||
    inserted > 0 ||
    updated > 0 ||
    retired > 0 ||
    plannedEvents > 0;

  if (options.dryRun || !changed) {
    if (options.stampFreshness !== false) {
      await (options.markSynced ?? markSourcesSynced)(input.sourceId, {
        rowsWritten: 0,
        dryRun: options.dryRun,
      });
    }
    return {
      proposed: input.parties.length,
      written: 0,
      inserted,
      updated,
      retired,
      events: plannedEvents,
    };
  }

  const queries: BatchItem<"pg">[] = [];
  if (needsRunInsert) {
    queries.push(
      db.insert(partyCompositionRuns).values({
        id: runId,
        runKey,
        bodyId: input.bodyId,
        sourceId: input.sourceId,
        sourceUrl: input.sourceUrl,
        sourceLicense: input.sourceLicense,
        sourceRetrievedAt: observedAt,
        payloadSha256,
        partyCount: input.parties.length,
        writerVersion: PARTY_COMPOSITION_WRITER_VERSION,
        recordedAt: observedAt,
      }),
    );
  }
  for (const entity of plan.entityInserts) {
    queries.push(
      db.insert(politicalParties).values({
        ...entity,
        identitySourceUrl: input.sourceUrl,
        identitySourceLicense: input.sourceLicense,
        identityRetrievedAt: observedAt,
        createdAt: observedAt,
        updatedAt: observedAt,
      }),
    );
  }
  for (const entity of plan.entityUpdates) {
    queries.push(
      db
        .update(politicalParties)
        .set({
          canonicalName: entity.canonicalName,
          identityStatus: entity.identityStatus,
          identitySourceId: entity.identitySourceId,
          identityExternalId: entity.identityExternalId,
          identitySourceUrl: input.sourceUrl,
          identitySourceLicense: input.sourceLicense,
          identityRetrievedAt: observedAt,
          updatedAt: observedAt,
        })
        .where(eq(politicalParties.id, entity.id)),
    );
  }
  for (const row of plan.legislatureInserts) {
    queries.push(db.insert(legislatureParties).values(row));
  }
  for (const row of plan.legislatureUpdates) {
    queries.push(
      db
        .update(legislatureParties)
        .set({
          partyId: row.partyId,
          compositionRunId: row.compositionRunId,
          identityKey: row.identityKey,
          partyName: row.partyName,
          partyColor: row.partyColor,
          seatCount: row.seatCount,
          isRulingCoalition: row.isRulingCoalition,
          wikidataQid: row.wikidataQid,
          isCurrent: true,
          lastRecordedAt: row.lastRecordedAt,
          retiredAt: null,
        })
        .where(eq(legislatureParties.id, row.id)),
    );
  }
  for (const row of plan.retirements) {
    queries.push(
      db
        .update(legislatureParties)
        .set({
          compositionRunId: row.compositionRunId,
          isCurrent: false,
          lastRecordedAt: row.lastRecordedAt,
          retiredAt: row.retiredAt,
        })
        .where(eq(legislatureParties.id, row.id)),
    );
  }
  for (const event of plan.events) {
    queries.push(
      db
        .insert(partyIdentityEvents)
        .values({
          ...event,
          sourceId: input.sourceId,
          sourceUrl: input.sourceUrl,
          sourceLicense: input.sourceLicense,
          sourceRetrievedAt: observedAt,
          methodVersion: PARTY_IDENTITY_METHOD_VERSION,
          recordedAt: observedAt,
        })
        .onConflictDoNothing({ target: partyIdentityEvents.eventKey }),
    );
  }

  const existingStatement = await db
    .select({ id: statements.id })
    .from(statements)
    .where(
      and(
        eq(statements.subjectTable, "government_bodies"),
        eq(statements.subjectId, input.bodyId),
        eq(statements.predicate, "seats_per_parties"),
        eq(statements.sourceId, input.sourceId),
      ),
    )
    .limit(1);
  const statementValue = {
    objectValue: JSON.stringify(input.rawPayload),
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    sourceLicense: input.sourceLicense,
    retrievedAt: observedAt,
  };
  if (existingStatement[0]) {
    queries.push(
      db
        .update(statements)
        .set(statementValue)
        .where(eq(statements.id, existingStatement[0].id)),
    );
  } else {
    queries.push(
      db.insert(statements).values({
        subjectTable: "government_bodies",
        subjectId: input.bodyId,
        predicate: "seats_per_parties",
        ...statementValue,
      }),
    );
  }

  const [first, ...rest] = queries;
  if (!first) throw new Error("Composition planner produced no write queries");
  await db.batch([first, ...rest]);
  const written = queries.length;
  if (options.stampFreshness !== false) {
    await (options.markSynced ?? markSourcesSynced)(input.sourceId, {
      rowsWritten: written,
      dryRun: false,
    });
  }
  return {
    proposed: input.parties.length,
    written,
    inserted,
    updated,
    retired,
    events: plannedEvents,
  };
}
