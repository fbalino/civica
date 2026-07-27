import { existsSync, readFileSync } from "node:fs";

const files = {
  contract: "src/lib/ask-civica/contract.ts",
  route: "src/app/api/chat/route.ts",
  schema: "src/lib/api/request-body-schemas.ts",
  drawer: "src/components/factbook/CivicaAIDrawer.tsx",
  privacy: "src/app/privacy/page.tsx",
  docs: "data/ASK-CIVICA.md",
  evidence: "plan/evidence/PLT-021/ask-civica-contract.json",
  plan: "plan/MASTER-CHECKLIST.md",
  progress: "plan/PROGRESS.md",
  packageJson: "package.json",
} as const;

const errors: string[] = [];
for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) errors.push(`missing ${name} contract source: ${path}`);
}

if (!errors.length) {
  const read = (path: string) => readFileSync(path, "utf8");
  const contract = read(files.contract);
  const route = read(files.route);
  const schema = read(files.schema);
  const drawer = read(files.drawer);
  const privacy = read(files.privacy);
  const docs = read(files.docs);
  const evidence = JSON.parse(read(files.evidence)) as Record<string, unknown>;
  const plan = read(files.plan);
  const progress = read(files.progress);
  const packageJson = JSON.parse(read(files.packageJson)) as { scripts?: Record<string, string> };

  for (const token of ["ask-civica-contract/v1", "ASK_CIVICA_PROMPT_VERSION", "ASK_CIVICA_MODEL", "allowed_evidence", "untrusted data", "no tools, accounts, files, network access, or secrets", "isAskCivicaDirectInjectionAttempt", "formatAskCivicaAuditEvent"]) {
    if (!contract.includes(token)) errors.push(`Ask Civica contract omits ${token}`);
  }
  for (const token of ["loadAskCivicaEvidence", "ASK_CIVICA_SYSTEM_PROMPT", "askCivicaUserPayload", "askCivicaCitationFooter", "ask-civica.provider-failure", "ask-civica.model-unavailable"]) {
    if (!route.includes(token)) errors.push(`Ask Civica route omits ${token}`);
  }
  for (const forbidden of ["console.error(\"[/api/chat] stream error:", "context.country", "context.parties"]) {
    if (route.includes(forbidden)) errors.push(`Ask Civica route retains unsafe ${forbidden}`);
  }
  for (const token of ["countrySlug", "z.enum([", "context: chatContextSchema"]) {
    if (!schema.includes(token)) errors.push(`Ask Civica schema omits ${token}`);
  }
  if (!drawer.includes("countrySlug") || drawer.includes("country: countryName")) {
    errors.push("Ask Civica drawer does not send only the server-resolved country slug");
  }
  for (const token of ["id=\"ask-civica\"", "does not persist Ask Civica questions or replies"]) {
    if (!privacy.includes(token)) errors.push(`privacy disclosure omits ${token}`);
  }
  if (!/Civica does not claim that\s+zero-data retention is enabled/.test(privacy)) {
    errors.push("privacy disclosure must not claim zero-data retention");
  }
  for (const token of ["ask-civica-contract/v1", "Anthropic", "zero-data retention", "prompt-injection", "content-free operational event"]) {
    if (!docs.includes(token)) errors.push(`Ask Civica documentation omits ${token}`);
  }
  for (const [key, expected] of Object.entries({ task: "PLT-021", contract: "ask-civica-contract/v1", status: "implemented-and-locally-validated" })) {
    if (evidence[key] !== expected) errors.push(`Ask Civica evidence ${key} drifted`);
  }
  if (!plan.includes("[x] **PLT-021**")) errors.push("master checklist does not close PLT-021");
  if (!progress.includes("PLT-021 completed")) errors.push("progress ledger does not close PLT-021");
  if (!packageJson.scripts?.["validate:ask-civica"]) errors.push("package scripts omit validate:ask-civica");
}

if (errors.length) {
  throw new Error(`Ask Civica contract failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log("ask-civica-contract/v1: sourced evidence, privacy, version, injection, and safe-failure contracts pass static validation.");
