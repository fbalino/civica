import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("constitution catalog query can preserve an outage signal", () => {
  const code = [
    'const mod = await import("./src/lib/db/queries-constitution.ts");',
    "const getIndexedConstitutionCountries = mod.getIndexedConstitutionCountries ?? mod.default?.getIndexedConstitutionCountries;",
    'if (typeof getIndexedConstitutionCountries !== "function") process.exit(3);',
    "let rejected = false;",
    "try {",
    "  await getIndexedConstitutionCountries({ throwOnError: true });",
    "} catch {",
    "  rejected = true;",
    "}",
    "if (!rejected) process.exit(2);",
  ].join("\n");

  const run = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      code,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/invalid",
      },
      timeout: 20_000,
    },
  );

  assert.equal(run.status, 0, run.stderr || run.stdout);
});
