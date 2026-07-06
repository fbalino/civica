/**
 * Phase F — shared types for the per-fact reconciliation resolver.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §3, §6, §13
 * Schema doc:  ~/civica/plan/phase-f-schema-v0.1.md §1
 *
 * The resolver is pure rule logic — no LLM, no IO beyond a DB read
 * in `resolveFact()`. The types here are consumed by the resolver,
 * by sync scripts (which decide what to materialize as
 * `data_disputes`), and by downstream UI (`<FactValuePanel>`).
 */

/**
 * Lifecycle status of a `country_facts` row.
 *
 * - `active`     — eligible input to the resolver.
 * - `rejected`   — kept for transparency, excluded from resolver
 *                  input (e.g. failed plausibility envelope, failed
 *                  reference-quality floor).
 * - `superseded` — outranked by a fresher row from the same source;
 *                  also kept for the alternate-values panel but not
 *                  considered current.
 * - `demoted`    — F.5.1: a reviewer resolved a `data_disputes` row
 *                  in favour of a different source. Kept for the
 *                  alternate-values panel + audit; the resolver
 *                  excludes it from its `active` filter so the
 *                  reviewer's choice survives.
 */
export type FactRowStatus =
  | "active"
  | "rejected"
  | "superseded"
  | "demoted";

/**
 * Bug 1 — measurement vs. projection partition.
 *
 * - `measured`  — empirical observation at the upstream's vintage cut
 *                  (or a model-imputed measurement the upstream itself
 *                  publishes as a measurement, e.g., ILO modelled
 *                  estimates, UNDP HDI composite).
 * - `projected` — a model output the upstream itself publishes as a
 *                  projection / forecast (e.g., IMF WEO forecast-year
 *                  rows, OECD Economic Outlook projection-year rows).
 *
 * The resolver prefers `measured` over `projected` for canonical
 * purposes; projected rows stay in alternates for transparency.
 *
 * See `~/civica/plan/forecast-vs-measurement-v1.md` for the
 * methodology.
 */
export type FactValueType = "measured" | "projected";

/**
 * Growth-methodology discriminator — the HOW behind a growth-rate figure.
 *
 * Different publishers report GDP growth on different measurement bases,
 * and the raw numbers are NOT directly comparable across bases. This
 * labels each `gdp_real_growth_rate` source row with its style so the
 * resolver can prefer the comparable annual-YoY publisher and the UI can
 * disclose the basis. NULL on every non-growth fact-key.
 *
 * - `annual_yoy` — annual real growth, year-on-year (the comparable
 *   default; World Bank, IMF, Eurostat, most NSOs).
 * - `four_quarter_accumulated_yoy` — four-quarter cumulative vs. the same
 *   period a year earlier (IBGE / Brazil).
 * - `qoq_seasonally_adjusted` — quarter-on-quarter, seasonally adjusted
 *   (Stats SA).
 * - `annualized_qoq` — quarter-on-quarter annualized (US BEA-style).
 * - `unspecified` — publisher's basis is unknown / not asserted.
 *
 * Human-readable labels + resolver preference logic live in
 * `src/lib/data/growth-methodology.ts`.
 * See `~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md`.
 */
export type GrowthMethodology =
  | "annual_yoy"
  | "four_quarter_accumulated_yoy"
  | "qoq_seasonally_adjusted"
  | "annualized_qoq"
  | "unspecified";

/**
 * Civica fact-group classification (methodology §1.1).
 *
 * Mirrors the `FactGroup` exported by the parallel agent's
 * `fact-keys.ts`. Re-declared here to avoid a hard import cycle —
 * keep these in sync.
 */
export type FactGroupLocal = "A" | "B" | "C";

/**
 * One row of `country_facts`, hydrated for resolver input.
 *
 * Field names mirror the Drizzle schema (camelCased). `valueJson` is
 * `unknown` because its shape varies by fact-key (breakdown structures
 * for religion / ethnicity / language).
 */
