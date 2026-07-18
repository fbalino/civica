import {
  civicaConditionsCalculations,
  civicaConditionsComponents,
  civicaConditionsScores,
} from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import {
  conditionCalculationErrors,
  conditionCalculationKey,
  type ConditionScoreInput,
} from "./contract";

type Db = typeof import("@/lib/db").db;
export type { ConditionScoreInput } from "./contract";

export async function writeConditionScores(
  db: Db,
  rows: ConditionScoreInput[],
  options: { dryRun?: boolean; markSynced?: typeof markSourcesSynced } = {},
): Promise<{
  proposed: number;
  written: number;
  calculationsWritten: number;
  componentsWritten: number;
}> {
  if (rows.length === 0) throw new Error("Conditions input produced zero rows");
  const calculationKeys = new Set<string>();
  const scoreKeys = new Set<string>();
  for (const row of rows) {
    if (calculationKeys.has(row.calculationKey)) {
      throw new Error(`Duplicate Conditions calculation: ${row.calculationKey}`);
    }
    calculationKeys.add(row.calculationKey);
    const expectedCalculationKey = conditionCalculationKey(row);
    if (row.calculationKey !== expectedCalculationKey) {
      throw new Error(`Conditions calculation key does not match its inputs: ${row.calculationKey}`);
    }
    const errors = conditionCalculationErrors(row);
    if (errors.length) {
      throw new Error(
        `Invalid Conditions calculation ${row.calculationKey}: ${errors.join(", ")}`,
      );
    }
    if (row.normalizedScore !== null) {
      const scoreKey = `${row.jurisdictionId}:${row.dimension}:${row.quarter}:${row.methodologyVersion}:${row.sourceId}:${row.indicatorId}`;
      if (scoreKeys.has(scoreKey)) {
        throw new Error(`Duplicate Conditions score: ${scoreKey}`);
      }
      scoreKeys.add(scoreKey);
    }
  }

  if (!options.dryRun) {
    for (const row of rows) {
      await db.insert(civicaConditionsCalculations).values({
        calculationKey: row.calculationKey,
        jurisdictionId: row.jurisdictionId,
        dimension: row.dimension,
        methodologyVersion: row.methodologyVersion,
        alignmentPolicy: row.alignmentPolicy,
        alignmentStatus: row.alignmentStatus,
        referenceYear: row.referenceYear,
      }).onConflictDoUpdate({
        target: [civicaConditionsCalculations.calculationKey],
        set: {
          alignmentPolicy: row.alignmentPolicy,
          alignmentStatus: row.alignmentStatus,
          referenceYear: row.referenceYear,
        },
      });
      for (const component of row.components) {
        await db.insert(civicaConditionsComponents).values({
          calculationKey: row.calculationKey,
          componentId: component.componentId,
          nativeValue: component.nativeValue,
          nativeUnit: component.nativeUnit,
          referenceYear: component.referenceYear,
          valueStatus: component.valueStatus,
          valueStatusReason: component.valueStatusReason,
          inclusionDecision: component.inclusionDecision,
          sourceId: component.sourceId,
          indicatorId: component.indicatorId,
          upstreamRelease: component.upstreamRelease,
          artifactHash: component.artifactHash,
          artifactKind: component.artifactKind,
          temporalCoverage: component.temporalCoverage,
          licenseUrl: component.licenseUrl,
          transformationId: component.transformationId,
          substitutionReason: component.substitutionReason,
          methodVersion: component.methodVersion,
        }).onConflictDoUpdate({
          target: [
            civicaConditionsComponents.calculationKey,
            civicaConditionsComponents.componentId,
          ],
          set: {
            nativeValue: component.nativeValue,
            nativeUnit: component.nativeUnit,
            referenceYear: component.referenceYear,
            valueStatus: component.valueStatus,
            valueStatusReason: component.valueStatusReason,
            inclusionDecision: component.inclusionDecision,
            sourceId: component.sourceId,
            indicatorId: component.indicatorId,
            upstreamRelease: component.upstreamRelease,
            artifactHash: component.artifactHash,
            artifactKind: component.artifactKind,
            temporalCoverage: component.temporalCoverage,
            licenseUrl: component.licenseUrl,
            transformationId: component.transformationId,
            substitutionReason: component.substitutionReason,
            methodVersion: component.methodVersion,
          },
        });
      }
      if (
        row.normalizedScore === null ||
        row.rawValue === null ||
        row.quarter === null ||
        row.datasetYear === null
      ) {
        continue;
      }
      await db.insert(civicaConditionsScores).values({
        jurisdictionId: row.jurisdictionId,
        dimension: row.dimension,
        quarter: row.quarter,
        normalizedScore: row.normalizedScore,
        rawValue: row.rawValue,
        sourceId: row.sourceId,
        indicatorId: row.indicatorId,
        upstreamRelease: row.upstreamRelease,
        artifactHash: row.artifactHash,
        artifactKind: row.artifactKind,
        temporalCoverage: row.temporalCoverage,
        licenseUrl: row.licenseUrl,
        transformationId: row.transformationId,
        substitutionReason: row.substitutionReason,
        methodVersion: row.methodVersion,
        datasetYear: row.datasetYear,
        methodologyVersion: row.methodologyVersion,
        calculationKey: row.calculationKey,
      }).onConflictDoUpdate({
        target: [civicaConditionsScores.jurisdictionId, civicaConditionsScores.dimension, civicaConditionsScores.quarter, civicaConditionsScores.methodologyVersion, civicaConditionsScores.sourceId, civicaConditionsScores.indicatorId],
        set: {
          normalizedScore: row.normalizedScore,
          rawValue: row.rawValue,
          upstreamRelease: row.upstreamRelease,
          artifactHash: row.artifactHash,
          artifactKind: row.artifactKind,
          temporalCoverage: row.temporalCoverage,
          licenseUrl: row.licenseUrl,
          transformationId: row.transformationId,
          substitutionReason: row.substitutionReason,
          methodVersion: row.methodVersion,
          datasetYear: row.datasetYear,
          calculationKey: row.calculationKey,
        },
      });
    }
  }

  const bySource = new Map<string, number>();
  for (const row of rows) {
    for (const component of row.components) {
      bySource.set(component.sourceId, (bySource.get(component.sourceId) ?? 0) + 1);
    }
  }
  for (const [sourceId, count] of bySource) {
    await (options.markSynced ?? markSourcesSynced)(sourceId, { rowsWritten: count, dryRun: options.dryRun });
  }
  return {
    proposed: rows.length,
    written: options.dryRun
      ? 0
      : rows.filter((row) => row.normalizedScore !== null).length,
    calculationsWritten: options.dryRun ? 0 : rows.length,
    componentsWritten: options.dryRun
      ? 0
      : rows.reduce((count, row) => count + row.components.length, 0),
  };
}
