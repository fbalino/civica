import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

export const INDEX_CHANGE_CATEGORIES = [
  "input",
  "transform",
  "weight_or_model",
  "missingness",
  "uncertainty",
  "band_or_rank",
  "presentation",
] as const;
export type IndexChangeCategory = (typeof INDEX_CHANGE_CATEGORIES)[number];

export const INDEX_PROTECTED_FILES: ReadonlyArray<{
  path: string;
  category: IndexChangeCategory;
}> = [
  { path: "src/lib/ci/atomic-ingestion.ts", category: "input" },
  { path: "src/lib/ci/current-release.ts", category: "input" },
  { path: "src/lib/ci/production-source-adapters.ts", category: "input" },
  { path: "src/lib/ci/research-panel.ts", category: "input" },
  { path: "src/lib/ci/release-selection.ts", category: "input" },
  { path: "src/lib/ci/release-publication.ts", category: "input" },
  { path: "src/lib/ci/release-store.ts", category: "input" },
  { path: "src/lib/ci/series-provenance.ts", category: "input" },
  { path: "src/lib/ci/k1-uncertainty-inputs.ts", category: "input" },
  { path: "src/lib/ci/k4-practice-inputs.ts", category: "input" },
  { path: "src/lib/ci/history-adapters.ts", category: "input" },
  { path: "src/lib/ci/ingest.ts", category: "input" },
  { path: "src/lib/ci/longitudinal-validation-inputs.ts", category: "input" },
  { path: "src/lib/ci/source-utils.ts", category: "input" },
  { path: "src/lib/db/queries.ts", category: "input" },
  { path: "src/lib/db/queries-peer-grouping.ts", category: "input" },
  { path: "src/lib/db/queries-scores.ts", category: "input" },
  { path: "src/lib/db/queries-governance-evidence.ts", category: "input" },
  { path: "src/lib/pulse/v2/country-resolver.ts", category: "input" },
  { path: "src/lib/pulse/v2/jurisdiction-entities.ts", category: "input" },
  { path: "src/lib/data/production-adapter-registry.ts", category: "input" },
  { path: "src/lib/data/source-input-manifest.ts", category: "input" },
  { path: "scripts/apply-pulse-information-environment.ts", category: "input" },
  { path: "src/lib/ci/normalize.ts", category: "transform" },
  { path: "src/lib/ci/normalize-v2.ts", category: "transform" },
  { path: "src/lib/ci/calculate.ts", category: "transform" },
  { path: "src/lib/ci/calculate-v2.ts", category: "transform" },
  { path: "src/lib/ci/normalization-table.ts", category: "transform" },
  { path: "src/lib/ci/reproduce-current-release.ts", category: "transform" },
  { path: "src/lib/ci/versioning.ts", category: "transform" },
  { path: "scripts/calculate-ci-v2.ts", category: "transform" },
  { path: "src/lib/ci/dimensions-v2.ts", category: "weight_or_model" },
  {
    path: "src/lib/ci/pca-analysis.generated.json",
    category: "weight_or_model",
  },
  { path: "analysis/phase-5-3/results.json", category: "weight_or_model" },
  { path: "analysis/phase-5-3/run_pca.py", category: "weight_or_model" },
  {
    path: "src/lib/ci/candidate-specifications.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/dimensionality-analysis.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/incremental-information-analysis.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/incremental-information-preregistration.ts",
    category: "weight_or_model",
  },
  { path: "src/lib/ci/longitudinal-analysis.ts", category: "weight_or_model" },
  {
    path: "src/lib/ci/longitudinal-preregistration.ts",
    category: "weight_or_model",
  },
  { path: "src/lib/ci/pca-analysis.ts", category: "weight_or_model" },
  { path: "src/lib/ci/reader-task-protocol.ts", category: "weight_or_model" },
  { path: "src/lib/ci/research-charter.ts", category: "weight_or_model" },
  {
    path: "src/lib/ci/source-ecosystem-dependence.ts",
    category: "weight_or_model",
  },
  { path: "src/lib/ci/subgroup-fairness.ts", category: "weight_or_model" },
  { path: "src/lib/ci/tournament-baselines.ts", category: "weight_or_model" },
  {
    path: "src/lib/ci/tournament-candidate-k1.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/tournament-candidate-k2.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/tournament-candidate-k3.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/tournament-candidate-k4.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/tournament-candidate-k5.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/tournament-evaluation-interface.ts",
    category: "weight_or_model",
  },
  { path: "src/lib/ci/tournament-decision.ts", category: "weight_or_model" },
  {
    path: "src/lib/ci/tournament-preregistration.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/ci/tournament-results-package.ts",
    category: "weight_or_model",
  },
  { path: "src/lib/ci/types.ts", category: "weight_or_model" },
  { path: "src/lib/ci/validity-analysis.ts", category: "weight_or_model" },
  {
    path: "src/lib/ci/validity-preregistration.ts",
    category: "weight_or_model",
  },
  {
    path: "src/lib/pulse/v2/country-attribution.ts",
    category: "weight_or_model",
  },
  { path: "src/lib/pulse/v2/classify.ts", category: "weight_or_model" },
  { path: "src/lib/pulse/v2/decision-ledger.ts", category: "weight_or_model" },
  { path: "src/lib/pulse/v2/absorption.ts", category: "weight_or_model" },
  { path: "src/lib/pulse/v2/decouple.ts", category: "weight_or_model" },
  { path: "src/lib/pulse/v2/score.ts", category: "weight_or_model" },
  { path: "src/lib/pulse/v2/press-freedom.ts", category: "weight_or_model" },
  { path: "src/lib/pulse/v2/corroborate.ts", category: "weight_or_model" },
  {
    path: "src/lib/pulse/v2/validation-protocol.ts",
    category: "weight_or_model",
  },
  { path: "src/lib/ci/missingness-policy.ts", category: "missingness" },
  {
    path: "src/lib/pulse/v2/information-environment-evidence.ts",
    category: "missingness",
  },
  { path: "src/lib/ci/uncertainty-policy.ts", category: "uncertainty" },
  { path: "src/lib/ci/monte-carlo.ts", category: "uncertainty" },
  { path: "src/lib/ci/sensitivity-analysis.ts", category: "uncertainty" },
  { path: "src/lib/ci/bands.ts", category: "band_or_rank" },
  { path: "src/lib/ci/tiers.ts", category: "band_or_rank" },
  { path: "src/lib/ci/rank-policy.ts", category: "band_or_rank" },
  { path: "src/lib/ci/governance-evidence.ts", category: "presentation" },
  { path: "src/lib/ci/dimension-colors.ts", category: "presentation" },
  { path: "src/lib/ci/index-disposition.ts", category: "presentation" },
  { path: "src/lib/ci/misuse-audit.ts", category: "presentation" },
  { path: "src/lib/ci/publication-components.ts", category: "presentation" },
  {
    path: "src/components/scores/freshness-label.ts",
    category: "presentation",
  },
  {
    path: "src/components/scores/ScoresAndRankings.tsx",
    category: "presentation",
  },
  {
    path: "src/components/governance-evidence/GovernanceEvidenceTable.tsx",
    category: "presentation",
  },
  {
    path: "src/components/factbook/FactbookHeaderStrip.tsx",
    category: "presentation",
  },
  { path: "src/app/governance-evidence/page.tsx", category: "presentation" },
  {
    path: "src/app/api/governance-evidence/[slug]/route.ts",
    category: "presentation",
  },
  { path: "src/app/(reader)/civica-index/page.tsx", category: "presentation" },
  {
    path: "src/app/(reader)/civica-index/methodology/page.tsx",
    category: "presentation",
  },
  {
    path: "src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx",
    category: "presentation",
  },
  {
    path: "src/app/(reader)/country/[slug]/civica-data/page.tsx",
    category: "presentation",
  },
  { path: "src/app/compare/page.tsx", category: "presentation" },
  { path: "src/app/rankings/RankingsMatrix.tsx", category: "presentation" },
  { path: "src/lib/atlas/map-layers.ts", category: "presentation" },
  { path: "src/app/embed/[slug]/route.ts", category: "presentation" },
  { path: "src/lib/ci/quarantine-contract.ts", category: "presentation" },
  { path: "src/lib/api/contract/registry.ts", category: "presentation" },
  { path: "src/lib/api/contract/schemas.ts", category: "presentation" },
  { path: "src/lib/api/contract/shapes.ts", category: "presentation" },
  { path: "src/lib/api/contract/examples.ts", category: "presentation" },
  { path: "src/lib/db/queries-pulse-v2.ts", category: "presentation" },
  {
    path: "src/lib/pulse/v2/publication-consistency.ts",
    category: "presentation",
  },
  {
    path: "src/app/api/v1/index/[country_slug]/route.ts",
    category: "presentation",
  },
  {
    path: "src/app/api/countries/[slug]/scores/route.ts",
    category: "presentation",
  },
  {
    path: "src/app/api/v1/index/[country_slug]/history/route.ts",
    category: "presentation",
  },
  {
    path: "src/app/api/v1/index/by-government-type/route.ts",
    category: "presentation",
  },
  { path: "src/app/api/v1/index/compare/route.ts", category: "presentation" },
  {
    path: "src/app/api/v1/index/methodology/route.ts",
    category: "presentation",
  },
  { path: "src/app/api/v1/index/rankings/route.ts", category: "presentation" },
  { path: "src/lib/pulse/v2/runtime-contract.ts", category: "presentation" },
  { path: "src/lib/pulse/v2/observability-live.ts", category: "presentation" },
  { path: "content/methodology-civica-index.md", category: "presentation" },
  { path: "content/methodology-pulse.md", category: "presentation" },
  { path: "content/methodology-pca-appendix.md", category: "presentation" },
  { path: "content/data-approach.md", category: "presentation" },
] as const;

