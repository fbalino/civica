/**
 * Phase 5.10 polish — review-queue AI summary.
 *
 * Generates a 2–3 sentence plain-English summary of a Pulse v2 event
 * for the admin review surface. The reviewer reads this instead of
 * the raw RSS description (which often has image captions, copyright
 * lines, and other artifacts). Cached on `pulse_events_v2.ai_summary`
 * so we only pay one LLM call per event for the lifetime of the row.
 *
 * Mirrors the lazy-init pattern from `src/lib/bills/summarize.ts` —
 * dotenv populates `ANTHROPIC_API_KEY` at script-body time, after
 * static imports are hoisted, so the SDK client is constructed on
 * first use rather than at module load.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pulseEventsV2 } from "@/lib/db/schema";
import {
  assertModelOperationRequest,
  modelOperationVersion,
} from "@/lib/model-operations/contract";

export const PULSE_REVIEW_SUMMARY_PROVIDER = "anthropic" as const;
export const PULSE_REVIEW_SUMMARY_MODEL = "claude-haiku-4-5-20251001" as const;
export const PULSE_REVIEW_SUMMARY_MODEL_VERSION = modelOperationVersion(
  "pulse-review-summary",
  PULSE_REVIEW_SUMMARY_PROVIDER,
  PULSE_REVIEW_SUMMARY_MODEL,
);

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY_PULSE_SUMMARIZE,
      maxRetries: 0,
    });
  }
  return _anthropic;
}

interface SummariseInput {
  /** Country in question. Used to anchor pronoun + scope in the summary. */
  country: string;
  /** The pulse event headline. */
  headline: string;
  /** The raw event description (RSS body — may contain artifacts). */
  description: string;
}

const SYSTEM_PROMPT = `You are a neutral political-science writer who summarises governance events for human reviewers. Given a country, a headline, and a raw news description (which may contain RSS artifacts, image captions, or copyright lines), produce a 2–3 sentence plain-English summary that:

1. States what happened, when, and who was involved.
2. Notes the institutional or rights significance for the country.
3. Stays factual. Does NOT editorialise. Does NOT predict consequences. Does NOT use loaded adjectives.

Strip RSS artifacts (image captions, copyright lines, "Click to expand", trailing source attributions). Do not include the headline verbatim. Reply with the summary text only — no preamble, no markdown, no quotes.`;

/**
 * Generate a fresh summary via Anthropic. Returns the summary string,
 * or null if the API call or parse fails (caller treats null as
 * "no summary available, render raw description instead").
 */
export async function generatePulseSummary(
  input: SummariseInput
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY_PULSE_SUMMARIZE) return null;
  const anthropic = getAnthropic();

  const userPrompt = [
    `Country: ${input.country}`,
    `Headline: ${input.headline}`,
    `Description (may include RSS artifacts):`,
    input.description.slice(0, 6000),
  ].join("\n\n");

  try {
    assertModelOperationRequest(
      "pulse-review-summary",
      SYSTEM_PROMPT.length + userPrompt.length,
      280,
    );
    const response = await anthropic.messages.create({
      model: PULSE_REVIEW_SUMMARY_MODEL,
      max_tokens: 280,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = response.content[0];
    if (block?.type !== "text") return null;
    const text = block.text.trim();
    if (text.length < 10) return null;
    return text;
  } catch {
    console.error("[pulse-summarise] generation_failed");
    return null;
  }
}

/**
 * Idempotent helper: if the row already has `aiSummary`, returns it.
 * Otherwise generates one, persists it, and returns it. Persistence
 * is best-effort — a transient DB error will still return the freshly
 * generated string so the caller can render this turn.
 */
export async function ensurePulseSummary(args: {
  eventId: string;
  country: string;
  headline: string;
  description: string;
  existingSummary: string | null;
}): Promise<string | null> {
  if (args.existingSummary && args.existingSummary.trim().length > 0) {
    return args.existingSummary;
  }
  const fresh = await generatePulseSummary({
    country: args.country,
    headline: args.headline,
    description: args.description,
  });
  if (!fresh) return null;
  try {
    await db
      .update(pulseEventsV2)
      .set({ aiSummary: fresh, updatedAt: new Date() })
      .where(eq(pulseEventsV2.id, args.eventId));
  } catch {
    console.error("[pulse-summarise] persist_failed");
  }
  return fresh;
}
