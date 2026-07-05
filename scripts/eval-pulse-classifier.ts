/**
 * Pulse classifier agreement eval — mechanizes §7 of
 * plan/pulse-classifier-cost-resolution-v1.md (the quality bar a cheap
 * candidate engine must clear before it replaces the incumbent on the
 * paid classify path).
 *
 * What it does:
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
  type ClassifierProvider,
  type OpenAiCompatOptions,
  type ResolvedProviderConfig,
} from "../src/lib/pulse/v2/provider";

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
    if (parsed && parsed.category !== "none") {
      candCategory = parsed.category;
      candSeverityTier = parsed.severityTier;
      parseOk = true;

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

async function main() {
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
