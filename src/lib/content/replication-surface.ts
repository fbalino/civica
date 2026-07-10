/**
 * Pure, DB-free invariants for the replication-package status surface
 * (CLM-010). Guards `replicationPackage` in `site-state.ts` and the prose
 * that renders it at `/civica-index/replication` so the route can never
 * silently drift into implying a package exists before G2 actually ships
 * one.
 */

import type {
  ReplicationComponent,
  ReplicationPackageState,
} from "./site-state";

/** The full component inventory the route must always account for, in
 *  canonical display order. Kept independent of `replicationPackage`
 *  itself so removing a component from site-state.ts is caught as
 *  "missing", not silently accepted. */
export const REQUIRED_REPLICATION_COMPONENT_IDS = [
  "versioned-code",
  "data-input-manifest",
  "codebook",
  "checksums",
  "environment",
  "reproduction-commands",
  "expected-outputs",
  "doi-archive",
  "clean-room-evidence",
] as const;

export type ReplicationSurfaceIssueCode =
  | "available-before-g2"
  | "href-before-g2"
  | "available-without-href"
  | "href-without-available"
  | "invalid-href"
  | "duplicate-component-id"
  | "missing-required-component"
  | "published-with-incomplete-component";

export interface ReplicationSurfaceIssue {
  code: ReplicationSurfaceIssueCode;
  message: string;
  componentId?: string;
}

function hasHref(component: ReplicationComponent): boolean {
  return typeof component.href === "string" && component.href.trim().length > 0;
}

/** A nonempty internal path (`/foo`) or absolute external URL. */
function isValidPath(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("/") || /^https?:\/\/\S+$/.test(trimmed);
}

/**
 * Checks (per the CLM-010 contract):
 *   1. `unpublished-pre-g2` forbids any component with status
 *      `available` or with any `href` set.
 *   2. An `href` may be present if and only if `status === "available"`;
 *      an `available` component's href must be a nonempty valid
 *      internal/external path.
 *   3. Component ids are unique and the required inventory is complete.
 */
export function validateReplicationPackage(
  pkg: ReplicationPackageState,
): ReplicationSurfaceIssue[] {
  const issues: ReplicationSurfaceIssue[] = [];
  const seenIds = new Set<string>();

  for (const component of pkg.components) {
    if (seenIds.has(component.id)) {
      issues.push({
        code: "duplicate-component-id",
        componentId: component.id,
        message: `duplicate component id "${component.id}"`,
      });
    }
    seenIds.add(component.id);

    const componentHasHref = hasHref(component);

    if (component.status === "available") {
      if (!componentHasHref) {
        issues.push({
          code: "available-without-href",
          componentId: component.id,
          message: `${component.id}: status "available" requires a nonempty href`,
        });
      } else if (!isValidPath(component.href!)) {
        issues.push({
          code: "invalid-href",
          componentId: component.id,
          message: `${component.id}: href "${component.href}" is not a valid internal/external path`,
        });
      }
    } else if (componentHasHref) {
      issues.push({
        code: "href-without-available",
        componentId: component.id,
        message: `${component.id}: only a component with status "available" may declare an href`,
      });
    }

    if (pkg.pageStatus === "unpublished-pre-g2") {
      if (component.status === "available") {
        issues.push({
          code: "available-before-g2",
          componentId: component.id,
          message: `${component.id}: page status "unpublished-pre-g2" forbids status "available"`,
        });
      }
      if (componentHasHref) {
        issues.push({
          code: "href-before-g2",
          componentId: component.id,
          message: `${component.id}: page status "unpublished-pre-g2" forbids an href`,
        });
      }
    }

    if (
      pkg.pageStatus === "published" &&
      component.status !== "available"
    ) {
      issues.push({
        code: "published-with-incomplete-component",
        componentId: component.id,
        message: `${component.id}: page status "published" requires every component to be "available"`,
      });
    }
  }

  for (const requiredId of REQUIRED_REPLICATION_COMPONENT_IDS) {
    if (!seenIds.has(requiredId)) {
      issues.push({
        code: "missing-required-component",
        componentId: requiredId,
        message: `required component "${requiredId}" is missing from the inventory`,
      });
    }
  }

  return issues;
}

export interface ProhibitedAvailabilityMatch {
  phrase: string;
  match: string;
  index: number;
}

/**
 * Phrases that assert or imply the replication package currently exists
 * or can currently be downloaded/reproduced. A status-surface page must
 * never contain these regardless of which component they'd attach to.
 */
const PROHIBITED_AVAILABILITY_PATTERNS: ReadonlyArray<{
  phrase: string;
  pattern: RegExp;
}> = [
  { phrase: "Download", pattern: /\bdownload(?:able|s|ed|ing)?\b/gi },
  { phrase: "Shipped", pattern: /\bshipped\b/gi },
  { phrase: "Available now", pattern: /available now/gi },
  { phrase: "Get the CSV", pattern: /get the csv/gi },
  { phrase: "Reproduce every", pattern: /reproduce every/gi },
  {
    phrase: "Everything needed to reproduce",
    pattern: /everything needed to reproduce/gi,
  },
];

/** Scans arbitrary source copy for the prohibited-availability phrase
 *  list. Pure string in, matches out — callers decide which files/
 *  strings to scan. */
export function findProhibitedReplicationLanguage(
  content: string,
): ProhibitedAvailabilityMatch[] {
  const matches: ProhibitedAvailabilityMatch[] = [];

  for (const { phrase, pattern } of PROHIBITED_AVAILABILITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      matches.push({ phrase, match: match[0], index: match.index });
      if (match[0].length === 0) pattern.lastIndex++;
    }
  }

  return matches;
}
