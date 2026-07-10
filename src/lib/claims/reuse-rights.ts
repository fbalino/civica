/**
 * Canonical public rights policy and surface registry.
 *
 * This module is the single typed source for Civica's reuse-rights posture:
 * one canonical rights page, the access-vs-reuse boundary statement, code
 * rights (no root LICENSE file exists), the DAT-003 machine-readable rights
 * registry, an artifact-class summary, and the set of public surfaces
 * that must carry a rights pointer. `/licensing` renders from this registry;
 * `scripts/validate-rights-claims.ts` scans the required surfaces against it.
 *
 * Source/product/release enforcement lives in `src/lib/rights/manifest.ts`.
 */

import { absoluteUrl } from "@/lib/site";

// ─────────────────────────────────────────────────────────────────────────
// Canonical location + access-vs-reuse boundary
// ─────────────────────────────────────────────────────────────────────────

/** Stable section anchor — every rights pointer should land on the boundary
 *  statement itself, not just the top of the licensing page. */
export const RIGHTS_REGISTRY_ANCHOR = "#reuse";
export const RIGHTS_REGISTRY_PATH = `/licensing${RIGHTS_REGISTRY_ANCHOR}`;
/** Path without the anchor, for callers (e.g. nav links) that want the page
 *  itself rather than the specific section. */
export const RIGHTS_REGISTRY_PAGE_PATH = "/licensing";
export const RIGHTS_REGISTRY_URL = absoluteUrl(RIGHTS_REGISTRY_PATH);

/**
 * The exact boundary Civica draws between "you can reach this" and "you may
 * reuse this." Free/no-account access, a citation, or a download is never
 * itself a reuse grant — reuse permission depends on the specific source's
 * own upstream terms, which vary across the atlas.
 */
export const ACCESS_VS_REUSE_BOUNDARY =
  // PUBLIC_CLAIM: licensing.access-vs-reuse
  "Free, no-account access to a page, download, or embed is not a reuse license. Viewing, downloading, or citing a page does not grant permission to redistribute, republish, or build a derivative product from it. The exact upstream designation attached to each source — public domain, CC0, non-commercial, or otherwise — is what governs reuse for that source, not this general statement.";

// ─────────────────────────────────────────────────────────────────────────
// Code rights
// ─────────────────────────────────────────────────────────────────────────

export interface CodeRights {
  hasLicenseFile: boolean;
  repositoryUrl: string;
  posture: string;
}

export const CODE_RIGHTS: CodeRights = {
  hasLicenseFile: false,
  repositoryUrl: "https://github.com/fbalino/civica",
  // PUBLIC_CLAIM: licensing.code-status
  posture:
    "The Civica source code is publicly viewable in the repository above. No root LICENSE file is published, so no open-source reuse license (MIT or otherwise) is currently granted for the code. A future code-license decision (BRD-007/BRD-008) will replace this posture when made.",
};

// ─────────────────────────────────────────────────────────────────────────
// Release manifest status (owned by DAT-003, not this page)
// ─────────────────────────────────────────────────────────────────────────

export interface ReleaseManifestStatus {
  available: boolean;
  owner: string;
  statement: string;
}

export const RELEASE_MANIFEST_STATUS: ReleaseManifestStatus = {
  available: true,
  owner: "DAT-003",
  // PUBLIC_CLAIM: licensing.rights-manifest
  statement:
    "Civica publishes a machine-readable rights registry for every production source, export product, field class, and checked release artifact. Unverified source terms remain marked pending and are blocked from public bulk export.",
};

// ─────────────────────────────────────────────────────────────────────────
// Interim artifact-class registry
// ─────────────────────────────────────────────────────────────────────────

export const RIGHTS_ARTIFACT_CLASS_IDS = [
  "source-data",
  "civica-derived-outputs",
  "downloads-api",
  "hosted-embeds",
  "code",
  "editorial-imagery",
  "frozen-releases",
] as const;

export type RightsArtifactClassId = (typeof RIGHTS_ARTIFACT_CLASS_IDS)[number];

export interface RightsArtifactClassRow {
  id: RightsArtifactClassId;
  label: string;
  scope: string;
  currentPermissionPosture: string;
  governingBasis: string;
  readerAction: string;
}

