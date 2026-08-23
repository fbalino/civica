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
    "data-error-reports",
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
  for (const provider of [
    "Vercel",
    "Neon",
    "Anthropic",
    "FlagCDN",
    "OpenFreeMap",
    "Mapbox",
    "PostHog",
  ]) {
    assert.ok(providers.has(provider), provider);
  }
});

test("public submission flows prohibit new raw-IP retention", () => {
  for (const id of [
    "contact-messages",
    "data-error-reports",
    "advisory-applications",
  ]) {
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

test("the analytics flow discloses consent gating, not merely analytics", () => {
  const flow = PRIVACY_DATA_FLOWS.find((c) => c.id === "product-analytics");
  assert.ok(flow);
  assert.ok(flow.publicSummary, "analytics must be reader-visible");
  assert.deepEqual([...flow.providers], ["PostHog"]);
  // The trigger is a reader's explicit act, never a page load.
  assert.match(flow.trigger, /explicitly allows/i);
  // Each switched-off capture mode is a promise on /privacy#analytics.
  for (const pattern of [
    /session recording/i,
    /autocapture/i,
    /heatmap/i,
    /survey/i,
    /feature-flag/i,
    /Do Not Track/i,
    /local storage rather than a cookie/i,
  ]) {
    assert.match(flow.safeguards, pattern);
  }
  // Reversible, and reversible in the reader's own hands.
  assert.match(flow.deletion, /privacy page/i);
});

test("no flow still claims Civica installs no analytics at all", () => {
  for (const flow of PRIVACY_DATA_FLOWS) {
    assert.doesNotMatch(
      flow.safeguards,
      /No third-party behavioral analytics/i,
      `${flow.id} carries a stale no-analytics claim`,
    );
  }
});
