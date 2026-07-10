import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { Chip } from "@/components/editorial/Pill";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { getSiteStats, type SiteStats } from "@/lib/content/site-stats";
import { civicaIndex, replicationPackage } from "@/lib/content/site-state";
import type { ReplicationComponentStatus } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica Index Replication Status",
  description:
    "Status surface for the research-beta Civica Index replication package: no package is currently published, and every required component is listed with its individual build status and owner.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/replication" },
};

const SECTIONS = [
  { id: "component-status", label: "Component status" },
  { id: "cite", label: "Cite this page" },
];

const PAGE_STATUS_LABEL: Record<typeof replicationPackage.pageStatus, string> = {
  "unpublished-pre-g2": "Not published",
  published: "Published",
};

const PAGE_STATUS_VARIANT: Record<
  typeof replicationPackage.pageStatus,
  "sand" | "sage"
> = {
  "unpublished-pre-g2": "sand",
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

export default async function ReplicationPage() {
  let stats: SiteStats | null = null;
  try {
    stats = await getSiteStats();
  } catch {
    stats = null;
  }
  const scoredJurisdictions = stats?.currentScoredJurisdictions ?? null;

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
          Tracking what still has to exist before a Civica Index score can be
          independently reproduced from source.
        </p>

        <p>
          The broader atlas release package is a G2 milestone in the master
          plan: a clean environment reproducing the frozen release, checksums,
          a coverage report, a codebook, a rights manifest, and citation
          metadata. That complete bundle does not yet exist. Whether the
          current Index is reproduced, redesigned, or retired is decided by
          the later G3 validation tournament and its IDX-028 replication
          packet. This page tracks the shared release components without
          implying either milestone has passed.
        </p>

        {/* PUBLIC_CLAIM: replication.package-status */}
        <Banner variant="warn">
          No replication package is currently published. The components
          below are individually marked with their build status.
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

          <p>
            For live-site context only — not a released replication output —
            the Civica Index currently scores{" "}
            {scoredJurisdictions !== null
              ? `the ${scoredJurisdictions} jurisdictions with a current Beta score`
              : "jurisdictions with a current Beta score"}
            . That running count is not a codebook, checksum, or reproducible
            bundle; it exists only to show the current scope the replication
            package will eventually need to cover.
          </p>
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
