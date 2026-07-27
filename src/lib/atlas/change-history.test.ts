import assert from "node:assert/strict";
import test from "node:test";
import {
  ATLAS_CHANGE_HISTORY_COVERAGE_NOTE,
  buildAtlasEntityChangeHistoryDocument,
  isAtlasChangeKind,
  projectPublicHistoryDiff,
  PUBLIC_HISTORY_FIELDS,
  toAtlasPublicHistorySnapshot,
  zAtlasEntityChangeHistoryDocument,
} from "./change-history";

test("history projection reports only allowlisted fact fields", () => {
  assert.deepEqual(
    projectPublicHistoryDiff(
      "fact",
      { fact_value: "10", source_id: "cia_factbook", internal_notes: "never public" },
      { fact_value: "12", source_id: "world_bank", internal_notes: "still private" },
    ),
    [
      { field: "fact_value", before: "10", after: "12" },
      { field: "source_id", before: "cia_factbook", after: "world_bank" },
    ],
  );
});

test("history projection retains structured publisher-date corrections", () => {
  assert.deepEqual(
    projectPublicHistoryDiff(
      "fact",
      { value_json: null, as_of: "2025-01-01" },
      {
        value_json: {
          publisherDate: {
            precision: "year",
            year: 2025,
            month: null,
            day: null,
          },
        },
        as_of: null,
      },
    ),
    [
      {
        field: "value_json",
        before: null,
        after: {
          publisherDate: {
            precision: "year",
            year: 2025,
            month: null,
            day: null,
          },
        },
      },
      { field: "as_of", before: "2025-01-01", after: null },
    ],
  );
});

test("history projection keeps an explicit null for a removed public value", () => {
  assert.deepEqual(
    projectPublicHistoryDiff("indicator", { value: 4.2 }, {}),
    [{ field: "value", before: 4.2, after: null }],
  );
  assert.equal(isAtlasChangeKind("correction"), true);
  assert.equal(isAtlasChangeKind("guess"), false);
});

test("history projection normalizes Drizzle camelCase rows before diffing", () => {
  assert.deepEqual(
    projectPublicHistoryDiff(
      "person",
      {
        name: "María Example",
        dateOfBirth: "1970-01-01",
        wikidataQid: "Q1",
        internalReviewerNote: "private",
      },
      {
        name: "Maria Example",
        dateOfBirth: "1970-01-01",
        wikidataQid: "Q1",
        internalReviewerNote: "still private",
      },
    ),
    [{ field: "name", before: "María Example", after: "Maria Example" }],
  );
});

test("public snapshot registries match real entity fields and discard phantom aliases", () => {
  assert.ok(PUBLIC_HISTORY_FIELDS.institution.includes("total_seats"));
  assert.ok(PUBLIC_HISTORY_FIELDS.election.includes("turnout_percent"));
  assert.ok(PUBLIC_HISTORY_FIELDS.organization.includes("type"));
  assert.equal(PUBLIC_HISTORY_FIELDS.person.includes("full_name"), false);
  assert.equal(PUBLIC_HISTORY_FIELDS.office.includes("status"), false);
  assert.deepEqual(
    toAtlasPublicHistorySnapshot("organization", {
      name: "United Nations",
      fullName: "United Nations",
      type: "intergovernmental",
      organizationType: "must not leak",
      sourceRetrievedAt: new Date("2026-07-23T00:00:00.000Z"),
    }),
    {
      name: "United Nations",
      full_name: "United Nations",
      type: "intergovernmental",
    },
  );
});

const citation = {
  entityType: "fact" as const,
  id: "123e4567-e89b-42d3-a456-426614174000",
  label: "Uruguay — Population",
  citationUrl:
    "https://civicaatlas.org/api/citations/fact/123e4567-e89b-42d3-a456-426614174000",
  readerUrl: "https://civicaatlas.org/country/uruguay",
};

test("history document binds every event to the stable citation identity", () => {
  const document = buildAtlasEntityChangeHistoryDocument({
    citation,
    rows: [
      {
        id: "223e4567-e89b-42d3-a456-426614174000",
        operation: "update",
        changeKind: "routine_refresh",
        changes: [
          {
            field: "upstream_vintage_label",
            before: "2024",
            after: "2025",
          },
        ],
        reason: "Publisher annual refresh",
        methodologyVersion: "fact-reconciliation-v1",
        releaseId: "atlas-2026-07",
        publicCorrectionId: null,
        publicCorrectionStatus: null,
        recordedAt: new Date("2026-07-23T10:00:00.000Z"),
      },
    ],
    limit: 50,
    offset: 0,
  });

  assert.equal(document.entity.entityId, citation.id);
  assert.equal(document.events[0]?.entityId, citation.id);
  assert.equal(document.events[0]?.entityType, "fact");
  assert.equal(document.coverage.state, "recorded_history");
  assert.equal(document.coverage.note, ATLAS_CHANGE_HISTORY_COVERAGE_NOTE);
  assert.deepEqual(zAtlasEntityChangeHistoryDocument.parse(document), document);
});

test("history document distinguishes no recorded history from a missing entity", () => {
  const document = buildAtlasEntityChangeHistoryDocument({
    citation,
    rows: [],
    limit: 25,
    offset: 0,
  });

  assert.equal(document.entity.entityId, citation.id);
  assert.equal(document.coverage.state, "no_recorded_history");
  assert.deepEqual(document.events, []);
});

