import assert from "node:assert/strict";
import test from "node:test";
import { checkEnv, envCheckErrors, ENV_CONTRACT } from "./contract";

const FULL = {
  DATABASE_URL: "postgresql://u:p@host/db",
  ADMIN_USERNAME: "owner",
  ADMIN_PASSWORD_HASH: ["scrypt", "16384", "8", "1", "salt", "hash"].join(":"),
  ADMIN_SESSION_SECRET: "a".repeat(32),
  CRON_SECRET: "b".repeat(32),
  ANTHROPIC_API_KEY_CHAT: "sk-ant-real",
};

test("a fully-configured env passes every context", () => {
  for (const ctx of ["build", "cron", "admin", "chat", "production"] as const) {
    const result = checkEnv(ctx, FULL);
    assert.deepEqual(envCheckErrors(result), [], `context ${ctx}`);
  }
});

test("missing required var fails early with a clear message", () => {
  const { DATABASE_URL: _omit, ...noDb } = FULL;
  const result = checkEnv("build", noDb);
  assert.ok(result.missing.includes("DATABASE_URL"));
  assert.match(envCheckErrors(result)[0], /missing required DATABASE_URL/);
});

test("admin context requires admin secrets; build does not", () => {
  const bare = { DATABASE_URL: "postgresql://u:p@h/d" };
  assert.deepEqual(envCheckErrors(checkEnv("build", bare)), []);
  const admin = checkEnv("admin", bare);
  assert.ok(admin.missing.includes("ADMIN_PASSWORD_HASH"));
  assert.ok(admin.missing.includes("ADMIN_SESSION_SECRET"));
});

test("invalid format is reported without echoing the value", () => {
  const result = checkEnv("build", { ...FULL, DATABASE_URL: "notaurl" });
  const errors = envCheckErrors(result);
  assert.ok(errors.some((e) => e.includes("DATABASE_URL")));
  // The bad value must never appear in the error output.
  assert.ok(!errors.join(" ").includes("notaurl"));
});

test("secrets are never included in check output", () => {
  const invalidHash = ["scrypt:1:1:1:a", "SECRETvalue:another", "SECRET"].join(
    "",
  );
  const result = checkEnv("production", {
    ...FULL,
    ADMIN_PASSWORD_HASH: invalidHash,
  });
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("aSECRETvalue"));
  assert.ok(!serialized.includes("postgresql://u:p@host/db"));
});

test("optional model keys degrade off, never fail", () => {
  const result = checkEnv("cron", FULL); // no DEEPSEEK/GLM/etc.
  assert.deepEqual(envCheckErrors(result), []);
  assert.ok(result.degradedOff.includes("DEEPSEEK_API_KEY"));
});

test("every required var declares at least one context", () => {
  for (const spec of ENV_CONTRACT) {
    assert.ok(spec.requiredIn.length > 0, `${spec.name} has no requiredIn`);
  }
});
