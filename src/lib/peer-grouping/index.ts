/**
 * Peer-grouping helpers — replaces the retired `structural_family`
 * heuristic per the 2026-05-02 peer-grouping resolution.
 *
 *   ~/civica/plan/peer-grouping-resolution-v1.md
 *   ~/civica/plan/structural-family-removal-implementation-plan.md
 *
 * Domain-specific peer lenses:
 *
 *   • Material outcomes (HDI, GDP, demographics):
 *       World Bank region × World Bank income group
 *
 *   • Governance outcomes (Civica Index, Pulse, democracy, rule of law):
 *       V-Dem Regimes of the World (Lührmann et al. 2018)
 *
 *   • Optional alternate regime lens:
 *       Bjørnskov-Rode / CGV (already-ingested column on
 *       government_taxonomies)
 *
 *   • Constitutional form (descriptive metadata, NOT a peer set):
 *       government_form_description (free text from CIA Factbook)
 *       + monarchy_status (small enum)
 *
 * Minimum-n rule: peer bands render only when n ≥ 8. Below that,
 * each peer-set helper walks a documented fallback ladder and returns
 * the `fallbackChain` it took as part of its result.
 *
 * Phase F coordination: every read goes through Phase F's resolver
 * via `getCanonicalFactsForJurisdictions()` (F.3.5 batch API). When
 * Phase F has not yet synced a peer-grouping fact-key the canonical
 * value is `null` and helpers gracefully return an `unavailable`
 * peer-set marker — they never crash on missing data.
 */

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { jurisdictions, governmentTaxonomies } from "@/lib/db/schema";
import { getCanonicalFactsForJurisdictions } from "@/lib/factbook/reconcile/api";
import { DEFAULT_MIN_N } from "@/lib/peer-grouping/constants";
import type {
  PeerLensName,
  WorldBankIncomeGroupKey,
  WorldBankRegionKey,
  VDemRowKey,
} from "@/lib/peer-grouping/lens-metadata";

/* ────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────── */

/** The default minimum-n threshold for rendering a peer band. Defined
 *  in the pure `constants.ts` module (no DB import) and re-exported
 *  here for existing call sites — see that file for why. */
export { DEFAULT_MIN_N };

export type PeerSetFallbackReason =
  | "n_below_threshold"
  | "no_classification"
  | "non_sovereign_or_uncovered"
  | "subject_not_observed";

/** A peer lens is selected by the measure being compared, never by display
 * preference. Material measures use World Bank classification; governance
 * measures use V-Dem regime classification. */
export type PeerMeasureDomain = "material" | "governance";

/** The exact observed metric universe to which a cohort is restricted. */
export interface PeerMeasureContext {
  /** Stable metric/release identifier exposed with the cohort. */
  metricId: string;
  /** The value/release vintage of the compared measure, when known. */
  metricVintage: string | null;
}

/** Async peer-set calls require a metric-observed sovereign universe. */
export interface PeerSetOptions extends PeerMeasureContext {
  eligibleJurisdictionIds: readonly string[];
  minN?: number;
}

export interface PeerSetResult {
  /** Domain of the measure being compared. This fixes the permitted lens. */
  measureDomain: PeerMeasureDomain;
  /** Identifier and vintage for the compared metric/release. */
  metricId: string;
  metricVintage: string | null;
  /** Number of sovereign jurisdictions with an observed value for the metric. */
  eligibleN: number;
  /** Size of the requested cohort before any fallback. */
  attemptedN: number;
  /** Size of the cohort ultimately used for the comparison. */
  finalN: number;
  /** Pinned upstream vintage of the classification that formed the cohort. */
  upstreamVintage: string | null;
  /** True when the peer set is usable for ranking display. */
  available: boolean;
  /** Lens used for the final result. May differ from the requested
   *  lens when fallback fired. */
  lensUsed: PeerLensName | "global";
  /** The categorical value that defines the peer cohort. `null`
   *  when the helper fell back to global. */
  cohortValue: string | null;
  /** Human-readable label of the cohort value, or "Global" / "Unavailable". */
  cohortLabel: string;
  /** All jurisdictionIds in the cohort INCLUDING the input jurisdiction.
   *  Empty when the helper degraded to "unavailable". */
  peerJurisdictionIds: string[];
  /** Slugs paired with `peerJurisdictionIds` (same order), used by
   *  rank-within-cohort computations that key on slug. */
  peerJurisdictionSlugs: string[];
  /** Cohort size (= peerJurisdictionIds.length). */
  n: number;
  /** Did fallback fire? Empty array if the requested lens was usable. */
  fallbackChain: PeerSetFallbackReason[];
  /** Source row provenance for SourceDot rendering. */
  sourceId: string;
  /** Most recent retrieved-at across the canonical rows used. */
  retrievedAt: string | null;
}

