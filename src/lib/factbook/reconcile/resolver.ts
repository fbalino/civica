/**
 * Phase F — per-fact reconciliation resolver.
 *
 * For a given (jurisdiction, fact_key) with N source rows in
 * `country_facts`, return one canonical value plus the full set
 * for transparency.
 *
 * The resolver is deterministic and IO-free EXCEPT for the DB read
 * in `resolveFact()` and the open-dispute lookup. The pure half is
 * `resolveFromRows()`; tests target it directly so they don't need
 * a database.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §3
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { countryFacts, dataDisputes, jurisdictions } from "@/lib/db/schema";
import {
  getFactKey,
  type FactKeyDefinition,
} from "@/lib/factbook/reconcile/fact-keys";
import { isAllowedReference } from "@/lib/factbook/reconcile/source-allowlist";
import { isNsoForJurisdiction } from "@/lib/factbook/reconcile/nso-overrides";
import { resolveSourceLineage } from "@/lib/factbook/reconcile/source-independence";
import {
  resolveGrowthMethodology,
  isAnnualYoy,
} from "@/lib/data/growth-methodology";
import type {
  DecisionReason,
  DecisionTraceStep,
  FactRow,
  FactRowStatus,
  ProposedDispute,
  ResolverOutput,
} from "@/lib/factbook/reconcile/types";
import { parseDataValueStatus } from "@/lib/data/value-state";

export const SOURCE_PRECEDENCE_VERSION = "source-precedence/v1" as const;

type CoreResolverOutput = Omit<
  ResolverOutput,
  "jurisdictionId" | "factKey" | "isDisputed" | "decisionTrace"
>;

/** Methodology version this build of the resolver implements.
 *  Stamped on every row written by sync scripts. */
export const METHODOLOGY_VERSION = "v0.1-beta" as const;

/** Wikidata's own self-citing reference markers, never trusted on
 *  their own (methodology §2.2). */
const SELF_CITING_PIDS = new Set(["P143"]);

export interface ResolverOptions {
  /** Force a specific resolver-rules version. Reserved for vintage
   *  replay; v0.1-beta is the only value today. */
  methodologyVersion?: string;
  /** Inject a row set directly, bypassing the DB read. Used by
   *  tests and by replay against `fact_snapshots`. */
  rows?: FactRow[];
  /**
   * ISO-3166-1 alpha-3 code for the jurisdiction being resolved.
   * When provided, the NSO for that country wins tied-date races
   * over other Tier-1 publishers (NSO-priority-tier patch, R.13–R.20).
   *
   * `resolveFact()` looks this up from the `jurisdictions` table
   * automatically. Tests that call `resolveFromRows()` directly should
   * pass it here so they don't need a DB connection.
   */
  jurisdictionIso3?: string | null;
}

/* ────────────────────────────────────────────────────────────────
 * Public entry points
 * ──────────────────────────────────────────────────────────────── */

/**
 * Resolve the canonical value for a `(jurisdiction, fact_key)`
 * pair. Reads `country_facts` and the `data_disputes` table for
 * `isDisputed`.
 */
export async function resolveFact(
  jurisdictionId: string,
  factKey: string,
  options?: ResolverOptions
): Promise<ResolverOutput> {
  const def = getFactKey(factKey);
  if (!def) {
    // Unknown fact-key: return an empty resolution rather than
    // throwing. Caller decides how loud to be.
    return {
      jurisdictionId,
      factKey,
      canonical: null,
      alternates: [],
      all: [],
      isDisputed: false,
      decisionReason: "no_active_rows",
      decisionTrace: [
        {
          code: "row_eligibility",
          outcome: "unsupported_fact_key",
          detail: `No canonical policy is registered for fact key '${factKey}'.`,
          sourceIds: [],
        },
      ],
      proposedDisputes: [],
      canonicalIsProjection: false,
    };
  }

  const rows = options?.rows ?? (await readRows(jurisdictionId, factKey));

  // NSO-priority-tier patch (R.13–R.20): look up the ISO3 once so
  // resolveFromRows can apply the NSO tiebreak deterministically.
  // Prefer an injected value (for tests / vintage replay via options)
  // over the DB lookup to keep resolveFact() mockable without a DB.
  const jurisdictionIso3 =
    options?.jurisdictionIso3 !== undefined
      ? options.jurisdictionIso3
      : await readJurisdictionIso3(jurisdictionId);

  const pure = resolveFromRows(rows, def, jurisdictionIso3);

  const isDisputed = await readIsDisputed(jurisdictionId, factKey);

  return {
    jurisdictionId,
    factKey,
    ...pure,
    isDisputed,
  };
}

