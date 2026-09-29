/**
 * Shared, node-only inputs and self-proof for the publisher-attribution/v1
 * static gate (CLM-020). `scripts/validate-publisher-attribution.ts` and the
 * unit tests use the same definitions, so the seeded mutations cannot drift
 * between the gate and its tests. Not UI code.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { EXPECTED_PARAMETER_CONTRACT } from "@/lib/conditions/release-live-validation";
import {
  SCORE_ROW_IDS,
  shapeFreedomHouseScoreRow,
  shapeVdemScoreRow,
} from "@/lib/ci/publisher-scores";

import {
  legacyFreedomHouseRow,
  scoreRowAttributionErrors,
} from "./publisher-attribution-check";
import { type PublisherAttributionBaseline } from "./publisher-attribution-registry";
import {
  checkedPublisherAttributionRegistry,
  isPublisherAttributionScanPath,
  scanPublisherAttribution,
  type PublisherAttributionScanInput,
  type PublisherAttributionScanIssue,
  type PublisherAttributionScanRule,
} from "./publisher-attribution-scan";

export const PUBLISHER_ATTRIBUTION_BASELINE_PATH = "scripts/publisher-attribution-baseline.json";
export const PUBLISHER_ATTRIBUTION_FOLLOW_UPS_PATH = "plan/evidence/CLM-020/follow-ups.md";

function listSourceFiles(root: string, directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listSourceFiles(root, relative));
    else if (isPublisherAttributionScanPath(relative)) files.push(relative);
  }
  return files;
}

/** Reads every scan input from the repository at `root`. */
export function readPublisherAttributionScanInput(
  root: string,
  overrides: ReadonlyMap<string, string> = new Map(),
): PublisherAttributionScanInput {
  const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");
  const sources = new Map<string, string>();
  for (const file of listSourceFiles(root, "src")) sources.set(file, read(file));
  for (const [repoPath, source] of overrides) sources.set(repoPath, source);
  const ledger = JSON.parse(read("data/rendered-module-ledger.v1.json")) as {
    entries: Array<{ moduleSource: string }>;
  };
  return {
    sources,
    renderedModuleSources: new Set(ledger.entries.map((entry) => entry.moduleSource)),
    masterChecklist: read("plan/MASTER-CHECKLIST.md"),
    followUps: read(PUBLISHER_ATTRIBUTION_FOLLOW_UPS_PATH),
    decisions: read("plan/DECISIONS.md"),
    conditionsParameterContract: EXPECTED_PARAMETER_CONTRACT,
    scoreRowIds: SCORE_ROW_IDS,
    baseline: JSON.parse(read(PUBLISHER_ATTRIBUTION_BASELINE_PATH)) as PublisherAttributionBaseline,
  };
}

function withSource(
  input: PublisherAttributionScanInput,
  repoPath: string,
  mutate: (source: string) => string,
): PublisherAttributionScanInput {
  const sources = new Map(input.sources);
  const source = sources.get(repoPath);
  if (source === undefined) throw new Error(`self-proof fixture file missing: ${repoPath}`);
  const mutated = mutate(source);
  if (mutated === source) throw new Error(`self-proof mutation did not change ${repoPath}`);
  sources.set(repoPath, mutated);
  return { ...input, sources };
}

function withNewFile(
  input: PublisherAttributionScanInput,
  repoPath: string,
  source: string,
): PublisherAttributionScanInput {
  const sources = new Map(input.sources);
  sources.set(repoPath, source);
  return { ...input, sources };
}

export interface SeededMutation {
  label: string;
  rule: PublisherAttributionScanRule;
  build: (clean: PublisherAttributionScanInput) => PublisherAttributionScanInput;
}

