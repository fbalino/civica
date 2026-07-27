export type ElectionJurisdictionIdentityStatus =
  | "matched"
  | "missing"
  | "mismatch";

export type WikidataJurisdictionIdentityReason =
  | "country_and_scope_match"
  | "country_match_scope_unspecified"
  | "expected_jurisdiction_missing"
  | "country_claim_missing"
  | "country_mismatch"
  | "explicit_scope_mismatch";

export interface WikidataJurisdictionIdentityAssessment {
  status: ElectionJurisdictionIdentityStatus;
  reason: WikidataJurisdictionIdentityReason;
}

/**
 * Wikidata's P17 identifies the containing country, not necessarily the polity
 * whose electorate is voting. P1001 ("applies to jurisdiction") is the more
 * specific scope signal when the publisher supplies it. A row is national only
 * when P17 contains the expected country and any explicit P1001 scope contains
 * that same jurisdiction. Contradictory explicit scope fails closed: it may be
 * a dependent-territory/subnational election or a publisher-data error, but it
 * is not safe to present as a national election without reconciliation.
 */
export function assessWikidataJurisdictionIdentity({
  expectedJurisdictionId,
  countryJurisdictionIds,
  scopeJurisdictionIds,
}: {
  expectedJurisdictionId: string | null;
  countryJurisdictionIds: readonly string[];
  scopeJurisdictionIds: readonly string[];
}): WikidataJurisdictionIdentityAssessment {
  if (!expectedJurisdictionId) {
    return { status: "missing", reason: "expected_jurisdiction_missing" };
  }
  if (countryJurisdictionIds.length === 0) {
    return { status: "missing", reason: "country_claim_missing" };
  }
  if (!countryJurisdictionIds.includes(expectedJurisdictionId)) {
    return { status: "mismatch", reason: "country_mismatch" };
  }
  if (
    scopeJurisdictionIds.length > 0 &&
    scopeJurisdictionIds.some((id) => id !== expectedJurisdictionId)
  ) {
    return { status: "mismatch", reason: "explicit_scope_mismatch" };
  }
  return scopeJurisdictionIds.length > 0
    ? { status: "matched", reason: "country_and_scope_match" }
    : { status: "matched", reason: "country_match_scope_unspecified" };
}
