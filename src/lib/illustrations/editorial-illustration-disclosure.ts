/**
 * CLM-014 — pure, DB-free contract checks for the editorial-illustration
 * (AI-assisted country/territory engraving) disclosure across three
 * surfaces: the canonical `/licensing#imagery` policy, the short About
 * pointer, and the always-on country-page caption disclosure.
 *
 * Every function here takes plain strings (already-read file contents) and
 * returns a list of issues — no filesystem access. `scripts/validate-
 * editorial-illustration-disclosure.ts` is the thin fs wrapper that reads
 * the real source files and calls these.
 *
 * The rules encode the CLM-014 binding decisions: engravings are
 * non-documentary editorial illustrations; the policy must honestly
 * disclose that launch-corpus per-asset generation records are incomplete
 * (forward-created/replaced assets retain records); automated QA today only
 * covers defined technical properties while human visual review is being
 * strengthened, not complete; there is a contact-based correction path; and
 * the reuse-rights posture is conservative (display authorized by Civica,
 * no third-party reuse license granted) — never a permissive grant.
 */

export type DisclosureSurface =
  | "licensing-imagery"
  | "about-pointer"
  | "country-caption"
  | "caption-styling";

export interface DisclosureIssue {
  surface: DisclosureSurface;
  ruleId: string;
  description: string;
  match?: string;
}

const NEGATION_WINDOW = 60;
const NEGATION_PATTERN = /\b(not|no|never|doesn't|does not|isn't|is not|aren't|are not|without)\b/i;

/** True if `pattern` matches `text` somewhere that is NOT immediately preceded by a negation word. */
function hasAffirmativeMatch(text: string, pattern: RegExp): RegExpMatchArray | null {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    const windowStart = Math.max(0, match.index - NEGATION_WINDOW);
    const preceding = text.slice(windowStart, match.index);
    if (!NEGATION_PATTERN.test(preceding)) {
      return match;
    }
    if (global.lastIndex === match.index) global.lastIndex++;
  }
  return null;
}

/**
 * Extracts the substring starting at the first element with `id="<sectionId>"`
 * up to (but not including) the next sibling `<section` tag, or the end of
 * the source if this is the last section. Works on raw JSX/TSX source text;
 * does not parse JSX, so it is resilient to prose/formatting edits but
 * assumes sections are marked the way the rest of the codebase already marks
 * them (`<section id="...">`).
 */
