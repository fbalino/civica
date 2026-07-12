import assert from "node:assert/strict";
import test from "node:test";
import {
  findSecrets,
  isPlaceholder,
  isSensitiveFile,
  redact,
  sha256Hex,
} from "./secret-patterns";

test("catches live-format credentials", () => {
  const cases = [
    'const k = "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";',
    "AKIA1B2C3D4E5F6G7H8I", // AWS-shaped (16 upper/digit after AKIA)
    "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "GOCSPX-abcdefghijklmnopqrstuvwx",
    "-----BEGIN RSA PRIVATE KEY-----",
    'DATABASE_URL="postgresql://owner:npg_realLookingPassword@ep-foo.neon.tech/db"',
    'ADMIN_SESSION_SECRET = "0a1b2c3d4e5f60718293a4b5c6d7e8f9"',
  ];
  for (const c of cases) {
    assert.ok(findSecrets(c).length >= 1, `should flag: ${c.slice(0, 24)}…`);
  }
});

test("never emits the full secret value", () => {
  const secret = "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  const [finding] = findSecrets(secret);
  assert.ok(finding);
  assert.ok(!finding.preview.includes("0123456789"));
  assert.match(finding.preview, /\*{3,}/);
  assert.equal(redact(secret).length <= secret.length, true);
});

test("skips documented placeholders and local/test fixtures", () => {
  const placeholders = [
    "postgresql://user:password@host/dbname?sslmode=require",
    "postgresql://invalid:invalid@127.0.0.1:1/invalid",
    "CONGRESS_API_KEY=DEMO_KEY",
    'PULSE_CODING_SESSION_SECRET = "test-secret-that-is-long-enough"',
    "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx",
  ];
  for (const p of placeholders) {
    assert.equal(findSecrets(p).length, 0, `should skip placeholder: ${p}`);
    assert.equal(isPlaceholder(p) || findSecrets(p).length === 0, true);
  }
});

test("a known-exposed hash suppresses that one finding but not others", () => {
  const known = "postgresql://owner:npg_realLookingPassword@ep-foo.neon.tech/db";
  const other = "sk-ant-api03-ZZZZZZZZZZZZZZZZZZZZZZZZ0123456789";
  const text = `${known}\n${other}`;
  const withoutAllow = findSecrets(text);
  assert.ok(withoutAllow.length >= 2);
  const withAllow = findSecrets(text, new Set(), new Set([sha256Hex(known)]));
  // The known one is suppressed; the other still fires.
  assert.ok(withAllow.some((f) => f.patternId === "anthropic-key"));
  assert.ok(!withAllow.some((f) => f.patternId === "db-url-with-password"));
});

test("flags sensitive artifact filenames", () => {
  assert.ok(isSensitiveFile("backups/prod.sql.gz"));
  assert.ok(isSensitiveFile("id_rsa"));
  assert.ok(isSensitiveFile("config/server.pem"));
  assert.ok(isSensitiveFile("com.vercel.cli/auth.json"));
  assert.ok(!isSensitiveFile("src/lib/foo.ts"));
  assert.ok(!isSensitiveFile("data/release.json"));
});
