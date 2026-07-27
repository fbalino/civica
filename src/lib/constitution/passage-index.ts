import { createHash } from "node:crypto";
import { parse } from "node-html-parser";
import { constitutionSectionDomId } from "./article-nav";
import {
  CONSTITUTION_PASSAGE_LANGUAGE,
  CONSTITUTION_PASSAGE_SCHEMA_VERSION,
} from "./passage-contract";

export {
  CONSTITUTION_PASSAGE_LANGUAGE,
  CONSTITUTION_PASSAGE_LANGUAGE_BASIS,
  CONSTITUTION_PASSAGE_SCHEMA_VERSION,
  CONSTITUTION_PASSAGE_TRANSLATION_STATUS,
  CONSTITUTION_SEARCH_INDEX_VERSION,
} from "./passage-contract";

export interface ConstitutionPassageSourceArticle {
  sectionId: string;
  headingLabel: string | null;
  topics: string[];
  html: string;
}

export interface ConstitutionPassageIdentityInput {
  sourceDocumentId: string;
  sourceSectionId: string;
  plainText: string;
  languageCode?: string;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Plain text used by both the passage hash and PostgreSQL search document. */
export function normalizeConstitutionPlainText(html: string): string {
  if (!html.trim()) return "";
  const root = parse(html);
  for (const selector of [
    "script",
    "style",
    "noscript",
    "template",
    "iframe",
    "object",
    "embed",
    "form",
  ]) {
    for (const node of root.querySelectorAll(selector)) node.remove();
  }
  return root.structuredText.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function constitutionPassageContentHash(plainText: string): string {
  return sha256Hex(plainText.normalize("NFKC"));
}

/**
 * A passage id is source-version and content bound. A publisher revision gets
 * a new id while the superseded row remains resolvable for citation.
 */
export function constitutionPassageId(
  input: ConstitutionPassageIdentityInput,
): string {
  const languageCode = input.languageCode ?? CONSTITUTION_PASSAGE_LANGUAGE;
  const contentHash = constitutionPassageContentHash(input.plainText);
  const identity = [
    CONSTITUTION_PASSAGE_SCHEMA_VERSION,
    "constitute_project",
    input.sourceDocumentId,
    languageCode,
    input.sourceSectionId,
    contentHash,
  ].join("\u001f");
  return `constitution-passage/sha256:${sha256Hex(identity)}`;
}

/** Canonical anchor shared by search results and the constitution reader. */
export function constitutionSectionAnchor(
  sectionId: string,
  fallbackIndex = 0,
): string {
  return constitutionSectionDomId(sectionId, fallbackIndex);
}

export interface PreparedConstitutionPassage {
  passageId: string;
  sourceSectionId: string;
  sectionOrder: number;
  anchorId: string;
  headingLabel: string | null;
  topicKeys: string[];
  plainText: string;
  contentSha256: string;
}

export function prepareConstitutionPassages(
  sourceDocumentId: string,
  articles: readonly ConstitutionPassageSourceArticle[],
): PreparedConstitutionPassage[] {
  const seenSections = new Set<string>();
  const seenPassages = new Set<string>();
  const passages: PreparedConstitutionPassage[] = [];

  articles.forEach((article, sectionOrder) => {
    const sourceSectionId = article.sectionId.trim();
    if (!sourceSectionId) {
      throw new Error(`Constitution passage ${sectionOrder} has no section id`);
    }
    if (seenSections.has(sourceSectionId)) {
      throw new Error(`Duplicate constitution section id: ${sourceSectionId}`);
    }
    seenSections.add(sourceSectionId);

    const plainText = normalizeConstitutionPlainText(article.html);
    if (!plainText) return;
    const passageId = constitutionPassageId({
      sourceDocumentId,
      sourceSectionId,
      plainText,
    });
    if (seenPassages.has(passageId)) {
      throw new Error(`Duplicate constitution passage id: ${passageId}`);
    }
    seenPassages.add(passageId);

    passages.push({
      passageId,
      sourceSectionId,
      sectionOrder,
      anchorId: constitutionSectionAnchor(sourceSectionId, sectionOrder),
      headingLabel: article.headingLabel?.trim() || null,
      topicKeys: [...new Set(article.topics.map((topic) => topic.trim()))]
        .filter(Boolean)
        .sort(),
      plainText,
      contentSha256: constitutionPassageContentHash(plainText),
    });
  });

  return passages;
}

export function constituteDocumentUrl(sourceDocumentId: string): string {
  return `https://www.constituteproject.org/constitution/${encodeURIComponent(sourceDocumentId)}?lang=en`;
}

export function constituteRetrievalUrl(sourceDocumentId: string): string {
  return `https://www.constituteproject.org/service/html?cons_id=${encodeURIComponent(sourceDocumentId)}&lang=en`;
}
