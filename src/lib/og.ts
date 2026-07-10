import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

// Shared Open Graph / social-share image helpers.
//
// Next.js SHALLOW-replaces `openGraph` when a page declares its own — it does
// NOT merge with the root layout's `openGraph`. So any page that sets its own
// `openGraph` block (for a custom title/description/url) silently drops the
// site default `og:image` unless it re-declares `images`. This module is the
// single source of truth for that default so the ~17 such pages don't each
// hardcode the path.
//
// No design tokens or styling live here — only the asset path + descriptor.
// The image's colours are baked into the asset from the live design tokens.

/**
 * Default social-share image (1200x630). A root-relative path; Next resolves
 * it to an absolute URL against the root layout's `metadataBase`
 * (https://civicaatlas.org). Used as a bare string for `twitter.images`.
 */
export const OG_DEFAULT_IMAGE = "/og-default.png";

// PUBLIC_CLAIM: metadata.social-card-positioning
export const OG_DEFAULT_IMAGE_ALT =
  "Civica Atlas — a provenance-first comparative reference to how every country is governed.";

/**
 * Default Open Graph `images` array (descriptor form, with dimensions + alt).
 * Mirrors the shape declared in the root layout. Use this when a page sets its
 * own `openGraph` but has no page-specific image of its own.
 */
export const OG_IMAGES = [
  {
    url: OG_DEFAULT_IMAGE,
    width: 1200,
    height: 630,
    alt: OG_DEFAULT_IMAGE_ALT,
  },
];

/**
 * Absolute apex URL for the default social-share image. JSON-LD (schema.org)
 * fields require a fully qualified URL — unlike `metadata.openGraph`/`twitter`,
 * they are not resolved against `metadataBase` automatically, so structured
 * data builders (`@/lib/seo/jsonld`) import this instead of re-deriving it.
 */
export const OG_DEFAULT_IMAGE_ABSOLUTE = absoluteUrl(OG_DEFAULT_IMAGE);

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/**
 * Merge the default social-share image into a page's `openGraph` unless the
 * page already supplies its own `images`. Wrap every page-level `openGraph`
 * object in this so each page emits an `og:image`:
 *
 *   openGraph: withOg({ title, description, url })
 *
 * A page that has its own image (e.g. a blog cover) keeps it; a page that
 * passes `images: undefined` (e.g. when its optional cover is missing) falls
 * back to the default.
 */
export function withOg(openGraph: OpenGraph): OpenGraph {
  if (openGraph.images) return openGraph;
  return { ...openGraph, images: OG_IMAGES };
}
