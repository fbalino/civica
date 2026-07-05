/**
 * Pulse classifier provider layer.
 *
 * The published Pulse methodology (`content/methodology-pulse.md`, §
 * "Classification confidence — classify, then verify") is a two-pass
 * classify→verify design. That methodology is engine-agnostic: it
 * describes WHAT the two passes judge and how their confidence maps onto
 * the human-review gate, not which model runs them. This module is the
 * seam that lets the ENGINE change without touching the methodology,
 * the prompts (`classifier-prompt.ts`), or the parse contracts
 * (`parseClassify`/`parseVerify`).
 *
 * Owner decision (2026-07-05, `plan/pulse-classifier-cost-resolution-v1.md`):
 * the paid classify path moves off Anthropic to a far cheaper provider so
 * the daily Pulse cron can run fully automated. Three providers are
 * supported:
 *
 *   - "anthropic" — the existing SDK path. KEPT as the default for
 *     backtests and as a fallback; same models the pipeline shipped with.
 *   - "deepseek"  — OpenAI-compatible chat completions at
 *     https://api.deepseek.com. Best current general model:
 *     `deepseek-v4-flash` (V3-era `deepseek-chat`/`deepseek-reasoner`
 *     deprecate 2026-07-24). Plain `fetch`, no new dependency.
 *   - "glm"       — Zhipu / Z.ai OpenAI-compatible endpoint at
 *     https://api.z.ai/api/paas/v4. Flagship `glm-4.7`; cheap fast tier
 *     `glm-4.7-flashx`. Plain `fetch`, no new dependency.
 *
 * The two OpenAI-compatible providers share one code path (they differ
 * only in base URL, key, and model id). Anthropic keeps its native SDK
 * call because the prompts and JSON parsing were validated against it.
 *
 * Env-driven config (documented in `.env.example`):
 *   PULSE_CLASSIFY_PROVIDER / PULSE_CLASSIFY_MODEL   — the classify pass
 *   PULSE_VERIFY_PROVIDER   / PULSE_VERIFY_MODEL     — the verify pass
 *   DEEPSEEK_API_KEY, GLM_API_KEY, ANTHROPIC_API_KEY_PULSE_CLASSIFIER
 *
 * Robustness mirrors the rest of the pipeline: JSON-mode / structured
 * output where the provider supports it (both OpenAI-compatible providers
 * accept `response_format: {type: "json_object"}`), the existing parser
 * tolerance in `classifier-prompt.ts` as the safety net, and
 * retry-with-backoff on 429/5xx modeled on `gdelt.ts`'s `fetchWithRetry`.
 *
 * Lazy client init per the project convention — a module-level client
 * would evaluate before dotenv populates env vars.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ClassifierProvider = "anthropic" | "deepseek" | "glm";

/** The two passes this provider layer serves. */
export type ClassifierPass = "classify" | "verify";

/** A single provider call: system prompt + user content → raw text.
 *  `expectJson` opts the OpenAI-compatible providers into JSON mode. */
export interface ProviderRequest {
  system: string;
  user: string;
  maxTokens: number;
  /** Request structured JSON output where the provider supports it. */
  expectJson: boolean;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderResponse {
  /** The model's text output — fed straight into parseClassify/parseVerify. */
  text: string;
  usage: ProviderUsage;
  /** The provider + model that actually ran, for audit records. */
  provider: ClassifierProvider;
  model: string;
}

/* ------------------------------------------------------------------ */
/*  Provider defaults & config                                         */
/* ------------------------------------------------------------------ */

/**
 * Default models per provider. Verified current as of July 2026
 * (`plan/pulse-classifier-cost-resolution-v1.md` §3):
 *   - DeepSeek: `deepseek-v4-flash` is the best cheap general model
 *     ($0.14/MTok in, $0.28/MTok out). `deepseek-chat`/`deepseek-reasoner`
 *     deprecate 2026-07-24 → do NOT default to them.
 *   - GLM/Zhipu: `glm-4.7` is the flagship general model ($0.60/$2.20);
 *     `glm-4.7-flashx` ($0.07/$0.40) is the cheap fast tier alternative.
 *   - Anthropic: the model the pipeline shipped with (backtest/fallback).
 */
export const PROVIDER_DEFAULT_MODEL: Record<ClassifierProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  deepseek: "deepseek-v4-flash",
  glm: "glm-4.7",
};

