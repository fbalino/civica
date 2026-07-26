import { eq } from "drizzle-orm";
import {
  civicaConditionsCalculations,
  civicaConditionsComponents,
  civicaConditionsNormalizationParameters,
  civicaConditionsReferenceSets,
  civicaConditionsReleases,
  civicaConditionsScores,
} from "@/lib/db/schema";
import {
  createDeferredSourceFreshness,
  markSourcesSynced,
} from "@/lib/db/source-freshness";
import {
  conditionCalculationErrors,
  conditionCalculationKey,
  type ConditionScoreInput,
} from "./contract";
import {
  conditionsReferencePopulationSha256,
  conditionsReleaseErrors,
  conditionsReleaseManifestSha256,
  type ConditionsReleaseInput,
} from "./release";

type Db = typeof import("@/lib/db").db;
export type { ConditionScoreInput } from "./contract";

export async function writeConditionsRelease(
  db: Db,
  release: ConditionsReleaseInput,
  rows: ConditionScoreInput[],
  options: { dryRun?: boolean; markSynced?: typeof markSourcesSynced } = {},
) {
  const errors = conditionsReleaseErrors(release, rows);
  if (errors.length) throw new Error(`Invalid Conditions release: ${errors.join(", ")}`);
  const manifestSha256 = conditionsReleaseManifestSha256(release, rows);
  if (options.dryRun) {
    return writeConditionScores(db, rows, { ...options, dryRun: true });
  }
  return db.transaction(async (tx) => {
    const executor = tx as unknown as Db;
    const existing = await executor
      .select({ manifestSha256: civicaConditionsReleases.manifestSha256 })
      .from(civicaConditionsReleases)
      .where(eq(civicaConditionsReleases.id, release.releaseId))
      .limit(1);
    if (existing.length) {
      if (existing[0].manifestSha256 !== manifestSha256) {
        throw new Error(`Conditions release ${release.releaseId} already exists with a different manifest`);
      }
      return { proposed: rows.length, written: 0, calculationsWritten: 0, componentsWritten: 0 };
    }
    await executor.insert(civicaConditionsReleases).values({
      id: release.releaseId,
      methodologyVersion: release.methodologyVersion,
      manifestSha256,
    });
    for (const referenceSet of release.referenceSets) {
      await executor.insert(civicaConditionsReferenceSets).values({
        releaseId: release.releaseId,
        dimension: referenceSet.dimension,
        referencePeriod: referenceSet.referencePeriod,
        jurisdictionIds: [...referenceSet.jurisdictionIds].sort(),
        populationSha256: conditionsReferencePopulationSha256(referenceSet.jurisdictionIds),
        candidateCount: referenceSet.candidateCount,
        alignedCount: referenceSet.alignedCount,
        mixedYearRefusedCount: referenceSet.mixedYearRefusedCount,
        missingComponentCount: referenceSet.missingComponentCount,
        includedComponents: [...referenceSet.includedComponents],
        missingnessPolicy: referenceSet.missingnessPolicy,
      });
      for (const parameter of referenceSet.parameters) {
        await executor.insert(civicaConditionsNormalizationParameters).values({
        releaseId: release.releaseId,
        dimension: referenceSet.dimension,
        referencePeriod: referenceSet.referencePeriod,
        componentId: parameter.componentId,
        direction: parameter.direction,
        transformationId: parameter.transformationId,
        mean: parameter.mean,
        standardDeviation: parameter.standardDeviation,
        lowerBound: parameter.lowerBound,
        upperBound: parameter.upperBound,
        });
      }
    }
    const deferredFreshness = createDeferredSourceFreshness();
    const summary = await writeConditionScores(executor, rows, {
      ...options,
      markSynced: deferredFreshness.capture,
    });
    await deferredFreshness.flush({
      executor: tx,
      timestampSource: "database",
    });
    return summary;
  });
}

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
        releaseId: row.releaseId,
        jurisdictionId: row.jurisdictionId,
        dimension: row.dimension,
        methodologyVersion: row.methodologyVersion,
        alignmentPolicy: row.alignmentPolicy,
        alignmentStatus: row.alignmentStatus,
        referenceYear: row.referenceYear,
      }).onConflictDoUpdate({
        target: [civicaConditionsCalculations.calculationKey],
        set: {
          releaseId: row.releaseId,
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
        releaseId: row.releaseId,
        calculationKey: row.calculationKey,
      }).onConflictDoUpdate({
        target: [civicaConditionsScores.jurisdictionId, civicaConditionsScores.dimension, civicaConditionsScores.quarter, civicaConditionsScores.methodologyVersion, civicaConditionsScores.sourceId, civicaConditionsScores.indicatorId, civicaConditionsScores.releaseId],
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
          releaseId: row.releaseId,
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
