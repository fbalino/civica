import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { peerGrouping, civicaIndex, deprecation } from "@/lib/content/site-state";

export const revalidate = 3600;

export const revalidate = 3600;

const REVIEW_STATUS_LABEL: Record<"pending" | "in-review" | "complete", string> = {
  pending: "Pending external review",
  "in-review": "External review in progress",
  complete: "Externally reviewed",
};

export const metadata: Metadata = {
  title: "Peer grouping in Civica — Methodology",
  description:
    "Why countries are compared the way they are. Civica's peer-grouping architecture: World Bank region × income for material indicators, V-Dem Regimes of the World for governance, BR/CGV as alternate regime lens, constitutional form as descriptive metadata. Replaces the retired structural_family heuristic per the 2026-05-02 peer-grouping resolution.",
  alternates: {
    canonical:
      "https://civicaatlas.org/civica-index/methodology/peer-grouping",
  },
};

const SECTIONS = [
  { id: "problem", label: "The problem" },
  { id: "principle", label: "Peer-set principle" },
  { id: "material-outcomes", label: "Material outcomes" },
  { id: "governance-outcomes", label: "Governance outcomes" },
  { id: "alternate-regime-lens", label: "BR / CGV lens" },
  { id: "constitutional-form", label: "Constitutional form" },
  { id: "minimum-n", label: "Minimum-n rule" },
  { id: "coverage-limitations", label: "Coverage limitations" },
  { id: "reference-vintage", label: "Reference vintage" },
  { id: "decision-record", label: "Decision record" },
  { id: "limitations", label: "Limitations" },
  { id: "migration-table", label: "Migration table" },
  { id: "versioning", label: "Versioning" },
  { id: "references", label: "References" },
  { id: "cite", label: "Cite this page" },
];

export default function PeerGroupingMethodologyPage() {
  const reviewStatusLabel =
    REVIEW_STATUS_LABEL[peerGrouping.externalReviewStatus] ??
    "Pending external review";

  // ctx values mirror values used in TSX-shell-rendered prose so the
  // markdown body can interpolate them via {{ctx.reviewStatusLabel}}.
  const ctx = {
    reviewStatusLabel,
  };

  const state = { peerGrouping, civicaIndex, deprecation };

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <SmartBreadcrumbs />

        <h1 className="editorial-page-title">Peer grouping in Civica</h1>
        <p className="editorial-page-subtitle">
          Why countries are compared the way they are.
        </p>
        <div className="editorial-page-meta">
          <span>Methodology {peerGrouping.version}</span>
          <span>·</span>
          <span>Adopted {peerGrouping.adoptedAt}</span>
          <span>·</span>
          <span>{reviewStatusLabel}</span>
        </div>

        <div className="editorial-warning">
          <strong>{reviewStatusLabel}.</strong>{" "}
          This methodology page is published in {peerGrouping.version} form
          before external comparative-politics review. Material revisions, if
          any, will ship as the next methodology version with a documented
          changelog at the bottom of this page. The underlying classifications
          (World Bank region, World Bank income group, V-Dem Regimes of the
          World, Bjørnskov-Rode / CGV) are externally-attested standards
          published by their respective institutions; Civica is citing them,
          not asserting a novel composite.
        </div>

        {/* Markdown body — content/methodology-peer-grouping.md is the
            prose source of truth for sections 1–14. Footnotes via GFM
            (remark-gfm). Per content-templating audit v1.0 §3.6 +
            v1.1 amendment §6.A. */}
        <section className="editorial-section">
          <MarkdownContent
            file="content/methodology-peer-grouping.md"
            stats={null}
            state={state as unknown as Record<string, unknown>}
            ctx={ctx}
          />
        </section>

        <section className="editorial-section" id="cite">
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — Peer grouping"
            pageTitle="Peer grouping"
            url="https://civicaatlas.org/civica-index/methodology/peer-grouping"
          />
        </section>

        <footer className="editorial-footer-nav">
          <Link href="/civica-index/methodology">
            ← Civica Index methodology
          </Link>
          <Link href="/civica-index/methodology/pulse">
            Pulse methodology →
          </Link>
        </footer>
      </EditorialPage>
    </MethodologyLayout>
  );
}
