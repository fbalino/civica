/**
 * Fail-closed + false-positive/false-negative fixture suite for the
 * BRD-013 terms-conditions contract. Pure, in-memory — no fs, no DB.
 * Synthetic fixtures stand in for the real src/app/terms/page.tsx,
 * api-docs/page.tsx, and licensing/page.tsx sources so this suite does
 * not depend on exact production prose wording; production coverage is
 * proved separately by `npm run validate:terms-conditions` against the
 * real files.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TERMS_CLAUSES,
  TERMS_CLAUSE_IDS,
  validateTermsConditions,
  findMissingClauseAnchors,
  findMissingClausePhrases,
  findContradictingClaims,
  type TermsClause,
  type TermsClauseId,
} from "../terms-contract";

// ─────────────────────────────────────────────────────────────────────
// Clean fixtures — every clause present, findable, and uncontradicted.
// ─────────────────────────────────────────────────────────────────────

const CLEAN_TERMS_SOURCE = `
<section id="use" className="editorial-section">
  <p>
    You may read, search, cite, and link to Civica Atlas freely.
    No account is required, and there is nothing to sign up for.
  </p>
  <p>
    Please use the site in good faith. Do not attempt to break,
    overload, or scrape it in ways that degrade the service for others.
  </p>
  <p>Use the API within any published rate limits and reuse terms.</p>
</section>

<section id="data-reuse" className="editorial-section">
  <p>
    Cite Civica Atlas when reusing Civica Index, Civica Pulse, or
    reconciliation-derived outputs.
  </p>
</section>

<section id="downloads" className="editorial-section">
  <p>
    Downloading is free, but it is not a reuse license — reuse rights
    remain source-by-source, exactly as described on Licensing.
  </p>
</section>

<section id="embedding" className="editorial-section">
  <p>
    The legacy embed widget is retired. Every request now returns
    410 Gone with a short retirement notice.
  </p>
</section>

<section id="accuracy" className="editorial-section">
  <p>
    Civica Atlas is provided &ldquo;as is.&rdquo; We make no warranty
    that every data point is complete, current, or error-free, and the
    service may change or be unavailable at times. Civica is not liable
    for losses arising from reliance on the data.
  </p>
</section>

<section id="changes" className="editorial-section">
  <p className="editorial-page-meta">Last updated: July 10, 2026</p>
  <p>
    We may update these terms as the site evolves. Questions belong on
    the contact page.
  </p>
</section>
`;

const CLEAN_API_DOCS_SOURCE =
  "The bulk export route is not currently rate-limited and does not send CORS headers.";
const CLEAN_LICENSING_SOURCE =
  "Reuse rights are source-by-source. See /licensing#reuse for the boundary.";

function cleanInput() {
  return {
    termsSource: CLEAN_TERMS_SOURCE,
    apiDocsSource: CLEAN_API_DOCS_SOURCE,
    licensingSource: CLEAN_LICENSING_SOURCE,
  };
}

test("registry declares exactly the ten required clause topics, each once", () => {
  assert.strictEqual(TERMS_CLAUSE_IDS.length, 10);
  const ids = TERMS_CLAUSES.map((c) => c.id);
  assert.strictEqual(ids.length, 10);
  assert.strictEqual(new Set(ids).size, 10);
  for (const id of TERMS_CLAUSE_IDS) {
    assert.ok(ids.includes(id), `registry is missing clause "${id}"`);
  }
});

test("clean fixture: all ten clauses present, findable, and uncontradicted -> 0 issues", () => {
  assert.deepStrictEqual(validateTermsConditions(cleanInput()), []);
});

// ─────────────────────────────────────────────────────────────────────
// Per-clause: missing content (required phrase stripped) is caught.
// ─────────────────────────────────────────────────────────────────────

function stripClausePhrases(source: string, clause: TermsClause): string {
  let result = source;
  for (const pattern of clause.requiredPatterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    result = result.replace(new RegExp(pattern.source, flags), "[[removed]]");
  }
  return result;
}

for (const clause of TERMS_CLAUSES) {
  test(`${clause.id}: stripping its required phrase(s) is caught as a missing clause`, () => {
    const stripped = stripClausePhrases(CLEAN_TERMS_SOURCE, clause);
    const issues = findMissingClausePhrases(stripped);
    assert.ok(
      issues.some(
        (i) => i.clauseId === clause.id && i.code === "missing-clause-phrase",
      ),
      `expected a missing-clause-phrase issue for "${clause.id}"`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────
// Whole-section removal is caught as a missing anchor (representative
// cases: two clauses with a unique anchor, one shared-anchor section
// removed wholesale to prove every co-anchored clause is flagged).
// ─────────────────────────────────────────────────────────────────────

function removeSection(source: string, anchor: string): string {
  return source.replace(
    new RegExp(`<section id="${anchor}"[\\s\\S]*?<\\/section>`),
    "",
  );
}

test("embedding: removing its whole section is caught as a missing anchor", () => {
  const withoutEmbedding = removeSection(CLEAN_TERMS_SOURCE, "embedding");
  const issues = findMissingClauseAnchors(withoutEmbedding);
  assert.ok(issues.some((i) => i.clauseId === "embedding" && i.code === "missing-clause-anchor"));
});

test("downloads-reuse-rights: removing its whole section is caught as a missing anchor", () => {
  const withoutDownloads = removeSection(CLEAN_TERMS_SOURCE, "downloads");
  const issues = findMissingClauseAnchors(withoutDownloads);
  assert.ok(
    issues.some(
      (i) => i.clauseId === "downloads-reuse-rights" && i.code === "missing-clause-anchor",
    ),
  );
});

test("removing the whole 'use' section flags every clause anchored there", () => {
  const withoutUse = removeSection(CLEAN_TERMS_SOURCE, "use");
  const flagged = new Set(findMissingClauseAnchors(withoutUse).map((i) => i.clauseId));
  assert.ok(flagged.has("acceptable-use"));
  assert.ok(flagged.has("rate-limits"));
  assert.ok(flagged.has("account-none"));
});

test("removing the whole 'changes' section flags both clauses anchored there", () => {
  const withoutChanges = removeSection(CLEAN_TERMS_SOURCE, "changes");
  const flagged = new Set(findMissingClauseAnchors(withoutChanges).map((i) => i.clauseId));
  assert.ok(flagged.has("governing-terms-change"));
  assert.ok(flagged.has("contact"));
});

// ─────────────────────────────────────────────────────────────────────
// Per-clause: a claim contradicting rights/capabilities is caught,
// regardless of which of the three surfaces it appears in.
// ─────────────────────────────────────────────────────────────────────

const EXAMPLE_CONTRADICTIONS: Record<TermsClauseId, string> = {
  "acceptable-use": "no restrictions apply",
  attribution: "attribution is never required",
  "rate-limits": "no rate limits apply",
  "uptime-no-warranty": "we guarantee 100% uptime",
  "data-accuracy-no-liability": "Civica guarantees complete accuracy",
  embedding: "you can embed a live score",
  "downloads-reuse-rights": "free access grants a reuse license",
  "account-none": "you must create an account",
  "governing-terms-change": "these terms never change",
  contact: "there is no way to contact us",
};

for (const clause of TERMS_CLAUSES) {
  test(`${clause.id}: a contradicting claim anywhere in the combined surfaces is caught`, () => {
    const contradiction = EXAMPLE_CONTRADICTIONS[clause.id];
    // Sanity: the fixture string must actually match one of the clause's
    // own prohibited patterns, or this test would be vacuous.
    assert.ok(
      clause.prohibitedPatterns.some((p) => p.test(contradiction)),
      `fixture contradiction for "${clause.id}" does not match its own prohibitedPatterns`,
    );
    const combined = `${CLEAN_TERMS_SOURCE}\n${contradiction}`;
    const issues = findContradictingClaims(combined);
    assert.ok(
      issues.some((i) => i.clauseId === clause.id && i.code === "contradicting-claim"),
    );
  });
}

test("a contradiction planted only in apiDocsSource is still caught by the full validator", () => {
  const issues = validateTermsConditions({
    termsSource: CLEAN_TERMS_SOURCE,
    apiDocsSource: `${CLEAN_API_DOCS_SOURCE} You can embed a live score anywhere.`,
    licensingSource: CLEAN_LICENSING_SOURCE,
  });
  assert.ok(issues.some((i) => i.clauseId === "embedding" && i.code === "contradicting-claim"));
});

test("a contradiction planted only in licensingSource is still caught by the full validator", () => {
  const issues = validateTermsConditions({
    termsSource: CLEAN_TERMS_SOURCE,
    apiDocsSource: CLEAN_API_DOCS_SOURCE,
    licensingSource: `${CLEAN_LICENSING_SOURCE} Free access grants a reuse license to everyone.`,
  });
  assert.ok(
    issues.some(
      (i) => i.clauseId === "downloads-reuse-rights" && i.code === "contradicting-claim",
    ),
  );
});

// ─────────────────────────────────────────────────────────────────────
// The existing reuse-rights prohibited-language scanner is wired in.
// ─────────────────────────────────────────────────────────────────────

test("blanket open-source/MIT overclaims in terms prose are caught via the shared reuse-rights scanner", () => {
  const issues = validateTermsConditions({
    termsSource: `${CLEAN_TERMS_SOURCE}\nThe Civica codebase is open-source.`,
    apiDocsSource: CLEAN_API_DOCS_SOURCE,
    licensingSource: CLEAN_LICENSING_SOURCE,
  });
  assert.ok(issues.some((i) => i.code === "prohibited-rights-language"));
});

test("a negated open-source denial does not trip the shared reuse-rights scanner", () => {
  const issues = validateTermsConditions({
    termsSource: `${CLEAN_TERMS_SOURCE}\nThe Civica codebase is not open-source.`,
    apiDocsSource: CLEAN_API_DOCS_SOURCE,
    licensingSource: CLEAN_LICENSING_SOURCE,
  });
  assert.ok(!issues.some((i) => i.code === "prohibited-rights-language"));
});