/* ────────────────────────────────────────────────────────────────
 * Fact-key constants (mirror src/lib/factbook/reconcile/fact-keys.ts)
 *
 * The four peer-grouping classification keys are registered in
 * Phase F's fact-keys registry. We import the values as constants
 * here so we can pass them into the resolver batch API.
 * ──────────────────────────────────────────────────────────────── */

export const PEER_GROUPING_FACT_KEYS = {
  worldBankRegion: "world_bank_region",
  worldBankIncomeGroup: "world_bank_income_group",
  vdemRow: "vdem_row",
  monarchyStatus: "monarchy_status",
  governmentFormDescription: "government_form_description",
  governmentType: "government_type",
} as const;

/* ────────────────────────────────────────────────────────────────
 * Internal — batch fetch all classification facts in one round-trip
 * ──────────────────────────────────────────────────────────────── */

interface ClassificationCanonical {
  worldBankRegion: string | null;
  worldBankIncomeGroup: string | null;
  vdemRow: string | null;
  monarchyStatus: string | null;
  governmentFormDescription: string | null;
  retrievedAt: string | null;
  sourceId: string | null;
}

/** Fetch peer-grouping classifications for many jurisdictions in
 *  one resolver round-trip. Used by every helper below. */
async function fetchClassifications(
  jurisdictionIds: string[],
  factKeys: string[],
): Promise<Record<string, Record<string, string | null>>> {
  const out: Record<string, Record<string, string | null>> = {};
  if (jurisdictionIds.length === 0 || factKeys.length === 0) return out;

  const resolved = await getCanonicalFactsForJurisdictions(
    jurisdictionIds,
    factKeys,
  );

  for (const jurId of jurisdictionIds) {
    const perJur: Record<string, string | null> = {};
    for (const factKey of factKeys) {
      const r = resolved[jurId]?.[factKey];
      perJur[factKey] = r?.canonical?.factValue ?? null;
    }
    out[jurId] = perJur;
  }
  return out;
}

/** Fetch the freshest retrievedAt + winning sourceId across the
 *  canonical rows for one jurisdiction × one fact-key. Returns
 *  `{ sourceId: null, retrievedAt: null, upstreamVintage: null }` when the fact has no
 *  active row yet (Phase F hasn't synced it). */
async function fetchProvenance(
  jurisdictionId: string,
  factKey: string,
): Promise<PeerProvenance> {
  const resolved = await getCanonicalFactsForJurisdictions(
    [jurisdictionId],
    [factKey],
  );
  const row = resolved[jurisdictionId]?.[factKey]?.canonical ?? null;
  return {
    sourceId: row?.sourceId ?? null,
    retrievedAt: row?.retrievedAt ?? null,
    upstreamVintage: row?.upstreamVintageLabel ?? null,
  };
}

/** Read an observed, eligible set of (jurisdictionId, slug) pairs. The caller
 * has already established the metric/release universe; this function preserves
 * it rather than silently widening to every jurisdiction in the database. */
async function readEligibleJurisdictionRefs(
  eligibleJurisdictionIds: readonly string[],
): Promise<
  Array<{ id: string; slug: string }>
> {
  const ids = [...new Set(eligibleJurisdictionIds)];
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: jurisdictions.id, slug: jurisdictions.slug })
    .from(jurisdictions)
    .where(inArray(jurisdictions.id, ids));
  return rows;
}