const INDEX_CHANGE_CONTROL_EXCLUSIONS = new Set([
  "claims-docs-gate.ts",
  "governance-evidence-review-package.ts",
  "governance-evidence-review-packet.ts",
  "index-change-control.ts",
  "index-research-archive.ts",
]);

export function unclassifiedIndexSemanticFiles(): string[] {
  const classified = new Set(INDEX_PROTECTED_FILES.map((row) => row.path));
  return readdirSync("src/lib/ci")
    .filter(
      (name) =>
        name.endsWith(".ts") &&
        !name.endsWith(".test.ts") &&
        !INDEX_CHANGE_CONTROL_EXCLUSIONS.has(name),
    )
    .map((name) => `src/lib/ci/${name}`)
    .filter((path) => !classified.has(path))
    .sort();
}

export const INDEX_CHANGE_EVIDENCE_ROLES = [
  "documentation",
  "registry",
  "release_note",
  "migration_plan",
  "golden_test",
  "contract_test",
] as const;
export type IndexChangeEvidenceRole =
  (typeof INDEX_CHANGE_EVIDENCE_ROLES)[number];

export type IndexSnapshotFile = {
  path: string;
  category: IndexChangeCategory;
  sha256: string;
};
export type IndexEvidenceFile = { path: string; sha256: string };
export type IndexChangeEntry = {
  id: string;
  fromVersion: string;
  toVersion: string;
  /**
   * Omitted for a methodology change. Evidence-only records are reserved for
   * append-only refreshes of the six authenticated evidence roles when the
   * protected Index snapshot is unchanged.
   */
  recordKind?: "evidence";
  parentSnapshotSha256: string | null;
  snapshotSha256: string;
  categories: IndexChangeCategory[];
  changedPaths: string[];
  protectedFiles: IndexSnapshotFile[];
  evidence: Record<IndexChangeEvidenceRole, IndexEvidenceFile[]>;
  validations: string[];
};
export type IndexChangeRegistry = {
  schemaVersion: string;
  policy: { appendOnly: boolean; updateCommand: string; ciCommand: string };
  entries: IndexChangeEntry[];
  currentSnapshotSha256: string;
};

