/**
 * The analytics consent contract must fail closed: anything Civica cannot read
 * as an explicit, current-version "granted" is not consent.
 *
 * Pure: no DB, no network, no browser. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ANALYTICS_CONSENT_VERSION,
  parseStoredConsent,
  serializeConsent,
} from "./consent";
import {
  ANALYTICS_CAPTURE_POLICY,
  analyticsConfigured,
  posthogAssetHost,
} from "./posthog";

test("an absent decision is pending, never granted", () => {
  assert.equal(parseStoredConsent(null), "pending");
  assert.equal(parseStoredConsent(""), "pending");
});

test("malformed or hostile storage never yields consent", () => {
  for (const raw of [
    "not json",
    "null",
    "[]",
    '"granted"',
    "{}",
    '{"state":"granted"}', // no version
    '{"version":"other/v1","state":"granted"}', // wrong contract
    '{"version":"civica-analytics-consent/v1","state":"yes"}', // unknown state
  ]) {
    assert.notEqual(parseStoredConsent(raw), "granted", raw);
  }
});

test("a decision written under a superseded version is re-asked", () => {
  const stale = JSON.stringify({
    version: "civica-analytics-consent/v0",
    state: "granted",
    decidedAt: "2026-08-01T00:00:00.000Z",
  });
  assert.equal(parseStoredConsent(stale), "pending");
});

test("a current, explicit decision round-trips in both directions", () => {
  const at = new Date("2026-08-23T12:00:00.000Z");
  for (const decision of ["granted", "denied"] as const) {
    const raw = serializeConsent(decision, at);
    assert.equal(parseStoredConsent(raw), decision);
    assert.match(raw, new RegExp(ANALYTICS_CONSENT_VERSION.replace("/", "\\/")));
  }
});

test("analytics stays off when no project key is configured", () => {
  // The build-time key is absent in the test environment, so the deployment
  // must report itself unconfigured — which suppresses both the loader and
  // the consent banner.
  assert.equal(analyticsConfigured(), Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY));
});

test("the disclosed capture policy stays minimal", () => {
  // These mirror the sentences on /privacy#analytics. Flipping one on without
  // changing that page is exactly the drift this guards.
  assert.equal(ANALYTICS_CAPTURE_POLICY.autocapture, false);
  assert.equal(ANALYTICS_CAPTURE_POLICY.sessionRecording, false);
  assert.equal(ANALYTICS_CAPTURE_POLICY.heatmaps, false);
  assert.equal(ANALYTICS_CAPTURE_POLICY.surveys, false);
  assert.equal(ANALYTICS_CAPTURE_POLICY.featureFlags, false);
  assert.equal(ANALYTICS_CAPTURE_POLICY.respectDoNotTrack, true);
  assert.equal(ANALYTICS_CAPTURE_POLICY.personProfiles, "identified_only");
  assert.equal(ANALYTICS_CAPTURE_POLICY.pageviews, "manual");
});

test("the asset host follows the configured ingestion region", () => {
  assert.equal(
    posthogAssetHost("https://us.i.posthog.com"),
    "https://us-assets.i.posthog.com",
  );
  assert.equal(
    posthogAssetHost("https://eu.i.posthog.com"),
    "https://eu-assets.i.posthog.com",
  );
  // A self-hosted or reverse-proxied origin serves its own bundle.
  assert.equal(
    posthogAssetHost("https://civicaatlas.org/ingest"),
    "https://civicaatlas.org/ingest",
  );
});
