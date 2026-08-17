import type { Metadata } from "next";
import Link from "next/link";

import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";

export const metadata: Metadata = {
  title: "Civica Conditions Codebook and Replication",
  description:
    "Definitions, source-native inputs, versioned release rules, missingness, nonclaims, and reproduction commands for Civica Conditions.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-conditions/methodology",
  },
};

const SECTIONS = [
  { id: "scope", label: "Scope and nonclaims" },
  { id: "inputs", label: "Dimensions and inputs" },
  { id: "transformations", label: "Transformations" },
  { id: "coverage", label: "Coverage and uncertainty" },
  { id: "reproduction", label: "Reproduction" },
  { id: "limits", label: "Corrections and limits" },
  { id: "cite", label: "Cite this page" },
];

export default function ConditionsMethodologyPage() {
  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">Civica Conditions codebook</h1>
        <p className="editorial-page-subtitle">
          Definitions, release rules, nonclaims, and replication boundaries for
          Civica&apos;s source-native material indicators.
        </p>

        <section className="editorial-section">
          <MarkdownContent file="content/methodology-conditions.md" />
        </section>

        <section id="cite" className="editorial-section">
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas — Civica Conditions codebook"
            pageTitle="Civica Conditions codebook"
            url="https://civicaatlas.org/civica-conditions/methodology"
            dataVintage="Versioned Conditions release"
          />
        </section>

        <footer className="editorial-footer-nav">
          <Link href="/civica-conditions">← Civica Conditions</Link>
          <Link href="/civica-index/methodology">Civica Index methodology</Link>
        </footer>
      </EditorialPage>
    </MethodologyLayout>
  );
}
