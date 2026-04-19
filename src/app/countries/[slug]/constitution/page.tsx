import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJurisdictionBySlug, getConstitution } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { CountryFlag } from "@/components/CountryFlag";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return { title: "Country Not Found" };
  return {
    title: `${jurisdiction.name} Constitution | Civica`,
    description: `Full text and metadata of the constitution of ${jurisdiction.name}, via the Constitute Project.`,
    alternates: { canonical: `https://civicaatlas.org/countries/${slug}/constitution` },
  };
}

export default async function ConstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    // DB not connected
  }
  if (!jurisdiction) notFound();

  const constitution = await getConstitution(jurisdiction.id);

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
            Constitution
          </p>
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        {!constitution ? (
          <div className="cv-card">
            <h3 className="section-header">Constitution</h3>
            <p style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)", color: "var(--color-text-50)", margin: 0, lineHeight: "var(--leading-relaxed)" }}>
              Constitution data for {jurisdiction.name} has not yet been added to Civica.
            </p>
          </div>
        ) : (
          <>
            <div className="cv-card">
              <h3 className="section-header">Constitution</h3>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
                {constitution.year && (
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-30)", textTransform: "uppercase", display: "block" }}>
                      Enacted
                    </span>
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-22)", color: "var(--color-text-primary)" }}>
                      {constitution.year}
                    </span>
                  </div>
                )}
                {constitution.yearUpdated && (
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-30)", textTransform: "uppercase", display: "block" }}>
                      Last Amended
                    </span>
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-22)", color: "var(--color-text-primary)" }}>
                      {constitution.yearUpdated}
                    </span>
                  </div>
                )}
              </div>
              {constitution.constituteProjectId && (
                <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-30)", margin: 0 }}>
                  Source: Constitute Project
                  <SourceDot source="Constitute Project" retrievedAt="2026-04-13" />
                </p>
              )}
            </div>

            {constitution.fullTextHtml && (
              <div className="cv-card">
                <h3 className="section-header">Full Text</h3>
                <div
                  style={{
                    fontFamily: "var(--font-body-sans)",
                    fontSize: "var(--text-14)",
                    lineHeight: "var(--leading-relaxed)",
                    color: "var(--color-text-85)",
                    maxHeight: 800,
                    overflow: "auto",
                  }}
                  dangerouslySetInnerHTML={{ __html: constitution.fullTextHtml }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
