import assert from "node:assert/strict";
import test from "node:test";

import { classifyJurisdictionStatus } from "./status-taxonomy";
import { buildJurisdictionStatusPresentation } from "./status-presentation";

function stored(slug: string, iso3: string | null) {
  const canonical = classifyJurisdictionStatus({ slug, iso3 });
  return {
    slug,
    iso3,
    type: canonical.type,
    statusSourceIds: canonical.sourceIds,
    statusReviewedAt: canonical.reviewedAt,
    statusNote: canonical.note,
    administeringJurisdictionIso3: canonical.administeringJurisdictionIso3,
    statusDisputed: canonical.disputed,
  };
}

test("presentation retains a sourced UN-member classification", () => {
  const result = buildJurisdictionStatusPresentation(stored("japan", "JPN"));
  assert.equal(result.label, "UN member state");
  assert.equal(result.includeInSovereignStateCounts, true);
  assert.equal(result.sources[0]?.id, "un_member_states");
});

test("politically sensitive entities retain neutral notes and sources", () => {
  const palestine = buildJurisdictionStatusPresentation(
    stored("west-bank", "PSE"),
  );
  assert.equal(palestine.label, "UN observer state");
  assert.equal(palestine.disputed, true);
  assert.match(palestine.note, /avoiding a claim.*settles recognition or sovereignty/i);
  assert.ok(
    palestine.sources.some((source) => source.id === "un_non_member_states"),
  );

  const falklands = buildJurisdictionStatusPresentation(
    stored("falkland-islands-islas-malvinas", null),
  );
  assert.equal(falklands.label, "Dependency or territory");
  assert.equal(falklands.disputed, true);
  assert.equal(falklands.administeringJurisdictionIso3, "GBR");
});

test("stored taxonomy drift fails closed", () => {
  assert.throws(
    () =>
      buildJurisdictionStatusPresentation({
        ...stored("puerto-rico", null),
        type: "sovereign_state",
      }),
    /disagrees/,
  );
  assert.throws(
    () =>
      buildJurisdictionStatusPresentation({
        ...stored("puerto-rico", null),
        statusSourceIds: ["unknown"],
      }),
    /Unknown jurisdiction-status source/,
  );
});