/**
 * Pure resolution. No IO. Apply methodology §3 rules to the row
 * set and return canonical / alternates / proposed disputes.
 *
 * @param jurisdictionIso3 - ISO-3166-1 alpha-3 for the jurisdiction.
 *   When supplied, the NSO for that country wins tied-date races over
 *   other Tier-1 publishers (NSO-priority-tier patch, R.13–R.20).
 *   Omit (or pass null) to use the pre-patch 3-tier priority; this is
 *   the correct behaviour for jurisdictions with no registered NSO.
 */
export function resolveFromRows(
  rows: FactRow[],
  def: FactKeyDefinition,
  jurisdictionIso3?: string | null
): Omit<ResolverOutput, "jurisdictionId" | "factKey" | "isDisputed"> {
  const core = resolveFromRowsCore(rows, def, jurisdictionIso3);
  return {
    ...core,
    decisionTrace: buildDecisionTrace(rows, def, core, jurisdictionIso3),
  };
}

function resolveFromRowsCore(
  rows: FactRow[],
  def: FactKeyDefinition,
  jurisdictionIso3?: string | null
): CoreResolverOutput {
  const all = [...rows];

  // §3.6 plausibility envelope — treat envelope-violators as
  // rejected even if the sync script let them through. This is the
  // resolver's last-line check; sync should already have caught it.
  const envelopeFailed: FactRow[] = [];
  const enforced: FactRow[] = all.map((r) => {
    if (r.status === "active" && violatesEnvelope(r, def)) {
      envelopeFailed.push(r);
      return { ...r, status: "rejected" as FactRowStatus };
    }
    return r;
  });

  const active = enforced.filter((r) => {
    const valueStatus = parseDataValueStatus(r.valueStatus);
    return (
      r.status === "active" &&
      (valueStatus === "observed" || valueStatus === "disputed")
    );
  });
  const proposedDisputes: ProposedDispute[] = envelopeFailed.map((r) => ({
    kind: "plausibility_envelope",
    factIdA: r.id,
    factIdB: null,
    description: `Value out of plausibility envelope for fact-key '${def.key}'.`,
  }));

  if (active.length === 0) {
    return {
      canonical: null,
      alternates: [],
      all: enforced,
      decisionReason: "no_active_rows",
      proposedDisputes,
      canonicalIsProjection: false,
    };
  }

  // Bug 1 — measurement-vs-projection partition (forecast-vs-measurement-v1.md).
  // Partition active rows into measured + projected sets. The decision
  // logic below runs over `candidatePool`:
  //   - if any measured row exists, candidatePool = measuredActive
  //     (projected rows still surface in `alternates` via `enforced`)
  //   - if no measured row exists, candidatePool = projectedActive
  //     (the documented fallback path; e.g. fiscal_balance_pct_gdp
  //      where IMF is the only source globally and IMF only ships
  //      projections for it)
  //
  // `enforced` (the full active+rejected set) keeps flowing through
  // to `finalize()` unchanged so the alternates panel sees every row.
  const measuredActive = active.filter((r) => r.valueType !== "projected");
  const projectedActive = active.filter((r) => r.valueType === "projected");
  const candidatePool = measuredActive.length > 0 ? measuredActive : projectedActive;

  // §3.1 single source — applied to the chosen pool.
  if (candidatePool.length === 1) {
    return finalize(candidatePool[0], candidatePool, enforced, "single_source", proposedDisputes);
  }

  const cia = candidatePool.find((r) => r.sourceId === "cia_factbook") ?? null;
  const nonCia = candidatePool.filter((r) => r.sourceId !== "cia_factbook");

  // §3.2 agreement-within-tolerance.
  // For Group A and Group C (slow-changing), agreement → CIA wins,
  // matching the methodology's "prefer CIA wording" stance.
  // For Group B (fast-changing) we deliberately do NOT short-circuit
  // on agreement: §12.1 (Nigeria population) shows WB winning over
  // CIA even when both are within 2%. The freshness signal still
  // matters because the upstream dataset's `as_of` IS the value's
  // identity for a quantitative fact. We instead let `resolveGroupB`
  // walk the freshness ladder; if no challenger is fresher, the
  // `single_source` path returns CIA naturally.
  if (def.group !== "B" && allAgree(candidatePool, def)) {
    const winner = cia ?? lowestTierFirst(candidatePool);
    return finalize(winner, candidatePool, enforced, "agreement", proposedDisputes);
  }

  // Disagreement — branch on group.
  if (def.group === "A") {
    return resolveGroupA(candidatePool, cia, nonCia, enforced, def, proposedDisputes);
  }
  if (def.group === "C") {
    return resolveGroupC(candidatePool, cia, nonCia, enforced, def, proposedDisputes);
  }
  // Group B — fast-changing quantitative.
  return resolveGroupB(candidatePool, cia, nonCia, enforced, def, proposedDisputes, jurisdictionIso3);
}

