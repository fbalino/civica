/**
 * Phase 5.8 — backtest harness.
 *
 * For a given backtest case:
 *   1. Load the curated events (`backtest_events` rows for the case).
 *   2. Run each through the multi-run classifier (uses the same
 *      logic as classify.ts but inline so we don't need raw_events
 *      cluster scaffolding).
 *   3. Build a trajectory by sampling decayed dimensional impact
 *      every 30 days from event_date−180 to event_date+365.
 *   4. Compute a verdict against the case's expected directions.
 *   5. Insert one `backtest_runs` row.
 *
 * The classifier here is identical to the production v2 classifier
 * (same prompt, same temperatures, same agreement logic). We do not
 * need to write to pulse_events_v2 — the harness keeps everything
 * scoped to its own tables so a backtest doesn't pollute production
 * data.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  backtestCases,
  backtestEvents,
  backtestRuns,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  EVENT_CATEGORY_INDEX,
  HUMAN_REVIEW_TIERS,
  SEVERITY_TIER_RANGES,
  halfLifeFor,
  EVENT_CATEGORIES,
  DELTA_LOWER_BOUND,
  DELTA_UPPER_BOUND,
} from "./taxonomy";
import { decayedImpact } from "./decay";
import { PULSE_DIMENSIONS, type PulseDimension, type SeverityTier, type ClassifierAgreement } from "./types";
import {
  pressFreedomScore,
  pressFreedomTier,
} from "./press-freedom";

type Db = NeonHttpDatabase<typeof schema>;

const MODEL = "claude-sonnet-4-6";
const TEMPERATURES = [0.0, 0.4, 0.8] as const;

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_PULSE_CLASSIFIER });
  }
  return _anthropic;
}

// Single source of truth — same prompt as production classify.ts.
import { CLASSIFIER_SYSTEM_PROMPT } from "./classifier-prompt";
const SYSTEM_PROMPT = CLASSIFIER_SYSTEM_PROMPT;

interface ClassifierLite {
  category: string;
  severity_tier: SeverityTier;
  severity_value: number;
  self_confidence: number;
  rationale: string;
}

interface ClassifiedBacktestEvent {
  eventDate: string;
  category: string;
  dimension: PulseDimension;
  severityTier: SeverityTier;
  severityValue: number;
  classifierAgreement: ClassifierAgreement;
  /** Final corroboration confidence in [0, 1] */
  corroborationConfidence: number;
  pressFreedomScore: number;
  /** Which classifier runs we'll preserve in the run snapshot */
  runs: Array<{
    run: number;
    temp: number;
    category: string;
    severityTier: string;
    severityValue: number;
  }>;
}

async function runOnce(
  userContent: string,
  temperature: number
): Promise<ClassifierLite | null> {
  const client = getAnthropic();
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      temperature,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
  } catch (err) {
    console.error(`[backtest:classify] LLM call failed at temp=${temperature}:`, err);
    return null;
  }
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const cleaned = text.trim().replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  try {
    const parsed = JSON.parse(cleaned) as Partial<ClassifierLite>;
    if (!parsed.category) return null;
    if (parsed.category === "none") {
      return {
        category: "none",
        severity_tier: "low_neg",
        severity_value: 0,
        self_confidence: 0,
        rationale: parsed.rationale ?? "",
      };
    }
    return {
      category: parsed.category,
      severity_tier: parsed.severity_tier as SeverityTier,
      severity_value: Number(parsed.severity_value ?? 0),
      self_confidence: Number(parsed.self_confidence ?? 0),
      rationale: String(parsed.rationale ?? ""),
    };
  } catch {
    return null;
  }
}

