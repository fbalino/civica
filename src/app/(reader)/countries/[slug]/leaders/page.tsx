import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJurisdictionBySlug, getLeaderTimeline } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { CountryFlag } from "@/components/CountryFlag";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return { title: "Country Not Found" };
  return {
    title: `${jurisdiction.name} Leaders & Head of State Timeline | Civica`,
    description: `Current and historical leaders of ${jurisdiction.name} — heads of state, heads of government, and their terms.`,
    alternates: { canonical: `https://civicaatlas.org/countries/${slug}/leaders` },
  };
}

export default async function LeadersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    // DB not connected
  }
  if (!jurisdiction) notFound();

  const rawTimeline = await getLeaderTimeline(jurisdiction.id);

  // Deduplicate: group by person+office, keep the term with the earliest start date
  const seen = new Map<string, typeof rawTimeline[number]>();
  for (const l of rawTimeline) {
    const key = `${l.personName}::${l.officeName}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, l);
    } else if (l.isCurrent && !existing.isCurrent) {
      seen.set(key, l);
    } else if (l.isCurrent === existing.isCurrent && l.startDate && existing.startDate && l.startDate < existing.startDate) {
      seen.set(key, { ...l, endDate: existing.endDate });
    }
  }
  const leaderTimeline = Array.from(seen.values());

  const currentLeaders = leaderTimeline.filter((l) => l.isCurrent);
  const pastLeaders = leaderTimeline.filter((l) => !l.isCurrent);

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
            Leaders
          </p>
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
        {leaderTimeline.length === 0 ? (
          <div className="cv-card">
            <h3 className="section-header">Leaders</h3>
            <p style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)", color: "var(--color-text-50)", margin: 0 }}>
              No leader data available for {jurisdiction.name}.
            </p>
          </div>
        ) : (
          <>
            {currentLeaders.length > 0 && (
              <div className="cv-card">
                <h3 className="section-header">Current Leaders</h3>
                {currentLeaders.map((leader, i) => (
                  <div
                    key={`current-${i}`}
                    style={{
                      padding: "14px 0",
                      borderBottom: i < currentLeaders.length - 1 ? "1px solid var(--color-stat-border)" : "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {leader.photoUrl && (
                      <img
                        src={leader.photoUrl}
                        alt={leader.personName}
                        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                      />
                    )}
                    <div>
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-18)", color: "var(--color-text-primary)", display: "block" }}>
                        {leader.personName}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-40)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        {leader.officeName}
                        {leader.partyName && (
                          <>
                            <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              {leader.partyColor && <span style={{ width: 5, height: 5, borderRadius: "50%", background: leader.partyColor }} />}
                              {leader.partyName}
                            </span>
                          </>
                        )}
                        {leader.startDate && (
                          <>
                            <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                            <span>Since {new Date(leader.startDate).getFullYear()}</span>
                          </>
                        )}
                        <SourceDot source="wikidata" retrievedAt="2026-04-13" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pastLeaders.length > 0 && (
              <div className="cv-card">
                <h3 className="section-header">Past Leaders</h3>
                {pastLeaders.slice(0, 20).map((leader, i) => (
                  <div
                    key={`past-${i}`}
                    style={{
                      padding: "10px 0",
                      borderBottom: i < Math.min(pastLeaders.length, 20) - 1 ? "1px solid var(--color-stat-border)" : "none",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)", color: "var(--color-text-primary)" }}>
                      {leader.personName}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-30)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      {leader.officeName}
                      {leader.startDate && (
                        <>
                          <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                          <span>
                            {new Date(leader.startDate).getFullYear()}
                            {leader.endDate ? `–${new Date(leader.endDate).getFullYear()}` : ""}
                          </span>
                        </>
                      )}
                      {leader.partyName && (
                        <>
                          <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {leader.partyColor && <span style={{ width: 5, height: 5, borderRadius: "50%", background: leader.partyColor }} />}
                            {leader.partyName}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
                {pastLeaders.length > 20 && (
                  <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-25)", marginTop: 12 }}>
                    Showing 20 of {pastLeaders.length} past leaders.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
