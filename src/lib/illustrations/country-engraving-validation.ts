export type CountryEngravingAsset = {
  path: string;
  bytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  manifestId: string | null;
  colorContract: string | null;
};

export type CountryEngravingValidationInput = {
  assets: CountryEngravingAsset[];
  captionKeys: string[];
  rawFallbackSource: string;
};

const MIN_BYTES = 75_000;
const MAX_BYTES = 750_000;
const ALLOWED_DIMENSIONS = new Set(["1500x1000", "1536x1024"]);

function parsedName(file: string) {
  const match = file.match(/^public\/engravings\/countries\/([a-z]{3})(-dark)?\.webp$/);
  return match ? { key: match[1], theme: match[2] ? "dark" : "light" } : null;
}

export function validateCountryEngravingInventory(input: CountryEngravingValidationInput) {
  const errors: string[] = [];
  const paths = new Set<string>();
  const variants = new Map<string, Set<string>>();
  const captionKeys = new Set(input.captionKeys);

  for (const asset of input.assets) {
    if (paths.has(asset.path)) errors.push(`${asset.path}: duplicate manifest/file row`);
    paths.add(asset.path);
    const parsed = parsedName(asset.path);
    if (!parsed) {
      errors.push(`${asset.path}: must be lowercase ISO3 light/dark WebP`);
      continue;
    }
    const themes = variants.get(parsed.key) ?? new Set<string>();
    themes.add(parsed.theme);
    variants.set(parsed.key, themes);
    if (asset.bytes < MIN_BYTES || asset.bytes > MAX_BYTES) errors.push(`${asset.path}: ${asset.bytes} bytes outside ${MIN_BYTES}–${MAX_BYTES}`);
    if (!asset.width || !asset.height || !ALLOWED_DIMENSIONS.has(`${asset.width}x${asset.height}`)) errors.push(`${asset.path}: unsupported dimensions ${asset.width}x${asset.height}`);
    if (asset.width && asset.height && Math.abs(asset.width / asset.height - 1.5) > 0.0001) errors.push(`${asset.path}: aspect ratio is not 3:2`);
    if (!asset.caption) errors.push(`${asset.path}: caption missing`);
    if (!asset.manifestId) errors.push(`${asset.path}: illustration manifest row missing`);
    if (parsed.theme === "dark") {
      const accepted = asset.colorContract === "strength-60-batch-pass" || (parsed.key === "gbr" && asset.colorContract === "known-family-outlier");
      if (!accepted) errors.push(`${asset.path}: dark color-contract state is not accepted`);
    }
  }

  for (const [key, themes] of variants) {
    if (!themes.has("light") || !themes.has("dark")) errors.push(`${key}: exact light/dark pair missing`);
    if (!captionKeys.has(key)) errors.push(`${key}: country caption registry entry missing`);
  }
  for (const key of captionKeys) {
    if (!variants.has(key)) errors.push(`${key}: caption exists without an engraving pair`);
  }
  if (/engravings[\s\S]{0,500}\.png|\.png[\s\S]{0,500}engravings/.test(input.rawFallbackSource)) {
    errors.push("country route retains a raw PNG engraving fallback");
  }
  return errors;
}

export const COUNTRY_ENGRAVING_BOUNDS = Object.freeze({
  minBytes: MIN_BYTES,
  maxBytes: MAX_BYTES,
  dimensions: [...ALLOWED_DIMENSIONS],
  aspectRatio: "3:2",
});
