/**
 * Phase R.21 — auto-resolve sweep for stale `material_error` disputes.
 *
 * "Stale" means the resolver, run today against the same
 * `(jurisdiction, fact_key)` row set, no longer proposes the dispute
 * — typically because a methodology change (per-fact threshold raise,
 * `value_type` partition, `civicaRole` re-tagging) has rendered the
 * earlier proposal moot.
 *
 * Auto-resolve:
 *   - Acts on `dispute_kind = 'material_error'` ONLY. Group A / Group C /
 *     `plausibility_envelope` / `public_correction` etc. always require
 *     human review.
 *   - Closes by flipping `data_disputes.status` to `resolved_auto_stale`,
 *     stamping `resolved_at = NOW()`, recording `reviewer_id =
 *     'system_auto_resolve'`, and writing a `data_facts_audit_log` row
 *     with `action = 'auto_resolve_stale'`.
 *   - Is reversible. The audit-log row preserves the full pre-update
 *     state in `before`, and the admin detail page exposes a "Reopen"
 *     button.
 *
 * Match contract:
 *   A dispute is considered "still proposed" by the resolver when
 *   `getCanonicalFactsForJurisdiction` emits a proposed dispute with
 *   the same `(disputeKind, factIdA, factIdB)` triple. Anything else
 *   — different kind, different winner, different challenger — counts
 *   as stale.
 *
 * Edge cases:
 *   - `fact_id_a` or `fact_id_b` orphaned (e.g., country_facts row
 *     hard-deleted): we can't reconstruct the resolver call, so we
 *     mark stale with a note.
 *   - Either fact has `status != 'active'` (already demoted by manual
 *     review): the dispute is informationally closed; mark stale with
 *     a note.
 *   - Resolver throws: skip the dispute and surface the error in the
 *     summary so the cron run reports a non-fatal error count.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md §2a + §2d
 */

import { sql } from "drizzle-orm";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";

type Db = typeof import("@/lib/db").db;

export const AUTO_RESOLVE_REVIEWER_ID = "system_auto_resolve";
export const AUTO_RESOLVE_STATUS = "resolved_auto_stale";

/**
 * Pure verdict: given the candidate dispute and the resolver's
 * current proposed-disputes list for that fact-key, decide whether
 * it's still emitted ("live") or stale + the reason. Exported for
 * unit tests so the staleness logic can be exercised without DB IO.
 */
export type StalenessVerdict =
  { outcome: "still_proposed" } | { outcome: "auto_resolved"; reason: string };

export interface DisputeVerdictInput {
  factIdA: string | null;
  factIdB: string | null;
  disputeKind: string;
  factAStatus?: string | null;
  factBStatus?: string | null;
  /** Either the resolver's proposedDisputes for this fact-key, or
   *  null/undefined if the resolver returned no output at all (e.g.,
   *  the fact-key isn't registered or there are zero active rows). */
  resolverProposed:
    | Array<{ kind: string; factIdA: string; factIdB: string | null }>
    | null
    | undefined;
}

export function decideStaleness(input: DisputeVerdictInput): StalenessVerdict {
  if (!input.factIdA) {
    return { outcome: "auto_resolved", reason: "fact_id_a is null" };
  }
  if (input.resolverProposed == null) {
    return {
      outcome: "auto_resolved",
      reason: "resolver returned no output for this fact-key",
    };
  }
  if (input.factAStatus && input.factAStatus !== "active") {
    return {
      outcome: "auto_resolved",
      reason: `fact_a status='${input.factAStatus}' (already demoted)`,
    };
  }
  if (input.factIdB && input.factBStatus && input.factBStatus !== "active") {
    return {
      outcome: "auto_resolved",
      reason: `fact_b status='${input.factBStatus}' (already demoted)`,
    };
  }
  const stillEmitted = input.resolverProposed.some(
    (p) =>
      p.kind === input.disputeKind &&
      p.factIdA === input.factIdA &&
      (p.factIdB ?? null) === (input.factIdB ?? null),
  );
  return stillEmitted
    ? { outcome: "still_proposed" }
    : {
        outcome: "auto_resolved",
        reason:
          "resolver no longer emits this dispute under current methodology",
      };
}

export interface AutoResolveSummary {
  scanned: number;
  stillProposed: number;
  autoResolved: number;
  skipped: number;
  errors: string[];
  /** Per-dispute outcomes for log surfacing / spot-checks. */
  outcomes: Array<{
    disputeId: string;
    countrySlug: string | null;
    factKey: string;
    outcome: "still_proposed" | "auto_resolved" | "skipped";
    note?: string;
  }>;
}

