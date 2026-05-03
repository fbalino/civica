/**
 * Phase F.6.1 — persist resolver-proposed disputes into `data_disputes`.
 *
 * The resolver computes `proposedDisputes` while picking canonical
 * but, by design, doesn't write them — the resolver stays pure for
 * vintage-replay. Sync orchestrators are the right place to
 * materialize disputes because they know the universe of touched
 * `(jurisdictionId, factKey)` pairs after a write.
 *
 * Dedup contract:
 *   A dispute is considered identical to an existing OPEN /
 *   IN-REVIEW dispute when all of these match:
 *     - jurisdictionId
 *     - factKey
 *     - disputeKind
 *     - factIdA
 *     - factIdB
 *   Resolved disputes (status starts with 'resolved_' or
 *   'rejected_invalid') do NOT block a new dispute — the resolver
 *   may legitimately re-propose if the underlying values change.
 *
 * The schema doesn't (yet) carry a unique index on this tuple, so
 * we dedup with an explicit SELECT-then-INSERT. Migration to a
 * partial unique index is a future-clean-up item.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §7
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { dataDisputes } from "@/lib/db/schema";
import { getFactKey } from "./fact-keys";
import { getCanonicalFactsForJurisdiction } from "./api";
import type { ProposedDispute } from "./types";

type Db = typeof import("@/lib/db").db;

export interface PersistDisputeSummary {
  jurisdictionsScanned: number;
  pairsScanned: number;
  proposedTotal: number;
  inserted: number;
  skippedDuplicate: number;
  skippedNoFactGroup: number;
  errors: string[];
}

export interface PersistDisputesOptions {
  /** When true, log + count but don't write. */
  dryRun?: boolean;
  onProgress?: (line: string) => void;
}

interface DisputeIdentity {
  factIdA: string;
  factIdB: string | null;
  disputeKind: string;
}

function identityKey(d: DisputeIdentity): string {
  return `${d.disputeKind}|${d.factIdA}|${d.factIdB ?? "∅"}`;
}

/**
 * For the given (jurisdictionId, factKey) pairs, run the resolver
 * and persist any proposed disputes that aren't already represented
 * by an open / in-review row.
 */
export async function persistProposedDisputes(
  db: Db,
  touched: Array<{ jurisdictionId: string; factKey: string }>,
  options: PersistDisputesOptions = {},
): Promise<PersistDisputeSummary> {
  const log = options.onProgress ?? (() => {});
  const summary: PersistDisputeSummary = {
    jurisdictionsScanned: 0,
    pairsScanned: 0,
    proposedTotal: 0,
    inserted: 0,
    skippedDuplicate: 0,
    skippedNoFactGroup: 0,
    errors: [],
  };

  // Group by jurisdiction so the resolver runs once per jurisdiction.
  const byJurisdiction = new Map<string, Set<string>>();
  for (const { jurisdictionId, factKey } of touched) {
    let s = byJurisdiction.get(jurisdictionId);
    if (!s) {
      s = new Set();
      byJurisdiction.set(jurisdictionId, s);
    }
    s.add(factKey);
  }
  summary.jurisdictionsScanned = byJurisdiction.size;
  summary.pairsScanned = touched.length;

  for (const [jurisdictionId, factKeysSet] of byJurisdiction) {
    const factKeys = [...factKeysSet];
    let resolverOutputs: Awaited<
      ReturnType<typeof getCanonicalFactsForJurisdiction>
    > = {};
    try {
      resolverOutputs = await getCanonicalFactsForJurisdiction(
        jurisdictionId,
        factKeys,
      );
    } catch (err) {
      summary.errors.push(
        `${jurisdictionId} resolver read: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }

    // Pre-load existing OPEN/IN-REVIEW disputes for these (j, k) pairs
    // in one query; build a Set keyed by (kind|factIdA|factIdB).
    let existingRows: Array<{
      factKey: string;
      disputeKind: string;
      factIdA: string | null;
      factIdB: string | null;
    }> = [];
    try {
      const rows = await db
        .select({
          factKey: dataDisputes.factKey,
          disputeKind: dataDisputes.disputeKind,
          factIdA: dataDisputes.factIdA,
          factIdB: dataDisputes.factIdB,
        })
        .from(dataDisputes)
        .where(
          and(
            eq(dataDisputes.jurisdictionId, jurisdictionId),
            inArray(dataDisputes.factKey, factKeys),
            sql`${dataDisputes.status} IN ('open', 'in_review')`,
          ),
        );
      existingRows = rows;
    } catch (err) {
      summary.errors.push(
        `${jurisdictionId} dispute lookup: ${
          err instanceof Error ? err.message : err
        }`,
      );
      continue;
    }

    const existingByKey = new Map<string, Set<string>>();
    for (const r of existingRows) {
      let s = existingByKey.get(r.factKey);
      if (!s) {
        s = new Set();
        existingByKey.set(r.factKey, s);
      }
      // factIdA is non-null on every dispute row by schema.
      if (r.factIdA) {
        s.add(
          identityKey({
            disputeKind: r.disputeKind,
            factIdA: r.factIdA,
            factIdB: r.factIdB,
          }),
        );
      }
    }

    for (const factKey of factKeys) {
      const out = resolverOutputs[factKey];
      if (!out) continue;
      const proposed: ProposedDispute[] = out.proposedDisputes ?? [];
      summary.proposedTotal += proposed.length;
      if (proposed.length === 0) continue;

      const def = getFactKey(factKey);
      if (!def) {
        // factGroup is required by schema; skip gracefully.
        summary.skippedNoFactGroup += proposed.length;
        continue;
      }

      const seen = existingByKey.get(factKey) ?? new Set<string>();

      for (const p of proposed) {
        const key = identityKey({
          disputeKind: p.kind,
          factIdA: p.factIdA,
          factIdB: p.factIdB,
        });
        if (seen.has(key)) {
          summary.skippedDuplicate++;
          continue;
        }
        // Mark as seen now so duplicate proposals within the SAME
        // resolver run don't all insert (rare but possible).
        seen.add(key);

        if (options.dryRun) {
          log(
            `[DRY] ${jurisdictionId} ${factKey} ${p.kind} A=${p.factIdA.slice(0, 8)} B=${p.factIdB?.slice(0, 8) ?? "—"}`,
          );
          summary.inserted++;
          continue;
        }

        try {
          await db.insert(dataDisputes).values({
            jurisdictionId,
            factKey,
            factGroup: def.group,
            disputeKind: p.kind,
            factIdA: p.factIdA,
            factIdB: p.factIdB,
            // proposedAction stays the resolver's auto-suggestion.
            // For material_error / group_a_override / group_c_override
            // the resolver kept A canonical, so it implicitly prefers A.
            // 'plausibility_envelope' has no winner (factIdB is null).
            proposedAction: p.factIdB ? "prefer_a" : null,
            status: "open",
            description: p.description,
            isPublic: true,
          });
          summary.inserted++;
        } catch (err) {
          summary.errors.push(
            `${jurisdictionId} ${factKey} ${p.kind}: ${
              err instanceof Error ? err.message : err
            }`,
          );
        }
      }
    }
  }

  log(
    `dispute persistence: ${summary.inserted} new / ${summary.skippedDuplicate} dup / ${summary.proposedTotal} proposed across ${summary.jurisdictionsScanned} jurisdictions`,
  );
  return summary;
}
