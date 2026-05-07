import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllMetricDefinitionsWithCoverage } from "@/lib/db/queries";
import { OutcomesExplorer } from "@/components/outcomes/OutcomesExplorer";
import type { MetricOption } from "@/components/outcomes/OutcomesExplorer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica Conditions — Material Conditions Across Countries",
  description:
    "Explore how material conditions like human development, peace & security, and economic stability vary across countries and government types. Compare 195 countries.",
  alternates: { canonical: "https://civicaatlas.org/civica-conditions" },
  openGraph: {
    title: "Civica Conditions — Material Conditions Across Countries",
    description:
      "Explore how material conditions like human development, peace & security, and economic stability vary across countries and government types. Compare 195 countries.",
    url: "https://civicaatlas.org/civica-conditions",
  },
};

// Shape returned by getAllMetricDefinitionsWithCoverage rows
interface RawMetricRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  unit: string | null;
  higherIsBetter: boolean;
  coverageCount?: number | string | null;
  latestYear?: number | string | null;
}

function normalizeMetrics(rawMetrics: unknown): MetricOption[] {
  const rows: RawMetricRow[] = Array.isArray(rawMetrics)
    ? (rawMetrics as RawMetricRow[])
    : ((rawMetrics as { rows?: unknown[] }).rows ?? []) as RawMetricRow[];

  return rows
    .filter((r): r is RawMetricRow => r != null && typeof r.id === "string")
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      category: r.category,
      unit: r.unit ?? null,
      higherIsBetter: Boolean(r.higherIsBetter),
      coverageCount:
        r.coverageCount != null ? Number(r.coverageCount) : undefined,
      latestYear:
        r.latestYear != null ? Number(r.latestYear) : undefined,
    }));
}

// Fallback skeleton for Suspense boundary
function ExplorerFallback() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-content-top) var(--spacing-page-x) 80px",
      }}
    >
      <div
        className="skeleton"
        style={{ width: 160, height: 14, marginBottom: 20 }}
      />
      <div
        className="skeleton"
        style={{ width: 480, height: 52, marginBottom: 16 }}
      />
      <div
        className="skeleton"
        style={{ width: 560, height: 40, marginBottom: 36 }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[200, 80, 80, 120, 100].map((w, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: w, height: 34 }}
          />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ width: "100%", height: 60, marginBottom: 2 }}
        />
      ))}
    </div>
  );
}

export default async function CivicaConditionsPage() {
  const currentYear = new Date().getFullYear();

  let metrics: MetricOption[] = [];
  try {
    const rawMetrics = await getAllMetricDefinitionsWithCoverage(currentYear);
    metrics = normalizeMetrics(rawMetrics);
  } catch (err) {
    console.error("Failed to load metric definitions:", err);
  }

  const firstMetricId = metrics[0]?.id ?? "hdi";
  const defaultYear =
    metrics[0]?.latestYear ?? currentYear;

  return (
    <Suspense fallback={<ExplorerFallback />}>
      <OutcomesExplorer
        metrics={metrics}
        initialMetricId={firstMetricId}
        initialYear={defaultYear}
        pageVariant="civica-conditions"
      />
    </Suspense>
  );
}
