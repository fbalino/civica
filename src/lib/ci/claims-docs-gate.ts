/**
 * Pure manifest + orchestration logic for the claims-and-documentation CI
 * gate (CLM-017). This module contains no process execution — it only
 * describes which npm validators satisfy which Done-when category and
 * evaluates pass/fail results supplied by the caller. `scripts/validate-claims-docs.ts`
 * is the only place that actually spawns child processes; tests import this
 * module directly so the orchestration logic is provable without a database,
 * network access, or a real npm run.
 */

export const REQUIRED_CATEGORIES = [
  "registry-coverage",
  "numeric-templates",
  "routes-anchors",
  "api-examples",
  "methodology-fixtures",
  "experimental-labels",
  "terminology-policy",
] as const;

export type GateCategory = (typeof REQUIRED_CATEGORIES)[number];

export interface GateCheck {
  /** Stable, unique identifier for this check. */
  id: string;
  /** The existing npm script this check reuses — never duplicated logic. */
  npmScript: string;
  /** One or more Done-when categories this check satisfies. */
  categories: readonly GateCategory[];
  /** Human-readable description shown in the report. */
  description: string;
}

export interface GateManifest {
  checks: readonly GateCheck[];
}

/**
 * The seven Done-when categories from CLM-017, each satisfied by reusing
 * existing focused validators rather than re-implementing their checks.
 */
export const CLAIMS_DOCS_GATE_MANIFEST: GateManifest = {
  checks: [
    {
      id: "public-claims",
      npmScript: "validate:public-claims",
      categories: ["registry-coverage", "experimental-labels"],
      description:
        "Public-claims registry coverage, tier mapping, and prohibited authority/grade language.",
    },
    {
      id: "numeric-claims",
      npmScript: "validate:numeric-claims",
      categories: ["numeric-templates"],
      description: "Mutable public numeric claims resolve from runtime state or a dated release.",
    },
    {
      id: "content-templates",
      npmScript: "validate:content-templates",
      categories: ["numeric-templates"],
      description: "Reader markdown numeric interpolations resolve against typed state and soft-fail stats context.",
    },
    {
      id: "doc-sources",
      npmScript: "validate:doc-sources",
      categories: ["routes-anchors"],
      description: "Methodology/release concepts resolve to exactly one canonical path/anchor.",
    },
    {
      id: "doc-references",
      npmScript: "validate:doc-references",
      categories: ["routes-anchors"],
      description: "Operational docs, routes, and generated README stay in sync with source.",
    },
    {
      id: "api-docs",
      npmScript: "validate:api-docs",
      categories: ["api-examples"],
      description: "Generated API docs and examples match the endpoint contract registry.",
    },
    {
      id: "unit-tests",
      npmScript: "test",
      categories: ["methodology-fixtures"],
      description: "Full unit-test suite, including methodology worked-example fixtures.",
    },
    {
      id: "pulse-runtime",
      npmScript: "validate:pulse-runtime",
      categories: ["methodology-fixtures"],
      description: "Public Pulse runtime-method contract matches the generated snapshot.",
    },
    {
      id: "metadata",
      npmScript: "validate:metadata",
      categories: ["experimental-labels"],
      description: "Structured metadata states research-beta/experimental posture correctly.",
    },
    {
      id: "terminology",
      npmScript: "validate:terminology",
      categories: ["terminology-policy"],
      description: "Research-terminology contract forbids unsupported validation/replication claims.",
    },
    {
      id: "policy-surface",
      npmScript: "validate:policy-surface",
      categories: ["terminology-policy"],
      description: "Publication policy prose matches current capability boundaries and its executable contract.",
    },
    {
      id: "rights-claims",
      npmScript: "validate:rights-claims",
      categories: ["terminology-policy"],
      description: "Data/code reuse-rights claims match the interim rights registry; no false open-source/MIT/complete-manifest/blanket-open-data language on required surfaces.",
    },
  ],
};

