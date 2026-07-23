import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareAtlasEntityChange,
  validateAtlasChangeDescriptor,
} from "./change-history-writer";

const FACT_ID = "123e4567-e89b-42d3-a456-426614174000";
const CORRECTION_ID = "223e4567-e89b-42d3-a456-426614174000";

test("writer prepares a bounded event and normalizes release metadata", () => {
  assert.deepEqual(
    prepareAtlasEntityChange({
      entityType: "fact",
      entityId: FACT_ID,
      before: {
        fact_value: "10",
        source_id: "old-source",
        private_note: "never public",
      },
      after: {
        fact_value: "11",
        source_id: "new-source",
        private_note: "still private",
      },
      operation: "update",
      changeKind: "routine_refresh",
      reason: " Publisher refresh ",
      methodologyVersion: " fact-reconciliation-v1 ",
      releaseId: " atlas-2026-07 ",
    }),
    {
      entityType: "fact",
      entityId: FACT_ID,
      entityTable: "country_facts",
      operation: "update",
      changeKind: "routine_refresh",
      changes: [
        { field: "fact_value", before: "10", after: "11" },
        { field: "source_id", before: "old-source", after: "new-source" },
      ],
      reason: "Publisher refresh",
      methodologyVersion: "fact-reconciliation-v1",
      releaseId: "atlas-2026-07",
      correctionLogId: null,
      correctionStatus: null,
    },
  );
});

test("writer does not append an event when no public field changed", () => {
  assert.equal(
    prepareAtlasEntityChange({
      entityType: "fact",
      entityId: FACT_ID,
      before: { fact_value: "10", private_note: "before" },
      after: { fact_value: "10", private_note: "after" },
      operation: "update",
      changeKind: "routine_refresh",
      reason: "Publisher refresh",
      methodologyVersion: "fact-reconciliation-v1",
      releaseId: "atlas-2026-07",
    }),
    null,
  );
});

test("correction classification requires a retained correction reference", () => {
  assert.throws(
    () =>
      validateAtlasChangeDescriptor({
        operation: "update",
        changeKind: "correction",
        reason: "Corrected transcription",
        methodologyVersion: "fact-reconciliation-v1",
        releaseId: "atlas-2026-07-c1",
      }),
    /requires a retained correction-log reference/,
  );
  assert.throws(
    () =>
      validateAtlasChangeDescriptor({
        operation: "update",
        changeKind: "routine_refresh",
        reason: "Publisher refresh",
        methodologyVersion: "fact-reconciliation-v1",
        releaseId: "atlas-2026-07",
        correctionLogId: CORRECTION_ID,
        correctionStatus: "resolved_corrected",
      }),
    /cannot carry a correction-log reference/,
  );
});

test("writer accepts an explicitly evidenced correction", () => {
  assert.deepEqual(
    validateAtlasChangeDescriptor({
      operation: "update",
      changeKind: "correction",
      reason: "Corrected transcription",
      methodologyVersion: "fact-reconciliation-v1",
      releaseId: "atlas-2026-07-c1",
      correctionLogId: CORRECTION_ID,
      correctionStatus: "resolved_corrected",
    }),
    {
      operation: "update",
      changeKind: "correction",
      reason: "Corrected transcription",
      methodologyVersion: "fact-reconciliation-v1",
      releaseId: "atlas-2026-07-c1",
      correctionLogId: CORRECTION_ID,
      correctionStatus: "resolved_corrected",
    },
  );
});

test("writer rejects mutable or malformed identities and releases", () => {
  assert.throws(
    () =>
      prepareAtlasEntityChange({
        entityType: "fact",
        entityId: "Population",
        before: { fact_value: "10" },
        after: { fact_value: "11" },
        operation: "update",
        changeKind: "routine_refresh",
        reason: "Publisher refresh",
        methodologyVersion: "fact-reconciliation-v1",
        releaseId: "atlas-2026-07",
      }),
    /Invalid stable fact identity/,
  );
  assert.throws(
    () =>
      validateAtlasChangeDescriptor({
        operation: "update",
        changeKind: "routine_refresh",
        reason: "Publisher refresh",
        methodologyVersion: "fact-reconciliation-v1",
        releaseId: "not a release",
      }),
    /release ID is invalid/,
  );
});