export const PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS: readonly SeededMutation[] = [
  {
    label: "the release read hands a Civica position to the score row again",
    rule: "derived-field-not-allowed",
    build: (clean) =>
      withSource(clean, "src/lib/db/queries-scores.ts", (source) =>
        source.replace(
          "const [row] = selectCiReleaseDimensionRows(rows, CI_RELEASE.releaseId);",
          "const [row] = selectCiReleaseDimensionRows(rows, CI_RELEASE.releaseId);\n  const formerPosition = Math.round(row.normalizedScore);",
        ),
      ),
  },
  {
    label: "the pure score contract starts reading a Civica position",
    rule: "derived-field-reader-unregistered",
    build: (clean) =>
      withSource(clean, "src/lib/ci/publisher-scores.ts", (source) =>
        source.replace(
          "export function shapeFreedomHouseScoreRow(prClSum: number): ScoreRow {",
          "export function shapeFreedomHouseScoreRow(prClSum: number, normalizedScore = 100): ScoreRow {",
        ),
      ),
  },
  {
    label: "a new score card reads a Civica position",
    rule: "derived-field-reader-unregistered",
    build: (clean) =>
      withNewFile(
        clean,
        "src/components/example/NewScoreCard.tsx",
        "export function NewScoreCard({ calculation }: { calculation: { normalizedScore: number } }) {\n  return <p>{calculation.normalizedScore} / 100</p>;\n}\n",
      ),
  },
  {
    label: "the Conditions card drops its marker",
    rule: "disclosure-evidence-missing",
    build: (clean) =>
      withSource(clean, "src/components/conditions/CivicaConditionsPanel.tsx", (source) =>
        source.replaceAll("<ValueOriginNote", "<span data-dropped-marker"),
      ),
  },
  {
    label: "the comparison view shows Civica positions again",
    rule: "disclosure-evidence-missing",
    build: (clean) =>
      withSource(clean, "src/components/compare/CompareConditions.tsx", (source) =>
        source.replaceAll("showCivicaPosition={false}", ""),
      ),
  },
  {
    label: "a comment claims the marker is present",
    rule: "disclosure-evidence-missing",
    build: (clean) =>
      withSource(
        clean,
        "src/components/conditions/CivicaConditionsPanel.tsx",
        (source) =>
          `${source.replaceAll("<ValueOriginNote", "<span data-dropped-marker")}\n// <ValueOriginNote origin={calculation.scoreOrigin} />\n`,
      ),
  },
  {
    label: "CLM-021 is closed while its live exception remains",
    rule: "exception-follow-up-invalid",
    build: (clean) => ({
      ...clean,
      masterChecklist: clean.masterChecklist.replace("- [ ] **CLM-021**", "- [x] **CLM-021**"),
    }),
  },
  {
    label: "the frozen contract gains an undisclosed transformation",
    rule: "conditions-transformation-undisclosed",
    build: (clean) => ({
      ...clean,
      conditionsParameterContract: {
        ...clean.conditionsParameterContract,
        hdi: {
          ...clean.conditionsParameterContract.hdi!,
          transformationId: "conditions-hdi-fixed-bound/v3",
        },
      },
    }),
  },
  {
    label: "the ledger mounts a component classified not_rendered",
    rule: "allowlist-condition-failed",
    build: (clean) => ({
      ...clean,
      renderedModuleSources: new Set([
        ...clean.renderedModuleSources,
        "src/components/country/CivicaIndexPanel.tsx",
      ]),
    }),
  },
  {
    label: "a new page renders a SourceDot",
    rule: "provenance-renderer-unregistered",
    build: (clean) =>
      withNewFile(
        clean,
        "src/components/example/NewSourcedFigure.tsx",
        'import { SourceDot } from "@/components/SourceDot";\nexport function NewSourcedFigure() {\n  return <span>64 / 100 <SourceDot source="global_peace_index" retrievedAt={null} /></span>;\n}\n',
      ),
  },
  {
    // The review regression of 2026-09-29: no SourceDot, no registered field.
    label: "a new badge prints a Civica position as Freedom House's score out of 100",
    rule: "scale-suffix-unregistered",
    build: (clean) =>
      withNewFile(
        clean,
        "src/components/example/FreedomHouseBadge.tsx",
        "export function FreedomHouseBadge({ rawValue }: { rawValue: number }) {\n  const position = Math.round(((14 - rawValue) / 12) * 100);\n  return <p>Freedom House: Free ({position}/100)</p>;\n}\n",
      ),
  },
  {
    label: "the Rankings table prints a Civica position out of 100 beside a publisher value",
    rule: "scale-suffix-unregistered",
    build: (clean) =>
      withSource(clean, "src/components/scores/ScoresAndRankings.tsx", (source) =>
        source.replace(
          "{row.scoreFormatted}",
          "{row.scoreFormatted} ({Math.round(((14 - 2) / 12) * 100)}/100)",
        ),
      ),
  },
  {
    label: "an application page imports tooling that may print a scale suffix",
    rule: "allowlist-condition-failed",
    build: (clean) =>
      withNewFile(
        clean,
        "src/app/example/page.tsx",
        'import { renderBrandNameDecisionCriteriaMarkdown } from "@/lib/brand/decision-criteria";\nexport default function Page() {\n  return <pre>{renderBrandNameDecisionCriteriaMarkdown()}</pre>;\n}\n',
      ),
  },
  {
    label: "a Civica-calculation surface that may print a scale suffix loses its disclosure",
    rule: "allowlist-condition-failed",
    build: (clean) => {
      const registry = clean.registry ?? checkedPublisherAttributionRegistry();
      return {
        ...clean,
        registry: {
          ...registry,
          surfaces: registry.surfaces.map((surface) =>
            surface.id === "conditions.position.country"
              ? { ...surface, disclosure: "none" as const }
              : surface,
          ),
        },
      };
    },
  },
  {
    label: "a file allowed a scale suffix stops printing one",
    rule: "scale-suffix-allowance-stale",
    build: (clean) =>
      withSource(clean, "src/lib/brand/decision-criteria.ts", (source) =>
        source.replace("/100**.", " points**."),
      ),
  },
  {
    label: "an exception is added without updating the baseline",
    rule: "registry-baseline-drift",
    build: (clean) => ({
      ...clean,
      baseline: {
        ...clean.baseline,
        exceptions: clean.baseline.exceptions.filter((id) => id !== "api.metrics-strip-data"),
      },
    }),
  },
];

