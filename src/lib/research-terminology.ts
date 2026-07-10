/**
 * Research-terminology registry (CLM-015).
 *
 * Canonical, typed source of truth for the 14 research-vocabulary terms
 * that gate how Civica describes evidence: source, observation, fact,
 * reconciliation, estimate, indicator, index, signal, event, confidence,
 * uncertainty, validation, replication, peer review.
 *
 * Two consumers read this file:
 *   - `src/lib/data/glossary.ts` generates the public glossary entries
 *     for these 14 terms from `RESEARCH_TERMS` (no second, hand-copied
 *     prose array).
 *   - `scripts/validate-research-terminology.ts` (via `lintTerminology`)
 *     scans `RESEARCH_TERMINOLOGY_SURFACES` for the narrow prohibited
 *     usages in `PROHIBITED_USAGE_RULES`.
 *
 * The lint is deliberately narrow: it targets specific overclaim shapes
 * (an unqualified "validated"/"peer-reviewed"/"confidence interval"/
 * "replicated" claim about a Civica output) rather than banning the
 * words themselves. Explicit negation, future-gated language, external
 * citations, and implementation-level (schema/software) validation are
 * all allowed — see each rule's `allow` pattern.
 */

/* ────────────────────────────────────────────────────────────────
 * Terms
 * ──────────────────────────────────────────────────────────────── */

export const RESEARCH_TERM_IDS = [
  "source",
  "observation",
  "fact",
  "reconciliation",
  "estimate",
  "indicator",
  "index",
  "signal",
  "event",
  "confidence",
  "uncertainty",
  "validation",
  "replication",
  "peer-review",
] as const;

export type ResearchTermId = (typeof RESEARCH_TERM_IDS)[number];

export interface ResearchTermMethodLink {
  /** Visible label. */
  label: string;
  /** Internal href — a methodology page or in-page anchor. */
  href: string;
}

export interface ResearchTerm {
  /** Stable id, matches `ResearchTermId`. */
  id: ResearchTermId;
  /** Display term (Title Case). */
  term: string;
  /** Normative definition — what Civica means by this word, and what
   *  it deliberately does NOT claim. This is the text the public
   *  glossary entry is generated from. */
  definition: string;
  /** Methodology pages this term's usage is governed by. */
  methodLinks: ResearchTermMethodLink[];
}

