import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { CountryFlag } from "@/components/CountryFlag";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { GovernanceEvidenceTable } from "@/components/governance-evidence/GovernanceEvidenceTable";
import { getGovernanceEvidence, getGovernanceEvidenceCountries } from "@/lib/db/queries-governance-evidence";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Governance Evidence Dashboard", description: "Compare established governance sources on their native scales, with provenance, vintage, uncertainty, and missingness preserved." };

export default async function GovernanceEvidencePage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const countries = await getGovernanceEvidenceCountries();
  const requested = (await searchParams).country;
  const slug = requested && countries.some((country) => country.slug === requested) ? requested : countries.find((country) => country.slug === "japan")?.slug ?? countries[0]?.slug;
  if (!slug) notFound();
  const evidence = await getGovernanceEvidence(slug);
  if (!evidence) notFound();
  return (
    <div className="editorial-tool-page">
      <span className="editorial-eyebrow">Governance evidence · source-native view</span>
      <h1 className="editorial-tool-title">What the established sources report.</h1>
      <p className="editorial-tool-dek">Five published observations, kept on their own scales. Civica does not average them, grade the country, or resolve their disagreement.</p>
      <CountrySearchCombobox countries={countries} placeholder={`Change country · ${evidence.country.name}`} ariaLabel="Choose a country" countryPathPrefix="/governance-evidence" countryQueryParam="country" />
      <section className="editorial-section" aria-labelledby="evidence-country">
        <div className="editorial-section-header">
          <span className="editorial-eyebrow">Reference year {evidence.year}</span>
          <h2 id="evidence-country"><CountryFlag iso2={evidence.country.iso2} size={28} /> {evidence.country.name}</h2>
          <p>Release <code>{evidence.releaseId}</code>. Values are exact publisher points; intervals appear only where the publisher supplies them.</p>
        </div>
        <Banner variant="info">These sources overlap in constructs and upstream evidence. Agreement is not independent corroboration, and the rows do not form a Civica country-quality score.</Banner>
        <GovernanceEvidenceTable countryName={evidence.country.name} rows={evidence.rows} />
      </section>
      <nav className="editorial-footer-nav"><Button href={`/api/governance-evidence/${evidence.country.slug}`} variant="secondary">Download rights-safe JSON</Button><Link href="/licensing#reuse">Rights and reuse</Link><Link href="/licensing#rights-manifest">Rights manifest</Link><Link href="/civica-index/methodology">Index research methodology</Link></nav>
    </div>
  );
}
