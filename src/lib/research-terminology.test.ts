import assert from "node:assert/strict";
import { test } from "node:test";

import { GLOSSARY_TERMS } from "./data/glossary";
import {
  RESEARCH_TERM_IDS,
  RESEARCH_TERMS,
  lintTerminology,
  splitIntoSentences,
  validateResearchTerminologyRegistry,
} from "./research-terminology";

test("registry contains exactly the 14 required research terms", () => {
  assert.deepEqual(
    RESEARCH_TERMS.map((term) => term.id),
    [...RESEARCH_TERM_IDS],
  );
  assert.deepEqual(validateResearchTerminologyRegistry(), []);
});

test("public glossary generates each normative term exactly once with identical prose", () => {
  for (const term of RESEARCH_TERMS) {
    const entries = GLOSSARY_TERMS.filter((entry) => entry.id === term.id);
    assert.equal(entries.length, 1, term.id);
    assert.equal(entries[0].term, term.term);
    assert.equal(entries[0].definition, term.definition);
    assert.ok(entries[0].seeAlso?.length, term.id);
  }
});

test("registry validation catches duplicate, missing, and incomplete entries", () => {
  const broken = [
    ...RESEARCH_TERMS.slice(0, -1),
    { ...RESEARCH_TERMS[0], definition: "", methodLinks: [] },
  ];
  const ids = validateResearchTerminologyRegistry(broken).map((issue) => issue.ruleId);
  assert.ok(ids.includes("duplicate-term-id"));
  assert.ok(ids.includes("missing-term-id"));
  assert.ok(ids.includes("incomplete-term"));
  assert.ok(ids.includes("missing-method-link"));
});

test("sentence splitter keeps same-sentence qualifiers with their claim", () => {
  assert.deepEqual(splitIntoSentences("One sentence. This is not validated."), [
    "One sentence.",
    "This is not validated.",
  ]);
});

test("lint rejects an affirmative validated Civica Index claim", () => {
  const issues = lintTerminology("The Civica Index is scientifically validated.");
  assert.equal(issues[0]?.ruleId, "unqualified-validated-claim");
  assert.equal(
    lintTerminology("Our methodology has been independently validated.")[0]?.ruleId,
    "unqualified-validated-claim",
  );
});

test("lint permits explicit non-validation and implementation validation", () => {
  assert.deepEqual(lintTerminology("The Civica Index has not been independently validated."), []);
  assert.deepEqual(lintTerminology("Schema validation rejects an incomplete response."), []);
  assert.deepEqual(lintTerminology("The Index response schema is validated by a fixture."), []);
});

test("lint does not treat an external method as a Civica validation claim", () => {
  assert.deepEqual(lintTerminology("The external study's method is independently validated."), []);
});

test("lint rejects an affirmative peer-reviewed Civica methodology claim", () => {
  const issues = lintTerminology("The Civica methodology is peer-reviewed.");
  assert.equal(issues[0]?.ruleId, "unqualified-peer-review-claim");
  assert.equal(
    lintTerminology("The Civica methodology has undergone peer review.")[0]?.ruleId,
    "unqualified-peer-review-claim",
  );
});

test("lint permits explicit non-peer-review and external literature", () => {
  assert.deepEqual(lintTerminology("The Civica methodology is not peer-reviewed."), []);
  assert.deepEqual(lintTerminology("A peer-reviewed external study reports the estimate."), []);
});

test("lint rejects a simulation range presented as a confidence interval", () => {
  const issues = lintTerminology("The Civica simulation range is a confidence interval.");
  assert.equal(issues[0]?.ruleId, "unqualified-confidence-interval");
});

test("lint permits the canonical confidence-interval disclaimer", () => {
  assert.deepEqual(
    lintTerminology("The input-variation range is not a confidence interval for a true score."),
    [],
  );
});

test("lint rejects a false published replication-package claim", () => {
  const issues = lintTerminology("The Civica Index replication package is now available.");
  assert.equal(issues[0]?.ruleId, "unqualified-replication-claim");
  assert.equal(
    lintTerminology("The replication status says the Civica Index replication package is available.")[0]
      ?.ruleId,
    "unqualified-replication-claim",
  );
});

test("nearby plan or external words cannot excuse a false authority claim", () => {
  assert.equal(
    lintTerminology("The Civica Index is academically validated, and the release plan is public.")[0]
      ?.ruleId,
    "unqualified-validated-claim",
  );
  assert.equal(
    lintTerminology("The Civica methodology is peer-reviewed, unlike the external literature.")[0]
      ?.ruleId,
    "unqualified-peer-review-claim",
  );
});

test("lint permits explicit non-availability and external replication archives", () => {
  assert.deepEqual(lintTerminology("The Civica Index replication package is not yet available."), []);
  assert.deepEqual(lintTerminology("The external dataset has a replication archive."), []);
});

test("ordinary research vocabulary is not blanket-banned", () => {
  assert.deepEqual(
    lintTerminology(
      "A source supplies an observation. Reconciliation may produce a fact or estimate. An indicator can feed an index, while an event may create an experimental signal with documented uncertainty.",
    ),
    [],
  );
});
