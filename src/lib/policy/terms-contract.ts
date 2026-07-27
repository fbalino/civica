/**
 * BRD-013 — typed clause registry + pure validator for the published
 * Terms of Use page, cross-checked against API Docs and Licensing so a
 * published capability or rights claim cannot drift out of sync with
 * what the product actually does.
 *
 * Mirrors the `src/lib/policy/policy-surface.ts` pattern: this module is
 * pure (strings/objects in, an issue-code list out) with no file I/O;
 * `scripts/validate-terms-conditions.ts` reads the three source files and
 * exits non-zero on any issue.
 *
 * Ten clause topics are covered: acceptable use, attribution, rate
 * limits, uptime/no-warranty, data-accuracy/no-liability, embedding,
 * downloads/reuse-rights, account (none required), governing-terms
 * change, and contact. Each clause must (a) have a findable section in
 * Terms (a JSX `id="<anchor>"` on a `<section>`), (b) be stated in the
 * terms prose, and (c) not be contradicted by a claim anywhere across
 * Terms, API Docs, or Licensing.
 */

import { findAllProhibitedRightsLanguage } from "@/lib/claims/reuse-rights";

export const TERMS_CLAUSE_IDS = [
  "acceptable-use",
  "attribution",
  "rate-limits",
  "uptime-no-warranty",
  "data-accuracy-no-liability",
  "embedding",
  "downloads-reuse-rights",
  "account-none",
  "governing-terms-change",
  "contact",
] as const;

export type TermsClauseId = (typeof TERMS_CLAUSE_IDS)[number];

export interface TermsClause {
  id: TermsClauseId;
  label: string;
  /** JSX `id="..."` section anchor expected in src/app/terms/page.tsx. */
  anchor: string;
  /** At least one of these must match the terms prose for the clause to
   *  count as present. */
  requiredPatterns: readonly RegExp[];
  /** If any of these match the combined Terms + API Docs + Licensing
   *  text, the clause contradicts Civica's actual capabilities or
   *  rights posture and the surface must be corrected. */
  prohibitedPatterns: readonly RegExp[];
  description: string;
}

export const TERMS_CLAUSES: readonly TermsClause[] = [
  {
    id: "acceptable-use",
    label: "Acceptable use",
    anchor: "use",
    requiredPatterns: [/good faith/i, /do not attempt to[\s\S]*?(break|overload|scrape)/i],
    prohibitedPatterns: [
      /no (rate limits?|restrictions) (apply|whatsoever)/i,
      /unlimited (scraping|automated access)/i,
    ],
    description:
      "Readers may browse, cite, and link freely, but may not break, overload, or abusively scrape the site.",
  },
  {
    id: "attribution",
    label: "Attribution",
    anchor: "data-reuse",
    requiredPatterns: [/cite civica atlas/i],
    prohibitedPatterns: [
      /attribution is (never|not) required/i,
      /no citation (is )?(required|needed)/i,
    ],
    description:
      "Reusing Civica-derived outputs (Index, Pulse, reconciliation) requires citing Civica Atlas.",
  },
  {
    id: "rate-limits",
    label: "Rate limits",
    anchor: "use",
    requiredPatterns: [/rate limit/i],
    prohibitedPatterns: [
      /no rate limits? (apply|exist)/i,
      /unlimited requests/i,
      /export route (applies|has|enforces) a rate limit/i,
    ],
    description:
      "API use is bound by the published per-IP rate limits documented in API Docs; unrated routes are described as such, not silently assumed limited.",
  },
  {
    id: "uptime-no-warranty",
    label: "Uptime / no warranty",
    anchor: "accuracy",
    requiredPatterns: [/as is/i, /(may change|be unavailable)/i],
    prohibitedPatterns: [
      /100%\s*uptime/i,
      /guarantee(s|d)? (uptime|availability)/i,
      /always available/i,
    ],
    description: "Civica Atlas is provided as-is with no uptime guarantee.",
  },
  {
    id: "data-accuracy-no-liability",
    label: "Data accuracy / no liability",
    anchor: "accuracy",
    requiredPatterns: [/no warranty/i],
    prohibitedPatterns: [
      /guarantee(s|d)? (complete|total|full) accuracy/i,
      /always error-free/i,
    ],
    description:
      "No warranty that every data point is complete, current, or error-free; Civica disclaims liability for reliance on the data to the extent permitted by law.",
  },
  {
    id: "embedding",
    label: "Embedding",
    anchor: "embedding",
    requiredPatterns: [/retired/i, /410/],
    prohibitedPatterns: [
      /embed (a |the )?live (score|index|rank)/i,
      /interactive iframe widget is available/i,
      /embed widget (is|remains) (active|available|live)/i,
    ],
    description:
      "The legacy /embed/[slug] iframe widget is retired and returns 410 Gone; embedding terms live on Licensing.",
  },
  {
    id: "downloads-reuse-rights",
    label: "Downloads / reuse rights",
    anchor: "downloads",
    requiredPatterns: [/reuse license/i, /source-by-source|per-source/i],
    prohibitedPatterns: [
      /free access grants? (a )?reuse license/i,
      /all data (is|are) (open|free to reuse)/i,
      /download(ing)? grants? (a )?reuse license/i,
    ],
    description:
      "Free, no-account access to a download or the API is not itself a reuse license; reuse rights remain source-by-source.",
  },
  {
    id: "account-none",
    label: "Account (none required)",
    anchor: "use",
    requiredPatterns: [/no account is required/i],
    prohibitedPatterns: [/must create an account/i, /sign[- ]?up required/i],
    description: "No account or sign-up is required to use the site.",
  },
  {
    id: "governing-terms-change",
    label: "Governing terms / changes",
    anchor: "changes",
    requiredPatterns: [/update these terms/i, /last updated/i],
    prohibitedPatterns: [/terms (never|cannot) change/i],
    description:
      "These terms may be updated as the site evolves; the \"last updated\" date reflects the current version.",
  },
  {
    id: "contact",
    label: "Contact",
    anchor: "changes",
    requiredPatterns: [/contact page|\/contact/i],
    prohibitedPatterns: [/no way to contact/i],
    description: "Questions about these terms route to the contact page.",
  },
];

