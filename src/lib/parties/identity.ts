import { createHash, randomUUID } from "node:crypto";
import { stableStringify } from "@/lib/data/frozen-vintage";

export const PARTY_IDENTITY_METHOD_VERSION = "party-identity/v1" as const;
export const PARTY_COMPOSITION_WRITER_VERSION =
  "party-composition-diff/v1" as const;

export type PartyIdentityStatus =
  | "source_verified"
  | "provisional_legacy"
  | "disputed";

export interface PartyCompositionObservation {
  sourcePartyId: string;
  partyName: string;
  partyColor?: string | null;
  seatCount: number;
  isRulingCoalition?: boolean;
  wikidataQid?: string | null;
}

export interface ExistingPartyEntity {
  id: string;
  jurisdictionId: string;
  canonicalName: string;
  identityStatus: PartyIdentityStatus;
  identitySourceId: string | null;
  identityExternalId: string | null;
}

export interface ExistingLegislatureParty {
  id: string;
  bodyId: string;
  partyId: string;
  compositionRunId: string;
  identityKey: string;
  partyName: string;
  partyColor: string | null;
  seatCount: number;
  isRulingCoalition: boolean;
  wikidataQid: string | null;
  isCurrent: boolean;
  firstRecordedAt: Date;
  party: ExistingPartyEntity;
}

export interface PartyIdentityEventPlan {
  eventKey: string;
  eventGroupKey: string;
  eventType:
    | "identity_adopted"
    | "identity_created"
    | "identity_upgraded"
    | "name_change_observed"
    | "retired_from_chamber"
    | "reactivated_in_chamber"
    | "split_into"
    | "merged_into"
    | "succeeded_by";
  predecessorPartyId: string | null;
  successorPartyId: string | null;
  legislaturePartyId: string | null;
  previousName: string | null;
  currentName: string | null;
  effectiveDate: string | null;
  evidenceStatus: "verified" | "provisional" | "disputed";
}

interface PlannedEntityInsert {
  id: string;
  jurisdictionId: string;
  canonicalName: string;
  identityStatus: "source_verified";
  identitySourceId: string;
  identityExternalId: string;
}

interface PlannedEntityUpdate {
  id: string;
  canonicalName: string;
  identityStatus: "source_verified";
  identitySourceId: string;
  identityExternalId: string;
}

interface PlannedLegislatureInsert {
  id: string;
  bodyId: string;
  partyId: string;
  compositionRunId: string;
  identityKey: string;
  partyName: string;
  partyColor: string | null;
  seatCount: number;
  isRulingCoalition: boolean;
  wikidataQid: string | null;
  isCurrent: true;
  firstRecordedAt: Date;
  lastRecordedAt: Date;
  retiredAt: null;
}

interface PlannedLegislatureUpdate
  extends Omit<PlannedLegislatureInsert, "firstRecordedAt"> {
  firstRecordedAt?: never;
}

interface PlannedRetirement {
  id: string;
  partyId: string;
  previousName: string;
  compositionRunId: string;
  lastRecordedAt: Date;
  isCurrent: false;
  retiredAt: Date;
}

export interface PartyCompositionPlan {
  entityInserts: PlannedEntityInsert[];
  entityUpdates: PlannedEntityUpdate[];
  legislatureInserts: PlannedLegislatureInsert[];
  legislatureUpdates: PlannedLegislatureUpdate[];
  retirements: PlannedRetirement[];
  events: PartyIdentityEventPlan[];
}

export function normalizePartyIdentityName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function partyCompositionIdentityKey(
  sourceId: string,
  sourcePartyId: string,
): string {
  return `${sourceId}:${sourcePartyId.trim()}`;
}

export function partyIdentityDigest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function partyCompositionRunKey(input: {
  bodyId: string;
  sourceId: string;
  payloadSha256: string;
}): string {
  return partyIdentityDigest({
    ...input,
    writerVersion: PARTY_COMPOSITION_WRITER_VERSION,
  });
}

function eventPlan(
  event: Omit<PartyIdentityEventPlan, "eventKey">,
): PartyIdentityEventPlan {
  return {
    ...event,
    eventKey: partyIdentityDigest({
      ...event,
      methodVersion: PARTY_IDENTITY_METHOD_VERSION,
    }),
  };
}

function sameNullable(a: string | null | undefined, b: string | null): boolean {
  return (a ?? null) === b;
}

function partyRowChanged(
  row: ExistingLegislatureParty,
  incoming: PartyCompositionObservation,
  partyId: string,
  identityKey: string,
  compositionRunId: string,
): boolean {
  return (
    row.partyId !== partyId ||
    row.compositionRunId !== compositionRunId ||
    row.identityKey !== identityKey ||
    row.partyName !== incoming.partyName ||
    !sameNullable(row.partyColor, incoming.partyColor ?? null) ||
    row.seatCount !== incoming.seatCount ||
    row.isRulingCoalition !== (incoming.isRulingCoalition ?? false) ||
    !sameNullable(row.wikidataQid, incoming.wikidataQid ?? null) ||
    !row.isCurrent
  );
}