/* ────────────────────────────────────────────────────────────────
 * Group-specific branches
 * ──────────────────────────────────────────────────────────────── */

function resolveGroupA(
  active: FactRow[],
  cia: FactRow | null,
  nonCia: FactRow[],
  all: FactRow[],
  def: FactKeyDefinition,
  base: ProposedDispute[]
): CoreResolverOutput {
  // §3.4 — CIA wins by default. Wikidata can win ONLY if CIA empty.
  if (cia && hasValue(cia)) {
    const disputes = nonCia
      .filter((c) => !valuesAgree(cia, c, def))
      .map<ProposedDispute>((c) => ({
        kind: "group_a_override",
        factIdA: cia.id,
        factIdB: c.id,
        description: `Group A identity fact disagreement: '${cia.factValue ?? ""}' (CIA) vs '${c.factValue ?? ""}' (${c.sourceId}). CIA retained per methodology §3.4.`,
      }));
    return finalize(cia, active, all, "cia_default_group_a", [...base, ...disputes]);
  }

  // CIA missing — Wikidata may win if it has Tier 1/2 reference
  // and is preferred-or-unique-non-deprecated.
  const wikidataCandidates = nonCia.filter(
    (r) => r.sourceId === "wikidata" && passesReferenceFloor(r)
  );
  const preferredOrUnique =
    wikidataCandidates.find((r) => r.wikidataRank === "preferred") ??
    (wikidataCandidates.length === 1 &&
    wikidataCandidates[0].wikidataRank !== "deprecated"
      ? wikidataCandidates[0]
      : null);

  if (preferredOrUnique) {
    return finalize(preferredOrUnique, active, all, "fresher_winner", base);
  }

  // Fall back to lowest-tier non-CIA active row.
  const fallback = lowestTierFirst(active);
  return finalize(fallback, active, all, "single_source", base);
}

function resolveGroupC(
  active: FactRow[],
  cia: FactRow | null,
  nonCia: FactRow[],
  all: FactRow[],
  def: FactKeyDefinition,
  base: ProposedDispute[]
): CoreResolverOutput {
  // §3.5 — CIA wins, full stop. Always emit a dispute on
  // disagreement; the operator UI can dismiss it as not-meaningful
  // (e.g. the Vatican religion 100% vs 99% editorial-colour case).
  if (cia && hasValue(cia)) {
    const disputes = nonCia
      .filter((c) => !valuesAgree(cia, c, def))
      .map<ProposedDispute>((c) => ({
        kind: "group_c_override",
        factIdA: cia.id,
        factIdB: c.id,
        description: `Group C structural fact disagreement: CIA retained per methodology §3.5; ${c.sourceId} alternate value preserved for transparency.`,
      }));
    return finalize(cia, active, all, "cia_default_group_c", [...base, ...disputes]);
  }
  // No CIA row — degrade to lowest tier.
  return finalize(lowestTierFirst(active), active, all, "single_source", base);
}

