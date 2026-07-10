/**
 * High-authority phrases that Civica cannot use positively before the evidence
 * gate named by the claims policy. These are intentionally narrow: ordinary
 * technical uses of "validated" or "authoritative coordinate space" are not
 * public standing claims and should not create false positives.
 */

export interface AuthorityLanguageRule {
  id: string;
  description: string;
  pattern: RegExp;
}

export const UNQUALIFIED_AUTHORITY_LANGUAGE_RULES: readonly AuthorityLanguageRule[] = [
  {
    id: "academic-standing",
    description: "claims that Civica is already academically citable or academic-grade",
    pattern:
      /academically citable|academic[- ]grade|research[- ]lab[- ]grade|academic publication with a UI/gi,
  },
  {
    id: "citation-without-limits",
    description: "claims that readers can cite Civica without a qualification",
    pattern: /citable without disclaimer|cite without disclaimer/gi,
  },
  {
    id: "definitive-method-standing",
    description: "claims definitive methodological standing",
    pattern: /methodologically defensible reference|methodological gold standard/gi,
  },
  {
    id: "latent-governance-health",
    description: "presents the Index as the governance health of a country",
    pattern: /governance health of every country|governance health score/gi,
  },
  {
    id: "unsupported-confidence-interval",
    description: "labels the current Monte Carlo sensitivity range a confidence interval",
    pattern:
      /90% confidence intervals?|90% CI\b|Monte Carlo uncertainty intervals?|\buncertainty interval\b/gi,
  },
  {
    id: "blanket-source-authority",
    description: "uses blanket authority language instead of a named source and scope",
    pattern:
      /multiple authoritative publishers|multiple authoritative sources|authoritative sources|authoritative reference|concurrently authoritative/gi,
  },
  {
    id: "daily-governance-measure",
    description: "presents Pulse as an established daily or real-time governance measure",
    pattern:
      /daily governance (?:score|signal|measure|monitor)|real[- ]time governance monitor/gi,
  },
  {
    id: "empirical-weight-overclaim",
    description: "describes the current underpowered weights as empirically derived",
    pattern: /empirically[- ]derived weights/gi,
  },
  {
    id: "blanket-reuse-rights",
    description: "claims mixed-source data is uniformly open or free to reuse",
    pattern:
      /all data is free to use|data is free to reuse with attribution|Civica data is free to use with attribution|Open data, free to use with attribution/gi,
  },
  {
    id: "unsupported-comprehensiveness",
    description: "claims an untested superlative for atlas coverage",
    pattern: /most comprehensive open reference/gi,
  },
];

export interface AuthorityLanguageMatch {
  ruleId: string;
  description: string;
  match: string;
  index: number;
}

export function findUnqualifiedAuthorityLanguage(
  content: string,
): AuthorityLanguageMatch[] {
  const matches: AuthorityLanguageMatch[] = [];

  for (const rule of UNQUALIFIED_AUTHORITY_LANGUAGE_RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(content)) !== null) {
      matches.push({
        ruleId: rule.id,
        description: rule.description,
        match: match[0],
        index: match.index,
      });
      if (match[0].length === 0) rule.pattern.lastIndex++;
    }
  }

  return matches;
}