export const RESEARCH_TERMS: ResearchTerm[] = [
  {
    id: "source",
    term: "Source",
    definition:
      "An identified publisher, dataset, document, feed, or instrument from which Civica obtains an input. Its record carries origin, vintage/retrieval, rights, and freshness where available. Naming a source does not by itself establish independence or corroboration.",
    methodLinks: [{ label: "How we approach data", href: "/methodology/approach" }],
  },
  {
    id: "observation",
    term: "Observation",
    definition:
      "One value or statement recorded for an entity and time by a source, before Civica chooses among competing inputs. It retains source/vintage/method metadata.",
    methodLinks: [
      { label: "Reconciliation methodology", href: "/country/methodology/reconciliation" },
    ],
  },
  {
    id: "fact",
    term: "Fact",
    definition:
      "A publishable factual statement or value, explicitly classed as source-reported or reconciled and linked to provenance. It is not a claim of absolute or universal truth.",
    methodLinks: [
      { label: "How we approach data", href: "/methodology/approach" },
      { label: "Reconciliation methodology", href: "/country/methodology/reconciliation" },
    ],
  },
  {
    id: "reconciliation",
    term: "Reconciliation",
    definition:
      "A versioned, reviewable rule process that selects or combines competing observations into a canonical fact while preserving alternatives and disputes. It is not independent verification.",
    methodLinks: [
      { label: "Reconciliation methodology", href: "/country/methodology/reconciliation" },
    ],
  },
  {
    id: "estimate",
    term: "Estimate",
    definition:
      "A source-reported or Civica-derived quantity that is not a direct observation and depends on a declared method, assumptions, or incomplete inputs. It retains method/vintage/uncertainty status.",
    methodLinks: [{ label: "Civica Index methodology", href: "/civica-index/methodology" }],
  },
  {
    id: "indicator",
    term: "Indicator",
    definition:
      "A defined measurable variable used as an input or descriptor. It does not by itself constitute an overall governance verdict.",
    methodLinks: [{ label: "Civica Index methodology", href: "/civica-index/methodology" }],
  },
  {
    id: "index",
    term: "Index",
    definition:
      "A composite produced by transforming and aggregating multiple indicators under declared rules and weights. It is method-dependent, not objective truth; Civica's current Index is research Beta.",
    methodLinks: [{ label: "Civica Index methodology", href: "/civica-index/methodology" }],
  },
  {
    id: "signal",
    term: "Signal",
    definition:
      "A provisional pattern, flag, or model/rule output that may warrant attention. It is not automatically a fact or validated measurement; current Pulse dimensional effects are experimental heuristics.",
    methodLinks: [{ label: "Pulse methodology", href: "/civica-index/methodology/pulse" }],
  },
  {
    id: "event",
    term: "Event",
    definition:
      "A bounded real-world occurrence represented in the Pulse ledger from one or more records. The ledger entry can include inferred clustering/classification and must expose source/review state.",
    methodLinks: [{ label: "Pulse methodology", href: "/civica-index/methodology/pulse" }],
  },
  {
    id: "confidence",
    term: "Confidence",
    definition:
      "The stated strength of evidence, model agreement, or review outcome under a named procedure. It is not automatically a calibrated probability or statistical confidence interval.",
    methodLinks: [
      { label: "Civica Index methodology", href: "/civica-index/methodology" },
      { label: "Pulse methodology", href: "/civica-index/methodology/pulse" },
    ],
  },
  {
    id: "uncertainty",
    term: "Uncertainty",
    definition:
      "Documented limits, ranges, missingness, disagreement, or sensitivity arising from inputs and method. A sensitivity range is not a confidence interval unless a justified statistical model makes it one.",
    methodLinks: [{ label: "Civica Index methodology", href: "/civica-index/methodology" }],
  },
  {
    id: "validation",
    term: "Validation",
    definition:
      "Evaluation against a declared test, benchmark, dataset, or human standard. Software/schema checks validate implementation behavior; they do not by themselves scientifically validate an Index or signal.",
    methodLinks: [
      { label: "Civica Index methodology", href: "/civica-index/methodology" },
      { label: "Pulse methodology", href: "/civica-index/methodology/pulse" },
    ],
  },
  {
    id: "replication",
    term: "Replication",
    definition:
      "An independent rerun using released inputs, code, environment, and instructions that reproduces declared outputs within stated tolerances. A planned or package-status page is not completed replication.",
    methodLinks: [{ label: "Civica Index replication status", href: "/civica-index/replication" }],
  },
  {
    id: "peer-review",
    term: "Peer Review",
    definition:
      "Substantive evaluation by qualified independent experts under a disclosed process. Informal feedback, automated review, advisory-board applications, or internal agent critique are not peer review.",
    methodLinks: [{ label: "Civica Index methodology", href: "/civica-index/methodology" }],
  },
];

export interface TerminologyRegistryIssue {
  ruleId: string;
  message: string;
}

