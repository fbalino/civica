/**
 * Subscription-CLI transport for the Pulse classify/verify/attribution
 * passes — the zero-marginal-cost runtime adopted by
 * `plan/pulse-subscription-runtime-resolution-v1.md` (owner-approved
 * 2026-08-17). Four provider-distinct voters run as headless CLI
 * invocations on the owner's Mac, each pinned to an owner-selected model;
 * no paid API key is read or used anywhere on this path ($0 hard cap).
 *
 * Contract notes:
 * - Voters receive the frozen system + user text and must answer with JSON
 *   only; the CLIs are invoked in their most direct non-interactive mode
 *   from an empty scratch directory so no repository context can leak into
 *   a classification. Three CLIs take the two parts as one self-contained
 *   prompt; Kimi takes the system part through its agent (system) channel —
 *   see `cliInvocation` for why, and note that the prompt text itself is
 *   identical for every voter either way.
 * - Every run records the configured model AND the model identifier the
 *   CLI reports for that call (where its output envelope carries one), per
 *   the resolution's run-level model-logging requirement.
 * - Decoding parameters (temperature/seed) are not exposed by these CLIs;
 *   the frozen configuration records provider-default decoding. This is a
 *   disclosed limitation of the subscription runtime, not a defect.
 * - PUL-036 is preserved upstream: runs produced through this transport
 *   are stored as subscription-agent classifications and always queue for
 *   human review; they can never auto-publish.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type SubscriptionProvider = "openai" | "anthropic" | "xai" | "moonshot";

export interface SubscriptionVoterConfig {
  provider: SubscriptionProvider;
  /** Owner-selected model, pinned by name (resolution §2). Recorded on
   * every stored run. */
  model: string;
  /** CLI binary on the owner's Mac. */
  bin: string;
  /** The CLI's own alias for the pinned model, when it differs from the
   * canonical recorded name (e.g. Kimi's config.toml aliases). */
  cliModelArg?: string;
}

/**
 * The owner-selected voter panel (resolution approval record, 2026-08-17):
 * GPT Terra 5.6 via Codex, Claude Sonnet 5 via Claude Code, Kimi K3 via the
 * Kimi CLI, Grok 4.5 via the Grok CLI. Order is stable for run records.
 */
export const SUBSCRIPTION_CLASSIFY_ENSEMBLE: readonly SubscriptionVoterConfig[] =
  [
    { provider: "openai", model: "gpt-5.6-terra", bin: "codex" },
    { provider: "anthropic", model: "claude-sonnet-5", bin: "claude" },
    {
      provider: "moonshot",
      model: "kimi-k3",
      bin: "kimi",
      cliModelArg: "kimi-code/k3",
    },
    { provider: "xai", model: "grok-4.5", bin: "grok" },
  ];

/** Verify + subject attribution run on the Claude subscription. */
export const SUBSCRIPTION_VERIFY_CONFIG: SubscriptionVoterConfig = {
  provider: "anthropic",
  model: "claude-sonnet-5",
  bin: "claude",
};

export interface SubscriptionCallResult {
  /** Model text output, fed to the existing parseClassify/parseVerify. */
  text: string;
  provider: SubscriptionProvider;
  /** The configured (pinned) model. */
  model: string;
  /** Model identifier the CLI reported for this call, when its output
   * envelope carries one; null when the CLI reports none. */
  reportedModel: string | null;
}

/**
 * Kimi's managed endpoint applies a server-side content-risk filter to the
 * user turn. Civica's frozen classify rubric is a dense catalogue of
 * repression categories (martial law, journalist arrest, mass detention,
 * internet shutdown, foreign occupation, …); flattened into a single user
 * message it is refused with `provider.api_error: 400 The request was
 * rejected because it was considered high risk` — deterministically, and
 * independently of the calling environment. The same frozen text delivered
 * through the CLI's own agent (system) channel, where an operator rubric
 * belongs, is accepted and answers correctly.
 *
 * So the moonshot voter keeps the system prompt in the system channel
 * instead of collapsing it into the user turn. The prompt TEXT is byte-for-
 * byte the frozen prompt; only the channel the CLI uses to carry it changes,
 * which §4 of the runtime resolution already discloses as per-CLI wrapper
 * scaffolding. Returns the argv for the call, writing any file the CLI needs
 * into the caller's scratch directory.
 */
export function cliInvocation(
  config: SubscriptionVoterConfig,
  request: { system: string; user: string },
  scratch: string,
): string[] {
  const model = config.cliModelArg ?? config.model;
  if (config.provider === "moonshot") {
    const agentFile = join(scratch, "civica-pulse-classifier.md");
    writeFileSync(
      agentFile,
      `---\nname: civica-pulse-classifier\ndescription: Civica Pulse governance-event classifier\n---\n\n${request.system}\n`,
      "utf8",
    );
    return [
      "--agent-file",
      agentFile,
      "-p",
      request.user,
      "--model",
      model,
      "--output-format",
      "text",
    ];
  }
  return cliArgs(config, `${request.system}\n\n${request.user}`);
}

