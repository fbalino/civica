import assert from "node:assert/strict";
import test from "node:test";
import {
  SOURCE_INDEPENDENCE_MIN_PRECISION,
  SOURCE_INDEPENDENCE_MIN_RECALL,
  compareSourceEvidence,
  deriveSourceIndependence,
  type SourceEvidenceReport,
} from "./source-independence";

type ReviewedPair = {
  id: string;
  dependent: boolean;
  left: SourceEvidenceReport;
  right: SourceEvidenceReport;
};

const report = (
  id: string,
  host: string,
  title: string,
  body: string,
  overrides: Partial<SourceEvidenceReport> = {},
): SourceEvidenceReport => ({
  rawEventId: id,
  sourceId: "gdelt",
  sourceType: "news",
  sourceUrl: `https://${host}/${id}`,
  sourceFamilyId: "gdelt",
  itemPublisherHost: host,
  title,
  body,
  ...overrides,
});

// Agent-reviewed v1 pair set. Labels are locked before detector evaluation.
const reviewedPairs: ReviewedPair[] = [
  {
    id: "same-url-tracking",
    dependent: true,
    left: report("a1", "local.test", "Court ruling", "Original account", {
      sourceUrl: "https://local.test/story?utm_source=x",
    }),
    right: report("a2", "local.test", "Court ruling", "Original account", {
      sourceUrl: "https://local.test/story?fbclid=y",
    }),
  },
  {
    id: "same-publisher",
    dependent: true,
    left: report("b1", "bbc.com", "Parliament passes bill", "BBC account one"),
    right: report(
      "b2",
      "bbc.co.uk",
      "Lawmakers approve measure",
      "BBC follow-up",
    ),
  },
  {
    id: "reuters-syndication",
    dependent: true,
    left: report(
      "c1",
      "reuters.com",
      "Minister resigns",
      "Reuters reported the resignation",
    ),
    right: report(
      "c2",
      "example.test",
      "Minister resigns",
      "Reporting by Reuters on the resignation",
    ),
  },
  {
    id: "ap-syndication",
    dependent: true,
    left: report(
      "d1",
      "apnews.com",
      "Election delayed",
      "Associated Press dispatch",
    ),
    right: report(
      "d2",
      "daily.test",
      "Election delayed",
      "The AP reported the delay",
    ),
  },
  {
    id: "ngo-reference",
    dependent: true,
    left: report(
      "e1",
      "amnesty.org",
      "Detainees released",
      "Amnesty International report",
      {
        sourceId: "amnesty",
        sourceType: "specialist",
        sourceFamilyId: "amnesty",
      },
    ),
    right: report(
      "e2",
      "daily.test",
      "Detainees released",
      "According to Amnesty International, detainees were released",
    ),
  },
  {
    id: "near-verbatim",
    dependent: true,
    left: report(
      "f1",
      "one.test",
      "Supreme court annuls Oaxaca election",
      "The supreme court annulled the Oaxaca election after the petition",
    ),
    right: report(
      "f2",
      "two.test",
      "Supreme court annuls Oaxaca election",
      "The supreme court annulled the Oaxaca election after the petition",
    ),
  },
  {
    id: "direct-hrw-mirror",
    dependent: true,
    left: report(
      "g1",
      "hrw.org",
      "Journalists detained",
      "Human Rights Watch documented the arrests",
      { sourceId: "hrw", sourceType: "specialist", sourceFamilyId: "hrw" },
    ),
    right: report(
      "g2",
      "mirror.test",
      "Journalists detained",
      "Human Rights Watch documented the arrests",
    ),
  },
  {
    id: "independent-ngos",
    dependent: false,
    left: report(
      "h1",
      "amnesty.org",
      "Journalists detained",
      "Amnesty interviewed three lawyers",
      {
        sourceId: "amnesty",
        sourceType: "specialist",
        sourceFamilyId: "amnesty",
      },
    ),
    right: report(
      "h2",
      "hrw.org",
      "Press arrests continue",
      "Human Rights Watch reviewed court records",
      { sourceId: "hrw", sourceType: "specialist", sourceFamilyId: "hrw" },
    ),
  },
  {
    id: "reuters-and-ap",
    dependent: false,
    left: report(
      "i1",
      "reuters.com",
      "Cabinet collapses",
      "Reuters interviewed the finance minister",
    ),
    right: report(
      "i2",
      "apnews.com",
      "Coalition loses majority",
      "Associated Press spoke with opposition lawmakers",
    ),
  },
  {
    id: "local-originals",
    dependent: false,
    left: report(
      "j1",
      "north.test",
      "Mayor removed",
      "North Daily attended the council vote",
    ),
    right: report(
      "j2",
      "south.test",
      "Council dismisses mayor",
      "South News obtained the signed resolution",
    ),
  },
  {
    id: "same-event-distinct-evidence",
    dependent: false,
    left: report(
      "k1",
      "courtwatch.test",
      "Oaxaca vote annulled",
      "CourtWatch read the published judgment",
    ),
    right: report(
      "k2",
      "observer.test",
      "Oaxaca election voided",
      "Observer interviewed the election chair",
    ),
  },
  {
    id: "different-specialists",
    dependent: false,
    left: report(
      "l1",
      "civicus.org",
      "Protest restrictions",
      "CIVICUS Monitor incident record",
      {
        sourceId: "civicus_monitor",
        sourceType: "specialist",
        sourceFamilyId: "civicus_monitor",
      },
    ),
    right: report(
      "l2",
      "acleddata.com",
      "Police disperse protest",
      "ACLED event record from local partners",
      { sourceId: "acled", sourceType: "specialist", sourceFamilyId: "acled" },
    ),
  },
];

test("reviewed source-dependence pairs meet preregistered precision and recall", () => {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const fixture of reviewedPairs) {
    const actual = compareSourceEvidence(fixture.left, fixture.right).dependent;
    if (actual && fixture.dependent) truePositive++;
    if (actual && !fixture.dependent) falsePositive++;
    if (!actual && fixture.dependent) falseNegative++;
  }
  const precision = truePositive / (truePositive + falsePositive);
  const recall = truePositive / (truePositive + falseNegative);
  assert.ok(
    precision >= SOURCE_INDEPENDENCE_MIN_PRECISION,
    `precision ${precision}`,
  );
  assert.ok(recall >= SOURCE_INDEPENDENCE_MIN_RECALL, `recall ${recall}`);
});

test("dependent reports collapse to one evidence group and specialist evidence dominates its copy", () => {
  const fixture = reviewedPairs.find(({ id }) => id === "ngo-reference")!;
  const result = deriveSourceIndependence([fixture.left, fixture.right]);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].sourceType, "specialist");
  assert.equal(result.relations[0].reason, "same_declared_origin");
});
