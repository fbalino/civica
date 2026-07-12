/**
 * ATL-019 — stable entity identity & citation contract.
 *
 * Civica's atlas is provenance-first: a reader (or a downstream citation)
 * needs to be able to point at ONE fact row, institution, office, person,
 * election, constitution passage, organization, or indicator observation and
 * have that pointer keep resolving after the entity's DISPLAY content
 * changes — a country renames a ministry, a leader's name gets a diacritic
 * correction, an election gets a corrected headline, a metric definition's
 * label is edited. The identifier must survive all of that.
 *
 * The fix: every entity kind's `EntityCitation.id` is bound to a persistent
 * Postgres primary key (UUID) or content digest — NEVER to a mutable display
 * column (`name`, `election_name`, `heading_label`, `full_name`, …). Callers
 * resolve a citation at `GET /api/citations/{entityType}/{id}`
 * (`src/app/api/citations/[entityType]/[id]/route.ts`), which dispatches to
 * one resolver per kind under `src/lib/citations/resolvers/`.
 *
 * `constitution-passage` reuses the ALREADY-SHIPPED sha256 content-digest
 * identity from `src/lib/constitution/passage-index.ts` and its citation
 * endpoint at `/api/constitution/passages/[digest]` — this module does not
 * re-derive that identity scheme, only adapts it into the generic contract.
 *
 * `scripts/validate-stable-identifiers.ts` proves (statically, via Drizzle
 * schema introspection) that every backing table's identity column really is
 * a primary key / unique digest, and (with `--live`) that a real row of each
 * kind resolves to a citation carrying release/version/source metadata.
 */

import { z } from "zod";
import { absoluteUrl } from "@/lib/site";
import { RESEARCH_EVIDENCE_RETENTION_VERSION } from "@/lib/research/evidence-retention";

export const STABLE_ENTITY_CITATION_SCHEMA_VERSION =
  "stable-entity-citation/v1" as const;

/** The eight ATL-019 entity kinds, matching AGENTS.md's schema-table map:
 *  fact -> country_facts, institution -> government_bodies, office ->
 *  offices, person -> persons, election -> elections, constitution-passage
 *  -> constitution_passages (shipped), organization -> organizations,
 *  indicator -> country_metrics. */