/**
 * Pure reconciliation planner. Source external IDs are authoritative when
 * supplied. Exact name matching is allowed only within the same body and only
 * to upgrade one unambiguous legacy row; it never merges similarly named rows
 * across chambers and never infers split/merge lineage.
 */
export function planPartyComposition(input: {
  bodyId: string;
  jurisdictionId: string;
  sourceId: string;
  compositionRunId: string;
  observedAt: Date;
  parties: PartyCompositionObservation[];
  existingRows: ExistingLegislatureParty[];
  sourceEntities: ExistingPartyEntity[];
  idFactory?: () => string;
}): PartyCompositionPlan {
  const idFactory = input.idFactory ?? randomUUID;
  const sourceEntities = new Map(
    input.sourceEntities
      .filter(
        (party) =>
          party.identitySourceId === input.sourceId &&
          party.identityExternalId,
      )
      .map((party) => [party.identityExternalId!, party]),
  );
  const existingByEntity = new Map<string, ExistingLegislatureParty[]>();
  for (const row of input.existingRows) {
    const rows = existingByEntity.get(row.partyId) ?? [];
    rows.push(row);
    existingByEntity.set(row.partyId, rows);
  }

  const plan: PartyCompositionPlan = {
    entityInserts: [],
    entityUpdates: [],
    legislatureInserts: [],
    legislatureUpdates: [],
    retirements: [],
    events: [],
  };
  const claimedRows = new Set<string>();
  const seenExternalIds = new Set<string>();

  for (const party of input.parties) {
    const externalId = party.sourcePartyId.trim();
    if (!externalId) throw new Error("Party source identifier is required");
    if (seenExternalIds.has(externalId)) {
      throw new Error(`Duplicate party source identifier: ${externalId}`);
    }
    seenExternalIds.add(externalId);
    const identityKey = partyCompositionIdentityKey(input.sourceId, externalId);
    let entity = sourceEntities.get(externalId) ?? null;
    let row = input.existingRows.find(
      (candidate) =>
        !claimedRows.has(candidate.id) && candidate.identityKey === identityKey,
    );

    if (!row && entity) {
      row = (existingByEntity.get(entity.id) ?? []).find(
        (candidate) => !claimedRows.has(candidate.id),
      );
    }

    if (!row) {
      const normalized = normalizePartyIdentityName(party.partyName);
      const nameMatches = input.existingRows.filter(
        (candidate) =>
          !claimedRows.has(candidate.id) &&
          candidate.party.identityStatus === "provisional_legacy" &&
          normalizePartyIdentityName(candidate.partyName) === normalized,
      );
      if (nameMatches.length === 1) row = nameMatches[0];
    }

    if (!entity && row) entity = row.party;

    if (entity && entity.jurisdictionId !== input.jurisdictionId) {
      throw new Error(
        `Party source identifier ${externalId} belongs to another jurisdiction`,
      );
    }

    if (!entity) {
      entity = {
        id: idFactory(),
        jurisdictionId: input.jurisdictionId,
        canonicalName: party.partyName,
        identityStatus: "source_verified",
        identitySourceId: input.sourceId,
        identityExternalId: externalId,
      };
      sourceEntities.set(externalId, entity);
      plan.entityInserts.push({
        id: entity.id,
        jurisdictionId: entity.jurisdictionId,
        canonicalName: entity.canonicalName,
        identityStatus: "source_verified",
        identitySourceId: input.sourceId,
        identityExternalId: externalId,
      });
      plan.events.push(
        eventPlan({
          eventGroupKey: `identity-created:${entity.id}`,
          eventType: "identity_created",
          predecessorPartyId: null,
          successorPartyId: entity.id,
          legislaturePartyId: null,
          previousName: null,
          currentName: party.partyName,
          effectiveDate: null,
          evidenceStatus: "verified",
        }),
      );
    } else {
      const linksProvisionalRow = Boolean(row && row.partyId !== entity.id);
      const needsIdentityUpgrade =
        entity.identityStatus === "provisional_legacy" ||
        entity.identitySourceId !== input.sourceId ||
        entity.identityExternalId !== externalId;
      const nameChanged = entity.canonicalName !== party.partyName;
      if (needsIdentityUpgrade || nameChanged) {
        plan.entityUpdates.push({
          id: entity.id,
          canonicalName: party.partyName,
          identityStatus: "source_verified",
          identitySourceId: input.sourceId,
          identityExternalId: externalId,
        });
      }
      if (needsIdentityUpgrade || linksProvisionalRow) {
        plan.events.push(
          eventPlan({
            eventGroupKey: `identity-upgraded:${entity.id}:${identityKey}`,
            eventType: "identity_upgraded",
            predecessorPartyId: row?.partyId ?? null,
            successorPartyId: entity.id,
            legislaturePartyId: row?.id ?? null,
            previousName: entity.canonicalName,
            currentName: party.partyName,
            effectiveDate: null,
            evidenceStatus: "verified",
          }),
        );
      } else if (nameChanged) {
        plan.events.push(
          eventPlan({
            eventGroupKey: `name-observed:${entity.id}:${party.partyName}`,
            eventType: "name_change_observed",
            predecessorPartyId: entity.id,
            successorPartyId: entity.id,
            legislaturePartyId: row?.id ?? null,
            previousName: entity.canonicalName,
            currentName: party.partyName,
            effectiveDate: null,
            evidenceStatus: "verified",
          }),
        );
      }
    }

    if (!row) {
      const legislaturePartyId = idFactory();
      plan.legislatureInserts.push({
        id: legislaturePartyId,
        bodyId: input.bodyId,
        partyId: entity.id,
        compositionRunId: input.compositionRunId,
        identityKey,
        partyName: party.partyName,
        partyColor: party.partyColor ?? null,
        seatCount: party.seatCount,
        isRulingCoalition: party.isRulingCoalition ?? false,
        wikidataQid: party.wikidataQid ?? null,
        isCurrent: true,
        firstRecordedAt: input.observedAt,
        lastRecordedAt: input.observedAt,
        retiredAt: null,
      });
      continue;
    }

    claimedRows.add(row.id);
    const targetEntityId = sourceEntities.get(externalId)?.id ?? entity.id;
    if (
      partyRowChanged(
        row,
        party,
        targetEntityId,
        identityKey,
        input.compositionRunId,
      ) ||
      row.partyId !== targetEntityId
    ) {
      plan.legislatureUpdates.push({
        id: row.id,
        bodyId: input.bodyId,
        partyId: targetEntityId,
        compositionRunId: input.compositionRunId,
        identityKey,
        partyName: party.partyName,
        partyColor: party.partyColor ?? null,
        seatCount: party.seatCount,
        isRulingCoalition: party.isRulingCoalition ?? false,
        wikidataQid: party.wikidataQid ?? null,
        isCurrent: true,
        lastRecordedAt: input.observedAt,
        retiredAt: null,
      });
    }
    if (!row.isCurrent) {
      plan.events.push(
        eventPlan({
          eventGroupKey: `reactivated:${row.id}:${identityKey}`,
          eventType: "reactivated_in_chamber",
          predecessorPartyId: null,
          successorPartyId: targetEntityId,
          legislaturePartyId: row.id,
          previousName: row.partyName,
          currentName: party.partyName,
          effectiveDate: null,
          evidenceStatus: "verified",
        }),
      );
    }
  }

  for (const row of input.existingRows) {
    if (!row.isCurrent || claimedRows.has(row.id)) continue;
    plan.retirements.push({
      id: row.id,
      partyId: row.partyId,
      previousName: row.partyName,
      compositionRunId: input.compositionRunId,
      lastRecordedAt: input.observedAt,
      isCurrent: false,
      retiredAt: input.observedAt,
    });
    plan.events.push(
      eventPlan({
        eventGroupKey: `retired:${row.id}:${input.compositionRunId}`,
        eventType: "retired_from_chamber",
        predecessorPartyId: row.partyId,
        successorPartyId: null,
        legislaturePartyId: row.id,
        previousName: row.partyName,
        currentName: null,
        effectiveDate: null,
        evidenceStatus: "verified",
      }),
    );
  }

  return plan;
}

export type SourcedPartyLineageEventInput = Omit<
  PartyIdentityEventPlan,
  "eventKey"
> & {
  sourceId: string;
  sourceUrl: string;
  sourceLicense: string;
  sourceRetrievedAt: Date;
};

export function validateSourcedPartyLineageEvent(
  input: SourcedPartyLineageEventInput,
): PartyIdentityEventPlan {
  if (!input.sourceId || !input.sourceUrl || !input.sourceLicense) {
    throw new Error("Party lineage requires source, URL, and license");
  }
  if (
    ["split_into", "merged_into", "succeeded_by"].includes(input.eventType) &&
    (!input.predecessorPartyId ||
      !input.successorPartyId ||
      input.predecessorPartyId === input.successorPartyId)
  ) {
    throw new Error(`${input.eventType} requires distinct predecessor and successor parties`);
  }
  return eventPlan(input);
}
