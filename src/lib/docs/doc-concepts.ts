/**
 * Documentation-source registry (CLM-009).
 *
 * One entry per methodology/release CONCEPT that could otherwise be
 * hand-copied in more than one place: reader markdown, reader TSX,
 * README, API examples, runbooks, and project memory. Each concept
 * names exactly ONE canonical location and declares every other place
 * that mentions it, tagged with HOW that other place relates to the
 * canonical (generated / interpolated / contract-tested / link-only).
 *
 * This registry is orthogonal to `src/lib/claims/public-claims.ts`:
 * it stores no claim prose, tier, or numeric value — it only cross-
 * links to a `PublicClaim.id` string when a concept backs a
 * registered public claim. Do not duplicate claim content here.
 *
 * `scripts/validate-doc-sources.ts` is the DB-free consumer:
 *   - re-runs the two GEN-marker/snapshot generators in `--check`
 *     mode for concepts whose canonical has a `generated` relation
 *   - scans `reader-markdown` / `reader-tsx` / `readme` / `api-example`
 *     relations for formula fingerprints outside their declared
 *     generated block (memory/runbook relations are declared
 *     link-only and are scan-EXEMPT by design — see `SCANNABLE_KINDS`)
 *   - validates internal links/routes via `src/lib/docs/routes.ts`
 *
 * See `src/lib/docs/__tests__/doc-concepts.test.ts` for the invariant
 * tests (unique ids, unique canonical path+symbol, etc.) and negative
 * fixtures proving the scanner actually catches drift.
 */

/* ────────────────────────────────────────────────────────────────
 * Location kinds
 * ──────────────────────────────────────────────────────────────── */

/**
 * The six reader/publication-facing "surface" kinds a concept can be
 * mentioned in. Formula-fingerprint scanning (CLM-009 §2) applies
 * only to `reader-markdown`, `reader-tsx`, `readme`, and
 * `api-example` — `runbook` and `memory` are declared link-only and
 * are scan-exempt by design (operational runbooks and project memory
 * are allowed to describe a formula in prose without being held to
 * the same byte-for-byte non-duplication bar as public reader
 * surfaces).
 */
export const DOC_SURFACE_KINDS = [
  "reader-markdown",
  "reader-tsx",
  "readme",
  "api-example",
  "runbook",
  "memory",
] as const;
export type DocSurfaceKind = (typeof DOC_SURFACE_KINDS)[number];

/** Surface kinds the formula-fingerprint scanner actually reads. */
export const SCANNABLE_KINDS: readonly DocSurfaceKind[] = [
  "reader-markdown",
  "reader-tsx",
  "readme",
  "api-example",
];

/**
 * A canonical location is usually NOT a reader-facing surface — it's
 * the library/generator source code that actually computes the
 * number or formula (e.g. `src/lib/ci/normalize-v2.ts`). `"source"`
 * is a 7th, non-surface kind reserved for exactly this case. It is
 * never scanned (the scanner only walks `SCANNABLE_KINDS`) and never
 * appears in `DOC_SURFACE_KINDS`, which enumerates surfaces, not
 * canonical-only locations.
 */
export type DocLocationKind = DocSurfaceKind | "source";

export interface DocLocation {
  kind: DocLocationKind;
  /** Repo-relative path. May be a directory (see `ci-pca-analysis`
   *  below) when the canonical is a whole analysis-run output bundle
   *  rather than one file. */
  path: string;
  /** Optional export/function/field name, or a heading anchor id for
   *  markdown locations. */
  symbol?: string;
}

/* ────────────────────────────────────────────────────────────────
 * Relationships
 * ──────────────────────────────────────────────────────────────── */

