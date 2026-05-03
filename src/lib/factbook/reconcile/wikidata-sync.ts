/**
 * Phase F.2 — Wikidata sync orchestration (library form).
 *
 * This module wraps the per-jurisdiction × per-fact-key SPARQL +
 * filter + upsert loop so it can be invoked from both the
 * imperative script (`scripts/sync-factbook-wikidata.ts`) and the
 * Vercel cron route (`/api/cron/factbook/sync-wikidata`).
 *
 * Design: keep the function pure-ish — it takes a `db` instance
 * and returns a summary, doesn't read CLI args or call exit().
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §3
 */
import { createHash } from "node:crypto";
import { eq, isNotNull, sql } from "drizzle-orm";

import {
  countryFacts,
  factSnapshots,
  jurisdictions,
  sources,
} from "@/lib/db/schema";
import {
  getClaimsForEntity,
  groupClaimsByStatement,
  type GroupedClaim,
} from "./wikidata-client";
import {
  WIKIDATA_FACT_MAPPING,
  applyUnitConversion,
  type WikidataFactConfig,
} from "./wikidata-fact-mapping";
import { getFactKey } from "./fact-keys";
import {
  isAllowedReference,
  findAllowlistEntry,
} from "./source-allowlist";
import {
  persistProposedDisputes,
  type PersistDisputeSummary,
} from "./dispute-persistence";

export interface WikidataSyncOptions {
  jurisdictionSlug?: string;
  factKey?: string;
  dryRun?: boolean;
  /** Cap jurisdictions for testing. */
  limitJurisdictions?: number;
  /** Optional callback for streaming progress lines. */
  onProgress?: (line: string) => void;
}

export interface PerFactCounters {
  factKey: string;
  considered: number;
  admitted: number;
  rejected_no_value: number;
  rejected_no_reference: number;
  rejected_allowlist: number;
  rejected_envelope: number;
  unit_mismatch: number;
}

export interface WikidataSyncSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jurisdictionsProcessed: number;
  factCountersByKey: Record<string, PerFactCounters>;
  totalAdmitted: number;
  /** Phase F.6.1 — disputes the resolver flagged as needing review,
   *  written to `data_disputes` after the sync completes. Null on
   *  dry runs. */
  disputes: PersistDisputeSummary | null;
  dryRun: boolean;
}

type Db = typeof import("@/lib/db").db;

function freshCounters(factKey: string): PerFactCounters {
  return {
    factKey,
    considered: 0,
    admitted: 0,
    rejected_no_value: 0,
    rejected_no_reference: 0,
    rejected_allowlist: 0,
    rejected_envelope: 0,
    unit_mismatch: 0,
  };
}

function pickAdmissibleClaim(
  claims: GroupedClaim[],
  config: WikidataFactConfig,
  envelope: { min?: number; max?: number; isPercent?: boolean } | undefined,
  counters: PerFactCounters
): GroupedClaim | null {
  const sorted = [...claims].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank === "preferred" ? -1 : 1;
    const ta = a.pointInTime ?? "";
    const tb = b.pointInTime ?? "";
    return tb.localeCompare(ta);
  });

  for (const claim of sorted) {
    counters.considered++;

    const value = applyUnitConversion(config, claim.valueRaw);
    if (value === null) {
      counters.rejected_no_value++;
      continue;
    }

    if (envelope) {
      const min = envelope.isPercent
        ? Math.max(envelope.min ?? -1, -1)
        : envelope.min;
      const max = envelope.isPercent
        ? Math.min(envelope.max ?? 101, 101)
        : envelope.max;
      if (
        (min !== undefined && value < min) ||
        (max !== undefined && value > max)
      ) {
        counters.rejected_envelope++;
        continue;
      }
    }

    if (claim.references.length === 0) {
      counters.rejected_no_reference++;
      continue;
    }
    const allowedRefs = claim.references.filter((ref) =>
      isAllowedReference({ qid: ref.statedInQid, url: ref.url })
    );
    if (allowedRefs.length === 0) {
      counters.rejected_allowlist++;
      continue;
    }

    if (
      config.expectedUnitQid &&
      claim.valueUnitQid &&
      claim.valueUnitQid !== config.expectedUnitQid
    ) {
      counters.unit_mismatch++;
    }

    return claim;
  }

  return null;
}

