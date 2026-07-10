import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyJurisdictionStatus,
  getJurisdictionStatusCatalogSummary,
  JURISDICTION_STATUS_DISPLAY_POLICY,
  JURISDICTION_STATUS_SOURCES,
  UN_MEMBER_ISO3,
} from "../status-taxonomy";

test("the closed catalog covers the current 253-row jurisdiction universe", () => {
  assert.equal(UN_MEMBER_ISO3.size, 193);
  assert.deepEqual(getJurisdictionStatusCatalogSummary(), {
    unMemberStates: 193,
    sovereignObserverStates: 1,
    limitedRecognitionIso3: 3,
    associatedStates: 2,
    dependenciesOrTerritories: 47,
    disputedAreas: 5,
    specialAreas: 1,
    aggregateAreas: 1,
    total: 253,
  });
});

test("ordinary UN members and the Holy See take distinct sourced paths", () => {
  const france = classifyJurisdictionStatus({ slug: "france", iso3: "FRA" });
  const holySee = classifyJurisdictionStatus({
    slug: "holy-see-vatican-city",
    iso3: "VAT",
  });
  assert.equal(france.type, "sovereign_state");
  assert.deepEqual(france.sourceIds, ["un_member_states", "un_m49"]);
  assert.equal(holySee.type, "sovereign_state");
  assert.ok(holySee.sourceIds.includes("un_non_member_states"));
});

test("associated states are not flattened into dependencies", () => {
  for (const slug of ["cook-islands", "niue"]) {
    const result = classifyJurisdictionStatus({ slug, iso3: null });
    assert.equal(result.type, "associated_state");
    assert.equal(result.administeringJurisdictionIso3, "NZL");
  }
});

test("territory, disputed, limited-recognition, and aggregate edges remain distinct", () => {
  assert.equal(
    classifyJurisdictionStatus({ slug: "puerto-rico", iso3: null }).type,
    "dependency_or_territory",
  );
  assert.equal(
    classifyJurisdictionStatus({ slug: "taiwan", iso3: "TWN" }).type,
    "disputed_or_limited_recognition",
  );
  assert.equal(
    classifyJurisdictionStatus({ slug: "western-sahara", iso3: null }).type,
    "disputed_or_limited_recognition",
  );
  assert.equal(
    classifyJurisdictionStatus({ slug: "antarctica", iso3: null }).type,
    "aggregate_or_special_area",
  );
  assert.equal(
    classifyJurisdictionStatus({
      slug: "baker-island-howland-island-jarvis-island-johnston-atoll-kingman-reef-midway-islands-palmyra-atoll",
      iso3: null,
    }).displayLabel,
    "Grouped territorial entry",
  );
});

test("disputed dependencies retain both their territorial class and dispute flag", () => {
  const falklands = classifyJurisdictionStatus({
    slug: "falkland-islands-islas-malvinas",
    iso3: null,
  });
  assert.equal(falklands.type, "dependency_or_territory");
  assert.equal(falklands.disputed, true);
});

test("unknown ISO codes and slugs fail closed instead of defaulting sovereign", () => {
  assert.throws(
    () => classifyJurisdictionStatus({ slug: "new-entry", iso3: "ZZZ" }),
    /No jurisdiction-status\/v1 classification/,
  );
  assert.throws(
    () => classifyJurisdictionStatus({ slug: "new-area", iso3: null }),
    /No jurisdiction-status\/v1 classification/,
  );
});

test("every source record has an HTTPS primary URL and a bounded role", () => {
  for (const source of Object.values(JURISDICTION_STATUS_SOURCES)) {
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.label.length > 0);
    assert.ok(source.role.length > 0);
  }
});

test("the display policy counts only sovereign states as sovereign states", () => {
  const countable = Object.entries(JURISDICTION_STATUS_DISPLAY_POLICY)
    .filter(([, policy]) => policy.includeInSovereignStateCounts)
    .map(([type]) => type);
  assert.deepEqual(countable, ["sovereign_state"]);
  for (const policy of Object.values(JURISDICTION_STATUS_DISPLAY_POLICY)) {
    assert.ok(policy.shortLabel.length > 0);
    assert.ok(policy.publicRule.length > 0);
  }
});