async function classifyEvent(
  title: string,
  body: string | null,
  countryName: string,
  iso3: string | null
): Promise<ClassifiedBacktestEvent | null> {
  const userContent = `Country: ${countryName}\n\nHeadline: ${title}\n\nBody:\n${body ?? ""}`;
  const press = pressFreedomScore(iso3);

  // Three runs in parallel
  const results = await Promise.all(
    TEMPERATURES.map(async (temp, idx) => {
      const r = await runOnce(userContent, temp);
      return { idx, temp, r };
    })
  );

  interface FilteredRun {
    run: number;
    temp: number;
    category: string;
    dimension: PulseDimension;
    severityTier: SeverityTier;
    severityValue: number;
  }
  const filtered: FilteredRun[] = [];
  for (const { idx, temp, r } of results) {
    if (!r || r.category === "none") continue;
    const cat = EVENT_CATEGORY_INDEX[r.category];
    if (!cat) continue;
    if (!cat.allowedTiers.includes(r.severity_tier)) continue;
    const range = SEVERITY_TIER_RANGES[r.severity_tier];
    const clamped = Math.max(
      range.min,
      Math.min(range.max, Math.round(r.severity_value))
    );
    filtered.push({
      run: idx + 1,
      temp,
      category: r.category,
      dimension: cat.dimension,
      severityTier: r.severity_tier,
      severityValue: clamped,
    });
  }

  if (filtered.length === 0) return null;

  // Agreement on (category, severityTier)
  const keys = filtered.map((r) => `${r.category}::${r.severityTier}`);
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const allMatch = filtered.length === 3 && new Set(keys).size === 1;
  const maxCount = Math.max(...counts.values());
  const agreement: ClassifierAgreement = allMatch
    ? "all"
    : maxCount >= 2
      ? "two_of_three"
      : "none";

  const majorityKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const winners = filtered.filter(
    (r) => `${r.category}::${r.severityTier}` === majorityKey
  );
  if (winners.length === 0) return null;
  const consensus = winners[0];
  const avgSeverity = Math.round(
    winners.reduce((s, r) => s + r.severityValue, 0) / winners.length
  );

  // Corroboration confidence (simplified — single source per event in
  // our seed data, so we lean on classifier agreement). Production
  // pipeline would also count specialist + news sources.
  const baseConf =
    agreement === "all" ? 0.85 : agreement === "two_of_three" ? 0.65 : 0.4;
  const tier = pressFreedomTier(press);
  let conf = baseConf;
  if (tier === "partial") conf *= 0.85;
  if (tier === "restricted") conf *= 0.7; // single specialist source assumed
  conf = Math.max(0, Math.min(1, conf));

  // Skip events that would route to human review in production —
  // backtest assumes a perfect reviewer who would approve them.
  // (We still apply the corroboration penalty above.)
  void HUMAN_REVIEW_TIERS;

  return {
    eventDate: "", // filled by caller
    category: consensus.category,
    dimension: consensus.dimension,
    severityTier: consensus.severityTier,
    severityValue: avgSeverity,
    classifierAgreement: agreement,
    corroborationConfidence: conf,
    pressFreedomScore: press,
    runs: filtered.map((f) => ({
      run: f.run,
      temp: f.temp,
      category: f.category,
      severityTier: f.severityTier,
      severityValue: f.severityValue,
    })),
  };
}

interface TrajectorySample {
  dayOffset: number;
  dimension: PulseDimension;
  delta: number;
}

interface ExpectedRow {
  dimension: string;
  direction: "positive" | "negative" | "mixed";
  magnitude: "moderate" | "severe" | "catastrophic";
}

interface VerdictDetail {
  expected: ExpectedRow;
  /** True peak |delta| within ±90d of the case eventDate */
  peakDelta: number;
  /** Days from case eventDate to peak */
  peakDay: number;
  /** Did the peak meet the magnitude threshold in the right direction? */
  pass: boolean;
  notes: string;
}

const MAGNITUDE_THRESHOLDS: Record<string, number> = {
  moderate: 1.0,
  severe: 3.0,
  catastrophic: 5.0,
};

function buildTrajectory(
  caseDate: Date,
  classified: Array<ClassifiedBacktestEvent & { eventDate: string }>
): TrajectorySample[] {
  const samples: TrajectorySample[] = [];
  // Sample every 30 days from -180 to +365
  for (let off = -180; off <= 365; off += 30) {
    const sampleDate = new Date(caseDate.getTime() + off * 86400000);
    for (const dim of PULSE_DIMENSIONS) {
      let total = 0;
      for (const ev of classified) {
        if (ev.dimension !== dim) continue;
        const evDate = new Date(ev.eventDate).getTime();
        if (evDate > sampleDate.getTime()) continue; // future event, no contribution
        const days = Math.max(
          0,
          (sampleDate.getTime() - evDate) / 86400000
        );
        total += decayedImpact(
          ev.severityValue,
          ev.corroborationConfidence,
          days,
          ev.category
        );
      }
      const clamped = Math.max(
        DELTA_LOWER_BOUND,
        Math.min(DELTA_UPPER_BOUND, total)
      );
      samples.push({ dayOffset: off, dimension: dim, delta: clamped });
    }
  }
  return samples;
}

