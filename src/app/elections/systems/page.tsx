import type { Metadata } from "next";
import { getElectoralSystemBuckets } from "@/lib/elections/electoral-systems";
import { getSource } from "@/lib/db/queries";
import { withOg } from "@/lib/og";
import { Reveal } from "@/components/motion/Reveal";
import { PageHero } from "@/components/PageHero";
import ElectoralSystemsClient from "./ElectoralSystemsClient";
import type { SystemKey, SystemCountry } from "@/lib/elections/electoral-systems";

export const revalidate = 0;

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
  let dataAvailable = false;
  let dataError: string | null = null;

  try {
    buckets = await getElectoralSystemBuckets();
    dataAvailable = true;
  } catch (err) {
    dataError =
      "Electoral-system classifications are temporarily unavailable. The explanatory material remains available below.";
    console.error("[elections/systems] classification query failed:", err);
  }

  if (dataAvailable) {
    try {
      const source = await getSource("ipu_parline");
      sourceRetrievedAt = source?.lastSyncAt
        ? source.lastSyncAt.toISOString()
        : null;
    } catch (err) {
      console.error("[elections/systems] source freshness query failed:", err);
    }
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
            Elected legislatures need rules for turning votes into seats. Those
            rules affect how ballots are translated, but they do not determine
            political outcomes on their own. Civica groups the available records
            from IPU Parline&rsquo;s own data.
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
          studied alongside party systems, district design, thresholds,
          enforcement, and political context. Associations described here are
          general patterns, not causal findings for every country. The six
          groupings below follow IPU Parline&rsquo;s classification of each available
          lower or unicameral chamber record.
        </Reveal>

        <ElectoralSystemsClient
          buckets={buckets}
          sourceRetrievedAt={sourceRetrievedAt}
          dataAvailable={dataAvailable}
          dataError={dataError}
        />

        <Reveal as="section" amount={0.2} className="elsys-sources">
          <p>
            <strong>Classifications:</strong> Inter-Parliamentary Union,{" "}
            <a
              href="https://api.data.ipu.org/v1/documentation/"
              target="_blank"
              rel="noopener noreferrer"
            >
              IPU Parline API documentation and field definitions
            </a>{" "}
            (the imported statements record CC BY-NC-SA 4.0). Civica&rsquo;s
            formal source-specific rights review remains pending; these rows are
            therefore excluded from public bulk export. The source records an
            electoral-system family and sub-type per chamber. Country counts reflect each
            country&rsquo;s lower or unicameral chamber; countries IPU Parline
            does not classify are not shown. The five named systems and the
            residual &ldquo;Other&rdquo; grouping map directly from IPU
            Parline&rsquo;s own categories.
          </p>
          <p>
            <strong>Explainer references:</strong>{" "}
            <a
              href="https://aceproject.org/ace-en/topics/es"
              target="_blank"
              rel="noopener noreferrer"
            >
              ACE Electoral Knowledge Network
            </a>{" "}
            and International IDEA&rsquo;s{" "}
            <a
              href="https://www.idea.int/publications/catalogue/electoral-system-design-new-international-idea-handbook"
              target="_blank"
              rel="noopener noreferrer"
            >
              <em>Electoral System Design: The New International IDEA Handbook</em>
            </a>
            . These references describe mechanisms and comparative patterns;
            they do not establish that one rule causes a particular outcome in
            every institutional setting. The seats-versus-votes diagrams use
            abstract parties and are illustrative, not results from any specific
            election.
          </p>
        </Reveal>
      </div>
    </>
  );
}
