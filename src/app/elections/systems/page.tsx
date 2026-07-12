import type { Metadata } from "next";
import { getElectoralSystemBuckets } from "@/lib/elections/electoral-systems";
import { getSource } from "@/lib/db/queries";
import { withOg } from "@/lib/og";
import { Reveal } from "@/components/motion/Reveal";
import { PageHero } from "@/components/PageHero";
import ElectoralSystemsClient from "./ElectoralSystemsClient";
import type { SystemKey, SystemCountry } from "@/lib/elections/electoral-systems";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "How Electoral Systems Work — FPTP, PR, Mixed & More",
  description:
    "How the legislatures classified in IPU Parline turn votes into seats: First Past the Post, proportional representation, mixed-member, ranked choice, and two-round systems.",
  alternates: { canonical: "https://civicaatlas.org/elections/systems" },
  openGraph: withOg({
    title: "How Electoral Systems Work — FPTP, PR, Mixed & More · Civica Atlas",
    description:
      "First Past the Post, proportional representation, mixed-member, ranked choice, and two-round systems, with per-country data from IPU Parline.",
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
      {/* Canonical full-bleed page hero (shared PageHero shell). */}
      <PageHero
        eyebrow="Elections · Explainer"
        titleId="elsys-hero-title"
        title="How electoral systems work."
        description={
          <>
            Elected legislatures need rules for turning votes into seats. The rule used
            shapes who governs — and Civica classifies each one from IPU
            Parline&rsquo;s own data.
          </>
        }
        engraving={{
          src: "/engravings/hero.webp",
          darkSrc: "/engravings/hero-dark.webp",
        }}
      />

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
