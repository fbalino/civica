import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found — 404",
  description:
    "The page you're looking for doesn't exist in the Civica atlas. Return to the homepage or browse countries, elections, and government types.",
  robots: { index: false, follow: false },
};

const DESTINATIONS: Array<{
  href: string;
  label: string;
  description: string;
}> = [
  {
    href: "/",
    label: "Home",
    description: "Interactive atlas of world government structures.",
  },
  {
    href: "/country",
    label: "Countries",
    description: "Browse 250+ country profiles and political systems.",
  },
  {
    href: "/elections",
    label: "Elections",
    description: "Recent national elections and turnout figures.",
  },
  {
    href: "/civica-index/methodology/peer-grouping",
    label: "Government Types",
    description: "Presidential, parliamentary, and other systems explained.",
  },
  {
    href: "/compare",
    label: "Compare",
    description: "Place two or more countries side by side.",
  },
  {
    href: "/rankings",
    label: "Rankings",
    description: "Democracy, freedom, and governance indices.",
  },
];

export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
        minHeight: "60vh",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase",
          color: "var(--color-text-30)",
          marginBottom: "var(--space-6)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <span>Error 404</span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-source-frozen)",
          }}
          aria-hidden="true"
        />
        <span>Page not found</span>
      </div>

      <h1 className="page-heading" style={{ marginBottom: "var(--space-4)" }}>
        This page isn&apos;t in the atlas.
      </h1>

      <div
        style={{
          width: 40,
          height: 2,
          background: "var(--color-accent)",
          borderRadius: "var(--radius-sm)",
          marginBottom: "var(--space-8)",
        }}
      />

      <p
        className="cv-prose"
        style={{
          maxWidth: 640,
          marginBottom: "var(--space-3)",
        }}
      >
        The page you requested either moved, was renamed, or never existed. Civica
        maps government structures for every country in the world and the entry you
        were looking for may live under a different route.
      </p>

      <p
        className="cv-prose cv-prose--muted"
        style={{
          maxWidth: 640,
          marginBottom: "var(--space-9)",
        }}
      >
        Try one of the destinations below, or use search from the header to find a
        specific country, election, or topic.
      </p>

      <section aria-labelledby="not-found-destinations">
        <h2
          id="not-found-destinations"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            color: "var(--color-text-40)",
            marginBottom: "var(--space-5)",
          }}
        >
          Go somewhere useful
        </h2>

        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          {DESTINATIONS.map((destination) => (
            <li key={destination.href}>
              <Link
                href={destination.href}
                style={{
                  display: "block",
                  padding: "var(--space-4) var(--space-5)",
                  background: "var(--color-card-bg)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  color: "inherit",
                  transition:
                    "background-color 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-20)",
                    fontWeight: 400,
                    color: "var(--color-text-primary)",
                    marginBottom: 4,
                  }}
                >
                  {destination.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-14)",
                    lineHeight: "var(--leading-normal)",
                    color: "var(--color-text-50)",
                  }}
                >
                  {destination.description}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
