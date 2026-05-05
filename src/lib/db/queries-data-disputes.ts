/**
 * Phase F.5 — admin data-disputes queue query helpers.
 * Extended in R.21 for severity-based sort + source-pair / fact-key /
 * severity-bucket / age-bucket filter chips.
 *
 * The queue is `data_disputes` rows where `status = 'open' OR
 * status = 'in_review'` by default; pass `includeResolved` to also
 * see historical resolutions.
 *
 * Default sort (R.21): severity desc — normalized `|gap| / threshold`
 * — so the loudest disputes float to the top. Tiebreak on dispute_kind
 * urgency rank, then created_at desc. Group A / Group C / non-numeric
 * disputes have null severity and naturally sort to the tail.
 *
 * Methodology:
 *   - Phase F.5: ~/civica/plan/phase-f-methodology-v0.1.md §7
 *   - R.21 severity + chips: ~/civica/plan/disputes-triage-resolution-v1.md §2c
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  countryFacts,
  dataDisputes,
  jurisdictions,
} from "@/lib/db/schema";
import {
  computeSeverity,
  type SeverityBucket,
  type SeverityScore,
} from "@/lib/factbook/reconcile/dispute-severity";

const KIND_RANK: Record<string, number> = {
  material_error: 0,
  plausibility_envelope: 1,
  group_a_override: 2,
  group_c_override: 3,
  rank_demoted: 4,
  public_correction: 5,
  other: 99,
};

const GROUP_RANK: Record<string, number> = {
  A: 0,
  B: 1,
  C: 2,
};

/** Three-letter age buckets, half-open. */
export type AgeBucket = "0-7d" | "7-30d" | "30-90d" | "90d+";

export interface DisputeQueueRow {
  id: string;
  factKey: string;
  factGroup: string;
  disputeKind: string;
  status: string;
  proposedAction: string | null;
  description: string | null;
  country: { id: string; slug: string; name: string };
  factA: {
    id: string;
    sourceId: string;
    factValue: string | null;
    factValueNumeric: number | null;
    factUnit: string | null;
    factYear: number | null;
    asOf: string | null;
  } | null;
  factB: {
    id: string;
    sourceId: string;
    factValue: string | null;
    factValueNumeric: number | null;
    factUnit: string | null;
    factYear: number | null;
    asOf: string | null;
  } | null;
  submitterName: string | null;
  createdAt: string;
  /** R.21 — normalized severity score (`|gap| / threshold`). Null for
   *  non-numeric disputes or fact-keys without a registered threshold. */
  severity: SeverityScore;
}

export interface DisputeQueueResult {
  rows: DisputeQueueRow[];
  totalOpen: number;
  /** Total rows that match the active filter set (used for paging). */
  totalMatching: number;
}

export type DisputeSortKey = "severity" | "age" | "oldest";

export interface DisputeQueueFilters {
  factGroup?: string;
  disputeKind?: string;
  factKey?: string;
  /** Encoded as "sourceA|sourceB" (e.g. "cia_factbook|imf_weo"). */
  sourcePair?: string;
  severityBucket?: SeverityBucket;
  ageBucket?: AgeBucket;
  includeResolved?: boolean;
  sort?: DisputeSortKey;
  limit?: number;
  offset?: number;
}

/**
 * Read the dispute queue. By default returns open + in_review rows
 * sorted severity desc; pass `sort='age'` for newest-first or
 * `sort='oldest'` for FIFO.
 *
 * Severity-based filtering happens in-memory because the threshold
 * is per-fact-key TypeScript-side. The DB-side filters narrow the
 * working set first; we then compute severity on each row and
 * apply the bucket filter.
 */
