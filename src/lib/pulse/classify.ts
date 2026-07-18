import Anthropic from "@anthropic-ai/sdk";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, sql as dsql } from "drizzle-orm";
import { pulseEvents } from "../db/schema";

export type ClassificationCategory =
  | "armed_conflict"
  | "political_violence"
  | "authoritarian_action"
  | "institutional_failure"
  | "human_rights_violation"
  | "disaster"
  | "economic_crisis"
  | "democratic_election"
  | "constitutional_reform"
  | "peace_agreement"
  | "institutional_strengthening"
  | "humanitarian_progress";

export interface ClassificationResult {
  category: ClassificationCategory;
  severity: number;
  confidence: number;
  justification: string;
}

export interface ClassificationSummary {
  total: number;
  succeeded: number;
  failed: number;
}

const VALID_CATEGORIES: ClassificationCategory[] = [
  "armed_conflict",
  "political_violence",
  "authoritarian_action",
  "institutional_failure",
  "human_rights_violation",
  "disaster",
  "economic_crisis",
  "democratic_election",
  "constitutional_reform",
  "peace_agreement",
  "institutional_strengthening",
  "humanitarian_progress",
];

const SYSTEM_PROMPT = `You are a political event classifier for Civica, a governance intelligence platform.
Classify each event into exactly one of these 12 categories:

Negative categories (assign negative severity -1 to -10):
- armed_conflict: Wars, military offensives, insurgencies, cross-border attacks
- political_violence: Assassinations, riots, targeted killings, state repression
- authoritarian_action: Coups, crackdowns, media suppression, emergency powers abuse
- institutional_failure: Corruption scandals, government collapse, election fraud
- human_rights_violation: Mass arrests, torture, persecution of minorities
- disaster: Natural disasters, epidemics with governance failures
- economic_crisis: Debt defaults, hyperinflation, sanctions, financial collapse

Positive categories (assign positive severity +1 to +10):
- democratic_election: Free/fair elections, high turnout, peaceful transfers of power
- constitutional_reform: New constitutions, rights expansions, democratic amendments
- peace_agreement: Ceasefires, treaties, conflict resolution agreements
- institutional_strengthening: Anti-corruption wins, independent judiciary gains
- humanitarian_progress: Refugee protections, rights milestones, aid breakthroughs

Severity scale: -10 (catastrophic negative) to +10 (transformative positive). Minor events ±1-3, moderate ±4-6, major ±7-10.
Confidence: 0.0 (very uncertain) to 1.0 (very certain).

Respond with a JSON array where each element corresponds to the input event at that index:
[{"category":"...","severity":N,"confidence":N,"justification":"one sentence"}]

Only output the JSON array, no other text.`;

export function createDb() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  return drizzle({ client: sqlClient });
}

export type Db = ReturnType<typeof createDb>;

interface UnclassifiedEvent {
  id: string;
  headline: string;
  sourceName: string | null;
  rawEventData: unknown;
  eventDate: string;
}

export async function fetchUnclassifiedEvents(
  db: Db,
  limit = 100
): Promise<UnclassifiedEvent[]> {
  const rows = await db
    .select({
      id: pulseEvents.id,
      headline: pulseEvents.headline,
      sourceName: pulseEvents.sourceName,
      rawEventData: pulseEvents.rawEventData,
      eventDate: pulseEvents.eventDate,
    })
    .from(pulseEvents)
    .where(
      and(
        eq(pulseEvents.category, "unclassified"),
        eq(pulseEvents.isActive, true)
      )
    )
    .limit(limit);
  return rows;
}

function buildEventContext(event: UnclassifiedEvent): string {
  const raw =
    event.rawEventData &&
    typeof event.rawEventData === "object" &&
    !Array.isArray(event.rawEventData)
      ? (event.rawEventData as Record<string, unknown>)
      : {};
  const parts: string[] = [
    `Headline: ${event.headline}`,
    `Date: ${event.eventDate}`,
  ];
  if (event.sourceName) parts.push(`Source: ${event.sourceName}`);
  if (raw.url) parts.push(`URL: ${raw.url}`);
  if (raw.seentimestamp) parts.push(`Seen: ${raw.seentimestamp}`);
  return parts.join(" | ");
}

async function classifyBatch(
  client: Anthropic,
  events: UnclassifiedEvent[]
): Promise<(ClassificationResult | null)[]> {
  const userContent = events
    .map((e, i) => `Event ${i}: ${buildEventContext(e)}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const responseId = response.id;
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn("[pulse-v1] provider_parse_failed");
    return events.map(() => null);
  }

  if (!Array.isArray(parsed) || parsed.length !== events.length) {
    console.warn(`[classify] Response length mismatch: expected ${events.length}, got ${Array.isArray(parsed) ? parsed.length : "non-array"}`);
    return events.map(() => null);
  }

  return (parsed as unknown[]).map((item, i) => {
    if (!item || typeof item !== "object") {
      console.warn(`[classify] Event ${i}: non-object result`);
      return null;
    }
    const r = item as Record<string, unknown>;
    const category = r.category as string;
    const severity = Number(r.severity);
    const confidence = Number(r.confidence);
    const justification = String(r.justification ?? "");

    if (!VALID_CATEGORIES.includes(category as ClassificationCategory)) {
      console.warn(`[classify] Event ${i}: invalid category "${category}"`);
      return null;
    }
    if (isNaN(severity) || severity < -10 || severity > 10) {
      console.warn(`[classify] Event ${i}: invalid severity ${severity}`);
      return null;
    }
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      console.warn(`[classify] Event ${i}: invalid confidence ${confidence}`);
      return null;
    }

    return {
      category: category as ClassificationCategory,
      severity,
      confidence,
      justification,
      _responseId: responseId,
    } as ClassificationResult & { _responseId: string };
  });
}

export async function classifyPulseEvents(
  db: Db,
  options: { batchSize?: number; batchDelayMs?: number } = {}
): Promise<ClassificationSummary> {
  // Pulse v1 is retired by PUL-035. Keep the export as a harmless migration
  // seam for older callers, but it must not create a paid request.
  void db;
  void options;
  console.warn("[pulse-v1] retired_no_model_call");
  return { total: 0, succeeded: 0, failed: 0 };
}