function mergedMaterialProvenance(
  region: PeerProvenance,
  income: PeerProvenance,
): PeerProvenance {
  const vintages = [...new Set(
    [region.upstreamVintage, income.upstreamVintage].filter(
      (value): value is string => Boolean(value),
    ),
  )];
  return {
    sourceId: region.sourceId ?? income.sourceId,
    retrievedAt: region.retrievedAt ?? income.retrievedAt,
    upstreamVintage: vintages.length > 0 ? vintages.join(" · ") : null,
  };
}

/** Map a list of jurisdictionIds to their (id, slug) tuples in
 *  the same order the input was given. */
function pairWithSlugs(
  ids: string[],
  refs: Array<{ id: string; slug: string }>,
): { ids: string[]; slugs: string[] } {
  const slugById = new Map(refs.map((r) => [r.id, r.slug] as const));
  const slugs: string[] = [];
  for (const id of ids) {
    const slug = slugById.get(id);
    if (slug) slugs.push(slug);
  }
  return { ids, slugs };
}

/* ────────────────────────────────────────────────────────────────
 * Pure resolver seams (ATL-017)
 * ────────────────────────────────────────────────────────────────
 *
 * The fallback-ladder / minimum-n / non-coverage decision logic is
 * separated from the database reads so it can be exercised by
 * source-backed fixtures with no DB (the DAT-012 pure-seam pattern).
 * The async `get*PeerSet` functions fetch the classification map and
 * provenance, then delegate to these deterministic functions. Passing
 * the same inputs must always produce the same peer set.
 * ──────────────────────────────────────────────────────────────── */

export interface JurisdictionRef {
  id: string;
  slug: string;
}

export interface PeerProvenance {
  sourceId: string | null;
  retrievedAt: string | null;
  upstreamVintage?: string | null;
}

function peerSetMetadata(
  measureDomain: PeerMeasureDomain,
  refs: JurisdictionRef[],
  attemptedN: number,
  finalN: number,
  provenance: PeerProvenance,
  measure: PeerMeasureContext | undefined,
) {
  return {
    measureDomain,
    metricId: measure?.metricId ?? "unversioned_measure",
    metricVintage: measure?.metricVintage ?? null,
    eligibleN: refs.length,
    attemptedN,
    finalN,
    upstreamVintage: provenance.upstreamVintage ?? null,
  };
}

/* ────────────────────────────────────────────────────────────────
 * Material peer set — World Bank region × income
 * ──────────────────────────────────────────────────────────────── */

export interface MaterialPeerSet extends PeerSetResult {
  region: WorldBankRegionKey | string | null;
  incomeGroup: WorldBankIncomeGroupKey | string | null;
}

/**
 * Pure material peer-set resolver. Walks the documented fallback
 * ladder region+income → region → income → global, honouring the
 * minimum-n threshold at every rung. A subject with neither
 * classification returns an explicit `non_sovereign_or_uncovered`
 * unavailable marker (never a silent global cohort).
 */
