import Link from "next/link";

/**
 * Phase F variant 1 — "Clean" homepage.
 * A monumentless landing: a single circle logo, the project name, the
 * one-line tagline, and two affordances ("Open the atlas" /
 * "Read the index"). The intent is for the Atlas itself to be the
 * product; the homepage is just a doorbell.
 */
export function HomeClean() {
  return (
    <div className="home-clean">
      <div className="home-clean-stack">
        <div className="home-clean-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="64" height="64">
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="32" cy="32" r="3" fill="currentColor" />
            <path
              d="M32 6 L32 12 M32 52 L32 58 M6 32 L12 32 M52 32 L58 32"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>
        <h1 className="home-clean-title">Civica Atlas</h1>
        <p className="home-clean-tagline">
          How every country is governed, in one atlas.
        </p>
        <div className="home-clean-cta">
          <Link href="/atlas" className="home-clean-btn home-clean-btn--primary">
            Open the atlas
          </Link>
          <Link href="/civica-index" className="home-clean-btn">
            Read the index
          </Link>
        </div>
      </div>
    </div>
  );
}
