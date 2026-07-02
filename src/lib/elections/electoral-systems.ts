/**
 * Electoral-systems explainer — data layer.
 *
 * The `/elections/systems` page groups the world's directly-elected legislative
 * chambers into six sections. Every grouping maps **1:1 from IPU Parline's own
 * categories** (stored verbatim on `government_bodies.electoral_system_family` /
 * `.electoral_subsystem` by `scripts/sync-ipu-parline.ts`). No country is
 * force-fit; sub-types that don't slot into the five named systems fall to
 * "Other systems," which surfaces IPU's own labels. Countries IPU doesn't cover
 * are simply absent.
 *
 * See `plan/electoral-systems-implementation-v1.md` for the full mapping table
 * and the two documented grouping decisions (Mixed-Member keeps IPU's whole
 * `mixed_system` family = MMP + Parallel; Ranked Choice merges AV + STV as the
 * preferential-ballot family).
 *
 * References for the explainer prose: ACE Electoral Knowledge Network;
 * International IDEA, *Electoral System Design: The New International IDEA
 * Handbook*; Duverger's Law. Classifications: IPU Parline (CC-BY-NC-SA-4.0).
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { governmentBodies, jurisdictions } from "@/lib/db/schema";

/** The six section keys the page renders, in display order. */
export type SystemKey =
  | "fptp"
  | "pr"
  | "mixed"
  | "ranked"
  | "trs"
  | "other";

/**
 * Human-readable label for an IPU sub-type term, keyed 1:1 off the term IPU
 * stores. Shown on country chips / tooltips so the sub-type stays visible even
 * inside a grouped section (e.g. MMP vs Parallel within Mixed-Member). IPU's
 * terms are the source of truth — these are display strings only.
 */
export const IPU_SUBTYPE_LABEL: Record<string, string> = {
  first_past_the_post_fptp: "First Past the Post",
  first_past_the_post_fptp__block_vote_bv: "FPTP + Block Vote",
  list_proportional_representation_list_pr: "List PR",
  two_round_system_trs: "Two-Round",
  parallel_systems: "Parallel (MMM)",
  mixed_member_proportional_system_mmp: "Mixed-Member Proportional",
  single_non_transferable_vote_sntv: "Single Non-Transferable Vote",
  block_vote_bv: "Block Vote",
  single_transferable_vote_stv: "Single Transferable Vote",
  alternative_vote_av: "Alternative Vote",
  other: "Other",
};

/**
 * IPU family term → human label (for the "Other systems" section and any
 * family-level display).
 */
export const IPU_FAMILY_LABEL: Record<string, string> = {
  plurality_majority: "Plurality / Majority",
  proportional_representation: "Proportional Representation",
  mixed_system: "Mixed",
  other_systems: "Other",
};

/**
 * Bucket a chamber's IPU (family, subsystem) into one of the six page sections.
 * Returns null when the chamber has no IPU classification (excluded from the
 * page). The order of checks encodes the mapping table; every branch is a
 * deterministic 1:1 map from an IPU term, never a heuristic.
 */
export function bucketForChamber(
  family: string | null,
  subsystem: string | null
): SystemKey | null {
  if (!family && !subsystem) return null;

  // Ranked / preferential ballots first — AV and STV are IPU sub-types filed
  // under different families, but on a "how the ballot works" page they are the
  // preferential-voting family. (Documented decision v1.)
  if (
    subsystem === "alternative_vote_av" ||
    subsystem === "single_transferable_vote_stv"
  ) {
    return "ranked";
  }

  // Mixed-Member = IPU's entire `mixed_system` family (MMP + Parallel/MMM).
  if (family === "mixed_system") return "mixed";

  // Two-Round.
  if (subsystem === "two_round_system_trs") return "trs";

  // First Past the Post (incl. the rare fptp+block-vote combo IPU records).
  if (
    subsystem === "first_past_the_post_fptp" ||
    subsystem === "first_past_the_post_fptp__block_vote_bv"
  ) {
    return "fptp";
  }

  // List PR.
  if (subsystem === "list_proportional_representation_list_pr") return "pr";

  // Everything IPU classifies but the five named systems don't cover —
  // SNTV, Block Vote, IPU's literal `other`, or `other_systems` family.
  return "other";
}

export interface SystemCountry {
  slug: string;
  name: string;
  iso2: string | null;
  /** IPU sub-type term (verbatim) for this country's counted chamber. */
  subsystem: string | null;
  /** IPU family term (verbatim). */
  family: string | null;
  /** Display label for the sub-type (or family fallback). */
  subtypeLabel: string;
}

export interface SystemBucket {
  key: SystemKey;
  countries: SystemCountry[];
}

/** All buckets keyed by SystemKey, each with its country list (name-sorted). */
export type BucketMap = Record<SystemKey, SystemCountry[]>;

/**
 * Load every sovereign state's electoral-system classification and bucket it.
 *
 * We count by the **lower or unicameral chamber** — the directly-elected house
 * that defines a country's electoral system (upper chambers are frequently
 * appointed/indirect and left unclassified by IPU). One row per country: if a
 * country somehow has both a classified lower and unicameral chamber we take
 * the lower (`hierarchy_level` orders lower=2 above unicameral, but we key on
 * chamber_type and dedupe per jurisdiction).
 */
export async function getElectoralSystemBuckets(): Promise<BucketMap> {
  const empty: BucketMap = {
    fptp: [],
    pr: [],
    mixed: [],
    ranked: [],
    trs: [],
    other: [],
  };

  // One classified chamber per jurisdiction, preferring lower/unicameral.
  // DISTINCT ON keeps a single row per jurisdiction; the ORDER BY ranks
  // lower_chamber and unicameral_parliament ahead of anything else.
  const rows = await db
    .select({
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      family: governmentBodies.electoralSystemFamily,
      subsystem: governmentBodies.electoralSubsystem,
    })
    .from(governmentBodies)
    .innerJoin(
      jurisdictions,
      sql`${governmentBodies.jurisdictionId} = ${jurisdictions.id}`
    )
    .where(
      sql`${jurisdictions.type} = 'sovereign_state'
        AND (${governmentBodies.electoralSystemFamily} IS NOT NULL
          OR ${governmentBodies.electoralSubsystem} IS NOT NULL)
        AND (${governmentBodies.chamberType} IN ('lower', 'unicameral')
          OR ${governmentBodies.chamberType} IS NULL)`
    )
    .orderBy(
      sql`${jurisdictions.id},
        CASE ${governmentBodies.chamberType}
          WHEN 'unicameral' THEN 0
          WHEN 'lower' THEN 1
          ELSE 2 END,
        ${jurisdictions.name}`
    );

  // DISTINCT ON isn't a first-class Drizzle helper; emulate by keeping the
  // first row seen per jurisdiction slug (rows are pre-ordered above).
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);

    const key = bucketForChamber(r.family, r.subsystem);
    if (!key) continue;

    const subtypeLabel =
      (r.subsystem && IPU_SUBTYPE_LABEL[r.subsystem]) ||
      (r.family && IPU_FAMILY_LABEL[r.family]) ||
      "Classified";

    empty[key].push({
      slug: r.slug,
      name: r.name,
      iso2: r.iso2,
      subsystem: r.subsystem,
      family: r.family,
      subtypeLabel,
    });
  }

  // Name-sort each bucket for stable display.
  for (const k of Object.keys(empty) as SystemKey[]) {
    empty[k].sort((a, b) => a.name.localeCompare(b.name));
  }

  return empty;
}