export function resolveMaterialPeerSet(args: {
  subjectId: string;
  refs: JurisdictionRef[];
  regionByJur: Record<string, string | null | undefined>;
  incomeByJur: Record<string, string | null | undefined>;
  regionProvenance: PeerProvenance;
  incomeProvenance: PeerProvenance;
  minN: number;
  measure?: PeerMeasureContext;
}): MaterialPeerSet {
  const {
    subjectId,
    refs,
    regionByJur,
    incomeByJur,
    regionProvenance,
    incomeProvenance,
    minN,
    measure,
  } = args;
  const allIds = refs.map((r) => r.id);
  const subjectRegion = regionByJur[subjectId] ?? null;
  const subjectIncome = incomeByJur[subjectId] ?? null;

  const baseSet: Pick<MaterialPeerSet, "region" | "incomeGroup"> = {
    region: subjectRegion,
    incomeGroup: subjectIncome,
  };

  if (!allIds.includes(subjectId)) {
    return {
      ...peerSetMetadata("material", refs, 0, 0, regionProvenance, measure),
      ...baseSet,
      available: false,
      lensUsed: "global",
      cohortValue: null,
      cohortLabel: "Unavailable",
      peerJurisdictionIds: [],
      peerJurisdictionSlugs: [],
      n: 0,
      fallbackChain: ["subject_not_observed"],
      sourceId: regionProvenance.sourceId ?? "world_bank",
      retrievedAt: regionProvenance.retrievedAt,
    };
  }

  if (!subjectRegion && !subjectIncome) {
    return {
      ...peerSetMetadata("material", refs, 0, 0, regionProvenance, measure),
      ...baseSet,
      available: false,
      lensUsed: "global",
      cohortValue: null,
      cohortLabel: "Unavailable",
      peerJurisdictionIds: [],
      peerJurisdictionSlugs: [],
      n: 0,
      fallbackChain: ["non_sovereign_or_uncovered"],
      sourceId: regionProvenance.sourceId ?? "world_bank",
      retrievedAt: regionProvenance.retrievedAt,
    };
  }

  // Tier 1: region+income.
  const fallbackChain: PeerSetFallbackReason[] = [];
  let attemptedN = 0;
  if (subjectRegion && subjectIncome) {
    const peers = allIds.filter(
      (id) =>
        (regionByJur[id] ?? null) === subjectRegion &&
        (incomeByJur[id] ?? null) === subjectIncome,
    );
    attemptedN = peers.length;
    if (peers.length >= minN) {
      const paired = pairWithSlugs(peers, refs);
      return {
        ...peerSetMetadata("material", refs, attemptedN, peers.length, regionProvenance, measure),
        ...baseSet,
        available: true,
        lensUsed: "world_bank_region",
        cohortValue: `${subjectRegion}+${subjectIncome}`,
        cohortLabel: `${subjectRegion} · ${subjectIncome}`,
        peerJurisdictionIds: paired.ids,
        peerJurisdictionSlugs: paired.slugs,
        n: peers.length,
        fallbackChain,
        sourceId: regionProvenance.sourceId ?? "world_bank",
        retrievedAt: regionProvenance.retrievedAt,
      };
    }
    fallbackChain.push("n_below_threshold");
  } else {
    fallbackChain.push("no_classification");
  }

  // Tier 2: region only.
  if (subjectRegion) {
    const peers = allIds.filter(
      (id) => (regionByJur[id] ?? null) === subjectRegion,
    );
    if (peers.length >= minN) {
      const paired = pairWithSlugs(peers, refs);
      return {
        ...peerSetMetadata("material", refs, attemptedN, peers.length, regionProvenance, measure),
        ...baseSet,
        available: true,
        lensUsed: "world_bank_region",
        cohortValue: subjectRegion,
        cohortLabel: subjectRegion,
        peerJurisdictionIds: paired.ids,
        peerJurisdictionSlugs: paired.slugs,
        n: peers.length,
        fallbackChain,
        sourceId: regionProvenance.sourceId ?? "world_bank",
        retrievedAt: regionProvenance.retrievedAt,
      };
    }
    fallbackChain.push("n_below_threshold");
  }

  // Tier 3: income only.
  if (subjectIncome) {
    const peers = allIds.filter(
      (id) => (incomeByJur[id] ?? null) === subjectIncome,
    );
    if (peers.length >= minN) {
      const paired = pairWithSlugs(peers, refs);
      return {
        ...peerSetMetadata("material", refs, attemptedN, peers.length, incomeProvenance, measure),
        ...baseSet,
        available: true,
        lensUsed: "world_bank_income_group",
        cohortValue: subjectIncome,
        cohortLabel: subjectIncome,
        peerJurisdictionIds: paired.ids,
        peerJurisdictionSlugs: paired.slugs,
        n: peers.length,
        fallbackChain,
        sourceId: incomeProvenance.sourceId ?? "world_bank",
        retrievedAt: incomeProvenance.retrievedAt,
      };
    }
    fallbackChain.push("n_below_threshold");
  }

  // Tier 4: global.
  const paired = pairWithSlugs(allIds, refs);
  return {
    ...peerSetMetadata("material", refs, attemptedN, allIds.length, regionProvenance, measure),
    ...baseSet,
    available: true,
    lensUsed: "global",
    cohortValue: null,
    cohortLabel: "Global",
    peerJurisdictionIds: paired.ids,
    peerJurisdictionSlugs: paired.slugs,
    n: allIds.length,
    fallbackChain,
    sourceId: regionProvenance.sourceId ?? "world_bank",
    retrievedAt: regionProvenance.retrievedAt,
  };
}

