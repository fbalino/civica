import assert from "node:assert/strict";
import test from "node:test";

import { assessWikidataJurisdictionIdentity } from "./jurisdiction-scope";

test("accepts a country match when Wikidata has no narrower P1001 scope", () => {
  assert.deepEqual(
    assessWikidataJurisdictionIdentity({
      expectedJurisdictionId: "Q30",
      countryJurisdictionIds: ["Q30"],
      scopeJurisdictionIds: [],
    }),
    { status: "matched", reason: "country_match_scope_unspecified" },
  );
});

test("accepts an explicit national P1001 scope", () => {
  assert.deepEqual(
    assessWikidataJurisdictionIdentity({
      expectedJurisdictionId: "Q30",
      countryJurisdictionIds: ["Q30"],
      scopeJurisdictionIds: ["Q30"],
    }),
    { status: "matched", reason: "country_and_scope_match" },
  );
});

test("rejects a dependent-territory scope even when P17 is the sovereign country", () => {
  assert.deepEqual(
    assessWikidataJurisdictionIdentity({
      expectedJurisdictionId: "Q30",
      countryJurisdictionIds: ["Q30"],
      scopeJurisdictionIds: ["Q11703"],
    }),
    { status: "mismatch", reason: "explicit_scope_mismatch" },
  );
  assert.equal(
    assessWikidataJurisdictionIdentity({
      expectedJurisdictionId: "Q30",
      countryJurisdictionIds: ["Q30"],
      scopeJurisdictionIds: ["Q30", "Q11703"],
    }).status,
    "mismatch",
  );
});

test("rejects subnational and de facto scopes without label-specific exceptions", () => {
  for (const fixture of [
    { country: "Q29", scope: "Q3995" },
    { country: "Q1045", scope: "Q34754" },
    { country: "Q691", scope: "Q18826" },
  ]) {
    assert.deepEqual(
      assessWikidataJurisdictionIdentity({
        expectedJurisdictionId: fixture.country,
        countryJurisdictionIds: [fixture.country],
        scopeJurisdictionIds: [fixture.scope],
      }),
      { status: "mismatch", reason: "explicit_scope_mismatch" },
    );
  }
});

test("fails closed on missing or conflicting country identity", () => {
  assert.equal(
    assessWikidataJurisdictionIdentity({
      expectedJurisdictionId: "Q30",
      countryJurisdictionIds: [],
      scopeJurisdictionIds: [],
    }).status,
    "missing",
  );
  assert.equal(
    assessWikidataJurisdictionIdentity({
      expectedJurisdictionId: "Q30",
      countryJurisdictionIds: ["Q142"],
      scopeJurisdictionIds: [],
    }).status,
    "mismatch",
  );
});
