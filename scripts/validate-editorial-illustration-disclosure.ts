/**
 * CLM-014 editorial-illustration disclosure validator. Deterministic,
 * DB-free, network-free.
 *
 *   Run with: npm run validate:editorial-illustrations
 *
 * Checks three surfaces against the rules in
 * src/lib/illustrations/editorial-illustration-disclosure.ts:
 *
 *   1. `/licensing#imagery` — the canonical policy section must disclose
 *      non-documentary nature, tools, honest (incomplete) records posture,
 *      human/automated QA posture, a correction path, and conservative
 *      reuse rights — and must not contain documentary-photography
 *      language, a permissive reuse grant, or a false complete-manifest /
 *      complete-QA claim.
 *   2. The About page's imagery pointer — must link to /licensing#imagery,
 *      name the illustrations as AI-assisted, and stay a short pointer
 *      rather than duplicating the full policy.
 *   3. The country/territory hero caption component — the disclosure must
 *      render whenever an engraving image exists (never gated on the
 *      landmark caption text), carry the "Editorial engraving" label, and
 *      link "AI-assisted illustration" to /licensing#imagery with real
 *      hover/focus styling and a pointer-events fix.
 *
 * This validator is intentionally decoupled from the UI slice that
 * implements the disclosure: it reads the real source files and reports
 * whatever it finds. If the UI hasn't landed yet, or drifts from the
 * contract below, this fails loudly rather than being weakened to pass.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  checkAboutImageryPointer,
  checkCaptionLinkStyling,
  checkCountryCaptionDisclosure,
  checkLicensingImagerySection,
  checkPageHeroDisclosure,
  extractParagraphContaining,
  extractSectionById,
  type DisclosureIssue,
} from "../src/lib/illustrations/editorial-illustration-disclosure";

const ROOT = process.cwd();

const LICENSING_PAGE = "src/app/licensing/page.tsx";
const ABOUT_CONTENT = "content/about.md";
const COUNTRY_CAPTION_COMPONENT = "src/components/factbook/FactbookHeaderStrip.tsx";
const CAPTION_STYLESHEET = "src/app/factbook.css";
const PAGE_HERO_COMPONENT = "src/components/PageHero.tsx";
const ILLUSTRATION_MANIFEST = "src/lib/illustrations/illustration-manifest.generated.json";
const CAPTION_LINK_CLASS = "factbook-hero-caption-link";
const ABOUT_POINTER_NEEDLE = "/licensing#imagery";

async function readFile(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.resolve(ROOT, relativePath), "utf8");
  } catch {
    return null;
  }
}

function printIssues(label: string, issues: DisclosureIssue[]): void {
  if (issues.length === 0) {
    console.log(`  OK  ${label}`);
    return;
  }
  console.log(`  FAIL  ${label} (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
  for (const issue of issues) {
    console.log(`    - [${issue.ruleId}] ${issue.description}`);
    if (issue.match) console.log(`      matched: ${JSON.stringify(issue.match)}`);
  }
}

async function main(): Promise<void> {
  const [licensingSource, aboutSource, captionComponentSource, captionStylesheet, pageHeroSource, manifestSource] =
    await Promise.all([
      readFile(LICENSING_PAGE),
      readFile(ABOUT_CONTENT),
      readFile(COUNTRY_CAPTION_COMPONENT),
      readFile(CAPTION_STYLESHEET),
      readFile(PAGE_HERO_COMPONENT),
      readFile(ILLUSTRATION_MANIFEST),
    ]);

  let assetManifestCoverageProven = false;
  if (manifestSource) {
    const manifest = JSON.parse(manifestSource);
    assetManifestCoverageProven =
      manifest.contract === "civica-editorial-illustration-manifest/v1" &&
      manifest.summary?.assetCount === manifest.assets?.length &&
      manifest.summary?.missingPairs === 0 &&
      manifest.summary?.missingCaptions === 0;
  }

  const allIssues: DisclosureIssue[] = [];

  console.log("CLM-014 editorial-illustration disclosure\n");

  if (licensingSource === null) {
    const issue: DisclosureIssue = {
      surface: "licensing-imagery",
      ruleId: "missing-licensing-page",
      description: `${LICENSING_PAGE} does not exist.`,
    };
    printIssues(`${LICENSING_PAGE} (#imagery)`, [issue]);
    allIssues.push(issue);
  } else {
    const imagerySection = extractSectionById(licensingSource, "imagery");
    const issues = checkLicensingImagerySection(imagerySection, {
      assetManifestCoverageProven,
      completeGenerationRecords: false,
    });
    printIssues(`${LICENSING_PAGE} (#imagery)`, issues);
    allIssues.push(...issues);
  }

  if (pageHeroSource === null) {
    const issue: DisclosureIssue = {
      surface: "page-hero-disclosure",
      ruleId: "missing-page-hero-component",
      description: `${PAGE_HERO_COMPONENT} does not exist.`,
    };
    printIssues(PAGE_HERO_COMPONENT, [issue]);
    allIssues.push(issue);
  } else {
    const issues = checkPageHeroDisclosure(pageHeroSource);
    printIssues(PAGE_HERO_COMPONENT, issues);
    allIssues.push(...issues);
  }

  if (aboutSource === null) {
    const issue: DisclosureIssue = {
      surface: "about-pointer",
      ruleId: "missing-about-content",
      description: `${ABOUT_CONTENT} does not exist.`,
    };
    printIssues(ABOUT_CONTENT, [issue]);
    allIssues.push(issue);
  } else {
    const pointerParagraph = extractParagraphContaining(aboutSource, ABOUT_POINTER_NEEDLE);
    const issues = checkAboutImageryPointer(pointerParagraph);
    printIssues(ABOUT_CONTENT, issues);
    allIssues.push(...issues);
  }

  if (captionComponentSource === null) {
    const issue: DisclosureIssue = {
      surface: "country-caption",
      ruleId: "missing-caption-component",
      description: `${COUNTRY_CAPTION_COMPONENT} does not exist.`,
    };
    printIssues(COUNTRY_CAPTION_COMPONENT, [issue]);
    allIssues.push(issue);
  } else {
    const issues = checkCountryCaptionDisclosure(captionComponentSource);
    printIssues(COUNTRY_CAPTION_COMPONENT, issues);
    allIssues.push(...issues);
  }

  if (captionStylesheet === null) {
    const issue: DisclosureIssue = {
      surface: "caption-styling",
      ruleId: "missing-caption-stylesheet",
      description: `${CAPTION_STYLESHEET} does not exist.`,
    };
    printIssues(CAPTION_STYLESHEET, [issue]);
    allIssues.push(issue);
  } else {
    const issues = checkCaptionLinkStyling(captionStylesheet, CAPTION_LINK_CLASS);
    printIssues(`${CAPTION_STYLESHEET} (.${CAPTION_LINK_CLASS})`, issues);
    allIssues.push(...issues);
  }

  console.log(
    `\n${allIssues.length === 0 ? "PASS" : "FAIL"} — ${allIssues.length} issue${allIssues.length === 1 ? "" : "s"} across licensing, about, page-hero, and country/territory-caption surfaces.`,
  );

  if (allIssues.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
