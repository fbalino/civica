import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ENGRAVING_CAPTIONS } from "../src/lib/data/engraving-captions";
import { validateCountryEngravingInventory, type CountryEngravingAsset } from "../src/lib/illustrations/country-engraving-validation";

type ManifestAsset = {
  id: string;
  path: string;
  category: string;
  caption: string | null;
  file: { bytes: number; width: number | null; height: number | null };
  qa: { colorContract: string | null };
};

const root = process.cwd();

async function main() {
  const directory = path.join(root, "public/engravings/countries");
  const filenames = (await readdir(directory)).sort();
  const manifest = JSON.parse(await readFile(path.join(root, "src/lib/illustrations/illustration-manifest.generated.json"), "utf8"));
  const manifestRows = new Map<string, ManifestAsset>(
    manifest.assets.filter((asset: ManifestAsset) => asset.category === "country").map((asset: ManifestAsset) => [asset.path, asset]),
  );
  const assets: CountryEngravingAsset[] = [];
  for (const filename of filenames) {
    const relative = `public/engravings/countries/${filename}`;
    if (!filename.endsWith(".webp")) {
      assets.push({ path: relative, bytes: 0, width: null, height: null, caption: null, manifestId: null, colorContract: null });
      continue;
    }
    const file = path.join(directory, filename);
    const metadata = await sharp(file).metadata();
    const row = manifestRows.get(relative);
    assets.push({
      path: relative,
      bytes: (await readFile(file)).length,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      caption: row?.caption ?? null,
      manifestId: row?.id ?? null,
      colorContract: row?.qa.colorContract ?? null,
    });
  }
  const layoutSource = await readFile(path.join(root, "src/app/(reader)/country/[slug]/layout.tsx"), "utf8");
  const errors = validateCountryEngravingInventory({ assets, captionKeys: Object.keys(ENGRAVING_CAPTIONS), rawFallbackSource: layoutSource });
  if (manifestRows.size !== assets.length) errors.push(`manifest/file count mismatch: ${manifestRows.size}/${assets.length}`);
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }
  console.log(`Country engravings valid: ${assets.length} WebPs, ${assets.length / 2} complete pairs, captions/manifest/color states present, no raw fallback.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