function resolveGroupB(
  active: FactRow[],
  cia: FactRow | null,
  _nonCia: FactRow[],
  all: FactRow[],
  def: FactKeyDefinition,
  base: ProposedDispute[],
  jurisdictionIso3?: string | null
): CoreResolverOutput {
  // §3.3 — fresher allow-listed source wins, with two guards.
  // Prior canonical is CIA when available, else the freshest active
  // row that passes the reference-quality floor.
  const prior =
    cia ??
    [...active]
      .filter(passesReferenceFloor)
      .sort((a, b) => {
        const df = freshness(b) - freshness(a);
        if (df !== 0) return df;
        const priority =
          sourcePrecedenceRank(a, def, jurisdictionIso3) -
          sourcePrecedenceRank(b, def, jurisdictionIso3);
        if (priority !== 0) return priority;
        return a.sourceId.localeCompare(b.sourceId);
      })[0] ??
    lowestTierFirst(active);

  // Sort challengers freshest-first; on tie, prefer the row with the
  // lowest priority number (higher priority).
  //
  // NSO-priority-tier patch (R.13–R.20):
  //   Tier 0 — NSO for own country: deterministic NSO-prefer for tied
  //             dates (Eurozone coexistence fix — see nso-overrides.ts
  //             and ~/civica/plan/insee-fr-resolution-v1.md §"Eurostat
  //             coexistence handling").
  //   Tier 1 — direct primary publishers (World Bank, IMF, UN, OECD,
  //             Eurostat, any non-Wikidata non-CIA non-NSO source).
  //   Tier 2 — Wikidata (identity spine, not a primary measurement source).
  //   Tier 3 — CIA Factbook (frozen Jan 2026; last preference among ties).
  //
  // For countries without a registered NSO, NSO-tier is never
  // assigned (isNsoForJurisdiction returns false), so the old
  // 3-tier behaviour is preserved exactly.
  const sourcePriority = (r: FactRow): number =>
    sourcePrecedenceRank(r, def, jurisdictionIso3);
  const challengers = active
    .filter((r) => r.id !== prior.id)
    .sort((a, b) => {
      const df = freshness(b) - freshness(a);
      if (df !== 0) return df;
      const priority = sourcePriority(a) - sourcePriority(b);
      if (priority !== 0) return priority;
      return a.sourceId.localeCompare(b.sourceId);
    });

  let winner = prior;
  const disputes: ProposedDispute[] = [...base];

  for (const cand of challengers) {
    // Strictly fresher OR equally-fresh-but-higher-priority source.
    const fresher = isFresher(cand, winner);
    const tied = freshness(cand) === freshness(winner);
    const ranksHigher = sourcePriority(cand) < sourcePriority(winner);
    if (!fresher && !(tied && ranksHigher)) continue;

    // Guard 1 — material-error.
    if (isMaterialError(winner, cand, def)) {
      disputes.push({
        kind: "material_error",
        factIdA: winner.id,
        factIdB: cand.id,
        description: `Material-error rejection: ${displayValue(cand)} from ${cand.sourceId} differs from ${displayValue(winner)} (${winner.sourceId}) beyond the per-fact threshold.`,
      });
      continue;
    }
    // Guard 2 — reference-quality floor.
    if (!passesReferenceFloor(cand)) {
      // No dispute — failing the floor is a sync-time-style
      // rejection, not a methodology-level conflict.
      continue;
    }
    winner = cand;
  }

  // Q3 — growth-methodology comparability rule (fact-key-scoped).
  //
  // For `gdp_real_growth_rate` only: when ≥2 publishers exist AND at
  // least one reports on the comparable annual year-on-year basis AND at
  // least one reports on a different basis (four-quarter accumulated,
  // QoQ seasonally adjusted, annualized QoQ), prefer the annual-YoY
  // publisher — UNLESS the non-YoY publisher is more than 12 months
  // fresher. A raw freshness ladder would otherwise let a quarter's QoQ
  // print outrank the comparable annual figure everyone else uses.
  //
  // Applies only when the freshness winner above is a non-YoY row; if the
  // annual-YoY publisher already won on freshness, nothing changes.
  // Fact-key-scoped exactly like the per-fact threshold params.
  // Resolution: `~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md`.
  const growthYoyWinner = preferAnnualYoyForGrowth(def, active, winner);
  if (growthYoyWinner && growthYoyWinner.id !== winner.id) {
    winner = growthYoyWinner;
  }

  // Decision-reason naming:
  //   - `fresher_winner` — a non-prior row beat the prior on
  //     freshness (or freshness tie + higher source priority).
  //   - `incumbent_held` — the prior was already the freshest /
  //     highest-priority allow-listed row, and held its position
  //     against challengers. This is meaningfully different from
  //     `single_source`: there ARE other active rows, but the
  //     incumbent won the freshness comparison. The alternate-
  //     values panel uses this to display "[winner] is fresher
  //     than [N alternate]" rather than "single source."
  const finalReason: DecisionReason =
    winner.id === prior.id
      ? active.length === 1
        ? "single_source"
        : "incumbent_held"
      : "fresher_winner";
  return finalize(winner, active, all, finalReason, disputes);
}

function sourcePrecedenceRank(
  row: FactRow,
  def: FactKeyDefinition,
  jurisdictionIso3?: string | null,
): number {
  if (isNsoForJurisdiction(row.sourceId, jurisdictionIso3)) return 0;
  if (row.sourceId === "cia_factbook") return 5;
  if (row.sourceId === "wikidata") return 4;
  const lineage = resolveSourceLineage({
    sourceId: row.sourceId,
    factKey: def.key,
    jurisdictionIso3,
  });
  // UN Data is Civica's registered direct access path to UN WPP/UNSD
  // outputs. It wins an equal-vintage tie against downstream republishers
  // in the same family without being mislabeled as their statistical
  // originator.
  if (row.sourceId === "un_data") return 1;
  if (lineage.relationship === "originator") return 1;
  if (lineage.relationship === "republisher") return 2;
  if (lineage.relationship === "compilation") return 3;
  return 4;
}

/* ────────────────────────────────────────────────────────────────
 * Predicates and helpers
 * ──────────────────────────────────────────────────────────────── */

