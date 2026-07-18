import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const originalCache = process.env.CIVICA_RESEARCH_INPUT_DIR;

function sha(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

test("longitudinal replay requires an exact retained input byte stream", async () => {
  const directory = mkdtempSync(join(tmpdir(), "civica-longitudinal-input-"));
  const bytes = Buffer.from("frozen publisher input");
  const hash = sha(bytes);
  try {
    process.env.CIVICA_RESEARCH_INPUT_DIR = directory;
    const { exactFrozenInput } = await import("../../../scripts/generate-index-longitudinal-analysis");
    await assert.rejects(
      exactFrozenInput("https://example.test/input", hash),
      /Missing retained frozen input/,
    );
    mkdirSync(join(directory, "sha256"), { recursive: true });
    writeFileSync(join(directory, "sha256", hash), bytes);
    assert.deepEqual(await exactFrozenInput("https://example.test/input", hash), bytes);
    writeFileSync(join(directory, "sha256", hash), "drifted bytes");
    await assert.rejects(
      exactFrozenInput("https://example.test/input", hash),
      /retained input hash drift/,
    );
  } finally {
    if (originalCache === undefined) delete process.env.CIVICA_RESEARCH_INPUT_DIR;
    else process.env.CIVICA_RESEARCH_INPUT_DIR = originalCache;
    rmSync(directory, { recursive: true, force: true });
  }
});
