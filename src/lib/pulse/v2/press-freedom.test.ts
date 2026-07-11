import assert from "node:assert/strict";
import test from "node:test";

import {
  RSF_2026_CANDIDATE_RELEASE,
  informationEnvironmentMultiplier,
  missingInformationEnvironmentContext,
  observedInformationEnvironmentContext,
} from "./press-freedom";

const observedRestricted = () =>
  observedInformationEnvironmentContext({
    score: 30,
    sourceId: RSF_2026_CANDIDATE_RELEASE.sourceId,
    sourceUrl: RSF_2026_CANDIDATE_RELEASE.sourceUrl,
    upstreamRelease: RSF_2026_CANDIDATE_RELEASE.upstreamRelease,
    observationYear: RSF_2026_CANDIDATE_RELEASE.observationYear,
    retrievedAt: RSF_2026_CANDIDATE_RELEASE.retrievedAt,
    contentSha256: RSF_2026_CANDIDATE_RELEASE.contentSha256,
    publisherRows: RSF_2026_CANDIDATE_RELEASE.publisherRows,
    matchedJurisdictions: 175,
    supportedJurisdictions: 195,
    rightsStatus: "pending",
    useStatus: "disabled_pending_rights_and_validation",
  });

test("missing information context stays missing and has no multiplier", () => {
  const context = missingInformationEnvironmentContext();
  assert.equal(context.score, null);
  assert.equal(context.sourceCoverage.supportedJurisdictions, null);
  assert.equal(
    informationEnvironmentMultiplier({
      context,
      isPositive: true,
      specialistGroups: 0,
      newsGroups: 1,
      mode: "sensitivity",
    }),
    1,
  );
});

test("an observed value requires complete provenance and coverage", () => {
  const context = observedRestricted();
  assert.equal(context.valueStatus, "observed");
  assert.equal(context.tier, "restricted");
  assert.equal(context.sourceCoverage.publisherRows, 180);
  assert.throws(
    () =>
      observedInformationEnvironmentContext({
        ...context,
        score: 30,
        sourceId: "",
        sourceUrl: "https://example.test",
        upstreamRelease: "fixture",
        observationYear: 2025,
        retrievedAt: "2026-07-11T00:00:00.000Z",
        contentSha256: "a".repeat(64),
        publisherRows: 180,
        matchedJurisdictions: 1,
        supportedJurisdictions: 1,
        rightsStatus: "pending",
        useStatus: "disabled_pending_rights_and_validation",
      }),
    /requires a source id/,
  );
});

test("production ignores an observed restricted context until validation", () => {
  const context = observedRestricted();
  assert.equal(
    informationEnvironmentMultiplier({
      context,
      isPositive: true,
      specialistGroups: 0,
      newsGroups: 1,
      mode: "production",
    }),
    1,
  );
});

test("the legacy scenario is visible only as a sensitivity effect", () => {
  const context = observedRestricted();
  assert.equal(
    informationEnvironmentMultiplier({
      context,
      isPositive: false,
      specialistGroups: 0,
      newsGroups: 1,
      mode: "sensitivity",
    }),
    0.3,
  );
  assert.equal(
    informationEnvironmentMultiplier({
      context,
      isPositive: true,
      specialistGroups: 0,
      newsGroups: 1,
      mode: "sensitivity",
    }),
    0.15,
  );
});