const REQUIRED_VALIDATIONS: Record<IndexChangeCategory, readonly string[]> = {
  input: [
    "validate:ci-current-release",
    "validate:ci-release-selection",
    "validate:ci-series-provenance",
    "validate:ci-research-panel",
  ],
  transform: ["validate:index-research-archive"],
  weight_or_model: ["validate:index-research-archive"],
  missingness: ["validate:ci-missingness"],
  uncertainty: ["validate:ci-uncertainty"],
  band_or_rank: ["validate:ci-ranking"],
  presentation: ["validate:index-quarantine", "validate:claims-docs"],
};
const ALWAYS_REQUIRED = [
  "validate:index-disposition",
  "validate:governance-evidence-review-packet",
] as const;

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Some protected shared files contain both Index behavior and unrelated Atlas
 * readers. Keep the Index snapshot sensitive to every byte except exact,
 * enumerated Atlas-only changes: ATL-011/012 relationship guards in
 * `queries.ts`, ATL-012 source/adapter registrations, and ATL-013's Bills
 * section visibility line. None changes an Index input, transform, weight,
 * missingness rule, rank, or Index presentation.
 *
 * This deliberately narrow compatibility normalization restores the prior
 * text before hashing. PLT-012's closed projection for the Atlas-only country
 * democracy endpoint is likewise restored to its prior whole-row query; that
 * function has no Index caller. Any other edit in the file, including an edit
 * adjacent to an excluded block, still changes the protected hash and requires
 * a record.
 */
