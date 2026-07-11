/**
 * CLM-012 — pure response-shape (projection) functions, one per
 * `/api/v1/*` route plus the bulk export route.
 *
 * Each function takes already-fetched data (no DB/network access — see
 * "DB-free" in AGENTS.md's testing discipline) and returns the exact
 * JSON envelope the route serves, typed as `z.infer<typeof someSchema>`
 * from `contract/schemas.ts`. Returning an object literal in that
 * position makes TypeScript's excess-property and missing-property
 * checks fire at every edit site — this is the "mechanical" binding
 * between handlers and the contract the CLM-012 architecture calls for.
 *
 * Route handlers (`src/app/api/**\/route.ts`) call these functions
 * instead of building the response object inline; behavior is
 * unchanged. `contract/examples.ts` and `contract/__tests__/*.test.ts`
 * call the same functions with deterministic fixtures and `.strict()`-
 * parse the result, so excess/missing fields fail at test time too.
 */

import {
  zCountryListItem,
  zCountryDetail,
  zCountriesListMeta,
  zCountryDetailMeta,
  zGovernmentTypesItem,
  zGovernmentTypesResponse,
  zIndexCountryData,
  zIndexHistoryItem,
  zIndexByGovernmentTypeItem,
  zIndexCompareResult,
  zIndexMethodologyData,
  zIndexRankingsItem,
  zIndexRankingsMeta,
  zPeerGroupingsData,
  zPulseDimensionsData,
  zPulseEventsData,
  zPulseChangelogRow,
  zCountryExportJson,
  type GovernmentClassificationShape,
} from "./schemas";
import type { z } from "zod";
import {
  STRUCTURAL_FAMILY_DEPRECATION_META,
} from "@/lib/api/deprecation";
import { CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { FACTBOOK_RECONCILIATION_META } from "@/lib/factbook/reconcile/api";
import type { AtlasSelectionMetadata } from "@/lib/factbook/read-selection";

/* ────────────────────────────────────────────────────────────────
 * /api/v1/countries
 * ──────────────────────────────────────────────────────────────── */

export function shapeCountryListItem(input: {
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  continent: string | null;
  capital: string | null;
  population: number | null;
  governmentType: string | null;
  governmentTypeDetail: string | null;
  gdpBillions: number | null;
  areaSqKm: number | null;
  flagUrl: string | null;
  governmentClassification: GovernmentClassificationShape | null;
}): z.infer<typeof zCountryListItem> {
  return zCountryListItem.parse(input);
}

export function shapeCountriesListMeta(input: {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  taxonomy: string;
  selection: AtlasSelectionMetadata;
}): z.infer<typeof zCountriesListMeta> {
  return zCountriesListMeta.parse({
    ...input,
    ...STRUCTURAL_FAMILY_DEPRECATION_META,
  });
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/countries/[code]
 * ──────────────────────────────────────────────────────────────── */

export function shapeCountryDetail(
  input: z.infer<typeof zCountryDetail>,
): z.infer<typeof zCountryDetail> {
  return zCountryDetail.parse(input);
}

export function shapeCountryDetailMeta(selection: AtlasSelectionMetadata): z.infer<typeof zCountryDetailMeta> {
  return zCountryDetailMeta.parse({
    reconciliation: {
      status: FACTBOOK_RECONCILIATION_META.status,
      version: FACTBOOK_RECONCILIATION_META.version,
      reference: FACTBOOK_RECONCILIATION_META.reference,
      ...selection,
    },
    methodology: CI_METHODOLOGY_META,
    ...STRUCTURAL_FAMILY_DEPRECATION_META,
  });
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/government-types (deprecated)
 * ──────────────────────────────────────────────────────────────── */

export function shapeGovernmentTypesItem(input: {
  governmentType: string;
  structuralFamily: z.infer<typeof zGovernmentTypesItem>["structuralFamily"];
  count: number;
  topExamples: string[];
}): z.infer<typeof zGovernmentTypesItem> {
  return zGovernmentTypesItem.parse(input);
}

export function shapeGovernmentTypesMeta(
  total: number,
): z.infer<typeof zGovernmentTypesResponse>["meta"] {
  return zGovernmentTypesResponse.shape.meta.parse({
    total,
    ...STRUCTURAL_FAMILY_DEPRECATION_META,
  });
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/[country_slug]
 * ──────────────────────────────────────────────────────────────── */

export function shapeIndexCountryData(
  input: z.infer<typeof zIndexCountryData>,
): z.infer<typeof zIndexCountryData> {
  return zIndexCountryData.parse(input);
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/[country_slug]/history
 * ──────────────────────────────────────────────────────────────── */

export function shapeIndexHistoryItem(input: {
  quarter: string;
  score: number;
  rank: number | null;
  totalRanked: number | null;
  isPartial: boolean;
}): z.infer<typeof zIndexHistoryItem> {
  return zIndexHistoryItem.parse(input);
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/by-government-type
 * ──────────────────────────────────────────────────────────────── */

export function shapeIndexByGovernmentTypeItem(input: {
  key: string;
  governmentType: string;
  count: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  medianScore: number;
  q1: number;
  q3: number;
}): z.infer<typeof zIndexByGovernmentTypeItem> {
  return zIndexByGovernmentTypeItem.parse(input);
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/compare
 * ──────────────────────────────────────────────────────────────── */

export function shapeIndexCompareResult(
  input: z.infer<typeof zIndexCompareResult>,
): z.infer<typeof zIndexCompareResult> {
  return zIndexCompareResult.parse(input);
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/methodology
 * ──────────────────────────────────────────────────────────────── */

export function shapeIndexMethodologyData(input: {
  id: string;
  publishedAt: Date | string;
  weights: unknown;
  notes: string | null;
  createdAt: Date | string | null;
}): z.infer<typeof zIndexMethodologyData> {
  return zIndexMethodologyData.parse({
    id: input.id,
    publishedAt:
      input.publishedAt instanceof Date
        ? input.publishedAt.toISOString()
        : input.publishedAt,
    weights: input.weights as Record<string, unknown>,
    notes: input.notes,
    createdAt:
      input.createdAt instanceof Date
        ? input.createdAt.toISOString()
        : input.createdAt,
  });
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/index/rankings
 * ──────────────────────────────────────────────────────────────── */

export function shapeIndexRankingsItem(
  input: z.infer<typeof zIndexRankingsItem>,
): z.infer<typeof zIndexRankingsItem> {
  return zIndexRankingsItem.parse(input);
}

export function shapeIndexRankingsMeta(input: {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  quarter: string | null;
  taxonomy: string;
}): z.infer<typeof zIndexRankingsMeta> {
  return zIndexRankingsMeta.parse({
    ...input,
    methodology: CI_METHODOLOGY_META,
    ...STRUCTURAL_FAMILY_DEPRECATION_META,
  });
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/peer-groupings
 * ──────────────────────────────────────────────────────────────── */

export function shapePeerGroupingsData(
  input: z.infer<typeof zPeerGroupingsData>,
): z.infer<typeof zPeerGroupingsData> {
  return zPeerGroupingsData.parse(input);
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/[country_slug]/dimensions
 *
 * Dedupes `contributingEventIds` per dimension (CLM-012 fix): the
 * stored `pulse_dimensional_deltas.contributing_event_ids` column is
 * populated by `src/lib/pulse/v2/score.ts`'s per-bucket accumulator,
 * which can push the same event id more than once if that event's
 * decayed impact is recomputed within the same scoring pass. The
 * public API must never emit duplicate ids regardless of upstream
 * data hygiene, so dedupe at the read seam rather than trusting the
 * stored array verbatim.
 * ──────────────────────────────────────────────────────────────── */

export function shapePulseDimensionsData(
  input: z.infer<typeof zPulseDimensionsData>,
): z.infer<typeof zPulseDimensionsData> {
  return zPulseDimensionsData.parse({
    ...input,
    dimensions: Object.fromEntries(
      Object.entries(input.dimensions).map(([dim, row]) => [
        dim,
        { ...row, contributingEventIds: Array.from(new Set(row.contributingEventIds)) },
      ]),
    ),
  });
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/[country_slug]/events
 * ──────────────────────────────────────────────────────────────── */

export function shapePulseEventsData(
  input: z.infer<typeof zPulseEventsData>,
): z.infer<typeof zPulseEventsData> {
  return zPulseEventsData.parse(input);
}

/* ────────────────────────────────────────────────────────────────
 * /api/v1/pulse/changelog/v2
 * ──────────────────────────────────────────────────────────────── */

export function shapePulseChangelogRow(
  input: z.infer<typeof zPulseChangelogRow>,
): z.infer<typeof zPulseChangelogRow> {
  return zPulseChangelogRow.parse(input);
}

/* ────────────────────────────────────────────────────────────────
 * /api/countries/[slug]/export (non-/v1 bulk export, JSON branch)
 * ──────────────────────────────────────────────────────────────── */

export function shapeCountryExportJson(
  input: z.infer<typeof zCountryExportJson>,
): z.infer<typeof zCountryExportJson> {
  return zCountryExportJson.parse(input);
}
