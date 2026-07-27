import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Range = [number, number];
type Contract = {
  contract: string;
  status: string;
  measurementWidth: number;
  delivery: { width: number; height: number; format: string; quality: number };
  light: { canonicalAsset: string; sha256: string; ranges: Record<string, Range> };
  dark: {
    canonicalAsset: string;
    sha256: string;
    canonicalToneRangeMin: number;
    corpusRanges: { meanSat: Range; orangeFrac: Range };
    recipe: { strength: number; saturation: number; hueDegrees: number; brightness: number };
    report: string;
  };
  invariants: Record<string, boolean | number>;
  examples: { pass: string[]; fail: string[] };
};

const root = process.cwd();
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

async function validateAsset(asset: string, expectedHash: string, contract: Contract) {
  const file = path.join(root, asset);
  const metadata = await sharp(file).metadata();
  assert(metadata.width === contract.delivery.width, `${asset}: width drifted`);
  assert(metadata.height === contract.delivery.height, `${asset}: height drifted`);
  assert(metadata.format === contract.delivery.format, `${asset}: format drifted`);
  assert((await sha256(file)) === expectedHash, `${asset}: canonical bytes drifted`);
  return file;
}

async function main() {
  const contract = JSON.parse(await readFile(contractPath, "utf8")) as Contract;
  assert(contract.contract === "civica-engraving-color/v1", "unexpected contract id");
  assert(contract.status === "adopted", "engraving contract is not adopted");
  assert(contract.delivery.quality === 88, "approved WebP quality drifted");
  assert(Object.values(contract.invariants).every((value) => value === true || typeof value === "number"), "invariants incomplete");
  assert(contract.examples.pass.length >= 3 && contract.examples.fail.length >= 4, "representative pass/fail examples incomplete");

  const lightFile = await validateAsset(contract.light.canonicalAsset, contract.light.sha256, contract);
  const darkFile = await validateAsset(contract.dark.canonicalAsset, contract.dark.sha256, contract);
  const lightMetrics = await metrics(lightFile, contract.measurementWidth);
  for (const [name, range] of Object.entries(contract.light.ranges)) {
    const value = lightMetrics[name as keyof typeof lightMetrics];
    assert(typeof value === "number" && inRange(value, range), `light reference ${name}=${value} outside ${range.join("–")}`);
  }
  const darkMetrics = await metrics(darkFile, contract.measurementWidth);
  assert(darkMetrics.toneRange >= contract.dark.canonicalToneRangeMin, "dark reference lost required tone contrast");

  const report = JSON.parse(await readFile(path.join(root, contract.dark.report), "utf8"));
  const summary = report.summary;
  assert(summary.strength === contract.dark.recipe.strength, "batch strength drifted");
  assert(summary.params.saturation === contract.dark.recipe.saturation, "batch saturation drifted");
  assert(summary.params.hue === contract.dark.recipe.hueDegrees, "batch hue drifted");
  assert(summary.params.brightness === contract.dark.recipe.brightness, "batch brightness drifted");
  assert(inRange(summary.afterSatMean, contract.dark.corpusRanges.meanSat), "corpus saturation outside contract");
  assert(inRange(summary.afterOrangeMean, contract.dark.corpusRanges.orangeFrac), "corpus warmth outside contract");

  console.log(`Engraving color contract valid: ${contract.contract}; canonical light/dark anchors and ${summary.count} graded assets match.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
