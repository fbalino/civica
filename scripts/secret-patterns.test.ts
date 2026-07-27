import assert from "node:assert/strict";
import test from "node:test";
import {
  findSecrets,
  isPlaceholder,
  isSensitiveFile,
  redact,
  sha256Hex,
} from "./secret-patterns";

/**
 * Build detector inputs at runtime so the scanner's own tracked test source
 * never contains a live-shaped credential literal.
 */
function stitch(...parts: string[]): string {
  return parts.join("");
}

test("catches live-format credentials", () => {
  const anthropic = stitch(
    "sk-",
    "ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
  );
  const assignedName = stitch("ADMIN_SESSION_SE", "CRET");
  const cases = [
    `const k = "${anthropic}";`,
    stitch("AK", "IA1B2C3D4E5F6G7H8I"), // AWS-shaped (16 upper/digit after AKIA)
    stitch("gh", "p_abcdefghijklmnopqrstuvwxyz0123456789"),
    stitch("GOC", "SPX-abcdefghijklmnopqrstuvwx"),
    stitch("-----BEGIN RSA ", "PRIVATE KEY-----"),
    `DATABASE_URL="${stitch(
      "postgresql://owner:",
      "npg_realLookingPassword@ep-foo.neon.tech/db",
    )}"`,
    `${assignedName} = "${stitch("0a1b2c3d4e5f60718", "293a4b5c6d7e8f9")}"`,
  ];
  for (const c of cases) {
    assert.ok(findSecrets(c).length >= 1, `should flag: ${c.slice(0, 24)}…`);
  }
});

test("never emits the full secret value", () => {
  const secret = stitch(
    "sk-",
    "ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
  );
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
  const known = stitch(
    "postgresql://owner:",
    "npg_realLookingPassword@ep-foo.neon.tech/db",
  );
  const other = stitch("sk-", "ant-api03-ZZZZZZZZZZZZZZZZZZZZZZZZ0123456789");
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
