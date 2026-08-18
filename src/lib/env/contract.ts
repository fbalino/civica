/**
 * PLT-006 — the single, typed environment-variable contract.
 *
 * Every variable declares the execution CONTEXTS in which it is *required*
 * (its absence should fail startup early with a clear message), whether it is
 * a SECRET (its value must never be echoed), and an optional format check.
 * Variables absent here are unmanaged/ignored. Variables that are optional in
 * a context but enable a feature are `degrades` — their absence turns a
 * feature off explicitly rather than failing.
 *
 * This is the machine-readable companion to `.env.example` (the prose
 * contract). Keep them in sync.
 */

export type EnvContext =
  | "build"
  | "ci"
  | "dev"
  | "test"
  | "scripts"
  | "cron"
  | "admin"
  | "chat"
  | "production";

export const ENV_CONTEXTS: EnvContext[] = [
  "build",
  "ci",
  "dev",
  "test",
  "scripts",
  "cron",
  "admin",
  "chat",
  "production",
];

export type EnvVarSpec = {
  name: string;
  /** Contexts in which the variable is REQUIRED (missing → fail early). */
  requiredIn: EnvContext[];
  /** Its value is sensitive and must never be printed. */
  secret?: boolean;
  /** Human note (why it exists / what degrades without it). */
  note: string;
  /** Optional format validator; return an error string if invalid. */
  validate?: (value: string) => string | null;
};

const isPostgresUrl = (v: string): string | null =>
  /^postgres(ql)?:\/\/.+/.test(v)
    ? null
    : "must be a postgres:// connection string";
const nonEmpty = (v: string): string | null =>
  v.trim().length > 0 ? null : "must not be empty";
const isScryptHash = (v: string): string | null =>
  v.includes(":") && v.split(":").length >= 4
    ? null
    : "must be a scrypt hash (npm run admin:set-password)";

/**
 * DB access underlies production builds, dev, DB tests, scripts, crons, admin,
 * chat, and production. The `ci` context deliberately has no database: it
 * verifies the credential-free build/fallback contract while `build` remains
 * strict. Admin/cron/chat secrets fail their context closed. Model-provider
 * keys are `degrades` (feature off) rather than required, per `.env.example`.
 */
export const ENV_CONTRACT: EnvVarSpec[] = [
  {
    name: "DATABASE_URL",
    requiredIn: [
      "build",
      "dev",
      "scripts",
      "cron",
      "admin",
      "chat",
      "production",
    ],
    secret: true,
    note: "Neon Postgres connection. Underlies every DB-touching context.",
    validate: isPostgresUrl,
  },
  {
    name: "ADMIN_USERNAME",
    requiredIn: ["admin", "production"],
    note: "Admin login username; admin routes fail closed without it.",
    validate: nonEmpty,
  },
  {
    name: "ADMIN_PASSWORD_HASH",
    requiredIn: ["admin", "production"],
    secret: true,
    note: "Salted scrypt hash of the admin password.",
    validate: isScryptHash,
  },
  {
    name: "ADMIN_SESSION_SECRET",
    requiredIn: ["admin", "production"],
    secret: true,
    note: "HMAC key signing the admin session cookie.",
    validate: nonEmpty,
  },
  {
    name: "CRON_SECRET",
    requiredIn: ["cron", "production"],
    secret: true,
    note: "Bearer token Vercel Cron sends to every /api/cron/* route.",
    validate: nonEmpty,
  },
  {
    name: "RATE_LIMIT_KEY_SECRET",
    requiredIn: ["production"],
    secret: true,
    note: "Independent HMAC key that obscures client identities in distributed rate-limit counters.",
    validate: (value) =>
      new TextEncoder().encode(value.trim()).byteLength >= 32
        ? null
        : "must be at least 32 bytes",
  },
  {
    name: "VERCEL_PROTECTED_SOURCEMAPS",
    requiredIn: [],
    note: "Explicit production opt-in for browser maps only after Vercel Protected Source Maps is enabled; absent keeps browser maps off.",
    validate: (value) =>
      value === "true" || value === "false"
        ? null
        : "must be exactly true or false when set",
  },
  {
    name: "CIVICA_ATLAS_RELEASE_ID",
    requiredIn: [],
    note: "Explicit opt-in naming the Atlas data release for writers that append public release-to-release history.",
    validate: (value) =>
      /^[A-Za-z0-9._-]{1,96}$/.test(value.trim())
        ? null
        : "must be a 1-96 character release identifier",
  },
  {
    name: "ANTHROPIC_API_KEY_CHAT",
    requiredIn: ["chat"],
    secret: true,
    note: "Powers /api/chat (Ask Civica). Runtime environment drift still returns a fixed unavailable response.",
    validate: nonEmpty,
  },
];

