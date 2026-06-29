import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { isValidElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getAllPosts, getPostBySlug } from "@/lib/blog";
import { BlogCover } from "@/components/blog/BlogCover";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

const SITE_URL = "https://civicaatlas.org";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const coverUrl = post.coverImage ? `${SITE_URL}${post.coverImage}` : undefined;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: withOg({
      type: "article",
      title: `${post.title} | The Record`,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      // Use the post's own cover image when it has one; withOg falls back to
      // the site default social image when `coverUrl` is undefined.
      images: coverUrl
        ? [
            {
              url: coverUrl,
              width: 1672,
              height: 941,
              alt: post.coverAlt ?? post.title,
            },
          ]
        : undefined,
    }),
  };
}

function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 250));
}

/** Map a category/tag to a tonal `.editorial-chip` modifier (mirrors the
 *  blog index). Deterministic so SSR/CSR agree. */
function categoryTone(tag: string | undefined): string {
  switch ((tag ?? "").toLowerCase()) {
    case "data updates":
    case "data":
      return "editorial-chip--sage";
    case "releases":
      return "editorial-chip--sand";
    case "methodology":
    case "methodology notes":
      return "editorial-chip--blue";
    default:
      return "editorial-chip--accent";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Flatten React children to plain text (for detecting placeholder blockquotes). */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement(node))
    return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

/** Slugify a caption to Codex's blog-image filename convention
    (lowercase, drop apostrophes, non-alphanumeric runs -> single hyphen). */
function slugifyCaption(s: string): string {
  return s
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve a public blog image URL for a caption (prefers .webp), or null. */
function resolveBlogImage(slug: string, caption: string): string | null {
  const base = slugifyCaption(caption);
  if (!base) return null;
  for (const ext of ["webp", "png"]) {
    const rel = `/blog/${slug}/${base}.${ext}`;
    if (fs.existsSync(path.join(process.cwd(), "public", rel))) return rel;
  }
  return null;
}

/** Caption of the FIRST "Image placeholder" block in the markdown (= the cover). */
function firstPlaceholderCaption(content: string): string | null {
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

function makeMdxComponents(slug: string, coverSlug: string | null) {
  return {
  h1: (props: React.ComponentProps<"h1">) => (
    <h2 {...props} />
  ),
  h2: (props: React.ComponentProps<"h2">) => (
    <h2 {...props} />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3 {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => <p {...props} />,
  ul: (props: React.ComponentProps<"ul">) => (
    <ul {...props} style={{ paddingLeft: 24, margin: "0 0 1.2em" }} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol {...props} style={{ paddingLeft: 24, margin: "0 0 1.2em" }} />
  ),
  li: (props: React.ComponentProps<"li">) => (
    <li {...props} style={{ marginBottom: 6 }} />
  ),
  a: (props: React.ComponentProps<"a">) => <a {...props} />,
  strong: (props: React.ComponentProps<"strong">) => <strong {...props} />,
  em: (props: React.ComponentProps<"em">) => <em {...props} />,
  blockquote: ({ children }: React.ComponentProps<"blockquote">) => {
    const text = nodeText(children);
    // "Image placeholder" blocks carry the Codex prompt + a Caption. Auto-upgrade
    // each to a real <figure> + <figcaption> once the caption-named engraving
    // exists in public/blog/<slug>/ (re-runnable: appears as images land). The
    // FIRST placeholder is the hero cover (rendered in the header), so skip it
    // inline; otherwise fall back to the dashed "Illustration pending" box.
    if (/image placeholder|codex prompt/i.test(text)) {
      const ci = text.toLowerCase().lastIndexOf("caption:");
      const caption = ci >= 0 ? text.slice(ci + "caption:".length).trim() : "";
      const captionSlug = slugifyCaption(caption);
      if (coverSlug && captionSlug === coverSlug) return null; // cover -> hero
      const img = caption ? resolveBlogImage(slug, caption) : null;
      if (img) {
        return (
          <figure className="post-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={caption} loading="lazy" />
            <figcaption>{caption}</figcaption>
          </figure>
        );
      }
      return (
        <figure
          aria-label="Illustration pending"
          style={{
            margin: "2em 0",
            padding: "var(--space-5) var(--space-6)",
            border: "1px dashed var(--color-card-border)",
            borderRadius: "var(--radius-lg)",
            background:
              "color-mix(in oklab, var(--color-text-40) 5%, var(--color-page-bg))",
          }}
        >
          <span
            style={{
              display: "block",
              marginBottom: "var(--space-3)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-12)",
              letterSpacing: "var(--tracking-wider)",
              textTransform: "uppercase",
              color: "var(--color-accent)",
            }}
          >
            Illustration pending
          </span>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-13)",
              lineHeight: "var(--leading-normal)",
              color: "var(--color-text-40)",
            }}
          >
            {children}
          </div>
        </figure>
      );
    }
    return (
      <div className="post-callout">
        <div>{children}</div>
      </div>
    );
  },
  hr: () => <hr />,
  code: (props: React.ComponentProps<"code">) => (
    <code
      {...props}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-13)",
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-divider)",
        padding: "2px 6px",
        borderRadius: "var(--radius-sm)",
      }}
    />
  ),
  };
}

function parsePipeTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isPipeTableSeparator(line: string): boolean {
  const cells = parsePipeTableRow(line);
  return (
    cells.length > 1 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

function escapeMdxText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

function renderBlogTable(lines: string[]): string {
  const [headerLine, , ...bodyLines] = lines;
  const headers = parsePipeTableRow(headerLine);
  const rows = bodyLines.map(parsePipeTableRow);

  return [
    '<div className="post-table-scroll">',
    '<table className="post-table">',
    "<thead>",
    "<tr>",
    ...headers.map((header) => `<th>${escapeMdxText(header)}</th>`),
    "</tr>",
    "</thead>",
    "<tbody>",
    ...rows.flatMap((row) => [
      "<tr>",
      ...headers.map(
        (_, index) => `<td>${escapeMdxText(row[index] ?? "")}</td>`
      ),
      "</tr>",
    ]),
    "</tbody>",
    "</table>",
    "</div>",
  ].join("\n");
}

function renderBlogPipeTables(content: string): string {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1];
    if (
      current?.trim().startsWith("|") &&
      next &&
      isPipeTableSeparator(next)
    ) {
      const tableLines = [current, next];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;
      out.push(renderBlogTable(tableLines));
      continue;
    }
    out.push(current);
  }

  return out.join("\n");
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const otherPosts = allPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  const readTime = estimateReadTime(post.content);

  // Cover = the first "Image placeholder" in the body. When its caption-named
  // engraving exists, use it as the hero cover (and skip it inline); otherwise
  // fall back to the post's own coverImage / the generated hemicycle cover.
  const coverCaption = firstPlaceholderCaption(post.content);
  const coverImg = coverCaption ? resolveBlogImage(post.slug, coverCaption) : null;
  const coverSlug = coverCaption ? slugifyCaption(coverCaption) : null;
  const heroCoverImage = coverImg ?? post.coverImage;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "Civica" },
    url: `${SITE_URL}/blog/${post.slug}`,
    keywords: post.tags,
    image: post.coverImage ? `${SITE_URL}${post.coverImage}` : undefined,
  };

  const authorInitials = post.author
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <ReadingProgress />

      <article className="post-article">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Hero — scrim over the cover with the eyebrow, headline + byline
            overlaid (matches the longform mockup). Preserves the header
            content (breadcrumb category, title, byline, cover, caption). */}
        <header className="post-head">
          <figure className="post-hero-fig">
            <div className="post-hero-img">
              <BlogCover
                alt={post.coverAlt ?? post.title}
                image={heroCoverImage}
                priority
                slug={post.slug}
                variant="hero"
              />
            </div>
            <div className="post-hero-scrim" />
            <div className="post-hero-copy">
              <div className="post-crumbs">
                <Link
                  href="/blog"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  The Record
                </Link>
                {post.tags[0] && (
                  <>
                    <span className="post-crumbs-dot" />
                    <span>{post.tags[0]}</span>
                  </>
                )}
              </div>
              <h1 className="post-title">{post.title}</h1>
              <div className="post-byline">
                <span>
                  By <strong>{post.author}</strong>
                </span>
                <span className="post-byline-dot" />
                <span>{formatDate(post.date)}</span>
                <span className="post-byline-dot" />
                <span>{readTime} min read</span>
              </div>
            </div>
          </figure>
          <div className="post-hero-cap">
            <span>
              {coverImg && coverCaption
                ? coverCaption
                : (post.coverCaption ?? "Illustration · Civica Desk")}
            </span>
            <span>
              {post.content.split(/\s+/).length.toLocaleString()} words &middot;{" "}
              {post.tags.join(" · ")}
            </span>
          </div>
        </header>

        {/* Body grid */}
        <div className="post-body-grid">
          {/* Left rail */}
          <aside className="post-rail">
            <div className="post-rail-stuck">
              <div className="post-rail-block">
                <b>Filed under</b>
                <span>{post.tags.join(", ")}</span>
              </div>
              <div className="post-rail-block">
                <b>Author</b>
                <span>{post.author}</span>
              </div>
              <div className="post-rail-block">
                <b>Share</b>
                <ShareButtons
                  url={`${SITE_URL}/blog/${post.slug}`}
                  title={post.title}
                />
              </div>
            </div>
          </aside>

          {/* Prose */}
          <main className="post-prose">
            {/* Lede — the dek opens the reading column. */}
            {post.description && (
              <p className="post-lede">{post.description}</p>
            )}
            <MDXRemote
              source={renderBlogPipeTables(post.content)}
              components={makeMdxComponents(post.slug, coverSlug)}
            />
          </main>

          {/* Right rail (empty — breathing room) */}
          <aside className="post-rail" />
        </div>

        {/* Author card */}
        <div className="post-author">
          <div className="post-author-avatar">{authorInitials}</div>
          <div>
            <h4>{post.author}</h4>
            <p>
              Contributing to The Record at Civica — covering governance,
              political systems, and the architecture of public life.
            </p>
          </div>
        </div>

        {/* More stories */}
        {otherPosts.length > 0 && (
          <section className="post-more">
            <div className="post-more-head">
              <span className="post-more-ey">Keep reading</span>
              <h2>More from The Record</h2>
            </div>
            <div className="post-more-grid">
              {otherPosts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="post-more-card"
                >
                  <div className="post-more-card-cover">
                    <BlogCover
                      alt={p.coverAlt ?? ""}
                      image={p.coverImage}
                      slug={p.slug}
                      variant="card"
                    />
                  </div>
                  <div className="post-more-card-body">
                    <span
                      className={`editorial-chip post-more-card-cat ${categoryTone(
                        p.tags[0]
                      )}`}
                    >
                      {p.tags[0] ?? "Essay"}
                    </span>
                    <h4>{p.title}</h4>
                    <div className="post-more-card-by">
                      {p.author} &middot; {estimateReadTime(p.content)} min
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