function cliArgs(config: SubscriptionVoterConfig, prompt: string): string[] {
  const model = config.cliModelArg ?? config.model;
  switch (config.provider) {
    case "openai":
      // Non-interactive, read-only sandbox: classification must not execute
      // model-generated commands. The prompt is the positional argument;
      // stdin is closed by the spawner so exec cannot wait on it.
      return [
        "exec",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--model",
        model,
        prompt,
      ];
    case "anthropic":
      // Plain print mode with a JSON envelope so the reported model and the
      // result text are machine-readable.
      return ["-p", prompt, "--model", model, "--output-format", "json"];
    case "moonshot":
      return ["-p", prompt, "--model", model, "--output-format", "text"];
    case "xai":
      // --single is Grok's single-turn headless mode.
      return ["--single", prompt, "--model", model, "--output-format", "json"];
  }
}

/** Extract the voter's answer text (and reported model) from CLI output. */
function extractResult(
  config: SubscriptionVoterConfig,
  stdout: string,
): { text: string; reportedModel: string | null } {
  const trimmed = stdout.trim();
  if (config.provider === "anthropic" || config.provider === "xai") {
    // These CLIs emit a JSON envelope in their JSON output modes. Fall back
    // to raw text when the envelope does not parse (fail-closed callers
    // then reject via the strict classify/verify parsers).
    try {
      const envelope = JSON.parse(trimmed) as Record<string, unknown>;
      const text =
        typeof envelope.result === "string"
          ? envelope.result
          : typeof envelope.text === "string"
            ? envelope.text
            : trimmed;
      const reported =
        typeof envelope.model === "string"
          ? envelope.model
          : typeof envelope.modelUsed === "string"
            ? envelope.modelUsed
            : null;
      return { text, reportedModel: reported };
    } catch {
      return { text: trimmed, reportedModel: null };
    }
  }
  if (config.provider === "moonshot") {
    // Kimi's text renderer prefixes output lines with a "• " bullet.
    return {
      text: trimmed.replace(/^•\s*/gm, "").trim(),
      reportedModel: null,
    };
  }
  return { text: trimmed, reportedModel: null };
}

/**
 * Reduce a CLI's stderr to the lines that explain a failure. These CLIs put
 * a version banner and (for Kimi) the model's whole reasoning trace on
 * stderr, so a naive head-slice reports `kimi version 0.36.1` and truncates
 * the actual provider error away — which is exactly how a deterministic
 * content-policy refusal was first misread as an environment fault.
 */
export function summarizeCliStderr(stderr: string, limit = 400): string {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\S+ version \d/.test(line));
  const errors = lines.filter((line) =>
    /^(error|fatal)\b|error:|failed|refus|reject/i.test(line),
  );
  return (errors.length > 0 ? errors : lines).join(" | ").slice(0, limit);
}

export interface SubscriptionCallOptions {
  /** Hard wall-clock limit per voter call. */
  timeoutMs?: number;
  /** Test seam. */
  spawnImpl?: typeof spawn;
}

/**
 * Run one subscription voter headlessly. Rejects on nonzero exit, timeout,
 * or empty output; callers apply the existing bounded-retry/terminal-state
 * machine (PUL-032) exactly as they do for HTTP providers.
 */
export function callSubscriptionCli(
  config: SubscriptionVoterConfig,
  request: { system: string; user: string },
  options: SubscriptionCallOptions = {},
): Promise<SubscriptionCallResult> {
  const timeoutMs = options.timeoutMs ?? 300_000;
  const scratch = mkdtempSync(join(tmpdir(), "civica-pulse-voter-"));
  const argv = cliInvocation(config, request, scratch);
  const spawnImpl = options.spawnImpl ?? spawn;

  return new Promise<SubscriptionCallResult>((resolve, reject) => {
    const child = spawnImpl(config.bin, argv, {
      cwd: scratch,
      env: process.env,
      // stdin is a pipe we close immediately: "ignore" leaves some CLIs
      // (Codex exec) blocking on stdin reads, and a real TTY is never
      // available under launchd.
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin?.end();
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(
        new Error(
          `Subscription voter ${config.provider}/${config.model} timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `Subscription voter ${config.provider}/${config.model} failed to start: ${err.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            `Subscription voter ${config.provider}/${config.model} exited ${code}: stderr=${summarizeCliStderr(stderr)} stdout=${stdout.slice(-300)}`,
          ),
        );
        return;
      }
      const { text, reportedModel } = extractResult(config, stdout);
      if (!text.trim()) {
        reject(
          new Error(
            `Subscription voter ${config.provider}/${config.model} produced empty output`,
          ),
        );
        return;
      }
      resolve({
        text,
        provider: config.provider,
        model: config.model,
        reportedModel,
      });
    });
  });
}
