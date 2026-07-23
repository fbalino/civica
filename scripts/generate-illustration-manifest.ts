import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  DARK_ENGRAVING_CAPTIONS,
  ENGRAVING_CAPTIONS,
} from "../src/lib/data/engraving-captions";
import {
  DARK_TERRITORY_ENGRAVING_CAPTIONS,
  TERRITORY_ENGRAVING_CAPTIONS,
} from "../src/lib/data/territory-engraving-captions";
import {
  EDITORIAL_ILLUSTRATION_RIGHTS_EFFECTIVE_ON,
  EDITORIAL_ILLUSTRATION_RIGHTS_POLICY,
  EDITORIAL_ILLUSTRATION_RIGHTS_VERSION,
} from "../src/lib/illustrations/rights-policy";

const root = process.cwd();
const assetRoot = path.join(root, "public/engravings");
const outputFile = path.join(root, "src/lib/illustrations/illustration-manifest.generated.json");

const PAGE_SUBJECTS: Record<string, { subject: string; routes: string[] }> = {
  about: { subject: "Classical civic architecture and archival research motifs", routes: ["/about"] },
  atlas: { subject: "World atlas and comparative reference motifs", routes: ["/atlas"] },
  compare: { subject: "Paired columns and comparative-research motifs", routes: ["/compare"] },
  countries: { subject: "World landmarks and country-reference motifs", routes: ["/country"] },
  index: { subject: "Measurement, scales, and governance-research motifs", routes: ["/civica-index", "/design-system"] },
  methodology: { subject: "Books, instruments, and research-method motifs", routes: ["/methodology"] },
  record: { subject: "Editorial archive and written-record motifs", routes: ["/blog"] },
};

const SHARED_SUBJECTS: Record<string, { subject: string; routes: string[] }> = {
  hero: { subject: "Classical civic landscape and atlas motifs", routes: ["/", "/constitution", "/rankings", "/elections", "/governance-evidence", "/compare", "global-mobile-navigation"] },
  "footer-trust": { subject: "Institutional architecture used as a footer trust-band texture", routes: ["global-footer"] },
  "trusted-source-logos": { subject: "Raster strip naming trusted data publishers", routes: ["global-footer"] },
  "spot-column": { subject: "Classical column editorial motif", routes: ["/", "explore-navigation"] },
  "spot-compass": { subject: "Compass editorial motif", routes: ["/not-found", "explore-navigation"] },
  "spot-globe": { subject: "Globe editorial motif", routes: ["/", "explore-navigation"] },
  "spot-laurel": { subject: "Laurel editorial motif", routes: ["explore-navigation"] },
  "spot-mountains": { subject: "Mountain landscape editorial motif", routes: ["explore-navigation"] },
  "spot-ship": { subject: "Historical ship editorial motif", routes: ["explore-navigation"] },
};

type GitIntroduction = { commit: string; committedAt: string };

function gitIntroductions() {
  const output = execFileSync(
    "git",
    ["log", "--reverse", "--diff-filter=A", "--format=COMMIT%x09%H%x09%aI", "--name-only", "--", "public/engravings"],
    { cwd: root, encoding: "utf8" },
  );
  const introductions = new Map<string, GitIntroduction>();
  let current: GitIntroduction | null = null;
  for (const line of output.split("\n")) {
    if (line.startsWith("COMMIT\t")) {
      const [, commit, committedAt] = line.split("\t");
      current = { commit, committedAt };
    } else if (current && line.startsWith("public/engravings/") && !introductions.has(line)) {
      introductions.set(line, current);
    }
  }
  return introductions;
}

async function assetFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await assetFiles(full)));
    else if (entry.name.endsWith(".webp")) files.push(full);
  }
  return files.sort();
}

function identity(relative: string) {
  const directory = path.posix.dirname(relative);
  const filename = path.posix.basename(relative, ".webp");
  const dark = filename.endsWith("-dark");
  const key = dark ? filename.slice(0, -5) : filename;
  const category = directory.endsWith("/countries")
    ? "country"
    : directory.endsWith("/territories")
      ? "territory"
      : directory.endsWith("/pages")
        ? "page"
        : "shared";
  return { category, key, theme: dark ? "dark" : "light", filename } as const;
}

function descriptiveFields(category: string, key: string, theme: "light" | "dark") {
  if (category === "country") {
    return {
      entity: { type: "country", idScheme: "iso3-lowercase", id: key },
      routes: ["/country/{slug}"],
      subject: theme === "dark" ? DARK_ENGRAVING_CAPTIONS[key] ?? ENGRAVING_CAPTIONS[key] : ENGRAVING_CAPTIONS[key],
    };
  }
  if (category === "territory") {
    return {
      entity: { type: "territory-or-special-jurisdiction", idScheme: "country-route-slug", id: key },
      routes: [`/country/${key}`],
      subject: theme === "dark" ? DARK_TERRITORY_ENGRAVING_CAPTIONS[key] ?? TERRITORY_ENGRAVING_CAPTIONS[key] : TERRITORY_ENGRAVING_CAPTIONS[key],
    };
  }
  const mapping = category === "page" ? PAGE_SUBJECTS[key] : SHARED_SUBJECTS[key];
  return {
    entity: { type: category === "page" ? "page" : "shared-component", idScheme: "civica-illustration-key", id: key },
    routes: mapping?.routes ?? ["unmapped-shared-surface"],
    subject: mapping?.subject ?? `Editorial motif: ${key}`,
  };
}

