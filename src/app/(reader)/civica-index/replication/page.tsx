import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { Chip } from "@/components/editorial/Pill";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { civicaIndex, replicationPackage } from "@/lib/content/site-state";
import type { ReplicationComponentStatus } from "@/lib/content/site-state";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Civica Index Replication Status",
  description:
    "Status surface for the frozen Civica Index tournament package, its reproducible artifacts, rights limits, and remaining independent-review gates.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/replication" },
};

const SECTIONS = [
  { id: "component-status", label: "Component status" },
  { id: "cite", label: "Cite this page" },
];

const PAGE_STATUS_LABEL: Record<typeof replicationPackage.pageStatus, string> = {
  "unpublished-pre-g2": "Not published",
  "tournament-package-available": "Tournament package available",
  "review-packet-available": "Review packet available",
  published: "Published",
};

const PAGE_STATUS_VARIANT: Record<
  typeof replicationPackage.pageStatus,
  "sand" | "sage"
> = {
  "unpublished-pre-g2": "sand",
  "tournament-package-available": "sage",
  "review-packet-available": "sage",
  published: "sage",
};

const COMPONENT_STATUS_LABEL: Record<ReplicationComponentStatus, string> = {
  available: "Available",
  "in-progress": "In progress",
  planned: "Planned",
  deferred: "Deferred",
};

const COMPONENT_STATUS_VARIANT: Record<
  ReplicationComponentStatus,
  "sage" | "blue" | "neutral" | "sand"
> = {
  available: "sage",
  "in-progress": "blue",
  planned: "neutral",
  deferred: "sand",
};

export default function ReplicationPage() {
  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <nav className="editorial-breadcrumbs">
          <Link href="/civica-index">← Civica Index</Link>
          <span>/</span>
          Replication status
        </nav>

        <h1 className="editorial-page-title">Replication status</h1>
        <p className="editorial-page-subtitle">
          <Chip
            variant={PAGE_STATUS_VARIANT[replicationPackage.pageStatus]}
            size="sm"
          >
            {PAGE_STATUS_LABEL[replicationPackage.pageStatus]}
          </Chip>{" "}
          Tracking what the frozen selected-product review packet contains and
          what still requires independent review.
        </p>

        <p>
          The selected-product packet freezes the source-native construct,
          inputs, code, environment, codebook, transformations, uncertainty,
          validation, sensitivity, subgroup results, limitations, citation,
          reviewer questions, and the complete tournament record. It
          reproduces under one checked command. External review remains open.
        </p>

        {/* PUBLIC_CLAIM: replication.package-status */}
        <Banner variant="info">
          The repository contains a reproducible Governance Evidence review
          packet. Exact source observations are not redistributed where
          publisher rights do not permit it, and no external reviewer has
          endorsed the selected product or the rejected composite candidates.
        </Banner>

        <section id="component-status" className="editorial-section">
          <SectionHeader
            eyebrow="Replication"
            title="Component status"
            dek="Every component the eventual replication package needs, its current build status, the owning master-checklist task, and what remains."
          />
          <div className="editorial-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>What remains</th>
                </tr>
              </thead>
              <tbody>
                {replicationPackage.components.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.status === "available" && c.href ? (
                        <Link href={c.href}>{c.label}</Link>
                      ) : (
                        c.label
                      )}
                    </td>
                    <td>
                      <Chip variant={COMPONENT_STATUS_VARIANT[c.status]} size="sm">
                        {COMPONENT_STATUS_LABEL[c.status]}
                      </Chip>
                    </td>
                    <td>{c.owner}</td>
                    <td>{c.whatRemains}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>

        <section id="cite" className="editorial-section">
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — Civica Index replication status"
            pageTitle="Civica Index replication status"
            url="https://civicaatlas.org/civica-index/replication"
            dataVintage={civicaIndex.lastRevisionIso}
          />
        </section>

        <footer className="editorial-footer-nav">
          <Link href="/civica-index/methodology">← Back to methodology</Link>
          <Link href="/civica-index/corrections">
            Report a data issue or methodology concern
          </Link>
        </footer>
      </EditorialPage>
    </MethodologyLayout>
  );
}
