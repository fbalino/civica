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
  retrievedAt: string; // ISO timestamp
  upstreamVintageLabel: string | null;
  methodologyVersion: string;
  status: FactRowStatus;
  statusReason: string | null;
  sourceNote: string | null;
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
}