export const ENTITY_TYPES = [
  "fact",
  "institution",
  "office",
  "person",
  "election",
  "constitution-passage",
  "organization",
  "indicator",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

const ENTITY_TYPE_SET: ReadonlySet<string> = new Set(ENTITY_TYPES);

export function isEntityType(value: string): value is EntityType {
  return ENTITY_TYPE_SET.has(value);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-entity-kind format for the `id` field / URL path segment. Every kind
 * but `constitution-passage` is the row's Postgres UUID primary key.
 * `constitution-passage` reuses the shipped `sha256:<hex>` digest form from
 * `/api/constitution/passages/[digest]` verbatim, so both endpoints resolve
 * the identical identifier — no second digest convention is invented here.
 */
export const ENTITY_ID_PATTERNS: Record<EntityType, RegExp> = {
  fact: UUID_PATTERN,
  institution: UUID_PATTERN,
  office: UUID_PATTERN,
  person: UUID_PATTERN,
  election: UUID_PATTERN,
  "constitution-passage": /^sha256:[a-f0-9]{64}$/,
  organization: UUID_PATTERN,
  indicator: UUID_PATTERN,
};

export function isValidEntityId(entityType: EntityType, id: string): boolean {
  return ENTITY_ID_PATTERNS[entityType].test(id);
}

/** Every entity kind resolves at this one endpoint shape. Building the URL
 *  here (rather than in each resolver) keeps the convention singular. */
export function buildCitationUrl(entityType: EntityType, id: string): string {
  return absoluteUrl(`/api/citations/${entityType}/${id}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Shared sub-shapes
// ─────────────────────────────────────────────────────────────────────────

export interface EntityCitationSource {
  sourceId: string | null;
  sourceName: string | null;
  licenseId: string | null;
  sourceUrl: string | null;
}

export const UNKNOWN_SOURCE: EntityCitationSource = {
  sourceId: null,
  sourceName: null,
  licenseId: null,
  sourceUrl: null,
};

/**
 * The "release/version" leg for institution/office/person/election
 * citations, sourced from the DAT-016 `research_evidence_history` append-only
 * trigger ledger (AGENTS.md "Research evidence retention";
 * `src/lib/research/evidence-retention.ts`). Those four tables carry no
 * first-class `source_id` column, so their citable "what changed and when"
 * comes from this trigger-captured revision trail rather than a source
 * vintage stamp. A row with no captured UPDATE/DELETE since migration 0024
 * honestly reports `hasRecordedRevisions: false` — that is NOT an error, it
 * means the row has never been revised (or predates the DAT-016 ledger).
 */
export interface EntityRevisionRelease {
  retentionContractVersion: typeof RESEARCH_EVIDENCE_RETENTION_VERSION;
  hasRecordedRevisions: boolean;
  revisionCount: number;
  lastRevisedAt: string | null;
  lastRevisionReason: string | null;
}

export function deriveRevisionRelease(
  historyRows: readonly { recordedAt: Date | string; reason: string }[],
): EntityRevisionRelease {
  if (historyRows.length === 0) {
    return {
      retentionContractVersion: RESEARCH_EVIDENCE_RETENTION_VERSION,
      hasRecordedRevisions: false,
      revisionCount: 0,
      lastRevisedAt: null,
      lastRevisionReason: null,
    };
  }
  const sorted = [...historyRows].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
  const [latest] = sorted;
  return {
    retentionContractVersion: RESEARCH_EVIDENCE_RETENTION_VERSION,
    hasRecordedRevisions: true,
    revisionCount: historyRows.length,
    lastRevisedAt: new Date(latest.recordedAt).toISOString(),
    lastRevisionReason: latest.reason,
  };
}

/**
 * `government_bodies`/`offices`/`persons`/`elections` carry no first-class
 * `source_id` FK. Their provenance is inferred, best-effort, from whichever
 * external identifier is populated — IPU Parline outranks Wikidata when both
 * are present because IPU is the authoritative legislature-composition
 * source. A row with neither identifier returns `null` ("source not
 * asserted") rather than guessing.
 */
export function deriveHeuristicSourceId(input: {
  ipuParlineId?: string | null;
  wikidataQid?: string | null;
}): "ipu_parline" | "wikidata" | null {
  if (input.ipuParlineId) return "ipu_parline";
  if (input.wikidataQid) return "wikidata";
  return null;
}

/** Vintage/release leg for `fact` and `indicator` citations, which DO carry
 *  a first-class `source_id` and vintage columns — no DAT-016 lookup needed
 *  for these two kinds. */
export interface EntityCitationVintage {
  asOf: string | null;
  upstreamVintageLabel: string | null;
  retrievedAt: string | null;
}

export interface EntityCitationBase {
  schemaVersion: typeof STABLE_ENTITY_CITATION_SCHEMA_VERSION;
  /** The persistent key — UUID primary key or content digest. Never a
   *  display name; stable across renames. */
  id: string;
  /** Human-readable label for display. Free to change across resolutions —
   *  it is NOT part of the identity. */
  label: string;
  /** Absolute URL to this exact citation record
   *  (`/api/citations/{entityType}/{id}`). */
  citationUrl: string;
  /** Best-effort human reader deep link, or `null` when no precise page
   *  exists for this entity kind. */
  readerUrl: string | null;
  source: EntityCitationSource;
  /** ISO timestamp this citation was resolved (NOT a data vintage). */
  resolvedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Per-entity-kind discriminated members
// ─────────────────────────────────────────────────────────────────────────

export interface FactCitation extends EntityCitationBase {
  entityType: "fact";
  jurisdictionSlug: string;
  jurisdictionName: string;
  /** Stable Civica fact-key (see `src/lib/factbook/reconcile/fact-keys.ts`)
   *  — a controlled slug, not a display name. */
  factKey: string;
  vintage: EntityCitationVintage;
}

export interface InstitutionCitation extends EntityCitationBase {
  entityType: "institution";
  jurisdictionSlug: string;
  jurisdictionName: string;
  bodyType: string;
  revision: EntityRevisionRelease;
}

export interface OfficeCitation extends EntityCitationBase {
  entityType: "office";
  jurisdictionSlug: string;
  jurisdictionName: string;
  officeType: string;
  revision: EntityRevisionRelease;
}

export interface PersonCitation extends EntityCitationBase {
  entityType: "person";
  revision: EntityRevisionRelease;
}

export interface ElectionCitation extends EntityCitationBase {
  entityType: "election";
  jurisdictionSlug: string;
  jurisdictionName: string;
  electionDate: string | null;
  revision: EntityRevisionRelease;
}

export interface ConstitutionPassageCitation extends EntityCitationBase {
  entityType: "constitution-passage";
  jurisdictionSlug: string;
  jurisdictionName: string;
  anchorId: string;
  current: boolean;
  supersededAt: string | null;
}

export interface OrganizationCitation extends EntityCitationBase {
  entityType: "organization";
  slug: string;
}

export interface IndicatorCitation extends EntityCitationBase {
  entityType: "indicator";
  jurisdictionSlug: string;
  jurisdictionName: string;
  metricId: string;
  year: number;
  vintage: EntityCitationVintage;
}

export type EntityCitation =
  | FactCitation
  | InstitutionCitation
  | OfficeCitation
  | PersonCitation
  | ElectionCitation
  | ConstitutionPassageCitation
  | OrganizationCitation
  | IndicatorCitation;

// ─────────────────────────────────────────────────────────────────────────
// Zod — strict runtime parse for the API route and tests
// ─────────────────────────────────────────────────────────────────────────

const zEntityCitationSource = z
  .object({
    sourceId: z.string().nullable(),
    sourceName: z.string().nullable(),
    licenseId: z.string().nullable(),
    sourceUrl: z.string().nullable(),
  })
  .strict();

const zEntityRevisionRelease = z
  .object({
    retentionContractVersion: z.literal(RESEARCH_EVIDENCE_RETENTION_VERSION),
    hasRecordedRevisions: z.boolean(),
    revisionCount: z.number().int().nonnegative(),
    lastRevisedAt: z.string().nullable(),
    lastRevisionReason: z.string().nullable(),
  })
  .strict();

const zEntityCitationVintage = z
  .object({
    asOf: z.string().nullable(),
    upstreamVintageLabel: z.string().nullable(),
    retrievedAt: z.string().nullable(),
  })
  .strict();

const zBase = {
  schemaVersion: z.literal(STABLE_ENTITY_CITATION_SCHEMA_VERSION),
  id: z.string().min(1),
  label: z.string().min(1),
  citationUrl: z.string().url(),
  readerUrl: z.string().url().nullable(),
  source: zEntityCitationSource,
  resolvedAt: z.string().min(1),
};

export const zFactCitation = z
  .object({
    ...zBase,
    entityType: z.literal("fact"),
    jurisdictionSlug: z.string().min(1),
    jurisdictionName: z.string().min(1),
    factKey: z.string().min(1),
    vintage: zEntityCitationVintage,
  })
  .strict();

export const zInstitutionCitation = z
  .object({
    ...zBase,
    entityType: z.literal("institution"),
    jurisdictionSlug: z.string().min(1),
    jurisdictionName: z.string().min(1),
    bodyType: z.string().min(1),
    revision: zEntityRevisionRelease,
  })
  .strict();

export const zOfficeCitation = z
  .object({
    ...zBase,
    entityType: z.literal("office"),
    jurisdictionSlug: z.string().min(1),
    jurisdictionName: z.string().min(1),
    officeType: z.string().min(1),
    revision: zEntityRevisionRelease,
  })
  .strict();

export const zPersonCitation = z
  .object({
    ...zBase,
    entityType: z.literal("person"),
    revision: zEntityRevisionRelease,
  })
  .strict();

export const zElectionCitation = z
  .object({
    ...zBase,
    entityType: z.literal("election"),
    jurisdictionSlug: z.string().min(1),
    jurisdictionName: z.string().min(1),
    electionDate: z.string().nullable(),
    revision: zEntityRevisionRelease,
  })
  .strict();

export const zConstitutionPassageCitation = z
  .object({
    ...zBase,
    entityType: z.literal("constitution-passage"),
    jurisdictionSlug: z.string().min(1),
    jurisdictionName: z.string().min(1),
    anchorId: z.string().min(1),
    current: z.boolean(),
    supersededAt: z.string().nullable(),
  })
  .strict();

export const zOrganizationCitation = z
  .object({
    ...zBase,
    entityType: z.literal("organization"),
    slug: z.string().min(1),
  })
  .strict();

export const zIndicatorCitation = z
  .object({
    ...zBase,
    entityType: z.literal("indicator"),
    jurisdictionSlug: z.string().min(1),
    jurisdictionName: z.string().min(1),
    metricId: z.string().min(1),
    year: z.number().int(),
    vintage: zEntityCitationVintage,
  })
  .strict();

export const zEntityCitation = z.discriminatedUnion("entityType", [
  zFactCitation,
  zInstitutionCitation,
  zOfficeCitation,
  zPersonCitation,
  zElectionCitation,
  zConstitutionPassageCitation,
  zOrganizationCitation,
  zIndicatorCitation,
]);

export function parseEntityCitation(value: unknown): EntityCitation {
  return zEntityCitation.parse(value) as EntityCitation;
}
