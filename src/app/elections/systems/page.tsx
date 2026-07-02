import type { Metadata } from "next";
import { getElectoralSystemBuckets } from "@/lib/elections/electoral-systems";
import { getSource } from "@/lib/db/queries";
import { withOg } from "@/lib/og";
import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { Reveal } from "@/components/motion/Reveal";
import ElectoralSystemsClient from "./ElectoralSystemsClient";
import type { SystemKey, SystemCountry } from "@/lib/elections/electoral-systems";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "How Electoral Systems Work — First Past the Post, PR, Mixed & More",
  description:
    "How the world's legislatures turn votes into seats: First Past the Post, proportional representation, mixed-member, ranked choice, and two-round systems — with real per-country classifications from IPU Parline.",
  alternates: { canonical: "https://civicaatlas.org/elections/systems" },
  openGraph: withOg({
    title: "How Electoral Systems Work | Civica",
    description:
      "First Past the Post, proportional representation, mixed-member, ranked choice, and two-round systems, with real per-country data from IPU Parline.",
    url: "https://civicaatlas.org/elections/systems",
  }),
};

export default async function ElectoralSystemsPage() {
  let buckets: Record<SystemKey, SystemCountry[]> = {
    fptp: [],
    pr: [],
    mixed: [],
    ranked: [],
    trs: [],
    other: [],
  };
  let sourceRetrievedAt: string | null = null;

  try {
    const [loaded, source] = await Promise.all([
      getElectoralSystemBuckets(),
      getSource("ipu_parline"),
    ]);
    buckets = loaded;
    sourceRetrievedAt = source?.lastSyncAt
      ? source.lastSyncAt.toISOString()
      : null;
  } catch (err) {
    console.error("[elections/systems] query failed:", err);
  }

  return (
    <>
      {/* Full-bleed engraving hero — same idiom as /elections. Rendered as a
          sibling BEFORE the page container so the 100vw breakout reaches the
          viewport edges with no top-padding gap. */}
      <section
        className="factbook-landing-hero"
        aria-labelledby="elsys-hero-title"
      >
        <ParallaxImage
          className="factbook-hero-art"
          src="/engravings/hero.webp"
          darkSrc="/engravings/hero-dark.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="factbook-hero-scrim" aria-hidden="true" />
        <HeroReveal className="factbook-hero-inner">
          <HeroRevealItem className="factbook-hero-eyebrow">
            Elections · Explainer
          </HeroRevealItem>
          <HeroRevealItem
            as="h1"
            id="elsys-hero-title"
            className="factbook-hero-title"
          >
            How electoral systems work.
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            Every democracy has to turn votes into seats. The rule it uses
            shapes who governs — and Civica classifies each one from IPU
            Parline&rsquo;s own data.
          </HeroRevealItem>
        </HeroReveal>
      </section>

      <div className="editorial-page editorial-page--full">
        <Reveal as="nav" amount={0.5} className="editorial-breadcrumbs">
          <ol className="editorial-breadcrumbs-list">
            <li className="editorial-breadcrumbs-item">
              <a href="/elections">Elections</a>
            </li>
            <li className="editorial-breadcrumbs-item" aria-current="page">
              Electoral systems
            </li>
          </ol>
        </Reveal>

        <Reveal as="p" amount={0.4} className="elsys-intro">
          An electoral system is the set of rules that converts the votes people
          cast into the seats parties and candidates hold. The choice of rule is
          consequential: plurality rules tend to concentrate power in two large
          parties, while proportional rules spread it across many. The six
          groupings below follow IPU Parline&rsquo;s own classification of each
          country&rsquo;s directly-elected chamber.
        </Reveal>

        <ElectoralSystemsClient
          buckets={buckets}
          sourceRetrievedAt={sourceRetrievedAt}
        />

        <Reveal as="section" amount={0.2} className="elsys-sources">
          <p>
            <strong>Classifications:</strong> Inter-Parliamentary Union,{" "}
            <a
              href="https://data.ipu.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              IPU Parline
            </a>{" "}
            (Creative Commons BY-NC-SA 4.0), recorded per chamber as an
            electoral-system family and sub-type. Country counts reflect each
            country&rsquo;s lower or unicameral chamber; countries IPU Parline
            does not classify are not shown. The five named systems and the
            residual &ldquo;Other&rdquo; grouping map directly from IPU
            Parline&rsquo;s own categories.
          </p>
          <p>
            <strong>Explainer references:</strong> ACE Electoral Knowledge
            Network; International IDEA, <em>Electoral System Design: The New
            International IDEA Handbook</em>; and Maurice Duverger on the
            party-system effects of plurality rules. The seats-versus-votes
            diagrams use abstract parties and are illustrative, not results from
            any specific election.
          </p>
        </Reveal>
      </div>
    </>
  );
}