export interface AutoResolveOptions {
  /** When true, count and log but do not write. */
  dryRun?: boolean;
  /** When set, only act on this many disputes (defaults: act on all). */
  limit?: number;
  /** Progress logger; cron uses this to surface to Vercel logs. */
  onProgress?: (line: string) => void;
  readDisputes?: () => Promise<OpenDisputeRow[]>;
  resolveFacts?: typeof getCanonicalFactsForJurisdiction;
  /**
   * Injectable atomic boundary for deterministic fixtures. Production uses
   * `closeStaleDisputeAtomically`, which changes the dispute and inserts its
   * audit row in one PostgreSQL statement.
   */
  closeDispute?: AtomicCloseStaleDispute;
}

export interface OpenDisputeRow {
  id: string;
  jurisdictionId: string;
  factKey: string;
  disputeKind: string;
  factIdA: string | null;
  factIdB: string | null;
  countrySlug: string | null;
  countryName: string | null;
  factAStatus: string | null;
  factBStatus: string | null;
}

export interface AtomicCloseInput {
  disputeId: string;
  note: string;
}

export type AtomicCloseResult =
  { outcome: "closed"; auditId: string } | { outcome: "not_open" };

export type AtomicCloseStaleDispute = (
  db: Pick<Db, "execute">,
  input: AtomicCloseInput,
) => Promise<AtomicCloseResult>;

/**
 * Close one stale dispute and retain its audit evidence as a single atomic
 * PostgreSQL statement. This is deliberately a data-modifying CTE rather than
 * `db.transaction()`: Neon's HTTP driver supports one-shot statements and
 * non-interactive transactions, not an interactive transaction spanning
 * separate application awaits.
 *
 * The locked candidate and UPDATE both require an open/in-review status. A
 * concurrent resolver therefore either owns the row and writes exactly one
 * audit record, or observes `not_open`; it can never overwrite a human or
 * another cron writer that closed the dispute first. If the audit INSERT
 * fails, PostgreSQL rolls the UPDATE back with the statement.
 */
export const closeStaleDisputeAtomically: AtomicCloseStaleDispute = async (
  db,
  input,
) => {
  const result = await db.execute(sql`
    WITH candidate AS MATERIALIZED (
      SELECT
        d.id,
        d.jurisdiction_id,
        d.fact_key,
        d.status,
        d.reviewer_id,
        d.reviewer_notes,
        d.resolved_at,
        d.resolution_action
      FROM data_disputes d
      WHERE d.id = ${input.disputeId}
        AND d.status IN ('open', 'in_review')
      FOR UPDATE
    ), updated AS (
      UPDATE data_disputes d
      SET
        status = ${AUTO_RESOLVE_STATUS},
        reviewer_id = ${AUTO_RESOLVE_REVIEWER_ID},
        -- resolved_at is a timestamp-without-time-zone column. Store an
        -- explicitly UTC-naive value so the appended JSON Z remains true
        -- even if a database session uses a non-UTC TimeZone setting.
        resolved_at = (NOW() AT TIME ZONE 'UTC'),
        resolution_action = 'auto_resolve_stale'
      FROM candidate c
      WHERE d.id = c.id
        AND d.status IN ('open', 'in_review')
      RETURNING
        d.id,
        d.jurisdiction_id,
        d.fact_key,
        c.status AS before_status,
        c.reviewer_id AS before_reviewer_id,
        c.reviewer_notes AS before_reviewer_notes,
        c.resolved_at AS before_resolved_at,
        c.resolution_action AS before_resolution_action,
        d.status AS after_status,
        d.reviewer_id AS after_reviewer_id,
        d.reviewer_notes AS after_reviewer_notes,
        d.resolved_at AS after_resolved_at,
        d.resolution_action AS after_resolution_action
    ), audited AS (
      INSERT INTO data_facts_audit_log (
        jurisdiction_id,
        fact_key,
        dispute_id,
        action,
        actor_id,
        before,
        after,
        notes
      )
      SELECT
        u.jurisdiction_id,
        u.fact_key,
        u.id,
        'auto_resolve_stale',
        ${AUTO_RESOLVE_REVIEWER_ID},
        jsonb_build_object(
          'id', u.id,
          'status', u.before_status,
          'reviewerId', u.before_reviewer_id,
          'reviewerNotes', u.before_reviewer_notes,
          'resolvedAt', CASE
            WHEN u.before_resolved_at IS NULL THEN NULL
            ELSE to_char(
              u.before_resolved_at,
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            )
          END,
          'resolutionAction', u.before_resolution_action
        ),
        jsonb_build_object(
          'id', u.id,
          'status', u.after_status,
          'reviewerId', u.after_reviewer_id,
          'reviewerNotes', u.after_reviewer_notes,
          'resolvedAt', to_char(
            u.after_resolved_at,
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'resolutionAction', u.after_resolution_action
        ),
        ${input.note}
      FROM updated u
      RETURNING id AS audit_id
    )
    SELECT audit_id
    FROM audited
  `);

  const rows = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as Array<Record<string, unknown>>;
  const auditId = rows[0]?.audit_id;
  return auditId
    ? { outcome: "closed", auditId: String(auditId) }
    : { outcome: "not_open" };
};