/** Pure structural checks shared by unit tests and the filesystem validator. */
export function validateResearchTerminologyRegistry(
  terms: readonly ResearchTerm[] = RESEARCH_TERMS,
): TerminologyRegistryIssue[] {
  const issues: TerminologyRegistryIssue[] = [];
  const expected = new Set<string>(RESEARCH_TERM_IDS);
  const seen = new Set<string>();

  for (const term of terms) {
    if (seen.has(term.id)) {
      issues.push({
        ruleId: "duplicate-term-id",
        message: `Research term id "${term.id}" appears more than once.`,
      });
    }
    seen.add(term.id);

    if (!expected.has(term.id)) {
      issues.push({
        ruleId: "unexpected-term-id",
        message: `Unexpected research term id "${term.id}".`,
      });
    }
    if (!term.term.trim() || !term.definition.trim()) {
      issues.push({
        ruleId: "incomplete-term",
        message: `Research term "${term.id}" needs a display term and definition.`,
      });
    }
    if (term.methodLinks.length === 0) {
      issues.push({
        ruleId: "missing-method-link",
        message: `Research term "${term.id}" needs at least one public method link.`,
      });
    }
    for (const link of term.methodLinks) {
      if (!link.label.trim() || !link.href.startsWith("/")) {
        issues.push({
          ruleId: "invalid-method-link",
          message: `Research term "${term.id}" has an invalid method link.`,
        });
      }
    }
  }

  for (const id of RESEARCH_TERM_IDS) {
    if (!seen.has(id)) {
      issues.push({
        ruleId: "missing-term-id",
        message: `Required research term id "${id}" is missing.`,
      });
    }
  }

  return issues;
}

/* ────────────────────────────────────────────────────────────────
 * Registered surfaces — canonical methodology content the lint scans
 * ──────────────────────────────────────────────────────────────── */

export type ResearchTerminologySurfaceKind = "reader-markdown" | "reader-tsx";

export interface ResearchTerminologySurface {
  /** Stable id for reporting. */
  id: string;
  /** Repo-relative path. */
  path: string;
  kind: ResearchTerminologySurfaceKind;
}

/**
 * Canonical research/methodology surfaces — the reader-facing pages
 * whose claims about evidence quality are load-bearing. Ordinary UI
 * copy, blog posts, and marketing prose are deliberately NOT included;
 * the lint is narrow by design (see module doc).
 */
export const RESEARCH_TERMINOLOGY_SURFACES: ResearchTerminologySurface[] = [
  { id: "methodology-overview", path: "content/methodology-overview.md", kind: "reader-markdown" },
  { id: "methodology-approach", path: "content/data-approach.md", kind: "reader-markdown" },
  { id: "ci-methodology", path: "content/methodology-civica-index.md", kind: "reader-markdown" },
  {
    id: "peer-grouping-methodology",
    path: "content/methodology-peer-grouping.md",
    kind: "reader-markdown",
  },
  { id: "pulse-methodology", path: "content/methodology-pulse.md", kind: "reader-markdown" },
  { id: "pca-appendix", path: "content/methodology-pca-appendix.md", kind: "reader-markdown" },
  {
    id: "reconciliation-methodology",
    path: "src/app/(reader)/country/methodology/reconciliation/page.tsx",
    kind: "reader-tsx",
  },
  {
    id: "replication-status",
    path: "src/app/(reader)/civica-index/replication/page.tsx",
    kind: "reader-tsx",
  },
];

/* ────────────────────────────────────────────────────────────────
 * Prohibited-usage lint
 * ──────────────────────────────────────────────────────────────── */

export interface TerminologyViolation {
  ruleId: string;
  termIds: ResearchTermId[];
  sentence: string;
  reason: string;
}

interface ProhibitedUsageRule {
  id: string;
  termIds: ResearchTermId[];
  description: string;
  /** Any one of these matching the sentence flags it as affirmative. */
  affirmative: RegExp[];
  /** If this also matches the sentence, the affirmative match is
   *  allowed (negation, future gate, external citation, or an
   *  implementation-level use of the word). */
  allow: RegExp;
}

const NO_ALLOWANCE = /$^/;