function isoYearFromPit(pit: string | undefined): {
  asOf: string | null;
  factYear: number | null;
} {
  if (!pit) return { asOf: null, factYear: null };
  const cleaned = pit.startsWith("+") ? pit.slice(1) : pit;
  const yearMatch = cleaned.match(/^(\d{4})/);
  const yearNum = yearMatch ? parseInt(yearMatch[1], 10) : null;
  let asOf: string | null = null;
  if (yearMatch) {
    asOf = `${yearMatch[1]}-01-01`;
    const fullMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
    if (fullMatch && !cleaned.startsWith(`${yearMatch[1]}-00-00`)) {
      asOf = fullMatch[1];
    }
  }
  return { asOf, factYear: yearNum };
}

function payloadHash(payload: object): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function syncFactbookWikidata(
  db: Db,
  options: WikidataSyncOptions = {}
): Promise<WikidataSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const log = options.onProgress ?? (() => {});

  const allJurisdictions = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      wikidataQid: jurisdictions.wikidataQid,
    })
    .from(jurisdictions)
    .where(
      options.jurisdictionSlug
        ? sql`${jurisdictions.slug} = ${options.jurisdictionSlug} AND ${jurisdictions.wikidataQid} IS NOT NULL`
        : isNotNull(jurisdictions.wikidataQid)
    )
    .limit(options.limitJurisdictions ?? 10000);

  log(
    `${allJurisdictions.length} jurisdictions with wikidata_qid in scope.`
  );

  const targetConfigs = options.factKey
    ? WIKIDATA_FACT_MAPPING.filter((c) => c.factKey === options.factKey)
    : WIKIDATA_FACT_MAPPING;

  const factCounters = new Map<string, PerFactCounters>();
  for (const c of targetConfigs) {
    factCounters.set(c.factKey, freshCounters(c.factKey));
  }

  // Phase F.6.1 — track every (jurisdictionId, factKey) pair we
  // upserted (or admitted in dry run) so the resolver can re-evaluate
  // and we can persist any disputes after the loop. See comment in
  // sync-wdi.ts for the same pattern.
  const touchedPairs = new Set<string>();

  for (const j of allJurisdictions) {
    if (!j.wikidataQid) continue;

    for (const config of targetConfigs) {
      const counters = factCounters.get(config.factKey)!;
      const factKeyDef = getFactKey(config.factKey);
      if (!factKeyDef) continue;

      let groupedClaims: GroupedClaim[] = [];
      try {
        const rows = await getClaimsForEntity(j.wikidataQid, config.pid);
        groupedClaims = groupClaimsByStatement(rows);
      } catch (err) {
        log(
          `! ${j.slug} ${config.factKey}: SPARQL failure — ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        continue;
      }

      if (groupedClaims.length === 0) continue;

      const chosen = pickAdmissibleClaim(
        groupedClaims,
        config,
        factKeyDef.envelope,
        counters
      );
      if (!chosen) continue;

      const numericValue = applyUnitConversion(config, chosen.valueRaw)!;
      const { asOf, factYear } = isoYearFromPit(chosen.pointInTime);

      const allowedRefsPayload = chosen.references
        .filter((ref) =>
          isAllowedReference({ qid: ref.statedInQid, url: ref.url })
        )
        .map((ref) => {
          const entry = findAllowlistEntry({
            qid: ref.statedInQid,
            url: ref.url,
          });
          return {
            qid: ref.statedInQid,
            statedInLabel: ref.statedInLabel,
            url: ref.url,
            allowlistTier: entry?.tier,
            allowlistName: entry?.name,
          };
        });

      const upstreamPayload = {
        qid: j.wikidataQid,
        pid: config.pid,
        statementIri: chosen.statementIri,
        rank: chosen.rank,
        valueRaw: chosen.valueRaw,
        valueUnitQid: chosen.valueUnitQid,
        pointInTime: chosen.pointInTime,
        references: chosen.references,
      };
      const hash = payloadHash(upstreamPayload);

      if (options.dryRun) {
        log(
          `[DRY] ${j.slug} ${config.factKey} = ${numericValue}` +
            (asOf ? ` (${asOf})` : "") +
            ` [${chosen.rank}] refs=${allowedRefsPayload.length}`
        );
        counters.admitted++;
        touchedPairs.add(`${j.id}|${config.factKey}`);
        continue;
      }

      let snapshotIdRow: { id: string }[] = [];
      try {
        snapshotIdRow = await db
          .insert(factSnapshots)
          .values({
            sourceId: "wikidata",
            upstreamRef: `wd:${j.wikidataQid} ${config.pid}`,
            payloadHash: hash,
            payload: upstreamPayload as object,
            upstreamVintageLabel: null,
          })
          .onConflictDoNothing({
            target: [factSnapshots.sourceId, factSnapshots.payloadHash],
          })
          .returning({ id: factSnapshots.id });
      } catch (err) {
        log(
          `! ${j.slug} ${config.factKey}: snapshot insert failed — ${
            err instanceof Error ? err.message : err
          }`
        );
        continue;
      }

      let snapshotId: string | null = snapshotIdRow[0]?.id ?? null;
      if (!snapshotId) {
        const existing = await db
          .select({ id: factSnapshots.id })
          .from(factSnapshots)
          .where(
            sql`${factSnapshots.sourceId} = 'wikidata' AND ${factSnapshots.payloadHash} = ${hash}`
          )
          .limit(1);
        snapshotId = existing[0]?.id ?? null;
      }

      const factRow = {
        jurisdictionId: j.id,
        factKey: config.factKey,
        factGroup: factKeyDef.group,
        category: factKeyDef.category,
        sourceId: "wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${j.wikidataQid}#${config.pid}`,
        wikidataQid: j.wikidataQid,
        wikidataPid: config.pid,
        wikidataRank: chosen.rank,
        references: allowedRefsPayload,
        sourceHash: hash,
        factValue: chosen.valueRaw,
        factValueNumeric: numericValue,
        factUnit: factKeyDef.unit ?? null,
        factYear,
        valueJson: null,
        asOf,
        retrievedAt: new Date(),
        upstreamVintageLabel: null,
        methodologyVersion: "v0.1-beta",
        status: "active",
        statusReason: null,
        snapshotId,
        sourceNote: null,
      };

      await db
        .insert(countryFacts)
        .values(factRow)
        .onConflictDoUpdate({
          target: [
            countryFacts.jurisdictionId,
            countryFacts.factKey,
            countryFacts.sourceId,
          ],
          set: {
            factValue: factRow.factValue,
            factValueNumeric: factRow.factValueNumeric,
            factUnit: factRow.factUnit,
            factYear: factRow.factYear,
            asOf: factRow.asOf,
            sourceUrl: factRow.sourceUrl,
            wikidataPid: factRow.wikidataPid,
            wikidataRank: factRow.wikidataRank,
            references: factRow.references,
            sourceHash: factRow.sourceHash,
            retrievedAt: factRow.retrievedAt,
            snapshotId: factRow.snapshotId,
            updatedAt: new Date(),
            // F.5.1 invariant: do NOT add `status` or `statusReason`
            // to this set clause. Reviewer-demoted rows must survive
            // a re-sync so the resolver continues to honour the
            // human decision. The same invariant applies to every
            // country_facts upsert in this codebase.
          },
        });

      counters.admitted++;
      touchedPairs.add(`${j.id}|${config.factKey}`);
    }
  }

  if (!options.dryRun) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, "wikidata"));
  }

  // Phase F.6.1 — persist resolver-proposed disputes for every pair
  // we touched. Same dedup contract as the WB WDI sync.
  let disputes: PersistDisputeSummary | null = null;
  if (touchedPairs.size > 0) {
    const touched = [...touchedPairs].map((s) => {
      const [jurisdictionId, factKey] = s.split("|");
      return { jurisdictionId, factKey };
    });
    log(
      `→ persisting resolver-proposed disputes across ${touched.length} (jurisdiction, fact-key) pairs…`
    );
    try {
      disputes = await persistProposedDisputes(db, touched, {
        dryRun: options.dryRun,
        onProgress: (line) => {
          if (line.startsWith("[DRY]")) return;
          log(`  ${line}`);
        },
      });
    } catch (err) {
      log(
        `! dispute persistence failed: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  const finishedAtMs = Date.now();
  const factCountersByKey: Record<string, PerFactCounters> = {};
  let totalAdmitted = 0;
  for (const c of factCounters.values()) {
    factCountersByKey[c.factKey] = c;
    totalAdmitted += c.admitted;
  }

  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    jurisdictionsProcessed: allJurisdictions.length,
    factCountersByKey,
    totalAdmitted,
    disputes,
    dryRun: options.dryRun ?? false,
  };
}