export type DocRelationshipType =
  /** Mechanically produced from the canonical by a generator script,
   *  checked in, and verified with a `--check` byte-compare. Never
   *  hand-edited. */
  | "generated"
  /** Imports/re-exports the canonical value at build- or run-time
   *  (a TS import, or a `{{state.*}}` / `{{ctx.*}}` markdown
   *  substitution marker resolved from it). Never retypes the value. */
  | "interpolated"
  /** Independently authored but asserted equal to the canonical by an
   *  automated test, rather than generated from or importing it. */
  | "contract-test"
  /** Mentions or links to the canonical without duplicating its
   *  content. */
  | "link-only";

export interface DocRelation extends DocLocation {
  relationship: DocRelationshipType;
  /** Why this relation is what it is, especially for `link-only` /
   *  scan-exempt relations — required reading for a future maintainer
   *  who might otherwise "fix" an apparent duplication. */
  note?: string;
}

/**
 * Task ids that may own a deferred concept's eventual cleanup. Bounded
 * to the task ids named in the CLM-009 bounded-repair brief, but kept
 * open to a future clear typed task-id string (the `(string & {})`
 * intersection keeps literal autocomplete for the known ids while
 * still accepting e.g. a future "CLM-023").
 */
export type DeferredOwnerTaskId = "CLM-011" | "CLM-012" | "CLM-017" | (string & {});

export interface DocConcept {
  /** Stable, unique, kebab-case (or dotted, matching an owning task's
   *  own naming) identifier. */
  id: string;
  /** Human-readable label for reporting. */
  title: string;
  /** Exactly one canonical location — never an array. */
  canonical: DocLocation;
  /** Every other surface/location that mentions or derives from this
   *  concept. */
  relations: DocRelation[];
  /** Optional cross-links to `PUBLIC_CLAIMS[].id` in
   *  `src/lib/claims/public-claims.ts`. Id-only — no claim prose,
   *  tier, or value is duplicated here. Validated against the real
   *  registry by `scripts/validate-doc-sources.ts` (never by
   *  importing claim CONTENT into this file). */
  publicClaimIds?: string[];
  /** Free-text provenance: who/what currently owns this concept's
   *  accuracy (a CLM task id, "CLM-009", a team name, ...). Optional —
   *  audit trail, not enforcement. */
  owner?: string;
  /**
   * Set ONLY for concepts CLM-009 deliberately did NOT repair or
   * migrate. Names the task id responsible for eventually reconciling
   * this concept's duplicated prose/examples/counts.
   *
   * A deferred concept is still fully registered — exactly one
   * canonical, real relation paths, existence-checked — but its
   * relations are excluded from CLM-009's own CONTENT enforcement
   * (formula-fingerprint scanning, generated-block drift checking).
   * `checkRegistryInvariants` enforces the inverse as a structural
   * guarantee: a deferred concept must not declare a `generated`
   * relation, since CLM-009 does not mechanically keep a deferred
   * concept in sync with anything.
   */
  deferredTo?: DeferredOwnerTaskId;
}

export function isDeferredConcept(concept: DocConcept): boolean {
  return concept.deferredTo != null;
}

export function deferredConcepts(
  concepts: readonly DocConcept[] = DOC_CONCEPTS,
): DocConcept[] {
  return concepts.filter(isDeferredConcept);
}

/* ────────────────────────────────────────────────────────────────
 * Concepts — CLM-009 "MIGRATE NOW" (A, B, C)
 * ──────────────────────────────────────────────────────────────── */

