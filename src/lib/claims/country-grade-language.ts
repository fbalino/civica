/**
 * Static guard for Civica's neutral country-score presentation policy.
 *
 * Historical A-F helpers and the nullable database column remain available
 * for private replay, but public UI, API, export, embed, and metadata code must
 * not turn a numeric Civica estimate into a country grade or qualitative
 * verdict. The checks here are deliberately contextual so ordinary uses of
 * "authoritarian regime", Pulse severity tiers, source-quality tiers, and
 * statistical peer bands remain valid.
 */

export const HISTORICAL_GRADE_ARCHIVE_SENTINEL =
  "DEPRECATED HISTORICAL REPLAY ONLY";

const HISTORICAL_GRADE_ARCHIVES = new Set([
  "src/lib/ci/bands.ts",
  "src/lib/ci/tiers.ts",
]);

const PUBLIC_SCORE_RESPONSE_PREFIXES = [
  "src/app/api/v1/index/",
  "src/app/api/v1/countries/",
  "src/app/api/countries/",
  "src/app/embed/",
] as const;

export type CountryGradeLeakRuleId =
  | "archive-sentinel"
  | "deprecated-grade-module"
  | "deprecated-grade-helper"
  | "implicit-composite-select"
  | "legacy-band-read"
  | "public-grade-response-field"
  | "public-grade-history"
  | "public-grade-nomenclature"
  | "qualitative-country-scale"
  | "qualitative-country-verdict";

export interface CountryGradeLeak {
  ruleId: CountryGradeLeakRuleId;
  description: string;
  match: string;
  index: number;
}

export interface CountryGradeScanOptions {
  filePath: string;
  /** Scan imports, database reads, and public response fields. Default true. */
  scanStructure?: boolean;
  /** Scan prose and user-visible source strings. Default false. */
  scanCopy?: boolean;
}

interface Rule {
  id: CountryGradeLeakRuleId;
  description: string;
  pattern: RegExp;
}

