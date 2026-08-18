import assert from "node:assert/strict";
import test from "node:test";

import {
  recordVoterFailure,
  recordVoterFailureOutcome,
  resetVoterFailures,
  voterFailureCounts,
} from "./classify";

test("voter dropouts are tallied per provider and paired with the agreed outcome", () => {
  resetVoterFailures();
  assert.deepEqual(voterFailureCounts(), {});

  // Two content-policy refusals on severe stories and one ordinary timeout
  // on a mild one — the shape that would reveal content-correlated dropout,
  // where a voter goes missing hardest exactly where the news is worst.
  recordVoterFailure("moonshot", "content_filter");
  recordVoterFailureOutcome(
    [{ provider: "moonshot", kind: "content_filter" }],
    "catastrophic_neg",
  );
  recordVoterFailure("moonshot", "content_filter");
  recordVoterFailureOutcome(
    [{ provider: "moonshot", kind: "content_filter" }],
    "severe_neg",
  );
  recordVoterFailure("openai", "timeout");
  recordVoterFailureOutcome(
    [{ provider: "openai", kind: "timeout" }],
    "low_neg",
  );

  assert.deepEqual(voterFailureCounts(), {
    "moonshot.content_filter": 2,
    "moonshot.content_filter.severity.catastrophic_neg": 1,
    "moonshot.content_filter.severity.severe_neg": 1,
    "openai.timeout": 1,
    "openai.timeout.severity.low_neg": 1,
  });
});

test("each classify stage run starts from an empty tally", () => {
  resetVoterFailures();
  recordVoterFailure("moonshot", "content_filter");
  assert.equal(voterFailureCounts()["moonshot.content_filter"], 1);
  // classifyClusters calls resetVoterFailures() at the top of every run, so a
  // second in-process run can never inherit the previous run's dropouts.
  resetVoterFailures();
  assert.deepEqual(voterFailureCounts(), {});
});

test("a cluster with no dropouts records nothing", () => {
  resetVoterFailures();
  recordVoterFailureOutcome([], "catastrophic_neg");
  assert.deepEqual(voterFailureCounts(), {});
});
