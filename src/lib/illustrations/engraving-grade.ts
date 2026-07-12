import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const ENGRAVING_GRADE_METHOD = "civica-engraving-grade/1.0.0";

export const APPROVED_GRADE_RECIPE = Object.freeze({
  strength: 60,
  saturation: 0.73,
  hueDegrees: -6,
  brightness: 1.018,
  finalQuality: 88,
  previewQuality: 72,
});

export type EngravingGradeMode = "preview" | "final";

export type EngravingGradeRequest = {
  input: string;
  output: string;
  mode: EngravingGradeMode;
  force?: boolean;
};

export type EngravingGradeManifest = {
  contract: "civica-engraving-grade-manifest/v1";
  entries: EngravingGradeRequest[];
};

export type EngravingGradeRecord = {
  method: typeof ENGRAVING_GRADE_METHOD;
  mode: EngravingGradeMode;
  input: string;
  output: string;
  inputSha256: string;
  outputSha256: string;
  source: {
    width: number;
    height: number;
    format: string | null;
    aspectRatio: number;
    metrics: EngravingColorMetrics;
  };
  result: {
    width: number;
    height: number;
    format: string | null;
    aspectRatio: number;
    metadataPolicy: "stripped";
    metrics: EngravingColorMetrics;
  };
  recipe: typeof APPROVED_GRADE_RECIPE;
};

export type EngravingColorMetrics = {
  meanSaturation: number;
  strongOrangeFraction: number;
  luminanceP05: number;
  luminanceP95: number;
  toneRange: number;
};

export type EngravingGradeResult =
  | { status: "written"; record: EngravingGradeRecord; sidecar: string }
  | { status: "unchanged"; record: EngravingGradeRecord; sidecar: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sidecarPath(file: string) {
  return `${file}.grade.json`;
}

async function fileSha256(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function readRecord(file: string): Promise<EngravingGradeRecord | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as EngravingGradeRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function metadata(file: string) {
  const value = await sharp(file).metadata();
  assert(value.width && value.height, `${file}: image dimensions unavailable`);
  return {
    width: value.width,
    height: value.height,
    format: value.format ?? null,
    aspectRatio: value.width / value.height,
  };
}

export async function measureEngravingColor(file: string, measurementWidth = 400): Promise<EngravingColorMetrics> {
  const { data, info } = await sharp(file)
    .resize({ width: measurementWidth, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminances: number[] = [];
  let saturationSum = 0;
  let orange = 0;
  let count = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
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
    if (hue >= 20 && hue <= 55 && saturation > 0.25 && max > 0.08) orange++;
    saturationSum += saturation;
    luminances.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    count++;
  }
  luminances.sort((a, b) => a - b);
  const percentile = (p: number) => luminances[Math.floor((luminances.length - 1) * p)];
  const luminanceP05 = percentile(0.05);
  const luminanceP95 = percentile(0.95);
  return {
    meanSaturation: saturationSum / count,
    strongOrangeFraction: orange / count,
    luminanceP05,
    luminanceP95,
    toneRange: luminanceP95 - luminanceP05,
  };
}

function sameRecipe(record: EngravingGradeRecord, request: EngravingGradeRequest, inputHash: string) {
  return (
    record.method === ENGRAVING_GRADE_METHOD &&
    record.mode === request.mode &&
    record.inputSha256 === inputHash &&
    JSON.stringify(record.recipe) === JSON.stringify(APPROVED_GRADE_RECIPE)
  );
}

export async function gradeEngraving(request: EngravingGradeRequest): Promise<EngravingGradeResult> {
  const input = path.resolve(request.input);
  const output = path.resolve(request.output);
  assert(input !== output, "input and output must be different; grading is non-destructive");
  assert(path.extname(output).toLowerCase() === ".webp", "output must use .webp");

  const priorInputRecord = await readRecord(sidecarPath(input));
  assert(!priorInputRecord, `${input}: input is already a graded output; refusing a second transform`);

  const inputHash = await fileSha256(input);
  const outputSidecar = sidecarPath(output);
  const priorOutputRecord = await readRecord(outputSidecar);
  if (priorOutputRecord && sameRecipe(priorOutputRecord, request, inputHash)) {
    const currentOutputHash = await fileSha256(output);
    assert(currentOutputHash === priorOutputRecord.outputSha256, `${output}: bytes drifted from its grade record`);
    return { status: "unchanged", record: priorOutputRecord, sidecar: outputSidecar };
  }
  assert(!priorOutputRecord || request.force, `${output}: a different grade record exists; pass force only after review`);

  const sourceMetadata = await metadata(input);
  const source = { ...sourceMetadata, metrics: await measureEngravingColor(input) };
  await mkdir(path.dirname(output), { recursive: true });
  const quality = request.mode === "final" ? APPROVED_GRADE_RECIPE.finalQuality : APPROVED_GRADE_RECIPE.previewQuality;
  await sharp(input)
    .modulate({
      saturation: APPROVED_GRADE_RECIPE.saturation,
      hue: APPROVED_GRADE_RECIPE.hueDegrees,
      brightness: APPROVED_GRADE_RECIPE.brightness,
    })
    .webp({ quality })
    .toFile(output);

  const resultMetadata = await metadata(output);
  const result = { ...resultMetadata, metrics: await measureEngravingColor(output) };
  assert(result.width === source.width && result.height === source.height, `${output}: dimensions changed`);
  assert(Math.abs(result.aspectRatio - source.aspectRatio) < Number.EPSILON, `${output}: aspect ratio changed`);

  const record: EngravingGradeRecord = {
    method: ENGRAVING_GRADE_METHOD,
    mode: request.mode,
    input,
    output,
    inputSha256: inputHash,
    outputSha256: await fileSha256(output),
    source,
    result: { ...result, metadataPolicy: "stripped" },
    recipe: APPROVED_GRADE_RECIPE,
  };
  await writeFile(outputSidecar, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { status: "written", record, sidecar: outputSidecar };
}

export async function gradeEngravingManifest(manifest: EngravingGradeManifest) {
  assert(manifest.contract === "civica-engraving-grade-manifest/v1", "unsupported engraving manifest contract");
  assert(Array.isArray(manifest.entries) && manifest.entries.length > 0, "engraving manifest has no entries");
  const outputs = new Set<string>();
  for (const entry of manifest.entries) {
    assert(entry.mode === "preview" || entry.mode === "final", `${entry.output}: invalid mode`);
    const output = path.resolve(entry.output);
    assert(!outputs.has(output), `${entry.output}: duplicate manifest output`);
    outputs.add(output);
  }
  const results: EngravingGradeResult[] = [];
  for (const entry of manifest.entries) results.push(await gradeEngraving(entry));
  return results;
}

export async function readEngravingGradeManifest(file: string): Promise<EngravingGradeManifest> {
  return JSON.parse(await readFile(file, "utf8")) as EngravingGradeManifest;
}
