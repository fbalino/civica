import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkAboutImageryPointer,
  checkCaptionLinkStyling,
  checkCountryCaptionDisclosure,
  checkLicensingImagerySection,
  checkPageHeroDisclosure,
  extractParagraphContaining,
  extractSectionById,
  findDocumentaryLanguage,
  findFalseCompleteManifestClaim,
  findFalseCompleteQaClaim,
  findPermissiveReuseGrant,
} from "../editorial-illustration-disclosure";

// ---------------------------------------------------------------------------
// Fixtures. PASSING_* fixtures describe the exact structural/text contract
// the UI slice must implement; FAILING_* fixtures each violate exactly one
// rule so a fix to one never silently masks another.
// ---------------------------------------------------------------------------

const PASSING_LICENSING_SECTION = `
      <section id="imagery" className="editorial-section">
        <SectionHeader
          eyebrow="Imagery"
          title="Country and territory engravings"
          dek="Civica's hero engravings are AI-assisted editorial illustrations, not documentary photographs."
        />

        <p>
          These images are AI-assisted editorial illustrations produced for
          Civica's almanac design language — they are not photographs.
        </p>

        <p>
          Civica does not currently retain a complete per-asset generation
          record for the launch corpus of country and territory engravings.
          Assets created or replaced going forward retain that record.
        </p>

        <p>
          Automated checks currently cover defined technical properties.
          Human visual review of what each engraving depicts is being
          strengthened over time; it is not yet complete or independently
          audited. If you notice a wrong landmark, use the contact form and
          we will investigate and correct it.
        </p>

        <p>
          Display of these engravings on Civica Atlas is authorized by
          Civica. Civica does not currently grant a separate license for
          third-party reuse of editorial illustrations outside the site.
        </p>
      </section>

      <section id="code" className="editorial-section">
        <p>Repository terms.</p>
      </section>
`;

const PASSING_LICENSING_PAGE = `
export default function LicensingPage() {
  return (
    <EditorialPage title="Licensing">
      <section id="source-licenses" className="editorial-section">
        <p>Source license summary.</p>
      </section>
${PASSING_LICENSING_SECTION}
    </EditorialPage>
  );
}
`;

const PASSING_ABOUT_MD = `## Open and free {#open-and-free}

Civica Atlas is built to be a free, open reference.

Country and territory hero images are AI-assisted editorial illustrations, not photographs; see the [imagery policy](/licensing#imagery) for tools, records, review, and reuse rights.

## Next section {#next}

More prose here.
`;

const PASSING_CAPTION_COMPONENT = `
        {engravingSrc && (
          <figure className="factbook-hero-art-figure">
            <ParallaxImage
              className="factbook-hero-art-img"
              src={engravingSrc}
              darkSrc={engravingDarkSrc}
              alt=""
            />
            <figcaption className="factbook-hero-caption">
            <span className="factbook-hero-caption-label">Editorial engraving</span>
            {heroCaption ? (
              <span className="factbook-hero-caption-text">{heroCaption}</span>
            ) : null}
            <Link href="/licensing#imagery" className="factbook-hero-caption-link" aria-label="AI-assisted illustration; non-documentary editorial art">
              AI-assisted illustration
            </Link>
            </figcaption>
          </figure>
        )}
`;

const PASSING_PAGE_HERO = `
  {engraving ? (
    <ParallaxImage alt="" aria-hidden="true" src={engraving.src} />
  ) : null}
  {engraving ? (
    <HeroRevealItem className="page-hero-art-disclosure">
      <span>Editorial illustration</span>
      <Link href="/licensing#imagery">AI-assisted, non-documentary</Link>
    </HeroRevealItem>
  ) : null}
`;

const PASSING_CAPTION_CSS = `
.factbook-hero-caption {
  pointer-events: none;
}
.factbook-hero-caption-link {
  pointer-events: auto;
  color: var(--color-text-50);
}
.factbook-hero-caption-link:hover {
  color: var(--color-accent);
}
.factbook-hero-caption-link:focus-visible {
  outline: 2px solid var(--color-accent);
}
`;

// ---------------------------------------------------------------------------
// extractSectionById / extractParagraphContaining
// ---------------------------------------------------------------------------

test("extractSectionById finds the section and stops at the next sibling section", () => {
  const section = extractSectionById(PASSING_LICENSING_PAGE, "imagery");
  assert.ok(section);
  assert.match(section!, /Editorial illustrations|editorial illustrations/);
  assert.doesNotMatch(section!, /id="code"/);
});

test("extractSectionById returns null when the id is absent", () => {
  assert.equal(extractSectionById(PASSING_LICENSING_PAGE, "missing-id"), null);
});

