import { existsSync, readFileSync } from "node:fs";

const files = {
  contract: "src/lib/model-operations/contract.ts",
  chat: "src/app/api/chat/route.ts",
  ask: "src/lib/ask-civica/contract.ts",
  provider: "src/lib/pulse/v2/provider.ts",
  classify: "src/lib/pulse/v2/classify.ts",
  subject: "src/lib/pulse/v2/country-attribution.ts",
  review: "src/lib/pulse/v2/summarize.ts",
  bills: "src/lib/bills/summarize.ts",
  reconciliation: "src/lib/factbook/reconcile/sync-stats-sa.ts",
  legacyPulse: "src/lib/pulse/classify.ts",
  backtest: "src/lib/pulse/v2/backtest.ts",
  docs: "data/MODEL-OPERATIONS.md",
  env: ".env.example",
  manualChecks: "plan/MANUAL-CHECKS.md",
  evidence: "plan/evidence/PLT-022/model-operations.json",
  plan: "plan/MASTER-CHECKLIST.md",
  progress: "plan/PROGRESS.md",
  packageJson: "package.json",
} as const;

const errors: string[] = [];
for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) errors.push(`missing ${name}: ${path}`);
}

if (!errors.length) {
  const read = (path: string) => readFileSync(path, "utf8");
  const contract = read(files.contract);
  const chat = read(files.chat);
  const ask = read(files.ask);
  const provider = read(files.provider);
  const classify = read(files.classify);
  const subject = read(files.subject);
  const review = read(files.review);
  const bills = read(files.bills);
  const reconciliation = read(files.reconciliation);
  const legacyPulse = read(files.legacyPulse);
  const backtest = read(files.backtest);
  const docs = read(files.docs);
  const env = read(files.env);
  const manualChecks = read(files.manualChecks);
  const evidence = JSON.parse(read(files.evidence)) as Record<string, unknown>;
  const plan = read(files.plan);
  const progress = read(files.progress);
  const packageJson = JSON.parse(read(files.packageJson)) as { scripts?: Record<string, string> };

  for (const token of [
    "civica-model-operations/v1",
    "MODEL_OPERATION_CONTROLS",
    "APPROVED_PULSE_PROVIDER_MODELS",
    "assertModelOperationRequest",
    "monthlySpendCapUsd",
    "alertAtUsd",
    "modelOperationVersion",
  ]) {
    if (!contract.includes(token)) errors.push(`model contract omits ${token}`);
  }
  for (const token of [
    "ANTHROPIC_API_KEY_CHAT",
    "ANTHROPIC_API_KEY_PULSE_CLASSIFIER",
    "ANTHROPIC_API_KEY_PULSE_SUMMARIZE",
    "ANTHROPIC_API_KEY_BILLS_SUMMARIZE",
    "ANTHROPIC_API_KEY_RECONCILIATION",
  ]) {
    if (!env.includes(token)) errors.push(`environment example omits scoped ${token}`);
  }
  const modelSources = {
    chat: ["assertModelOperationRequest", "ask-civica.request-over-budget", "maxRetries: 0"],
    ask: ["ASK_CIVICA_MODEL_VERSION", "model_version="],
    provider: ["isApprovedPulseProviderModel", "Classifier provider/model is not approved", "body.thinking = { type: \"disabled\" }", "maxRetries: 0", "modelOperationControl(operation).maxAttemptsPerCall"],
    classify: ["Math.min(opts.limit ?? 50, 50)", "pulse-classify", "pulse-verify", "thinkingMode: \"disabled\""],
    subject: ["SUBJECT_ATTRIBUTION_MODEL_VERSION", "pulse-subject-attribution", "maxRetries: 0"],
    review: ["PULSE_REVIEW_SUMMARY_MODEL_VERSION", "pulse-review-summary", "generation_failed", "maxRetries: 0"],
    bills: ["BILLS_SUMMARY_MODEL_VERSION", "MAX_BILL_SUMMARY_CALLS_PER_EXECUTION", "bills-summarize", "maxRetries: 0"],
    reconciliation: ["STATS_SA_EXTRACTION_MODEL_VERSION", "stats-sa-reconciliation", "model request unavailable or over budget", "maxRetries: 0"],
    legacyPulse: ["retired_no_model_call"],
    backtest: ["pulse-backtest", "MAX_BACKTEST_EVENTS_PER_EXECUTION", "MAX_BACKTEST_CASES_PER_EXECUTION", "modelVersion", "classify_call_failed", "verify_call_failed"],
  } as const;
  const modelSourceText = {
      chat, ask, provider, classify, subject, review, bills, reconciliation, legacyPulse, backtest,
  } satisfies Record<keyof typeof modelSources, string>;
  for (const [source, tokens] of Object.entries(modelSources) as Array<
    [keyof typeof modelSources, readonly string[]]
  >) {
    const text = modelSourceText[source];
    for (const token of tokens) if (!text.includes(token)) errors.push(`${source} omits ${token}`);
  }
  for (const forbidden of [
    "PULSE_COMPAT_THINKING",
    "console.error(\"[pulse-summarise] generation failed\", err)",
    "response.text.slice(0, 100)",
    "API error: ${res.status} ${res.statusText}",
  ]) {
    if (provider.includes(forbidden) || classify.includes(forbidden) || review.includes(forbidden)) {
      errors.push(`model path retains unsafe ${forbidden}`);
    }
  }
  for (const token of ["civica-model-operations/v1", "Provider-side monthly caps", "no alternate answer path", "Verified 2026-07-18"]) {
    if (!docs.includes(token)) errors.push(`model operations documentation omits ${token}`);
  }
  if (!manualChecks.includes("PLT-022")) errors.push("manual checks omit PLT-022 provider-console verification");
  for (const [key, expected] of Object.entries({
    task: "PLT-022",
    contract: "civica-model-operations/v1",
    status: "implemented-and-locally-validated",
  })) {
    if (evidence[key] !== expected) errors.push(`PLT-022 evidence ${key} drifted`);
  }
  if (!plan.includes("[x] **PLT-022**")) errors.push("master checklist does not close PLT-022");
  if (!progress.includes("PLT-022 completed")) errors.push("progress ledger does not close PLT-022");
  if (!packageJson.scripts?.["validate:model-operations"]) errors.push("package scripts omit validate:model-operations");
  if (!packageJson.scripts?.["validate:route-performance-telemetry"]?.includes("validate:model-operations")) {
    errors.push("platform validation gate omits validate:model-operations");
  }
}

if (errors.length) {
  throw new Error(`Model operations contract failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log("civica-model-operations/v1: scoped credentials, bounded paid calls, version identities, safe failures, and operator controls pass static validation.");
