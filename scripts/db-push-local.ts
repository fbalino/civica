import { spawnSync } from "node:child_process";
if (process.env.CIVICA_ALLOW_DB_PUSH !== "local-only" || process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
  throw new Error("Refusing drizzle-kit push. Set CIVICA_ALLOW_DB_PUSH=local-only only for a disposable non-production database.");
}
const result = spawnSync("npx", ["drizzle-kit", "push"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