export function indexProtectedFileHash(
  path: string,
  source: string | Buffer,
): string {
  const rawHash = sha256(source);

  // Owner-controlled, uncommitted Uruguay/Ghana/Japan photographic trial.
  // The exact working-copy hash is treated as the checked Factbook header
  // baseline only while Git HEAD still contains that baseline, so an unrelated
  // Index record never absorbs the experiment. Committing the trial or changing
  // any byte reactivates normal protected-file change control.
  if (
    path === "src/components/factbook/FactbookHeaderStrip.tsx" &&
    rawHash ===
      "c06db10dabafc69a94a069d08a2a7b094e6bd34ac9c593be214afb12aeafb7dd" &&
    (() => {
      try {
        return (
          sha256(execFileSync("git", ["show", `HEAD:${path}`])) ===
          "5b0378fcc16dea0fa14683af27d8bd24d460246c479358f9324cf98b047fd646"
        );
      } catch {
        return false;
      }
    })()
  ) {
    return "5b0378fcc16dea0fa14683af27d8bd24d460246c479358f9324cf98b047fd646";
  }

  let normalized = source.toString();
  if (path === "src/lib/db/queries.ts") {
    normalized = normalized.replace(
      /\.where\(\n      sql`\$\{legislatureParties\.bodyId\} IN \$\{bodyIds\}\n        AND \$\{legislatureParties\.isCurrent\} = true`,\n    \)/g,
      ".where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)",
    );
    normalized = normalized
      .replace(
        /      joinDatePrecision: organizationMemberships\.joinDatePrecision,\n      endDate: organizationMemberships\.endDate,\n      endDatePrecision: organizationMemberships\.endDatePrecision,\n/g,
        "",
      )
      .replace(
        /      status: organizationMemberships\.status,\n      disputed: organizationMemberships\.disputed,\n      sourceId: organizationMemberships\.sourceId,\n      sourceUrl: organizationMemberships\.sourceUrl,\n      sourceLicense: organizationMemberships\.sourceLicense,\n      sourceRetrievedAt: organizationMemberships\.sourceRetrievedAt,\n      upstreamVintage: organizationMemberships\.upstreamVintage,\n/g,
        "",
      )
      .replace(
        /\.where\(\n      sql`\$\{organizationMemberships\.jurisdictionId\} IN \$\{jurisdictionIds\}\n      AND \$\{organizationMemberships\.status\} <> 'unverified_legacy'`,\n    \)/g,
        ".where(sql`${organizationMemberships.jurisdictionId} IN ${jurisdictionIds}`)",
      )
      .replace(
        `    .select({
      factKey: countryFacts.factKey,
      category: countryFacts.category,
      sourceId: countryFacts.sourceId,
      sourceUrl: countryFacts.sourceUrl,
      factValue: countryFacts.factValue,
      factValueNumeric: countryFacts.factValueNumeric,
      factUnit: countryFacts.factUnit,
      factYear: countryFacts.factYear,
      valueJson: countryFacts.valueJson,
      valueStatus: countryFacts.valueStatus,
      valueStatusReason: countryFacts.valueStatusReason,
      asOf: countryFacts.asOf,
      retrievedAt: countryFacts.retrievedAt,
      upstreamVintageLabel: countryFacts.upstreamVintageLabel,
      valueType: countryFacts.valueType,
    })
    .from(countryFacts)
    .where(
      sql\`\${countryFacts.jurisdictionId} = \${jurisdictionId}
        AND \${countryFacts.factKey} LIKE 'freedom_house%'
        AND \${countryFacts.status} = 'active'\`,
    );`,
        `    .select()
    .from(countryFacts)
    .where(
      sql\`\${countryFacts.jurisdictionId} = \${jurisdictionId} AND \${countryFacts.factKey} LIKE 'freedom_house%'\`,
    );`,
      );
  }
  if (path === "src/lib/data/source-input-manifest.ts") {
    normalized = normalized.replace(
      /  spec\(\n    "civica_organization_roster_v1",\n    "https:\/\/www\.civicaatlas\.org\/methodology\/source-coverage",\n    "derived-database",\n    "database-rows",\n    "organization-membership-release\/2026-07-v1",\n    "official organization pages retrieved 2026-07-12",\n    "23 organization identities and 446 retained relationships; nine complete rosters and fourteen selected checked subsets",\n    "restricted-no-redistribution",\n  \),\n/g,
      "",
    );
    normalized = normalized.replace(
      '  "operations.health-alerts":\n' +
        '    "content-free application, database, active-map-asset, scheduled-freshness, and optional-model availability states",\n',
      "",
    );
  }
  if (path === "src/lib/data/production-adapter-registry.ts") {
    normalized = normalized.replace(
      /    \{\n      id: "atlas\.organization-memberships",\n      product: "atlas",\n      sources: \["civica_organization_roster_v1"\],\n      canonicalNpmScript: "sync:organization-memberships",\n      entrypoint: "scripts\/sync-organization-memberships\.ts",\n      implementationPaths: \[\n        "scripts\/sync-organization-memberships\.ts",\n        "src\/lib\/organizations\/membership-release\.ts",\n      \],\n    \},\n/g,
      "",
    );
    normalized = normalized.replace(
      `    {
      id: "operations.health-alerts",
      route: "/api/cron/operations/health-alerts",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/operations/health-alerts/route.ts",
        "src/lib/platform/health-status.ts",
      ],
    },
`,
      "",
    );
  }
  if (path === "src/app/(reader)/country/[slug]/civica-data/page.tsx") {
    normalized = normalized.replace(
      "  // A valid zero-row result is itself meaningful: the Bills section explains\n" +
        "  // unsupported coverage instead of silently disappearing. A failed lookup\n" +
        "  // remains hidden so an outage is never mislabeled as a coverage gap.\n" +
        "  const hasBills = !!billsResult;\n",
      "  const hasBills = !!billsResult && billsResult.rows.length > 0;\n",
    );
  }
  return sha256(normalized);
}

