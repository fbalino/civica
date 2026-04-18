import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { GenerativeBlogImage } from "@/components/GenerativeBlogImage";

const SITE_URL = "https://civicaatlas.org";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Articles on governance, political systems, and open data from the Civica team.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Blog | Civica",
    description:
      "Articles on governance, political systems, and open data from the Civica team.",
    url: `${SITE_URL}/blog`,
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  if (posts.length === 0) {
    return (
      <div className="cv-container" style={{ padding: "var(--spacing-section-y) var(--spacing-page-x)" }}>
        <h1 className="page-heading" style={{ marginBottom: 24 }}>Blog</h1>
        <div style={{ width: 40, height: 2, background: "var(--color-accent)", borderRadius: 1, marginBottom: 40 }} />
        <p style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-13)",
          color: "var(--color-text-40)",
        }}>
          No posts yet. Check back soon.
        </p>
      </div>
    );
  }

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="cv-container" style={{ padding: "var(--spacing-section-y) var(--spacing-page-x)" }}>
      <header style={{ marginBottom: 48 }}>
        <p style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-30)",
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase",
          margin: "0 0 12px",
        }}>
          From the Atlas
        </p>
        <h1 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-44)",
          fontWeight: 400,
          letterSpacing: "var(--tracking-tighter)",
          lineHeight: "var(--leading-snug)",
          margin: "0 0 16px",
          color: "var(--color-text-primary)",
        }}>
          Blog
        </h1>
        <div style={{ width: 40, height: 2, background: "var(--color-accent)", borderRadius: 1 }} />
      </header>

      {/* Featured post */}
      <a
        href={`/blog/${featured.slug}`}
        className="blog-featured-card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          textDecoration: "none",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-card-bg)",
          marginBottom: 40,
          transition: "border-color 0.2s ease, background 0.2s ease",
        }}
      >
        <div style={{
          background: "var(--color-card-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          minHeight: 240,
        }}>
          <GenerativeBlogImage slug={featured.slug} width={600} height={320} />
        </div>
        <div style={{ padding: "32px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            color: "var(--color-accent)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            marginBottom: 12,
          }}>
            Latest
          </div>
          <h2 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-28)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-snug)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}>
            {featured.title}
          </h2>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-relaxed)",
            margin: "0 0 16px",
          }}>
            {featured.description}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <time
              dateTime={featured.date}
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-30)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              {formatDate(featured.date)}
            </time>
            {featured.tags.length > 0 && (
              <>
                <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {featured.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: "var(--font-weight-mono)",
                        fontSize: "var(--text-10)",
                        color: "var(--color-text-25)",
                        letterSpacing: "var(--tracking-caps)",
                        textTransform: "uppercase",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </a>

      {/* Masonry grid */}
      {rest.length > 0 && (
        <div className="blog-masonry">
          {rest.map((post) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="blog-masonry-card"
              style={{ textDecoration: "none", display: "block" }}
            >
              <div style={{
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                marginBottom: 14,
                border: "1px solid var(--color-card-border)",
                background: "var(--color-card-bg)",
              }}>
                <GenerativeBlogImage slug={post.slug} width={400} height={220} />
              </div>
              <time
                dateTime={post.date}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-10)",
                  color: "var(--color-text-25)",
                  letterSpacing: "var(--tracking-wide)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {formatDate(post.date)}
              </time>
              <h2 style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-20)",
                fontWeight: 400,
                letterSpacing: "var(--tracking-tight)",
                lineHeight: "var(--leading-snug)",
                margin: "0 0 8px",
                color: "var(--color-text-primary)",
              }}>
                {post.title}
              </h2>
              <p style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-40)",
                lineHeight: "var(--leading-relaxed)",
                margin: "0 0 10px",
              }}>
                {post.description}
              </p>
              {post.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: "var(--font-weight-mono)",
                        fontSize: "var(--text-9)",
                        color: "var(--color-text-20)",
                        letterSpacing: "var(--tracking-caps)",
                        textTransform: "uppercase",
                        background: "var(--color-card-bg)",
                        border: "1px solid var(--color-card-border)",
                        padding: "1px 6px",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
