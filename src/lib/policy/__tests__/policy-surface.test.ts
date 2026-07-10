/**
 * Fail-closed + false-positive/false-negative fixture suite for the
 * CLM-016 policy surface (OP48 contract §11.1). Pure, in-memory — no
 * fs, no DB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validatePolicySurface,
  checkRegistryCompleteness,
  findArtifactMissingLinks,
  findMissingPolicyAnchors,
  findDuplicatedPolicyProse,
  findOverpromiseStaffing,
  findOverpromiseNotification,
  findHardcodedSla,
  findHardcodedVersion,
  findMigrationTheater,
  findMissingCurrentBoundaries,
  checkSimulatorDrift,
} from "../policy-surface";
import { RESEARCH_ARTIFACTS, POLICY_ANCHORS } from "../research-artifacts";
import {
  simulateCorrection,
  FIXTURE_CORRECTION,
  EXPECTED_CORRECTION,
} from "../correction-simulator";

const CLEAN_POLICY_MARKDOWN = `
## Corrections {#corrections}

A correction changes a published value or statement that was wrong.
Response targets interpolate from {{state.disputeSla.initialResponseDays}}
and {{state.disputeSla.fullDispositionDays}} days.

## Retractions {#retractions}

A retraction withdraws a published output; historical access is preserved.

## Versioning {#versioning}

Version strings such as {{state.reconciliation.version}} increment per the
rules above.

## Known limitations {#known-limitations}

Every artifact links its own limitations section from here.

## Data & API corrections {#data-api-corrections}

A correction that changes an API value bumps the version in meta.

## Notification {#notification}

Civica notifies by publishing to the changelog and the public corrections log.

Civica does not currently have an automated correction-publication job.
There is no frozen public release package yet. Civica does not currently
publish a versioned API endpoint. Civica does not currently operate an email
list. Submissions whose authors request privacy are retained for review but
omitted from that public log.
`;

function cleanCombinedSource(anchors: readonly string[]): string {
  return anchors.map((a) => `<Link href="/policies#${a}">policy</Link>`).join("\n");
}

test("clean fixture: full anchors, interpolated values, no forbidden phrases -> 0 issues", () => {
  const artifactSources = RESEARCH_ARTIFACTS.map((artifact) => ({
    artifact,
    combinedSource: cleanCombinedSource(artifact.requiredPolicyAnchors),
  }));
  const issues = validatePolicySurface({
    policyMarkdown: CLEAN_POLICY_MARKDOWN,
    artifactSources,
    registry: RESEARCH_ARTIFACTS,
    mirrors: [{ label: "clean-mirror.md", text: "See [corrections](/policies#corrections)." }],
  });
  assert.deepStrictEqual(issues, []);
});

test("false-negative: artifact page missing a #corrections link is caught", () => {
  const artifact = RESEARCH_ARTIFACTS.find((a) => a.id === "civica-index")!;
  const sourceMissingCorrections = artifact.requiredPolicyAnchors
    .filter((a) => a !== "corrections")
    .map((a) => `<Link href="/policies#${a}">policy</Link>`)
    .join("\n");
  const issues = findArtifactMissingLinks(artifact, sourceMissingCorrections);
  assert.ok(issues.some((i) => i.code === "artifact-missing-policy-link" && i.anchor === "corrections"));
});

test("false-negative: a mirror containing a verbatim policy sentence is caught (duplicated + hardcoded)", () => {
  const verbatimSentence =
    "A correction changes a published value or statement that was wrong.";
  const policyBody = `## Corrections {#corrections}\n\n${verbatimSentence}\n`;
  const mirrorText = `See our corrections policy. ${verbatimSentence} Full disposition within 30 days.`;
  const duplicated = findDuplicatedPolicyProse(policyBody, mirrorText, "mirror.md");
  assert.ok(duplicated.some((i) => i.code === "duplicated-policy-prose"));
  const hardcoded = findHardcodedSla(mirrorText);
  assert.ok(hardcoded.length > 0);
});

test("false-negative: 'guaranteed response within 24 hours' trips overpromise-staffing", () => {
  const text = "We offer a guaranteed response within 24 hours, 24/7.";
  const matches = findOverpromiseStaffing(text);
  assert.ok(matches.length >= 2);
});

test("false-negative: notification overpromise phrases are caught", () => {
  const text = "We will email you and notify all affected readers via push notifications.";
  const matches = findOverpromiseNotification(text);
  assert.ok(matches.length >= 3);
});

test("false-negative: migration-theater phrasing is caught", () => {
  const text = "This value was broken; it is now fixed. The page used to say something different.";
  const matches = findMigrationTheater(text);
  assert.ok(matches.length >= 3);
});

test("false-negative: omitting a current-capability boundary is caught", () => {
  const missingEmailBoundary = CLEAN_POLICY_MARKDOWN.replace(
    /Civica does not currently operate an email\s+list\./,
    "",
  );
  const issues = findMissingCurrentBoundaries(missingEmailBoundary);
  assert.ok(issues.some((i) => i.code === "missing-current-boundary"));
});

test("simulator-drift: the live fixtures currently match (sanity)", () => {
  assert.deepStrictEqual(checkSimulatorDrift(), []);
});

test("false-negative: a one-field mutation of the expected correction output would be flagged", () => {
  const mutated = {
    ...EXPECTED_CORRECTION,
    changelog: { ...EXPECTED_CORRECTION.changelog!, severity: "minor" as const },
  };
  const actual = simulateCorrection(FIXTURE_CORRECTION);
  assert.notDeepStrictEqual(actual, mutated);
});

test("false-positive guard: the word 'correction' in ordinary prose does not trip duplicated-policy-prose", () => {
  const policyBody =
    "## Corrections {#corrections}\n\nA correction changes a published value or statement that was wrong and is logged publicly with a target response time.";
  const mirrorText =
    "This page discusses a correction to last month's Rule of Law input, unrelated in wording to the policy body.";
  const issues = findDuplicatedPolicyProse(policyBody, mirrorText, "mirror.md");
  assert.deepStrictEqual(issues, []);
});

test("false-positive guard: an interpolated '30 days' via disputeSla marker does not trip hardcoded-sla", () => {
  const text =
    "Full disposition targets {{state.disputeSla.fullDispositionDays}} days from submission.";
  assert.deepStrictEqual(findHardcodedSla(text), []);
});

test("false-positive guard: an interpolated version marker does not trip hardcoded-version", () => {
  const text = "The current reconciliation version is {{state.reconciliation.version}}.";
  assert.deepStrictEqual(findHardcodedVersion(text), []);
});

test("false-positive guard: the noun 'limitation' in ordinary methodology prose does not trip overpromise checks", () => {
  const text =
    "This methodology has a known limitation around V-Dem's annual refresh cadence.";
  assert.deepStrictEqual(findOverpromiseStaffing(text), []);
  assert.deepStrictEqual(findOverpromiseNotification(text), []);
  assert.deepStrictEqual(findMigrationTheater(text), []);
});

test("missing-policy-anchor: an incomplete policy page is caught", () => {
  const incomplete = "## Corrections {#corrections}\n\nSome text.";
  const missing = findMissingPolicyAnchors(incomplete);
  const missingAnchors = missing.map((i) => i.anchor);
  for (const anchor of POLICY_ANCHORS) {
    if (anchor === "corrections") {
      assert.ok(!missingAnchors.includes(anchor));
    } else {
      assert.ok(missingAnchors.includes(anchor));
    }
  }
});

test("registry completeness: a missing required artifact id is caught", () => {
  const withoutOne = RESEARCH_ARTIFACTS.filter((a) => a.id !== "peer-grouping");
  const issues = checkRegistryCompleteness(withoutOne);
  assert.ok(
    issues.some(
      (i) => i.code === "unregistered-artifact" && i.artifactId === "peer-grouping",
    ),
  );
});

test("registry completeness: a duplicate artifact id is caught", () => {
  const withDuplicate = [...RESEARCH_ARTIFACTS, RESEARCH_ARTIFACTS[0]];
  const issues = checkRegistryCompleteness(withDuplicate);
  assert.ok(issues.some((i) => i.code === "unregistered-artifact"));
});
