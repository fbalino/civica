import { readFileSync } from "node:fs";

type Expectation = {
  path: string;
  present: string[];
  absent?: string[];
};

function normalizedSource(path: string): string {
  return readFileSync(path, "utf8").replace(/\s+/g, " ").trim();
}

const expectations: Expectation[] = [
  {
    path: "src/components/home/HomeGrid.tsx",
    present: [
      "Start with a country. See its institutions, leaders, and source-linked facts.",
      "Open the profile for source details and known gaps; the summary cards do not show provenance for every value.",
      "Compare political systems and institutions on one map.",
      "Browse legislatures, chambers, government systems, and other institutions across countries.",
      "Independent &amp; nonpartisan",
    ],
  },
  {
    path: "content/about.md",
    present: [
      "The project publishes its methods and records source disagreement where the data supports it. Some values remain unreconciled, and the project has not completed independent review.",
      "Civica separates source ingestion, reconciliation, and reader presentation. Each layer has its own provenance and failure checks.",
      "Supported observations retain source and retrieval metadata; statement-level coverage remains incomplete.",
      "We are not these institutions.",
    ],
    absent: ["Civica is a small project led by Fernando Baliño."],
  },
  {
    path: "src/app/(reader)/methodology/page.tsx",
    present: [
      "New to Civica’s data methods? Start with the plain-English overview.",
      "How Civica selects among source observations, records disputes, separates forecasts from measurements, and preserves scoped alternatives.",
      "what happens when a group has fewer than eight cases.",
    ],
  },
  {
    path: "content/methodology-overview.md",
    present: [
      "A later release may publish a reviewed subset. Until then, the public methodology pages identify the decisions they can support and leave the remaining working records unpublished.",
    ],
  },
  {
    path: "src/app/(reader)/country/[slug]/constitution/page.tsx",
    present: [
      "Civica indexes constitution texts supplied by the Constitute Project.",
      "government, institutions, and governance evidence remain available elsewhere in the country profile.",
    ],
  },
  {
    path: "src/app/governance-evidence/page.tsx",
    present: [
      "not retained. This release was assembled later from harmonized publisher series and is not an as-published 2024 snapshot",
    ],
    absent: [
      "none retained; this is not an as-published historical release",
    ],
  },
  {
    path: "src/app/licensing/page.tsx",
    present: [
      "Check the publisher terms attached to the value. If no terms appear there, find the source in the registry below. A citation or public page does not by itself grant reuse permission.",
    ],
  },
  {
    path: "src/app/contact/ContactClient.tsx",
    present: [
      'title="Contact the editors"',
      "Send a data correction, research question, press inquiry, or collaboration proposal. Fernando Baliño reviews submissions manually.",
      "The editors usually reply within <strong>3 business days</strong>.",
      "urgent data corrections, open an issue on GitHub.",
      "We usually reply within <strong>3 business days</strong>.",
    ],
  },
  {
    path: "src/app/about/advisory-board/apply/ApplyClient.tsx",
    present: [
      "Civica Atlas accepts private expressions of interest in the five areas named by the charter:",
      "Submission does not confer membership, a review role, or endorsement.",
    ],
  },
  {
    path: "src/lib/research/project-disclosure.ts",
    present: [
      "Civica Atlas is personally funded by Fernando Baliño.",
      "No outside funder or sponsor exists.",
      "It has received no donated or discounted services",
      "Fernando has confirmed no relevant outside affiliations or interests.",
    ],
  },
];

const errors: string[] = [];

for (const expectation of expectations) {
  const source = normalizedSource(expectation.path);
  for (const fragment of expectation.present) {
    if (!source.includes(fragment)) {
      errors.push(
        `${expectation.path}: missing approved/retained fragment: ${fragment}`,
      );
    }
  }
  for (const fragment of expectation.absent ?? []) {
    if (source.includes(fragment)) {
      errors.push(
        `${expectation.path}: held/rejected fragment was applied: ${fragment}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("EXP-038 copy contract failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  "EXP-038 copy contract passed: approved edits are present, the confirmed disclosure supports the retained independence label, and held copy remains unapplied.",
);
