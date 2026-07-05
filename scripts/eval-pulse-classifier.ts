/**
 * Pulse classifier eval — two modes.
 *
 * ── --ensemble (owner decision 2026-07-05) ────────────────────────────
 * Runs the CONFIGURED cross-model ensemble (PULSE_CLASSIFY_ENSEMBLE —
 * default DeepSeek v4-flash + GLM 4.7-flashx + Anthropic Haiku 4.5) over N
 * historical clusters (default 200) and reports the AGREEMENT DISTRIBUTION:
 * unanimous %, two-of-three %, deadlock %, the engine-pair agreement matrix,
 * per-engine "none"-category rate, verify-refutation rate on majorities, the
 * projected review-queue size per day at current volume, and measured cost
 * per event and per month. It does NOT score against stored labels — the
 * owner's position is that past approvals were smoke tests, not gold;
 * consensus quality is measured by cross-model agreement. Writes a dated JSON
 * report to tmp/.
 *
 * ── default single-candidate mode — §7 of ──────────────────────────────
 * plan/pulse-classifier-cost-resolution-v1.md (the quality bar a cheap
 * candidate engine must clear before it replaces the incumbent on the
 * paid classify path).
 *
 * What the single-candidate mode does:
 *   1. Pulls N already-classified historical clusters from pulse_events_v2
 *      as the GOLD set (preferring human_reviewed / approved rows — the
 *      highest-confidence labels available).
 *   2. Re-classifies each one with a CANDIDATE provider/model using the
 *      exact same classify→verify prompts and parse contracts as
 *      production (classifier-prompt.ts).
 *   3. Reports, against the gold labels:
 *        - category agreement %
 *        - severity-tier agreement %
 *        - subject-country agreement %
 *        - a confusion summary (top category disagreements)
 *        - directional flips (_pos↔_neg) — the §7 disqualifier
 *        - JSON-parse failure rate
 *        - token usage + real cost at the provider's published prices
 *   4. Writes a dated JSON+text report to tmp/.
 *
 * SAFETY: this makes NO live API calls unless a real key is set for the
 * candidate provider. Without the key it exits with a clear
 * "set <KEY> to run" message. A `--mock` flag stubs the HTTP layer so the
 * plumbing (selection, prompt build, parsing, metric math, report write)
 * can be smoke-tested with zero network + zero keys.
 *
 * Usage:
 *   npm run eval:pulse-classifier -- --ensemble --n 200      # ensemble distribution
 *   npm run eval:pulse-classifier -- --ensemble --mock       # ensemble plumbing smoke test
 *   npm run eval:pulse-classifier -- --provider deepseek --model deepseek-v4-flash
 *   npm run eval:pulse-classifier -- --provider glm --model glm-4.7 --n 100
 *   npm run eval:pulse-classifier -- --mock            # plumbing smoke test
 *
 * This is a measurement tool only — it never writes to pulse_events_v2
 * and never gates anything automatically. The owner reads the report and
 * decides against the §7 bar.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import {
  CLASSIFIER_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  parseClassify,
  parseVerify,
} from "../src/lib/pulse/v2/classifier-prompt";
import {
  callClassifier,
  providerKeyEnvName,
  providerKeyPresent,
  PROVIDER_DEFAULT_MODEL,
  PROVIDER_MODEL_PRICES,
  resolveClassifyEnsemble,
  resolveEnsembleVerifyConfig,
  type ClassifierProvider,
  type OpenAiCompatOptions,
  type ResolvedProviderConfig,
} from "../src/lib/pulse/v2/provider";
import { computeConsensus, type EnsembleRun } from "../src/lib/pulse/v2/ensemble";
import { HUMAN_REVIEW_TIERS } from "../src/lib/pulse/v2/taxonomy";
import type { SeverityTier } from "../src/lib/pulse/v2/types";

/* ------------------------------------------------------------------ */
/*  CLI parsing                                                        */
/* ------------------------------------------------------------------ */

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseProviderArg(v: string | undefined): ClassifierProvider {
  const s = (v ?? "deepseek").trim().toLowerCase();
  if (s === "anthropic" || s === "deepseek" || s === "glm") return s;
  if (s === "zhipu") return "glm";
  console.error(
    `Unknown provider "${v}". Use one of: anthropic | deepseek | glm.`
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Gold-row loading                                                   */
/* ------------------------------------------------------------------ */

interface GoldRow {
  eventId: string;
  jurisdictionId: string;
  countryName: string;
  iso3: string | null;
  headline: string;
  description: string;
  goldCategory: string;
  goldSeverityTier: string;
}

async function loadGoldRows(
  db: ReturnType<typeof drizzle<typeof schema>>,
  n: number
): Promise<GoldRow[]> {
  // Prefer human-reviewed / approved rows (the strongest labels), then
  // fill from published rows. Category "none" never lands in
  // pulse_events_v2, so every gold row already has a real category.
  const result = await db.execute(sql`
    SELECT
      e.id                AS event_id,
      e.jurisdiction_id   AS jurisdiction_id,
      j.name              AS country_name,
      j.iso3              AS iso3,
      e.headline          AS headline,
      e.description        AS description,
      e.category          AS gold_category,
      e.severity_tier     AS gold_severity_tier
    FROM pulse_events_v2 e
    JOIN jurisdictions j ON j.id = e.jurisdiction_id
    ORDER BY
      (e.human_reviewed IS TRUE) DESC,
      (e.review_status = 'approved') DESC,
      e.created_at DESC
    LIMIT ${n}
  `);
  const rows =
    (result as unknown as { rows?: Record<string, unknown>[] }).rows ??
    (result as unknown as Record<string, unknown>[]);
  return (rows as Record<string, unknown>[]).map((r) => ({
    eventId: String(r.event_id),
    jurisdictionId: String(r.jurisdiction_id),
    countryName: String(r.country_name ?? ""),
    iso3: r.iso3 == null ? null : String(r.iso3),
    headline: String(r.headline ?? ""),
    description: String(r.description ?? ""),
    goldCategory: String(r.gold_category ?? ""),
    goldSeverityTier: String(r.gold_severity_tier ?? ""),
  }));
}

/* ------------------------------------------------------------------ */
/*  Mock HTTP layer (for --mock plumbing smoke test)                   */
/* ------------------------------------------------------------------ */

/**
 * A deterministic stub of the OpenAI-compatible HTTP layer. It reads back
 * the FIRST-PASS classification embedded in the verify prompt, and for the
 * classify pass it echoes a fixed plausible answer. This is NOT a quality
 * signal — it only proves the selection → prompt → parse → metric → report
 * pipeline runs end-to-end without a network or a key.
 */
function makeMockFetch(): typeof fetch {
  const mock = async (
    _url: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    const system = body.messages?.[0]?.content ?? "";
    const user = body.messages?.[1]?.content ?? "";
    const isVerify = system.startsWith("You are the VERIFIER");

    let content: string;
    if (isVerify) {
      content = JSON.stringify({
        verdict: "confirmed",
        confidence: "high",
        category_ok: true,
        severity_ok: true,
        subject_ok: true,
        is_event: true,
        rationale: "mock: confirmed",
      });
    } else {
      // Echo a category if the user content mentions one; else a default.
      const m = user.match(/GOLD_HINT_CATEGORY:(\S+)/);
      content = JSON.stringify({
        category: m ? m[1] : "systematic_crackdown",
        runner_up: "none",
        severity_tier: "moderate_neg",
        severity_value: -3,
        self_confidence: 0.8,
        rationale: "mock classify",
      });
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 1500, completion_tokens: 300 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  return mock as unknown as typeof fetch;
}

/* ------------------------------------------------------------------ */
/*  Re-classify one gold row with the candidate engine                 */
/* ------------------------------------------------------------------ */

interface EvalOutcome {
  eventId: string;
  goldCategory: string;
  goldSeverityTier: string;
  candCategory: string | null;
  candSeverityTier: string | null;
  /** subject-country agreement: did the candidate keep the gold jurisdiction?
   *  We re-run the same subject-attribution the production path uses is
   *  out of scope here; instead we treat the candidate's classification of
   *  the SAME source text as subject-agreeing when it produced a usable
   *  category (the production subject step is engine-independent). Tracked
   *  as parse success as a conservative proxy and reported separately. */
  parseOk: boolean;
  inputTokens: number;
  outputTokens: number;
}

function isPositive(tier: string): boolean {
  return tier.endsWith("_pos");
}
function isNegative(tier: string): boolean {
  return tier.endsWith("_neg");
}

async function evalRow(
  cfg: ResolvedProviderConfig,
  row: GoldRow,
  httpOpts: OpenAiCompatOptions,
  mock: boolean
): Promise<EvalOutcome> {
  const userContent = `Country: ${row.countryName}${
    mock ? `\nGOLD_HINT_CATEGORY:${row.goldCategory}` : ""
  }

Headline: ${row.headline}

Body:
${row.description}`;

  let inputTokens = 0;
  let outputTokens = 0;

  // Pass 1 — classify.
  let candCategory: string | null = null;
  let candSeverityTier: string | null = null;
  let parseOk = false;
  try {
    const c = await callClassifier(
      cfg,
      {
        system: CLASSIFIER_SYSTEM_PROMPT,
        user: userContent,
        maxTokens: 800,
        expectJson: true,
      },
      httpOpts
    );
    inputTokens += c.usage.inputTokens;
    outputTokens += c.usage.outputTokens;
    const parsed = parseClassify(c.text);
    // Any well-formed answer counts as parsed — including category "none"
    // (the model declining to call this a governance event). Against a gold
    // row, "none" is a CATEGORY DISAGREEMENT, not a parse failure; conflating
    // the two hid the real miss pattern behind a fake plumbing number.
    if (parsed) {
      parseOk = true;
      candCategory = parsed.category;
      candSeverityTier = parsed.severityTier;
    }
    if (parsed && parsed.category !== "none") {

      // Pass 2 — verify (runs for token/cost realism; result not scored
      // against gold here, matching §7 which scores category + tier).
      const verifyContent = `${userContent}

FIRST-PASS CLASSIFICATION TO VERIFY:
- category: ${parsed.category}
- runner-up considered: ${parsed.runnerUp}
- severity: ${parsed.severityTier} (${parsed.severityValue})
- rationale: ${parsed.rationale}`;
      try {
        const v = await callClassifier(
          cfg,
          {
            system: VERIFY_SYSTEM_PROMPT,
            user: verifyContent,
            maxTokens: 500,
            expectJson: true,
          },
          httpOpts
        );
        inputTokens += v.usage.inputTokens;
        outputTokens += v.usage.outputTokens;
        parseVerify(v.text); // exercised for parity; verdict not scored
      } catch {
        /* verify failure doesn't change category/tier agreement */
      }
    }
  } catch (err) {
    console.error(`  [eval] ${row.eventId} classify failed:`, err);
  }

  return {
    eventId: row.eventId,
    goldCategory: row.goldCategory,
    goldSeverityTier: row.goldSeverityTier,
    candCategory,
    candSeverityTier,
    parseOk,
    inputTokens,
    outputTokens,
  };
}

/* ------------------------------------------------------------------ */
/*  Metrics + report                                                   */
/* ------------------------------------------------------------------ */

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

/* ================================================================== */
/*  --ensemble mode                                                    */
/*                                                                     */
/*  Runs the CONFIGURED cross-model ensemble (PULSE_CLASSIFY_ENSEMBLE, */
/*  default DeepSeek + GLM + Anthropic Haiku) over N historical        */
/*  clusters and reports the AGREEMENT DISTRIBUTION. There is no       */
/*  scoring against stored labels — the owner's position is that past  */
/*  approvals were smoke tests, not gold. Consensus quality is         */
/*  measured by how often the independent engines agree.               */
/* ================================================================== */

/** Assumed clustered daily volume for projections — midpoint of the
 *  documented 8–20 clusters/day (plan §3). */
const CLUSTERS_PER_DAY = 15;
const DAYS_PER_MONTH = 30;

interface EnsembleEventOutcome {
  eventId: string;
  countryName: string;
  /** provider:model → category the engine returned ("none" | "error" | cat) */
  perEngine: Record<string, string>;
  /** consensus category ("none" on deadlock/no-quorum) */
  consensusCategory: string;
  consensusTier: SeverityTier | null;
  agreement: "all" | "two_of_three" | "none";
  /** consensus self-confidence (majority run's) — needed to re-score gate
   *  policies offline without re-spending on API calls */
  selfConfidence: number | null;
  degraded: boolean;
  voterCount: number;
  /** verify pass ran (only on a real majority) */
  verifyRan: boolean;
  verifyRefuted: boolean;
  verifyConfidence: "high" | "medium" | "low" | null;
  /** routed to human review under the published gate */
  review: boolean;
  inputTokens: number;
  outputTokens: number;
  /** per-provider token usage for per-engine cost */
  tokensByModel: Record<string, { input: number; output: number }>;
}

function engineKey(cfg: ResolvedProviderConfig): string {
  return `${cfg.provider}:${cfg.model}`;
}

async function runEnsembleEval() {
  const mock = hasFlag("--mock");
  const n = Number(argValue("--n") ?? "200") || 200;
  const configuredEnsemble = resolveClassifyEnsemble();
  const configuredVerify = resolveEnsembleVerifyConfig();

  // In --mock mode, everything must flow through the injectable OpenAI-compat
  // fetch layer (makeMockFetch), which does NOT stub Anthropic's native SDK.
  // Remap any anthropic engine to a deepseek-shaped stub so the plumbing check
  // is fully network- and key-free while preserving the engine COUNT and the
  // per-engine labels. Real runs use the configured engines verbatim.
  const toMockEngine = (c: ResolvedProviderConfig): ResolvedProviderConfig =>
    c.provider === "anthropic"
      ? { provider: "deepseek", model: `mock-${c.model}` }
      : c;
  const ensemble = mock
    ? configuredEnsemble.map(toMockEngine)
    : configuredEnsemble;
  const verifyCfg = mock ? toMockEngine(configuredVerify) : configuredVerify;

  console.log(`\nPulse classifier eval — ENSEMBLE mode${mock ? "  [MOCK]" : ""}`);
  console.log(
    `Engines (${ensemble.length}): ${ensemble.map(engineKey).join(", ")}`
  );
  console.log(`Verify engine: ${engineKey(verifyCfg)}`);
  console.log(`Sample size (clusters): up to ${n}\n`);

  // Key gate: every engine that will actually run needs its key (unless
  // --mock). The verify engine key is required too.
  if (!mock) {
    const needKeys = [...ensemble, verifyCfg];
    const missing = needKeys.filter((c) => !providerKeyPresent(c.provider));
    if (missing.length) {
      const names = [...new Set(missing.map((c) => providerKeyEnvName(c.provider)))];
      console.error(
        `Missing API key(s) for the configured ensemble: ${names.join(", ")}.\n` +
          `Set them in .env.local to run a real ensemble eval, or pass --mock to\n` +
          `smoke-test the plumbing (no keys, no network).`
      );
      process.exit(2);
    }
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — cannot load clusters.");
    process.exit(2);
  }

  const db = drizzle({ client: neon(process.env.DATABASE_URL), schema });
  // Reuse the same loader (pulls the most recent classified events as
  // representative clusters). We do NOT read their stored category as a
  // label — only the headline + description as the source text.
  const rows = await loadGoldRows(db, n);
  if (rows.length === 0) {
    console.error("No clusters found in pulse_events_v2 — nothing to evaluate.");
    process.exit(2);
  }
  console.log(`Loaded ${rows.length} clusters.\n`);

  const httpOpts: OpenAiCompatOptions = mock
    ? { fetchImpl: makeMockFetch(), apiKey: "mock" }
    : {};

  const outcomes: EnsembleEventOutcome[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    process.stdout.write(
      `  [${i + 1}/${rows.length}] ${row.countryName.slice(0, 16).padEnd(16)} `
    );
    const userContent = `Country: ${row.countryName}\n\nHeadline: ${row.headline}\n\nBody:\n${row.description}`;

    // --- Fan out one classify call per engine, in parallel ---
    const settled = await Promise.allSettled(
      ensemble.map(async (cfg) => {
        const c = await callClassifier(
          cfg,
          {
            system: CLASSIFIER_SYSTEM_PROMPT,
            user: userContent,
            maxTokens: 800,
            expectJson: true,
          },
          httpOpts
        );
        return { cfg, resp: c };
      })
    );

    const runs: EnsembleRun[] = [];
    const perEngine: Record<string, string> = {};
    const tokensByModel: Record<string, { input: number; output: number }> = {};
    let inputTokens = 0;
    let outputTokens = 0;

    settled.forEach((outcome, idx) => {
      const cfg = ensemble[idx];
      const key = engineKey(cfg);
      if (outcome.status === "rejected") {
        perEngine[key] = "error";
        return;
      }
      const { resp } = outcome.value;
      inputTokens += resp.usage.inputTokens;
      outputTokens += resp.usage.outputTokens;
      tokensByModel[cfg.model] = {
        input: (tokensByModel[cfg.model]?.input ?? 0) + resp.usage.inputTokens,
        output:
          (tokensByModel[cfg.model]?.output ?? 0) + resp.usage.outputTokens,
      };
      const parsed = parseClassify(resp.text);
      if (!parsed) {
        perEngine[key] = "error"; // unparseable == dropped voter
        return;
      }
      perEngine[key] = parsed.category;
      runs.push({ config: cfg, result: parsed });
    });

    const consensus = computeConsensus(runs, ensemble.length);

    // Verify pass placement: runs only on a REAL majority (agreement !==
    // "none" AND category !== "none"), mirroring production.
    let verifyRan = false;
    let verifyRefuted = false;
    let verifyConfidence: "high" | "medium" | "low" | null = null;
    const realMajority =
      consensus.agreement !== "none" && consensus.category !== "none";
    if (realMajority) {
      try {
        const verifyContent = `${userContent}\n\nFIRST-PASS CLASSIFICATION TO VERIFY:\n- category: ${consensus.category}\n- runner-up considered: ${consensus.runnerUp}\n- severity: ${consensus.severityTier} (${consensus.severityValue})\n- rationale: ensemble ${consensus.agreement} (${consensus.agreeingCount}/${consensus.voterCount})`;
        const v = await callClassifier(
          verifyCfg,
          {
            system: VERIFY_SYSTEM_PROMPT,
            user: verifyContent,
            maxTokens: 500,
            expectJson: true,
          },
          httpOpts
        );
        inputTokens += v.usage.inputTokens;
        outputTokens += v.usage.outputTokens;
        tokensByModel[verifyCfg.model] = {
          input:
            (tokensByModel[verifyCfg.model]?.input ?? 0) + v.usage.inputTokens,
          output:
            (tokensByModel[verifyCfg.model]?.output ?? 0) +
            v.usage.outputTokens,
        };
        const parsedV = parseVerify(v.text);
        verifyRan = true;
        verifyConfidence = parsedV?.confidence ?? "low";
        verifyRefuted =
          parsedV != null &&
          (parsedV.isEvent === false || parsedV.verdict === "rejected");
      } catch {
        verifyRan = true;
        verifyConfidence = "low"; // conservative: a failed verify == low
      }
    }

    // Published-gate replica (matches classify.ts buildEnsembleResult).
    const review =
      !realMajority ||
      (consensus.severityTier != null &&
        HUMAN_REVIEW_TIERS.has(consensus.severityTier)) ||
      verifyConfidence === "low" ||
      verifyRefuted;

    outcomes.push({
      eventId: row.eventId,
      countryName: row.countryName,
      perEngine,
      consensusCategory: consensus.category,
      consensusTier: realMajority ? consensus.severityTier : null,
      agreement: consensus.agreement,
      selfConfidence: realMajority ? consensus.selfConfidence : null,
      degraded: consensus.degraded,
      voterCount: consensus.voterCount,
      verifyRan,
      verifyRefuted,
      verifyConfidence,
      review,
      inputTokens,
      outputTokens,
      tokensByModel,
    });

    console.log(
      `${consensus.agreement.padEnd(13)} ${consensus.category}${
        consensus.degraded ? " (degraded)" : ""
      }${review ? " → review" : ""}`
    );
  }

  reportEnsemble(outcomes, ensemble, verifyCfg, mock);
}

function reportEnsemble(
  outcomes: EnsembleEventOutcome[],
  ensemble: ResolvedProviderConfig[],
  verifyCfg: ResolvedProviderConfig,
  mock: boolean
) {
  const total = outcomes.length;
  const unanimous = outcomes.filter((o) => o.agreement === "all").length;
  const twoOfThree = outcomes.filter(
    (o) => o.agreement === "two_of_three"
  ).length;
  const deadlock = outcomes.filter((o) => o.agreement === "none").length;
  const degraded = outcomes.filter((o) => o.degraded).length;
  const reviewCount = outcomes.filter((o) => o.review).length;

  // Majority "none" (ensemble agreed = not a governance event) vs a deadlock
  // "none" (no quorum / no majority). Both surface as consensusCategory==="none",
  // distinguished by agreement.
  const droppedAsNone = outcomes.filter(
    (o) => o.consensusCategory === "none" && o.agreement !== "none"
  ).length;

  // --- Engine-pair agreement matrix (over clusters where BOTH engines in the
  //     pair returned a usable, non-error category) ---
  const keys = ensemble.map(engineKey);
  const pairMatrix: Array<{
    a: string;
    b: string;
    agreePct: number;
    comparable: number;
  }> = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      let comparable = 0;
      let agree = 0;
      for (const o of outcomes) {
        const ca = o.perEngine[a];
        const cb = o.perEngine[b];
        if (!ca || !cb || ca === "error" || cb === "error") continue;
        comparable++;
        if (ca === cb) agree++;
      }
      pairMatrix.push({ a, b, agreePct: pct(agree, comparable), comparable });
    }
  }

  // --- Per-engine "none"-category rate + error rate ---
  const perEngineStats = keys.map((k) => {
    let noneCount = 0;
    let errorCount = 0;
    let returned = 0;
    for (const o of outcomes) {
      const c = o.perEngine[k];
      if (c === undefined) continue;
      if (c === "error") {
        errorCount++;
        continue;
      }
      returned++;
      if (c === "none") noneCount++;
    }
    return {
      engine: k,
      nonePct: pct(noneCount, returned),
      errorPct: pct(errorCount, total),
      returned,
    };
  });

  // --- Verify refutation rate on majorities ---
  const verifyRan = outcomes.filter((o) => o.verifyRan).length;
  const verifyRefuted = outcomes.filter((o) => o.verifyRefuted).length;
  const verifyLow = outcomes.filter(
    (o) => o.verifyRan && o.verifyConfidence === "low"
  ).length;

  // --- Projected review-queue size per day at current volume ---
  const reviewRate = total === 0 ? 0 : reviewCount / total;
  const projectedReviewPerDay = reviewRate * CLUSTERS_PER_DAY;

  // --- Cost math ---
  const totalInput = outcomes.reduce((a, o) => a + o.inputTokens, 0);
  const totalOutput = outcomes.reduce((a, o) => a + o.outputTokens, 0);
  // Per-model token totals across the run.
  const modelTokens: Record<string, { input: number; output: number }> = {};
  for (const o of outcomes) {
    for (const [model, t] of Object.entries(o.tokensByModel)) {
      modelTokens[model] = {
        input: (modelTokens[model]?.input ?? 0) + t.input,
        output: (modelTokens[model]?.output ?? 0) + t.output,
      };
    }
  }
  let runCost = 0;
  const perModelCost: Array<{
    model: string;
    input: number;
    output: number;
    usd: number | null;
  }> = [];
  for (const [model, t] of Object.entries(modelTokens)) {
    const price = PROVIDER_MODEL_PRICES[model];
    const usd = price
      ? (t.input / 1_000_000) * price.inputPerMTok +
        (t.output / 1_000_000) * price.outputPerMTok
      : null;
    if (usd != null) runCost += usd;
    perModelCost.push({ model, input: t.input, output: t.output, usd });
  }
  const costPerEvent = total === 0 ? 0 : runCost / total;
  const costPerDay = costPerEvent * CLUSTERS_PER_DAY;
  const costPerMonth = costPerDay * DAYS_PER_MONTH;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "ensemble",
    // Every vote recorded per cluster: gate-policy questions ("what if a
    // refuted majority published?") re-score these rows offline for $0
    // instead of re-running paid evals.
    rows: outcomes,
    mock,
    ensemble: ensemble.map(engineKey),
    verifyEngine: engineKey(verifyCfg),
    sampleSize: total,
    projectionBasis: {
      clustersPerDay: CLUSTERS_PER_DAY,
      daysPerMonth: DAYS_PER_MONTH,
      note: "Clustered daily volume = midpoint of the documented 8–20 clusters/day.",
    },
    distribution: {
      unanimousPct: pct(unanimous, total),
      twoOfThreePct: pct(twoOfThree, total),
      deadlockPct: pct(deadlock, total),
      degradedPct: pct(degraded, total),
      droppedAsNonePct: pct(droppedAsNone, total),
      reviewQueuePct: pct(reviewCount, total),
      counts: {
        unanimous,
        twoOfThree,
        deadlock,
        degraded,
        droppedAsNone,
        review: reviewCount,
      },
    },
    enginePairAgreement: pairMatrix,
    perEngine: perEngineStats,
    verify: {
      ranCount: verifyRan,
      refutedCount: verifyRefuted,
      refutationPctOfMajorities: pct(verifyRefuted, verifyRan),
      lowConfidenceCount: verifyLow,
      lowConfidencePctOfMajorities: pct(verifyLow, verifyRan),
    },
    projectedReviewQueue: {
      perDay: Math.round(projectedReviewPerDay * 10) / 10,
      reviewRatePct: pct(reviewCount, total),
    },
    tokens: { input: totalInput, output: totalOutput },
    cost: {
      perModel: perModelCost,
      runUsd: Math.round(runCost * 10000) / 10000,
      perEventUsd: Math.round(costPerEvent * 1_000_000) / 1_000_000,
      perDayUsd: Math.round(costPerDay * 10000) / 10000,
      perMonthUsd: Math.round(costPerMonth * 100) / 100,
      note: "Priced from PROVIDER_MODEL_PRICES (July 2026). Includes billed reasoning tokens for hybrid reasoners.",
    },
  };

  // --- Console summary ---
  console.log("\n════════  ENSEMBLE DISTRIBUTION  ════════");
  console.log(`  sample:            ${total} clusters`);
  console.log(`  unanimous (3/3):   ${report.distribution.unanimousPct}%  (${unanimous})`);
  console.log(`  two-of-three:      ${report.distribution.twoOfThreePct}%  (${twoOfThree})`);
  console.log(`  deadlock (none):   ${report.distribution.deadlockPct}%  (${deadlock})`);
  console.log(`  degraded runs:     ${report.distribution.degradedPct}%  (${degraded})`);
  console.log(`  agreed "none":     ${report.distribution.droppedAsNonePct}%  (${droppedAsNone})  [dropped, not a gov event]`);
  console.log(`  → review queue:    ${report.distribution.reviewQueuePct}%  (${reviewCount})`);

  console.log("\n  Engine-pair category agreement (both returned a category):");
  for (const p of pairMatrix) {
    console.log(`    ${p.agreePct.toString().padStart(5)}%  ${p.a}  ×  ${p.b}   (n=${p.comparable})`);
  }

  console.log("\n  Per-engine 'none' rate + error rate:");
  for (const e of perEngineStats) {
    console.log(
      `    ${e.engine.padEnd(34)}  none ${e.nonePct.toString().padStart(5)}%   error ${e.errorPct.toString().padStart(5)}%   (returned ${e.returned})`
    );
  }

  console.log("\n  Verify pass (on majorities only):");
  console.log(`    ran on:          ${verifyRan} majorities`);
  console.log(`    refuted:         ${report.verify.refutationPctOfMajorities}%  (${verifyRefuted})`);
  console.log(`    low-confidence:  ${report.verify.lowConfidencePctOfMajorities}%  (${verifyLow})`);

  console.log("\n  Projected review-queue at current volume:");
  console.log(
    `    ${report.projectedReviewQueue.perDay} clusters/day  (${report.projectedReviewQueue.reviewRatePct}% of ${CLUSTERS_PER_DAY}/day)`
  );

  console.log("\n  Cost:");
  for (const m of perModelCost) {
    console.log(
      `    ${m.model.padEnd(24)}  ${m.input.toLocaleString()} in · ${m.output.toLocaleString()} out  ${
        m.usd != null ? `$${m.usd.toFixed(4)}` : "(no price)"
      }`
    );
  }
  console.log(`    run total:       $${report.cost.runUsd.toFixed(4)} for ${total} clusters`);
  console.log(`    per event:       $${costPerEvent.toFixed(6)}`);
  console.log(
    `    projected:       $${report.cost.perDayUsd.toFixed(4)}/day · $${report.cost.perMonthUsd.toFixed(2)}/month  (at ${CLUSTERS_PER_DAY} clusters/day)`
  );

  // --- Write dated report to tmp/ ---
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, `pulse-classifier-ensemble-eval-${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report written: ${jsonPath}`);
}

