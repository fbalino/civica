/**
 * Group a constitution's flat article list into a navigable outline.
 *
 * `structured_articles` is a flat sequence of parsed sections whose
 * `headingLabel` is either a "part" heading ("Preamble", "Title I. …",
 * "Chapter 2", "Part III", "Schedule 1") or an "article" heading ("ARTICLE 1",
 * "Section 5", "Art. 12"). Constitutions run 100–400 sections, so a flat nav is
 * unusable; we fold consecutive articles under the most recent part heading.
 *
 * When a constitution has no part headings at all (some do not), the result is
 * a single implicit "Articles" group holding every distinct article — still a
 * compact list because consecutive sections sharing a headingLabel (a multi-
 * clause article) collapse to one nav entry.
 *
 * Pure + deterministic so it can run on the server (nav ids) and the client
 * (scroll-spy) and serialize identically.
 */
import type { ConstitutionArticle } from "@/lib/db/queries-constitution";

export interface ArticleNavEntry {
  /** DOM id of the first section for this article, e.g. `sec-section-8`. */
  id: string;
  /** The article/section heading, e.g. "ARTICLE 1". */
  label: string;
}

export interface ArticleNavGroup {
  /** DOM id of this part's heading anchor, e.g. `part-3`. */
  id: string;
  /** The part heading, e.g. "Title II. THE PRESIDENT", or "Articles". */
  label: string;
  entries: ArticleNavEntry[];
}

/** A section decorated with a stable DOM id + whether it opens a new part. */
export interface RenderableSection extends ConstitutionArticle {
  /** Stable DOM id for scroll-spy + anchor links. */
  domId: string;
  /** When set, this section starts a new nav part (id matches the group id). */
  partId: string | null;
  /** When true, this section is the first occurrence of its article heading. */
  isArticleStart: boolean;
}

const PART_RE =
  /^(preamble|title\b|chapter\b|part\b|schedule\b|division\b|book\b|section\s+[A-Z]\b)/i;

/** True when a heading opens a top-level part rather than a single article. */
function isPartHeading(label: string): boolean {
  return PART_RE.test(label.trim());
}

/** Slugify a section id (`section/8`) into a DOM-safe id (`sec-section-8`). */
export function constitutionSectionDomId(sectionId: string, index = 0): string {
  const base = (sectionId || `s${index}`).replace(/[^a-zA-Z0-9]+/g, "-");
  return `sec-${base}`;
}

export interface ArticleNavResult {
  sections: RenderableSection[];
  groups: ArticleNavGroup[];
}

export function buildArticleNav(
  articles: ConstitutionArticle[],
): ArticleNavResult {
  const sections: RenderableSection[] = [];
  const groups: ArticleNavGroup[] = [];

  let currentGroup: ArticleNavGroup | null = null;
  let partCounter = 0;
  let lastArticleLabel: string | null = null;

  const ensureImplicitGroup = () => {
    if (currentGroup) return currentGroup;
    partCounter += 1;
    currentGroup = { id: `part-${partCounter}`, label: "Articles", entries: [] };
    groups.push(currentGroup);
    return currentGroup;
  };

  articles.forEach((article, index) => {
    const label = article.headingLabel || "Untitled";
    const domId = constitutionSectionDomId(article.sectionId, index);
    const partHeading = isPartHeading(label);

    if (partHeading) {
      // A new part. If a group with this exact label was JUST opened and holds
      // no entries yet (a part heading repeated across split sections), reuse
      // it rather than creating an empty duplicate.
      if (currentGroup && currentGroup.label === label && currentGroup.entries.length === 0) {
        sections.push({ ...article, domId, partId: null, isArticleStart: false });
        return;
      }
      partCounter += 1;
      currentGroup = { id: `part-${partCounter}`, label, entries: [] };
      groups.push(currentGroup);
      lastArticleLabel = null;
      sections.push({
        ...article,
        domId,
        partId: currentGroup.id,
        isArticleStart: false,
      });
      return;
    }

    // Article heading. Fold consecutive sections sharing a headingLabel into a
    // single nav entry (a multi-clause article renders as several sections).
    const group = ensureImplicitGroup();
    const isNewArticle = label !== lastArticleLabel;
    if (isNewArticle) {
      group.entries.push({ id: domId, label });
      lastArticleLabel = label;
    }
    sections.push({
      ...article,
      domId,
      partId: null,
      isArticleStart: isNewArticle,
    });
  });

  // Drop empty groups (e.g. a trailing part heading with no articles under it
  // still gets a nav row, but a group that never received a heading anchor and
  // has no entries is noise).
  const cleaned = groups.filter(
    (g) => g.entries.length > 0 || g.label !== "Articles",
  );

  return { sections, groups: cleaned };
}