async function buildManifest() {
  const introductions = gitIntroductions();
  const files = await assetFiles(assetRoot);
  const fileSet = new Set(files.map((file) => path.relative(root, file).split(path.sep).join("/")));
  const assets = [];
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const { category, key, theme } = identity(relative);
    const pairRelative = relative.replace(theme === "dark" ? /-dark\.webp$/ : /\.webp$/, theme === "dark" ? ".webp" : "-dark.webp");
    const bytes = await readFile(file);
    const metadata = await sharp(bytes).metadata();
    const description = descriptiveFields(category, key, theme);
    const introduction = introductions.get(relative);
    const countryGrade = category === "country" && theme === "dark" && key !== "gbr";
    const deterministicLogoStrip = relative.includes("trusted-source-logos");
    assets.push({
      id: `${category}:${key}:${theme}`,
      path: relative,
      publicUrl: `/${relative.replace(/^public\//, "")}`,
      category,
      theme,
      pairId: fileSet.has(pairRelative) ? `${category}:${key}:${theme === "dark" ? "light" : "dark"}` : null,
      ...description,
      caption: description.subject ?? null,
      file: {
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        format: metadata.format ?? null,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        aspectRatio: metadata.width && metadata.height ? Number((metadata.width / metadata.height).toFixed(6)) : null,
        colorSpace: metadata.space ?? null,
      },
      origin: {
        classification: deterministicLogoStrip ? "deterministic-raster-composition" : "ai-assisted-editorial-illustration",
        model: deterministicLogoStrip ? "not-applicable" : "unknown-not-retained",
        tool: "unknown-not-retained",
        prompt: deterministicLogoStrip ? "not-applicable" : "unknown-not-retained",
        sourceReferences: "unknown-not-retained",
        provenanceStatus: deterministicLogoStrip
          ? "partial-composition-session-not-retained"
          : "partial-irrecoverable-generation-session",
        firstTrackedCommit: introduction?.commit ?? null,
        firstTrackedAt: introduction?.committedAt ?? null,
      },
      editHistory: countryGrade
        ? [{ method: "civica-engraving-color/v1-strength-60", date: "2026-07-12", evidence: "plan/evidence/EXP-006/corpus-batch-s60-report.json" }]
        : [],
      rights: {
        disclosure: "AI-assisted illustration; illustrative and non-documentary",
        policy: "/licensing#imagery",
        sourceEvidence: false,
      },
      qa: {
        fileIntegrity: metadata.format === "webp" && Boolean(metadata.width && metadata.height) ? "pass" : "fail",
        captionCoverage: description.subject ? "pass" : "fail",
        colorContract: countryGrade ? "strength-60-batch-pass" : category === "country" && theme === "dark" && key === "gbr" ? "known-family-outlier" : "not-applicable-or-not-yet-audited",
        semanticLandmarkReview: ["fra", "gbr"].includes(key) && category === "country" ? "known-review-required" : "not-systematically-reverified",
      },
    });
  }
  return {
    contract: "civica-editorial-illustration-manifest/v1",
    releaseDate: "2026-07-12",
    scope: "Every tracked WebP below public/engravings; README and non-WebP source files are excluded.",
    rightsPolicy: {
      version: EDITORIAL_ILLUSTRATION_RIGHTS_VERSION,
      effectiveOn: EDITORIAL_ILLUSTRATION_RIGHTS_EFFECTIVE_ON,
      operatorPolicy: "data/EDITORIAL-ILLUSTRATION-RIGHTS.md",
      publicDisclosure: "/licensing#imagery",
      thirdPartyReuse: EDITORIAL_ILLUSTRATION_RIGHTS_POLICY.thirdPartyReuse,
    },
    retention: {
      history: "git-and-frozen-release-snapshots",
      replacement: "superseding-record-or-tombstone",
      publicSecretsOrUnlicensedReferenceBytes: "prohibited",
    },
    limitations: [
      "Original generation sessions did not retain model, tool, prompt, seed, or source-reference metadata; those fields remain unknown rather than inferred.",
      "A caption identifies intended subject matter but is not evidence that every depicted landmark detail has been independently verified.",
      "Git introduction records first repository capture, not the image-generation time.",
    ],
    summary: {
      assetCount: assets.length,
      countryAssets: assets.filter((asset) => asset.category === "country").length,
      territoryAssets: assets.filter((asset) => asset.category === "territory").length,
      pageAssets: assets.filter((asset) => asset.category === "page").length,
      sharedAssets: assets.filter((asset) => asset.category === "shared").length,
      missingPairs: assets.filter((asset) => asset.pairId === null).length,
      missingCaptions: assets.filter((asset) => !asset.caption).length,
      irrecoverableGenerationSessions: assets.filter((asset) => asset.origin.provenanceStatus === "partial-irrecoverable-generation-session").length,
    },
    assets,
  };
}

async function main() {
  const manifest = await buildManifest();
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (process.argv.includes("--write")) {
    await writeFile(outputFile, serialized, "utf8");
    console.log(`Wrote ${path.relative(root, outputFile)} with ${manifest.summary.assetCount} assets.`);
    return;
  }
  const current = await readFile(outputFile, "utf8");
  if (current !== serialized) throw new Error("illustration manifest drifted; run npm run generate:illustration-manifest");
  if (manifest.summary.missingPairs || manifest.summary.missingCaptions) throw new Error(`manifest incomplete: ${manifest.summary.missingPairs} missing pairs, ${manifest.summary.missingCaptions} missing captions`);
  console.log(`Illustration manifest valid: ${manifest.summary.assetCount} assets, complete pairs and captions.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
