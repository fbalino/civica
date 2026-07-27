import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills as billsTable, governmentBodies, sources } from "@/lib/db/schema";
import { getBillsForJurisdiction } from "@/lib/db/queries";
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";
import {
  BILLS_SOURCE_LABELS,
  BILLS_STAGE_LABELS,
  BILLS_SUPPORTED_JURISDICTION_NAMES,
  isBillsSupportedSlug,
} from "@/lib/bills/coverage";

const SOURCE_TAG = BILLS_SOURCE_LABELS;

/**
 * Phase H.1 / ATL-013 — DB-backed bills feed. Reads from the `bills` table
 * populated by the per-source sync scripts under `scripts/sync-bills-*`
 * and the matching cron routes under `/api/cron/bills/*`.
 *
 * This is a public-read API route (see `src/lib/api/route-inventory/registry.ts`)
 * with no live UI caller today — `FactbookBills.tsx` on the Civica Data tab
 * does its own direct DB query instead of fetching this route. It stays a
 * documented, correct contract for external API consumers.
 *
 * For a jurisdiction outside the six-country bills coverage set (see
 * `src/lib/bills/coverage.ts`), the response carries an explicit `coverage`
 * object naming which jurisdictions ARE covered instead of a bare empty
 * `bills: []` array with no explanation.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = enforceInMemoryRateLimit(req, { scope: "countries-bills" });
  if (limited) return limited;

  const { slug } = await params;
  let result;
  try {
    result = await getBillsForJurisdiction(slug, 10);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
  if (!result)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Look up sources.last_sync_at once for the distinct sources in
  // the result so each bill row carries its own provenance dot.
  const sourceIds = Array.from(new Set(result.rows.map((b) => b.sourceId)));
  const sourceMap = new Map<string, string | null>();
  if (sourceIds.length > 0) {
    try {
      const rows = await db
        .select({ id: sources.id, lastSyncAt: sources.lastSyncAt })
        .from(sources)
        .where(inArray(sources.id, sourceIds));
      for (const r of rows) {
        sourceMap.set(
          r.id,
          r.lastSyncAt ? r.lastSyncAt.toISOString() : null,
        );
      }
    } catch {
      /* sources table read is best-effort */
    }
  }

  // Chamber — `bodyId` FK into `government_bodies`, populated for the
  // DE/FR/BR/CA adapters only (see coverage.ts / ATL-013 evidence doc).
  const bodyIds = Array.from(
    new Set(result.rows.map((b) => b.bodyId).filter((id): id is string => !!id)),
  );
  const bodyMap = new Map<string, { name: string; chamberType: string | null }>();
  if (bodyIds.length > 0) {
    try {
      const bodyRows = await db
        .select({
          id: governmentBodies.id,
          name: governmentBodies.name,
          chamberType: governmentBodies.chamberType,
        })
        .from(governmentBodies)
        .where(inArray(governmentBodies.id, bodyIds));
      for (const r of bodyRows) {
        bodyMap.set(r.id, { name: r.name, chamberType: r.chamberType });
      }
    } catch {
      /* best-effort */
    }
  }

  // Total row count for this jurisdiction, so a caller can tell "10 of 10"
  // from "10 of 3,974" (pagination honesty for the fixed 10-row page size).
  let totalCount: number | null = null;
  try {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(billsTable)
      .where(eq(billsTable.jurisdictionId, result.jurisdiction.id));
    totalCount = countRows[0] ? Number(countRows[0].count) : null;
  } catch {
    /* best-effort */
  }

  const bills = result.rows.map((b) => {
    const chamber = b.bodyId ? bodyMap.get(b.bodyId) : undefined;
    return {
      title: b.longTitle ? `${b.title} - ${b.longTitle}` : b.title,
      summary: b.summary ?? "",
      tags: [SOURCE_TAG[b.sourceId] ?? b.sourceId],
      chamber: chamber
        ? { name: chamber.name, chamberType: chamber.chamberType }
        : null,
      stage: b.stage,
      stageLabel: BILLS_STAGE_LABELS[b.stage] ?? null,
      votes:
        b.voteYes != null && b.voteNo != null
          ? {
              yes: b.voteYes,
              no: b.voteNo,
              abs: b.voteAbstain ?? 0,
            }
          : null,
      url: b.url,
      status: b.rawStatus ?? undefined,
      sponsor: b.sponsorName ?? undefined,
      introducedDate: b.introducedDate ?? null,
      date: b.lastActionDate,
      sourceId: b.sourceId,
      sourceLastSyncAt: sourceMap.get(b.sourceId) ?? null,
    };
  });

  const supported = isBillsSupportedSlug(slug);
  const coverage = {
    supported,
    supportedJurisdictions: BILLS_SUPPORTED_JURISDICTION_NAMES,
    totalTrackedForJurisdiction: totalCount,
    message: supported
      ? null
      : `Civica's bills/legislative-activity pipeline currently covers six jurisdictions (${BILLS_SUPPORTED_JURISDICTION_NAMES.join(", ")}). ${result.jurisdiction.name} is not yet in that set — an empty list here reflects missing coverage, not an absence of legislative activity.`,
  };

  return NextResponse.json({
    country: result.jurisdiction.name,
    bills,
    coverage,
  });
}