/**
 * Material indicators (HDI, GDP, health, demographics) compare a
 * country to peers with similar World Bank region AND income group.
 * Fallback chain: region+income → region only → income only → global.
 */
export async function getMaterialPeerSet(
  jurisdictionId: string,
  options: PeerSetOptions,
): Promise<MaterialPeerSet> {
  const minN = options.minN ?? DEFAULT_MIN_N;

  const allRefs = await readEligibleJurisdictionRefs(
    options.eligibleJurisdictionIds,
  );
  const allIds = allRefs.map((r) => r.id);
  const facts = await fetchClassifications(allIds, [
    PEER_GROUPING_FACT_KEYS.worldBankRegion,
    PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup,
  ]);

  const regionByJur: Record<string, string | null | undefined> = {};
  const incomeByJur: Record<string, string | null | undefined> = {};
  for (const id of allIds) {
    regionByJur[id] = facts[id]?.[PEER_GROUPING_FACT_KEYS.worldBankRegion];
    incomeByJur[id] = facts[id]?.[PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup];
  }

  const [regionProvenance, incomeProvenance] = await Promise.all([
    fetchProvenance(jurisdictionId, PEER_GROUPING_FACT_KEYS.worldBankRegion),
    fetchProvenance(
      jurisdictionId,
      PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup,
    ),
  ]);

  return resolveMaterialPeerSet({
    subjectId: jurisdictionId,
    refs: allRefs,
    regionByJur,
    incomeByJur,
    regionProvenance: mergedMaterialProvenance(
      regionProvenance,
      incomeProvenance,
    ),
    incomeProvenance: mergedMaterialProvenance(
      incomeProvenance,
      regionProvenance,
    ),
    minN,
    measure: options,
  });
}

/* ────────────────────────────────────────────────────────────────
 * Governance peer set — V-Dem Regimes of the World
 * ────────────────────────────────────────────────────────────────
 *
 * Governance comparisons (CI dimensions, Pulse) compare to peers in
 * the same V-Dem RoW tier. Flatter fallback than material — RoW only
 * has 4 buckets, so once you're outside your tier, global is more
 * interpretable than a 2-axis fallback.
 */

export interface GovernancePeerSet extends PeerSetResult {
  vdemRowTier: VDemRowKey | string | null;
}

/**
 * Pure governance peer-set resolver. Flat fallback (V-Dem RoW tier →
 * global) because RoW has only four buckets. A subject without a RoW
 * tier returns an explicit unavailable marker.
 */