/** Growth fact-keys the Q3 comparability rule applies to. Both the
 *  Phase F key and the CIA legacy alias share the same growth semantics. */
const GROWTH_FACT_KEYS = new Set(["gdp_real_growth_rate", "gdp_growth_rate"]);

/**
 * Calendar-aware "is A more than 12 months fresher than B?" — the freshness
 * edge a non-YoY growth publisher must exceed to keep the canonical pick
 * from the annual-YoY publisher (Q3).
 *
 * A fixed 365-day window is wrong across a leap year: two figures one
 * calendar year apart (e.g. as_of 2024-01-01 vs 2025-01-01) span 366 days,
 * which a 365-day threshold would misread as ">12 months". We instead shift
 * B's freshness date forward 12 calendar months and require A to be strictly
 * later than that, so exactly-one-year-apart figures are NOT ">12 months".
 */
function moreThanTwelveMonthsFresher(aMs: number, bMs: number): boolean {
  const b = new Date(bMs);
  const bPlus12 = new Date(b);
  bPlus12.setUTCMonth(bPlus12.getUTCMonth() + 12);
  return aMs > bPlus12.getTime();
}

/**
 * Q3 — growth-methodology comparability adjustment.
 *
 * When resolving a growth fact-key and the freshness winner is NOT on the
 * comparable `annual_yoy` basis, look for an annual-YoY publisher in the
 * active pool. If one exists AND the current (non-YoY) winner is not more
 * than 12 months fresher than it, return that annual-YoY row so the
 * canonical pick uses the comparable basis. Returns `null` to leave the
 * winner unchanged (non-growth key, winner already YoY, no YoY publisher,
 * or the non-YoY winner is >12 months fresher).
 *
 * When several annual-YoY publishers qualify, the freshest wins (ties
 * broken by lowest source-priority number via the caller's ordering — the
 * pool is already effectively ordered, so we pick the freshest here).
 */
function preferAnnualYoyForGrowth(
  def: FactKeyDefinition,
  active: FactRow[],
  winner: FactRow
): FactRow | null {
  if (!GROWTH_FACT_KEYS.has(def.key)) return null;
  // Winner already on the comparable basis — nothing to prefer.
  if (isAnnualYoy(winner.growthMethodology)) return null;

  // Candidate annual-YoY publishers (excluding the winner itself).
  const yoy = active.filter(
    (r) => r.id !== winner.id && isAnnualYoy(r.growthMethodology)
  );
  if (yoy.length === 0) return null;

  // Need a genuine methodology MIX: at least one non-YoY row present.
  // The winner is non-YoY by the guard above, so the mix already holds.

  // Freshest annual-YoY publisher.
  const bestYoy = [...yoy].sort((a, b) => freshness(b) - freshness(a))[0];

  // Keep the non-YoY winner only if it is MORE THAN 12 months fresher than
  // the best annual-YoY publisher. Otherwise prefer the annual-YoY row.
  if (moreThanTwelveMonthsFresher(freshness(winner), freshness(bestYoy))) {
    return null;
  }

  return bestYoy;
}

function finalize(
  canonical: FactRow,
  active: FactRow[],
  all: FactRow[],
  decisionReason: DecisionReason,
  proposedDisputes: ProposedDispute[]
): CoreResolverOutput {
  // Bug 1 — alternates includes BOTH measured + projected active rows
  // so the alternate-values panel can render the full source set.
  // The decision logic above already chose `canonical` from the
  // measurement pool when one existed; projected rows that lost the
  // canonical race still surface here for transparency.
  //
  // We deliberately build alternates from `all` (the enforced set,
  // status='active') rather than the `active` parameter (which is
  // typically the measured-only candidatePool). Rejected rows in
  // `all` (envelope failures) stay in `all` itself for audit but are
  // excluded from the alternates list.
  const activeFromAll = all.filter((r) => r.status === "active");
  const alternates = [
    canonical,
    ...activeFromAll.filter((r) => r.id !== canonical.id),
  ];
  const canonicalIsProjection = canonical.valueType === "projected";
  return {
    canonical,
    alternates,
    all,
    decisionReason,
    proposedDisputes,
    canonicalIsProjection,
  };
}

