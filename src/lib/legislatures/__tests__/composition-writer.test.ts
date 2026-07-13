import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  planPartyComposition,
  validateSourcedPartyLineageEvent,
  type ExistingLegislatureParty,
  type ExistingPartyEntity,
} from "@/lib/parties/identity";

const observedAt = new Date("2026-07-13T00:00:00.000Z");

function entity(
  overrides: Partial<ExistingPartyEntity> = {},
): ExistingPartyEntity {
  return {
    id: "party-1",
    jurisdictionId: "jurisdiction-1",
    canonicalName: "Alpha",
    identityStatus: "source_verified",
    identitySourceId: "ipu_parline",
    identityExternalId: "IPU-A",
    ...overrides,
  };
}

function row(
  overrides: Partial<ExistingLegislatureParty> = {},
): ExistingLegislatureParty {
  const party = overrides.party ?? entity();
  return {
    id: "legislature-party-1",
    bodyId: "body-1",
    partyId: party.id,
    compositionRunId: "run-1",
    identityKey: "ipu_parline:IPU-A",
    partyName: "Alpha",
    partyColor: null,
    seatCount: 10,
    isRulingCoalition: false,
    wikidataQid: null,
    isCurrent: true,
    firstRecordedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
    party,
  };
}

function plan(overrides: Parameters<typeof planPartyComposition>[0] = {
  bodyId: "body-1",
  jurisdictionId: "jurisdiction-1",
  sourceId: "ipu_parline",
  compositionRunId: "run-1",
  observedAt,
  parties: [{ sourcePartyId: "IPU-A", partyName: "Alpha", seatCount: 10 }],
  existingRows: [row()],
  sourceEntities: [entity()],
}) {
  let nextId = 0;
  return planPartyComposition({
    ...overrides,
    idFactory: () => `generated-${++nextId}`,
  });
}

test("an identical composition rerun converges without writes and preserves row identity", () => {
  const result = plan();
  assert.deepEqual(result, {
    entityInserts: [],
    entityUpdates: [],
    legislatureInserts: [],
    legislatureUpdates: [],
    retirements: [],
    events: [],
  });
});

test("a new retrieval updates the run pointer without replacing the party row", () => {
  const result = plan({
    bodyId: "body-1",
    jurisdictionId: "jurisdiction-1",
    sourceId: "ipu_parline",
    compositionRunId: "run-2",
    observedAt,
    parties: [{ sourcePartyId: "IPU-A", partyName: "Alpha", seatCount: 10 }],
    existingRows: [row()],
    sourceEntities: [entity()],
  });
  assert.equal(result.legislatureUpdates.length, 1);
  assert.equal(result.legislatureUpdates[0].id, "legislature-party-1");
  assert.equal(result.legislatureUpdates[0].compositionRunId, "run-2");
  assert.equal(result.legislatureInserts.length, 0);
  assert.equal(result.retirements.length, 0);
});

test("a source-stable rename preserves identity and records a versioned event", () => {
  const result = plan({
    bodyId: "body-1",
    jurisdictionId: "jurisdiction-1",
    sourceId: "ipu_parline",
    compositionRunId: "run-2",
    observedAt,
    parties: [
      { sourcePartyId: "IPU-A", partyName: "Alpha Alliance", seatCount: 12 },
    ],
    existingRows: [row()],
    sourceEntities: [entity()],
  });
  assert.equal(result.entityUpdates[0].id, "party-1");
  assert.equal(result.legislatureUpdates[0].id, "legislature-party-1");
  assert.equal(result.legislatureUpdates[0].seatCount, 12);
  assert.equal(result.events[0].eventType, "name_change_observed");
  assert.equal(result.events[0].previousName, "Alpha");
  assert.equal(result.events[0].currentName, "Alpha Alliance");
});

test("one exact legacy name can be upgraded without changing either UUID", () => {
  const legacyEntity = entity({
    identityStatus: "provisional_legacy",
    identitySourceId: null,
    identityExternalId: null,
  });
  const legacyRow = row({
    identityKey: "legacy:legislature-party-1",
    party: legacyEntity,
  });
  const result = plan({
    bodyId: "body-1",
    jurisdictionId: "jurisdiction-1",
    sourceId: "ipu_parline",
    compositionRunId: "run-2",
    observedAt,
    parties: [{ sourcePartyId: "IPU-A", partyName: "Alpha", seatCount: 10 }],
    existingRows: [legacyRow],
    sourceEntities: [],
  });
  assert.equal(result.entityUpdates[0].id, "party-1");
  assert.equal(result.legislatureUpdates[0].id, "legislature-party-1");
  assert.equal(result.legislatureUpdates[0].identityKey, "ipu_parline:IPU-A");
  assert.equal(result.events[0].eventType, "identity_upgraded");
});

test("disappearing and new parties never manufacture a split relationship", () => {
  const result = plan({
    bodyId: "body-1",
    jurisdictionId: "jurisdiction-1",
    sourceId: "ipu_parline",
    compositionRunId: "run-2",
    observedAt,
    parties: [
      { sourcePartyId: "IPU-B", partyName: "Beta", seatCount: 6 },
      { sourcePartyId: "IPU-C", partyName: "Gamma", seatCount: 4 },
    ],
    existingRows: [row()],
    sourceEntities: [],
  });
  assert.equal(result.retirements.length, 1);
  assert.equal(result.legislatureInserts.length, 2);
  assert.equal(
    result.events.some((event) => event.eventType === "split_into"),
    false,
  );
});

test("a split edge is accepted only with explicit source evidence", () => {
  const split = validateSourcedPartyLineageEvent({
    eventGroupKey: "publisher-split-2026",
    eventType: "split_into",
    predecessorPartyId: "party-1",
    successorPartyId: "party-2",
    legislaturePartyId: null,
    previousName: "Alpha",
    currentName: "Beta",
    effectiveDate: "2026-01-01",
    evidenceStatus: "verified",
    sourceId: "ipu_parline",
    sourceUrl: "https://example.test/source",
    sourceLicense: "CC-BY-NC-SA-4.0",
    sourceRetrievedAt: observedAt,
  });
  assert.equal(split.eventType, "split_into");
  assert.match(split.eventKey, /^[a-f0-9]{64}$/);
  assert.throws(
    () =>
      validateSourcedPartyLineageEvent({
        ...split,
        sourceId: "ipu_parline",
        sourceUrl: "https://example.test/source",
        sourceLicense: "CC-BY-NC-SA-4.0",
        sourceRetrievedAt: observedAt,
        predecessorPartyId: "party-1",
        successorPartyId: "party-1",
      }),
    /distinct predecessor and successor/,
  );
});

test("the production writer uses an atomic batch and contains no destructive delete", () => {
  const source = readFileSync(
    "src/lib/legislatures/composition-writer.ts",
    "utf8",
  );
  assert.match(source, /await db\.batch\(/);
  assert.doesNotMatch(source, /\.delete\s*\(|DELETE\s+FROM/i);
  assert.match(source, /isCurrent:\s*false/);
});

test("the production writer's dry-run path records zero writes before the atomic batch", () => {
  const source = readFileSync(
    "src/lib/legislatures/composition-writer.ts",
    "utf8",
  );
  const dryRunGuard = source.indexOf("if (options.dryRun || !changed)");
  const batchWrite = source.indexOf("await db.batch(");
  assert.ok(dryRunGuard >= 0);
  assert.ok(batchWrite > dryRunGuard);
  assert.match(source.slice(dryRunGuard, batchWrite), /rowsWritten:\s*0/);
  assert.match(source.slice(dryRunGuard, batchWrite), /written:\s*0/);
});