export function resolveGovernancePeerSet(args: {
  subjectId: string;
  refs: JurisdictionRef[];
  vdemRowByJur: Record<string, string | null | undefined>;
  provenance: PeerProvenance;
  minN: number;
  measure?: PeerMeasureContext;
}): GovernancePeerSet {
  const { subjectId, refs, vdemRowByJur, provenance, minN, measure } = args;
  const allIds = refs.map((r) => r.id);
  const subjectTier = vdemRowByJur[subjectId] ?? null;

  if (!allIds.includes(subjectId)) {
    return {
      ...peerSetMetadata("governance", refs, 0, 0, provenance, measure),
      vdemRowTier: null,
      available: false,
      lensUsed: "global",
      cohortValue: null,
      cohortLabel: "Unavailable",
      peerJurisdictionIds: [],
      peerJurisdictionSlugs: [],
      n: 0,
      fallbackChain: ["subject_not_observed"],
      sourceId: provenance.sourceId ?? "vdem",
      retrievedAt: provenance.retrievedAt,
    };
  }

  if (!subjectTier) {
    return {
      ...peerSetMetadata("governance", refs, 0, 0, provenance, measure),
      vdemRowTier: null,
      available: false,
      lensUsed: "global",
      cohortValue: null,
      cohortLabel: "Unavailable",
      peerJurisdictionIds: [],
      peerJurisdictionSlugs: [],
      n: 0,
      fallbackChain: ["non_sovereign_or_uncovered"],
      sourceId: provenance.sourceId ?? "vdem",
      retrievedAt: provenance.retrievedAt,
    };
  }

  const fallbackChain: PeerSetFallbackReason[] = [];
  const peers = allIds.filter(
    (id) => (vdemRowByJur[id] ?? null) === subjectTier,
  );
  if (peers.length >= minN) {
    const paired = pairWithSlugs(peers, refs);
    return {
      ...peerSetMetadata("governance", refs, peers.length, peers.length, provenance, measure),
      vdemRowTier: subjectTier,
      available: true,
      lensUsed: "vdem_row",
      cohortValue: subjectTier,
      cohortLabel: subjectTier,
      peerJurisdictionIds: paired.ids,
      peerJurisdictionSlugs: paired.slugs,
      n: peers.length,
      fallbackChain,
      sourceId: provenance.sourceId ?? "vdem",
      retrievedAt: provenance.retrievedAt,
    };
  }
  fallbackChain.push("n_below_threshold");
  const paired = pairWithSlugs(allIds, refs);
  return {
    ...peerSetMetadata("governance", refs, peers.length, allIds.length, provenance, measure),
    vdemRowTier: subjectTier,
    available: true,
    lensUsed: "global",
    cohortValue: null,
    cohortLabel: "Global",
    peerJurisdictionIds: paired.ids,
    peerJurisdictionSlugs: paired.slugs,
    n: allIds.length,
    fallbackChain,
    sourceId: provenance.sourceId ?? "vdem",
    retrievedAt: provenance.retrievedAt,
  };
}

export async function getGovernancePeerSet(
  jurisdictionId: string,
  options: PeerSetOptions,
): Promise<GovernancePeerSet> {
  const minN = options.minN ?? DEFAULT_MIN_N;
  const allRefs = await readEligibleJurisdictionRefs(
    options.eligibleJurisdictionIds,
  );
  const allIds = allRefs.map((r) => r.id);
  const facts = await fetchClassifications(allIds, [
    PEER_GROUPING_FACT_KEYS.vdemRow,
  ]);
  const vdemRowByJur: Record<string, string | null | undefined> = {};
  for (const id of allIds) {
    vdemRowByJur[id] = facts[id]?.[PEER_GROUPING_FACT_KEYS.vdemRow];
  }
  const provenance = await fetchProvenance(
    jurisdictionId,
    PEER_GROUPING_FACT_KEYS.vdemRow,
  );

  return resolveGovernancePeerSet({
    subjectId: jurisdictionId,
    refs: allRefs,
    vdemRowByJur,
    provenance,
    minN,
    measure: options,
  });
}

/* ────────────────────────────────────────────────────────────────
 * Alternate regime lens — Bjørnskov-Rode / CGV
 * ────────────────────────────────────────────────────────────────
 *
 * BR/CGV is already ingested into `government_taxonomies.regime_type_cgv`.
 * Until Phase F migrates this to the canonical-fact layer, we read
 * directly from that column. When Phase F provides a `regime_type_cgv`
 * fact-key, swap the read for a `getCanonicalFact()` call and delete
 * the direct-table query.
 */

export interface RegimeAlternateLens extends PeerSetResult {
  cgvType: string | null;
}

/**
 * Pure BR/CGV alternate-lens resolver. `cgvPeerIds` are the
 * jurisdictions sharing the subject's CGV regime type (the subject
 * included). Flat fallback (CGV type → global); no subject type
 * returns an explicit unavailable marker.
 */
