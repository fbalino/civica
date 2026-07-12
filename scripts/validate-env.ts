/**
 * PLT-006 — fail-early environment validation CLI.
 *
 *   tsx scripts/validate-env.ts --context=build|cron|admin|chat|production|...
 *
 * Checks the current process env against the typed contract and exits non-zero
 * with clear, secret-free messages when a required variable is missing or
 * malformed. Optional features that are off (absent-degrades) are printed as
 * notices, not failures.
 */
import { config } from "dotenv";
import {
  checkEnv,
  envCheckErrors,
  ENV_CONTEXTS,
  type EnvContext,
} from "../src/lib/env/contract";

// Load .env.local for local dev checks; a no-op in CI/production where the
// real environment is already populated and the file is absent.
config({ path: ".env.local" });

const arg = process.argv.find((a) => a.startsWith("--context="));
const context = (arg?.slice("--context=".length) ?? "build") as EnvContext;

if (!ENV_CONTEXTS.includes(context)) {
  console.error(
    `Unknown context '${context}'. One of: ${ENV_CONTEXTS.join(", ")}`,
  );
  process.exit(2);
}

const result = checkEnv(context);
const errors = envCheckErrors(result);

if (result.degradedOff.length > 0) {
  console.log(
    `NOTICE [${context}] optional features off (absent): ${result.degradedOff.join(", ")}`,
  );
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  console.error(
    `\nFAIL — ${errors.length} environment problem(s) for context '${context}'.`,
  );
  process.exit(1);
}

console.log(`PASS — required environment satisfied for context '${context}'.`);