/**
 * Run the sweep over all open `material_error` disputes.
 *
 * Returns a summary suitable for cron-handler JSON output.
 */
export async function autoResolveStaleDisputes(
  db: Db,
  options: AutoResolveOptions = {},
): Promise<AutoResolveSummary> {
  const log = options.onProgress ?? (() => {});
  const summary: AutoResolveSummary = {
    scanned: 0,
    stillProposed: 0,
    autoResolved: 0,
    skipped: 0,
    errors: [],
    outcomes: [],
  };

  // 1. Pull every open / in_review material_error dispute, joined to
  //    jurisdiction (for log lines) and to fact_id_a/b status (for
  //    orphan + demoted-row detection).
  const limitClause = options.limit
    ? sql`LIMIT ${Math.max(1, options.limit)}`
    : sql``;
  const rowsResult = options.readDisputes
    ? null
    : await db.execute(sql`
    SELECT
      d.id,
      d.jurisdiction_id,
      d.fact_key,
      d.dispute_kind,
      d.fact_id_a,
      d.fact_id_b,
      j.slug AS country_slug,
      j.name AS country_name,
      a.status AS fact_a_status,
      b.status AS fact_b_status
    FROM data_disputes d
    JOIN jurisdictions j ON j.id = d.jurisdiction_id
    LEFT JOIN country_facts a ON a.id = d.fact_id_a
    LEFT JOIN country_facts b ON b.id = d.fact_id_b
    WHERE d.status IN ('open', 'in_review')
      AND d.dispute_kind = 'material_error'
    ORDER BY d.created_at ASC
    ${limitClause}
  `);
  const raw =
    rowsResult === null
      ? []
      : (((rowsResult as unknown as { rows?: unknown[] }).rows ??
          rowsResult) as Array<Record<string, unknown>>);

  const disputes: OpenDisputeRow[] = options.readDisputes
    ? await options.readDisputes()
    : raw.map((r) => ({
        id: String(r.id),
        jurisdictionId: String(r.jurisdiction_id),
        factKey: String(r.fact_key),
        disputeKind: String(r.dispute_kind),
        factIdA: r.fact_id_a ? String(r.fact_id_a) : null,
        factIdB: r.fact_id_b ? String(r.fact_id_b) : null,
        countrySlug: r.country_slug ? String(r.country_slug) : null,
        countryName: r.country_name ? String(r.country_name) : null,
        factAStatus: r.fact_a_status ? String(r.fact_a_status) : null,
        factBStatus: r.fact_b_status ? String(r.fact_b_status) : null,
      }));

  summary.scanned = disputes.length;
  log(`auto-resolve scan: ${disputes.length} open material_error dispute(s)`);

  if (disputes.length === 0) {
    return summary;
  }

  // 2. Group by jurisdiction so the resolver runs once per jurisdiction
  //    (loads all fact-keys for that jurisdiction's open disputes).
  const byJurisdiction = new Map<string, Set<string>>();
  for (const d of disputes) {
    let s = byJurisdiction.get(d.jurisdictionId);
    if (!s) {
      s = new Set();
      byJurisdiction.set(d.jurisdictionId, s);
    }
    s.add(d.factKey);
  }

  // 3. For each jurisdiction, resolve once + match every dispute against
  //    the resolver's current proposed set.
  for (const [jurisdictionId, factKeysSet] of byJurisdiction) {
    const factKeys = [...factKeysSet];
    let resolverOutputs: Awaited<
      ReturnType<typeof getCanonicalFactsForJurisdiction>
    >;
    try {
      resolverOutputs = await (
        options.resolveFacts ?? getCanonicalFactsForJurisdiction
      )(jurisdictionId, factKeys);
    } catch (err) {
      const msg = `${jurisdictionId} resolver read: ${err instanceof Error ? err.message : err}`;
      summary.errors.push(msg);
      log(`! ${msg}`);
      // Skip this jurisdiction's disputes; they'll be re-scanned next run.
      continue;
    }

    const myDisputes = disputes.filter(
      (d) => d.jurisdictionId === jurisdictionId,
    );

    for (const d of myDisputes) {
      try {
        const outcome = await processOneDispute(
          db,
          d,
          resolverOutputs[d.factKey],
          {
            dryRun: options.dryRun ?? false,
            closeDispute: options.closeDispute ?? closeStaleDisputeAtomically,
          },
        );
        if (outcome.outcome === "still_proposed") summary.stillProposed++;
        else if (outcome.outcome === "auto_resolved") summary.autoResolved++;
        else summary.skipped++;
        summary.outcomes.push(outcome);
        log(
          `  ${outcome.outcome.padEnd(16)} ${d.countrySlug ?? "—"} ${d.factKey} (${d.id.slice(0, 8)})${
            outcome.note ? "  // " + outcome.note : ""
          }`,
        );
      } catch (err) {
        const msg = `${d.id} (${d.countrySlug ?? "—"}/${d.factKey}): ${err instanceof Error ? err.message : err}`;
        summary.errors.push(msg);
        log(`! ${msg}`);
      }
    }
  }

  log(
    `auto-resolve done: ${summary.autoResolved} closed / ${summary.stillProposed} live / ${summary.skipped} skipped${
      options.dryRun ? " (DRY RUN)" : ""
    }${summary.errors.length > 0 ? ` / ${summary.errors.length} errors` : ""}`,
  );

  return summary;
}