export const RIGHTS_ARTIFACT_CLASSES: readonly RightsArtifactClassRow[] = [
  {
    id: "source-data",
    label: "Upstream source data",
    scope:
      "Facts and values reproduced from a named upstream publisher (CIA Factbook archive, Wikidata, IPU Parline, Constitute Project, V-Dem, WGI, and other research datasets Civica tracks).",
    currentPermissionPosture:
      "Varies by source. The CIA Factbook archive is public domain; Wikidata is CC0. IPU Parline and Constitute Project carry non-commercial upstream terms. Each publisher-restricted research dataset has its own terms — check the specific source, not a category average or a site's free-access posture.",
    governingBasis:
      "The exact designation the upstream publisher attaches to that source. Civica reproduces that designation; it does not relicense it. Coverage of per-row license disclosure on reader-facing surfaces (e.g. FactValueDot) varies and is not yet complete everywhere.",
    readerAction:
      "Check the license shown with the specific data point or source row before reuse; do not assume site-wide access implies a reuse grant.",
  },
  {
    id: "civica-derived-outputs",
    label: "Civica-derived outputs (Index, Pulse, reconciliation)",
    scope:
      "The Civica Index composite, Civica Pulse event classifications, and reconciled/canonical values Civica selects among multiple source observations.",
    currentPermissionPosture:
      "Research-beta and experimental outputs Civica publishes for scrutiny. Civica does not currently grant a standalone dataset license for these derived outputs; the citation expectation below is a request for scholarly credit, not a permission grant.",
    governingBasis:
      "Civica's own methodology and published beta status. No separate SPDX or dataset license currently applies.",
    readerAction:
      "Cite Civica Atlas and the source(s) shown with the derived value, and treat beta/experimental status as part of the citation. Citing is not the same as obtaining reuse permission; contact the project before redistributing or building a derivative product from these outputs.",
  },
  {
    id: "downloads-api",
    label: "Downloads and the public API",
    scope:
      "JSON/CSV exports and public `/api/v1/*` and `/api/countries/:slug/export` responses.",
    currentPermissionPosture:
      "Downloading or calling the API is free and does not require an account, but it does not itself grant a reuse license beyond what the underlying source rows already permit. Not every export or endpoint currently carries a per-row license field — its absence in a given response is not itself a reuse grant.",
    governingBasis:
      "The upstream source's own designation, plus this registry's access-vs-reuse boundary. Where a response includes source, license, or vintage fields, treat them as provenance to preserve, not as proof that every response includes them.",
    readerAction:
      "Preserve any source, license, and vintage fields present in a downloaded record; where they are absent, check the specific source's posture on this page before reuse rather than assuming an open grant.",
  },
  {
    id: "hosted-embeds",
    label: "Hosted widget embeds",
    scope:
      "The `/embed/[slug]` iframe widgets and the `/civica-index/widget` gallery that generates their snippets.",
    currentPermissionPosture:
      "Embedding the hosted widget on a third-party page is permitted. That permission covers only the hosted display — it does not grant a separate license to the underlying data shown inside the widget.",
    governingBasis:
      "Civica's hosting terms for the iframe surface, distinct from the reuse terms of the data rendered inside it.",
    readerAction:
      "Use the iframe as provided; do not scrape or republish the data rendered inside a widget as if the embed permission also covered that data.",
  },
  {
    id: "code",
    label: "Repository source code",
    scope: "The Civica Atlas codebase in the public GitHub repository.",
    currentPermissionPosture: CODE_RIGHTS.posture,
    governingBasis:
      "No root LICENSE file; Civica has not published a general code-reuse grant.",
    readerAction:
      "Do not treat the public repository as open-source or MIT-licensed; contact the project before redistributing or building a derivative service from the code.",
  },
  {
    id: "editorial-imagery",
    label: "Editorial engravings",
    scope: "AI-assisted country/territory hero illustrations.",
    currentPermissionPosture:
      "Display on Civica Atlas is authorized by Civica. No separate license is granted for third-party reuse; provenance and legal review is pending.",
    governingBasis:
      "Civica's imagery policy at /licensing#imagery (unchanged by this registry).",
    readerAction:
      "Contact the editors before reusing an engraving anywhere else.",
  },
  {
    id: "frozen-releases",
    label: "Frozen/versioned releases",
    scope:
      "Any future frozen, versioned dataset release or archival snapshot of Civica's data.",
    currentPermissionPosture:
      "The checked 2024-Q4 Index input manifest contains provenance metadata and hashes only. No frozen Atlas data package or Index score dataset is published.",
    governingBasis: RELEASE_MANIFEST_STATUS.statement,
    readerAction:
      "Use the release-artifact registry below to distinguish distributable metadata from publisher files and data products that remain withheld.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Required-surface registry
// ─────────────────────────────────────────────────────────────────────────

export const REQUIRED_RIGHTS_SURFACE_IDS = [
  "footer",
  "about",
  "licensing",
  "terms",
  "metadata",
  "downloads",
  "api-docs",
  "embeds",
  "citation-ui",
  "citation-file",
] as const;

export type RequiredRightsSurfaceId =
  (typeof REQUIRED_RIGHTS_SURFACE_IDS)[number];

export interface RequiredRightsSurface {
  id: RequiredRightsSurfaceId;
  label: string;
  /** Repository-relative files that must carry a legible rights pointer. */
  paths: readonly string[];
  /** Paths where a link to /licensing may be satisfied by machine-readable
   *  metadata alone (for example, the small iframe cannot nest another link
   *  inside the widget's outer anchor). Other paths still require a visible
   *  pointer. */
  machineReadableOnlyPaths?: readonly string[];
}

export const REQUIRED_RIGHTS_SURFACES: readonly RequiredRightsSurface[] = [
  {
    id: "footer",
    label: "Site footer",
    paths: ["src/components/SiteFooter.tsx"],
  },
  {
    id: "about",
    label: "About page",
    paths: ["content/about.md"],
  },
  {
    id: "licensing",
    label: "Licensing page",
    paths: ["src/app/licensing/page.tsx"],
  },
  {
    id: "terms",
    label: "Terms of use",
    paths: ["src/app/terms/page.tsx"],
  },
  {
    id: "metadata",
    label: "Structured Dataset metadata",
    paths: ["src/lib/seo/jsonld.ts", "src/app/(reader)/civica-index/page.tsx"],
  },
  {
    id: "downloads",
    label: "API docs — bulk data / downloads",
    paths: ["src/app/api-docs/page.tsx"],
  },
  {
    id: "api-docs",
    label: "API docs page",
    paths: ["src/app/api-docs/page.tsx"],
  },
  {
    id: "embeds",
    label: "Embed route + widget gallery",
    paths: [
      "src/app/embed/[slug]/route.ts",
      "src/app/(reader)/civica-index/widget/page.tsx",
    ],
    machineReadableOnlyPaths: ["src/app/embed/[slug]/route.ts"],
  },
  {
    id: "citation-ui",
    label: "Cite accordion component",
    paths: ["src/components/cite/CiteAccordion.tsx"],
  },
  {
    id: "citation-file",
    label: "CITATION.cff",
    paths: ["CITATION.cff"],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Pure scanner helpers
// ─────────────────────────────────────────────────────────────────────────

export interface RightsScanFinding {
  ruleId: string;
  match: string;
  index: number;
}

// Negation words/phrases that, when found immediately before a matched
// claim, flip an apparent overclaim into an honest denial ("no root LICENSE
// file", "does not grant", "is not open-source", "no complete manifest
// exists"). The window is intentionally short so a negation many clauses
// earlier in a paragraph doesn't swallow an unrelated later overclaim.
const NEGATION_RE =
  /\b(no|not|isn't|is not|doesn't|does not|never|without|absent|omit(?:ted|s)?|lacks?|no longer|neither)\b[^.;:\n]{0,40}$/i;

/** True when the ~48 characters immediately preceding `index` in `text`
 *  contain a negation word governing that span (nothing else — no
 *  intervening sentence boundary — sits between the negation and the
 *  match). */
function isNegated(text: string, index: number): boolean {
  const windowStart = Math.max(0, index - 48);
  const preceding = text.slice(windowStart, index);
  return NEGATION_RE.test(preceding);
}

function scan(
  text: string,
  ruleId: string,
  patterns: readonly RegExp[],
): RightsScanFinding[] {
  const findings: RightsScanFinding[] = [];
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g")
      ? pattern.flags
      : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (isNegated(text, m.index)) continue;
      findings.push({ ruleId, match: m[0], index: m.index });
    }
  }
  return findings;
}

/** A visible or machine-readable pointer back to the canonical rights page.
 *  Accepts either the anchored `/licensing#reuse` form or a bare `/licensing`
 *  link (and their absolute equivalents) — surfaces with limited space may
 *  reasonably point at the page rather than the specific section. */
export function hasRightsPointer(text: string): boolean {
  const barePagePointer =
    /(?:https:\/\/civicaatlas\.org)?\/licensing(?=["'`)\s}\],>]|$)/.test(text);
  const consumedCanonicalConstant =
    /href\s*=\s*\{\s*RIGHTS_REGISTRY_(?:PATH|URL)\s*\}/.test(text) ||
    /license\s*:\s*RIGHTS_REGISTRY_(?:PATH|URL)\b/.test(text) ||
    /content\s*=\s*["'`]\s*\$\{\s*RIGHTS_REGISTRY_(?:PATH|URL)\s*\}/.test(text);
  return (
    text.includes(RIGHTS_REGISTRY_PATH) ||
    text.includes(RIGHTS_REGISTRY_URL) ||
    barePagePointer ||
    // A named import or comment is not evidence of a rendered pointer. The
    // canonical constant must appear in a value-producing source context.
    consumedCanonicalConstant
  );
}

/** A `<meta>`-style machine-readable rights pointer (used by the small embed
 *  size, where a nested visible link isn't possible inside the widget's own
 *  outer `<a>` wrapper). */
export function hasMachineReadableRightsPointer(text: string): boolean {
  return (
    new RegExp(
      `<meta[^>]*name=["']civica:rights["'][^>]*content=["'][^"']*${RIGHTS_REGISTRY_PAGE_PATH.replace(/\//g, "\\/")}`,
    ).test(text) ||
    text.includes(RIGHTS_REGISTRY_URL) ||
    text.includes(absoluteUrl(RIGHTS_REGISTRY_PAGE_PATH))
  );
}

export interface RightsSurfaceIssue {
  surfaceId: RequiredRightsSurfaceId;
  path: string;
  ruleId: "missing-surface" | "missing-pointer";
}

/** Pure coverage check shared by fixtures and the filesystem validator. */
export function validateRequiredRightsSurfaceSources(
  sources: Readonly<Record<string, string | undefined>>,
): RightsSurfaceIssue[] {
  const issues: RightsSurfaceIssue[] = [];
  for (const surface of REQUIRED_RIGHTS_SURFACES) {
    for (const path of surface.paths) {
      const source = sources[path];
      if (source === undefined) {
        issues.push({ surfaceId: surface.id, path, ruleId: "missing-surface" });
        continue;
      }
      const hasPointer = surface.machineReadableOnlyPaths?.includes(path)
        ? hasMachineReadableRightsPointer(source) || hasRightsPointer(source)
        : hasRightsPointer(source);
      if (!hasPointer) {
        issues.push({ surfaceId: surface.id, path, ruleId: "missing-pointer" });
      }
    }
  }
  return issues;
}

const BLANKET_OPEN_DATA_PATTERNS: readonly RegExp[] = [
  /\ball data\b[\s\S]{0,60}\b(is|are)\b[\s\S]{0,40}\b(open|free|public[- ]domain)\b/i,
  /\b(?:Civica(?: Atlas)?|our|this site(?:'s)?)\s+(?:public-facing\s+)?data\b[\s\S]{0,40}\b(?:is|are)\b[\s\S]{0,30}\b(?:open|free\s+to\s+(?:use|reuse)|public[- ]domain)\b/i,
  /\bevery\s+(?:dataset|data point|record)\b[\s\S]{0,40}\b(?:is|are)\b[\s\S]{0,30}\b(?:open|free\s+to\s+(?:use|reuse)|public[- ]domain)\b/i,
  /\bopen[- ]data initiative\b/i,
  /\bopen knowledge initiative\b/i,
  /\bfree,?\s*open reference\b/i,
];

/** Blanket "all data is open/free to use" claims — as opposed to a scoped,
 *  source-by-source posture. */
export function findBlanketOpenDataClaims(text: string): RightsScanFinding[] {
  return scan(text, "blanket-open-data-claim", BLANKET_OPEN_DATA_PATTERNS);
}

const CODE_OPEN_SOURCE_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bcodebase (is|remains)\s+open[- ]source\b/i,
  /\bCivica (is|remains)\s+open[- ]source\b/i,
  /\bopen[- ]source (successor|project)\b/i,
  /\b(is|are|remains)\s+MIT[- ]licensed\b/i,
  /\bMIT license\b/i,
];

/** Code-reuse claims (open-source / MIT) that assert a license grant that
 *  does not exist while `CODE_RIGHTS.hasLicenseFile` is false. */
export function findCodeOpenSourceClaims(text: string): RightsScanFinding[] {
  return scan(text, "code-open-source-claim", CODE_OPEN_SOURCE_CLAIM_PATTERNS);
}

const COMPLETE_MANIFEST_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bcomplete (rights|license) manifest\b/i,
  /\bfull(y)? machine-readable rights (manifest|inventory)\b/i,
  /\bcomplete source\/field\/(product\/)?release rights manifest\b/i,
];

/** False claims that the complete DAT-003 manifest already exists/ships. */
export function findCompleteManifestClaims(text: string): RightsScanFinding[] {
  return scan(
    text,
    "false-complete-manifest-claim",
    COMPLETE_MANIFEST_CLAIM_PATTERNS,
  );
}

/** Runs every prohibited-language scanner over one text blob. */
export function findAllProhibitedRightsLanguage(
  text: string,
): RightsScanFinding[] {
  return [
    ...findBlanketOpenDataClaims(text),
    ...findCodeOpenSourceClaims(text),
    ...findCompleteManifestClaims(text),
  ];
}
