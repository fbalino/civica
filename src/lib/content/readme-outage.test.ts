import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("README offline generation uses declared nonnumeric fallbacks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "civica-readme-"));
  const output = path.join(tempDir, "README.md");

  try {
    const run = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/regenerate-readme.ts",
        "--offline",
        "--output",
        output,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30_000,
      },
    );

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const rendered = await fs.readFile(output, "utf8");

    assert.match(rendered, /Currently multiple active source orchestrators/);
    assert.match(
      rendered,
      /Many reconciled facts across many declared fact-keys/,
    );
    assert.match(
      rendered,
      /publisher list unavailable while the database is offline/,
    );
    assert.doesNotMatch(rendered, /About 26,000/);
    assert.doesNotMatch(
      rendered,
      /population, life expectancy, unemployment, inflation, public debt/,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