export interface FactRow {
  id: string;
  jurisdictionId: string;
  factKey: string;
  factGroup: FactGroupLocal;
  category: string;
  sourceId: string;
  sourceUrl: string | null;
  wikidataQid: string | null;
  wikidataPid: string | null;
  wikidataRank: "preferred" | "normal" | "deprecated" | null;
  references: unknown[] | null;
  factValue: string | null;
  factValueNumeric: number | null;
  factUnit: string | null;
  factYear: number | null;
  valueJson: unknown;
  asOf: string | null; // ISO date YYYY-MM-DD
  /**
   * Real underlying measurement year, when it differs from the
   * publisher's prose-vintage stamp (`factYear` / `asOf`). Non-null
   * only for rows whose stamp is a republication / projection year
   * (currently the five CIA demographic fact-keys — see
   * `~/civica/plan/cia-stale-vintage-resolution-v1.md`). When set, the
   * resolver's `freshness()` comparator uses it in preference to
   * `asOf` / `factYear`. NULL means "the stamp IS the measurement
   * year" and the standard ladder applies.
   */
  dataVintageYear: number | null;
  retrievedAt: string; // ISO timestamp
  upstreamVintageLabel: string | null;
  methodologyVersion: string;
  status: FactRowStatus;
  statusReason: string | null;
  sourceNote: string | null;
  /** Bug 1 — `measured` (default) or `projected`. Set by each sync
   *  orchestrator at write time. The resolver requires canonical to
   *  be a measured row whenever any measured row exists; falls back
   *  to projected rows only when no measurement is available.
   *  See `~/civica/plan/forecast-vs-measurement-v1.md`. */
  valueType: FactValueType;
  /** Growth-methodology discriminator — the measurement basis behind a
   *  growth-rate figure (annual YoY, four-quarter accumulated, QoQ
   *  seasonally adjusted, annualized QoQ). NULL on non-growth fact-keys
   *  and on growth rows whose basis has not been labelled. The resolver's
   *  `gdp_real_growth_rate` canonical pick prefers `annual_yoy` publishers
   *  over non-YoY ones unless the non-YoY row is materially fresher.
   *  See `~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md`. */
  growthMethodology: GrowthMethodology | null;
}

/**
 * Reasons a `data_disputes` row may be opened. Mirrors the
 * `dispute_kind` enum documented in `schema.ts:360`.
 */
export type DisputeKind =
  | "material_error"
  | "group_a_override"
  | "group_c_override"
  | "plausibility_envelope"
  | "rank_demoted"
  | "public_correction"
  | "other";

/**
 * Why the resolver chose the canonical row it returned. Useful for
 * debugging, audit log entries, and the operator UI.
 */
export type DecisionReason =
  | "single_source"
  | "agreement"
  | "fresher_winner"
  | "incumbent_held"
  | "cia_default_group_a"
  | "cia_default_group_c"
  | "no_active_rows";

/**
 * A dispute the resolver believes SHOULD exist given the row set.
 *
 * The resolver itself does NOT write to `data_disputes`. Callers
 * (sync scripts, the F.5 reviewer flow) materialize these rows.
 * Keeping the resolver pure preserves replayability for vintaging.
 */
export interface ProposedDispute {
  kind: DisputeKind;
  /** The row the resolver kept canonical, OR the prior canonical
   *  in cases where both sides are losing candidates. */
  factIdA: string;
  /** The row that triggered the dispute (the rejected candidate),
   *  or null when the dispute is unary (e.g. envelope rejection of
   *  the only available row). */
  factIdB: string | null;
  /** Operator-readable reason. */
  description: string;
}

/**
 * The result of `resolveFact()` / `resolveFromRows()`.
 */
export interface ResolverOutput {
  jurisdictionId: string;
  factKey: string;
  /** The chosen row, or `null` if no active row exists. */
  canonical: FactRow | null;
  /** All non-rejected rows the resolver considered, sorted with
   *  `canonical` first when present. */
  alternates: FactRow[];
  /** Every row the resolver received, including rejected ones,
   *  preserved for the alternate-values panel and audit. */
  all: FactRow[];
  /** True when an open / in-review `data_disputes` row exists for
   *  this `(jurisdictionId, factKey)`. Set by `resolveFact()`;
   *  `resolveFromRows()` always returns `false`. */
  isDisputed: boolean;
  /** Why this row won. */
  decisionReason: DecisionReason;
  /** Disputes the resolver would create if asked to materialize. */
  proposedDisputes: ProposedDispute[];
  /** Bug 1 — true when the canonical row is a `projected` (forecast)
   *  row because no `measured` row was available for this
   *  (jurisdiction, factKey). The fallback path described in
   *  `~/civica/plan/forecast-vs-measurement-v1.md` § 2e. UI surfaces
   *  use this flag to render a "projected" / amber-frozen badge.
   *  Always `false` when no rows exist or when the canonical row is
   *  itself measured. */
  canonicalIsProjection: boolean;
}