function buildDecisionTrace(
  inputRows: FactRow[],
  def: FactKeyDefinition,
  output: CoreResolverOutput,
  jurisdictionIso3?: string | null,
): DecisionTraceStep[] {
  const trace: DecisionTraceStep[] = [];
  const active = output.all.filter((row) => row.status === "active");
  const rejected = output.all.filter((row) => row.status === "rejected");
  trace.push({
    code: "row_eligibility",
    outcome: active.length > 0 ? "eligible_rows_found" : "no_active_rows",
    detail: `${active.length} active row(s) remained from ${inputRows.length}; ${rejected.length} rejected row(s) were retained for audit.`,
    sourceIds: [...new Set(active.map((row) => row.sourceId))].sort(),
  });
  if (!output.canonical) return trace;

  const measured = active.filter((row) => row.valueType !== "projected");
  const projected = active.filter((row) => row.valueType === "projected");
  trace.push({
    code: "measurement_partition",
    outcome: measured.length > 0 ? "measurements_preferred" : "projection_fallback",
    detail:
      measured.length > 0
        ? `${measured.length} measured row(s) formed the candidate pool; ${projected.length} projection(s) remained visible as alternates.`
        : `No measured row was available; ${projected.length} projected row(s) formed the fallback candidate pool.`,
    sourceIds: [...new Set((measured.length > 0 ? measured : projected).map((row) => row.sourceId))].sort(),
  });

  const lineage = resolveSourceLineage({
    sourceId: output.canonical.sourceId,
    factKey: def.key,
    jurisdictionIso3,
  });
  trace.push({
    code: "source_lineage",
    outcome: lineage.relationship,
    detail: `Selected source belongs to producing family '${lineage.familyId}'. ${lineage.basis}`,
    sourceIds: [output.canonical.sourceId],
  });

  const precedenceDetail: Record<DecisionReason, string> = {
    single_source: "One eligible candidate remained after partitioning and guards.",
    agreement: "Eligible Group A/C rows agreed within the registered tolerance; the declared incumbent wording rule applied.",
    fresher_winner: "A challenger won on measurement freshness, an equal-vintage source-priority tie, or the registered growth-comparability rule.",
    incumbent_held: "The incumbent remained at least as fresh and no eligible challenger displaced it.",
    cia_default_group_a: "Group A identity policy retained the CIA incumbent; disagreement requires reviewer signoff.",
    cia_default_group_c: "Group C narrative/structural policy retained the CIA incumbent; disagreement remains reviewable.",
    no_active_rows: "No canonical row was selected.",
  };
  trace.push({
    code: "precedence_rule",
    outcome: output.decisionReason,
    detail: precedenceDetail[output.decisionReason],
    sourceIds: [output.canonical.sourceId],
  });

  const materialErrors = output.proposedDisputes.filter(
    (row) => row.kind === "material_error" || row.kind === "plausibility_envelope",
  );
  trace.push({
    code: "guard_result",
    outcome: materialErrors.length > 0 ? "challenger_rejected" : "guards_passed",
    detail:
      materialErrors.length > 0
        ? `${materialErrors.length} candidate guard failure(s) were retained as proposed disputes.`
        : "The selected row passed the plausibility, material-error, and reference-quality guards.",
    sourceIds: [output.canonical.sourceId],
  });

  const vintage = output.canonical.dataVintageYear
    ? `data vintage ${output.canonical.dataVintageYear}`
    : output.canonical.asOf
      ? `as of ${output.canonical.asOf}`
      : output.canonical.factYear
        ? `fact year ${output.canonical.factYear}`
        : `retrieved ${output.canonical.retrievedAt}`;
  trace.push({
    code: "canonical_selection",
    outcome: "selected",
    detail: `${output.canonical.sourceId} was selected as the ${output.canonical.valueType} canonical (${vintage}) under ${SOURCE_PRECEDENCE_VERSION}.`,
    sourceIds: [output.canonical.sourceId],
  });
  return trace;
}

function hasValue(row: FactRow): boolean {
  if (row.factValueNumeric != null) return true;
  if (row.factValue != null && row.factValue.trim().length > 0) return true;
  if (row.valueJson != null) return true;
  return false;
}

/** True when EVERY pair of active rows agrees on value. */
function allAgree(rows: FactRow[], def: FactKeyDefinition): boolean {
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (!valuesAgree(rows[i], rows[j], def)) return false;
    }
  }
  return true;
}

/** Per-category tolerance check (methodology §3.2). */
function valuesAgree(
  a: FactRow,
  b: FactRow,
  def: FactKeyDefinition
): boolean {
  if (a.factValueNumeric != null && b.factValueNumeric != null) {
    if (def.envelope?.isPercent) {
      // Percentage points within 0.5 pp.
      return Math.abs(a.factValueNumeric - b.factValueNumeric) <= 0.5;
    }
    // Counts within 2% relative.
    const denom = Math.max(Math.abs(a.factValueNumeric), Math.abs(b.factValueNumeric));
    if (denom === 0) return a.factValueNumeric === b.factValueNumeric;
    return Math.abs(a.factValueNumeric - b.factValueNumeric) / denom <= 0.02;
  }
  // Categorical strings.
  const aText = normalizeText(a.factValue);
  const bText = normalizeText(b.factValue);
  if (aText.length === 0 || bText.length === 0) return false;
  return aText === bText;
}

