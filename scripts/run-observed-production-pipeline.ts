import { spawn } from "node:child_process";

import {
  finishPipelineRun,
  startPipelineRun,
} from "../src/lib/platform/pipeline-observability";
import { recordErrorMonitoringEvent } from "../src/lib/platform/error-monitoring";

function usage(): never {
  console.error(
    "Usage: tsx scripts/run-observed-production-pipeline.ts --pipeline=<id> -- <command> [args...]",
  );
  process.exit(2);
}

function parseArgs(argv: string[]) {
  const divider = argv.indexOf("--");
  if (divider < 0) usage();
  const pipeline = argv.slice(0, divider).find((arg) => arg.startsWith("--pipeline="));
  const command = argv.slice(divider + 1);
  if (!pipeline || command.length === 0) usage();
  return { pipelineId: pipeline.slice("--pipeline=".length), command };
}

function metricsFromOutput(output: string): Record<string, number> {
  const result: Record<string, number> = {};
  const aliases: Readonly<Record<string, string>> = {
    countries: "countriesCrawled",
    country: "countriesCrawled",
    rows: "rowsRead",
    read: "rowsRead",
    processed: "rowsRead",
    scanned: "scanned",
    facts: "totalWritten",
    scores: "totalWritten",
    written: "totalWritten",
    inserted: "inserted",
    rejected: "rowsRejected",
    errors: "errorCount",
    failed: "errorCount",
  };
  for (const match of output.matchAll(/^\s*([A-Za-z][A-Za-z _-]{1,40})\s*:\s*(\d+)\b/gm)) {
    const normalized = match[1]
      .trim()
      .toLowerCase()
      .replace(/[^a-z]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const key = aliases[normalized] ?? aliases[normalized.replace(/s$/, "")];
    const value = Number(match[2]);
    if (key && Number.isSafeInteger(value)) result[key] = value;
  }
  return result;
}

async function runChild(command: readonly string[]): Promise<{
  exitCode: number;
  output: string;
}> {
  const [file, ...args] = command;
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const capture = (chunk: Buffer) => {
      if (output.length < 64_000) output += chunk.toString("utf8").slice(0, 64_000 - output.length);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      capture(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      capture(chunk);
    });
    child.on("error", () => resolve({ exitCode: 1, output }));
    child.on("close", (code) => resolve({ exitCode: code ?? 1, output }));
  });
}

async function main() {
  const { pipelineId, command } = parseArgs(process.argv.slice(2));
  const run = await startPipelineRun({ pipelineId, triggerKind: "manual" });
  const result = await runChild(command);
  if (result.exitCode !== 0) {
    await recordErrorMonitoringEvent({
      surface: "script",
      jobId: pipelineId,
      errorCode: "script.child_exit_failure",
    });
  }
  const payload = {
    ...metricsFromOutput(result.output),
    outcome: result.exitCode === 0 ? "handler_succeeded" : "child_exit_failure",
  };
  try {
    await finishPipelineRun({
      ...run,
      responseStatus: result.exitCode === 0 ? 200 : 500,
      succeeded: result.exitCode === 0,
      payload,
    });
  } catch {
    console.error("[pipeline-observability] manual_finish_failed");
    process.exit(1);
  }
  process.exit(result.exitCode);
}

main().catch(() => {
  console.error("[pipeline-observability] manual_start_failed");
  process.exit(1);
});