/** Variables that enable a feature and degrade gracefully when absent. */
export const ENV_DEGRADES: Array<{
  name: string;
  secret?: boolean;
  note: string;
}> = [
  {
    name: "ANTHROPIC_API_KEY_PULSE_CLASSIFIER",
    secret: true,
    note: "Pulse ensemble voter/verifier; classify cron no-ops without it.",
  },
  {
    name: "ANTHROPIC_API_KEY_PULSE_SUMMARIZE",
    secret: true,
    note: "Pulse review summariser.",
  },
  {
    name: "ANTHROPIC_API_KEY_BILLS_SUMMARIZE",
    secret: true,
    note: "Bills summariser.",
  },
  {
    name: "ANTHROPIC_API_KEY_RECONCILIATION",
    secret: true,
    note: "Stats SA reconciliation extraction.",
  },
  {
    name: "FIRECRAWL_API_KEY",
    secret: true,
    note: "Retrieval fallback for publishers that block direct ingestion (Amnesty 403s its whole domain); unset = blocked feeds fail honestly.",
  },
  {
    name: "DEEPSEEK_API_KEY",
    secret: true,
    note: "Default Pulse voter; classify cron no-ops without it.",
  },
  { name: "GLM_API_KEY", secret: true, note: "Pulse voter when provider=glm." },
  { name: "OPENAI_API_KEY", secret: true, note: "Optional 4th Pulse voter." },
  {
    name: "PULSE_CODING_SESSION_SECRET",
    secret: true,
    note: "Independent-coder session HMAC; coding workspace off without it.",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    note: "Google admin sign-in (with SECRET + ADMIN_GOOGLE_EMAIL).",
  },
  { name: "GOOGLE_CLIENT_SECRET", secret: true, note: "Google admin sign-in." },
  {
    name: "CONGRESS_API_KEY",
    secret: true,
    note: "US legislative sync; falls back to DEMO_KEY.",
  },
  {
    name: "BUNDESTAG_API_KEY",
    secret: true,
    note: "German legislative sync; falls back to anonymous.",
  },
  {
    name: "NEXT_PUBLIC_MAPBOX_TOKEN",
    note: "Optional 3D globe; 2D map is keyless.",
  },
  {
    name: "NEXT_PUBLIC_BASEMAP_PMTILES_URL",
    note: "Self-hosted basemap; falls back to OpenFreeMap.",
  },
];

export type EnvCheckResult = {
  context: EnvContext;
  missing: string[]; // required-and-absent
  invalid: string[]; // present-but-fails-format (name + reason, never value)
  degradedOff: string[]; // optional features off (absent degrades)
};

/**
 * Check an environment map against the contract for a context. NEVER returns
 * or logs a secret value — only names and format reasons.
 */
export function checkEnv(
  context: EnvContext,
  env: Record<string, string | undefined> = process.env,
): EnvCheckResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const spec of ENV_CONTRACT) {
    const required = spec.requiredIn.includes(context);
    const value = env[spec.name];
    if (!value || value.trim() === "") {
      if (required) missing.push(spec.name);
      continue;
    }
    if (spec.validate) {
      const reason = spec.validate(value);
      if (reason) invalid.push(`${spec.name} (${reason})`);
    }
  }
  const rateLimitKeySecret = env.RATE_LIMIT_KEY_SECRET?.trim();
  const adminSessionSecret = env.ADMIN_SESSION_SECRET?.trim();
  if (
    context === "production" &&
    rateLimitKeySecret &&
    adminSessionSecret &&
    rateLimitKeySecret === adminSessionSecret
  ) {
    invalid.push(
      "RATE_LIMIT_KEY_SECRET (must differ from ADMIN_SESSION_SECRET)",
    );
  }
  const degradedOff = ENV_DEGRADES.filter(
    (d) => !env[d.name] || env[d.name]!.trim() === "",
  ).map((d) => d.name);
  return { context, missing, invalid, degradedOff };
}

export function envCheckErrors(result: EnvCheckResult): string[] {
  const errors: string[] = [];
  for (const name of result.missing) {
    errors.push(`missing required ${name} for context '${result.context}'`);
  }
  for (const entry of result.invalid) {
    errors.push(`invalid ${entry} for context '${result.context}'`);
  }
  return errors;
}
