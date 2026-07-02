import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import { getBillsForJurisdiction } from "@/lib/db/queries";
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";

const SOURCE_TAG: Record<string, string> = {
  congress_gov: "U.S. Congress",
  uk_parliament: "UK Parliament",
  legisinfo_ca: "Parliament of Canada",
  camara_br: "Câmara dos Deputados",
  senado_br: "Senado Federal",
  bundestag_dip: "Bundestag",
  data_assemblee_fr: "Assemblée Nationale",
  senat_fr: "Sénat",
};

/**
 * Phase H.1 — DB-backed bills feed. Reads from the `bills` table
 * populated by the per-source sync scripts under `scripts/sync-bills-*`
 * and the matching cron routes under `/api/cron/bills/*`. The legacy
 * live-fetch path is gone; for jurisdictions whose sync hasn't run
 * yet the response is `{ country, bills: [] }` and the UI shows the
 * existing empty state.
 *
 * Output shape preserved so `BillsTab` keeps rendering unchanged.
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

  const bills = result.rows.map((b) => ({
    title: b.longTitle ? `${b.title} - ${b.longTitle}` : b.title,
    summary: b.summary ?? "",
    tags: [SOURCE_TAG[b.sourceId] ?? b.sourceId],
    stage: b.stage,
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
    date: b.lastActionDate,
    sourceId: b.sourceId,
    sourceLastSyncAt: sourceMap.get(b.sourceId) ?? null,
  }));

  return NextResponse.json({ country: result.jurisdiction.name, bills });
}
