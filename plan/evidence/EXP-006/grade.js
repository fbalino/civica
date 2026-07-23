// eslint-disable-next-line @typescript-eslint/no-require-imports -- this standalone CommonJS evidence utility is invoked directly by Node.
const sharp = require('/Users/fernandobalino/Projects/civica/node_modules/sharp');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- this standalone CommonJS evidence utility is invoked directly by Node.
const path = require('path');

// Deterministic de-orange grading recipes for dark engravings (EXP-006 pilot).
// A: global desaturate + slight hue cool (cheap baseline)
// B: split-tone — cool graphite base, gold restored in highlights only
// C: split-tone, warmer mids retained (higher mask reach, warmer gold)
const RECIPES = {
  A: { kind: 'modulate', saturation: 0.45, hue: -10, brightness: 1.02 },
  B: { kind: 'split', cool: { r: 176, g: 184, b: 202 }, warm: { r: 224, g: 178, b: 110 }, maskSlope: 2.6, maskOffset: -220 },
  C: { kind: 'split', cool: { r: 184, g: 188, b: 200 }, warm: { r: 232, g: 190, b: 120 }, maskSlope: 2.0, maskOffset: -150 },
};

async function grade(input, output, recipe) {
  const base = sharp(input);
  if (recipe.kind === 'modulate') {
    await base.modulate({ saturation: recipe.saturation, hue: recipe.hue, brightness: recipe.brightness }).webp({ quality: 88 }).toFile(output);
    return;
  }
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
  const gray = await sharp(data, { raw: info }).grayscale().raw().toBuffer();
  // Luma-preserving duotone layers via tint, from the grayscale
  const grayPng = await sharp(gray, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
  const cool = await sharp(grayPng).tint(recipe.cool).raw().toBuffer();
  const warm = await sharp(grayPng).tint(recipe.warm).raw().toBuffer();
  // Highlight mask from luma: linear boost then clamp
  const mask = Buffer.alloc(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i] * recipe.maskSlope + recipe.maskOffset;
    mask[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  // Blend: out = cool*(1-m) + warm*m, per pixel
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let p = 0, q = 0; p < gray.length; p++, q += 3) {
    const m = mask[p] / 255;
    out[q] = cool[q] * (1 - m) + warm[q] * m;
    out[q + 1] = cool[q + 1] * (1 - m) + warm[q + 1] * m;
    out[q + 2] = cool[q + 2] * (1 - m) + warm[q + 2] * m;
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 88 }).toFile(output);
}

// Metrics: fraction of pixels that are "strong orange" (hue 20-55deg, sat>0.25, val>0.08) + mean saturation
async function metrics(file) {
  const { data, info } = await sharp(file).resize(400).raw().toBuffer({ resolveWithObject: true });
  let orange = 0, satSum = 0, n = 0;
  for (let q = 0; q < data.length; q += info.channels) {
    const r = data[q] / 255, g = data[q + 1] / 255, b = data[q + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const s = max === 0 ? 0 : d / max;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    if (h >= 20 && h <= 55 && s > 0.25 && max > 0.08) orange++;
    satSum += s; n++;
  }
  return { orangeFrac: +(orange / n).toFixed(4), meanSat: +(satSum / n).toFixed(4) };
}

(async () => {
  const [cmd, ...isos] = process.argv.slice(2);
  const outDir = process.env.OUT || path.dirname(process.argv[1]);
  for (const iso of isos) {
    const src = `public/engravings/countries/${iso}-dark.webp`;
    const which = cmd === 'all' ? Object.keys(RECIPES) : [cmd];
    for (const key of which) {
      const out = `${outDir}/${iso}-dark.${key}.webp`;
      await grade(src, out, RECIPES[key]);
      const before = await metrics(src);
      const after = await metrics(out);
      console.log(JSON.stringify({ iso, recipe: key, before, after }));
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
