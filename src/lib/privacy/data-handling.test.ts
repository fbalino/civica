import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PRIVACY_DATA_FLOWS,
  PRIVACY_FLOW_IDS,
  PUBLIC_PRIVACY_DATA_FLOWS,
  privacyDataHandlingErrors,
} from "./data-handling";

test("the canonical privacy inventory is closed and complete", () => {
  assert.deepEqual(privacyDataHandlingErrors(), []);
  assert.equal(PRIVACY_DATA_FLOWS.length, PRIVACY_FLOW_IDS.length);
});

test("every required BRD-012 domain has a distinct flow", () => {
  const ids = new Set<string>(PRIVACY_DATA_FLOWS.map((flow) => flow.id));
  for (const id of [
    "contact-messages",
    "advisory-applications",
    "route-performance",
    "owner-admin",
    "ask-civica",
    "pulse-coding",
    "error-monitoring",
  ]) {
    assert.ok(ids.has(id), id);
  }
});

test("public summaries name every reader-visible external service boundary", () => {
  const providers = new Set(PUBLIC_PRIVACY_DATA_FLOWS.flatMap((flow) => flow.providers));
  for (const provider of ["Vercel", "Neon", "Anthropic", "FlagCDN", "OpenFreeMap", "Mapbox"]) {
    assert.ok(providers.has(provider), provider);
  }
});

test("contact and application flows prohibit new raw-IP retention", () => {
  for (const id of ["contact-messages", "advisory-applications"]) {
    const flow = PRIVACY_DATA_FLOWS.find((candidate) => candidate.id === id);
    assert.ok(flow);
    assert.match(flow.safeguards, /no new raw-IP retention/i);
  }
});

test("operational telemetry declares bounded retention or an honest absence", () => {
  const expected = new Map([
    ["route-performance", /30 days/i],
    ["error-monitoring", /90 days/i],
    ["owner-admin", /no automatic deletion/i],
    ["pulse-coding", /no automatic deletion period/i],
  ]);
  for (const [id, pattern] of expected) {
    const flow = PRIVACY_DATA_FLOWS.find((candidate) => candidate.id === id);
    assert.ok(flow);
    assert.match(flow.retention, pattern);
  }
});
