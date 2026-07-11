import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { countryFactVintages } from "@/lib/db/schema";
import { getFactKey } from "@/lib/factbook/reconcile/fact-keys";
import type { FactRow, ResolverOutput } from "@/lib/factbook/reconcile/types";

export type AtlasReadSelection =
  | { mode: "live"; asOf: "live" }
  | { mode: "vintage"; asOf: string };

export function parseAtlasReadSelection(value: string | null):
  | { selection: AtlasReadSelection; error: null }
  | { selection: null; error: string } {
  const normalized = value?.trim();
  if (!normalized) return { selection: null, error: "as_of is required; use as_of=live or an immutable vintage label" };
  if (normalized === "live") return { selection: { mode: "live", asOf: "live" }, error: null };
  if (!/^Civica Atlas Reconciled v[^\s]+ — vintage \d{4}-Q[1-4]$/.test(normalized)) {
    return { selection: null, error: "as_of must be live or a complete Civica Atlas immutable vintage label" };
  }
  return { selection: { mode: "vintage", asOf: normalized }, error: null };
}

export interface AtlasSelectionMetadata {
  mode: "live" | "vintage";
  asOf: string;
  vintage: string | null;
  cutoffAt: string | null;
  retrievedThrough: string | null;
  methodologyVersions: string[];
}

export async function immutableVintageExists(vintageLabel: string): Promise<boolean> {
  const rows = await db.select({ id: countryFactVintages.id }).from(countryFactVintages).where(eq(countryFactVintages.vintageLabel, vintageLabel)).limit(1);
  return rows.length > 0;
}

export async function getImmutableVintageMetadata(vintageLabel: string): Promise<{ cutoffAt: string | null; retrievedThrough: string | null; methodologyVersions: string[] }> {
  const rows = await db.select({ cutoffAt: countryFactVintages.cutAtTimestamp, sourceRetrievedAt: countryFactVintages.sourceRetrievedAt, methodologyVersion: countryFactVintages.methodologyVersion }).from(countryFactVintages).where(eq(countryFactVintages.vintageLabel, vintageLabel));
  const cutoffs = [...new Set(rows.map((row) => row.cutoffAt?.toISOString()).filter((value): value is string => Boolean(value)))];
  const retrieved = rows.map((row) => row.sourceRetrievedAt?.toISOString()).filter((value): value is string => Boolean(value)).sort();
  return { cutoffAt: cutoffs.length === 1 ? cutoffs[0] : null, retrievedThrough: retrieved.at(-1) ?? null, methodologyVersions: [...new Set(rows.map((row) => row.methodologyVersion))].sort() };
}

export async function getFrozenDisplayFactsForJurisdictions(
  jurisdictionIds: string[],
  factKeys: string[],
  vintageLabel: string,
): Promise<Map<string, Map<string, { text: string | null; numeric: number | null }>>> {
  const output = new Map<string, Map<string, { text: string | null; numeric: number | null }>>();
  if (!jurisdictionIds.length || !factKeys.length) return output;
  const rows = await db.select({
    jurisdictionId: countryFactVintages.jurisdictionId,
    factKey: countryFactVintages.factKey,
    text: countryFactVintages.valueText,
    numeric: countryFactVintages.valueNumeric,
  }).from(countryFactVintages).where(and(
    inArray(countryFactVintages.jurisdictionId, jurisdictionIds),
    inArray(countryFactVintages.factKey, factKeys),
    eq(countryFactVintages.vintageLabel, vintageLabel),
  ));
  for (const row of rows) {
    const facts = output.get(row.jurisdictionId) ?? new Map();
    facts.set(row.factKey, { text: row.text, numeric: row.numeric == null ? null : Number(row.numeric) });
    output.set(row.jurisdictionId, facts);
  }
  return output;
}

