import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getAllPosts, getPostBySlug } from "@/lib/blog";
import { HemicycleCover } from "@/components/blog/HemicycleCover";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { ShareButtons } from "@/components/blog/ShareButtons";

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
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: `${post.title} | The Record`,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 250));
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const mdxComponents = {
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
  blockquote: ({ children }: React.ComponentProps<"blockquote">) => (
    <div className="post-callout">
      <div>{children}</div>
    </div>
  ),
  hr: () => <hr />,
  code: (props: React.ComponentProps<"code">) => (
    <code
      {...props}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-12)",
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-divider)",
        padding: "2px 6px",
        borderRadius: "var(--radius-sm)",
      }}
    />
  ),
};

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

        {/* Header */}
        <header className="post-head">
          <div className="post-crumbs">
            <Link href="/blog" style={{ color: "inherit", textDecoration: "none" }}>
              The Record
            </Link>
            <span className="post-crumbs-dot" />
            {post.tags[0] && <span>{post.tags[0]}</span>}
          </div>
          <h1 className="post-title">{post.title}</h1>
          <p className="post-dek">{post.description}</p>
          <div className="post-byline">
            <span>
              By <strong>{post.author}</strong>
            </span>
            <span className="post-byline-dot" />
            <span>{formatDate(post.date)}</span>
            <span className="post-byline-dot" />
            <span>
              {post.content.split(/\s+/).length.toLocaleString()} words &middot;{" "}
              {readTime} min read
            </span>
          </div>
        </header>

        {/* Hero figure */}
        <figure className="post-hero-fig">
          <div className="post-hero-img">
            <HemicycleCover slug={post.slug} variant="hero" />
          </div>
          <div className="post-hero-cap">
            <span>Illustration · Civica Desk</span>
            <span>{post.tags.join(" · ")}</span>
          </div>
        </figure>

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
            <MDXRemote source={post.content} components={mdxComponents} />
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
                    <HemicycleCover slug={p.slug} variant="card" />
                  </div>
                  <div className="post-more-card-kicker">
                    {p.tags[0] ?? "Essay"}
                  </div>
                  <h4>{p.title}</h4>
                  <div className="post-more-card-by">
                    {p.author} &middot; {estimateReadTime(p.content)} min
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
