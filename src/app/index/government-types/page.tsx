import type { Metadata } from "next";
import Link from "next/link";
import { getCIByGovernmentType } from "@/lib/db/queries";
import { GovernmentTypesExplorer } from "@/components/ci/GovernmentTypesExplorer";
import type { GovTypeRow } from "@/components/ci/GovernmentTypesExplorer";

export const metadata: Metadata = {
  title: "CI by Government Type — Civica Index",
  description:
    "Compare Civica Index score distributions across government types: republics, constitutional monarchies, federal states, and more.",
  alternates: { canonical: "https://civicaatlas.org/index/government-types" },
  openGraph: {
    title: "CI by Government Type | Civica Index",
    description:
      "Score distributions (min, median, average, max) for each government type across 190+ sovereign states.",
    url: "https://civicaatlas.org/index/government-types",
  },
};

function normalizeRows(raw: unknown): GovTypeRow[] {
  const rows = Array.isArray(raw)
    ? raw
    : ((raw as { rows?: unknown[] }).rows ?? []);

  return (rows as Record<string, unknown>[])
    .filter((r) => r != null && typeof r.governmentType === "string")
    .map((r) => ({
      governmentType: r.governmentType as string,
      countryCount:   Number(r.countryCount   ?? 0),
      avgScore:       Number(r.avgScore        ?? 0),
      minScore:       Number(r.minScore        ?? 0),
      maxScore:       Number(r.maxScore        ?? 0),
      medianScore:    Number(r.medianScore     ?? 0),
      q1:             Number(r.q1              ?? 0),
      q3:             Number(r.q3              ?? 0),
    }));
}

export default async function GovernmentTypesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const quarter = typeof sp?.quarter === "string" ? sp.quarter : undefined;

  let rows: GovTypeRow[] = [];
  try {
    const raw = await getCIByGovernmentType(quarter);
    rows = normalizeRows(raw);
  } catch {
    // DB not yet seeded
  }

  return (
    <div
      style={{
        maxWidth: "var(--max-w-wide, 960px)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <header style={{ marginBottom: 40 }}>
        <nav
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-11)",
            color: "var(--color-text-30)",
            marginBottom: 16,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Link
            href="/index"
            style={{ color: "var(--color-accent)", textDecoration: "none" }}
          >
            Civica Index
          </Link>
          <span style={{ opacity: 0.4 }}>›</span>
          <span>Government Types</span>
        </nav>

        <h1 className="page-heading">By Government Type</h1>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-18)",
            color: "var(--color-text-60)",
            maxWidth: 600,
            lineHeight: 1.5,
            marginBottom: 0,
          }}
        >
          CI score distribution across government types — showing spread,
          central tendency, and outliers for each governance model.
        </p>

        {rows.length > 0 && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              marginTop: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {rows.length} government types ·{" "}
            {rows.reduce((s, r) => s + r.countryCount, 0)} countries
          </p>
        )}
      </header>

      {rows.length > 0 ? (
        <GovernmentTypesExplorer data={rows} />
      ) : (
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-18)",
              color: "var(--color-text-40)",
              marginBottom: 8,
            }}
          >
            No Civica Index data available yet.
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-25)",
            }}
          >
            Run <code>npm run ingest:ci</code> and{" "}
            <code>npm run calculate:ci</code> to populate scores.
          </p>
          <div style={{ marginTop: 24 }}>
            <Link
              href="/index"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-12)",
                color: "var(--color-accent)",
                textDecoration: "none",
              }}
            >
              ← Back to Index
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
