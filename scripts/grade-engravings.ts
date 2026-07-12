import {
  gradeEngraving,
  gradeEngravingManifest,
  readEngravingGradeManifest,
  type EngravingGradeMode,
} from "../src/lib/illustrations/engraving-grade";

function argument(name: string) {
  const inline = process.argv.slice(2).find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const manifestFile = argument("--manifest");
  const force = process.argv.includes("--force");
  let results;
  if (manifestFile) {
    const manifest = await readEngravingGradeManifest(manifestFile);
    if (force) manifest.entries = manifest.entries.map((entry) => ({ ...entry, force: true }));
    results = await gradeEngravingManifest(manifest);
  } else {
    const input = argument("--input");
    const output = argument("--output");
    const mode = argument("--mode") as EngravingGradeMode | undefined;
    if (!input || !output || (mode !== "preview" && mode !== "final")) {
      throw new Error("usage: --input <file> --output <file.webp> --mode preview|final [--force], or --manifest <file.json>");
    }
    results = [await gradeEngraving({ input, output, mode, force })];
  }
  console.log(JSON.stringify({ written: results.filter((item) => item.status === "written").length, unchanged: results.filter((item) => item.status === "unchanged").length, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
