/**
 * Backtest harness.
 *
 * For a given backtest case:
 *   1. Load the curated events (`backtest_events` rows for the case).
 *   2. Run each through a deliberately separate single-engine diagnostic
 *      classifier. This is not the production ensemble.
 *   3. Build a trajectory by sampling decayed dimensional impact
 *      every 30 days from event_date−180 to event_date+360.
 *   4. Compute a verdict against the case's expected directions.
 *   5. Insert one `backtest_runs` row.
 *
 * The harness shares prompts and parsers with production, but not its
 * multi-vendor voting, subject attribution, source mix, clustering, review
 * behavior, or full corroboration path. It is a regression smoke test only.
 * Results must never be presented as representative validation of the
 * production runtime.
 */

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
  SEVERITY_TIER_RANGES,
  halfLifeFor,
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

// Single source of truth — same prompts + parsing as production classify.ts.
import {
  CLASSIFIER_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  agreementFromConfidence,
  parseClassify,
  parseVerify,
  type VerifyConfidence,
} from "./classifier-prompt";
import { verifierObjects } from "./publication-gate";
// Provider abstraction for the diagnostic harness. It defaults to Anthropic
// and remains intentionally separate from the production ensemble.
import {
  callClassifier,
  PROVIDER_DEFAULT_MODEL,
  type ClassifierProvider,
  type ResolvedProviderConfig,
} from "./provider";
const SYSTEM_PROMPT = CLASSIFIER_SYSTEM_PROMPT;

/** Diagnostic engine: Anthropic by default,
 *  overridable via PULSE_BACKTEST_PROVIDER / PULSE_BACKTEST_MODEL. Kept
 *  separate from the production classify defaults so a cheap production
 *  swap never silently changes what the backtest validates against. */
function resolveBacktestConfig(): ResolvedProviderConfig {
  const raw = (process.env.PULSE_BACKTEST_PROVIDER ?? "").trim().toLowerCase();
  const provider: ClassifierProvider =
    raw === "deepseek" || raw === "glm" || raw === "anthropic"
      ? (raw as ClassifierProvider)
      : raw === "zhipu"
        ? "glm"
        : "anthropic";
  const model =
    (process.env.PULSE_BACKTEST_MODEL ?? "").trim() ||
    PROVIDER_DEFAULT_MODEL[provider];
  return { provider, model };
}

const BACKTEST_CONFIG = resolveBacktestConfig();
const MODEL = BACKTEST_CONFIG.model;

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
  /** The two reasoning passes preserved in the run snapshot */
  runs: Array<{
    run: number;
    pass: "classify" | "verify";
    category: string;
    severityTier: string;
    severityValue: number;
    confidence?: VerifyConfidence;
  }>;
}

async function classifyEvent(
  title: string,
  body: string | null,
  countryName: string,
  iso3: string | null
): Promise<ClassifiedBacktestEvent | null> {
  const userContent = `Country: ${countryName}\n\nHeadline: ${title}\n\nBody:\n${body ?? ""}`;
  const press = pressFreedomScore(iso3);

  // Pass 1 — classify.
  let classifyResp;
  try {
    classifyResp = await callClassifier(BACKTEST_CONFIG, {
      system: SYSTEM_PROMPT,
      user: userContent,
      maxTokens: 800,
      expectJson: true,
    });
  } catch (err) {
    console.error(`[backtest:classify] classify call failed:`, err);
    return null;
  }
  const first = parseClassify(classifyResp.text);
  if (!first || first.category === "none") return null;

  const cat = EVENT_CATEGORY_INDEX[first.category];
  if (!cat) return null;
  if (!cat.allowedTiers.includes(first.severityTier)) return null;
  const range = SEVERITY_TIER_RANGES[first.severityTier];
  const severityValue = Math.max(
    range.min,
    Math.min(range.max, Math.round(first.severityValue))
  );

  // Pass 2 — verify (refute).
  const verifyContent = `${userContent}

FIRST-PASS CLASSIFICATION TO VERIFY:
- category: ${first.category} (dimension ${cat.dimension})
- runner-up considered: ${first.runnerUp}
- severity: ${first.severityTier} (${severityValue})
- rationale: ${first.rationale}`;
  let verifyResp;
  try {
    verifyResp = await callClassifier(BACKTEST_CONFIG, {
      system: VERIFY_SYSTEM_PROMPT,
      user: verifyContent,
      maxTokens: 500,
      expectJson: true,
    });
  } catch (err) {
    console.error(`[backtest:classify] verify call failed:`, err);
    verifyResp = null;
  }
  const verifyText = verifyResp?.text ?? "";
  const verify = verifyText ? parseVerify(verifyText) : null;
  const confidence: VerifyConfidence = verify?.confidence ?? "low";
  const effectiveConfidence = verifierObjects(verify) ? "low" : confidence;
  const agreement = agreementFromConfidence(effectiveConfidence);

  // Corroboration confidence (simplified — single source per event in
  // our seed data, so we lean on the classify→verify confidence).
  // Production pipeline (corroborate.ts) also counts specialist + news
  // sources. The agreement→base mapping mirrors baselineConfidence there.
  const baseConf =
    agreement === "all" ? 0.85 : agreement === "two_of_three" ? 0.65 : 0.4;
  const tier = pressFreedomTier(press);
  let conf = baseConf;
  if (tier === "partial") conf *= 0.85;
  if (tier === "restricted") conf *= 0.7; // single specialist source assumed
  conf = Math.max(0, Math.min(1, conf));

  // The diagnostic keeps candidates that would route to human review and
  // effectively assumes approval, but verifier objections retain the low
  // agreement/corroboration signal above.

  return {
    eventDate: "", // filled by caller
    category: first.category,
    dimension: cat.dimension,
    severityTier: first.severityTier,
    severityValue,
    classifierAgreement: agreement,
    corroborationConfidence: conf,
    pressFreedomScore: press,
    runs: [
      {
        run: 1,
        pass: "classify",
        category: first.category,
        severityTier: first.severityTier,
        severityValue,
      },
      {
        run: 2,
        pass: "verify",
        category: first.category,
        severityTier: first.severityTier,
        severityValue,
        confidence,
      },
    ],
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
  /** True peak |delta| from day −30 through day +90 */
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
  // Sample every 30 days from -180 to +360.
  for (let off = -180; off <= 360; off += 30) {
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
    classifier: "classify-then-verify",
    halfLifeSamples: Object.fromEntries(
      ["coup", "judicial_purge", "journalist_arrest"].map((k) => [
        k,
        halfLifeFor(k),
      ])
    ),
    deltaBounds: [DELTA_LOWER_BOUND, DELTA_UPPER_BOUND],
    // Verify-confidence → corroboration base (mirrors corroborate.ts):
    // high→all→0.85, medium→two_of_three→0.65, low→none→0.4.
    confidenceBaseWeights: {
      high: 0.85,
      medium: 0.65,
      low: 0.4,
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
