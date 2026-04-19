import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { HemicycleCover } from "@/components/blog/HemicycleCover";

const SITE_URL = "https://civicaatlas.org";

export const metadata: Metadata = {
  title: "The Record",
  description:
    "Notes from the chambers — articles on governance, political systems, and the architecture of public life from the Civica desk.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "The Record | Civica",
    description:
      "Notes from the chambers — articles on governance, political systems, and the architecture of public life from the Civica desk.",
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

function formatShortDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function estimateReadTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 250));
}

export default function BlogIndex() {
  const posts = getAllPosts();

  if (posts.length === 0) {
    return (
      <div className="record-page">
        <header className="record-masthead">
          <h1 className="record-nameplate">
            The Record<span className="record-dot">.</span>
          </h1>
          <p className="record-tag">
            Notes from the chambers — a letter from the Civica desk.
          </p>
        </header>
        <div className="record-main">
          <p className="record-empty">No dispatches yet. Check back soon.</p>
        </div>
      </div>
    );
  }

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="record-page">
      {/* Masthead */}
      <header className="record-masthead">
        <div className="record-masthead-grid">
          <div className="record-masthead-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1 className="record-nameplate">
            The Record<span className="record-dot">.</span>
          </h1>
          <div className="record-masthead-vol">
            {posts.length} {posts.length === 1 ? "Article" : "Articles"}
          </div>
        </div>
        <p className="record-tag">
          Notes from the chambers — a letter from the Civica desk.
        </p>
      </header>

      {/* Sub-nav */}
      <nav className="record-subnav">
        <Link href="/" className="record-subnav-link">
          &larr; Atlas
        </Link>
        <span className="record-subnav-link record-subnav-active">
          The Record
        </span>
        <span className="record-subnav-grow" />
      </nav>

      <main className="record-main">
        {/* Lead story */}
        <article className="record-lead">
          <Link
            href={`/blog/${featured.slug}`}
            className="record-lead-cover"
            aria-label="Open article"
          >
            <HemicycleCover slug={featured.slug} variant="lead" />
          </Link>
          <div className="record-lead-copy">
            <span className="record-kicker">
              Latest &middot; {featured.tags[0] ?? "Essay"}
            </span>
            <h2 className="record-lead-title">{featured.title}</h2>
            <p className="record-lead-dek">{featured.description}</p>
            <Link
              href={`/blog/${featured.slug}`}
              className="record-read-link"
            >
              Read the essay &rarr;
            </Link>
            <div className="record-byline">
              <span>
                By <strong>{featured.author}</strong>
              </span>
              <span className="record-byline-dot" />
              <span>{estimateReadTime(featured.content)} min read</span>
              <span className="record-byline-dot" />
              <span>{formatDate(featured.date)}</span>
            </div>
          </div>
        </article>

        {/* Stories grid */}
        {rest.length > 0 && (
          <>
            <div className="record-sec-head">
              <span className="record-sec-ey">&sect; 01</span>
              <h2 className="record-sec-title">More from the desk</h2>
            </div>
            <div className="record-stories">
              {rest.map((post) => (
                <article key={post.slug} className="record-story">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="record-story-cover"
                    aria-label="Open"
                  >
                    <HemicycleCover slug={post.slug} variant="card" />
                  </Link>
                  <div className="record-story-kicker">
                    {post.tags[0] ?? "Essay"}
                  </div>
                  <h3 className="record-story-title">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="record-story-dek">{post.description}</p>
                  <div className="record-story-meta">
                    <strong>{post.author}</strong>
                    <span>&middot;</span>
                    <span>{estimateReadTime(post.content)} min</span>
                    <span>&middot;</span>
                    <span>{formatShortDate(post.date)}</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* Numbered list — "In the margins" style */}
        {rest.length >= 3 && (
          <div className="record-two-col">
            <div>
              <div className="record-sec-head" style={{ marginTop: 0 }}>
                <span className="record-sec-ey">&sect; 02</span>
                <h2 className="record-sec-title">In the margins</h2>
              </div>
              <div className="record-list">
                {rest.map((post, i) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="record-list-row"
                  >
                    <div className="record-list-n">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <div className="record-list-kicker">
                        {post.tags[0] ?? "Essay"}
                      </div>
                      <h4 className="record-list-title">{post.title}</h4>
                      <div className="record-list-by">
                        <strong>{post.author}</strong> &middot;{" "}
                        {estimateReadTime(post.content)} min &middot;{" "}
                        {formatShortDate(post.date)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <aside className="record-sidebar">
              <div className="record-sidebar-block">
                <h5 className="record-sidebar-heading">Editor&apos;s note</h5>
                <blockquote className="record-sidebar-quote">
                  &ldquo;The chamber is not a container for politics. It{" "}
                  <em>is</em> the politics. Walk in, sit down, look around: the
                  argument has already begun.&rdquo;
                </blockquote>
              </div>

              {posts.length > 0 && (
                <div className="record-sidebar-block">
                  <h5 className="record-sidebar-heading">Topics</h5>
                  <div className="record-tag-cloud">
                    {Array.from(
                      new Set(posts.flatMap((p) => p.tags))
                    )
                      .slice(0, 10)
                      .map((tag) => (
                        <span key={tag} className="record-tag-chip">
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              <div className="record-sidebar-block">
                <h5 className="record-sidebar-heading">Colophon</h5>
                <p className="record-sidebar-colophon">
                  Set in <strong>Fraunces</strong> and <strong>Inter</strong>.
                  Published in warm paper and starless dark.
                  Letterpress-inspired, web-native.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
