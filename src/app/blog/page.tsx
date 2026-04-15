import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";

const SITE_URL = "https://civica-kappa.vercel.app";

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

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <h1 className="page-heading" style={{ marginBottom: 24 }}>
        Blog
      </h1>

      <div
        style={{
          width: 40,
          height: 2,
          background: "var(--color-accent)",
          borderRadius: 1,
          marginBottom: 40,
        }}
      />

      {posts.length === 0 ? (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-40)",
          }}
        >
          No posts yet. Check back soon.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {posts.map((post) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="cv-card cv-card--interactive"
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-22)",
                    fontWeight: 400,
                    letterSpacing: "var(--tracking-tight)",
                    margin: 0,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {post.title}
                </h2>
                <time
                  dateTime={post.date}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-11)",
                    color: "var(--color-text-30)",
                    letterSpacing: "var(--tracking-wide)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {new Date(post.date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </time>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-50)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: "0 0 12px",
                }}
              >
                {post.description}
              </p>
              {post.tags.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