test("extractParagraphContaining scopes to the blank-line-delimited paragraph", () => {
  const paragraph = extractParagraphContaining(PASSING_ABOUT_MD, "/licensing#imagery");
  assert.ok(paragraph);
  assert.match(paragraph!, /^Country and territory hero images/);
  assert.doesNotMatch(paragraph!, /Open and free/);
});

test("extractParagraphContaining returns null when the needle is absent", () => {
  assert.equal(extractParagraphContaining(PASSING_ABOUT_MD, "/nonexistent"), null);
});

// ---------------------------------------------------------------------------
// checkLicensingImagerySection — the passing fixture must be issue-free
// ---------------------------------------------------------------------------

test("checkLicensingImagerySection accepts the full passing policy", () => {
  const section = extractSectionById(PASSING_LICENSING_PAGE, "imagery");
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.deepEqual(issues, []);
});

test("checkLicensingImagerySection reports a missing anchor as a single clear issue", () => {
  const issues = checkLicensingImagerySection(null, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "missing-imagery-anchor");
});

test("checkLicensingImagerySection flags a missing tools statement", () => {
  const section = PASSING_LICENSING_SECTION.replaceAll("AI-assisted", "computer-assisted");
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(issues.some((i) => i.ruleId === "missing-tools-statement"), JSON.stringify(issues));
});

test("checkLicensingImagerySection flags a missing records-incompleteness disclosure", () => {
  const section = PASSING_LICENSING_SECTION.replace(
    /Civica does not currently retain a complete per-asset generation\s*\n\s*record for the launch corpus of country and territory engravings\.\s*\n\s*Assets created or replaced going forward retain that record\./,
    "Civica retains generation records for its engravings.",
  );
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(
    issues.some((i) => i.ruleId === "missing-records-incompleteness-disclosure"),
    JSON.stringify(issues),
  );
});

test("checkLicensingImagerySection flags a false complete-manifest claim when no manifest exists", () => {
  const section = PASSING_LICENSING_SECTION.replace(
    /Civica does not currently retain a complete per-asset generation[\s\S]*?retain that record\./,
    "Civica retains a complete generation record for every engraving in the corpus.",
  );
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(
    issues.some((i) => i.ruleId === "false-complete-manifest-claim"),
    JSON.stringify(issues),
  );
});

test("checkLicensingImagerySection can allow a complete-manifest claim only after coverage is proven", () => {
  const section = PASSING_LICENSING_SECTION.replace(
    /Civica does not currently retain a complete per-asset generation[\s\S]*?retain that record\./,
    "Civica retains a complete generation record for every engraving in the corpus.",
  );
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: true, completeGenerationRecords: true });
  assert.ok(!issues.some((i) => i.ruleId === "false-complete-manifest-claim"), JSON.stringify(issues));
});

test("checkLicensingImagerySection flags a false complete-QA claim", () => {
  const section = `${PASSING_LICENSING_SECTION}\n<p>The launch corpus is fully audited.</p>`;
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(issues.some((i) => i.ruleId === "false-complete-qa-claim"), JSON.stringify(issues));
});

test("checkLicensingImagerySection flags a missing correction path", () => {
  const section = PASSING_LICENSING_SECTION
    .replace("contact form", "feedback channel")
    .replace("investigate and correct it", "address it");
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(issues.some((i) => i.ruleId === "missing-correction-path"), JSON.stringify(issues));
});

test("checkLicensingImagerySection flags a missing conservative reuse-rights statement", () => {
  const section = PASSING_LICENSING_SECTION.replace(
    /Civica does not currently grant a separate license for\s*\n\s*third-party reuse of editorial illustrations outside the site\./,
    "Reach out with questions.",
  );
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(
    issues.some((i) => i.ruleId === "missing-conservative-reuse-statement"),
    JSON.stringify(issues),
  );
});

test("checkLicensingImagerySection flags a permissive reuse grant contrary to the conservative posture", () => {
  const section = `${PASSING_LICENSING_SECTION}\n<p>These illustrations are free to reuse for any purpose.</p>`;
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(
    issues.some((i) => i.ruleId === "permissive-reuse-grant:free-to-reuse"),
    JSON.stringify(issues),
  );
});

test("checkLicensingImagerySection does not flag the negated reuse-rights sentence as a permissive grant", () => {
  const section = PASSING_LICENSING_SECTION;
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(!issues.some((i) => i.ruleId.startsWith("permissive-reuse-grant")), JSON.stringify(issues));
});

test("checkLicensingImagerySection flags documentary-photograph language", () => {
  const section = `${PASSING_LICENSING_SECTION}\n<p>Each engraving is an actual photograph of the landmark.</p>`;
  const issues = checkLicensingImagerySection(section, { assetManifestCoverageProven: false, completeGenerationRecords: false });
  assert.ok(
    issues.some((i) => i.ruleId === "documentary-language:is-a-photograph"),
    JSON.stringify(issues),
  );
});

