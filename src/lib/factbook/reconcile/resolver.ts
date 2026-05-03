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
import { countryFacts, dataDisputes } from "@/lib/db/schema";
import {
  getFactKey,
  type FactKeyDefinition,
} from "@/lib/factbook/reconcile/fact-keys";
import { isAllowedReference } from "@/lib/factbook/reconcile/source-allowlist";
import type {
  DecisionReason,
  FactRow,
  FactRowStatus,
  ProposedDispute,
  ResolverOutput,
} from "@/lib/factbook/reconcile/types";

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
      proposedDisputes: [],
    };
  }

  const rows = options?.rows ?? (await readRows(jurisdictionId, factKey));
  const pure = resolveFromRows(rows, def);

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
 */
export function resolveFromRows(
  rows: FactRow[],
  def: FactKeyDefinition
): Omit<ResolverOutput, "jurisdictionId" | "factKey" | "isDisputed"> {
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

  const active = enforced.filter((r) => r.status === "active");
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
    };
  }

  // §3.1 single source
  if (active.length === 1) {
    return finalize(active[0], active, enforced, "single_source", proposedDisputes);
  }

  const cia = active.find((r) => r.sourceId === "cia_factbook") ?? null;
  const nonCia = active.filter((r) => r.sourceId !== "cia_factbook");

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
  if (def.group !== "B" && allAgree(active, def)) {
    const winner = cia ?? lowestTierFirst(active);
    return finalize(winner, active, enforced, "agreement", proposedDisputes);
  }

  // Disagreement — branch on group.
  if (def.group === "A") {
    return resolveGroupA(active, cia, nonCia, enforced, def, proposedDisputes);
  }
  if (def.group === "C") {
    return resolveGroupC(active, cia, nonCia, enforced, def, proposedDisputes);
  }
  // Group B — fast-changing quantitative.
  return resolveGroupB(active, cia, nonCia, enforced, def, proposedDisputes);
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
): Omit<ResolverOutput, "jurisdictionId" | "factKey" | "isDisputed"> {
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
): Omit<ResolverOutput, "jurisdictionId" | "factKey" | "isDisputed"> {
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
  base: ProposedDispute[]
): Omit<ResolverOutput, "jurisdictionId" | "factKey" | "isDisputed"> {
  // §3.3 — fresher allow-listed source wins, with two guards.
  // Prior canonical is CIA when available, else the freshest active
  // row that passes the reference-quality floor.
  const prior =
    cia ??
    [...active]
      .filter(passesReferenceFloor)
      .sort((a, b) => freshness(b) - freshness(a))[0] ??
    lowestTierFirst(active);

  // Sort challengers freshest-first; on tie, prefer direct primary
  // sources (anything not Wikidata, not CIA) over the Wikidata pipe.
  // This ensures §12.1 Nigeria-pop scenario picks World Bank rather
  // than Wikidata when both quote the same year.
  const sourcePriority = (r: FactRow): number => {
    if (r.sourceId === "cia_factbook") return 2; // last preference among ties
    if (r.sourceId === "wikidata") return 1;
    return 0; // direct primary (World Bank, IMF, UN, NSO) wins ties
  };
  const challengers = active
    .filter((r) => r.id !== prior.id)
    .sort((a, b) => {
      const df = freshness(b) - freshness(a);
      if (df !== 0) return df;
      return sourcePriority(a) - sourcePriority(b);
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

/* ────────────────────────────────────────────────────────────────
 * Predicates and helpers
 * ──────────────────────────────────────────────────────────────── */

function finalize(
  canonical: FactRow,
  active: FactRow[],
  all: FactRow[],
  decisionReason: DecisionReason,
  proposedDisputes: ProposedDispute[]
): Omit<ResolverOutput, "jurisdictionId" | "factKey" | "isDisputed"> {
  const alternates = [
    canonical,
    ...active.filter((r) => r.id !== canonical.id),
  ];
  return { canonical, alternates, all, decisionReason, proposedDisputes };
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

  if (def.envelope?.isPercent) {
    const pp = def.materialErrorPpThreshold;
    if (pp == null) return false;
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
    retrievedAt:
      r.retrievedAt instanceof Date
        ? r.retrievedAt.toISOString()
        : String(r.retrievedAt),
    upstreamVintageLabel: r.upstreamVintageLabel ?? null,
    methodologyVersion: r.methodologyVersion,
    status: (r.status as FactRowStatus) ?? "active",
    statusReason: r.statusReason ?? null,
    sourceNote: r.sourceNote ?? null,
  };
}