interface ProcessOneOptions {
  dryRun: boolean;
  closeDispute: AtomicCloseStaleDispute;
}

/**
 * Apply the verdict to a single dispute. Decision logic lives in
 * `decideStaleness` (pure, unit-tested). DB writes — the dispute
 * UPDATE + audit-log INSERT — happen here.
 */
async function processOneDispute(
  db: Db,
  dispute: OpenDisputeRow,
  resolverOutput:
    | Awaited<ReturnType<typeof getCanonicalFactsForJurisdiction>>[string]
    | undefined,
  opts: ProcessOneOptions,
): Promise<AutoResolveSummary["outcomes"][number]> {
  const verdict = decideStaleness({
    factIdA: dispute.factIdA,
    factIdB: dispute.factIdB,
    disputeKind: dispute.disputeKind,
    factAStatus: dispute.factAStatus,
    factBStatus: dispute.factBStatus,
    resolverProposed: resolverOutput?.proposedDisputes ?? null,
  });

  if (verdict.outcome === "still_proposed") {
    return {
      disputeId: dispute.id,
      countrySlug: dispute.countrySlug,
      factKey: dispute.factKey,
      outcome: "still_proposed",
    };
  }

  return await closeStale(db, dispute, verdict.reason, opts);
}

/**
 * Flip the dispute's status + write the audit-log row. When `dryRun`,
 * compute everything but skip both writes.
 */
async function closeStale(
  db: Db,
  dispute: OpenDisputeRow,
  note: string,
  opts: ProcessOneOptions,
): Promise<AutoResolveSummary["outcomes"][number]> {
  if (opts.dryRun) {
    return {
      disputeId: dispute.id,
      countrySlug: dispute.countrySlug,
      factKey: dispute.factKey,
      outcome: "auto_resolved",
      note: `${note} (DRY RUN)`,
    };
  }

  const close = await opts.closeDispute(db, {
    disputeId: dispute.id,
    note,
  });
  if (close.outcome === "not_open") {
    return {
      disputeId: dispute.id,
      countrySlug: dispute.countrySlug,
      factKey: dispute.factKey,
      outcome: "skipped",
      note: "dispute was already closed or vanished during the sweep",
    };
  }

  return {
    disputeId: dispute.id,
    countrySlug: dispute.countrySlug,
    factKey: dispute.factKey,
    outcome: "auto_resolved",
    note,
  };
}