/** OpenAI-compatible endpoints. Both accept `/chat/completions`. */
const OPENAI_COMPAT_BASE: Record<"deepseek" | "glm", string> = {
  deepseek: "https://api.deepseek.com",
  glm: "https://api.z.ai/api/paas/v4",
};

/** Env var holding the key for each provider. */
const PROVIDER_KEY_ENV: Record<ClassifierProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY_PULSE_CLASSIFIER",
  deepseek: "DEEPSEEK_API_KEY",
  glm: "GLM_API_KEY",
};

/**
 * Published per-MTok prices used by the eval script's cost reporting.
 * Sourced from `plan/pulse-classifier-cost-resolution-v1.md` §3 (July 2026).
 * These are for reporting only — never a gate.
 */
export const PROVIDER_MODEL_PRICES: Record<
  string,
  { inputPerMTok: number; outputPerMTok: number }
> = {
  // Anthropic
  "claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "claude-haiku-4-5": { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  // DeepSeek (cache-miss input)
  "deepseek-v4-flash": { inputPerMTok: 0.14, outputPerMTok: 0.28 },
  "deepseek-v4-pro": { inputPerMTok: 0.435, outputPerMTok: 0.87 },
  // GLM / Zhipu
  "glm-4.7": { inputPerMTok: 0.6, outputPerMTok: 2.2 },
  "glm-4.7-flashx": { inputPerMTok: 0.07, outputPerMTok: 0.4 },
  "glm-4.7-flash": { inputPerMTok: 0.0, outputPerMTok: 0.0 },
  "glm-5.2": { inputPerMTok: 1.4, outputPerMTok: 4.4 },
};

export interface ResolvedProviderConfig {
  provider: ClassifierProvider;
  model: string;
}

function parseProvider(
  value: string | undefined,
  fallback: ClassifierProvider
): ClassifierProvider {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "anthropic" || v === "deepseek" || v === "glm") return v;
  // "zhipu" is a common alias for the GLM provider.
  if (v === "zhipu") return "glm";
  return fallback;
}

/**
 * Resolve the provider + model for a given pass from the environment.
 * Defaults: both passes on DeepSeek's best current general model
 * (`deepseek-v4-flash`) per the owner's 2026-07-05 decision. A GLM
 * alternative is documented inline in `.env.example`. If a provider is
 * set without an explicit model, the provider's default model is used.
 */
export function resolveProviderConfig(
  pass: ClassifierPass
): ResolvedProviderConfig {
  const providerEnv =
    pass === "classify"
      ? process.env.PULSE_CLASSIFY_PROVIDER
      : process.env.PULSE_VERIFY_PROVIDER;
  const modelEnv =
    pass === "classify"
      ? process.env.PULSE_CLASSIFY_MODEL
      : process.env.PULSE_VERIFY_MODEL;

  // Default provider is DeepSeek for both passes (owner decision 2026-07-05).
  const provider = parseProvider(providerEnv, "deepseek");
  const model =
    (modelEnv ?? "").trim() || PROVIDER_DEFAULT_MODEL[provider];
  return { provider, model };
}

/** The env var that must be set for a provider to run. */
export function providerKeyEnvName(provider: ClassifierProvider): string {
  return PROVIDER_KEY_ENV[provider];
}

/** True when the key for `provider` is present in the environment. */
export function providerKeyPresent(provider: ClassifierProvider): boolean {
  const name = PROVIDER_KEY_ENV[provider];
  return !!(process.env[name] && process.env[name]!.trim().length > 0);
}