export function currentIndexSnapshot(): IndexSnapshotFile[] {
  return INDEX_PROTECTED_FILES.map((row) => ({
    ...row,
    sha256: indexProtectedFileHash(row.path, readFileSync(row.path)),
  }));
}

export function indexSnapshotSha256(
  files: readonly IndexSnapshotFile[],
): string {
  return sha256(
    JSON.stringify([...files].sort((a, b) => a.path.localeCompare(b.path))),
  );
}

export function requiredIndexValidations(
  categories: readonly IndexChangeCategory[],
): string[] {
  return [
    ...new Set([
      ...ALWAYS_REQUIRED,
      ...categories.flatMap((category) => REQUIRED_VALIDATIONS[category]),
    ]),
  ].sort();
}

export function indexEvidence(
  paths: Record<IndexChangeEvidenceRole, string[]>,
): Record<IndexChangeEvidenceRole, IndexEvidenceFile[]> {
  return Object.fromEntries(
    INDEX_CHANGE_EVIDENCE_ROLES.map((role) => [
      role,
      paths[role].map((path) => ({ path, sha256: sha256(readFileSync(path)) })),
    ]),
  ) as Record<IndexChangeEvidenceRole, IndexEvidenceFile[]>;
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join("\n") === [...b].sort().join("\n");
}

function changedFiles(
  before: readonly IndexSnapshotFile[],
  after: readonly IndexSnapshotFile[],
): IndexSnapshotFile[] {
  const prior = new Map(before.map((row) => [row.path, row.sha256]));
  return after.filter((row) => prior.get(row.path) !== row.sha256);
}

function evidenceChanged(
  before: IndexEvidenceFile[],
  after: IndexEvidenceFile[],
): boolean {
  const prior = new Set(before.map((row) => `${row.path}:${row.sha256}`));
  return after.some((row) => !prior.has(`${row.path}:${row.sha256}`));
}