test("checkLicensingImagerySection does not flag negated documentary language (\"not photographs\")", () => {
  const issues = findDocumentaryLanguage("These are editorial illustrations, not photographs of the landmark.");
  assert.deepEqual(issues, []);
});

// ---------------------------------------------------------------------------
// findFalseCompleteManifestClaim / findFalseCompleteQaClaim (direct)
// ---------------------------------------------------------------------------

test("findFalseCompleteManifestClaim ignores a negated (honest) claim", () => {
  const issues = findFalseCompleteManifestClaim(
    "Civica does not currently retain a complete generation record for every asset.",
    false,
  );
  assert.deepEqual(issues, []);
});

test("findFalseCompleteManifestClaim flags an affirmative claim when no manifest exists", () => {
  const issues = findFalseCompleteManifestClaim(
    "Every engraving has a complete manifest documenting its creation.",
    false,
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "false-complete-manifest-claim");
});

test("findFalseCompleteQaClaim flags an unhedged completeness claim", () => {
  const issues = findFalseCompleteQaClaim("Every engraving has undergone comprehensive human review of every image.");
  assert.equal(issues.length, 1);
});

// ---------------------------------------------------------------------------
// findPermissiveReuseGrant
// ---------------------------------------------------------------------------

test("findPermissiveReuseGrant ignores a negated CC-BY mention", () => {
  const issues = findPermissiveReuseGrant("Civica does not offer a CC-BY license for these illustrations.");
  assert.deepEqual(issues, []);
});

test("findPermissiveReuseGrant flags an affirmative CC-BY grant", () => {
  const issues = findPermissiveReuseGrant("These illustrations are released under CC-BY.");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "permissive-reuse-grant:cc-by-grant");
});

// ---------------------------------------------------------------------------
// checkAboutImageryPointer
// ---------------------------------------------------------------------------

test("checkAboutImageryPointer accepts the passing short pointer", () => {
  const paragraph = extractParagraphContaining(PASSING_ABOUT_MD, "/licensing#imagery");
  const issues = checkAboutImageryPointer(paragraph);
  assert.deepEqual(issues, []);
});

test("checkAboutImageryPointer reports a missing pointer as a single clear issue", () => {
  const issues = checkAboutImageryPointer(null);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "missing-about-pointer");
});

test("checkAboutImageryPointer flags a pointer missing the AI-assisted disclosure language", () => {
  const paragraph = "Country and territory hero images have provenance notes; see [imagery policy](/licensing#imagery).";
  const issues = checkAboutImageryPointer(paragraph);
  assert.ok(
    issues.some((i) => i.ruleId === "missing-illustration-disclosure-language"),
    JSON.stringify(issues),
  );
});

test("checkAboutImageryPointer flags a paragraph that duplicates the full policy instead of pointing to it", () => {
  const longParagraph = `Country and territory hero images are AI-assisted editorial illustrations, not photographs. ${"Civica does not currently retain a complete per-asset generation record for the launch corpus, and automated checks cover defined technical properties while human visual review is being strengthened over time. ".repeat(3)} See [imagery policy](/licensing#imagery).`;
  const issues = checkAboutImageryPointer(longParagraph);
  assert.ok(issues.some((i) => i.ruleId === "about-pointer-too-long"), JSON.stringify(issues));
});

test("checkAboutImageryPointer flags a paragraph missing the /licensing#imagery link", () => {
  const issues = checkAboutImageryPointer("These are AI-assisted editorial illustrations.");
  assert.ok(issues.some((i) => i.ruleId === "missing-licensing-imagery-link"), JSON.stringify(issues));
});

// ---------------------------------------------------------------------------
// checkCountryCaptionDisclosure
// ---------------------------------------------------------------------------

test("checkCountryCaptionDisclosure accepts the passing caption component", () => {
  const issues = checkCountryCaptionDisclosure(PASSING_CAPTION_COMPONENT);
  assert.deepEqual(issues, []);
});

test("checkCountryCaptionDisclosure flags gating the disclosure on the landmark caption text", () => {
  const broken = PASSING_CAPTION_COMPONENT.replace(
    "{engravingSrc && (\n          <figure",
    "{engravingSrc && heroCaption && (\n          <figure",
  );
  const issues = checkCountryCaptionDisclosure(broken);
  assert.ok(issues.some((i) => i.ruleId === "caption-gated-on-landmark-name"), JSON.stringify(issues));
});