const MIGRATED_CONCEPTS: DocConcept[] = [
  {
    id: "ci-normalization-table",
    title: "Civica Index fixed-bound normalization transform table",
    owner: "CLM-009",
    canonical: {
      kind: "source",
      path: "src/lib/ci/normalize-v2.ts",
      symbol: "normalizationDescriptors",
    },
    relations: [
      {
        kind: "source",
        path: "src/lib/ci/normalization-table.ts",
        symbol: "getNormalizationTableRows",
        relationship: "interpolated",
        note: "Derives display rows (dimension/source labels, native-scale text, transform formula) from normalizationDescriptors() — never retypes a bound or formula constant.",
      },
      {
        kind: "reader-markdown",
        path: "content/methodology-civica-index.md",
        symbol: "normalization-table",
        relationship: "generated",
        note: "GEN:normalization-table marker block, regenerated by scripts/generate-ci-normalization-table.ts.",
      },
      {
        kind: "memory",
        path: ".claude/rules/memory-decisions.md",
        symbol: "2026-07-10 — Civica Index Beta/v2 is the canonical current method",
        relationship: "link-only",
        note: "Project-memory entry narrates 'fixed-bound normalization of four headline inputs' in prose; scan-exempt by design (memory is allowed to describe a formula without being held to the reader-surface duplication bar). Declared here for traceability only — never edited by CLM-009.",
      },
    ],
  },
  {
    id: "ci-pca-analysis",
    title: "Civica Index Phase 5.3 PCA weight-derivation run",
    owner: "CLM-009",
    canonical: {
      kind: "source",
      path: "analysis/phase-5-3",
      symbol:
        "phase-5-3 PCA run output bundle (results.json, eigenvalues.csv, loadings_pca.csv, loadings_factor.csv, correlations.csv)",
    },
    relations: [
      {
        kind: "source",
        path: "src/lib/ci/pca-analysis.generated.json",
        relationship: "generated",
        note: "scripts/generate-pca-analysis.ts parses the analysis-run bundle deterministically; --check byte-compares.",
      },
      {
        kind: "source",
        path: "src/lib/ci/pca-analysis.ts",
        symbol: "getPcaAnalysisSummary",
        relationship: "interpolated",
        note: "Pure wrapper (CLM-009 bounded-repair F1) computing display-rounded panelSize/pc1VarianceExplained/pc1LoadingRange/correlationRange from the generated snapshot only.",
      },
      {
        kind: "source",
        path: "src/lib/content/site-state.ts",
        symbol:
          "civicaIndex.pca.{panelSize,pc1VarianceExplained,pc1LoadingRange,correlationRange}",
        relationship: "interpolated",
        note: "Imports getPcaAnalysisSummary() rather than hardcoding the analysis-run numbers a second time (CLM-009 bounded-repair F1). lastRunDate/dataVintage are presentation-only labels, not recoverable from the snapshot, and remain manually maintained.",
      },
      {
        kind: "reader-tsx",
        path: "src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx",
        relationship: "interpolated",
        note: "Imports pca-analysis.generated.json directly; no inline numeric arrays.",
      },
      {
        kind: "reader-markdown",
        path: "content/methodology-pca-appendix.md",
        relationship: "link-only",
        note: "Prose narrates the panel/limitations/reproduction steps and references the CSV filenames; carries no duplicated numeric arrays or formulas.",
      },
      {
        kind: "readme",
        path: "README.template.md",
        relationship: "link-only",
        note: "Mentions 'PCA-derived weights, see /civica-index/methodology/pca-appendix' in prose only — no numeric value is retyped.",
      },
    ],
  },
  {
    id: "peer-grouping-default-min-n",
    title: "Peer-grouping minimum-n threshold",
    owner: "CLM-009",
    canonical: {
      kind: "source",
      path: "src/lib/peer-grouping/constants.ts",
      symbol: "DEFAULT_MIN_N",
    },
    relations: [
      {
        kind: "source",
        path: "src/lib/peer-grouping/index.ts",
        symbol: "DEFAULT_MIN_N",
        relationship: "interpolated",
        note: "Re-export for existing call sites; not a second definition.",
      },
      {
        kind: "source",
        path: "src/lib/content/site-state.ts",
        symbol: "peerGrouping.defaultMinN",
        relationship: "interpolated",
      },
      {
        kind: "reader-markdown",
        path: "content/methodology-peer-grouping.md",
        symbol: "minimum-n",
        relationship: "interpolated",
        note: "{{state.peerGrouping.defaultMinN}} runtime substitution marker, resolved by MarkdownContent at render time — not a generated block.",
      },
      {
        kind: "source",
        path: "src/lib/ci/__tests__/worked-examples.test.ts",
        relationship: "contract-test",
        note: "Imports DEFAULT_MIN_N from @/lib/peer-grouping and asserts against it. Kind is 'source' (test CODE), not 'runbook' — a runbook surface is an operational instruction/document, not code (corrected in CLM-009 bounded-repair F4). Scan-exempt regardless, since 'source' is outside SCANNABLE_KINDS.",
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────────
 * Concepts — DEFERRED (registered now, content NOT repaired by
 * CLM-009; owning task named via `deferredTo`)
 * ──────────────────────────────────────────────────────────────── */

const DEFERRED_CONCEPTS: DocConcept[] = [
  {
    id: "reconciliation.material-error",
    title: "Reconciliation material-error dispute thresholds",
    deferredTo: "CLM-011",
    canonical: {
      kind: "source",
      path: "src/lib/factbook/reconcile/fact-keys.ts",
      symbol: "materialErrorPpThreshold / materialErrorPctThreshold",
    },
    relations: [
      {
        kind: "reader-tsx",
        path: "src/app/(reader)/country/methodology/reconciliation/page.tsx",
        relationship: "link-only",
        note: "Prose narrates the material-error guard, including specific threshold values (e.g. the 50pp→300pp Argentina-inflation worked example). CLM-011 owns reconciling this prose against fact-keys.ts — not repaired by CLM-009.",
      },
      {
        kind: "reader-markdown",
        path: "content/methodology-reconciliation.md",
        relationship: "link-only",
        note: "Deferred markdown mirror (per AGENTS.md, gated on the <WorkedExample> primitive); also narrates material-error thresholds. Same CLM-011 ownership as the TSX page.",
      },
    ],
  },
  {
    id: "docs.schema-table-count",
    title: "Database schema table count cited in AGENTS.md",
    deferredTo: "CLM-011",
    canonical: {
      kind: "source",
      path: "src/lib/db/schema.ts",
      symbol: "pgTable declaration count",
    },
    relations: [
      {
        kind: "runbook",
        path: "AGENTS.md",
        symbol: "## Database",
        relationship: "link-only",
        note: "States a specific table count ('45 tables') in prose. CLM-011 owns verifying/reconciling this count against schema.ts — not repaired by CLM-009. Declaring this path is allowed; CLM-009 does not edit AGENTS.md.",
      },
    ],
  },
  {
    id: "api.v1-examples",
    title: "Public API v1 usage examples",
    deferredTo: "CLM-012",
    canonical: {
      kind: "api-example",
      path: "src/app/api-docs/page.tsx",
      symbol: "curl / fetch example CodeBlocks",
    },
    relations: [
      {
        kind: "reader-markdown",
        path: "content/methodology-civica-index.md",
        symbol: "citation",
        relationship: "link-only",
        note: "§13.1 'API access' lists the same GET endpoints in a plain fenced code block (not curl/fetch examples). CLM-012 owns unifying API examples across surfaces — not repaired by CLM-009.",
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────────
 * Concepts — "REGISTER AS ALREADY SATISFIED" (no migration performed)
 * ──────────────────────────────────────────────────────────────── */

const ALREADY_SATISFIED_CONCEPTS: DocConcept[] = [
  {
    id: "ci-v2-weights",
    title: "Civica Index v2 dimension weights",
    owner: "CLM-008",
    canonical: {
      kind: "source",
      path: "src/lib/ci/dimensions-v2.ts",
      symbol: "V2_WEIGHTS",
    },
    relations: [
      {
        kind: "source",
        path: "src/lib/content/site-state.ts",
        symbol: "civicaIndex.dimensions[].weight",
        relationship: "contract-test",
        note: "Independently authored display config; equality with V2_WEIGHTS is guarded by src/lib/ci/__tests__/worked-examples.test.ts §4 (CLM-008), not generated/imported at runtime.",
      },
      {
        kind: "reader-markdown",
        path: "content/methodology-civica-index.md",
        relationship: "link-only",
        note: "Prose describes the weight-derivation process; the numeric weights themselves render from state.civicaIndex.dimensions (TSX-owned weights-bar), not from markdown text.",
      },
    ],
    publicClaimIds: [],
  },
  {
    id: "pulse-runtime-contract",
    title: "Civica Pulse v2 runtime-method contract",
    owner: "CLM-007",
    canonical: {
      kind: "source",
      path: "src/lib/pulse/v2/runtime-method.generated.json",
    },
    relations: [
      {
        kind: "source",
        path: "scripts/generate-pulse-runtime-method.ts",
        relationship: "generated",
        note: "Pre-existing CLM-007 generator; --check byte-compares.",
      },
      {
        kind: "reader-markdown",
        path: "content/methodology-pulse.md",
        relationship: "interpolated",
        note: "{{state.*}}/{{ctx.*}} markers resolved from values sourced from the runtime contract, per CLM-007.",
      },
      {
        kind: "source",
        path: "scripts/validate-pulse-runtime-method.ts",
        relationship: "contract-test",
        note: "Pre-existing CLM-007 validator CODE. Kind is 'source', not 'runbook' — a runbook surface is an operational instruction/document, not code (corrected in CLM-009 bounded-repair F4).",
      },
    ],
  },
  {
    id: "claim-tier-taxonomy",
    title: "Public-claim evidence-tier taxonomy",
    owner: "CLM-001",
    canonical: {
      kind: "source",
      path: "src/lib/claims/claim-tiers.ts",
    },
    relations: [
      {
        kind: "source",
        path: "src/lib/claims/public-claims.ts",
        relationship: "interpolated",
        note: "Every PublicClaim.tier is typed against PublicClaimTierId; not owned/edited by CLM-009 (out of scope per binding contract §10).",
      },
    ],
  },
  {
    id: "neutral-score-presentation",
    title: "Neutral numeric score-position presentation (no letter grades)",
    owner: "CLM-005",
    canonical: {
      kind: "source",
      path: "src/components/editorial/ScorePosition.tsx",
    },
    relations: [
      {
        kind: "source",
        path: "src/lib/api/helpers.ts",
        symbol: "CI_METHODOLOGY_META.presentation",
        relationship: "contract-test",
        note: "presentation.format/categorical_grades asserted against ScorePosition's neutral-position posture by src/lib/ci/__tests__/worked-examples.test.ts §14 (CLM-005/CLM-008).",
      },
      {
        kind: "reader-markdown",
        path: "content/methodology-civica-index.md",
        relationship: "link-only",
      },
    ],
    publicClaimIds: ["home.reference-scope"],
  },
  {
    id: "atlas-first-positioning",
    title: "Atlas-first editorial positioning statement",
    owner: "CLM-003",
    canonical: {
      kind: "source",
      path: "src/app/page.tsx",
    },
    relations: [
      {
        kind: "reader-markdown",
        path: "content/about.md",
        relationship: "link-only",
      },
    ],
    publicClaimIds: ["home.reference-scope", "home.visible-positioning"],
  },
];

export const DOC_CONCEPTS: DocConcept[] = [
  ...MIGRATED_CONCEPTS,
  ...ALREADY_SATISFIED_CONCEPTS,
  ...DEFERRED_CONCEPTS,
];

/* ────────────────────────────────────────────────────────────────
 * Registry invariants (pure — callable from the validator AND tests)
 * ──────────────────────────────────────────────────────────────── */

export interface RegistryIssue {
  conceptId: string;
  message: string;
}

/**
 * Structural checks only (uniqueness, exactly-one-canonical shape).
 * Content checks (formula fingerprints, generated-block drift, route
 * resolution) live in `scripts/validate-doc-sources.ts`, which reads
 * the filesystem and is not appropriate for a pure unit-testable
 * function.
 */
export function checkRegistryInvariants(
  concepts: readonly DocConcept[] = DOC_CONCEPTS,
): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const seenIds = new Set<string>();
  const seenCanonical = new Set<string>();

  for (const concept of concepts) {
    if (seenIds.has(concept.id)) {
      issues.push({
        conceptId: concept.id,
        message: `Duplicate concept id "${concept.id}".`,
      });
    }
    seenIds.add(concept.id);

    if (Array.isArray(concept.canonical)) {
      issues.push({
        conceptId: concept.id,
        message: "canonical must be a single {kind,path,symbol?}, not an array.",
      });
      continue;
    }
    if (!concept.canonical.path) {
      issues.push({
        conceptId: concept.id,
        message: "canonical.path is required.",
      });
    }

    const canonicalKey = `${concept.canonical.kind}::${concept.canonical.path}::${concept.canonical.symbol ?? ""}`;
    if (seenCanonical.has(canonicalKey)) {
      issues.push({
        conceptId: concept.id,
        message: `Duplicate canonical path+symbol: ${canonicalKey}`,
      });
    }
    seenCanonical.add(canonicalKey);

    for (const relation of concept.relations) {
      if (!relation.path) {
        issues.push({
          conceptId: concept.id,
          message: "relation.path is required.",
        });
      }
      if (
        relation.kind === concept.canonical.kind &&
        relation.path === concept.canonical.path &&
        relation.symbol === concept.canonical.symbol
      ) {
        issues.push({
          conceptId: concept.id,
          message: "A relation must not duplicate the canonical location.",
        });
      }
      // A deferred concept is registered (visible, one canonical, real
      // paths) but its content is explicitly NOT CLM-009's to keep in
      // sync — so it must never declare a `generated` relation, which
      // would imply CLM-009 mechanically enforces it. This is the
      // structural proof that deferred rows are excluded from
      // CLM-009's own enforcement (CLM-009 bounded-repair B1).
      if (isDeferredConcept(concept) && relation.relationship === "generated") {
        issues.push({
          conceptId: concept.id,
          message: `A deferred concept (deferredTo="${concept.deferredTo}") must not declare a 'generated' relation — CLM-009 does not enforce deferred concepts.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Every mandated `DOC_SURFACE_KINDS` entry must appear at least once
 * across the registry (as a canonical OR a relation location) — proof
 * that the registry actually spans reader markdown, reader TSX,
 * README, API examples, runbooks, AND memory, not just the surfaces
 * that happened to be convenient (CLM-009 bounded-repair B1).
 */
export function checkSurfaceCoverage(
  concepts: readonly DocConcept[] = DOC_CONCEPTS,
): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const seenKinds = new Set<DocSurfaceKind>();

  for (const concept of concepts) {
    for (const location of [concept.canonical, ...concept.relations]) {
      if ((DOC_SURFACE_KINDS as readonly string[]).includes(location.kind)) {
        seenKinds.add(location.kind as DocSurfaceKind);
      }
    }
  }

  for (const kind of DOC_SURFACE_KINDS) {
    if (!seenKinds.has(kind)) {
      issues.push({
        conceptId: "*",
        message: `No registered location uses the mandated surface kind "${kind}".`,
      });
    }
  }

  return issues;
}

/**
 * Every `DocConcept.publicClaimIds` entry must be a real id in
 * `PUBLIC_CLAIMS`. Takes the known-id set as a parameter (rather than
 * importing `src/lib/claims/public-claims.ts` itself) so this file
 * stays free of any dependency on claim CONTENT — the caller
 * (`scripts/validate-doc-sources.ts`) extracts only `.id` strings
 * before calling this, per CLM-009 bounded-repair F4.
 */
export function checkPublicClaimIds(
  concepts: readonly DocConcept[],
  knownClaimIds: ReadonlySet<string>,
): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  for (const concept of concepts) {
    for (const claimId of concept.publicClaimIds ?? []) {
      if (!knownClaimIds.has(claimId)) {
        issues.push({
          conceptId: concept.id,
          message: `publicClaimIds references unknown claim id "${claimId}"`,
        });
      }
    }
  }
  return issues;
}