/** Methodology §3.3 Guard 1. */
function isMaterialError(
  prior: FactRow,
  candidate: FactRow,
  def: FactKeyDefinition
): boolean {
  if (prior.factValueNumeric == null || candidate.factValueNumeric == null) {
    return false;
  }
  const a = prior.factValueNumeric;
  const b = candidate.factValueNumeric;

  // F.6.1 — prefer the absolute (pp / unit) threshold whenever the
  // fact-key registers one. Percentage-shaped facts (inflation_rate,
  // public_debt_pct_gdp, literacy_rate, internet_users_pct, etc.)
  // express their material-error policy in percentage points, and
  // some of them register `isPercent: false` deliberately to skip
  // the [-1, 101] envelope auto-tightening (inflation can exceed
  // 100%). The previous gate on `def.envelope?.isPercent` silently
  // bypassed the pp threshold for those keys.
  const pp = def.materialErrorPpThreshold;
  if (pp != null) {
    return Math.abs(a - b) > pp;
  }

  const pct = def.materialErrorPctThreshold;
  if (pct == null) return false;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  if (denom === 0) return false;
  return Math.abs(a - b) / denom > pct;
}

/** Methodology §3.6 envelope. */
function violatesEnvelope(row: FactRow, def: FactKeyDefinition): boolean {
  const env = def.envelope;
  if (!env) return false;
  const v = row.factValueNumeric;
  if (v == null) return false;
  if (env.min != null && v < env.min) return true;
  if (env.max != null && v > env.max) return true;
  return false;
}

/** Reference-quality floor (methodology §3.3 Guard 2 / §3.4 / §3.5). */
function passesReferenceFloor(row: FactRow): boolean {
  // CIA Factbook is Tier 3 but is the methodology default — always
  // passes the floor since identity facts default to it.
  if (row.sourceId === "cia_factbook") return true;

  // Direct Tier-1/2 sources: any allowlist entry whose tier is
  // 1 or 2 satisfies. We treat `sourceId` as a domain-or-Q-ID-like
  // handle; the allowlist exposes its own typing via
  // `findAllowlistEntry()`. Avoid coupling to that function here —
  // every non-Wikidata, non-CIA source is registered in `sources`
  // and Phase F's sync scripts gate insertion on the same allowlist,
  // so by-construction these rows ARE allow-listed. Treat them as
  // passing.
  if (row.sourceId !== "wikidata") return true;

  // Wikidata: the row's `references` array must have at least one
  // accepted upstream reference (§2.3 — "at least one" suffices).
  if (!row.references || !Array.isArray(row.references)) return false;
  for (const ref of row.references) {
    if (!ref || typeof ref !== "object") continue;
    const r = ref as Record<string, unknown>;
    const pid = typeof r.pid === "string" ? r.pid : null;
    if (pid && SELF_CITING_PIDS.has(pid)) continue;
    // Accept either canonical `qid` or sync-script-friendly aliases.
    const qid =
      typeof r.qid === "string"
        ? r.qid
        : typeof r.statedInQid === "string"
          ? r.statedInQid
          : undefined;
    const url = typeof r.url === "string" ? r.url : undefined;
    if (isAllowedReference({ qid, url })) return true;
  }
  return false;
}

/** Lower-numbered tier ranks ahead of higher-numbered. CIA is
 *  Tier 3; Wikidata as a source ID surfaces as Tier 4 unless its
 *  references upgrade it. We don't try to resolve the actual tier
 *  number per row — just give CIA last-priority for non-agreement
 *  fallback and order the rest by `retrieved_at`. */
function lowestTierFirst(rows: FactRow[]): FactRow {
  const nonCia = rows.filter((r) => r.sourceId !== "cia_factbook");
  if (nonCia.length === 0) return rows[0];
  return [...nonCia].sort((a, b) => freshness(b) - freshness(a))[0];
}

function freshness(row: FactRow): number {
  // `dataVintageYear` records the REAL underlying measurement year when
  // it differs from the publisher's prose-vintage stamp. It wins the
  // ladder so a source that restamps a republication year (e.g. CIA's
  // "(2025 est.)" projection built off prior-year data) is ranked by the
  // measurement's true age, not by the year written on the label. The
  // resolver stays generic — the vintage judgment lives in the DATA (the
  // column) and the seed/backfill scripts, never in per-source branches
  // here. NULL falls through to the existing stamp ladder.
  // See `~/civica/plan/cia-stale-vintage-resolution-v1.md` (Option A).
  if (row.dataVintageYear != null) return Date.UTC(row.dataVintageYear, 0, 1);
  if (row.asOf) return Date.parse(row.asOf);
  if (row.factYear != null) return Date.UTC(row.factYear, 0, 1);
  return Date.parse(row.retrievedAt);
}

