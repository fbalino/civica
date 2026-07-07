import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

test("hashPassword emits the self-describing scrypt: format", async () => {
  const hash = await hashPassword("correct horse battery staple");
  // Colon-delimited (NOT `$`) so the value survives .env dotenv-expand.
  const parts = hash.split(":");
  assert.equal(parts.length, 6);
  assert.equal(parts[0], "scrypt");
  assert.ok(!hash.includes("$"), "hash must not contain '$' (env-expansion hazard)");
  // N is a power of two, r/p positive integers, salt + hash are hex.
  assert.ok(Number.isInteger(Number(parts[1])));
  assert.match(parts[4], /^[0-9a-f]+$/);
  assert.match(parts[5], /^[0-9a-f]+$/);
});

test("verifyPassword accepts the correct password", async () => {
  const hash = await hashPassword("s3cret-passw0rd");
  assert.equal(await verifyPassword("s3cret-passw0rd", hash), true);
});

test("verifyPassword rejects a wrong password", async () => {
  const hash = await hashPassword("s3cret-passw0rd");
  assert.equal(await verifyPassword("s3cret-passw0rF", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("salt makes two hashes of the same password differ", async () => {
  const a = await hashPassword("same-password");
  const b = await hashPassword("same-password");
  assert.notEqual(a, b);
  // ...yet both verify.
  assert.equal(await verifyPassword("same-password", a), true);
  assert.equal(await verifyPassword("same-password", b), true);
});

test("verifyPassword fails closed on malformed / missing stored hashes", async () => {
  assert.equal(await verifyPassword("x", null), false);
  assert.equal(await verifyPassword("x", undefined), false);
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
  assert.equal(await verifyPassword("x", "scrypt:16384:8:1:deadbeef"), false); // too few fields
  assert.equal(
    await verifyPassword("x", "bcrypt:16384:8:1:aa:bb"),
    false,
  ); // wrong algo tag
  // Non-power-of-two N is rejected without throwing.
  assert.equal(
    await verifyPassword("x", "scrypt:3:8:1:aa:bb"),
    false,
  );
});
