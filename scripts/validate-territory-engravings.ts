import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { config } from "dotenv";
import { asc, isNull } from "drizzle-orm";

config({ path: ".env.local", override: true, quiet: true });

import { db } from "../src/lib/db";
import { jurisdictions } from "../src/lib/db/schema";

const EXPECTED_WIDTH = 1500;
const EXPECTED_HEIGHT = 1000;
const TERRITORY_ENGRAVINGS_DIR = path.join(
  process.cwd(),
  "public",
  "engravings",
  "territories",
);

type AssetTone = "light" | "dark";

interface Issue {
  slug: string;
  tone: AssetTone;
  path: string;
  message: string;
}

const TONES: AssetTone[] = ["light", "dark"];

function hasIdentify(): boolean {
  const result = spawnSync("identify", ["-version"], { stdio: "ignore" });
  return result.status === 0;
}

function relativeAssetPath(assetPath: string): string {
  return path.relative(process.cwd(), assetPath);
}

function assetPathFor(slug: string, tone: AssetTone): string {
  const suffix = tone === "dark" ? "-dark" : "";
  return path.join(TERRITORY_ENGRAVINGS_DIR, `${slug}${suffix}.webp`);
}

function inspectImage(assetPath: string): { format: string; width: number; height: number } {
  const output = execFileSync(
    "identify",
    ["-format", "%m %w %h", assetPath],
    { encoding: "utf8" },
  ).trim();
  const [format, width, height] = output.split(/\s+/);

  return {
    format,
    width: Number(width),
    height: Number(height),
  };
}

function validateAsset(slug: string, tone: AssetTone, identifyAvailable: boolean): Issue | null {
  const assetPath = assetPathFor(slug, tone);
  const displayPath = relativeAssetPath(assetPath);

  if (!existsSync(assetPath)) {
    return {
      slug,
      tone,
      path: displayPath,
      message: "missing",
    };
  }

  if (!identifyAvailable) return null;

  try {
    const image = inspectImage(assetPath);
    const isExpected =
      image.format === "WEBP" &&
      image.width === EXPECTED_WIDTH &&
      image.height === EXPECTED_HEIGHT;

    if (isExpected) return null;

    return {
      slug,
      tone,
      path: displayPath,
      message: `${image.format} ${image.width}x${image.height}; expected WEBP ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    };
  } catch (error) {
    return {
      slug,
      tone,
      path: displayPath,
      message: `identify failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function printSlugList(label: string, slugs: string[]) {
  if (!slugs.length) return;
  console.log(`${label}: ${slugs.length}`);

  for (let i = 0; i < slugs.length; i += 8) {
    console.log(`  ${slugs.slice(i, i + 8).join(", ")}`);
  }
}

function printIssues(issues: Issue[]) {
  const missingBySlug = new Map<string, Set<AssetTone>>();
  const metadataIssues: Issue[] = [];

  for (const issue of issues) {
    if (issue.message === "missing") {
      const tones = missingBySlug.get(issue.slug) ?? new Set<AssetTone>();
      tones.add(issue.tone);
      missingBySlug.set(issue.slug, tones);
    } else {
      metadataIssues.push(issue);
    }
  }

  const missingBoth: string[] = [];
  const missingLight: string[] = [];
  const missingDark: string[] = [];

  for (const [slug, tones] of [...missingBySlug.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (tones.has("light") && tones.has("dark")) {
      missingBoth.push(slug);
    } else if (tones.has("light")) {
      missingLight.push(slug);
    } else if (tones.has("dark")) {
      missingDark.push(slug);
    }
  }

  printSlugList("Missing light+dark pairs", missingBoth);
  printSlugList("Missing light only", missingLight);
  printSlugList("Missing dark only", missingDark);

  if (metadataIssues.length) {
    console.log(`Wrong metadata: ${metadataIssues.length}`);
    for (const issue of metadataIssues) {
      console.log(`  ${issue.slug} ${issue.tone}: ${issue.path} (${issue.message})`);
    }
  }
}

async function main() {
  const territoryRows = await db
    .select({
      slug: jurisdictions.slug,
    })
    .from(jurisdictions)
    .where(isNull(jurisdictions.iso3))
    .orderBy(asc(jurisdictions.slug));

  const identifyAvailable = hasIdentify();
  const issues: Issue[] = [];

  for (const row of territoryRows) {
    for (const tone of TONES) {
      const issue = validateAsset(row.slug, tone, identifyAvailable);
      if (issue) issues.push(issue);
    }
  }

  const expectedAssets = territoryRows.length * 2;
  const checkedLabel = identifyAvailable
    ? `metadata checked with ImageMagick identify`
    : `metadata skipped; ImageMagick identify not found`;

  console.log("Territory engraving validation");
  console.log(`Territories: ${territoryRows.length}`);
  console.log(`Assets expected: ${expectedAssets} (${checkedLabel})`);
  console.log(`Issues: ${issues.length}`);

  if (issues.length) {
    printIssues(issues);
    process.exitCode = 1;
    return;
  }

  console.log(`OK: every asset is present${identifyAvailable ? " and WEBP 1500x1000" : ""}.`);
}

main().catch((error) => {
  console.error("Territory engraving validation failed:", error);
  process.exit(1);
});
