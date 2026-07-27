import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Range = [number, number];

type Candidate = {
  country: string;
  iso3: string;
  theme: "light" | "dark";
  path: string;
  sha256: string;
  width: number;
  height: number;
  format: string;
  colorSpace: string;
  byteCount: number;
  generationCall: string;
  sourcePngSha256: string;
  postprocess: string;
  metrics: Record<string, number>;
};

type Manifest = {
  schemaVersion: string;
  status: string;
  tool: {
    name: string;
    model: string | null;
    modelDisclosure: string;
    seed: number | null;
    seedDisclosure: string;
    conversion: string;
    lightGrade: string;
  };
  productionAssets: Array<{ path: string; sha256: string }>;
  candidates: Candidate[];
  rejectedAttempts: Array<{ reason: string; sourcePngSha256: string }>;
  landmarkChecks: Array<{ country: string; sources: string[]; result: string }>;
  approval: {
    reviewer: string | null;
    decision: string | null;
    decidedAt: string | null;
    approvedCandidatePaths: string[];
  };
};

const root = process.cwd();
const manifestPath = path.join(root, "plan/evidence/EXP-009/candidate-manifest.json");
const promptPath = path.join(root, "plan/evidence/EXP-009/PROMPTS.md");
const contractPath = path.join(root, "plan/decisions/engraving-color-contract-v1.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function inRange(value: number, range: Range) {
  return value >= range[0] && value <= range[1];
}

async function sha256(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function hsv(rByte: number, gByte: number, bByte: number) {
  const r = rByte / 255;
  const g = gByte / 255;
  const b = bByte / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
    if (hue < 0) hue += 360;
  }
  return { hue, saturation, value: max };
}

async function metrics(file: string, width: number) {
  const { data, info } = await sharp(file)
    .resize({ width })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const saturations: number[] = [];
  const luminances: number[] = [];
  let orange = 0;
  let warm = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const value = hsv(r, g, b);
    saturations.push(value.saturation);
    luminances.push((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
    if (value.hue >= 20 && value.hue <= 55 && value.saturation > 0.25 && value.value > 0.08) orange++;
    if (value.hue >= 20 && value.hue <= 70 && value.saturation > 0.12) warm++;
  }
  saturations.sort((a, b) => a - b);
  luminances.sort((a, b) => a - b);
  const quantile = (values: number[], p: number) => values[Math.floor((values.length - 1) * p)];
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const lumaP05 = quantile(luminances, 0.05);
  const lumaP95 = quantile(luminances, 0.95);
  return {
    meanSat: mean(saturations),
    satP95: quantile(saturations, 0.95),
    lumaP05,
    lumaP50: quantile(luminances, 0.5),
    lumaP95,
    toneRange: lumaP95 - lumaP05,
    orangeFrac: orange / saturations.length,
    warmFrac: warm / saturations.length,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const prompts = await readFile(promptPath, "utf8");

  assert(manifest.schemaVersion === "civica-exp-009-illustration-candidates/v1", "unexpected manifest version");
  assert(manifest.status === "pending_human_approval", "candidate status must remain pending");
  assert(manifest.tool.name === "image_gen.imagegen", "generation tool is missing");
  assert(manifest.tool.model === null && manifest.tool.modelDisclosure.length > 20, "model uncertainty is not explicit");
  assert(manifest.tool.seed === null && manifest.tool.seedDisclosure.length > 20, "seed uncertainty is not explicit");
  assert(manifest.candidates.length === 4, "expected exactly four candidates");
  assert(manifest.rejectedAttempts.length >= 1, "rejected attempt is not retained");
  assert(manifest.landmarkChecks.length === 2, "expected one landmark check per country");
  assert(
    manifest.approval.reviewer === null &&
      manifest.approval.decision === null &&
      manifest.approval.decidedAt === null &&
      manifest.approval.approvedCandidatePaths.length === 0,
    "unapproved candidates must not carry approval"
  );

  for (const production of manifest.productionAssets) {
    const file = path.join(root, production.path);
    assert((await sha256(file)) === production.sha256, `${production.path}: production asset changed`);
  }

  const pairs = new Set<string>();
  for (const candidate of manifest.candidates) {
    const file = path.join(root, candidate.path);
    const metadata = await sharp(file).metadata();
    const bytes = (await stat(file)).size;
    assert(metadata.width === candidate.width && candidate.width === contract.delivery.width, `${candidate.path}: width drift`);
    assert(metadata.height === candidate.height && candidate.height === contract.delivery.height, `${candidate.path}: height drift`);
    assert(metadata.format === candidate.format && candidate.format === contract.delivery.format, `${candidate.path}: format drift`);
    assert((metadata.space ?? "").toLowerCase() === candidate.colorSpace, `${candidate.path}: color-space drift`);
    assert(bytes === candidate.byteCount && bytes >= 75_000 && bytes <= 750_000, `${candidate.path}: byte-count drift`);
    assert((await sha256(file)) === candidate.sha256, `${candidate.path}: hash drift`);
    assert(candidate.generationCall.startsWith("call_"), `${candidate.path}: generation call is missing`);
    assert(/^[a-f0-9]{64}$/.test(candidate.sourcePngSha256), `${candidate.path}: source PNG hash is missing`);
    assert(candidate.postprocess.length > 20, `${candidate.path}: post-process record is missing`);
    assert(prompts.includes(candidate.generationCall), `${candidate.path}: exact prompt call is absent`);

    const observed = await metrics(file, contract.measurementWidth);
    for (const [name, expected] of Object.entries(candidate.metrics)) {
      assert(Math.abs(observed[name as keyof typeof observed] - expected) <= 1e-9, `${candidate.path}: ${name} drift`);
    }
    if (candidate.theme === "light") {
      for (const [name, range] of Object.entries(contract.light.ranges) as Array<[keyof typeof observed, Range]>) {
        assert(inRange(observed[name], range), `${candidate.path}: ${name} outside light contract`);
      }
    } else {
      assert(observed.toneRange >= contract.dark.canonicalToneRangeMin, `${candidate.path}: dark tone range too low`);
    }
    pairs.add(`${candidate.iso3}:${candidate.theme}`);
  }

  assert(
    ["fra:light", "fra:dark", "gbr:light", "gbr:dark"].every((pair) => pairs.has(pair)),
    "country/theme pair coverage is incomplete"
  );
  for (const check of manifest.landmarkChecks) {
    assert(check.sources.length >= 2 && check.sources.every((source) => source.startsWith("https://")), `${check.country}: sources incomplete`);
    assert(check.result.includes("illustration"), `${check.country}: evidence boundary missing`);
  }

  console.log("EXP-009 candidates valid: four hash-pinned files, two landmark checks, production assets unchanged, approval pending.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
