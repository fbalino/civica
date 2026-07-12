import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { gradeEngraving, gradeEngravingManifest } from "./engraving-grade";

const GOLDEN_SVG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="#562812"/><rect x="1" y="1" width="10" height="6" fill="#d48b3c"/><path d="M1 7L11 1M1 1L11 7" stroke="#f6d49a" stroke-width="1"/></svg>`);

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civica-engraving-grade-"));
  const input = path.join(directory, "input.png");
  await sharp(GOLDEN_SVG).png().toFile(input);
  return { directory, input };
}

test("final grading is deterministic, preserves geometry, and records the golden hash", async () => {
  const { directory, input } = await fixture();
  const firstOutput = path.join(directory, "first.webp");
  const secondOutput = path.join(directory, "second.webp");
  const first = await gradeEngraving({ input, output: firstOutput, mode: "final" });
  const second = await gradeEngraving({ input, output: secondOutput, mode: "final" });
  assert.equal(first.status, "written");
  assert.equal(second.status, "written");
  assert.equal(first.record.outputSha256, second.record.outputSha256);
  assert.equal(first.record.outputSha256, "62f61b7fff9d7606c7cb35e7d8b38bb2c07aa369cba2e7efc01f302a2a5bdf99");
  assert.deepEqual([first.record.source.width, first.record.source.height], [12, 8]);
  assert.deepEqual([first.record.result.width, first.record.result.height], [12, 8]);
  assert.equal(first.record.result.metadataPolicy, "stripped");
  assert.ok(first.record.result.metrics.meanSaturation < first.record.source.metrics.meanSaturation);
  assert.equal(Number(first.record.result.metrics.meanSaturation.toFixed(6)), 0.548852);
  assert.equal(Number(first.record.result.metrics.strongOrangeFraction.toFixed(6)), 0.895833);
  assert.equal(Number(first.record.result.metrics.toneRange.toFixed(6)), 0.63778);
  assert.match(await readFile(first.sidecar, "utf8"), /civica-engraving-grade\/1\.0\.0/);
});

test("an identical rerun is a no-write and an output cannot become a new input", async () => {
  const { directory, input } = await fixture();
  const output = path.join(directory, "graded.webp");
  const first = await gradeEngraving({ input, output, mode: "preview" });
  const second = await gradeEngraving({ input, output, mode: "preview" });
  assert.equal(first.status, "written");
  assert.equal(second.status, "unchanged");
  await assert.rejects(
    gradeEngraving({ input: output, output: path.join(directory, "twice.webp"), mode: "final" }),
    /already a graded output/,
  );
});

test("a manifest writes preview and final outputs and rejects duplicate destinations", async () => {
  const { directory, input } = await fixture();
  const results = await gradeEngravingManifest({
    contract: "civica-engraving-grade-manifest/v1",
    entries: [
      { input, output: path.join(directory, "preview.webp"), mode: "preview" },
      { input, output: path.join(directory, "final.webp"), mode: "final" },
    ],
  });
  assert.deepEqual(results.map((item) => item.status), ["written", "written"]);
  await assert.rejects(
    gradeEngravingManifest({
      contract: "civica-engraving-grade-manifest/v1",
      entries: [
        { input, output: path.join(directory, "same.webp"), mode: "preview" },
        { input, output: path.join(directory, "same.webp"), mode: "final" },
      ],
    }),
    /duplicate manifest output/,
  );
});