function judge(
  expected: ExpectedRow[],
  trajectory: TrajectorySample[]
): {
  verdict: "pass" | "partial" | "fail";
  details: VerdictDetail[];
} {
  const details: VerdictDetail[] = expected.map((exp) => {
    const window = trajectory.filter(
      (s) =>
        s.dimension === exp.dimension &&
        s.dayOffset >= -30 &&
        s.dayOffset <= 90
    );
    let peakDelta = 0;
    let peakDay = 0;
    for (const s of window) {
      if (Math.abs(s.delta) > Math.abs(peakDelta)) {
        peakDelta = s.delta;
        peakDay = s.dayOffset;
      }
    }
    const threshold = MAGNITUDE_THRESHOLDS[exp.magnitude] ?? 1.0;
    const directionOk =
      exp.direction === "positive"
        ? peakDelta >= threshold
        : exp.direction === "negative"
          ? peakDelta <= -threshold
          : Math.abs(peakDelta) >= threshold;
    return {
      expected: exp,
      peakDelta,
      peakDay,
      pass: directionOk,
      notes: directionOk
        ? `Peak ${peakDelta.toFixed(2)} on day ${peakDay} matched expected ${exp.magnitude} ${exp.direction}.`
        : `Peak ${peakDelta.toFixed(2)} on day ${peakDay} did not reach the ${exp.magnitude} (${exp.direction}) threshold of ${threshold}.`,
    };
  });
  const passes = details.filter((d) => d.pass).length;
  const verdict: "pass" | "partial" | "fail" =
    passes === details.length
      ? "pass"
      : passes >= Math.ceil(details.length / 2)
        ? "partial"
        : "fail";
  return { verdict, details };
}

export interface BacktestRunResult {
  caseId: string;
  verdict: "pass" | "partial" | "fail";
  detail: VerdictDetail[];
  classified: Array<ClassifiedBacktestEvent & { eventDate: string }>;
  trajectorySamples: number;
}

export async function runBacktest(
  db: Db,
  caseId: string
): Promise<BacktestRunResult | null> {
  const caseRows = await db
    .select()
    .from(backtestCases)
    .where(eq(backtestCases.id, caseId))
    .limit(1);
  const cs = caseRows[0];
  if (!cs) return null;

  const events = await db
    .select()
    .from(backtestEvents)
    .where(eq(backtestEvents.caseId, caseId));

  const classified: Array<ClassifiedBacktestEvent & { eventDate: string }> = [];
  for (const ev of events) {
    process.stdout.write(`    classifying ${ev.eventDate.slice(0, 10)} … `);
    const c = await classifyEvent(
      ev.title,
      ev.body,
      cs.countryName,
      cs.countryIso3
    );
    if (!c) {
      console.log("(skipped)");
      continue;
    }
    classified.push({ ...c, eventDate: ev.eventDate });
    console.log(
      `→ ${c.category} ${c.severityTier} (${c.severityValue}) [${c.classifierAgreement}]`
    );
  }

  const trajectory = buildTrajectory(new Date(cs.eventDate), classified);
  const expected = cs.expected as ExpectedRow[];
  const { verdict, details } = judge(expected, trajectory);

  // Snapshot: the parameters that produced this run.
  const paramSnapshot = {
    model: MODEL,
    temperatures: TEMPERATURES,
    halfLifeSamples: Object.fromEntries(
      ["coup", "judicial_purge", "journalist_arrest"].map((k) => [
        k,
        halfLifeFor(k),
      ])
    ),
    deltaBounds: [DELTA_LOWER_BOUND, DELTA_UPPER_BOUND],
    classifierAgreementWeights: {
      all: 0.85,
      two_of_three: 0.65,
      none: 0.4,
    },
  };

  await db.insert(backtestRuns).values({
    caseId,
    paramSnapshot,
    trajectory,
    verdict,
    detail: details,
  });

  return {
    caseId,
    verdict,
    detail: details,
    classified,
    trajectorySamples: trajectory.length,
  };
}

/** Wrapper to run every case in DB, used by `npm run backtest:run`. */
export async function runAllBacktests(
  db: Db
): Promise<BacktestRunResult[]> {
  const cases = await db
    .select({ id: backtestCases.id })
    .from(backtestCases)
    .orderBy(sql`${backtestCases.id}`);
  const results: BacktestRunResult[] = [];
  for (const c of cases) {
    console.log(`\n── ${c.id} ──`);
    const r = await runBacktest(db, c.id);
    if (r) results.push(r);
  }
  return results;
}
