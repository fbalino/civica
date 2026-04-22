import { sql } from "drizzle-orm";
import {
  buildGovernmentClassification,
  DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
  getGovernmentTaxonomyColor,
  getGovernmentTaxonomyGroupingKey,
  getGovernmentTaxonomyGroupingLabel,
  REGIME_TYPE_META,
  STRUCTURAL_FAMILY_META,
  type GovernmentClassification,
  type GovernmentTaxonomyLens,
} from "@/lib/government-taxonomy";
import { db } from "./index";
import { governmentTaxonomies } from "./schema";

export interface JurisdictionTaxonomyInput {
  id: string;
  slug?: string | null;
  iso3?: string | null;
  governmentType?: string | null;
  governmentTypeDetail?: string | null;
}

export interface TaxonomyGroupingMeta {
  key: string;
  label: string;
  colorVar: string;
  fallback: string;
  order: number;
}

export async function getGovernmentTaxonomyRowsByJurisdictionIds(
  jurisdictionIds: string[],
  taxonomyVersion = DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
) {
  if (jurisdictionIds.length === 0) {
    return new Map<
      string,
      typeof governmentTaxonomies.$inferSelect
    >();
  }

  const rows = await db
    .select()
    .from(governmentTaxonomies)
    .where(
      sql`${governmentTaxonomies.taxonomyVersion} = ${taxonomyVersion}
        AND ${governmentTaxonomies.jurisdictionId} IN ${jurisdictionIds}`,
    );

  return new Map(rows.map((row) => [row.jurisdictionId, row]));
}

export async function buildGovernmentClassificationMap(
  rows: JurisdictionTaxonomyInput[],
  taxonomyVersion = DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
) {
  const taxonomyRows = await getGovernmentTaxonomyRowsByJurisdictionIds(
    rows.map((row) => row.id),
    taxonomyVersion,
  );

  return new Map<string, GovernmentClassification>(
    rows.map((row) => [
      row.id,
      buildGovernmentClassification(
        {
          slug: row.slug ?? null,
          iso3: row.iso3 ?? null,
          governmentType: row.governmentType ?? null,
          governmentTypeDetail: row.governmentTypeDetail ?? null,
        },
        (() => {
          const taxonomyRow = taxonomyRows.get(row.id);
          if (!taxonomyRow) return null;
          return {
            ...taxonomyRow,
            provenance:
              (taxonomyRow.provenance as Record<string, unknown> | null | undefined) ??
              null,
          };
        })(),
      ),
    ]),
  );
}

export function withGovernmentClassification<
  T extends JurisdictionTaxonomyInput,
>(rows: T[], classificationMap: Map<string, GovernmentClassification>) {
  return rows.map((row) => ({
    ...row,
    governmentClassification:
      classificationMap.get(row.id) ??
      buildGovernmentClassification({
        slug: row.slug ?? null,
        iso3: row.iso3 ?? null,
        governmentType: row.governmentType ?? null,
        governmentTypeDetail: row.governmentTypeDetail ?? null,
      }),
  }));
}

export function getTaxonomyGroupingMeta(
  classification: GovernmentClassification,
  lens: GovernmentTaxonomyLens,
): TaxonomyGroupingMeta {
  const color = getGovernmentTaxonomyColor(classification, lens);
  const key = getGovernmentTaxonomyGroupingKey(classification, lens);
  const label = getGovernmentTaxonomyGroupingLabel(classification, lens);
  const order =
    lens === "regime" && classification.regimeType
      ? REGIME_TYPE_META[classification.regimeType].order
      : lens === "structural" && classification.structuralFamily
        ? STRUCTURAL_FAMILY_META[classification.structuralFamily].order
        : 999;

  return {
    key,
    label,
    colorVar: color.colorVar,
    fallback: color.fallback,
    order,
  };
}
