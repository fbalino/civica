import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseClassify,
  parseVerify,
  type VerifyResultLite,
} from "./classifier-prompt";
import {
  ensembleRequiresReview,
  normalizeInvalidConsensusForReview,
  singleEngineRequiresReview,
  verifierObjects,
  type EnsembleGateConsensus,
} from "./publication-gate";

const VALID_CLASSIFICATION = {
  category: "judicial_independence",
  runner_up: "none",
  severity_tier: "moderate_neg",
  severity_value: -4,
  self_confidence: 0.8,
  rationale: "test",
};

const CONFIRMED_VERIFY: VerifyResultLite = {
  verdict: "confirmed",
  confidence: "high",
  categoryOk: true,
  severityOk: true,
  subjectOk: true,
  isEvent: true,
  rationale: "survives scrutiny",
};

const WEAK_MAJORITY: EnsembleGateConsensus = {
  agreement: "two_of_three",
  selfConfidence: 0.69,
  degraded: false,
  severityTier: "moderate_neg",
};

test("classify parser rejects missing, non-finite, and out-of-range self-confidence", () => {
  for (const selfConfidence of [undefined, null, "0.8", -0.01, 1.01]) {
    const payload = { ...VALID_CLASSIFICATION } as Record<string, unknown>;
    if (selfConfidence === undefined) delete payload.self_confidence;
    else payload.self_confidence = selfConfidence;
    assert.equal(
      parseClassify(JSON.stringify(payload)),
      null,
      `accepted unusable self_confidence ${String(selfConfidence)}`,
    );
  }

  const nonFiniteJson = JSON.stringify(VALID_CLASSIFICATION).replace(
    '"self_confidence":0.8',
    '"self_confidence":1e309',
  );
  assert.equal(parseClassify(nonFiniteJson), null);
});

test("classify parser accepts both declared self-confidence boundaries", () => {
  for (const selfConfidence of [0, 1]) {
    const parsed = parseClassify(
      JSON.stringify({
        ...VALID_CLASSIFICATION,
        self_confidence: selfConfidence,
      }),
    );
    assert.equal(parsed?.selfConfidence, selfConfidence);
  }
});

test("classify parser rejects missing, non-finite, and nonnumeric severity", () => {
  for (const severityValue of [undefined, null, "-4"]) {
    const payload = { ...VALID_CLASSIFICATION } as Record<string, unknown>;
    if (severityValue === undefined) delete payload.severity_value;
    else payload.severity_value = severityValue;
    assert.equal(
      parseClassify(JSON.stringify(payload)),
      null,
      `accepted unusable severity_value ${String(severityValue)}`,
    );
  }

  const nonFiniteJson = JSON.stringify(VALID_CLASSIFICATION).replace(
    '"severity_value":-4',
    '"severity_value":1e309',
  );
  assert.equal(parseClassify(nonFiniteJson), null);

  assert.equal(
    parseClassify(
      JSON.stringify({ ...VALID_CLASSIFICATION, severity_value: -999 }),
    )?.severityValue,
    -999,
    "finite out-of-tier values should remain available for caller clamping",
  );
});

test("verify parser rejects missing or mistyped verdict and axis fields", () => {
  const wireVerify = {
    verdict: "confirmed",
    confidence: "high",
    category_ok: true,
    severity_ok: true,
    subject_ok: true,
    is_event: true,
    rationale: "survives scrutiny",
  };

  for (const field of [
    "verdict",
    "category_ok",
    "severity_ok",
    "subject_ok",
    "is_event",
  ] as const) {
    const missing = { ...wireVerify } as Record<string, unknown>;
    delete missing[field];
    assert.equal(parseVerify(JSON.stringify(missing)), null, `accepted missing ${field}`);

    const mistyped = { ...wireVerify, [field]: "invalid" };
    assert.equal(
      parseVerify(JSON.stringify(mistyped)),
      null,
      `accepted mistyped ${field}`,
    );
  }
});

