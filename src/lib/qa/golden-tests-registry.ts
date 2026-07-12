/**
 * QA-007 — deterministic golden-test registry.
 *
 * A version-tagged inventory that maps each of the eight "Done when"
 * subtopics of QA-007 (normalization, reconciliation, conditions,
 * taxonomy/peer lenses, all Index candidates, uncertainty/sensitivity,
 * Pulse decay/classification metrics, and methodology worked examples)
 * to the deterministic, DB-free test file(s) that lock its versioned
 * expected artifact, and to the production module that is the source of
 * truth for the locked calculation.
 *
 * This module is pure data + pure functions. It carries no database,
 * network, or filesystem side effects on import — `goldenTestsRegistryErrors`
 * takes an injectable `fileExists` so the same logic runs both in the
 * build-time validator (`scripts/validate-golden-tests.ts`, real
 * `existsSync`) and in a seeded-failure unit test (a stubbed existence
 * checker).
 *
 * Style mirrors `src/lib/ci/index-change-control.ts`: a frozen protected
 * inventory plus a single error-collecting function the validator and its
 * negative test both consume.
 */

import { INDEX_PROTECTED_FILES, type IndexChangeCategory } from "@/lib/ci/index-change-control";

export const GOLDEN_TESTS_SCHEMA_VERSION = "civica-golden-tests/v1";

/** The eight published-calculation families QA-007 requires golden coverage for. */
export const GOLDEN_SUBTOPICS = [
  "normalization",
  "reconciliation",
  "conditions",
  "taxonomy_peer_lenses",
  "index_candidates",
  "uncertainty_sensitivity",
  "pulse_decay_classification",
  "methodology_worked_examples",
] as const;
export type GoldenSubtopic = (typeof GOLDEN_SUBTOPICS)[number];

/**
 * Index-change-control categories that count as a "protected transform":
 * a calculation whose numeric output a golden pins and whose drift is
 * additionally caught by `validate:index-change-control`. Presentation,
 * input, band, and missingness categories are not protected transforms.
 */
const PROTECTED_TRANSFORM_CATEGORIES: ReadonlySet<IndexChangeCategory> = new Set([
  "transform",
  "weight_or_model",
  "uncertainty",
]);

export interface GoldenTestEntry {
  subtopic: GoldenSubtopic;
  title: string;
  /** Verbatim fragment of the QA-007 "Done when" clause this entry satisfies. */
  doneWhenClause: string;
  /** Production module(s) that own the locked calculation. */
  sourceOfTruth: readonly string[];
  /**
   * Deterministic, DB-free test file(s) that reproduce the versioned
   * expected artifact from fixtures. Every path must exist on disk.
   */
  testFiles: readonly string[];
  /**
   * Subset of `sourceOfTruth` whose numeric output the golden pins AND
   * which must be registered as a protected transform in
   * `INDEX_PROTECTED_FILES`. Empty when the subtopic is intentionally not
   * an Index change-control transform (reconciliation, external taxonomy
   * classifications, or the Conditions identity passthrough that produces
   * no composite).
   */
  protectedTransforms: readonly string[];
  /** Whether the newly-added golden or an already-shipping test locks it. */
  provenance: "newly_added" | "already_covered" | "extended";
  notes: string;
}

/**
 * The registry. Exactly one entry per subtopic (enforced by
 * `goldenTestsRegistryErrors`). Test-file and source paths are repo-root
 * relative, matching `INDEX_PROTECTED_FILES`.
 */
