/**
 * Phase F.5 — admin data-disputes queue query helpers.
 *
 * The queue is `data_disputes` rows where `status = 'open' OR
 * status = 'in_review'`, ordered by:
 *   1. dispute_kind urgency (material_error first — fastest data
 *      quality breach)
 *   2. fact_group (Group A overrides outrank Group B)
 *   3. created_at desc (newest dispute first within a tier)
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §7
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  countryFacts,
  dataDisputes,
  jurisdictions,
} from "@/lib/db/schema";

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
}

export interface DisputeQueueResult {
  rows: DisputeQueueRow[];
  totalOpen: number;
}

/**
 * Read the dispute queue. Filters down to `status IN ('open',
 * 'in_review')` by default; pass `includeResolved` to also see
 * historical resolutions.
 */
export async function getDataDisputeQueue(
  opts: {
    limit?: number;
    offset?: number;
    factGroup?: string;
    disputeKind?: string;
    includeResolved?: boolean;
  } = {},
): Promise<DisputeQueueResult> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const wheres: ReturnType<typeof sql>[] = [];
  if (!opts.includeResolved) {
    wheres.push(sql`d.status IN ('open', 'in_review')`);
  }
  if (opts.factGroup) wheres.push(sql`d.fact_group = ${opts.factGroup}`);
  if (opts.disputeKind) wheres.push(sql`d.dispute_kind = ${opts.disputeKind}`);
  const whereClause =
    wheres.length > 0 ? sql`WHERE ${sql.join(wheres, sql` AND `)}` : sql``;

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
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `);

  const raw = ((rowsResult as unknown as { rows?: unknown[] }).rows ??
    rowsResult) as Array<Record<string, unknown>>;

  raw.sort((x, y) => {
    const kx = KIND_RANK[String(x.dispute_kind)] ?? 99;
    const ky = KIND_RANK[String(y.dispute_kind)] ?? 99;
    if (kx !== ky) return kx - ky;
    const gx = GROUP_RANK[String(x.fact_group)] ?? 99;
    const gy = GROUP_RANK[String(y.fact_group)] ?? 99;
    if (gx !== gy) return gx - gy;
    return String(y.created_at).localeCompare(String(x.created_at));
  });

  const trimmed = raw.slice(0, limit);

  const rows: DisputeQueueRow[] = trimmed.map((r) => ({
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
    createdAt: r.created_at instanceof Date
      ? r.created_at.toISOString()
      : String(r.created_at),
  }));

  // Total open count for the queue header.
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM data_disputes
    WHERE status IN ('open', 'in_review')
  `);
  const countRows =
    ((countResult as unknown as { rows?: unknown[] }).rows ??
      countResult) as Array<Record<string, unknown>>;
  const totalOpen = Number(countRows[0]?.total ?? 0);

  return { rows, totalOpen };
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
  };
}
