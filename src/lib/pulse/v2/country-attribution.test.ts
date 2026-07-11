import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseSubjectVerdict,
  resolveSubjectVerdict,
  subjectAttributionDecisionPayload,
} from "./country-attribution";
import { buildJurisdictionEntityCatalog } from "./jurisdiction-entities";

const catalog = buildJurisdictionEntityCatalog([
  { id: "jur-us", name: "United States", iso2: "US", iso3: "USA", slug: "united-states" },
  { id: "jur-ca", name: "Canada", iso2: "CA", iso3: "CAN", slug: "canada" },
]);

const SINGLE = {
  scope: "single",
  primary_iso3: "USA",
  attributions: [
    {
      iso3: "USA",
      role: "primary",
      rationale: "The event changes United States institutions.",
      evidence_refs: ["headline"],
    },
  ],
  reasoning: "The United States is the central domestic subject.",
};

test("single-country verdict requires one matching primary and evidence", () => {
  const parsed = parseSubjectVerdict(JSON.stringify(SINGLE));
  assert.equal(parsed?.primaryIso3, "USA");
  assert.equal(parsed?.attributions[0].role, "primary");
  assert.equal(
    parseSubjectVerdict(
      JSON.stringify({ ...SINGLE, attributions: [{ ...SINGLE.attributions[0], evidence_refs: [] }] }),
    ),
    null,
  );
});

test("cross-border verdict retains one primary and affected jurisdictions", () => {
  const parsed = parseSubjectVerdict(
    JSON.stringify({
      scope: "multi",
      primary_iso3: "USA",
      attributions: [
        ...SINGLE.attributions,
        {
          iso3: "CAN",
          role: "affected",
          rationale: "The same measure applies to Canadian institutions.",
          evidence_refs: ["description"],
        },
      ],
      reasoning: "A United States measure materially affects Canada.",
    }),
  );
  assert.ok(parsed);
  const resolved = resolveSubjectVerdict({
    verdict: parsed,
    catalog,
    promptContext: "United States (USA); Canada (CAN)",
  });
  assert.equal(resolved.status, "multiple");
  assert.equal(resolved.primaryJurisdictionId, "jur-us");
  assert.deepEqual(
    resolved.attributions.map((row) => [row.entity.iso3, row.role]),
    [["USA", "primary"], ["CAN", "affected"]],
  );
  const payload = subjectAttributionDecisionPayload(resolved);
  assert.equal(payload.status, "multiple");
  assert.deepEqual(payload.affectedJurisdictionIds, ["jur-us", "jur-ca"]);
  assert.equal(payload.attributions?.[1].rationale, "The same measure applies to Canadian institutions.");
});

test("unresolved and supranational verdicts abstain without a provisional projection", () => {
  for (const scope of ["unclear", "supranational"] as const) {
    const parsed = parseSubjectVerdict(
      JSON.stringify({ scope, primary_iso3: null, attributions: [], reasoning: "No domestic primary." }),
    );
    assert.ok(parsed);
    assert.equal(
      resolveSubjectVerdict({ verdict: parsed, catalog, promptContext: "none" })
        .primaryJurisdictionId,
      null,
    );
  }
});

test("unknown ISO3 and malformed multi-country outputs fail closed", () => {
  const unknown = parseSubjectVerdict(
    JSON.stringify({
      ...SINGLE,
      primary_iso3: "ZZZ",
      attributions: [{ ...SINGLE.attributions[0], iso3: "ZZZ" }],
    }),
  );
  assert.ok(unknown);
  assert.equal(
    resolveSubjectVerdict({ verdict: unknown, catalog, promptContext: "none" }).status,
    "unresolved",
  );
  assert.equal(
    parseSubjectVerdict(
      JSON.stringify({ ...SINGLE, scope: "multi" }),
    ),
    null,
  );
});
