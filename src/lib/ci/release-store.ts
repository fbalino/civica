import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  ciIndexReleasePointers,
  ciIndexReleases,
} from "@/lib/db/schema";
import { CURRENT_CI_RELEASE_ID } from "@/lib/ci/current-release";
import {
  CiReleaseConsistencyError,
  ciStoredReleaseHeaderErrors,
  resolveCiRelease,
  type CiReleaseContract,
} from "@/lib/ci/release-selection";

/**
 * Resolve the checked code contract and its immutable database publication
 * header as one unit. No public reader may fall through to another release
 * when either side is absent or disagrees.
 */
export async function loadPublishedCiRelease(
  releaseId: string = CURRENT_CI_RELEASE_ID,
): Promise<CiReleaseContract> {
  const release = resolveCiRelease(releaseId);
  const [header] = await db
    .select()
    .from(ciIndexReleases)
    .where(
      and(
        eq(ciIndexReleases.id, release.releaseId),
        eq(ciIndexReleases.status, "published"),
      ),
    )
    .limit(1);
  if (!header) {
    throw new CiReleaseConsistencyError(
      `${release.releaseId}: published release header is unavailable`,
    );
  }
  const errors = ciStoredReleaseHeaderErrors(header, release);
  if (errors.length) {
    throw new CiReleaseConsistencyError(
      `${release.releaseId}: ${errors.join(", ")}`,
    );
  }

  if (release.releaseId === CURRENT_CI_RELEASE_ID) {
    const [pointer] = await db
      .select({ releaseId: ciIndexReleasePointers.releaseId })
      .from(ciIndexReleasePointers)
      .where(eq(ciIndexReleasePointers.product, "civica_index"))
      .limit(1);
    if (pointer?.releaseId !== release.releaseId) {
      throw new CiReleaseConsistencyError(
        `${release.releaseId}: current publication pointer mismatch`,
      );
    }
  }
  return release;
}