export function extractSectionById(source: string, sectionId: string): string | null {
  const idPattern = new RegExp(`id=["']${sectionId}["']`);
  const startMatch = idPattern.exec(source);
  if (!startMatch) return null;

  // `rest` starts at the `id="..."` attribute itself, i.e. already past this
  // section's own `<section` keyword — so the first `<section` found here is
  // genuinely the next sibling section.
  const rest = source.slice(startMatch.index);
  const next = /<section[\s>]/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

// ---------------------------------------------------------------------------
// Documentary-language / permissive-reuse-grant scanners
// ---------------------------------------------------------------------------

const DOCUMENTARY_CLAIM_PATTERNS: { id: string; pattern: RegExp; description: string }[] = [
  {
    id: "photograph-of-actual",
    pattern: /\b(actual|real)[- ]?(life )?(photograph|photo)s?\s+of\b/i,
    description: "Claims an engraving is an actual/real photograph of its subject.",
  },
  {
    id: "is-a-photograph",
    pattern: /\bis an?\s+(actual\s+)?photograph\b/i,
    description: "States the illustration \"is a photograph.\"",
  },
  {
    id: "actual-image-of",
    pattern: /\bactual\s+images?\s+of\b/i,
    description: "Uses \"actual image of,\" implying documentary accuracy.",
  },
  {
    id: "photo-of-the-landmark",
    pattern: /\bphotos?\s+of\s+the\s+(landmark|country|territory|site)\b/i,
    description: "Describes the illustration as a photo of the landmark/country/territory.",
  },
];

/** Flags affirmative (non-negated) documentary-photography claims about the engravings. */
export function findDocumentaryLanguage(text: string): DisclosureIssue[] {
  const issues: DisclosureIssue[] = [];
  for (const rule of DOCUMENTARY_CLAIM_PATTERNS) {
    const match = hasAffirmativeMatch(text, rule.pattern);
    if (match) {
      issues.push({
        surface: "licensing-imagery",
        ruleId: `documentary-language:${rule.id}`,
        description: rule.description,
        match: match[0],
      });
    }
  }
  return issues;
}

const PERMISSIVE_REUSE_PATTERNS: { id: string; pattern: RegExp; description: string }[] = [
  {
    id: "free-to-reuse",
    pattern: /\bfree(ly)?\s+to\s+reuse\b/i,
    description: "Grants free reuse of the illustrations, contrary to the conservative posture.",
  },
  {
    id: "cc-by-grant",
    pattern: /\bCC[- ]?BY\b/i,
    description: "Cites a Creative Commons BY-style grant for the illustrations.",
  },
  {
    id: "public-domain-grant",
    pattern: /\bpublic domain\b.{0,30}\b(illustrations?|engravings?|imagery)\b/i,
    description: "Declares the illustrations public domain.",
  },
  {
    id: "no-rights-reserved",
    pattern: /\bno rights reserved\b/i,
    description: "States no rights are reserved over the illustrations.",
  },
  {
    id: "reuse-freely",
    pattern: /\breuse\s+(these|this|the)\s+(illustrations?|engravings?|images?)\s+freely\b/i,
    description: "Invites unrestricted reuse of the illustrations.",
  },
  {
    id: "open-license-grant",
    pattern: /\bopen license for\s+(these\s+|the\s+)?(illustrations?|engravings?)\b/i,
    description: "Claims an open license for the illustrations.",
  },
];

/** Flags affirmative (non-negated) permissive reuse grants, contrary to the conservative rights posture. */
export function findPermissiveReuseGrant(text: string): DisclosureIssue[] {
  const issues: DisclosureIssue[] = [];
  for (const rule of PERMISSIVE_REUSE_PATTERNS) {
    const match = hasAffirmativeMatch(text, rule.pattern);
    if (match) {
      issues.push({
        surface: "licensing-imagery",
        ruleId: `permissive-reuse-grant:${rule.id}`,
        description: rule.description,
        match: match[0],
      });
    }
  }
  return issues;
}

const FALSE_COMPLETE_MANIFEST_PATTERNS: RegExp[] = [
  /\bcomplete\b.{0,40}\b(generation\s+)?record\b.{0,20}\bfor\s+(every|all|each)\b/i,
  /\bevery\s+(asset|engraving|illustration)\b.{0,40}\b(has|carries)\b.{0,20}\b(a\s+)?(complete\s+)?manifest\b/i,
  /\bfull\s+prompt(\/|\s+and\s+)reference\b.{0,40}\bhistory\s+for\s+(every|all)\b/i,
];

/**
 * Flags an affirmative claim that every/all engravings have a complete
 * per-asset manifest/generation record. Such a claim is false whenever no
 * manifest artifact actually exists in the repo — the launch corpus has no
 * recorded manifest, so this must never be asserted as complete.
 */
export function findFalseCompleteManifestClaim(
  text: string,
  manifestExists: boolean,
): DisclosureIssue[] {
  if (manifestExists) return [];
  const issues: DisclosureIssue[] = [];
  for (const pattern of FALSE_COMPLETE_MANIFEST_PATTERNS) {
    const match = hasAffirmativeMatch(text, pattern);
    if (match) {
      issues.push({
        surface: "licensing-imagery",
        ruleId: "false-complete-manifest-claim",
        description:
          "Claims a complete per-asset manifest/generation record exists for every engraving, but no manifest artifact is present in the repository.",
        match: match[0],
      });
    }
  }
  return issues;
}

const FALSE_COMPLETE_QA_PATTERNS: RegExp[] = [
  /\bcomplete(ly)?\s+(and\s+)?independently\s+audited\b/i,
  /\bfully\s+audited\b/i,
  /\bcomprehensive\s+human\s+review\s+of\s+(every|all)\b/i,
];

/** Flags an affirmative claim that human/independent QA review is already complete. */
export function findFalseCompleteQaClaim(text: string): DisclosureIssue[] {
  const issues: DisclosureIssue[] = [];
  for (const pattern of FALSE_COMPLETE_QA_PATTERNS) {
    const match = hasAffirmativeMatch(text, pattern);
    if (match) {
      issues.push({
        surface: "licensing-imagery",
        ruleId: "false-complete-qa-claim",
        description:
          "Claims complete/independently audited human review, but review is disclosed elsewhere as strengthening, not complete.",
        match: match[0],
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Required-content checks per surface
// ---------------------------------------------------------------------------

function requireMatch(
  text: string,
  pattern: RegExp,
  ruleId: string,
  description: string,
  surface: DisclosureSurface,
): DisclosureIssue | null {
  if (pattern.test(text)) return null;
  return { surface, ruleId, description };
}

export interface LicensingImageryCheckOptions {
  /** True only after a validator proves complete per-asset coverage, not merely when a file exists. */
  manifestExists: boolean;
}

/**
 * Validates the canonical `/licensing#imagery` policy section text against
 * the seven required content categories: non-documentary nature, tools,
 * honest incomplete-records disclosure, human/automated QA posture,
 * correction path, and conservative reuse rights — plus the two negative
 * checks (no documentary language, no permissive reuse grant, no false
 * completeness claims).
 */
export function checkLicensingImagerySection(
  sectionText: string | null,
  options: LicensingImageryCheckOptions,
): DisclosureIssue[] {
  if (sectionText === null) {
    return [
      {
        surface: "licensing-imagery",
        ruleId: "missing-imagery-anchor",
        description: 'No section with id="imagery" found on the licensing page.',
      },
    ];
  }

  const requiredStatementIssues = [
    requireMatch(
      sectionText,
      /\bnot\b[^.]{0,25}\bphotographs?\b|\bnon-documentary\b/i,
      "missing-non-documentary-statement",
      "The imagery section must state the engravings are not (documentary) photographs.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\bAI[- ]assisted\b|\bgenerative\s+(AI|model|image)\b|\bimage[- ]generation\s+tool/i,
      "missing-tools-statement",
      "The imagery section must disclose that AI-assisted / generative image tooling was used.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\b(does not|doesn't)\b[^.]{0,80}\bcomplete\b[^.]{0,40}\brecord\b|\brecords?\b[^.]{0,40}\b(are|remain)\s+incomplete\b/i,
      "missing-records-incompleteness-disclosure",
      "The imagery section must honestly disclose that launch-corpus per-asset generation records are incomplete.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\b(created or replaced|forward-created|newly created)\b[^.]{0,60}\b(going forward\s+)?retain\b|\bretain\b[^.]{0,40}\bgoing forward\b/i,
      "missing-forward-retention-statement",
      "The imagery section must state that assets created or replaced going forward retain generation records.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\bautomated\s+check/i,
      "missing-automated-qa-statement",
      "The imagery section must describe the automated QA checks in place.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\bhuman\s+(visual\s+)?review\b/i,
      "missing-human-qa-statement",
      "The imagery section must describe human visual review of engravings.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\bnot\s+(yet\s+)?(complete|independently audited)\b/i,
      "missing-qa-incompleteness-disclosure",
      "The imagery section must disclose that human review is not yet complete/independently audited.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\bcontact\b[^.]{0,80}\b(correct|investigate|report)\b|\b(correct|investigate|report)\b[^.]{0,80}\bcontact\b/i,
      "missing-correction-path",
      "The imagery section must give a contact-based correction path for wrong landmarks/captions.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\bauthorized\s+by\s+Civica\b/i,
      "missing-display-authorization-statement",
      "The imagery section must state display on Civica Atlas is authorized by Civica.",
      "licensing-imagery",
    ),
    requireMatch(
      sectionText,
      /\b(does not|doesn't)\b[^.]{0,60}\bgrant\b[^.]{0,60}\b(license|reuse)\b|\bno\b[^.]{0,40}\b(separate|third-party)\b[^.]{0,20}\breuse license\b/i,
      "missing-conservative-reuse-statement",
      "The imagery section must state no separate/third-party reuse license is granted.",
      "licensing-imagery",
    ),
  ].filter((issue): issue is DisclosureIssue => issue !== null);

  return [
    ...requiredStatementIssues,
    ...findDocumentaryLanguage(sectionText),
    ...findPermissiveReuseGrant(sectionText),
    ...findFalseCompleteManifestClaim(sectionText, options.manifestExists),
    ...findFalseCompleteQaClaim(sectionText),
  ];
}

/**
 * Extracts the blank-line-delimited paragraph (markdown-style) containing
 * `needle`, or null if `needle` isn't found. Used to scope the About-page
 * pointer check to just its own sentence rather than the whole page.
 */
export function extractParagraphContaining(source: string, needle: string): string | null {
  const index = source.indexOf(needle);
  if (index === -1) return null;
  const start = source.lastIndexOf("\n\n", index);
  const end = source.indexOf("\n\n", index);
  const paraStart = start === -1 ? 0 : start + 2;
  const paraEnd = end === -1 ? source.length : end;
  return source.slice(paraStart, paraEnd).trim();
}

const ABOUT_POINTER_MAX_LENGTH = 400;

/**
 * Validates the short About-page pointer to the licensing imagery policy.
 * `paragraphText` should be just the sentence/paragraph containing the
 * pointer (not the whole page) so the length check stays meaningful.
 */
export function checkAboutImageryPointer(paragraphText: string | null): DisclosureIssue[] {
  if (paragraphText === null) {
    return [
      {
        surface: "about-pointer",
        ruleId: "missing-about-pointer",
        description: "About page has no pointer sentence linking to /licensing#imagery.",
      },
    ];
  }

  const issues: DisclosureIssue[] = [];

  const hasLink = /\/licensing#imagery/i.test(paragraphText);
  if (!hasLink) {
    issues.push({
      surface: "about-pointer",
      ruleId: "missing-licensing-imagery-link",
      description: "The About pointer must link to /licensing#imagery.",
    });
  }

  const mentionsIllustration = /\bAI-assisted\b|\beditorial illustrations?\b/i.test(paragraphText);
  if (!mentionsIllustration) {
    issues.push({
      surface: "about-pointer",
      ruleId: "missing-illustration-disclosure-language",
      description: 'The About pointer must describe the images as "AI-assisted" editorial illustrations.',
    });
  }

  if (paragraphText.length > ABOUT_POINTER_MAX_LENGTH) {
    issues.push({
      surface: "about-pointer",
      ruleId: "about-pointer-too-long",
      description: `The About pointer must stay a short link-only pointer (<= ${ABOUT_POINTER_MAX_LENGTH} chars); the full policy belongs on /licensing#imagery.`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Country-caption always-on disclosure
// ---------------------------------------------------------------------------

/**
 * Validates the country/territory hero caption component: the disclosure
 * ("Editorial engraving" label + "AI-assisted illustration" link to
 * /licensing#imagery) must render whenever an engraving image exists, even
 * when the landmark caption text is missing — never gated on the caption.
 */
const GUARD_LOOKBACK_CHARS = 200;

export function checkCountryCaptionDisclosure(componentSource: string): DisclosureIssue[] {
  const issues: DisclosureIssue[] = [];

  const figcaptionIndex = componentSource.indexOf("<figcaption");
  if (figcaptionIndex === -1) {
    issues.push({
      surface: "country-caption",
      ruleId: "missing-caption-block",
      description: "No <figcaption> disclosure block found in the country header component.",
    });
    return issues;
  }

  // Bounded lookback rather than full brace-balancing: real components gate
  // the figcaption on the immediately preceding `{engravingSrc && (`, only a
  // few dozen chars back, so a short window can't accidentally cross into an
  // unrelated earlier JSX block yet is enough to see the real guard.
  const guardText = componentSource.slice(
    Math.max(0, figcaptionIndex - GUARD_LOOKBACK_CHARS),
    figcaptionIndex,
  );
  if (/heroCaption/.test(guardText)) {
    issues.push({
      surface: "country-caption",
      ruleId: "caption-gated-on-landmark-name",
      description:
        "The disclosure figcaption must render whenever engravingSrc exists, not only when heroCaption is also present.",
      match: guardText.trim(),
    });
  }
  if (!/engravingSrc/.test(guardText)) {
    issues.push({
      surface: "country-caption",
      ruleId: "caption-not-gated-on-engraving",
      description: "The disclosure figcaption must be gated on engravingSrc so it only renders when an engraving exists.",
      match: guardText.trim(),
    });
  }

  // Scope the rest of the checks to the figcaption element itself.
  const figcaptionEnd = componentSource.indexOf("</figcaption>", figcaptionIndex);
  const figcaptionSource =
    figcaptionEnd >= 0
      ? componentSource.slice(figcaptionIndex, figcaptionEnd + "</figcaption>".length)
      : componentSource.slice(figcaptionIndex);

  if (!/Editorial engraving/i.test(figcaptionSource)) {
    issues.push({
      surface: "country-caption",
      ruleId: "missing-editorial-engraving-label",
      description: 'The disclosure must carry the "Editorial engraving" label.',
    });
  }

  const linkPattern = /<(?:Link|a)\b[^>]*href=["']\/licensing#imagery["'][^>]*>\s*AI-assisted illustration\s*<\/(?:Link|a)>/i;
  if (!linkPattern.test(figcaptionSource)) {
    issues.push({
      surface: "country-caption",
      ruleId: "missing-ai-assisted-illustration-link",
      description: 'The disclosure must carry a visible link reading "AI-assisted illustration" to /licensing#imagery.',
    });
  }

  return issues;
}

/**
 * Validates that the tokenized caption-link class has real interactive
 * styling: clickable despite sitting inside a decorative (pointer-events:
 * none) caption overlay, plus visible hover and focus states.
 */
export function checkCaptionLinkStyling(cssText: string, className: string): DisclosureIssue[] {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockPattern = new RegExp(`\\.${escaped}\\s*\\{([^}]*)\\}`);
  const blockMatch = blockPattern.exec(cssText);

  if (!blockMatch) {
    return [
      {
        surface: "caption-styling",
        ruleId: "missing-caption-link-class",
        description: `No .${className} rule block found in the stylesheet.`,
      },
    ];
  }

  const issues: DisclosureIssue[] = [];
  if (!/pointer-events\s*:\s*auto/i.test(blockMatch[1])) {
    issues.push({
      surface: "caption-styling",
      ruleId: "missing-pointer-events-fix",
      description: `.${className} must set pointer-events: auto to stay clickable inside the decorative (pointer-events: none) caption overlay.`,
    });
  }

  const hoverPattern = new RegExp(`\\.${escaped}:hover\\s*\\{[^}]*\\}`);
  if (!hoverPattern.test(cssText)) {
    issues.push({
      surface: "caption-styling",
      ruleId: "missing-hover-state",
      description: `.${className}:hover must define a real hover state.`,
    });
  }

  const focusPattern = new RegExp(`\\.${escaped}:focus(-visible)?\\s*\\{[^}]*\\}`);
  if (!focusPattern.test(cssText)) {
    issues.push({
      surface: "caption-styling",
      ruleId: "missing-focus-state",
      description: `.${className}:focus(-visible) must define a real focus state.`,
    });
  }

  return issues;
}
