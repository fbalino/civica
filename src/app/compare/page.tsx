import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getAllJurisdictions,
  getJurisdictionsBySlugs,
  getGovernmentStructure,
} from "@/lib/db/queries";
import { CompareSelector } from "./selector";
import { CompareTable } from "./CompareTable";

export const metadata: Metadata = {
  title: "Compare Government Structures — Side-by-Side Country Comparison",
  description:
    "Compare government structures between any two countries. See differences in executive, legislative, and judicial branches, political systems, and governance models side by side.",
  alternates: { canonical: "https://civicaatlas.org/compare" },
  openGraph: {
    title: "Compare Government Structures — Side-by-Side Country Comparison | Civica",
    description:
      "Compare government structures between any two countries. See differences in executive, legislative, and judicial branches, political systems, and governance models side by side.",
    url: "https://civicaatlas.org/compare",
  },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const rawC = resolvedParams?.c;
  const slugs: string[] = Array.isArray(rawC) ? rawC : rawC ? [rawC] : [];
  const validSlugs = slugs.filter((s) => typeof s === "string" && s.length > 0).slice(0, 3);

  let allCountries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    allCountries = await getAllJurisdictions();
  } catch {}

  const countryList = allCountries.map((c) => ({
    slug: c.slug,
    name: c.name,
    iso2: c.iso2,
  }));

  let selected: Awaited<ReturnType<typeof getJurisdictionsBySlugs>> = [];
  let govStructures: Awaited<ReturnType<typeof getGovernmentStructure>>[] = [];

  if (validSlugs.length > 0) {
    try {
      selected = await getJurisdictionsBySlugs(validSlugs);
      selected.sort((a, b) => validSlugs.indexOf(a.slug) - validSlugs.indexOf(b.slug));
      govStructures = await Promise.all(selected.map((s) => getGovernmentStructure(s.id)));
    } catch {}
  }

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <h1 className="page-heading">
        Compare
      </h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          marginBottom: 32,
        }}
      >
        Select up to three countries to compare side by side.
      </p>

      <Suspense fallback={null}>
        <CompareSelector countries={countryList} />
      </Suspense>

      {selected.length >= 2 && (
        <CompareTable selected={selected} govStructures={govStructures} />
      )}

      {selected.length === 1 && (
        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-14)", color: "var(--color-text-40)", padding: "48px 0" }}>
          Select at least one more country to compare.
        </p>
      )}

      {selected.length === 0 && validSlugs.length === 0 && (
        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-14)", color: "var(--color-text-40)", padding: "48px 0" }}>
          Choose countries above to begin comparing.
        </p>
      )}
    </div>
  );
}