export function resolveRegimeAlternateLens(args: {
  subjectId: string;
  refs: JurisdictionRef[];
  subjectCgv: string | null;
  cgvPeerIds: string[];
  minN: number;
  measure?: PeerMeasureContext;
}): RegimeAlternateLens {
  const { subjectId, refs, subjectCgv, cgvPeerIds, minN, measure } = args;
  const provenance: PeerProvenance = {
    sourceId: "bjornskov_rode",
    retrievedAt: null,
    upstreamVintage: null,
  };

  if (!refs.some((ref) => ref.id === subjectId)) {
    return {
      ...peerSetMetadata("governance", refs, 0, 0, provenance, measure),
      cgvType: null,
      available: false,
      lensUsed: "global",
      cohortValue: null,
      cohortLabel: "Unavailable",
      peerJurisdictionIds: [],
      peerJurisdictionSlugs: [],
      n: 0,
      fallbackChain: ["subject_not_observed"],
      sourceId: "bjornskov_rode",
      retrievedAt: null,
    };
  }

  if (!subjectCgv) {
    return {
      ...peerSetMetadata("governance", refs, 0, 0, provenance, measure),
      cgvType: null,
      available: false,
      lensUsed: "global",
      cohortValue: null,
      cohortLabel: "Unavailable",
      peerJurisdictionIds: [],
      peerJurisdictionSlugs: [],
      n: 0,
      fallbackChain: ["non_sovereign_or_uncovered"],
      sourceId: "bjornskov_rode",
      retrievedAt: null,
    };
  }

  if (cgvPeerIds.length >= minN) {
    const paired = pairWithSlugs(cgvPeerIds, refs);
    return {
      ...peerSetMetadata("governance", refs, cgvPeerIds.length, cgvPeerIds.length, provenance, measure),
      cgvType: subjectCgv,
      available: true,
      lensUsed: "cgv_regime",
      cohortValue: subjectCgv,
      cohortLabel: subjectCgv,
      peerJurisdictionIds: paired.ids,
      peerJurisdictionSlugs: paired.slugs,
      n: cgvPeerIds.length,
      fallbackChain: [],
      sourceId: "bjornskov_rode",
      retrievedAt: null,
    };
  }
  const allIds = refs.map((r) => r.id);
  const paired = pairWithSlugs(allIds, refs);
  return {
    ...peerSetMetadata("governance", refs, cgvPeerIds.length, allIds.length, provenance, measure),
    cgvType: subjectCgv,
    available: true,
    lensUsed: "global",
    cohortValue: null,
    cohortLabel: "Global",
    peerJurisdictionIds: paired.ids,
    peerJurisdictionSlugs: paired.slugs,
    n: allIds.length,
    fallbackChain: ["n_below_threshold"],
    sourceId: "bjornskov_rode",
    retrievedAt: null,
  };
}

export async function getRegimeAlternateLens(
  jurisdictionId: string,
  options: PeerSetOptions,
): Promise<RegimeAlternateLens> {
  const minN = options.minN ?? DEFAULT_MIN_N;
  const allRefs = await readEligibleJurisdictionRefs(
    options.eligibleJurisdictionIds,
  );
  const subjectRow = await db
    .select({ regimeTypeCgv: governmentTaxonomies.regimeTypeCgv })
    .from(governmentTaxonomies)
    .where(eq(governmentTaxonomies.jurisdictionId, jurisdictionId))
    .limit(1);
  const subjectCgv = subjectRow[0]?.regimeTypeCgv ?? null;

  let cgvPeerIds: string[] = [];
  if (subjectCgv) {
    const peerRows = await db
      .select({ jurisdictionId: governmentTaxonomies.jurisdictionId })
      .from(governmentTaxonomies)
      .where(eq(governmentTaxonomies.regimeTypeCgv, subjectCgv));
    const eligible = new Set(allRefs.map((ref) => ref.id));
    cgvPeerIds = peerRows
      .map((r) => r.jurisdictionId)
      .filter((id) => eligible.has(id));
  }

  return resolveRegimeAlternateLens({
    subjectId: jurisdictionId,
    refs: allRefs,
    subjectCgv,
    cgvPeerIds,
    minN,
    measure: options,
  });
}

/**
 * Domain-locked entry point for product surfaces. A caller declares the
 * measure being compared; the resolver selects the only permitted default
 * lens and refuses the old "pick any peer lens for any measure" pattern.
 */
export async function getPeerSetForMeasure(
  args: PeerSetOptions & {
    jurisdictionId: string;
    measureDomain: PeerMeasureDomain;
  },
): Promise<MaterialPeerSet | GovernancePeerSet> {
  const { jurisdictionId, measureDomain, ...options } = args;
  return measureDomain === "material"
    ? getMaterialPeerSet(jurisdictionId, options)
    : getGovernancePeerSet(jurisdictionId, options);
}