export type TermsConditionsIssueCode =
  | "missing-clause-anchor"
  | "missing-clause-phrase"
  | "contradicting-claim"
  | "prohibited-rights-language";

export interface TermsConditionsIssue {
  code: TermsConditionsIssueCode;
  clauseId?: TermsClauseId;
  message: string;
}

function hasSectionAnchor(source: string, anchor: string): boolean {
  return new RegExp(`id\\s*=\\s*["']${anchor}["']`).test(source);
}

/** JSX text nodes wrap freely across source lines/indentation (e.g. "No\n
 *  account is required" in the raw .tsx file renders as one sentence in
 *  the browser). Collapsing every whitespace run to a single space before
 *  phrase/contradiction matching means a clause's required or prohibited
 *  wording is found regardless of how the source happens to be wrapped. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Every registered clause must have a findable `<section id="...">`
 *  anchor in the Terms source. */
export function findMissingClauseAnchors(
  termsSource: string,
): TermsConditionsIssue[] {
  const normalized = normalizeWhitespace(termsSource);
  return TERMS_CLAUSES.filter(
    (clause) => !hasSectionAnchor(normalized, clause.anchor),
  ).map((clause) => ({
    code: "missing-clause-anchor" as const,
    clauseId: clause.id,
    message: `Terms is missing the "#${clause.anchor}" section required for the ${clause.label} clause`,
  }));
}

/** Every registered clause must actually be stated somewhere in the
 *  terms prose, not just have a heading. */
export function findMissingClausePhrases(
  termsSource: string,
): TermsConditionsIssue[] {
  const normalized = normalizeWhitespace(termsSource);
  return TERMS_CLAUSES.filter(
    (clause) => !clause.requiredPatterns.some((pattern) => pattern.test(normalized)),
  ).map((clause) => ({
    code: "missing-clause-phrase" as const,
    clauseId: clause.id,
    message: `Terms prose does not state the ${clause.label} clause (expected to match one of: ${clause.requiredPatterns
      .map((p) => p.source)
      .join(" | ")})`,
  }));
}

/** No clause may be contradicted by a claim anywhere across Terms, API
 *  Docs, or Licensing — e.g. Terms cannot describe embedding as retired
 *  while API Docs advertises a live embeddable widget. */
export function findContradictingClaims(
  combinedSource: string,
): TermsConditionsIssue[] {
  const normalized = normalizeWhitespace(combinedSource);
  const issues: TermsConditionsIssue[] = [];
  for (const clause of TERMS_CLAUSES) {
    for (const pattern of clause.prohibitedPatterns) {
      if (pattern.test(normalized)) {
        issues.push({
          code: "contradicting-claim",
          clauseId: clause.id,
          message: `Found a claim contradicting the ${clause.label} clause (pattern ${pattern.source} matched)`,
        });
      }
    }
  }
  return issues;
}

export interface ValidateTermsConditionsInput {
  termsSource: string;
  apiDocsSource: string;
  licensingSource: string;
}

/** Pure orchestration: combines anchor coverage, phrase coverage,
 *  cross-surface contradiction scanning, and the existing reuse-rights
 *  prohibited-language scanner applied to the terms prose itself. */
export function validateTermsConditions(
  input: ValidateTermsConditionsInput,
): TermsConditionsIssue[] {
  const issues: TermsConditionsIssue[] = [];

  issues.push(...findMissingClauseAnchors(input.termsSource));
  issues.push(...findMissingClausePhrases(input.termsSource));

  const combined = `${input.termsSource}\n${input.apiDocsSource}\n${input.licensingSource}`;
  issues.push(...findContradictingClaims(combined));

  for (const finding of findAllProhibitedRightsLanguage(input.termsSource)) {
    issues.push({
      code: "prohibited-rights-language",
      message: `Terms prose contains prohibited rights language: "${finding.match}" (${finding.ruleId})`,
    });
  }

  return issues;
}
