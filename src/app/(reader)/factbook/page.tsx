import type { Metadata } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import { FactbookIndexSearchList } from "@/components/factbook/FactbookIndexSearchList";

// Minimal Phase C landing for /factbook. Uses the shared `.editorial-page`
// container + `.factbook-index-*` classes from factbook.css so it picks up
// the same mobile breakpoints as the rest of the site.

export const metadata: Metadata = {
  title: "Factbook — All Countries",
  description:
    "Reference dossiers for every country and territory. Sourced from the CIA World Factbook with Civica governance overlays.",
  alternates: { canonical: "https://civicaatlas.org/factbook" },
};

export default async function FactbookIndexPage() {
  let countries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not connected
  }

  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="editorial-page editorial-page--full">
      <header className="editorial-page-header">
        <p className="editorial-page-meta">Factbook</p>
        <h1 className="editorial-page-title">All countries</h1>
        <p className="editorial-page-subtitle">
          Reference dossiers for every country. Each page combines the CIA
          World Factbook with Civica's governance overlays.
        </p>
      </header>

      <FactbookIndexSearchList countries={sorted} />
    </div>
  );
}
