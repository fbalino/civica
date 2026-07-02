import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { Reveal } from "@/components/motion/Reveal";
import {
  getPeerGroupingMigrationTable,
  type PeerGroupingMigrationRow,
} from "@/lib/db/queries-peer-grouping";
import { currentVintage, peerGrouping } from "@/lib/content/site-state";
import { STRUCTURAL_FAMILY_SUNSET_DATE_ISO } from "@/lib/api/deprecation";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Per-country migration table — Peer-grouping methodology",
  description:
    "Per-country mapping from the retired structural_family taxonomy to the replacement peer-lens fields (World Bank region+income, V-Dem RoW, BR/CGV regime, monarchy_status, government_form_description). Replication-script maintainers can also consume this as JSON via /api/v1/peer-groupings/migration.",
  alternates: {
    canonical:
      "https://civicaatlas.org/civica-index/methodology/peer-grouping/migration",
  },
};

function dash(v: string | null | undefined): string {
  if (v == null) return "—";
  if (v.trim().length === 0) return "—";
  return v;
}

export default async function PeerGroupingMigrationPage() {
  let rows: PeerGroupingMigrationRow[] = [];
  try {
    rows = await getPeerGroupingMigrationTable();
  } catch {
    // DB not seeded — render the page shell with an empty state below
  }

  return (
    <MethodologyLayout
      items={[
        { id: "how-to-read", label: "How to read" },
        { id: "table", label: "The table" },
        { id: "cite", label: "Cite this page" },
      ]}
      contentClassName="methodology-content--wide"
    >
      <EditorialPage width="full">
      <SmartBreadcrumbs />

      <h1 className="editorial-page-title">
        Per-country migration table
      </h1>
      <p className="editorial-page-subtitle">
        From the retired <code>structural_family</code> heuristic to
        the replacement peer-lens fields, country by country.
      </p>
      <div className="editorial-page-meta">
        <span>{rows.length} sovereign states</span>
        <span>·</span>
        <span>Vintage: {currentVintage}</span>
        <span>·</span>
        <span>Sunset {STRUCTURAL_FAMILY_SUNSET_DATE_ISO}</span>
      </div>

      <div className="editorial-warning">
        <strong>For replication-script maintainers.</strong> The
        legacy <code>structural_family</code> column on{" "}
        <code>government_taxonomies</code> and the corresponding API
        fields remain available through {STRUCTURAL_FAMILY_SUNSET_DATE_ISO}. After that date
        the column is dropped and the API fields return only the
        peer-lens replacements. Update country-metadata joins now;
        the JSON form of this table at{" "}
        <Link href="/api/v1/peer-groupings/migration">
          /api/v1/peer-groupings/migration
        </Link>{" "}
        is the recommended bulk-rewrite source.
      </div>

      <Reveal as="section" className="editorial-section" id="how-to-read" amount={0.3}>
        <h2>How to read</h2>
        <p>
          Each row is one sovereign state. The first two columns show
          the retired heuristic values. The remaining columns show the
          per-domain peer-lens replacements: World Bank region+income
          for material indicators, V-Dem Regimes of the World for
          governance indicators, BR/CGV regime as the alternate
          governance lens, and constitutional-form metadata
          (<code>monarchy_status</code> and
          {" "}<code>government_form_description</code>).
        </p>
        <p>
          Empty cells (—) mean the underlying source has no
          classification for that jurisdiction. See the{" "}
          <Link href="/civica-index/methodology/peer-grouping">
            methodology page
          </Link>{" "}
          for the per-jurisdiction fallback table covering Taiwan,
          Kosovo, Palestine, Western Sahara, and Vatican City.
        </p>
      </Reveal>

      <Reveal as="section" className="editorial-section" id="table" amount={0.05}>
        <h2>The table</h2>
        {rows.length === 0 ? (
          <p>No rows available — check back after the next data sync.</p>
        ) : (
          <div className="editorial-table-scroll">
            <table className="peer-migration-table">
              <thead>
                <tr>
                  <th scope="col">Country</th>
                  <th scope="col">structuralFamily (deprecated)</th>
                  <th scope="col">structuralSubtype (deprecated)</th>
                  <th scope="col">worldBankRegion</th>
                  <th scope="col">worldBankIncomeGroup</th>
                  <th scope="col">vdemRow</th>
                  <th scope="col">cgvRegime</th>
                  <th scope="col">monarchyStatus</th>
                  <th scope="col">governmentFormDescription</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.slug}>
                    <td>
                      <Link href={`/country/${row.slug}/civica-data`}>
                        {row.name}
                      </Link>
                    </td>
                    <td>
                      <code>{dash(row.structuralFamily)}</code>
                    </td>
                    <td>
                      <code>{dash(row.structuralSubtype)}</code>
                    </td>
                    <td>{dash(row.worldBankRegion)}</td>
                    <td>{dash(row.worldBankIncomeGroup)}</td>
                    <td>{dash(row.vdemRow)}</td>
                    <td>
                      <code>{dash(row.cgvRegime)}</code>
                    </td>
                    <td>
                      <code>{dash(row.monarchyStatus)}</code>
                    </td>
                    <td>{dash(row.governmentFormDescription)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Reveal>

      <Reveal as="section" className="editorial-section" id="cite" amount={0.15}>
        <h2>Cite this page</h2>
        <CiteAccordion
          subject="Civica Atlas Methodology — Peer-grouping migration table"
          pageTitle="Peer-grouping migration table"
          url="https://civicaatlas.org/civica-index/methodology/peer-grouping/migration"
          dataVintage={peerGrouping.adoptedAt}
        />
      </Reveal>

      <footer className="editorial-footer-nav">
        <Link href="/civica-index/methodology/peer-grouping">
          ← Peer-grouping methodology
        </Link>
        <Link href="/api/v1/peer-groupings/migration">JSON →</Link>
      </footer>
      </EditorialPage>
    </MethodologyLayout>
  );
}
