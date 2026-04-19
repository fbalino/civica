import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJurisdictionBySlug, getDemocracyScores, getRegionalDemocracyComparison } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { CountryFlag } from "@/components/CountryFlag";

function StatRow({ label, val, source, date }: { label: string; val: string; source?: string; date?: string }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__value">
        {val}
        <SourceDot source={source ?? "cia_factbook"} retrievedAt={date ?? "2026-01-23"} />
      </span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return { title: "Country Not Found" };
  return {
    title: `${jurisdiction.name} Democracy Index & Freedom House Score | Civica`,
    description: `V-Dem democracy score, Freedom House rating, and regional comparison for ${jurisdiction.name}.`,
    alternates: { canonical: `https://civicaatlas.org/countries/${slug}/democracy` },
  };
}

export default async function DemocracyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    // DB not connected
  }
  if (!jurisdiction) notFound();

  const democracyData = await getDemocracyScores(jurisdiction.id);
  const regionalComparison = await getRegionalDemocracyComparison(jurisdiction.id, democracyData.continent);

  return (
    <div style={{ maxWidth: "var(--max-w-content)", margin: "0 auto", padding: "var(--spacing-content-top) var(--spacing-page-x)" }}>
      <Link href={`/countries/${slug}`} className="breadcrumb">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
        {jurisdiction.name}
      </Link>

      <div className="country-header">
        <CountryFlag iso2={jurisdiction.iso2} size={56} />
        <div>
          <h1 className="country-title">{jurisdiction.name}</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-30)", margin: "6px 0 0" }}>
            Democracy
          </p>
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="cv-card">
          <h3 className="section-header">Democracy Index</h3>
          {democracyData.democracyIndex != null ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-36)", color: "var(--color-text-primary)" }}>
                {democracyData.democracyIndex.toFixed(2)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-30)" }}>
                / 1.00
                <SourceDot source="V-Dem Institute" retrievedAt="2025" />
              </span>
            </div>
          ) : (
            <p style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)", color: "var(--color-text-50)", margin: 0 }}>
              No democracy index data available.
            </p>
          )}
        </div>

        {democracyData.freedomHouseFacts.length > 0 && (
          <div className="cv-card">
            <h3 className="section-header">Freedom House</h3>
            {democracyData.freedomHouseFacts.map((f) => (
              <StatRow
                key={f.factKey}
                label={f.factKey.replace("freedom_house_", "").replace(/_/g, " ")}
                val={f.factValue ?? "—"}
                source="Freedom House"
                date={f.factYear != null ? String(f.factYear) : undefined}
              />
            ))}
          </div>
        )}

        {regionalComparison.length > 0 && (
          <div className="cv-card">
            <h3 className="section-header">Regional Comparison ({jurisdiction.continent})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {regionalComparison.map((rc, i) => (
                <a
                  key={rc.id}
                  href={`/countries/${rc.slug}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: i < regionalComparison.length - 1 ? "1px solid var(--color-stat-border)" : "none",
                    textDecoration: "none",
                    color: "inherit",
                    fontWeight: rc.id === jurisdiction.id ? 600 : 400,
                    background: rc.id === jurisdiction.id ? "var(--color-surface-hover)" : "transparent",
                    borderRadius: rc.id === jurisdiction.id ? "var(--radius-sm)" : 0,
                    paddingLeft: rc.id === jurisdiction.id ? 8 : 0,
                    paddingRight: rc.id === jurisdiction.id ? 8 : 0,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-25)", marginRight: 8, minWidth: 20, display: "inline-block" }}>
                      {i + 1}.
                    </span>
                    {rc.name}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-40)" }}>
                    {rc.democracyIndex?.toFixed(2) ?? "—"}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
