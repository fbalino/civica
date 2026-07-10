// JSON-LD (schema.org) builders for Civica Atlas.
//
// Every function returns a plain, JSON-serializable object shaped for a single
// schema.org node. Render each returned node through the `<JsonLd>` server
// component (one `<script type="application/ld+json">` per node) so search
// engines and rich-result validators see clean, discrete graphs.
//
// Rules of the road:
//  - The public brand in ALL structured data is "Civica Atlas" (disambiguates
//    from civica.com and civicaatlas.ai). `alternateName` carries the short
//    "Civica".
//  - No fabricated values. Optional fields (dates, images, temporalCoverage)
//    are only emitted when the caller passes a real value; `stripUndefined`
//    drops any key that resolved to `undefined`.
//  - Google retired the sitelinks searchbox, so WebSite deliberately carries
//    NO `potentialAction`/SearchAction.

import { SITE_URL, absoluteUrl } from "@/lib/site";
import { OG_DEFAULT_IMAGE_ABSOLUTE } from "@/lib/og";

export { SITE_URL };
export const SITE_NAME = "Civica Atlas";
export const SITE_ALT_NAME = "Civica";
export const GITHUB_REPO_URL = "https://github.com/fbalino/civica";
/** Absolute URL of the site logo used in Organization structured data. */
export const LOGO_URL = OG_DEFAULT_IMAGE_ABSOLUTE;

/** Stable `@id` for the publishing Organization so other nodes can reference
 *  it (WebSite.publisher, Article.author, Dataset.creator) instead of inlining
 *  a duplicate Organization object. */
export const ORGANIZATION_ID = absoluteUrl("/#organization");
export const WEBSITE_ID = absoluteUrl("/#website");

export type JsonLdNode = Record<string, unknown>;

/** Recursively drop keys whose value is `undefined` (schema.org consumers
 *  treat a present-but-empty key as noise; absence is cleaner). Arrays and
 *  nested objects are walked; `null` is preserved (callers don't emit it). */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** A `{ "@id": … }` reference to the publishing Organization node. */
export function organizationRef(): JsonLdNode {
  return { "@id": ORGANIZATION_ID };
}

/**
 * Publisher Organization. Rendered once, in the root layout.
 */
export function buildOrganization(): JsonLdNode {
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: SITE_ALT_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
    },
    sameAs: [GITHUB_REPO_URL],
  });
}

/**
 * WebSite node. Rendered once, in the root layout. Publisher references the
 * Organization by @id. No SearchAction (retired display feature).
 */
export function buildWebSite(): JsonLdNode {
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: SITE_ALT_NAME,
    url: SITE_URL,
    publisher: organizationRef(),
  });
}

export interface BreadcrumbItem {
  name: string;
  /** Absolute or root-relative URL for the crumb. Root-relative is resolved to
   *  the apex host. Omit for the final (current) crumb per schema.org guidance. */
  url?: string;
}

/**
 * BreadcrumbList. `item` is emitted only when a crumb has a URL — the trailing
 * (current-page) crumb intentionally has none.
 */
export function buildBreadcrumbList(items: BreadcrumbItem[]): JsonLdNode {
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
        ? item.url.startsWith("http")
          ? item.url
          : absoluteUrl(item.url)
        : undefined,
    })),
  });
}

export interface CountryNodeInput {
  name: string;
  /** e.g. "/country/france" — resolved to the apex host. */
  path: string;
  /** Wikidata QID, e.g. "Q142". Emitted as a `sameAs` Wikidata entity URL. */
  wikidataQid?: string | null;
}

/**
 * Country node (schema.org/Country) with a Wikidata `sameAs` when a QID is
 * available on already-fetched data. Returns null when there's nothing
 * source-backed to say beyond the name (no QID) — the BreadcrumbList already
 * carries the name, so a bare Country node would add no value.
 */
export function buildCountry(input: CountryNodeInput): JsonLdNode | null {
  if (!input.wikidataQid) return null;
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": "Country",
    "@id": absoluteUrl(`${input.path}#country`),
    name: input.name,
    url: absoluteUrl(input.path),
    sameAs: [`https://www.wikidata.org/wiki/${input.wikidataQid}`],
  });
}

export interface ArticleInput {
  headline: string;
  description?: string;
  /** ISO date (YYYY-MM-DD is accepted by schema.org). */
  datePublished: string;
  /** Falls back to datePublished when the post carries no separate modified date. */
  dateModified?: string;
  /** Absolute URL of the article. */
  url: string;
  /** Absolute URL of the resolved cover image. */
  image?: string;
  keywords?: string[];
}

/**
 * Article node. Author and publisher are BOTH the Organization (Civica Atlas
 * is the editorial voice; individual bylines like "Civica Team" are not
 * distinct schema.org Persons). `mainEntityOfPage` binds the node to its URL.
 */
export function buildArticle(input: ArticleInput): JsonLdNode {
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: organizationRef(),
    publisher: organizationRef(),
    image: input.image ? [input.image] : undefined,
    keywords:
      input.keywords && input.keywords.length > 0
        ? input.keywords.join(", ")
        : undefined,
    url: input.url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
  });
}

export interface DatasetInput {
  name: string;
  description: string;
  /** Absolute canonical URL of the dataset landing page. */
  url: string;
  /** License URL or page (Civica's reuse terms live at /licensing). */
  license: string;
  /** e.g. "2026-Q1" or a free-text vintage handle — only when real. */
  temporalCoverage?: string;
  /** Absolute URL of a machine-readable distribution (the public JSON API). */
  distributionUrl?: string;
  /** Keywords for the dataset. */
  keywords?: string[];
}

/**
 * Dataset node for the Civica Index. Creator is the Organization; the
 * distribution points at the documented public JSON API.
 */
export function buildDataset(input: DatasetInput): JsonLdNode {
  return stripUndefined({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: input.name,
    description: input.description,
    url: input.url,
    creator: organizationRef(),
    publisher: organizationRef(),
    license: input.license,
    isAccessibleForFree: true,
    temporalCoverage: input.temporalCoverage,
    keywords:
      input.keywords && input.keywords.length > 0 ? input.keywords : undefined,
    distribution: input.distributionUrl
      ? [
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: input.distributionUrl,
          },
        ]
      : undefined,
  });
}
