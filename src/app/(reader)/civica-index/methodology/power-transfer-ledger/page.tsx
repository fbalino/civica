import type { Metadata } from "next";
import Link from "next/link";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Power and Transfer Ledger Rulebook — Research Prototype",
  description: "The versioned rules, evidence requirements, nonclaims, and validation gates for Civica's experimental Power and Transfer Ledger.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/methodology/power-transfer-ledger" },
};

const SECTIONS = [
  { id: "what-it-records", label: "What it records" }, { id: "executive-identity", label: "Executive identity" },
  { id: "electoral-transfer", label: "Electoral transfer" }, { id: "parties-coalitions", label: "Parties and coalitions" },
  { id: "indirect-selection", label: "Indirect selection" }, { id: "edge-cases", label: "Edge cases" },
  { id: "tenure", label: "Tenure" }, { id: "term-limits", label: "Term limits" },
  { id: "missingness", label: "Missingness" }, { id: "nonclaims", label: "What this does not mean" },
  { id: "validation", label: "Validation" }, { id: "cite", label: "Cite this page" },
];

export default function PowerTransferLedgerRulebookPage() {
  return <MethodologyLayout items={SECTIONS}><EditorialPage><SmartBreadcrumbs />
    <h1 className="editorial-page-title">Power and Transfer Ledger rulebook</h1>
    <p className="editorial-page-subtitle">A public coding rulebook for an experimental ledger of executive tenure and transfers. Current prototype coverage is limited to sourced current-tenure records.</p>
    <div className="editorial-warning"><strong>Research prototype.</strong> Historical transfer, alternation, and term-limit fields have not passed their evidence and independent-review gates. They are not published as country findings.</div>
    <section className="editorial-section"><MarkdownContent file="content/research-power-transfer-ledger.md" /></section>
    <section className="editorial-section" id="cite"><h2>Cite this page</h2><CiteAccordion subject="Civica Atlas — Power and Transfer Ledger rulebook" pageTitle="Power and Transfer Ledger rulebook" url="https://civicaatlas.org/civica-index/methodology/power-transfer-ledger" dataVintage="Research prototype v1" /></section>
    <nav className="editorial-footer-nav" aria-label="Methodology navigation"><Link href="/civica-index/methodology">← Index methodology</Link><Link href="/civica-index/methodology">Candidate tournament</Link></nav>
  </EditorialPage></MethodologyLayout>;
}
