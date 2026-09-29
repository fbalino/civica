/**
 * Country publisher measures — the database read (CLM-020,
 * publisher-attribution/v1).
 *
 * Reads the two publisher figures held in the frozen Civica Index release
 * (V-Dem's `v2x_libdem` value and Freedom House's political rights plus civil
 * liberties sum) and shapes them through the pure contract in
 * `src/lib/ci/publisher-scores.ts`, which owns the attribution rule, Freedom
 * House's status rule, and the four clocks.
 *
 * Attribution rule: this module never displays the release's normalized
 * column (a Civica rescale) and computes no rank, trend, or composite. The
 * release-row projection selects that column only because the release
 * identity type requires it.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ciDimensionScores, jurisdictions } from "@/lib/db/schema";
import { CURRENT_CI_RELEASE_ID } from "@/lib/ci/current-release";
import {
  shapeFreedomHouseScoreRow,
  shapeVdemScoreRow,
  type ScoreRow,
} from "@/lib/ci/publisher-scores";
import {
  isCiReleaseConsistencyError,
  resolveCiRelease,
  selectCiReleaseDimensionRows,
} from "@/lib/ci/release-selection";
import { loadPublishedCiRelease } from "@/lib/ci/release-store";

// ---- Frozen Index-release coordinates -------------------------------------

const CI_RELEASE = resolveCiRelease(CURRENT_CI_RELEASE_ID);

/** Resolve a slug or id (tolerates both) into a jurisdictionId. The
 *  page already has the id but the public surfaces accept slugs, so
 *  we accept either. */
async function resolveJurisdiction(
  slugOrId: string,
): Promise<{ id: string; slug: string; iso3: string | null } | null> {
  // UUID heuristic — if the input parses as 8-4-4-4-12 hex, treat as id.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    slugOrId,
  );
  const rows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(
      isUuid
        ? eq(jurisdictions.id, slugOrId)
        : eq(jurisdictions.slug, slugOrId),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function softFailOptionalScore(
  promise: Promise<ScoreRow | null>,
): Promise<ScoreRow | null> {
  try {
    return await promise;
  } catch (error) {
    if (isCiReleaseConsistencyError(error)) throw error;
    return null;
  }
}

/**
 * The publisher's raw figure for one release row. V-Dem and Freedom House are
 * read on separate paths: a jurisdiction whose democratic-quality row uses the
 * disclosed WGI fallback (for example Monaco) has no V-Dem row, and its WGI
 * value is never labelled V-Dem.
 */
async function fetchReleaseRawValue(
  jId: string,
  dimension: "democratic_quality" | "freedom_rights",
  sourceId: "vdem" | "freedom_house",
): Promise<number | null> {
  const rows = await db
    .select({
      releaseId: ciDimensionScores.releaseId,
      jurisdictionId: ciDimensionScores.jurisdictionId,
      dimension: ciDimensionScores.dimension,
      quarter: ciDimensionScores.quarter,
      rawValue: ciDimensionScores.rawValue,
      normalizedScore: ciDimensionScores.normalizedScore,
      sourceId: ciDimensionScores.sourceId,
      indicatorId: ciDimensionScores.indicatorId,
      methodologyVersion: ciDimensionScores.methodologyVersion,
      transformationId: ciDimensionScores.transformationId,
      methodVersion: ciDimensionScores.methodVersion,
      artifactHash: ciDimensionScores.artifactHash,
      upstreamRelease: ciDimensionScores.upstreamRelease,
      artifactKind: ciDimensionScores.artifactKind,
      temporalCoverage: ciDimensionScores.temporalCoverage,
      licenseUrl: ciDimensionScores.licenseUrl,
      substitutionReason: ciDimensionScores.substitutionReason,
      derivationVersionKey: ciDimensionScores.derivationVersionKey,
      derivationVersions: ciDimensionScores.derivationVersions,
    })
    .from(ciDimensionScores)
    .where(
      and(
        eq(ciDimensionScores.jurisdictionId, jId),
        eq(ciDimensionScores.dimension, dimension),
        eq(ciDimensionScores.sourceId, sourceId),
        eq(ciDimensionScores.methodologyVersion, CI_RELEASE.methodologyVersion),
        eq(ciDimensionScores.quarter, CI_RELEASE.quarter),
        eq(ciDimensionScores.releaseId, CI_RELEASE.releaseId),
      ),
    );
  const [row] = selectCiReleaseDimensionRows(rows, CI_RELEASE.releaseId);
  return row?.rawValue == null ? null : Number(row.rawValue);
}

// ---- Public entry point ----------------------------------------------------

export async function getScoresForJurisdiction(
  jurisdictionIdOrSlug: string,
): Promise<ScoreRow[]> {
  const jur = await resolveJurisdiction(jurisdictionIdOrSlug);
  if (!jur) return [];

  // Both rows come from one closed Index release. Validate that release
  // header and its public pointer before returning any row. The retired
  // Civica composite itself is deliberately absent from this query.
  await loadPublishedCiRelease(CURRENT_CI_RELEASE_ID);

  const [vdem, freedomHouse] = await Promise.all([
    softFailOptionalScore(
      fetchReleaseRawValue(jur.id, "democratic_quality", "vdem").then((raw) =>
        raw == null ? null : shapeVdemScoreRow(raw),
      ),
    ),
    softFailOptionalScore(
      fetchReleaseRawValue(jur.id, "freedom_rights", "freedom_house").then(
        (raw) => (raw == null ? null : shapeFreedomHouseScoreRow(raw)),
      ),
    ),
  ]);
  return [vdem, freedomHouse].filter((row): row is ScoreRow => row != null);
}