const CONFIDENCE_INTERVAL_ALLOW =
  /\b(not|n't|isn't|doesn't|does not|distinct from|rather than|instead of)\b/i;

const REPLICATION_ALLOW =
  /\b(not|n't|no|unpublished|pending|in preparation|planned|will be|targeted for|not yet|archive|external|dataset|roadmap)\b/i;

const CIVICA_RESEARCH_SUBJECT =
  String.raw`(?:Civica(?: Atlas)?(?: Index| Pulse)?|(?:the|our|this) (?:Civica )?(?:Index|Pulse|methodology|method|score|signal|measure(?:ment)?))`;

export const PROHIBITED_USAGE_RULES: ProhibitedUsageRule[] = [
  {
    id: "unqualified-validated-claim",
    termIds: ["validation"],
    description:
      'Affirmative "validated" claim about a Civica methodology/Index/Pulse/score/signal without a research gate, negation, or implementation-level (schema/software) qualifier.',
    affirmative: [
      new RegExp(
        String.raw`\b${CIVICA_RESEARCH_SUBJECT}\b(?![^.!?]{0,40}\b(?:schema|input|software|implementation|api|request|response)\b)[^.!?]{0,40}\b(?:is|are|was|were|has been|have been)\s+(?:now\s+)?(?:scientifically\s+|academically\s+|independently\s+)?validated\b`,
        "i",
      ),
      /\b(scientifically|academically|independently)\s+validated\s+(Civica\s+)?(Index|Pulse|methodology|method|score|signal|measure(?:ment)?)\b/i,
    ],
    allow: NO_ALLOWANCE,
  },
  {
    id: "unqualified-peer-review-claim",
    termIds: ["peer-review"],
    description:
      "Affirmative peer-reviewed / has-undergone-peer-review claim about a Civica output without negation, a future plan, or an external-literature context.",
    affirmative: [
      new RegExp(
        String.raw`\b${CIVICA_RESEARCH_SUBJECT}\b[^.!?]{0,80}\b(?:is|are|was|were|has been|have been|has undergone|have undergone)\s+(?:a\s+)?peer[- ]review(?:ed)?\b`,
        "i",
      ),
      /\bpeer[- ]reviewed\s+(Civica\s+)?(Index|Pulse|methodology|method|score|signal|measure(?:ment)?)\b/i,
    ],
    allow: NO_ALLOWANCE,
  },
  {
    id: "unqualified-confidence-interval",
    termIds: ["confidence", "uncertainty"],
    description:
      'A Civica sensitivity/simulation range called a "confidence interval" without the same-sentence distinction Civica requires ("not a confidence interval").',
    affirmative: [/\bconfidence interval(s)?\b/i],
    allow: CONFIDENCE_INTERVAL_ALLOW,
  },
  {
    id: "unqualified-replication-claim",
    termIds: ["replication"],
    description:
      "Affirmative claim that Civica's Index/Pulse/method has been independently replicated, or that a replication package is published/available, while the canonical replication state is unpublished.",
    affirmative: [
      /\b(has been|have been|is|are)\s+(independently\s+)?replicated\b/i,
      /\breplication package\b[^.?!]{0,40}\b(is|has been|are|have been)\b[^.?!]{0,20}\b(published|available|live)\b/i,
    ],
    allow: REPLICATION_ALLOW,
  },
];

/** Splits prose into loose sentence-ish chunks for local (same-sentence)
 *  context checks. Not a full NLP sentence splitter — good enough for a
 *  narrow, false-positive-resistant lint over markdown/TSX prose. */
export function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Scans `text` for the prohibited-usage rules and returns every
 *  violating sentence, tagged with the rule that flagged it. */
export function lintTerminology(text: string): TerminologyViolation[] {
  const violations: TerminologyViolation[] = [];
  for (const sentence of splitIntoSentences(text)) {
    for (const rule of PROHIBITED_USAGE_RULES) {
      const isAffirmative = rule.affirmative.some((re) => re.test(sentence));
      if (isAffirmative && !rule.allow.test(sentence)) {
        violations.push({
          ruleId: rule.id,
          termIds: rule.termIds,
          sentence,
          reason: rule.description,
        });
      }
    }
  }
  return violations;
}