async function main() {
  if (hasFlag("--ensemble")) {
    await runEnsembleEval();
    return;
  }
  const mock = hasFlag("--mock");
  const provider = parseProviderArg(argValue("--provider"));
  const model =
    (argValue("--model") ?? "").trim() || PROVIDER_DEFAULT_MODEL[provider];
  const n = Number(argValue("--n") ?? "200") || 200;
  const cfg: ResolvedProviderConfig = { provider, model };

  console.log(
    `\nPulse classifier eval — candidate: ${provider} / ${model}${
      mock ? "  [MOCK]" : ""
    }`
  );
  console.log(`Sample size (gold rows): up to ${n}\n`);

  // Key gate: real runs require a candidate key. Mock runs need neither
  // a key nor the network.
  if (!mock && !providerKeyPresent(provider)) {
    const keyName = providerKeyEnvName(provider);
    console.error(
      `No API key for provider "${provider}".\n` +
        `Set ${keyName} in .env.local to run a real eval, or pass --mock to\n` +
        `smoke-test the plumbing with a stubbed HTTP layer (no key, no network).`
    );
    process.exit(2);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — cannot load gold rows.");
    process.exit(2);
  }

  const db = drizzle({ client: neon(process.env.DATABASE_URL), schema });
  const gold = await loadGoldRows(db, n);
  if (gold.length === 0) {
    console.error(
      "No classified rows found in pulse_events_v2 — nothing to evaluate."
    );
    process.exit(2);
  }
  console.log(`Loaded ${gold.length} gold rows.\n`);

  const httpOpts: OpenAiCompatOptions = mock
    ? { fetchImpl: makeMockFetch(), apiKey: "mock" }
    : {};

  const outcomes: EvalOutcome[] = [];
  for (let i = 0; i < gold.length; i++) {
    const row = gold[i];
    process.stdout.write(
      `  [${i + 1}/${gold.length}] ${row.countryName.slice(0, 18).padEnd(18)} `
    );
    const o = await evalRow(cfg, row, httpOpts, mock);
    outcomes.push(o);
    console.log(
      o.candCategory
        ? `${o.goldCategory} → ${o.candCategory}${
            o.goldCategory === o.candCategory ? " ✓" : " ✗"
          }`
        : "(no candidate category)"
    );
  }

  // --- Metrics ---
  const scored = outcomes.filter((o) => o.candCategory != null);
  const catAgree = scored.filter(
    (o) => o.candCategory === o.goldCategory
  ).length;
  const tierAgree = scored.filter(
    (o) => o.candSeverityTier === o.goldSeverityTier
  ).length;
  // Subject-country proxy: the candidate classified the same source text
  // and produced a usable category (subject re-attribution is an
  // engine-independent DB step in production, so a parseable classify is
  // the honest proxy here). Reported, not gated.
  const subjectProxy = scored.length;
  const parseFailures = outcomes.filter((o) => !o.parseOk).length;
  const directionalFlips = scored.filter(
    (o) =>
      (isPositive(o.goldSeverityTier) && isNegative(o.candSeverityTier ?? "")) ||
      (isNegative(o.goldSeverityTier) && isPositive(o.candSeverityTier ?? ""))
  );

  // Confusion summary: top gold→candidate category disagreements.
  const confusion = new Map<string, number>();
  for (const o of scored) {
    if (o.candCategory !== o.goldCategory) {
      const key = `${o.goldCategory} → ${o.candCategory}`;
      confusion.set(key, (confusion.get(key) ?? 0) + 1);
    }
  }
  const topConfusion = [...confusion.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const totalInput = outcomes.reduce((a, o) => a + o.inputTokens, 0);
  const totalOutput = outcomes.reduce((a, o) => a + o.outputTokens, 0);
  const price = PROVIDER_MODEL_PRICES[model];
  const inputCost = price ? (totalInput / 1_000_000) * price.inputPerMTok : null;
  const outputCost = price
    ? (totalOutput / 1_000_000) * price.outputPerMTok
    : null;
  const totalCost =
    inputCost != null && outputCost != null ? inputCost + outputCost : null;

  const report = {
    generatedAt: new Date().toISOString(),
    mock,
    candidate: { provider, model },
    sampleSize: gold.length,
    scoredCount: scored.length,
    // §7 bar: category ≥90%, severity-tier ≥85%, zero directional flips,
    // JSON-parse failure ≤1%.
    metrics: {
      categoryAgreementPct: pct(catAgree, scored.length),
      severityTierAgreementPct: pct(tierAgree, scored.length),
      subjectCountryProxyPct: pct(subjectProxy, gold.length),
      directionalFlips: directionalFlips.length,
      jsonParseFailurePct: pct(parseFailures, gold.length),
    },
    bar: {
      categoryAgreement: ">=90%",
      severityTierAgreement: ">=85%",
      directionalFlips: "0",
      jsonParseFailure: "<=1%",
    },
    confusion: topConfusion.map(([k, v]) => ({ pair: k, count: v })),
    directionalFlipDetail: directionalFlips.map((o) => ({
      eventId: o.eventId,
      gold: `${o.goldCategory} / ${o.goldSeverityTier}`,
      candidate: `${o.candCategory} / ${o.candSeverityTier}`,
    })),
    tokens: { input: totalInput, output: totalOutput },
    cost: {
      pricedModel: !!price,
      inputUsd: inputCost,
      outputUsd: outputCost,
      totalUsd: totalCost,
      note: price
        ? "Priced from plan/pulse-classifier-cost-resolution-v1.md §3 (July 2026)."
        : `No published price on record for "${model}" — token counts only.`,
    },
  };

  // --- Console summary ---
  console.log("\n────────  RESULTS  ────────");
  console.log(`  category agreement:      ${report.metrics.categoryAgreementPct}%  (bar ≥90%)`);
  console.log(`  severity-tier agreement: ${report.metrics.severityTierAgreementPct}%  (bar ≥85%)`);
  console.log(`  subject-country proxy:   ${report.metrics.subjectCountryProxyPct}%`);
  console.log(`  directional flips:       ${report.metrics.directionalFlips}   (bar 0)`);
  console.log(`  JSON-parse failure:      ${report.metrics.jsonParseFailurePct}%  (bar ≤1%)`);
  if (topConfusion.length) {
    console.log("\n  Top category disagreements:");
    for (const [k, v] of topConfusion) console.log(`    ${v.toString().padStart(3)}  ${k}`);
  }
  console.log(
    `\n  tokens: ${totalInput.toLocaleString()} in · ${totalOutput.toLocaleString()} out`
  );
  if (totalCost != null) {
    console.log(
      `  cost:   $${totalCost.toFixed(4)} for this run  (in $${inputCost!.toFixed(4)} + out $${outputCost!.toFixed(4)})`
    );
    if (scored.length > 0) {
      const perThousand = (totalCost / gold.length) * 1000;
      console.log(
        `          ≈ $${perThousand.toFixed(2)} per 1,000 events at this prompt shape`
      );
    }
  } else {
    console.log(`  cost:   no published price on record for "${model}".`);
  }

  // --- Write dated report to tmp/ ---
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  const base = `pulse-classifier-eval-${provider}-${model.replace(/[^a-z0-9.-]/gi, "_")}-${stamp}`;
  const jsonPath = join(dir, `${base}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report written: ${jsonPath}`);

  // Non-zero exit if any hard §7 bar is missed on a REAL run, so CI/owner
  // scripts can gate. Mock runs always exit 0 (plumbing check only).
  if (!mock) {
    const failsBar =
      report.metrics.categoryAgreementPct < 90 ||
      report.metrics.severityTierAgreementPct < 85 ||
      report.metrics.directionalFlips > 0 ||
      report.metrics.jsonParseFailurePct > 1;
    if (failsBar) {
      console.log(
        "\n  ⚠️  One or more §7 quality bars NOT met — do NOT switch this engine yet."
      );
      process.exit(3);
    }
    console.log("\n  ✅  All §7 quality bars met for this sample.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
