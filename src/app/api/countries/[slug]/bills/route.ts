import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { fetchParliamentBills } from "@/lib/data/parliament-feeds";
import { statusToStage } from "@/lib/bills/stage";
import {
  makeCacheKey,
  readCachedSummaries,
  generateSummariesBatch,
  writeCachedSummary,
} from "@/lib/bills/summarize";

/**
 * Phase H.1 commit 1 — refactored route. Uses the shared
 * `src/lib/bills/{stage,summarize}.ts` modules but is otherwise
 * unchanged: still live-fetches from US/UK on request, still
 * memoises summaries in `bill_summary_cache`. Commit 2 swaps this
 * to a DB read against the new `bills` table.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
  if (!jurisdiction)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawBills = await fetchParliamentBills(jurisdiction.iso2);
  const iso2 = jurisdiction.iso2 ?? "XX";
  const db = getDb();

  const cacheKeys = rawBills.map((b) =>
    makeCacheKey(iso2, b.longTitle ?? b.title),
  );
  const cachedSummaries = await readCachedSummaries(db, cacheKeys);

  const needsGeneration = rawBills
    .map((_b, i) => (cachedSummaries[i] === null ? i : -1))
    .filter((i) => i >= 0);

  if (needsGeneration.length > 0) {
    const toGenerate = needsGeneration.map((i) => ({
      promptTitle: rawBills[i].longTitle ?? rawBills[i].title,
    }));
    const newSummaries = await generateSummariesBatch(toGenerate);
    await Promise.all(
      needsGeneration.map(async (billIdx, genIdx) => {
        const summary = newSummaries[genIdx];
        if (summary) {
          cachedSummaries[billIdx] = summary;
          await writeCachedSummary(db, cacheKeys[billIdx], summary);
        }
      }),
    );
  }

  const bills = rawBills.map((b, i) => ({
    title: b.longTitle ? `${b.title} - ${b.longTitle}` : b.title,
    summary:
      cachedSummaries[i] ??
      (b.summary && b.summary !== b.status ? b.summary : ""),
    tags: [
      b.source === "congress_gov"
        ? "U.S. Congress"
        : b.source === "uk_parliament"
          ? "UK Parliament"
          : b.source,
    ],
    stage: statusToStage(b.status),
    votes: null,
    url: b.url,
    date: b.date,
  }));

  return NextResponse.json({ country: jurisdiction.name, bills });
}