test("history document hides a correction reference unless the joined row is public", () => {
  const baseRow = {
    id: "323e4567-e89b-42d3-a456-426614174000",
    operation: "update",
    changeKind: "correction",
    changes: [{ field: "fact_value", before: "1", after: "2" }],
    reason: "Corrected transcription",
    methodologyVersion: "fact-reconciliation-v1",
    releaseId: "atlas-2026-07-correction-1",
    recordedAt: new Date("2026-07-23T11:00:00.000Z"),
  };
  const privateDocument = buildAtlasEntityChangeHistoryDocument({
    citation,
    rows: [
      {
        ...baseRow,
        publicCorrectionId: null,
        publicCorrectionStatus: null,
      },
    ],
    limit: 50,
    offset: 0,
  });
  const publicDocument = buildAtlasEntityChangeHistoryDocument({
    citation,
    rows: [
      {
        ...baseRow,
        publicCorrectionId: "423e4567-e89b-42d3-a456-426614174000",
        publicCorrectionStatus: "resolved_corrected",
      },
    ],
    limit: 50,
    offset: 0,
  });

  assert.equal(privateDocument.events[0]?.correction, null);
  assert.deepEqual(publicDocument.events[0]?.correction, {
    id: "423e4567-e89b-42d3-a456-426614174000",
    status: "resolved_corrected",
  });
});

test("history document rejects unregistered fields and unsupported event states", () => {
  assert.throws(() =>
    zAtlasEntityChangeHistoryDocument.parse({
      schemaVersion: "civica-atlas-change-history/v1",
      entity: citation,
      coverage: {
        state: "recorded_history",
        note: ATLAS_CHANGE_HISTORY_COVERAGE_NOTE,
      },
      events: [
        {
          id: "523e4567-e89b-42d3-a456-426614174000",
          entityType: "fact",
          entityId: citation.id,
          operation: "update",
          changeKind: "guessed_correction",
          changes: [{ field: "fact_value", before: "1", after: "2" }],
          reason: "Unsupported classification",
          methodologyVersion: "v1",
          releaseId: "r1",
          correction: null,
          recordedAt: "2026-07-23T12:00:00.000Z",
          internalNotes: "must never escape",
        },
      ],
      pagination: { limit: 50, offset: 0, hasMore: false },
    }),
  );
});

test("history document rejects a valid-looking field from the wrong entity registry", () => {
  assert.throws(() =>
    zAtlasEntityChangeHistoryDocument.parse({
      schemaVersion: "civica-atlas-change-history/v1",
      entity: {
        ...citation,
        entityId: citation.id,
      },
      coverage: {
        state: "recorded_history",
        note: ATLAS_CHANGE_HISTORY_COVERAGE_NOTE,
      },
      events: [
        {
          id: "623e4567-e89b-42d3-a456-426614174000",
          entityType: "fact",
          entityId: citation.id,
          operation: "update",
          changeKind: "routine_refresh",
          changes: [{ field: "full_name", before: "A", after: "B" }],
          reason: "Wrong registry",
          methodologyVersion: "v1",
          releaseId: "r1",
          correction: null,
          recordedAt: "2026-07-23T12:00:00.000Z",
        },
      ],
      pagination: { limit: 50, offset: 0, hasMore: false },
    }),
  );
});

test("history document rejects event identity drift", () => {
  assert.throws(() =>
    zAtlasEntityChangeHistoryDocument.parse({
      schemaVersion: "civica-atlas-change-history/v1",
      entity: {
        ...citation,
        entityId: citation.id,
      },
      coverage: {
        state: "recorded_history",
        note: ATLAS_CHANGE_HISTORY_COVERAGE_NOTE,
      },
      events: [
        {
          id: "723e4567-e89b-42d3-a456-426614174000",
          entityType: "fact",
          entityId: "823e4567-e89b-42d3-a456-426614174000",
          operation: "update",
          changeKind: "routine_refresh",
          changes: [{ field: "fact_value", before: "1", after: "2" }],
          reason: "Mismatched identity",
          methodologyVersion: "v1",
          releaseId: "r1",
          correction: null,
          recordedAt: "2026-07-23T12:00:00.000Z",
        },
      ],
      pagination: { limit: 50, offset: 0, hasMore: false },
    }),
  );
});

test("history document rejects no-op field changes", () => {
  assert.throws(
    () =>
      zAtlasEntityChangeHistoryDocument.parse({
        schemaVersion: "civica-atlas-change-history/v1",
        entity: citation,
        coverage: {
          state: "recorded_history",
          note: ATLAS_CHANGE_HISTORY_COVERAGE_NOTE,
        },
        events: [
          {
            id: "923e4567-e89b-42d3-a456-426614174000",
            entityType: "fact",
            entityId: citation.id,
            operation: "update",
            changeKind: "routine_refresh",
            changes: [
              {
                field: "source_id",
                before: "cia_factbook",
                after: "cia_factbook",
              },
            ],
            reason: "No public change",
            methodologyVersion: "v1",
            releaseId: "r1",
            correction: null,
            recordedAt: "2026-07-23T12:00:00.000Z",
          },
        ],
        pagination: { limit: 50, offset: 0, hasMore: false },
      }),
    /distinct before and after values/,
  );
});