test("a high-confidence partial verifier response cannot bypass review", () => {
  const partial = parseVerify(
    JSON.stringify({
      verdict: "confirmed",
      confidence: "high",
      category_ok: true,
    }),
  );
  assert.equal(partial, null);
  assert.equal(
    ensembleRequiresReview(WEAK_MAJORITY, partial, {
      forceReview: false,
      verifySkipped: false,
    }),
    true,
  );
});

test("every explicit negative verifier signal is an objection", () => {
  const objections: VerifyResultLite[] = [
    { ...CONFIRMED_VERIFY, confidence: "low" },
    { ...CONFIRMED_VERIFY, verdict: "revised" },
    { ...CONFIRMED_VERIFY, verdict: "rejected" },
    { ...CONFIRMED_VERIFY, categoryOk: false },
    { ...CONFIRMED_VERIFY, severityOk: false },
    { ...CONFIRMED_VERIFY, subjectOk: false },
    { ...CONFIRMED_VERIFY, isEvent: false },
  ];

  assert.equal(verifierObjects(null), true, "failed pass was not an objection");
  assert.equal(verifierObjects(CONFIRMED_VERIFY), false);
  for (const verify of objections) {
    assert.equal(verifierObjects(verify), true, JSON.stringify(verify));
  }
});

test("no verifier objection bypasses a weak ensemble majority", () => {
  const objections: Array<VerifyResultLite | null> = [
    null,
    { ...CONFIRMED_VERIFY, confidence: "low" },
    { ...CONFIRMED_VERIFY, verdict: "revised" },
    { ...CONFIRMED_VERIFY, verdict: "rejected" },
    { ...CONFIRMED_VERIFY, categoryOk: false },
    { ...CONFIRMED_VERIFY, severityOk: false },
    { ...CONFIRMED_VERIFY, subjectOk: false },
    { ...CONFIRMED_VERIFY, isEvent: false },
  ];

  for (const verify of objections) {
    assert.equal(
      ensembleRequiresReview(WEAK_MAJORITY, verify, {
        forceReview: false,
        verifySkipped: false,
      }),
      true,
      `objection bypassed review: ${JSON.stringify(verify)}`,
    );
  }
});

test("a verifier objection routes a degraded majority to review", () => {
  assert.equal(
    ensembleRequiresReview(
      {
        ...WEAK_MAJORITY,
        selfConfidence: 0.95,
        degraded: true,
      },
      { ...CONFIRMED_VERIFY, categoryOk: false },
      { forceReview: false, verifySkipped: false },
    ),
    true,
  );
});

test("single-engine mode always queues because one classifier is not an ensemble", () => {
  const objections: Array<VerifyResultLite | null> = [
    null,
    { ...CONFIRMED_VERIFY, confidence: "low" },
    { ...CONFIRMED_VERIFY, verdict: "revised" },
    { ...CONFIRMED_VERIFY, verdict: "rejected" },
    { ...CONFIRMED_VERIFY, categoryOk: false },
    { ...CONFIRMED_VERIFY, severityOk: false },
    { ...CONFIRMED_VERIFY, subjectOk: false },
    { ...CONFIRMED_VERIFY, isEvent: false },
  ];

  for (const verify of objections) {
    assert.equal(
      singleEngineRequiresReview("moderate_neg", verify),
      true,
      `single-engine objection bypassed review: ${JSON.stringify(verify)}`,
    );
  }
  assert.equal(
    singleEngineRequiresReview("moderate_neg", CONFIRMED_VERIFY),
    true,
  );
});

test("invalid consensus categories persist as unresolved without losing the audit value", () => {
  const normalized = normalizeInvalidConsensusForReview({
    category: "hallucinated_category",
    runnerUp: "judicial_independence",
    agreement: "two_of_three" as const,
  });
  assert.deepEqual(normalized, {
    category: "none",
    runnerUp: "hallucinated_category",
    agreement: "two_of_three",
  });
});