export function formatPublisherAttributionIssue(issue: PublisherAttributionScanIssue): string {
  return `[${issue.rule}] ${issue.subject}: ${issue.message}`;
}

/**
 * The value check must reject the former Freedom House row and accept the
 * current rows. Returns problems; an empty array is a proof.
 */
export function proveValueCheck(): string[] {
  const problems: string[] = [];
  const legacyErrors = scoreRowAttributionErrors(legacyFreedomHouseRow("Free", 100), 2).join("\n");
  if (
    !/has no declared origin/.test(legacyErrors) ||
    !/shows 100, which is not the publisher's own figure \(2\)/.test(legacyErrors)
  ) {
    problems.push(`the value check accepted the former "Free (100/100)" row: ${legacyErrors || "no errors"}`);
  }
  for (let sum = 2; sum <= 14; sum += 1) {
    const errors = scoreRowAttributionErrors(shapeFreedomHouseScoreRow(sum), sum);
    if (errors.length > 0) problems.push(`current Freedom House row for sum ${sum} fails: ${errors.join("; ")}`);
  }
  const vdemErrors = scoreRowAttributionErrors(shapeVdemScoreRow(0.769), 0.769);
  if (vdemErrors.length > 0) problems.push(`current V-Dem row fails: ${vdemErrors.join("; ")}`);
  return problems;
}

/**
 * Every seeded mutation must introduce an issue with its own rule. Only
 * issues the mutation introduces count, so a failing clean tree can never
 * make a broken rule look proven.
 */
export function proveScan(clean: PublisherAttributionScanInput): string[] {
  const problems: string[] = [];
  const cleanKeys = new Set(scanPublisherAttribution(clean).map(formatPublisherAttributionIssue));
  for (const mutation of PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS) {
    const introduced = scanPublisherAttribution(mutation.build(clean)).filter(
      (issue) => !cleanKeys.has(formatPublisherAttributionIssue(issue)),
    );
    if (!introduced.some((issue) => issue.rule === mutation.rule)) {
      problems.push(
        `seeded mutation "${mutation.label}" did not fail with ${mutation.rule} (introduced ${introduced.map((issue) => issue.rule).join(", ") || "nothing"})`,
      );
    }
  }
  return problems;
}