export const GOLDEN_TESTS_REGISTRY: readonly GoldenTestEntry[] = [
  {
    subtopic: "normalization",
    title: "Fixed-bound dimension normalization",
    doneWhenClause: "normalization ... reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: ["src/lib/ci/normalize-v2.ts"],
    testFiles: ["src/lib/ci/__tests__/worked-examples.test.ts"],
    protectedTransforms: ["src/lib/ci/normalize-v2.ts"],
    provenance: "already_covered",
    notes:
      "§3 of the worked-examples fixture locks normalizeV2 / displayDimensionScore for all four headline sources, direction, clamping, and the null-on-unknown-source contract.",
  },
  {
    subtopic: "reconciliation",
    title: "Reconciliation worked example (Argentina inflation)",
    doneWhenClause: "reconciliation ... reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: ["src/lib/factbook/reconcile/fact-keys.ts"],
    testFiles: ["src/lib/factbook/reconcile/__tests__/reconciliation-worked-examples.test.ts"],
    protectedTransforms: [],
    notes:
      "Binds the reconciliation material-error thresholds in fact-keys.ts to both prose surfaces. fact-keys.ts is reconciliation, not an Index change-control transform, so it carries no protected-transform mapping.",
    provenance: "already_covered",
  },
  {
    subtopic: "conditions",
    title: "Conditions identity passthrough (no composite)",
    doneWhenClause: "conditions ... reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: ["src/lib/conditions/ingest.ts"],
    testFiles: [
      "src/lib/conditions/__tests__/conditions-golden.test.ts",
      "src/lib/conditions/__tests__/ingest-repeatability.test.ts",
    ],
    protectedTransforms: [],
    notes:
      "Conditions' current transform is an identity passthrough of per-indicator normalized values; it produces NO combined score. The golden locks byte-for-byte passthrough and asserts no composite field is emitted, so a future silent composite is caught.",
    provenance: "newly_added",
  },
  {
    subtopic: "taxonomy_peer_lenses",
    title: "Government taxonomy and peer-lens resolvers",
    doneWhenClause: "taxonomy/peer lenses ... reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: [
      "src/lib/peer-grouping/index.ts",
      "src/lib/peer-grouping/lens-metadata.ts",
      "src/lib/government-taxonomy/index.ts",
    ],
    testFiles: [
      "src/lib/peer-grouping/__tests__/atl-017-taxonomy-peer-lens.test.ts",
      "src/lib/peer-grouping/__tests__/vdem-row-tier.test.ts",
    ],
    protectedTransforms: [],
    notes:
      "Locks material/governance/regime peer sets, V-Dem RoW tiers, minimum-n fallbacks, and the structural_family retirement guard against external classifications. These cite external taxonomies and are not Index change-control transforms.",
    provenance: "already_covered",
  },
  {
    subtopic: "index_candidates",
    title: "Tournament baselines B0–B3 and candidates K1–K5",
    doneWhenClause: "all Index candidates ... reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: [
      "src/lib/ci/tournament-baselines.ts",
      "src/lib/ci/tournament-candidate-k1.ts",
      "src/lib/ci/tournament-candidate-k2.ts",
      "src/lib/ci/tournament-candidate-k3.ts",
      "src/lib/ci/tournament-candidate-k4.ts",
      "src/lib/ci/tournament-candidate-k5.ts",
    ],
    testFiles: ["src/lib/ci/tournament-candidates-golden.test.ts"],
    protectedTransforms: [
      "src/lib/ci/tournament-baselines.ts",
      "src/lib/ci/tournament-candidate-k1.ts",
      "src/lib/ci/tournament-candidate-k2.ts",
      "src/lib/ci/tournament-candidate-k3.ts",
      "src/lib/ci/tournament-candidate-k4.ts",
      "src/lib/ci/tournament-candidate-k5.ts",
    ],
    notes:
      "One fixed synthetic development-split panel drives every candidate. Exact composite values are locked for B0–B3 and K1–K2; exact structured outputs (and output hashes) are locked for the qualitative K3–K5 prototypes. The K1 composite integer is additionally cross-checked in the worked-examples fixture.",
    provenance: "newly_added",
  },
  {
    subtopic: "uncertainty_sensitivity",
    title: "Uncertainty disposition and rank sensitivity",
    doneWhenClause: "uncertainty/sensitivity ... reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: [
      "src/lib/ci/uncertainty-policy.ts",
      "src/lib/ci/monte-carlo.ts",
      "src/lib/ci/sensitivity-analysis.ts",
    ],
    testFiles: ["src/lib/ci/sensitivity-analysis.test.ts"],
    protectedTransforms: [
      "src/lib/ci/uncertainty-policy.ts",
      "src/lib/ci/monte-carlo.ts",
      "src/lib/ci/sensitivity-analysis.ts",
    ],
    notes:
      "sensitivity-analysis.test.ts locks rank, percentile-tie, and Spearman/max-shift outputs. The published no-generic-range uncertainty disposition is additionally guarded by `validate:ci-uncertainty` and §5 of the worked-examples fixture.",
    provenance: "already_covered",
  },
  {
    subtopic: "pulse_decay_classification",
    title: "Pulse decay and classification-severity metrics",
    doneWhenClause: "Pulse decay/classification metrics ... reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: [
      "src/lib/pulse/v2/decay.ts",
      "src/lib/pulse/v2/taxonomy.ts",
      "src/lib/pulse/v2/score.ts",
      "src/lib/pulse/v2/ensemble.ts",
    ],
    testFiles: ["src/lib/pulse/v2/score-golden.test.ts"],
    protectedTransforms: ["src/lib/pulse/v2/score.ts"],
    notes:
      "Locks exact decayedImpact deltas for named severity-tier/day-offset combinations (day 0, one half-life), the clampSeverityToTier classification-severity metric, and the end-to-end dimensional deltaValue produced by calculateDimensionalDeltas. decay.ts, taxonomy.ts, and ensemble.ts are consumed by the protected score.ts transform.",
    provenance: "newly_added",
  },
  {
    subtopic: "methodology_worked_examples",
    title: "Civica Index methodology worked examples",
    doneWhenClause: "methodology worked examples reproduce versioned expected artifacts from fixtures",
    sourceOfTruth: [
      "src/lib/ci/calculate-v2.ts",
      "src/lib/ci/normalize-v2.ts",
    ],
    testFiles: ["src/lib/ci/__tests__/worked-examples.test.ts"],
    protectedTransforms: [
      "src/lib/ci/calculate-v2.ts",
      "src/lib/ci/normalize-v2.ts",
    ],
    notes:
      "Recomputes every rule published at /civica-index/methodology (weights, mandatory-dimension exclusion, full and partial composites, no published range) using the same production primitives production calls.",
    provenance: "already_covered",
  },
] as const;

