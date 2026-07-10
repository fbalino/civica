/**
 * Pulse country attribution — by SUBJECT, not by source language/outlet.
 *
 * The cheap ingest-time resolver (country-resolver.ts) keys off country
 * mentions / source-language / outlet origin, which mis-attributes events:
 * a Portuguese-outlet story about US politics resolves to Brazil; a
 * Chinese-language story about US redistricting resolves to Taiwan; a
 * Romanian story about Hungary's LGBTQ law resolves to Romania.
 *
 * This module does a single LLM pass that classifies an event by the
 * country whose governance it is PRIMARILY about, independent of the
 * text's language or the outlet's country. It is the shared brain used
 * by:
 *   - the classify pipeline (classify.ts) — to set the correct
 *     jurisdiction_id on each pulse_events_v2 row, and
 *   - scripts/reattribute-pulse-country.ts — to retro-fix existing rows.
 *
 * NOTE on cost: the scheduled API pipeline invokes this pass, adding one
 * Claude call per classified cluster. A future cost-optimized path can fold a
 * validated `subject_iso3` field into the ensemble output instead of issuing
 * this extra call.
 */
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@/lib/db/schema";

type Db = NeonHttpDatabase<typeof schema>;

const MODEL = "claude-sonnet-4-6";

export const SUBJECT_ATTRIBUTION_SYSTEM_PROMPT = `You are a geopolitical news classifier for a governance-data platform.
Given ONE news/event headline and description, identify the single sovereign country whose
domestic governance, politics, institutions, elections, rule of law, civil rights, corruption,
or political stability the event is PRIMARILY about.

CRITICAL RULES:
- Judge by the SUBJECT of the event, NOT the language of the text and NOT the country of the
  news outlet. A Portuguese-language or Brazilian-outlet story about US politics is a UNITED
  STATES (USA) event. A Chinese-language story about US redistricting is a USA event. A
  Romanian-language story about Hungary's LGBTQ law is a HUNGARY (HUN) event.
- For a domestic action by a national leader/government (e.g. "Trump pardons X", "Macron
  dissolves parliament"), attribute it to THAT leader's own country.
- For a bilateral action ("Country A sanctions/invades/recognizes Country B"), attribute it to
  the country whose own governance, territory, or institutions the event most directly changes;
  if it is primarily about A's foreign-policy decision, choose A; if it is primarily about the
  effect on B's governance/sovereignty, choose B. Pick the single most central one.
- If the event is genuinely about a supranational body (EU, UN, ICC, NATO, African Union, etc.)
  or about several countries with no single primary subject, set scope to "supranational" or
  "multi" and iso3 to null.
- If you cannot determine the subject country, set scope to "unclear" and iso3 to null.

Return STRICT JSON ONLY, no prose, no code fences:
{"iso3":"USA","country":"United States","scope":"single","confidence":"high","reasoning":"one short sentence"}
- iso3: ISO 3166-1 alpha-3 of the primary sovereign country, or null when scope is not "single".
- scope: one of "single" | "supranational" | "multi" | "unclear".
- confidence: one of "high" | "medium" | "low".`;

export interface SubjectVerdict {
  iso3: string | null;
  country: string | null;
  scope: "single" | "supranational" | "multi" | "unclear";
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY_PULSE_CLASSIFIER,
    });
  }
  return _anthropic;
}

/**
 * Classify a single event by its subject country via one Claude call.
 * Returns null on any error or unparseable response (caller keeps the
 * existing attribution rather than guessing).
 */
export async function classifySubjectCountry(
  headline: string,
  description: string
): Promise<SubjectVerdict | null> {
  try {
    const resp = await getAnthropic().messages.create({
      model: MODEL,
      max_tokens: 300,
      system: SUBJECT_ATTRIBUTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Headline: ${headline}\nDescription: ${(description || "").slice(0, 1500)}`,
        },
      ],
    });
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    return JSON.parse(text) as SubjectVerdict;
  } catch {
    return null;
  }
}

let _iso3Cache: Map<string, string> | null = null;
async function getIso3ToJurisdiction(db: Db): Promise<Map<string, string>> {
  if (_iso3Cache) return _iso3Cache;
  const result = await db.execute(
    sql`SELECT id, iso3 FROM jurisdictions WHERE iso3 IS NOT NULL`
  );
  const rows = (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Array<{ id: string; iso3: string }>;
  const map = new Map<string, string>();
  for (const r of rows) map.set(String(r.iso3).toUpperCase(), String(r.id));
  _iso3Cache = map;
  return map;
}

/**
 * Resolve the correct subject jurisdiction id for an event, or null when
 * the subject is ambiguous / supranational / low-confidence / has no
 * jurisdiction row — in which case the caller should keep the existing
 * attribution. `currentJurisdictionId` lets us short-circuit when the LLM
 * agrees with the current attribution.
 */
export async function resolveSubjectJurisdiction(
  db: Db,
  headline: string,
  description: string
): Promise<{ jurisdictionId: string; verdict: SubjectVerdict } | null> {
  const verdict = await classifySubjectCountry(headline, description);
  if (!verdict || verdict.scope !== "single" || !verdict.iso3) return null;
  if (verdict.confidence === "low") return null;
  const map = await getIso3ToJurisdiction(db);
  const jurisdictionId = map.get(verdict.iso3.toUpperCase());
  if (!jurisdictionId) return null;
  return { jurisdictionId, verdict };
}