export function metadataFromResolutions(
  selection: AtlasReadSelection,
  resolutions: Record<string, ResolverOutput>,
  frozen?: { cutoffAt: string | null; retrievedThrough?: string | null; methodologyVersions: string[] },
): AtlasSelectionMetadata {
  if (selection.mode === "vintage") {
    return {
      mode: "vintage",
      asOf: selection.asOf,
      vintage: selection.asOf,
      cutoffAt: frozen?.cutoffAt ?? null,
      retrievedThrough: frozen?.retrievedThrough ?? null,
      methodologyVersions: [...new Set(frozen?.methodologyVersions ?? [])].sort(),
    };
  }
  const rows = Object.values(resolutions).flatMap((resolution) => resolution.all);
  const retrieved = rows.map((row) => row.retrievedAt).filter(Boolean).sort();
  return {
    mode: "live",
    asOf: "live",
    vintage: null,
    cutoffAt: null,
    retrievedThrough: retrieved.at(-1) ?? null,
    methodologyVersions: [...new Set(rows.map((row) => row.methodologyVersion))].sort(),
  };
}

export async function getFrozenFactsForJurisdiction(
  jurisdictionId: string,
  factKeys: string[],
  vintageLabel: string,
): Promise<{
  exists: boolean;
  resolutions: Record<string, ResolverOutput>;
  cutoffAt: string | null;
  retrievedThrough: string | null;
  methodologyVersions: string[];
}> {
  const [labelRows, rows] = await Promise.all([
    db.select({ id: countryFactVintages.id }).from(countryFactVintages).where(eq(countryFactVintages.vintageLabel, vintageLabel)).limit(1),
    db.select().from(countryFactVintages).where(and(
          eq(countryFactVintages.jurisdictionId, jurisdictionId),
          eq(countryFactVintages.vintageLabel, vintageLabel),
          ...(factKeys.length ? [inArray(countryFactVintages.factKey, factKeys)] : []),
        )),
  ]);
  const resolutions: Record<string, ResolverOutput> = {};
  for (const row of rows) {
    const definition = getFactKey(row.factKey);
    if (!definition) continue;
    const retrievedAt = (row.sourceRetrievedAt ?? row.snapshotAt).toISOString();
    const fact: FactRow = {
      id: row.id,
      jurisdictionId: row.jurisdictionId,
      factKey: row.factKey,
      factGroup: definition.group,
      category: definition.category,
      sourceId: row.sourceId,
      sourceUrl: null,
      wikidataQid: null,
      wikidataPid: null,
      wikidataRank: null,
      references: null,
      factValue: row.valueText,
      factValueNumeric: row.valueNumeric == null ? null : Number(row.valueNumeric),
      factUnit: row.valueUnit,
      factYear: row.observationReferenceYear,
      valueJson: row.valueJson,
      valueStatus: "observed",
      valueStatusReason: null,
      asOf: row.asOf,
      dataVintageYear: row.observationReferenceYear,
      retrievedAt,
      upstreamVintageLabel: row.upstreamDatasetRelease,
      methodologyVersion: row.methodologyVersion,
      status: "active",
      statusReason: null,
      sourceNote: `Frozen selection ${row.vintageLabel}`,
      valueType: "measured",
      growthMethodology: null,
    };
    resolutions[row.factKey] = {
      jurisdictionId,
      factKey: row.factKey,
      canonical: fact,
      alternates: [fact],
      all: [fact],
      isDisputed: row.isDisputedAtCut ?? false,
      decisionReason: "single_source",
      decisionTrace: [{ code: "canonical_selection", outcome: "frozen_at_cut", detail: `Selected from immutable vintage ${row.vintageLabel}.`, sourceIds: [row.sourceId] }],
      proposedDisputes: [],
      canonicalIsProjection: false,
    };
  }
  const cutoffs = [...new Set(rows.map((row) => row.cutAtTimestamp?.toISOString()).filter((value): value is string => Boolean(value)))];
  const retrieved = rows.map((row) => row.sourceRetrievedAt?.toISOString()).filter((value): value is string => Boolean(value)).sort();
  return {
    exists: labelRows.length > 0,
    resolutions,
    cutoffAt: cutoffs.length === 1 ? cutoffs[0] : null,
    retrievedThrough: retrieved.at(-1) ?? null,
    methodologyVersions: [...new Set(rows.map((row) => row.methodologyVersion))].sort(),
  };
}
