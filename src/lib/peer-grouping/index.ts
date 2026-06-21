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

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { jurisdictions, governmentTaxonomies } from "@/lib/db/schema";
import { getCanonicalFactsForJurisdictions } from "@/lib/factbook/reconcile/api";
import type {
  PeerLensName,
  WorldBankIncomeGroupKey,
  WorldBankRegionKey,
  VDemRowKey,
} from "@/lib/peer-grouping/lens-metadata";

/* ────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────── */

/** The default minimum-n threshold for rendering a peer band. */
export const DEFAULT_MIN_N = 8;

export type PeerSetFallbackReason =
  | "n_below_threshold"
  | "no_classification"
  | "non_sovereign_or_uncovered";

export interface PeerSetResult {
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
 *  `{ sourceId: null, retrievedAt: null }` when the fact has no
 *  active row yet (Phase F hasn't synced it). */
async function fetchProvenance(
  jurisdictionId: string,
  factKey: string,
): Promise<{ sourceId: string | null; retrievedAt: string | null }> {
  const resolved = await getCanonicalFactsForJurisdictions(
    [jurisdictionId],
    [factKey],
  );
  const row = resolved[jurisdictionId]?.[factKey]?.canonical ?? null;
  return {
    sourceId: row?.sourceId ?? null,
    retrievedAt: row?.retrievedAt ?? null,
  };
}

/** Read all (jurisdictionId, slug) pairs once. Civica has ~260 of
 *  these so this is a cheap full-table scan. The slug is needed by
 *  rank-within-cohort computations that key on slug. */
async function readAllJurisdictionRefs(): Promise<
  Array<{ id: string; slug: string }>
> {
  const rows = await db
    .select({ id: jurisdictions.id, slug: jurisdictions.slug })
    .from(jurisdictions);
  return rows;
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
 * Material peer set — World Bank region × income
 * ──────────────────────────────────────────────────────────────── */

export interface MaterialPeerSet extends PeerSetResult {
  region: WorldBankRegionKey | string | null;
  incomeGroup: WorldBankIncomeGroupKey | string | null;
}

/**
 * Material indicators (HDI, GDP, health, demographics) compare a
 * country to peers with similar World Bank region AND income group.
 * Fallback chain: region+income → region only → income only → global.
 */
export async function getMaterialPeerSet(
  jurisdictionId: string,
  options: { minN?: number } = {},
): Promise<MaterialPeerSet> {
  const minN = options.minN ?? DEFAULT_MIN_N;

  const allRefs = await readAllJurisdictionRefs();
  const allIds = allRefs.map((r) => r.id);
  const facts = await fetchClassifications(allIds, [
    PEER_GROUPING_FACT_KEYS.worldBankRegion,
    PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup,
  ]);

  const subjectRegion =
    facts[jurisdictionId]?.[PEER_GROUPING_FACT_KEYS.worldBankRegion] ?? null;
  const subjectIncome =
    facts[jurisdictionId]?.[PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup] ??
    null;

  const baseSet: Pick<MaterialPeerSet, "region" | "incomeGroup"> = {
    region: subjectRegion,
    incomeGroup: subjectIncome,
  };

  if (!subjectRegion && !subjectIncome) {
    const provenance = await fetchProvenance(
      jurisdictionId,
      PEER_GROUPING_FACT_KEYS.worldBankRegion,
    );
    return {
      ...baseSet,
      available: false,
      lensUsed: "global",
      cohortValue: null,
      cohortLabel: "Unavailable",
      peerJurisdictionIds: [],
      peerJurisdictionSlugs: [],
      n: 0,
      fallbackChain: ["non_sovereign_or_uncovered"],
      sourceId: provenance.sourceId ?? "world_bank",
      retrievedAt: provenance.retrievedAt,
    };
  }

  // Tier 1: region+income.
  const fallbackChain: PeerSetFallbackReason[] = [];
  if (subjectRegion && subjectIncome) {
    const peers = allIds.filter(
      (id) =>
        facts[id]?.[PEER_GROUPING_FACT_KEYS.worldBankRegion] === subjectRegion &&
        facts[id]?.[PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup] ===
          subjectIncome,
    );
    if (peers.length >= minN) {
      const provenance = await fetchProvenance(
        jurisdictionId,
        PEER_GROUPING_FACT_KEYS.worldBankRegion,
      );
      const paired = pairWithSlugs(peers, allRefs);
      return {
        ...baseSet,
        available: true,
        lensUsed: "world_bank_region",
        cohortValue: `${subjectRegion}+${subjectIncome}`,
        cohortLabel: `${subjectRegion} · ${subjectIncome}`,
        peerJurisdictionIds: paired.ids,
        peerJurisdictionSlugs: paired.slugs,
        n: peers.length,
        fallbackChain,
        sourceId: provenance.sourceId ?? "world_bank",
        retrievedAt: provenance.retrievedAt,
      };
    }
    fallbackChain.push("n_below_threshold");
  } else {
    fallbackChain.push("no_classification");
  }

  // Tier 2: region only.
  if (subjectRegion) {
    const peers = allIds.filter(
      (id) =>
        facts[id]?.[PEER_GROUPING_FACT_KEYS.worldBankRegion] === subjectRegion,
    );
    if (peers.length >= minN) {
      const provenance = await fetchProvenance(
        jurisdictionId,
        PEER_GROUPING_FACT_KEYS.worldBankRegion,
      );
      const paired = pairWithSlugs(peers, allRefs);
      return {
        ...baseSet,
        available: true,
        lensUsed: "world_bank_region",
        cohortValue: subjectRegion,
        cohortLabel: subjectRegion,
        peerJurisdictionIds: paired.ids,
        peerJurisdictionSlugs: paired.slugs,
        n: peers.length,
        fallbackChain,
        sourceId: provenance.sourceId ?? "world_bank",
        retrievedAt: provenance.retrievedAt,
      };
    }
    fallbackChain.push("n_below_threshold");
  }

  // Tier 3: income only.
  if (subjectIncome) {
    const peers = allIds.filter(
      (id) =>
        facts[id]?.[PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup] ===
        subjectIncome,
    );
    if (peers.length >= minN) {
      const provenance = await fetchProvenance(
        jurisdictionId,
        PEER_GROUPING_FACT_KEYS.worldBankIncomeGroup,
      );
      const paired = pairWithSlugs(peers, allRefs);
      return {
        ...baseSet,
        available: true,
        lensUsed: "world_bank_income_group",
        cohortValue: subjectIncome,
        cohortLabel: subjectIncome,
        peerJurisdictionIds: paired.ids,
        peerJurisdictionSlugs: paired.slugs,
        n: peers.length,
        fallbackChain,
        sourceId: provenance.sourceId ?? "world_bank",
        retrievedAt: provenance.retrievedAt,
      };
    }
    fallbackChain.push("n_below_threshold");
  }

  // Tier 4: global.
  const provenance = await fetchProvenance(
    jurisdictionId,
    PEER_GROUPING_FACT_KEYS.worldBankRegion,
  );
  const paired = pairWithSlugs(allIds, allRefs);
  return {
    ...baseSet,
    available: true,
    lensUsed: "global",
    cohortValue: null,
    cohortLabel: "Global",
    peerJurisdictionIds: paired.ids,
    peerJurisdictionSlugs: paired.slugs,
    n: allIds.length,
    fallbackChain,
    sourceId: provenance.sourceId ?? "world_bank",
    retrievedAt: provenance.retrievedAt,
  };
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

export async function getGovernancePeerSet(
  jurisdictionId: string,
  options: { minN?: number } = {},
): Promise<GovernancePeerSet> {
  const minN = options.minN ?? DEFAULT_MIN_N;
  const allRefs = await readAllJurisdictionRefs();
  const allIds = allRefs.map((r) => r.id);
  const facts = await fetchClassifications(allIds, [
    PEER_GROUPING_FACT_KEYS.vdemRow,
  ]);
  const subjectTier =
    facts[jurisdictionId]?.[PEER_GROUPING_FACT_KEYS.vdemRow] ?? null;
  const provenance = await fetchProvenance(
    jurisdictionId,
    PEER_GROUPING_FACT_KEYS.vdemRow,
  );

  if (!subjectTier) {
    return {
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
    (id) => facts[id]?.[PEER_GROUPING_FACT_KEYS.vdemRow] === subjectTier,
  );
  if (peers.length >= minN) {
    const paired = pairWithSlugs(peers, allRefs);
    return {
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
  const paired = pairWithSlugs(allIds, allRefs);
  return {
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

export async function getRegimeAlternateLens(
  jurisdictionId: string,
  options: { minN?: number } = {},
): Promise<RegimeAlternateLens> {
  const minN = options.minN ?? DEFAULT_MIN_N;
  const allRefs = await readAllJurisdictionRefs();
  const subjectRow = await db
    .select({ regimeTypeCgv: governmentTaxonomies.regimeTypeCgv })
    .from(governmentTaxonomies)
    .where(eq(governmentTaxonomies.jurisdictionId, jurisdictionId))
    .limit(1);
  const subjectCgv = subjectRow[0]?.regimeTypeCgv ?? null;

  if (!subjectCgv) {
    return {
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

  const peerRows = await db
    .select({ jurisdictionId: governmentTaxonomies.jurisdictionId })
    .from(governmentTaxonomies)
    .where(eq(governmentTaxonomies.regimeTypeCgv, subjectCgv));
  const peers = peerRows.map((r) => r.jurisdictionId);

  if (peers.length >= minN) {
    const paired = pairWithSlugs(peers, allRefs);
    return {
      cgvType: subjectCgv,
      available: true,
      lensUsed: "cgv_regime",
      cohortValue: subjectCgv,
      cohortLabel: subjectCgv,
      peerJurisdictionIds: paired.ids,
      peerJurisdictionSlugs: paired.slugs,
      n: peers.length,
      fallbackChain: [],
      sourceId: "bjornskov_rode",
      retrievedAt: null,
    };
  }
  const allIds = allRefs.map((r) => r.id);
  const paired = pairWithSlugs(allIds, allRefs);
  return {
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