const STRUCTURAL_RULES: readonly Rule[] = [
  {
    id: "deprecated-grade-module",
    description: "imports a historical country-grade module",
    pattern:
      /(?:from\s*|import\s*\()\s*["'][^"']*(?:\/lib\/ci\/|\/ci\/)(?:bands|tiers)["']/g,
  },
  {
    id: "deprecated-grade-helper",
    description: "uses a historical country-grade helper",
    pattern:
      /\b(?:scoreToBand|bandLabel|ciTier|BAND_RANGES|CI_TIER_LEGEND)\b/g,
  },
  {
    id: "implicit-composite-select",
    description:
      "selects a full ciCompositeScores row instead of an explicit projection",
    pattern:
      /\.select\s*\(\s*\)(?=[\s\S]{0,800}?\.from\s*\(\s*ciCompositeScores\s*\))/g,
  },
  {
    id: "legacy-band-read",
    description: "reads the historical Civica composite band field",
    pattern:
      /\b(?:ciCompositeScores|ciComposite|composite|cs|ci_composite_scores)\s*\.\s*band\b/gi,
  },
  {
    id: "legacy-band-read",
    description: "selects the historical band column from ci_composite_scores",
    pattern:
      /(?:\bselect\b[\s\S]{0,300}\bband\b[\s\S]{0,300}\bfrom\s+ci_composite_scores\b|\bfrom\s+ci_composite_scores\b[\s\S]{0,300}\bband\b)/gi,
  },
];

const RESPONSE_FIELD_RULES: readonly Rule[] = [
  {
    id: "public-grade-response-field",
    description: "declares a public country-score grade/band/tier field",
    pattern:
      /(?:^|[,{]\s*)(?:["']?(?:band|grade|tier)["']?)\s*:/gm,
  },
  {
    id: "public-grade-response-field",
    description: "returns a shorthand public country-score grade/band/tier field",
    pattern: /[,{]\s*(?:band|grade|tier)\s*[,}]/g,
  },
];

const GRADE_NOMENCLATURE_PATTERN =
  /\b(?:A\s*[\u2013-]\s*F|A\s+through\s+F|letter grades?|rank bands?|score bands?|country grades?)\b/gi;

const PUBLIC_GRADE_HISTORY_PATTERN =
  /\b(?:formerly|previously|used to|retired|retirement|legacy|changed from|replaced)\b[^.!?\n]{0,100}\b(?:grades?|bands?|tiers?)\b|\b(?:grades?|bands?|tiers?)\b[^.!?\n]{0,100}\b(?:formerly|previously|used to|retired|retirement|legacy|changed|replaced)\b/gi;

const AUTHORITARIAN_GRADE_PATTERN =
  /\b(?:authoritarian(?:\s+country)?(?:\s+score)?\s+(?:grade|band|verdict)|(?:grade|band|verdict)\s+(?:label(?:l?ed)?\s+|called\s+)?authoritarian)\b/gi;

const QUALITATIVE_LABELS = [
  "Exceptional",
  "Strong",
  "Mixed",
  "Weak",
  "Very weak",
  "Failed",
] as const;

const QUALITATIVE_LABEL_PATTERN =
  /(["'`])(Exceptional|Strong|Mixed|Weak|Very weak|Failed)\1|>\s*(Exceptional|Strong|Mixed|Weak|Very weak|Failed)\s*</g;

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isHistoricalArchive(filePath: string): boolean {
  return HISTORICAL_GRADE_ARCHIVES.has(normalizePath(filePath));
}

function isPublicScoreResponse(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return PUBLIC_SCORE_RESPONSE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

function isCodeFile(filePath: string): boolean {
  return /\.tsx?$/.test(filePath);
}

/** Mask comments while preserving length/newlines so reported indices stay exact. */
function maskComments(source: string): string {
  let output = "";
  let index = 0;
  type Mode = "code" | "line" | "block" | "single" | "double" | "template";
  let mode: Mode = "code";

  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];

    if (mode === "code") {
      if (current === "/" && next === "/") {
        mode = "line";
        output += "  ";
        index += 2;
        continue;
      }
      if (current === "/" && next === "*") {
        mode = "block";
        output += "  ";
        index += 2;
        continue;
      }
      if (current === "'") mode = "single";
      else if (current === '"') mode = "double";
      else if (current === "`") mode = "template";
      output += current;
      index++;
      continue;
    }

    if (mode === "line") {
      if (current === "\n") {
        mode = "code";
        output += current;
      } else {
        output += current === "\t" ? "\t" : " ";
      }
      index++;
      continue;
    }

    if (mode === "block") {
      if (current === "*" && next === "/") {
        mode = "code";
        output += "  ";
        index += 2;
        continue;
      }
      output += current === "\n" ? "\n" : current === "\t" ? "\t" : " ";
      index++;
      continue;
    }

    output += current;
    if (current === "\\") {
      output += source[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (mode === "single" && current === "'") mode = "code";
    else if (mode === "double" && current === '"') mode = "code";
    else if (mode === "template" && current === "`") mode = "code";
    index++;
  }

  return output;
}

/** Prevent lowercase JSX tag names such as `<strong>` from looking like copy. */
function maskJsxTagNames(source: string): string {
  return source.replace(
    /(<\/?)([A-Za-z][A-Za-z0-9.]*)/g,
    (_match, opening: string, name: string) =>
      `${opening}${" ".repeat(name.length)}`,
  );
}

function addRuleMatches(
  matches: CountryGradeLeak[],
  content: string,
  rule: Rule,
): void {
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

function contextWindow(content: string, index: number, length: number): string {
  return content.slice(
    Math.max(0, index - 140),
    Math.min(content.length, index + length + 140),
  );
}

function hasCountryScoreContext(window: string): boolean {
  return (
    /\b(?:Civica(?: Index)?|country scores?|governance scores?)\b/i.test(
      window,
    ) || /\bCI\b/.test(window)
  );
}

function isExplicitCurrentLimitation(window: string): boolean {
  return (
    /\b(?:no|not|without|never|does not|do not|is not|are not|isn't|aren't|don't)\b[^.!?\n]{0,90}\b(?:grades?|bands?|tiers?|verdicts?)\b/i.test(
      window,
    ) ||
    /\b(?:grades?|bands?|tiers?|verdicts?)\b[^.!?\n]{0,50}\b(?:are not|is not|aren't|isn't|never)\b/i.test(
      window,
    )
  );
}

function collectQualitativeLabels(content: string): Array<{
  label: (typeof QUALITATIVE_LABELS)[number];
  index: number;
  raw: string;
}> {
  const labels: Array<{
    label: (typeof QUALITATIVE_LABELS)[number];
    index: number;
    raw: string;
  }> = [];
  QUALITATIVE_LABEL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = QUALITATIVE_LABEL_PATTERN.exec(content)) !== null) {
    const candidate = match[2] ?? match[3];
    if (!QUALITATIVE_LABELS.some((label) => label === candidate)) continue;
    const label = candidate as (typeof QUALITATIVE_LABELS)[number];
    labels.push({ label, index: match.index, raw: match[0] });
  }
  return labels;
}

export function findCountryGradeLeaks(
  content: string,
  options: CountryGradeScanOptions,
): CountryGradeLeak[] {
  const matches: CountryGradeLeak[] = [];
  const normalizedPath = normalizePath(options.filePath);
  const scanStructure = options.scanStructure ?? true;

  if (isHistoricalArchive(normalizedPath)) {
    if (!content.includes(HISTORICAL_GRADE_ARCHIVE_SENTINEL)) {
      matches.push({
        ruleId: "archive-sentinel",
        description: "historical country-grade archive is missing its sentinel",
        match: normalizedPath,
        index: 0,
      });
    }
    return matches;
  }

  const commentMasked = isCodeFile(normalizedPath)
    ? maskComments(content)
    : content;

  if (scanStructure && isCodeFile(normalizedPath)) {
    for (const rule of STRUCTURAL_RULES) {
      addRuleMatches(matches, commentMasked, rule);
    }
    if (isPublicScoreResponse(normalizedPath)) {
      for (const rule of RESPONSE_FIELD_RULES) {
        addRuleMatches(matches, commentMasked, rule);
      }
    }
  }

  if (!options.scanCopy) return matches;

  const copy = isCodeFile(normalizedPath)
    ? maskJsxTagNames(commentMasked)
    : commentMasked;

  PUBLIC_GRADE_HISTORY_PATTERN.lastIndex = 0;
  let historyMatch: RegExpExecArray | null;
  while ((historyMatch = PUBLIC_GRADE_HISTORY_PATTERN.exec(copy)) !== null) {
    const window = contextWindow(copy, historyMatch.index, historyMatch[0].length);
    if (!hasCountryScoreContext(window)) continue;
    matches.push({
      ruleId: "public-grade-history",
      description: "publishes unnecessary country-grade migration history",
      match: historyMatch[0],
      index: historyMatch.index,
    });
  }

  GRADE_NOMENCLATURE_PATTERN.lastIndex = 0;
  let gradeMatch: RegExpExecArray | null;
  while ((gradeMatch = GRADE_NOMENCLATURE_PATTERN.exec(copy)) !== null) {
    const window = contextWindow(copy, gradeMatch.index, gradeMatch[0].length);
    if (!hasCountryScoreContext(window)) continue;
    if (isExplicitCurrentLimitation(window)) continue;
    matches.push({
      ruleId: "public-grade-nomenclature",
      description: "presents grade/band nomenclature for a Civica country score",
      match: gradeMatch[0],
      index: gradeMatch.index,
    });
  }

  addRuleMatches(matches, copy, {
    id: "qualitative-country-verdict",
    description: "uses authoritarian as a country score-band verdict",
    pattern: AUTHORITARIAN_GRADE_PATTERN,
  });

  const labels = collectQualitativeLabels(copy);
  const uniqueLabels = new Set(labels.map((entry) => entry.label));
  if (
    uniqueLabels.size >= 4 &&
    hasCountryScoreContext(copy)
  ) {
    const first = labels[0];
    matches.push({
      ruleId: "qualitative-country-scale",
      description: "reconstructs the historical qualitative country-score scale",
      match: [...uniqueLabels].join(", "),
      index: first.index,
    });
  }

  for (const entry of labels) {
    const window = contextWindow(copy, entry.index, entry.raw.length);
    if (!hasCountryScoreContext(window)) continue;
    if (isExplicitCurrentLimitation(window)) continue;
    matches.push({
      ruleId: "qualitative-country-verdict",
      description: "assigns a qualitative verdict to a Civica country score",
      match: entry.raw,
      index: entry.index,
    });
  }

  return matches;
}
