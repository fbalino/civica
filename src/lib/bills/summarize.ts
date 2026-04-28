/**
 * Batch summariser for bills. One Anthropic call summarises N bills
 * into one-sentence plain-English explainers, then memoises each in
 * the `bill_summary_cache` table so re-syncs are cheap.
 *
 * Extracted from the original inline implementation at
 * `src/app/api/countries/[slug]/bills/route.ts:25-79`. Behaviour
 * preserved: same model, same prompt, same fallback to "" if the API
 * call or JSON parse fails.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { billSummaryCache } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

type Db = NeonHttpDatabase<typeof schema>;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface SummarizeInput {
  /** Stable cache key — typically `${iso2}::${title.slice(0, 120)}`. */
  cacheKey: string;
  /** Title (or longTitle if available) used in the prompt to Claude. */
  promptTitle: string;
}

/** Builds the same `${iso2}::${title}` cache key the route used to use. */
export function makeCacheKey(iso2: string, billTitle: string): string {
  return `${iso2}::${billTitle.slice(0, 120)}`;
}

/**
 * Read cached summaries from `bill_summary_cache`. Returns parallel
 * array; entries are `null` for cache misses, the cached string for
 * hits. Errors are non-fatal — the caller treats them as misses.
 */
export async function readCachedSummaries(
  db: Db,
  cacheKeys: string[],
): Promise<Array<string | null>> {
  if (cacheKeys.length === 0) return [];
  return Promise.all(
    cacheKeys.map(async (k) => {
      try {
        const rows = await db
          .select()
          .from(billSummaryCache)
          .where(eq(billSummaryCache.cacheKey, k))
          .limit(1);
        return rows[0]?.summary ?? null;
      } catch {
        return null;
      }
    }),
  );
}

/**
 * Generate one-sentence summaries via Claude Haiku. Returns parallel
 * array aligned with `inputs`; an entry is `""` if generation failed.
 * Pre-condition: `inputs.length >= 1`.
 */
export async function generateSummariesBatch(
  inputs: Array<{ promptTitle: string }>,
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY || inputs.length === 0) {
    return inputs.map(() => "");
  }

  const billList = inputs
    .map((b, i) => `${i + 1}. "${b.promptTitle}"`)
    .join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `For each bill below, write exactly ONE plain-English sentence (15–30 words) explaining what the bill aims to do or what it would change if passed, written for a general audience. Focus on real-world impact. Return ONLY a raw JSON array of strings — no markdown, no code fences, no explanation.\n\nBills:\n${billList}`,
        },
      ],
    });

    let raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";
    raw = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length === inputs.length) {
      return (parsed as unknown[]).map((s) => (typeof s === "string" ? s : ""));
    }
  } catch {
    /* fall through */
  }
  return inputs.map(() => "");
}

/**
 * Write a generated summary back to the cache. Errors are non-fatal —
 * the next sync just regenerates.
 */
export async function writeCachedSummary(
  db: Db,
  cacheKey: string,
  summary: string,
): Promise<void> {
  try {
    await db
      .insert(billSummaryCache)
      .values({ cacheKey, summary })
      .onConflictDoUpdate({
        target: billSummaryCache.cacheKey,
        set: { summary, updatedAt: new Date() },
      });
  } catch {
    /* non-fatal */
  }
}

/**
 * Convenience wrapper used by sync scripts. For each input, look up
 * cached summary; for cache misses, batch-generate via Claude and
 * write back. Returns parallel array of summaries (possibly `""`).
 */
export async function summarizeBills(
  db: Db,
  items: Array<SummarizeInput>,
): Promise<string[]> {
  if (items.length === 0) return [];
  const cached = await readCachedSummaries(
    db,
    items.map((i) => i.cacheKey),
  );
  const missingIdx = cached
    .map((s, i) => (s === null ? i : -1))
    .filter((i) => i >= 0);
  if (missingIdx.length === 0) return cached.map((s) => s ?? "");

  const generated = await generateSummariesBatch(
    missingIdx.map((i) => ({ promptTitle: items[i].promptTitle })),
  );

  await Promise.all(
    missingIdx.map(async (origIdx, genIdx) => {
      const summary = generated[genIdx];
      if (summary) {
        cached[origIdx] = summary;
        await writeCachedSummary(db, items[origIdx].cacheKey, summary);
      }
    }),
  );
  return cached.map((s) => s ?? "");
}