test("checkCountryCaptionDisclosure flags a missing 'Editorial engraving' label", () => {
  const broken = PASSING_CAPTION_COMPONENT.replace("Editorial engraving", "Engraving");
  const issues = checkCountryCaptionDisclosure(broken);
  assert.ok(issues.some((i) => i.ruleId === "missing-editorial-engraving-label"), JSON.stringify(issues));
});

test("checkCountryCaptionDisclosure flags a missing AI-assisted illustration link", () => {
  const broken = PASSING_CAPTION_COMPONENT.replace(/<Link href="\/licensing#imagery"[\s\S]*?<\/Link>/, "");
  const issues = checkCountryCaptionDisclosure(broken);
  assert.ok(
    issues.some((i) => i.ruleId === "missing-ai-assisted-illustration-link"),
    JSON.stringify(issues),
  );
});

test("checkCountryCaptionDisclosure requires a non-documentary accessible name", () => {
  const broken = PASSING_CAPTION_COMPONENT.replace(' aria-label="AI-assisted illustration; non-documentary editorial art"', "");
  const issues = checkCountryCaptionDisclosure(broken);
  assert.ok(issues.some((i) => i.ruleId === "missing-non-documentary-accessible-name"), JSON.stringify(issues));
});

test("checkCountryCaptionDisclosure flags a link whose visible text isn't the disclosure copy", () => {
  const broken = PASSING_CAPTION_COMPONENT.replace(
    ">\n              AI-assisted illustration\n            </Link>",
    ">\n              Learn more\n            </Link>",
  );
  const issues = checkCountryCaptionDisclosure(broken);
  assert.ok(
    issues.some((i) => i.ruleId === "missing-ai-assisted-illustration-link"),
    JSON.stringify(issues),
  );
});

test("checkCountryCaptionDisclosure reports a missing figcaption as a single clear issue", () => {
  const issues = checkCountryCaptionDisclosure("export function FactbookHeaderStrip() { return null; }");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "missing-caption-block");
});

test("checkCountryCaptionDisclosure rejects a figcaption outside figure", () => {
  const broken = PASSING_CAPTION_COMPONENT.replace('<figure className="factbook-hero-art-figure">', "").replace("</figure>", "");
  const issues = checkCountryCaptionDisclosure(broken);
  assert.ok(issues.some((i) => i.ruleId === "invalid-figcaption-parent"), JSON.stringify(issues));
});

test("checkPageHeroDisclosure accepts visible policy copy and decorative background art", () => {
  assert.deepEqual(checkPageHeroDisclosure(PASSING_PAGE_HERO), []);
});

test("checkPageHeroDisclosure catches missing non-documentary copy", () => {
  const issues = checkPageHeroDisclosure(PASSING_PAGE_HERO.replace("AI-assisted, non-documentary", "AI-assisted"));
  assert.ok(issues.some((i) => i.ruleId === "missing-page-art-language"), JSON.stringify(issues));
});

// ---------------------------------------------------------------------------
// checkCaptionLinkStyling
// ---------------------------------------------------------------------------

test("checkCaptionLinkStyling accepts the passing stylesheet", () => {
  const issues = checkCaptionLinkStyling(PASSING_CAPTION_CSS, "factbook-hero-caption-link");
  assert.deepEqual(issues, []);
});

test("checkCaptionLinkStyling flags a missing class entirely", () => {
  const issues = checkCaptionLinkStyling(".factbook-hero-caption { pointer-events: none; }", "factbook-hero-caption-link");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].ruleId, "missing-caption-link-class");
});

test("checkCaptionLinkStyling flags a missing pointer-events fix", () => {
  const css = PASSING_CAPTION_CSS.replace("pointer-events: auto;", "");
  const issues = checkCaptionLinkStyling(css, "factbook-hero-caption-link");
  assert.ok(issues.some((i) => i.ruleId === "missing-pointer-events-fix"), JSON.stringify(issues));
});

test("checkCaptionLinkStyling flags a missing hover state", () => {
  const css = PASSING_CAPTION_CSS.replace(
    ".factbook-hero-caption-link:hover {\n  color: var(--color-accent);\n}",
    "",
  );
  const issues = checkCaptionLinkStyling(css, "factbook-hero-caption-link");
  assert.ok(issues.some((i) => i.ruleId === "missing-hover-state"), JSON.stringify(issues));
});

test("checkCaptionLinkStyling flags a missing focus state", () => {
  const css = PASSING_CAPTION_CSS.replace(
    ".factbook-hero-caption-link:focus-visible {\n  outline: 2px solid var(--color-accent);\n}",
    "",
  );
  const issues = checkCaptionLinkStyling(css, "factbook-hero-caption-link");
  assert.ok(issues.some((i) => i.ruleId === "missing-focus-state"), JSON.stringify(issues));
});
