import assert from "node:assert/strict";
import { test } from "node:test";

import {
  outcomesReducer,
  type MetricRow,
  type OutcomesPayload,
  type OutcomesState,
} from "./outcomesReducer";

const INITIAL_STATE: OutcomesState = {
  data: null,
  loading: true,
  error: null,
};

function metric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    metricId: "hdi",
    name: "Human Development Index",
    category: "development",
    unit: null,
    higherIsBetter: true,
    value: 0.9,
    asOfYear: 2024,
    rank: 3,
    totalRanked: 40,
    isStale: false,
    peer: null,
    ...overrides,
  };
}

function payload(overrides: Partial<OutcomesPayload> = {}): OutcomesPayload {
  return {
    countryId: "URY",
    countrySlug: "uruguay",
    countryName: "Uruguay",
    govType: "presidential",
    year: 2024,
    metrics: [metric()],
    ...overrides,
  };
}

// ─── Individual action branches ─────────────────────────────────────────

test("'start' sets loading true and clears any error, preserving prior data", () => {
  const withStaleData: OutcomesState = {
    data: payload(),
    loading: false,
    error: "stale error message",
  };
  const next = outcomesReducer(withStaleData, { type: "start" });
  assert.deepEqual(next, {
    data: withStaleData.data,
    loading: true,
    error: null,
  });
  // Data reference is preserved (spread, not replaced).
  assert.equal(next.data, withStaleData.data);
});

test("'success' replaces data wholesale, clears loading and error", () => {
  const loadingState: OutcomesState = {
    data: null,
    loading: true,
    error: null,
  };
  const newPayload = payload();
  const next = outcomesReducer(loadingState, {
    type: "success",
    payload: newPayload,
  });
  assert.deepEqual(next, {
    data: newPayload,
    loading: false,
    error: null,
  });
});

test("'success' overwrites previously loaded data (refetch case), not merges", () => {
  const oldPayload = payload({ countrySlug: "old-country" });
  const newPayload = payload({ countrySlug: "new-country" });
  const stateWithOldData: OutcomesState = {
    data: oldPayload,
    loading: true,
    error: null,
  };
  const next = outcomesReducer(stateWithOldData, {
    type: "success",
    payload: newPayload,
  });
  assert.equal(next.data, newPayload);
  assert.notEqual(next.data, oldPayload);
});

test("'error' sets the message and clears loading, preserving prior data", () => {
  const withData: OutcomesState = {
    data: payload(),
    loading: true,
    error: null,
  };
  const next = outcomesReducer(withData, {
    type: "error",
    message: "Failed to load outcomes (500)",
  });
  assert.deepEqual(next, {
    data: withData.data,
    loading: false,
    error: "Failed to load outcomes (500)",
  });
});

test("'error' from the initial (no-data) state leaves data null", () => {
  const next = outcomesReducer(INITIAL_STATE, {
    type: "error",
    message: "Unknown error",
  });
  assert.deepEqual(next, {
    data: null,
    loading: false,
    error: "Unknown error",
  });
});

// ─── Representative multi-step transitions ──────────────────────────────

test("full happy-path sequence: initial -> start -> success", () => {
  let state = INITIAL_STATE;
  state = outcomesReducer(state, { type: "start" });
  assert.equal(state.loading, true);
  assert.equal(state.error, null);

  const loaded = payload();
  state = outcomesReducer(state, { type: "success", payload: loaded });
  assert.deepEqual(state, { data: loaded, loading: false, error: null });
});

test("full failure sequence: initial -> start -> error", () => {
  let state = INITIAL_STATE;
  state = outcomesReducer(state, { type: "start" });
  state = outcomesReducer(state, { type: "error", message: "network down" });
  assert.deepEqual(state, {
    data: null,
    loading: false,
    error: "network down",
  });
});

test("retry-after-error sequence: error -> start -> success clears the stale error", () => {
  let state: OutcomesState = { data: null, loading: false, error: "boom" };
  state = outcomesReducer(state, { type: "start" });
  assert.equal(state.error, null, "start must clear a prior error immediately");

  const loaded = payload();
  state = outcomesReducer(state, { type: "success", payload: loaded });
  assert.deepEqual(state, { data: loaded, loading: false, error: null });
});

test("refetch-after-success sequence: success -> start -> error keeps the last good data", () => {
  const firstLoad = payload({ year: 2023 });
  let state: OutcomesState = { data: firstLoad, loading: false, error: null };

  // A year/slug change triggers a refetch.
  state = outcomesReducer(state, { type: "start" });
  assert.equal(state.data, firstLoad, "start must not clear previously loaded data");

  state = outcomesReducer(state, {
    type: "error",
    message: "Failed to load outcomes (503)",
  });
  assert.deepEqual(state, {
    data: firstLoad,
    loading: false,
    error: "Failed to load outcomes (503)",
  });
});

test("reducer never mutates the input state object", () => {
  const before: OutcomesState = { data: null, loading: true, error: null };
  const snapshot = { ...before };
  outcomesReducer(before, { type: "error", message: "x" });
  assert.deepEqual(before, snapshot);
});
