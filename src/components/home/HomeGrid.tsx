import Link from "next/link";

const ENTRIES = [
  {
    href: "/factbook",
    title: "Factbook",
    body: "An attempt at keeping the CIA World Factbook alive.",
  },
  {
    href: "/atlas",
    title: "Atlas",
    body: "Explore legislatures, chambers, and institutional structure.",
  },
  {
    href: "/civica-index",
    title: "Index (beta)",
    body: "What the Civica Index measures, and how it moves.",
  },
];

export function HomeGrid() {
  return (
    <div className="home-grid">
      <section className="home-grid-hero" aria-labelledby="home-grid-title">
        <div className="home-grid-intro">
          <h1 id="home-grid-title" className="home-grid-title">
            Civica Project
          </h1>
        </div>

        <nav className="home-grid-links" aria-label="Civica entry points">
          {ENTRIES.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="home-grid-link"
            >
              <span className="home-grid-link-title">{entry.title}</span>
              <span className="home-grid-link-body">{entry.body}</span>
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
