import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { getSiteStats, type SiteStats } from "@/lib/content/site-stats";
import { replication, civicaIndex } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Replication package — Civica Index",
  description:
    "Reproduce every Civica Index score from primary sources. Full methodology, codebook, processing logic, and downloadable outputs — coming at Beta launch.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/replication" },
};

const SECTIONS = [
  { id: "package-contents", label: "Package contents" },
  { id: "cite", label: "Cite this page" },
];

const REPLICATION_STATUS_LABEL: Record<string, string> = {
  "coming-soon": "Coming soon",
  shipped: "Shipped",
};

export default async function ReplicationPage() {
  let stats: SiteStats | null = null;
  try {
    stats = await getSiteStats();
  } catch {
    stats = null;
  }
  const scoredJurisdictions = stats?.jurisdictionsWithIso3 ?? null;

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <nav className="editorial-breadcrumbs">
          <Link href="/civica-index">← Civica Index</Link>
          <span>/</span>
          Replication package
        </nav>

        <h1 className="editorial-page-title">
          Replication package{" "}
          <span className="editorial-beta-tag">
            {REPLICATION_STATUS_LABEL[replication.status]}
          </span>
        </h1>
        <p className="editorial-page-subtitle">
          Reproduce every Civica Index score from primary sources.
        </p>

        <p>
          The Civica Index is designed to be fully reproducible. That means
          publishing not just the scores, but every formula, normalization step,
          source dataset reference, and codebook entry needed to re-derive the
          same numbers from scratch. The replication package ships at Beta
          cut-over (target: {replication.shipTarget}), once the PCA / factor
          analysis and confidence-interval work are finalized. The contents
          are described below.
        </p>

        <Banner variant="warn">
          Status: coming at Beta launch — target {civicaIndex.cutoverTarget}
        </Banner>

        <section id="package-contents" className="editorial-section">
          <SectionHeader
            eyebrow="Replication"
            title="Package contents"
            dek="Everything needed to reproduce a Civica Index score from scratch."
          />
          <ul>
            <li>
              <strong>Full methodology document.</strong> An expanded version of
              the published methodology, including worked examples and
              edge-case decisions.
            </li>
            <li>
              <strong>Codebook.</strong> Every variable, every source, every
              formula — documented in a single reference table. Includes
              native-scale definitions and normalization bounds for each
              dimension.
            </li>
            <li>
              <strong>Processing logic.</strong> Step-by-step description of
              how raw source data flows into final CI scores: ingestion,
              normalization (fixed-bound, not observed-extremes), PCA factor
              weights, composite formula, confidence interval derivation, and
              tier classification.
            </li>
            <li>
              <strong>Source references.</strong> Direct links and bibliographic
              citations for every upstream dataset, including dataset version,
              release date, and coverage notes.
            </li>
            <li>
              <strong>Downloadable outputs.</strong> Country-level CSV covering{" "}
              {scoredJurisdictions !== null
                ? `all ${scoredJurisdictions}`
                : "all"}{" "}
              scored jurisdictions: CI score, 90% confidence interval, rank,
              rank band, dimensional breakdowns, completeness flag (Full /
              Partial / Insufficient), and data vintage per source.
            </li>
            <li>
              <strong>Code (where legally permissible).</strong> The ingestion
              and normalization scripts from this codebase, published under an
              open license. Restricted upstream datasets are not redistributed
              — only the processing code that consumes them.
            </li>
          </ul>
        </section>

        <section id="cite" className="editorial-section">
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — Civica Index replication package"
            pageTitle="Civica Index replication package"
            url="https://civicaatlas.org/civica-index/replication"
            dataVintage={civicaIndex.lastRevisionIso}
          />
        </section>

        <footer className="editorial-footer-nav">
          <Link href="/civica-index/methodology">← Back to methodology</Link>
          <div>
            <Link href="/civica-index/corrections">
              Report a data issue or methodology concern
            </Link>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-14)", color: "var(--color-text-30)", fontFamily: "var(--font-body)" }}>
              Found a problem before the replication package is live? Submit it
              via the corrections form.
            </p>
          </div>
        </footer>
      </EditorialPage>
    </MethodologyLayout>
  );
}