function isFresher(a: FactRow, b: FactRow): boolean {
  return freshness(a) > freshness(b);
}

function normalizeText(v: string | null): string {
  if (v == null) return "";
  return v.normalize("NFC").trim().toLowerCase();
}

function displayValue(row: FactRow): string {
  if (row.factValue) return row.factValue;
  if (row.factValueNumeric != null) return String(row.factValueNumeric);
  return "(empty)";
}

/* ────────────────────────────────────────────────────────────────
 * DB readers (impure)
 * ──────────────────────────────────────────────────────────────── */

async function readRows(
  jurisdictionId: string,
  factKey: string
): Promise<FactRow[]> {
  const dbRows = await db
    .select()
    .from(countryFacts)
    .where(
      and(
        eq(countryFacts.jurisdictionId, jurisdictionId),
        eq(countryFacts.factKey, factKey)
      )
    )
    .orderBy(desc(countryFacts.retrievedAt));

  return dbRows.map(rowFromDb);
}

/**
 * Look up the ISO-3166-1 alpha-3 code for a jurisdiction by its
 * internal UUID. Returns null for non-sovereign territories (Vatican,
 * Taiwan, Western Sahara) that may lack an iso3 value.
 *
 * NSO-priority-tier patch (R.13–R.20): called once per `resolveFact()`
 * invocation so `resolveGroupB` can apply the NSO tiebreak without
 * an extra round-trip inside the pure resolution logic.
 */
async function readJurisdictionIso3(
  jurisdictionId: string
): Promise<string | null> {
  const rows = await db
    .select({ iso3: jurisdictions.iso3 })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, jurisdictionId))
    .limit(1);
  return rows[0]?.iso3 ?? null;
}

async function readIsDisputed(
  jurisdictionId: string,
  factKey: string
): Promise<boolean> {
  const open = await db
    .select({ id: dataDisputes.id })
    .from(dataDisputes)
    .where(
      and(
        eq(dataDisputes.jurisdictionId, jurisdictionId),
        eq(dataDisputes.factKey, factKey),
        inArray(dataDisputes.status, ["open", "in_review"])
      )
    )
    .limit(1);
  return open.length > 0;
}

/** Hydrate a Drizzle row into the resolver's `FactRow` shape.
 *  Keeps the resolver insulated from DB-column-naming churn. */
function rowFromDb(r: typeof countryFacts.$inferSelect): FactRow {
  return {
    id: r.id,
    jurisdictionId: r.jurisdictionId,
    factKey: r.factKey,
    factGroup: (r.factGroup as FactRow["factGroup"]) ?? "B",
    category: r.category,
    sourceId: r.sourceId,
    sourceUrl: r.sourceUrl ?? null,
    wikidataQid: r.wikidataQid ?? null,
    wikidataPid: r.wikidataPid ?? null,
    wikidataRank: (r.wikidataRank as FactRow["wikidataRank"]) ?? null,
    references: (r.references as unknown[] | null) ?? null,
    factValue: r.factValue ?? null,
    factValueNumeric:
      r.factValueNumeric == null ? null : Number(r.factValueNumeric),
    factUnit: r.factUnit ?? null,
    factYear: r.factYear ?? null,
    valueJson: r.valueJson ?? null,
    asOf: r.asOf ?? null,
    dataVintageYear: r.dataVintageYear ?? null,
    retrievedAt:
      r.retrievedAt instanceof Date
        ? r.retrievedAt.toISOString()
        : String(r.retrievedAt),
    upstreamVintageLabel: r.upstreamVintageLabel ?? null,
    methodologyVersion: r.methodologyVersion,
    status: (r.status as FactRowStatus) ?? "active",
    statusReason: r.statusReason ?? null,
    sourceNote: r.sourceNote ?? null,
    // Bug 1 — defensive hydrate. Schema default is 'measured' so legacy
    // rows backfill correctly; this nullish coalesce just makes the
    // resolver robust against a hypothetical DB-side null.
    valueType:
      r.valueType === "projected" ? "projected" : "measured",
    // Growth-methodology discriminator — NULL on non-growth fact-keys.
    // Stored column wins; falls back to the per-source default when a
    // growth row has not yet been labelled (new row before backfill).
    growthMethodology: resolveGrowthMethodology(
      r.growthMethodology,
      r.sourceId,
      r.factKey
    ),
  };
}
