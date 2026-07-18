import assert from "node:assert/strict";
import test from "node:test";
import { checkEnv, envCheckErrors, ENV_CONTRACT } from "./contract";

const FULL = {
  DATABASE_URL: "postgresql://u:p@host/db",
  ADMIN_USERNAME: "owner",
  ADMIN_PASSWORD_HASH: ["scrypt", "16384", "8", "1", "salt", "hash"].join(":"),
  ADMIN_SESSION_SECRET: "a".repeat(32),
  CRON_SECRET: "b".repeat(32),
  RATE_LIMIT_KEY_SECRET: "r".repeat(32),
  ANTHROPIC_API_KEY_CHAT: "sk-ant-real",
};

test("a fully-configured env passes every context", () => {
  for (const ctx of ["build", "cron", "admin", "chat", "production"] as const) {
    const result = checkEnv(ctx, FULL);
    assert.deepEqual(envCheckErrors(result), [], `context ${ctx}`);
  }
});

test("missing required var fails early with a clear message", () => {
  const noDb = { ...FULL, DATABASE_URL: undefined };
  const result = checkEnv("build", noDb);
  assert.ok(result.missing.includes("DATABASE_URL"));
  assert.match(envCheckErrors(result)[0], /missing required DATABASE_URL/);
});

test("ci is credential-free while production build remains strict", () => {
  assert.deepEqual(envCheckErrors(checkEnv("ci", {})), []);
  const productionBuild = checkEnv("build", {});
  assert.ok(productionBuild.missing.includes("DATABASE_URL"));
});

test("admin context requires admin secrets; build does not", () => {
  const bare = { DATABASE_URL: "postgresql://u:p@h/d" };
  assert.deepEqual(envCheckErrors(checkEnv("build", bare)), []);
  const admin = checkEnv("admin", bare);
  assert.ok(admin.missing.includes("ADMIN_PASSWORD_HASH"));
  assert.ok(admin.missing.includes("ADMIN_SESSION_SECRET"));
});

test("production requires an independent rate-limit identity key", () => {
  const missing = checkEnv("production", {
    ...FULL,
    RATE_LIMIT_KEY_SECRET: undefined,
  });
  assert.ok(missing.missing.includes("RATE_LIMIT_KEY_SECRET"));

  const weak = checkEnv("production", {
    ...FULL,
    RATE_LIMIT_KEY_SECRET: "too-short",
  });
  assert.ok(
    weak.invalid.some((entry) => entry.startsWith("RATE_LIMIT_KEY_SECRET")),
  );

  const whitespaceOnly = checkEnv("production", {
    ...FULL,
    RATE_LIMIT_KEY_SECRET: " ".repeat(32),
  });
  assert.ok(whitespaceOnly.missing.includes("RATE_LIMIT_KEY_SECRET"));

  const reusedSecret = "shared-secret-material".repeat(2);
  const reused = checkEnv("production", {
    ...FULL,
    ADMIN_SESSION_SECRET: reusedSecret,
    RATE_LIMIT_KEY_SECRET: reusedSecret,
  });
  assert.ok(
    reused.invalid.includes(
      "RATE_LIMIT_KEY_SECRET (must differ from ADMIN_SESSION_SECRET)",
    ),
  );
  assert.ok(!JSON.stringify(reused).includes(reusedSecret));

  const whitespaceReused = checkEnv("production", {
    ...FULL,
    ADMIN_SESSION_SECRET: reusedSecret,
    RATE_LIMIT_KEY_SECRET: ` ${reusedSecret} `,
  });
  assert.ok(
    whitespaceReused.invalid.includes(
      "RATE_LIMIT_KEY_SECRET (must differ from ADMIN_SESSION_SECRET)",
    ),
  );

  const adminOnly = checkEnv("admin", {
    ...FULL,
    ADMIN_SESSION_SECRET: reusedSecret,
    RATE_LIMIT_KEY_SECRET: reusedSecret,
  });
  assert.ok(
    !adminOnly.invalid.includes(
      "RATE_LIMIT_KEY_SECRET (must differ from ADMIN_SESSION_SECRET)",
    ),
  );
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

test("a missing chat key fails the dedicated chat environment check", () => {
  const result = checkEnv("chat", {
    ...FULL,
    ANTHROPIC_API_KEY_CHAT: undefined,
  });
  assert.ok(result.missing.includes("ANTHROPIC_API_KEY_CHAT"));
});

test("every required var declares at least one context", () => {
  for (const spec of ENV_CONTRACT) {
    assert.ok(
      spec.requiredIn.length > 0 || spec.note.includes("opt-in"),
      `${spec.name} is neither required nor an explicit opt-in`,
    );
  }
});