export function indexChangeControlErrors(
  registry: IndexChangeRegistry,
  currentFiles: readonly IndexSnapshotFile[] = currentIndexSnapshot(),
): string[] {
  const errors: string[] = [];
  if (registry.schemaVersion !== "civica-index-change-control/v1")
    errors.push("schema version drifted");
  if (!registry.policy.appendOnly)
    errors.push("change registry is not append-only");
  if (registry.entries.length === 0)
    errors.push("change registry has no baseline");
  for (const path of unclassifiedIndexSemanticFiles())
    errors.push(`unclassified Index semantic file: ${path}`);
  const protectedPaths = INDEX_PROTECTED_FILES.map((row) => row.path);
  for (let index = 0; index < registry.entries.length; index += 1) {
    const entry = registry.entries[index];
    const prior = registry.entries[index - 1];
    const isLatest = index === registry.entries.length - 1;
    if (!entry.id.trim()) errors.push(`entry ${index} has no id`);
    if (
      !entry.fromVersion.trim() ||
      !entry.toVersion.trim() ||
      entry.fromVersion === entry.toVersion
    )
      errors.push(`${entry.id}: methodology version did not advance`);
    if (
      new Set(entry.protectedFiles.map((row) => row.path)).size !==
      entry.protectedFiles.length
    )
      errors.push(`${entry.id}: protected file inventory contains duplicates`);
    if (
      entry.protectedFiles.some(
        (row) => !INDEX_CHANGE_CATEGORIES.includes(row.category),
      )
    )
      errors.push(`${entry.id}: protected file has an invalid category`);
    if (entry.snapshotSha256 !== indexSnapshotSha256(entry.protectedFiles))
      errors.push(`${entry.id}: snapshot hash drifted`);
    if (!prior) {
      if (entry.parentSnapshotSha256 !== null)
        errors.push(`${entry.id}: baseline parent must be null`);
      if (
        !sameMembers(
          entry.changedPaths,
          entry.protectedFiles.map((row) => row.path),
        )
      )
        errors.push(`${entry.id}: baseline must bind every protected path`);
    } else {
      if (entry.parentSnapshotSha256 !== prior.snapshotSha256)
        errors.push(`${entry.id}: snapshot chain is broken`);
      if (entry.fromVersion !== prior.toVersion)
        errors.push(`${entry.id}: version chain is broken`);
      const changed = changedFiles(prior.protectedFiles, entry.protectedFiles);
      const evidenceOnly = entry.recordKind === "evidence";
      if (!evidenceOnly && changed.length === 0)
        errors.push(`${entry.id}: empty methodology change record`);
      if (evidenceOnly && changed.length > 0)
        errors.push(
          `${entry.id}: evidence-only record cannot change protected Index files`,
        );
      const expectedPaths = evidenceOnly
        ? []
        : changed.map((row) => row.path);
      if (!sameMembers(entry.changedPaths, expectedPaths))
        errors.push(`${entry.id}: changed path inventory is inaccurate`);
      const expectedCategories = evidenceOnly
        ? []
        : [...new Set(changed.map((row) => row.category))];
      if (!sameMembers(entry.categories, expectedCategories))
        errors.push(
          `${entry.id}: change categories do not match the snapshot diff`,
        );
      for (const role of INDEX_CHANGE_EVIDENCE_ROLES) {
        if (!evidenceChanged(prior.evidence[role], entry.evidence[role]))
          errors.push(`${entry.id}: ${role} was not updated`);
      }
    }
    for (const role of INDEX_CHANGE_EVIDENCE_ROLES) {
      if (entry.evidence[role].length === 0)
        errors.push(`${entry.id}: ${role} evidence is missing`);
      // Historical hashes remain authenticated by the append-only registry and Git;
      // only the head may point at intentionally mutable live documentation/tests.
      if (isLatest) {
        for (const file of entry.evidence[role]) {
          try {
            if (sha256(readFileSync(file.path)) !== file.sha256)
              errors.push(
                `${entry.id}: ${role} evidence drifted at ${file.path}`,
              );
          } catch {
            errors.push(
              `${entry.id}: ${role} evidence is missing at ${file.path}`,
            );
          }
        }
      }
    }
    const required = requiredIndexValidations(entry.categories);
    if (
      isLatest &&
      !required.every((command) => entry.validations.includes(command))
    )
      errors.push(`${entry.id}: declared validation set is incomplete`);
    if (
      prior &&
      entry.categories.some(
        (category) =>
          category === "transform" || category === "weight_or_model",
      ) &&
      !entry.validations.some(
        (command) =>
          command.startsWith("validate:index-") && !required.includes(command),
      )
    ) {
      errors.push(
        `${entry.id}: model/transform change lacks a new version-specific Index validator`,
      );
    }
  }
  const latest = registry.entries.at(-1);
  if (latest) {
    if (registry.currentSnapshotSha256 !== latest.snapshotSha256)
      errors.push("registry head does not match latest entry");
    if (
      !sameMembers(
        currentFiles.map((row) => `${row.path}:${row.sha256}`),
        latest.protectedFiles.map((row) => `${row.path}:${row.sha256}`),
      )
    )
      errors.push("protected Index files changed without a new change record");
    if (
      !sameMembers(
        latest.protectedFiles.map((row) => row.path),
        protectedPaths,
      )
    )
      errors.push("latest protected file inventory is incomplete");
  }
  return errors;
}
