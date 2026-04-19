import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";
import { GenerativeBlogImage } from "@/components/GenerativeBlogImage";

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
      title: `${post.title} | Civica Blog`,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

const mdxComponents = {
  h1: (props: React.ComponentProps<"h1">) => (
    <h1
      {...props}
      style={{
        fontFamily: "var(--font-heading)",
        fontSize: "var(--text-32)",
        fontWeight: 400,
        letterSpacing: "var(--tracking-tight)",
        margin: "48px 0 16px",
        color: "var(--color-text-primary)",
      }}
    />
  ),
  h2: (props: React.ComponentProps<"h2">) => (
    <h2
      {...props}
      style={{
        fontFamily: "var(--font-heading)",
        fontSize: "var(--text-24)",
        fontWeight: 400,
        letterSpacing: "var(--tracking-tight)",
        margin: "40px 0 12px",
        color: "var(--color-text-primary)",
      }}
    />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3
      {...props}
      style={{
        fontFamily: "var(--font-heading)",
        fontSize: "var(--text-20)",
        fontWeight: 400,
        margin: "32px 0 8px",
        color: "var(--color-text-primary)",
      }}
    />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p
      {...props}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--font-weight-mono)",
        fontSize: "var(--text-13)",
        color: "var(--color-text-50)",
        lineHeight: "var(--leading-loose)",
        margin: "0 0 20px",
      }}
    />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul
      {...props}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--font-weight-mono)",
        fontSize: "var(--text-13)",
        color: "var(--color-text-50)",
        lineHeight: "var(--leading-loose)",
        paddingLeft: 24,
        margin: "0 0 20px",
      }}
    />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol
      {...props}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--font-weight-mono)",
        fontSize: "var(--text-13)",
        color: "var(--color-text-50)",
        lineHeight: "var(--leading-loose)",
        paddingLeft: 24,
        margin: "0 0 20px",
      }}
    />
  ),
  li: (props: React.ComponentProps<"li">) => (
    <li {...props} style={{ marginBottom: 6 }} />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a
      {...props}
      style={{
        color: "var(--color-accent)",
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    />
  ),
  strong: (props: React.ComponentProps<"strong">) => (
    <strong {...props} style={{ color: "var(--color-text-85)" }} />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      {...props}
      style={{
        borderLeft: "2px solid var(--color-accent)",
        paddingLeft: 20,
        margin: "24px 0",
        fontStyle: "italic",
        color: "var(--color-text-40)",
      }}
    />
  ),
  hr: (props: React.ComponentProps<"hr">) => (
    <hr
      {...props}
      style={{
        border: "none",
        height: 1,
        background: "var(--color-divider)",
        margin: "40px 0",
      }}
    />
  ),
  code: (props: React.ComponentProps<"code">) => (
    <code
      {...props}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-12)",
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-card-border)",
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

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/blog" className="breadcrumb">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 12L6 8l4-4" />
        </svg>
        Blog
      </Link>

      <article>
        <div style={{
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-card-bg)",
          marginBottom: 32,
        }}>
          <GenerativeBlogImage slug={post.slug} width={720} height={280} />
        </div>

        <header style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-44)",
              fontWeight: 400,
              letterSpacing: "var(--tracking-tighter)",
              lineHeight: "var(--leading-snug)",
              margin: "0 0 16px",
              color: "var(--color-text-primary)",
            }}
          >
            {post.title}
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-40)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              {post.author}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-25)",
              }}
            >
              &middot;
            </span>
            <time
              dateTime={post.date}
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-40)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              {new Date(post.date + "T00:00:00").toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
          {post.tags.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-10)",
                    color: "var(--color-text-30)",
                    letterSpacing: "var(--tracking-caps)",
                    textTransform: "uppercase",
                    background: "var(--color-card-bg)",
                    border: "1px solid var(--color-card-border)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div
            style={{
              width: 40,
              height: 2,
              background: "var(--color-accent)",
              borderRadius: 1,
              marginTop: 32,
            }}
          />
        </header>

        <MDXRemote source={post.content} components={mdxComponents} />
      </article>
    </div>
  );
}
