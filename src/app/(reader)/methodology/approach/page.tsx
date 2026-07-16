import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { Reveal } from "@/components/motion/Reveal";
import { getSiteStats, type SiteStats } from "@/lib/content/site-stats";
import {
  tier1Publishers,
  nsoWave1,
  pulse,
  civicaIndex,
  adoptedResolutionCount,
  deprecation,
} from "@/lib/content/site-state";
import { PROVENANCE_COVERAGE_SUMMARY } from "@/lib/claims/provenance-coverage";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "How We Approach Data — Sources & Reconciliation",
  description:
    "A plain-English walkthrough of how Civica handles country data, why multi-source reconciliation matters, and what you'll see on reader pages as a result.",
  alternates: {
    canonical: "https://civicaatlas.org/methodology/approach",
  },
};

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "problem", label: "The problem" },
  { id: "multi-source", label: "Multi-source reconciliation" },
  { id: "disagree", label: "When sources disagree" },
  { id: "reader-pages", label: "What you see" },
  { id: "beta", label: "BETA meaning" },
  { id: "rolling-out", label: "Still rolling out" },
  { id: "dig-deeper", label: "Dig deeper" },
  { id: "contact", label: "Get in touch" },
  { id: "cite", label: "Cite this page" },
];

export default async function ApproachPage() {
  // Soft-fail: page should still render if the DB is unreachable, with
  // generic prose in place of live counts. Mirrors the canonical
  // pattern set by this page pre-Phase-5; the only change is that the
  // prose now lives in `content/data-approach.md` and renders through
  // <MarkdownContent> instead of inline JSX. Per
  // ~/civica/plan/content-templating-audit-v1.md (Phase 2 proof
  // migration).
  let stats: SiteStats | null = null;
  try {
    stats = await getSiteStats();
  } catch {
    stats = null;
  }

  // Pre-computed helpers materialised at the call site (Phase 5
  // design §3.2 — filter chains + conjunction logic don't belong in
  // template syntax). Keys must match the validator's per-file
  // allowlist in scripts/validate-content-templates.ts.
  const tier1Shipped = tier1Publishers.filter((p) => p.shipped);
  const nsoActive = nsoWave1.filter((n) => n.status === "in-progress");
  const ctx = {
    tier1ShippedCount: tier1Shipped.length,
    tier1ShippedShortNamesProse: tier1Shipped
      .map((p) => p.shortName)
      .join(", "),
    nsoActiveCount: nsoActive.length,
    nsoActiveCountWord: nsoActive.length,
    nsoActiveNamesProse: nsoActive.map((n) => n.name).join(", "),
    provenanceCoverageTotal: PROVENANCE_COVERAGE_SUMMARY.total,
    provenanceCoverageComplete: PROVENANCE_COVERAGE_SUMMARY.complete,
    provenanceCoveragePercent: PROVENANCE_COVERAGE_SUMMARY.percent,
    provenanceCoverageCompleteLabels:
      PROVENANCE_COVERAGE_SUMMARY.completeLabels,
    provenanceCoverageExceptions:
      PROVENANCE_COVERAGE_SUMMARY.exceptionSummary,
  };

  // Narrowed `state` surface — the markdown only needs these slices,
  // and explicitly listing them at the call site makes the page's
  // template surface easy to grep.
  const state = {
    civicaIndex,
    pulse,
    adoptedResolutionCount,
    deprecation,
  };

  return (
    <EditorialPage className="methodology-layout">
      <ReaderSidebar items={SIDEBAR_ITEMS} className="methodology-sidebar" />

      <article className="methodology-content">
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">How we approach data</h1>
        <p className="editorial-page-subtitle">
          A plain-English walkthrough of how Civica handles country data, why
          the approach matters, and what you&apos;ll see on reader pages as a
          result. For the academic specifications, see the{" "}
          <Link href="/methodology">methodology hub</Link>.
        </p>

        {/* Markdown body — prose source of truth lives in
            content/data-approach.md. Wrapped in `.editorial-section`
            so descendant <h2>/<p>/<ul>/etc. inherit the editorial
            typography from src/app/editorial.css automatically. */}
        <Reveal as="section" className="editorial-section" amount={0.15}>
          <MarkdownContent
            file="content/data-approach.md"
            stats={stats as unknown as Record<string, unknown> | null}
            state={state as unknown as Record<string, unknown>}
            ctx={ctx}
          />
        </Reveal>

        <Reveal
          as="section"
          id="cite"
          className="editorial-section"
          aria-labelledby="cite-heading"
          amount={0.15}
        >
          <h2 id="cite-heading">Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — How we approach data"
            pageTitle="How we approach data"
            url="https://civicaatlas.org/methodology/approach"
            dataVintage={civicaIndex.lastRevisionIso}
          />
        </Reveal>
      </article>
    </EditorialPage>
  );
}