export async function getDataDisputeQueue(
  opts: DisputeQueueFilters = {},
): Promise<DisputeQueueResult> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const sort: DisputeSortKey = opts.sort ?? "severity";

  const wheres: ReturnType<typeof sql>[] = [];
  if (!opts.includeResolved) {
    wheres.push(sql`d.status IN ('open', 'in_review')`);
  }
  if (opts.factGroup) wheres.push(sql`d.fact_group = ${opts.factGroup}`);
  if (opts.disputeKind) wheres.push(sql`d.dispute_kind = ${opts.disputeKind}`);
  if (opts.factKey) wheres.push(sql`d.fact_key = ${opts.factKey}`);

  // Source-pair encoded as "A|B"; either half can be empty (matches any).
  if (opts.sourcePair) {
    const [pa, pb] = opts.sourcePair.split("|");
    if (pa) wheres.push(sql`a.source_id = ${pa}`);
    if (pb) wheres.push(sql`b.source_id = ${pb}`);
  }

  // Age bucket — applied directly in SQL since it's just NOW() - created_at.
  if (opts.ageBucket) {
    switch (opts.ageBucket) {
      case "0-7d":
        wheres.push(sql`d.created_at > NOW() - INTERVAL '7 days'`);
        break;
      case "7-30d":
        wheres.push(
          sql`d.created_at <= NOW() - INTERVAL '7 days' AND d.created_at > NOW() - INTERVAL '30 days'`,
        );
        break;
      case "30-90d":
        wheres.push(
          sql`d.created_at <= NOW() - INTERVAL '30 days' AND d.created_at > NOW() - INTERVAL '90 days'`,
        );
        break;
      case "90d+":
        wheres.push(sql`d.created_at <= NOW() - INTERVAL '90 days'`);
        break;
    }
  }

  const whereClause =
    wheres.length > 0 ? sql`WHERE ${sql.join(wheres, sql` AND `)}` : sql``;

  // Pull every matching row. For typical volumes the queue is well
  // under 200 so this is a single round-trip. If we hit >2k disputes,
  // port the severity computation to a generated column + DB-side
  // filter (resolution doc §6 deferred item).
  const rowsResult = await db.execute(sql`
    SELECT
      d.id,
      d.fact_key,
      d.fact_group,
      d.dispute_kind,
      d.status,
      d.proposed_action,
      d.description,
      d.fact_id_a,
      d.fact_id_b,
      d.submitter_name,
      d.created_at,
      j.id  AS jurisdiction_id,
      j.slug AS country_slug,
      j.name AS country_name,
      a.source_id          AS a_source_id,
      a.fact_value         AS a_fact_value,
      a.fact_value_numeric AS a_fact_value_numeric,
      a.fact_unit          AS a_fact_unit,
      a.fact_year          AS a_fact_year,
      a.as_of              AS a_as_of,
      b.source_id          AS b_source_id,
      b.fact_value         AS b_fact_value,
      b.fact_value_numeric AS b_fact_value_numeric,
      b.fact_unit          AS b_fact_unit,
      b.fact_year          AS b_fact_year,
      b.as_of              AS b_as_of
    FROM data_disputes d
    JOIN jurisdictions j ON j.id = d.jurisdiction_id
    LEFT JOIN country_facts a ON a.id = d.fact_id_a
    LEFT JOIN country_facts b ON b.id = d.fact_id_b
    ${whereClause}
  `);

  const raw = ((rowsResult as unknown as { rows?: unknown[] }).rows ??
    rowsResult) as Array<Record<string, unknown>>;

  // Hydrate severity in-process.
  type Hydrated = {
    raw: Record<string, unknown>;
    severity: SeverityScore;
  };
  const hydrated: Hydrated[] = raw.map((r) => {
    const aNum =
      r.a_fact_value_numeric != null ? Number(r.a_fact_value_numeric) : null;
    const bNum =
      r.b_fact_value_numeric != null ? Number(r.b_fact_value_numeric) : null;
    const score =
      r.dispute_kind === "material_error"
        ? computeSeverity(String(r.fact_key), aNum, bNum)
        : ({
            severity: null,
            bucket: null,
            gap: null,
            thresholdValue: null,
            thresholdKind: null,
          } as SeverityScore);
    return { raw: r, severity: score };
  });

  // Severity bucket filter (in-memory).
  const matchingBucket = opts.severityBucket
    ? hydrated.filter((h) => h.severity.bucket === opts.severityBucket)
    : hydrated;

  // Sort.
  matchingBucket.sort((x, y) => {
    if (sort === "age") {
      // Newest first.
      return String(y.raw.created_at).localeCompare(String(x.raw.created_at));
    }
    if (sort === "oldest") {
      return String(x.raw.created_at).localeCompare(String(y.raw.created_at));
    }
    // sort === "severity"
    const sx = x.severity.severity ?? -1;
    const sy = y.severity.severity ?? -1;
    if (sx !== sy) return sy - sx; // desc
    // Tiebreak: kind rank ascending.
    const kx = KIND_RANK[String(x.raw.dispute_kind)] ?? 99;
    const ky = KIND_RANK[String(y.raw.dispute_kind)] ?? 99;
    if (kx !== ky) return kx - ky;
    // Then group rank.
    const gx = GROUP_RANK[String(x.raw.fact_group)] ?? 99;
    const gy = GROUP_RANK[String(y.raw.fact_group)] ?? 99;
    if (gx !== gy) return gx - gy;
    // Final tiebreak: created_at desc.
    return String(y.raw.created_at).localeCompare(String(x.raw.created_at));
  });

  const totalMatching = matchingBucket.length;
  const paged = matchingBucket.slice(offset, offset + limit);

  const rows: DisputeQueueRow[] = paged.map(({ raw: r, severity }) => ({
    id: String(r.id),
    factKey: String(r.fact_key),
    factGroup: String(r.fact_group),
    disputeKind: String(r.dispute_kind),
    status: String(r.status),
    proposedAction: r.proposed_action ? String(r.proposed_action) : null,
    description: r.description ? String(r.description) : null,
    country: {
      id: String(r.jurisdiction_id),
      slug: String(r.country_slug),
      name: String(r.country_name),
    },
    factA: r.fact_id_a
      ? {
          id: String(r.fact_id_a),
          sourceId: String(r.a_source_id),
          factValue: r.a_fact_value !== null ? String(r.a_fact_value) : null,
          factValueNumeric:
            r.a_fact_value_numeric !== null
              ? Number(r.a_fact_value_numeric)
              : null,
          factUnit: r.a_fact_unit ? String(r.a_fact_unit) : null,
          factYear: r.a_fact_year !== null ? Number(r.a_fact_year) : null,
          asOf: r.a_as_of ? String(r.a_as_of) : null,
        }
      : null,
    factB: r.fact_id_b
      ? {
          id: String(r.fact_id_b),
          sourceId: String(r.b_source_id),
          factValue: r.b_fact_value !== null ? String(r.b_fact_value) : null,
          factValueNumeric:
            r.b_fact_value_numeric !== null
              ? Number(r.b_fact_value_numeric)
              : null,
          factUnit: r.b_fact_unit ? String(r.b_fact_unit) : null,
          factYear: r.b_fact_year !== null ? Number(r.b_fact_year) : null,
          asOf: r.b_as_of ? String(r.b_as_of) : null,
        }
      : null,
    submitterName: r.submitter_name ? String(r.submitter_name) : null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    severity,
  }));

  // Total open count for the queue header (independent of filters).
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM data_disputes
    WHERE status IN ('open', 'in_review')
  `);
  const countRows =
    ((countResult as unknown as { rows?: unknown[] }).rows ??
      countResult) as Array<Record<string, unknown>>;
  const totalOpen = Number(countRows[0]?.total ?? 0);

  return { rows, totalOpen, totalMatching };
}

/**
 * Full dispute detail for the resolution form.
 */
export interface DisputeDetail extends DisputeQueueRow {
  reviewerId: string | null;
  reviewerNotes: string | null;
  resolvedAt: string | null;
  resolutionAction: string | null;
  submitterEmail: string | null;
  submitterAffiliation: string | null;
  isPublic: boolean;
  /** R.21 — does the resolver currently still emit this dispute? Used
   *  to render the "auto-resolve eligible" informational badge. */
  autoResolveEligible: boolean;
  /** R.21 — short note explaining the eligibility verdict (or null
   *  when not eligible). */
  autoResolveNote: string | null;
}

export async function getDataDispute(id: string): Promise<DisputeDetail | null> {
  const rows = await db
    .select()
    .from(dataDisputes)
    .where(eq(dataDisputes.id, id))
    .limit(1);
  const d = rows[0];
  if (!d) return null;

  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, d.jurisdictionId))
    .limit(1);
  const jurisdiction = jurisdictionRows[0];
  if (!jurisdiction) return null;

  async function loadFact(factId: string | null) {
    if (!factId) return null;
    const fr = await db
      .select()
      .from(countryFacts)
      .where(eq(countryFacts.id, factId))
      .limit(1);
    const f = fr[0];
    if (!f) return null;
    return {
      id: f.id,
      sourceId: f.sourceId,
      factValue: f.factValue,
      factValueNumeric:
        f.factValueNumeric !== null ? Number(f.factValueNumeric) : null,
      factUnit: f.factUnit,
      factYear: f.factYear,
      asOf: f.asOf,
    };
  }

  const [factA, factB] = await Promise.all([
    loadFact(d.factIdA),
    loadFact(d.factIdB),
  ]);

  // Severity score for the detail page (used to render the badge).
  const severity =
    d.disputeKind === "material_error"
      ? computeSeverity(
          d.factKey,
          factA?.factValueNumeric ?? null,
          factB?.factValueNumeric ?? null,
        )
      : ({
          severity: null,
          bucket: null,
          gap: null,
          thresholdValue: null,
          thresholdKind: null,
        } as SeverityScore);

  // Auto-resolve eligibility — only meaningful for open/in_review
  // material_error disputes. Computed lazily so the detail page can
  // render the informational badge without a heavy sweep.
  let autoResolveEligible = false;
  let autoResolveNote: string | null = null;
  const isOpen = d.status === "open" || d.status === "in_review";
  if (isOpen && d.disputeKind === "material_error") {
    try {
      const { getCanonicalFactsForJurisdiction } = await import(
        "@/lib/factbook/reconcile/api"
      );
      const out = await getCanonicalFactsForJurisdiction(d.jurisdictionId, [
        d.factKey,
      ]);
      const proposed = out[d.factKey]?.proposedDisputes ?? [];
      const stillEmitted = proposed.some(
        (p) =>
          p.kind === d.disputeKind &&
          p.factIdA === d.factIdA &&
          (p.factIdB ?? null) === (d.factIdB ?? null),
      );
      autoResolveEligible = !stillEmitted;
      autoResolveNote = stillEmitted
        ? null
        : "resolver no longer emits this dispute under current methodology";
    } catch {
      autoResolveEligible = false;
      autoResolveNote = null;
    }
  }

  return {
    id: d.id,
    factKey: d.factKey,
    factGroup: d.factGroup,
    disputeKind: d.disputeKind,
    status: d.status,
    proposedAction: d.proposedAction,
    description: d.description,
    country: jurisdiction,
    factA,
    factB,
    submitterName: d.submitterName,
    createdAt: d.createdAt.toISOString(),
    reviewerId: d.reviewerId,
    reviewerNotes: d.reviewerNotes,
    resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
    resolutionAction: d.resolutionAction,
    submitterEmail: d.submitterEmail,
    submitterAffiliation: d.submitterAffiliation,
    isPublic: d.isPublic,
    severity,
    autoResolveEligible,
    autoResolveNote,
  };
}

/**
 * R.21 — distributions for the queue page filter chips. Returns the
 * top-N source-pairs and fact-keys among currently-open disputes,
 * each with a count.
 */
export interface DisputeFilterDistributions {
  sourcePairs: Array<{
    /** Display label, e.g. "cia_factbook × imf_weo". */
    label: string;
    /** URL value, e.g. "cia_factbook|imf_weo". */
    value: string;
    count: number;
  }>;
  factKeys: Array<{ value: string; count: number }>;
}

export async function getDisputeFilterDistributions(
  opts: { includeResolved?: boolean; topN?: number } = {},
): Promise<DisputeFilterDistributions> {
  const topN = Math.max(1, Math.min(opts.topN ?? 12, 30));
  const statusClause = opts.includeResolved
    ? sql``
    : sql`WHERE d.status IN ('open', 'in_review')`;

  const sourcePairResult = await db.execute(sql`
    SELECT
      a.source_id AS source_a,
      b.source_id AS source_b,
      COUNT(*)::int AS n
    FROM data_disputes d
    LEFT JOIN country_facts a ON a.id = d.fact_id_a
    LEFT JOIN country_facts b ON b.id = d.fact_id_b
    ${statusClause}
    GROUP BY a.source_id, b.source_id
    ORDER BY n DESC
    LIMIT ${topN}
  `);
  const sourcePairRaw = ((sourcePairResult as unknown as { rows?: unknown[] })
    .rows ?? sourcePairResult) as Array<Record<string, unknown>>;

  const sourcePairs = sourcePairRaw.map((r) => {
    const a = r.source_a ? String(r.source_a) : "";
    const b = r.source_b ? String(r.source_b) : "";
    const label = `${a || "—"} × ${b || "—"}`;
    return {
      label,
      value: `${a}|${b}`,
      count: Number(r.n ?? 0),
    };
  });

  const factKeyResult = await db.execute(sql`
    SELECT
      d.fact_key,
      COUNT(*)::int AS n
    FROM data_disputes d
    ${statusClause}
    GROUP BY d.fact_key
    ORDER BY n DESC
    LIMIT ${topN}
  `);
  const factKeyRaw = ((factKeyResult as unknown as { rows?: unknown[] }).rows ??
    factKeyResult) as Array<Record<string, unknown>>;
  const factKeys = factKeyRaw.map((r) => ({
    value: String(r.fact_key),
    count: Number(r.n ?? 0),
  }));

  return { sourcePairs, factKeys };
}