export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validates that every required category is covered at least once, with no duplicate or unknown checks/categories. */
export function validateManifest(manifest: GateManifest): ManifestValidationResult {
  const errors: string[] = [];
  const requiredSet = new Set<string>(REQUIRED_CATEGORIES);
  const seenIds = new Set<string>();
  const coveredCategories = new Set<string>();

  if (manifest.checks.length === 0) {
    errors.push("manifest has no checks");
  }

  for (const check of manifest.checks) {
    if (seenIds.has(check.id)) {
      errors.push(`duplicate check id: ${check.id}`);
    }
    seenIds.add(check.id);

    if (check.categories.length === 0) {
      errors.push(`check ${check.id} declares no categories`);
    }

    for (const category of check.categories) {
      if (!requiredSet.has(category)) {
        errors.push(`check ${check.id} references unknown category: ${category}`);
        continue;
      }
      coveredCategories.add(category);
    }
  }

  for (const required of REQUIRED_CATEGORIES) {
    if (!coveredCategories.has(required)) {
      errors.push(`no check covers required category: ${required}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export interface GateEvaluation {
  ok: boolean;
  /** Check ids that failed (or were never reported). */
  failedChecks: string[];
  /** Categories with at least one failed/missing check. */
  failedCategories: GateCategory[];
  /** Check ids the manifest declares but the results map omitted. */
  missingResults: string[];
}

/**
 * Evaluates a manifest against a results map (checkId -> passed). Pure and
 * execution-free so both the real CLI and the seeded fixtures below can
 * prove the same orchestration logic never swallows a failure.
 */
export function evaluateGate(
  manifest: GateManifest,
  results: Record<string, boolean>,
): GateEvaluation {
  const failedChecks: string[] = [];
  const missingResults: string[] = [];
  const failedCategories = new Set<GateCategory>();

  for (const check of manifest.checks) {
    const result = results[check.id];
    if (result === undefined) {
      missingResults.push(check.id);
      failedChecks.push(check.id);
      for (const category of check.categories) failedCategories.add(category);
      continue;
    }
    if (!result) {
      failedChecks.push(check.id);
      for (const category of check.categories) failedCategories.add(category);
    }
  }

  return {
    ok: failedChecks.length === 0,
    failedChecks,
    failedCategories: [...failedCategories],
    missingResults,
  };
}

export interface SeededFixture {
  label: string;
  results: Record<string, boolean>;
  /** Expected `evaluateGate(...).ok` for this fixture. */
  expectedOk: boolean;
  /** When expectedOk is false, the category the seeded failure must surface. */
  expectedFailedCategory?: GateCategory;
  /** Existing semantic negative fixture exercised by the `npm test` child.
   * The in-process result map proves orchestration fail-closed; this pointer
   * proves the validator-level stale-copy case is also part of the gate. */
  semanticFixtureEvidence?: string;
}

export const STALE_COPY_FIXTURE_EVIDENCE: Record<GateCategory, string> = {
  "registry-coverage":
    "src/lib/claims/public-claims.test.ts — missing-surface and unregistered-headline fixtures",
  "numeric-templates":
    "src/lib/claims/public-numeric-claims.test.ts — stale live literal and missing-fallback fixtures",
  "routes-anchors":
    "src/lib/docs/__tests__/doc-concepts.test.ts — stale route and broken-anchor fixtures",
  "api-examples":
    "src/lib/api/contract/__tests__/contract.test.ts — missing/excess response-field fixtures",
  "methodology-fixtures":
    "src/lib/ci/__tests__/worked-examples.test.ts and src/lib/pulse/v2/runtime-method.test.ts",
  "experimental-labels":
    "src/lib/seo/__tests__/metadata-contract.test.ts — missing research-beta/experimental labels",
  "terminology-policy":
    "src/lib/research-terminology.test.ts, src/lib/policy/__tests__/policy-surface.test.ts, and src/lib/claims/__tests__/reuse-rights.test.ts",
};

/**
 * Builds one all-pass fixture plus one seeded-failure fixture per required
 * category (flipping exactly one check that covers that category to
 * `false`). Used both by the pure test suite and by the CLI's pre-flight
 * self-check, so a single definition proves the gate fails closed for every
 * category before any real validator runs.
 */
export function buildSeededFixtures(manifest: GateManifest): SeededFixture[] {
  const allPass: Record<string, boolean> = {};
  for (const check of manifest.checks) allPass[check.id] = true;

  const fixtures: SeededFixture[] = [
    { label: "clean fake run", results: allPass, expectedOk: true },
  ];

  for (const category of REQUIRED_CATEGORIES) {
    const check = manifest.checks.find((candidate) => candidate.categories.includes(category));
    if (!check) continue;
    fixtures.push({
      label: `seeded stale-copy failure: ${category}`,
      results: { ...allPass, [check.id]: false },
      expectedOk: false,
      expectedFailedCategory: category,
      semanticFixtureEvidence: STALE_COPY_FIXTURE_EVIDENCE[category],
    });
  }

  return fixtures;
}
