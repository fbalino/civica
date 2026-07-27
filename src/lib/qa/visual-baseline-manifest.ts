import {
  VISUAL_REGRESSION_SCENARIOS,
  VISUAL_REGRESSION_THEMES,
  VISUAL_REGRESSION_VIEWPORTS,
  visualRegressionCaseId,
  type VisualRegressionScenario,
  type VisualRegressionState,
} from "./visual-regression-contract";

export const VISUAL_BASELINE_MANIFEST_SCHEMA =
  "civica-visual-baseline-manifest/v1" as const;

export type VisualBaselineRecord = {
  caseId: string;
  scenarioId: string;
  route: string;
  theme: "light" | "dark";
  viewport: "desktop" | "small-mobile";
  state: VisualRegressionState;
  requiresFixtureDatabase: boolean;
  browserProject: string;
  path: string;
  sha256: string;
};

export type VisualBaselineManifest = {
  schemaVersion: typeof VISUAL_BASELINE_MANIFEST_SCHEMA;
  status: "candidate" | "approved";
  generatedAt: string;
  platform: string;
  inputContractSha256: string;
  records: VisualBaselineRecord[];
  candidate: {
    author: string;
    reason: string;
    createdAt: string;
  };
  approval?: {
    reviewer: string;
    reason: string;
    approvedAt: string;
  };
};

export type ExpectedVisualBaseline = Omit<
  VisualBaselineRecord,
  "browserProject" | "path" | "sha256"
>;

export function expectedVisualBaselines(
  scenarios: readonly VisualRegressionScenario[] = VISUAL_REGRESSION_SCENARIOS,
): ExpectedVisualBaseline[] {
  return scenarios.flatMap((scenario) =>
    VISUAL_REGRESSION_THEMES.flatMap((theme) =>
      VISUAL_REGRESSION_VIEWPORTS.map((viewport) => ({
        caseId: visualRegressionCaseId(scenario, theme, viewport),
        scenarioId: scenario.id,
        route: scenario.path,
        theme,
        viewport: viewport.name,
        state: scenario.state ?? "default",
        requiresFixtureDatabase: scenario.requiresFixtureDatabase ?? false,
      })),
    ),
  );
}

function validTimestamp(value: string | undefined): boolean {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

function validSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function visualBaselineManifestErrors(
  manifest: VisualBaselineManifest,
  scenarios: readonly VisualRegressionScenario[] = VISUAL_REGRESSION_SCENARIOS,
  options: { requireApproved: boolean },
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== VISUAL_BASELINE_MANIFEST_SCHEMA) {
    errors.push("baseline manifest schema version is invalid");
  }
  if (!validTimestamp(manifest.generatedAt)) {
    errors.push("baseline manifest needs an ISO generatedAt timestamp");
  }
  if (!manifest.platform.trim()) errors.push("baseline manifest needs a platform");
  if (!validSha256(manifest.inputContractSha256)) {
    errors.push("baseline manifest needs the input-contract SHA-256");
  }
  if (!manifest.candidate.author.trim()) {
    errors.push("baseline candidate needs an author");
  }
  if (!manifest.candidate.reason.trim()) {
    errors.push("baseline candidate needs a reason");
  }
  if (!validTimestamp(manifest.candidate.createdAt)) {
    errors.push("baseline candidate needs an ISO createdAt timestamp");
  }
  if (options.requireApproved && manifest.status !== "approved") {
    errors.push("baseline manifest is not approved");
  }
  if (manifest.status === "approved") {
    if (!manifest.approval?.reviewer.trim()) {
      errors.push("approved manifest needs a reviewer");
    }
    if (!manifest.approval?.reason.trim()) {
      errors.push("approved manifest needs an approval reason");
    }
    if (!validTimestamp(manifest.approval?.approvedAt)) {
      errors.push("approved manifest needs an ISO approvedAt timestamp");
    }
  }

  const expected = expectedVisualBaselines(scenarios);
  const expectedByCase = new Map(expected.map((record) => [record.caseId, record]));
  const caseIds = manifest.records.map((record) => record.caseId);
  const paths = manifest.records.map((record) => record.path);
  if (new Set(caseIds).size !== caseIds.length) {
    errors.push("baseline case ids must be unique");
  }
  if (new Set(paths).size !== paths.length) errors.push("baseline paths must be unique");
  if (manifest.records.length !== expected.length) {
    errors.push(`baseline manifest needs ${expected.length} records`);
  }
  for (const required of expected) {
    if (!caseIds.includes(required.caseId)) {
      errors.push(`missing required baseline: ${required.caseId}`);
    }
  }

  for (const record of manifest.records) {
    const required = expectedByCase.get(record.caseId);
    if (!required) {
      errors.push(`${record.caseId}: does not map to a registered scenario`);
      continue;
    }
    for (const key of [
      "scenarioId",
      "route",
      "theme",
      "viewport",
      "state",
      "requiresFixtureDatabase",
    ] as const) {
      if (record[key] !== required[key]) {
        errors.push(`${record.caseId}: ${key} differs from the visual contract`);
      }
    }
    if (!record.browserProject.trim()) {
      errors.push(`${record.caseId}: browser project is required`);
    }
    if (
      record.path !==
      `${record.caseId}-${record.browserProject}-${manifest.platform}.png`
    ) {
      errors.push(`${record.caseId}: baseline path does not identify its case/project/platform`);
    }
    if (!validSha256(record.sha256)) {
      errors.push(`${record.caseId}: baseline hash must be SHA-256`);
    }
  }
  return [...new Set(errors)];
}
