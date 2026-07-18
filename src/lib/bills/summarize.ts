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
import {
  assertModelOperationRequest,
  modelOperationVersion,
} from "@/lib/model-operations/contract";
import type * as schema from "@/lib/db/schema";

type Db = NeonHttpDatabase<typeof schema>;

export const BILLS_SUMMARY_MODEL = "claude-haiku-4-5-20251001" as const;
export const BILLS_SUMMARY_MODEL_VERSION = modelOperationVersion(
  "bills-summarize",
  "anthropic",
  BILLS_SUMMARY_MODEL,
);

/**
 * Lazy-initialised so dotenv (loaded synchronously at the top of each
 * sync script) gets to populate `ANTHROPIC_API_KEY` *before* the SDK
 * reads it. Module-level `new Anthropic()` evaluates when imports are
 * hoisted, which is before the script body runs.
 */
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY_BILLS_SUMMARIZE,
      maxRetries: 0,
    });
  }
  return _anthropic;
}

/** A model change receives a fresh cache namespace rather than silently
 * serving a prior model's text as current output. */
export function makeCacheKey(iso2: string, billTitle: string): string {
  return `${BILLS_SUMMARY_MODEL_VERSION}::${iso2}::${billTitle.slice(0, 120)}`;
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
 * Internal: send a single Anthropic call for up to `CHUNK_SIZE` bills
 * and parse the JSON-array response. Returns `[]` on any failure so
 * `generateSummariesBatch` can fill the slots with empty strings.
 */
async function generateChunk(
  inputs: Array<{ promptTitle: string }>,
): Promise<string[]> {
  if (inputs.length === 0) return [];

  const billList = inputs
    .map((b, i) => `${i + 1}. "${b.promptTitle.slice(0, 240)}"`)
    .join("\n");

  try {
    const userPrompt = `For each bill below, write exactly ONE plain-English sentence (15–30 words) explaining what the bill aims to do or what it would change if passed, written for a general audience. Some titles may be in a non-English language — write the summary in English regardless. Focus on real-world impact. Return ONLY a raw JSON array of strings — no markdown, no code fences, no explanation.\n\nBills:\n${billList}`;
    const maxTokens = Math.max(600, inputs.length * 75);
    assertModelOperationRequest("bills-summarize", userPrompt.length, maxTokens);
    const msg = await getAnthropic().messages.create({
      model: BILLS_SUMMARY_MODEL,
      // Budget ~60 output tokens per bill (≈25-word sentence + JSON
      // overhead). At CHUNK_SIZE=20 → 1500 tokens.
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: userPrompt,
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

/** Bills per Anthropic call — keeps responses well under the model's
 * output cap and survives the occasional verbose summary. */
const CHUNK_SIZE = 20;
const MAX_BILL_SUMMARY_CALLS_PER_EXECUTION = 25;

/**
 * Generate one-sentence summaries via Claude Haiku. Splits inputs into
 * chunks of `CHUNK_SIZE` so a single oversized response can't lose the
 * whole batch. Returns a parallel array aligned with `inputs`; an
 * entry is `""` if generation failed.
 */
export async function generateSummariesBatch(
  inputs: Array<{ promptTitle: string }>,
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY_BILLS_SUMMARIZE || inputs.length === 0) {
    return inputs.map(() => "");
  }

  const allowedInputs = inputs.slice(
    0,
    CHUNK_SIZE * MAX_BILL_SUMMARY_CALLS_PER_EXECUTION,
  );
  const out: string[] = [];
  for (let i = 0; i < allowedInputs.length; i += CHUNK_SIZE) {
    const chunk = allowedInputs.slice(i, i + CHUNK_SIZE);
    const summaries = await generateChunk(chunk);
    out.push(...summaries);
  }
  // A caller cannot convert a larger upstream import into unbounded paid
  // work. The skipped rows remain source-title-only and will be reconsidered
  // by a later bounded sync.
  return [...out, ...inputs.slice(allowedInputs.length).map(() => "")];
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
