import { existsSync, readFileSync, writeFileSync } from "node:fs";

import type {
  RenderedModuleEvidenceRecord,
  RenderedModuleEvidenceRegistry,
  VisualVariant,
} from "../src/lib/qa/rendered-module-ledger";

interface CandidateRecord {
  scenarioId: string;
  route: string;
  theme: "light" | "dark";
  viewport: "desktop" | "small-mobile";
  path: string;
}

interface CandidateManifest {
  schemaVersion: "civica-visual-baseline-manifest/v1";
  status: "candidate";
  records: CandidateRecord[];
}

const manifestPath = "e2e/visual-baselines/candidate-manifest.json";
const registryPath = "data/rendered-module-evidence.v1.json";
const screenshotRoot = "e2e/qa-013-visual-regression.spec.ts-snapshots";
const candidateFinding = "EXP-001-CANDIDATE-NOT-REVIEWED";

const routeByScenario: Readonly<Record<string, string | null>> = {
  "design-system": "/design-system",
  home: "/",
  // The default home screenshot already supplies route context. The open-menu
  // state remains useful QA-013 review material but must not overwrite it.
  "home-explore-menu": null,
  "error-404": "/__not_found__",
  "country-factbook": "/country/[slug]",
  "country-civica-data": "/country/[slug]/civica-data",
  atlas: "/atlas",
  compare: "/compare",
  "civica-index": "/civica-index",
  "pulse-ledger": "/civica-index/pulse-changelog",
  methodology: "/methodology",
  constitution: "/constitution",
  elections: "/elections",
  record: "/blog",
  "api-docs": "/api-docs",
  "advisory-board": "/about/advisory-board",
  embed: "/embed/[slug]",
};

const manifest = JSON.parse(
  readFileSync(manifestPath, "utf8"),
) as CandidateManifest;
if (
  manifest.schemaVersion !== "civica-visual-baseline-manifest/v1" ||
  manifest.status !== "candidate"
) {
  throw new Error("Expected the unapproved visual-baseline candidate manifest.");
}

const registry = JSON.parse(
  readFileSync(registryPath, "utf8"),
) as RenderedModuleEvidenceRegistry;
const retained = registry.records.filter(
  (record) => record.evidence.findingId !== candidateFinding,
);
const candidateRecords: RenderedModuleEvidenceRecord[] = manifest.records.flatMap(
  (record) => {
    const route = routeByScenario[record.scenarioId];
    if (route === undefined) {
      throw new Error(`No rendered-module route mapping for ${record.scenarioId}.`);
    }
    if (route === null) return [];
    const screenshot = `${screenshotRoot}/${record.path}`;
    if (!existsSync(screenshot)) {
      throw new Error(`Candidate screenshot is missing: ${screenshot}.`);
    }
    return [{
      route,
      moduleSource: "*",
      variant: `${record.viewport === "small-mobile" ? "small_mobile" : "desktop"}_${record.theme}` as VisualVariant,
      evidence: {
        disposition: "not_observed",
        screenshot,
        findingId: candidateFinding,
      },
    }];
  },
);

const records = [...retained, ...candidateRecords].sort((left, right) =>
  `${left.route}:${left.moduleSource}:${left.variant}`.localeCompare(
    `${right.route}:${right.moduleSource}:${right.variant}`,
  ),
);
const output: RenderedModuleEvidenceRegistry = {
  schemaVersion: "civica-rendered-module-evidence/v1",
  records,
};
writeFileSync(registryPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Recorded ${candidateRecords.length} unapproved screenshot-context records; ${retained.length} reviewed records preserved.`,
);