/** Set of repo-root-relative paths registered as protected Index transforms. */
export function protectedTransformPaths(): ReadonlySet<string> {
  return new Set(
    INDEX_PROTECTED_FILES.filter((row) => PROTECTED_TRANSFORM_CATEGORIES.has(row.category)).map(
      (row) => row.path,
    ),
  );
}

export interface GoldenRegistryCheckOptions {
  /** Existence probe. Defaults to the real filesystem in the validator. */
  fileExists?: (path: string) => boolean;
  /** Override the protected-transform set (seeded-failure tests only). */
  protectedPaths?: ReadonlySet<string>;
}

/**
 * Collect every registry-integrity error. Returns [] when the registry is
 * internally coherent, every listed test/source file exists, and every
 * declared protected transform is registered in the Index change-control net.
 *
 * DB-free and side-effect-free apart from the injected `fileExists` probe.
 */
export function goldenTestsRegistryErrors(
  registry: readonly GoldenTestEntry[] = GOLDEN_TESTS_REGISTRY,
  options: GoldenRegistryCheckOptions = {},
): string[] {
  const fileExists = options.fileExists ?? (() => true);
  const protectedPaths = options.protectedPaths ?? protectedTransformPaths();
  const errors: string[] = [];

  // Exactly one entry per subtopic; no unknown or duplicate subtopics.
  const seen = new Set<GoldenSubtopic>();
  for (const entry of registry) {
    if (!GOLDEN_SUBTOPICS.includes(entry.subtopic)) {
      errors.push(`unknown subtopic: ${entry.subtopic}`);
      continue;
    }
    if (seen.has(entry.subtopic)) errors.push(`duplicate subtopic entry: ${entry.subtopic}`);
    seen.add(entry.subtopic);
  }
  for (const subtopic of GOLDEN_SUBTOPICS) {
    if (!seen.has(subtopic)) errors.push(`missing golden coverage for subtopic: ${subtopic}`);
  }

  for (const entry of registry) {
    if (entry.testFiles.length === 0) errors.push(`${entry.subtopic}: no golden test file registered`);
    if (entry.sourceOfTruth.length === 0) errors.push(`${entry.subtopic}: no source-of-truth module registered`);

    for (const path of entry.testFiles) {
      if (!fileExists(path)) errors.push(`${entry.subtopic}: registered golden test file is missing: ${path}`);
    }
    for (const path of entry.sourceOfTruth) {
      if (!fileExists(path)) errors.push(`${entry.subtopic}: registered source-of-truth module is missing: ${path}`);
    }
    for (const path of entry.protectedTransforms) {
      if (!entry.sourceOfTruth.includes(path)) {
        errors.push(`${entry.subtopic}: protected transform ${path} is not in its source-of-truth list`);
      }
      if (!protectedPaths.has(path)) {
        errors.push(
          `${entry.subtopic}: protected transform ${path} is not registered in the Index change-control net`,
        );
      }
    }
  }

  return errors;
}
