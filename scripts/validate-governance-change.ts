import { readFileSync } from "node:fs";

import {
  GOVERNANCE_CHANGE_CONTRACT,
  GOVERNANCE_CHANGE_MIN_COMPARABLE,
  GOVERNANCE_CHANGE_MIN_COVERAGE,
} from "@/lib/governance-change/explorer";

const errors: string[] = [];

function requireFragments(path: string, fragments: string[]) {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      errors.push(`${path} lacks ${fragment}`);
    }
  }
  return source;
}

if (GOVERNANCE_CHANGE_CONTRACT !== "source-native-governance-change/v1") {
  errors.push("governance-change contract version drifted");
}
if (GOVERNANCE_CHANGE_MIN_COMPARABLE !== 30) {
  errors.push("minimum comparable-country threshold drifted");
}
if (GOVERNANCE_CHANGE_MIN_COVERAGE !== 0.5) {
  errors.push("minimum exact-window coverage threshold drifted");
}

const explorer = requireFragments(
  "src/lib/governance-change/explorer.ts",
  [
    'status: "ranked" | "no_ranking"',
    "publisherAlignedDelta",
    "sensitivityMin",
    "sensitivityMax",
    "directionStable",
    "input.startYear - 1",
    "input.endYear + 1",
  ],
);
const query = requireFragments("src/lib/governance-change/query.ts", [
  'eq(jurisdictions.type, "sovereign_state")',
  'inArray(indicatorHistory.valueStatus, ["observed", "disputed"])',
  "upstreamRelease",
  "methodVersion",
  "artifactHash",
  "sourceLastSyncAt",
]);
const page = requireFragments(
  "src/app/(reader)/governance-change/page.tsx",
  [
    "publisher-native difference",
    "adjacent-year endpoint sensitivity",
    "not a statistical confidence interval",
    "Missing endpoint years exclude a country",
    "Civica is withholding the movers ordering",
    "GOVERNANCE_CHANGE_MIN_COMPARABLE",
    "GOVERNANCE_CHANGE_MIN_COVERAGE",
    "SourceDot",
  ],
);

for (const [label, source] of [
  ["explorer", explorer],
  ["query", query],
  ["page", page],
] as const) {
  if (/\bletter grade\b/i.test(source)) {
    errors.push(`${label} introduces a forbidden country letter-grade claim`);
  }
}

for (const path of [
  "src/components/indexNavItems.ts",
  "src/components/SiteFooter.tsx",
  "src/app/sitemap.ts",
]) {
  if (!readFileSync(path, "utf8").includes('"/governance-change"')) {
    errors.push(`${path} does not publish /governance-change`);
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(
  "PASS — ATL-022 retains exact source-native endpoints, adjacent-year sensitivity, explicit missingness, and a fail-closed no-ranking state.",
);