/* ------------------------------------------------------------------ */
/*  Retry helper — mirrors gdelt.ts fetchWithRetry                     */
/* ------------------------------------------------------------------ */

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * fetch with exponential backoff on 429/5xx, mirroring the pattern in
 * `src/lib/pulse/gdelt.ts`. Honours Retry-After when present. Injectable
 * `fetchImpl` so the eval script can stub the HTTP layer (`--mock`).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 4,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchImpl(url, init);
      if (RETRYABLE_STATUS.has(res.status) && i < attempts - 1) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoffMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 15_000)
            : 2000 * 2 ** i;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
      }
    }
  }
  if (lastErr) throw lastErr;
  return fetchImpl(url, init);
}

/* ------------------------------------------------------------------ */
/*  Anthropic path (native SDK)                                         */
/* ------------------------------------------------------------------ */

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY_PULSE_CLASSIFIER,
    });
  }
  return _anthropic;
}

async function callAnthropic(
  model: string,
  req: ProviderRequest
): Promise<ProviderResponse> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model,
    max_tokens: req.maxTokens,
    temperature: 0,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  });
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  return {
    text,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
    provider: "anthropic",
    model,
  };
}

/* ------------------------------------------------------------------ */
/*  OpenAI-compatible path (DeepSeek, GLM) — plain fetch                */
/* ------------------------------------------------------------------ */

interface OpenAiCompatChoice {
  message?: { content?: string | null };
}
interface OpenAiCompatResponse {
  choices?: OpenAiCompatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Injected in tests to stub the network. Defaults to global fetch. */
export interface OpenAiCompatOptions {
  fetchImpl?: typeof fetch;
  /** Override the base URL (tests). */
  baseUrl?: string;
  /** Override the key resolution (tests). */
  apiKey?: string;
}

async function callOpenAiCompat(
  provider: "deepseek" | "glm",
  model: string,
  req: ProviderRequest,
  opts: OpenAiCompatOptions = {}
): Promise<ProviderResponse> {
  const apiKey =
    opts.apiKey ?? process.env[PROVIDER_KEY_ENV[provider]] ?? "";
  const baseUrl = (opts.baseUrl ?? OPENAI_COMPAT_BASE[provider]).replace(
    /\/$/,
    ""
  );
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    temperature: 0,
    // DeepSeek V4 / GLM current-gen models are HYBRID REASONERS: they emit a
    // billed `reasoning_content` stream BEFORE the answer, drawing from the
    // same max_tokens budget. A budget sized for the ~300-token answer gets
    // consumed by reasoning and truncates `content` mid-JSON (measured: 50.5%
    // parse failures at max_tokens 500-800). Give the answer its requested
    // budget PLUS generous reasoning headroom; the parser still reads only
    // `message.content`, and the eval script measures the real token cost
    // including reasoning.
    max_tokens: Math.max(req.maxTokens * 4, 4096),
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  };
  // JSON mode: both DeepSeek and GLM accept the OpenAI-style flag. The
  // methodology prompts already end with "Respond with JSON ONLY", so
  // this is belt-and-suspenders on top of the parser tolerance. DeepSeek
  // documents an occasional empty-content failure in JSON mode — the
  // caller treats empty/short text as a failed pass (routes to review),
  // and the retry loop covers transient cases.
  if (req.expectJson) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    },
    4,
    opts.fetchImpl ?? fetch
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `${provider} API error: ${res.status} ${res.statusText} ${detail.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as OpenAiCompatResponse;
  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text: typeof text === "string" ? text : "",
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
    provider,
    model,
  };
}

/* ------------------------------------------------------------------ */
/*  Public entry point                                                 */
/* ------------------------------------------------------------------ */

/**
 * Run one classifier call against the given provider+model. Returns the
 * raw text (for parseClassify/parseVerify) plus token usage. Throws on a
 * hard failure so callers can treat a thrown call as a failed pass
 * (classify.ts already routes failed passes to human review — the
 * conservative default).
 */
export async function callClassifier(
  config: ResolvedProviderConfig,
  req: ProviderRequest,
  opts: OpenAiCompatOptions = {}
): Promise<ProviderResponse> {
  if (config.provider === "anthropic") {
    return callAnthropic(config.model, req);
  }
  return callOpenAiCompat(config.provider, config.model, req, opts);
}
