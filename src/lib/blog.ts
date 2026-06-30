import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  description: string;
  tags: string[];
  coverImage: string | null;
  coverAlt: string | null;
  coverCaption: string | null;
  /** Draft posts (frontmatter `draft: true`) are excluded from the site —
      used for articles awaiting their final artwork before publishing. */
  draft: boolean;
  content: string;
}

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    return {
      slug: data.slug ?? file.replace(/\.mdx$/, ""),
      title: data.title ?? "Untitled",
      date: data.date ?? "",
      author: data.author ?? "Civica Team",
      description: data.description ?? "",
      tags: data.tags ?? [],
      coverImage: data.coverImage ?? null,
      coverAlt: data.coverAlt ?? null,
      coverCaption: data.coverCaption ?? null,
      draft: data.draft === true,
      content,
    };
  });
  // Drafts never render on the site; remove the `draft: true` flag to publish.
  return posts
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export function getPostBySlug(slug: string): BlogPost | null {
  const posts = getAllPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

// ── Blog image resolution (Codex engravings) ──────────────────────────────
// Codex saves each article illustration to public/blog/<slug>/ named after the
// slugified Caption. A dedicated wide masthead can be saved as cover.{webp,png}.

/** Slugify a caption to Codex's filename convention. */
export function slugifyCaption(s: string): string {
  return s
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Public URL for an image basename under a post's image dir (prefers webp), or null. */
function resolveBlogFile(slug: string, base: string): string | null {
  if (!base) return null;
  for (const ext of ["webp", "png"]) {
    const rel = `/blog/${slug}/${base}.${ext}`;
    if (fs.existsSync(path.join(process.cwd(), "public", rel))) return rel;
  }
  return null;
}

/** Public URL for the engraving matching a caption, or null. */
export function resolveBlogImage(slug: string, caption: string): string | null {
  return resolveBlogFile(slug, slugifyCaption(caption));
}

/** Caption of the FIRST "Image placeholder" block in the markdown. */
export function firstPlaceholderCaption(content: string): string | null {
  const pi = content.search(/\*\*Image placeholder\*\*/i);
  if (pi === -1) return null;
  const cap = content.toLowerCase().indexOf("caption:", pi);
  if (cap === -1) return null;
  const eol = content.indexOf("\n", cap);
  return (
    content
      .slice(cap + "caption:".length, eol === -1 ? undefined : eol)
      .replace(/[*>]/g, "")
      .trim() || null
  );
}

export interface PostCover {
  /** Public image URL to use as the cover (or null → generated HemicycleCover). */
  image: string | null;
  /** Caption to show under the hero. */
  caption: string | null;
  /** True when the cover is the first inline placeholder (so it must be skipped
      inline on the article page). False for a dedicated cover.webp / frontmatter. */
  firstPlaceholderIsCover: boolean;
}

/** Resolve a post's cover: dedicated cover.{webp,png} → first-placeholder
    engraving → frontmatter coverImage → null (HemicycleCover fallback). */
export function resolvePostCover(post: BlogPost): PostCover {
  const dedicated = resolveBlogFile(post.slug, "cover");
  if (dedicated) {
    return { image: dedicated, caption: post.coverCaption, firstPlaceholderIsCover: false };
  }
  const cap = firstPlaceholderCaption(post.content);
  const img = cap ? resolveBlogImage(post.slug, cap) : null;
  if (img) return { image: img, caption: cap, firstPlaceholderIsCover: true };
  return { image: post.coverImage, caption: post.coverCaption, firstPlaceholderIsCover: false };
}
