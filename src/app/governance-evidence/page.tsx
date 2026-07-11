import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { CountryFlag } from "@/components/CountryFlag";
import { DataValueState } from "@/components/DataValueState";
import { SourceDot } from "@/components/SourceDot";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { DataTable } from "@/components/editorial/DataTable";
import { formatNativeEvidenceValue, formatUncertaintyStatus } from "@/lib/ci/governance-evidence";
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
        <DataTable aria-label={`Source-native governance evidence for ${evidence.country.name}`}>
          <thead><tr><th>Source and measure</th><th>Native observation</th><th>Publisher uncertainty</th><th>Vintage and access</th></tr></thead>
          <tbody>{evidence.rows.map((row) => (
            <tr key={`${row.sourceId}:${row.indicatorId}`}>
              <td><strong>{row.label}</strong><br /><span>{row.sourceOwner} <SourceDot source={row.sourceId} retrievedAt={row.lastSyncAt} /></span><br /><small>{row.construct}</small></td>
              <td className="num"><DataValueState status={row.valueStatus === "observed" ? "observed" : "missing"} reason={row.missingReason}>{row.value === null ? null : <><strong>{formatNativeEvidenceValue(row.value, row.nativeMin, row.nativeMax)}</strong><br /><small>{row.nativeUnit}<br />{row.direction}</small></>}</DataValueState></td>
              <td>{row.uncertaintyLower !== null && row.uncertaintyUpper !== null ? <><strong>{formatNativeEvidenceValue(row.uncertaintyLower, row.nativeMin, row.nativeMax)}–{formatNativeEvidenceValue(row.uncertaintyUpper, row.nativeMin, row.nativeMax)}</strong><br /><small>{formatUncertaintyStatus(row.uncertaintyStatus)}</small></> : <><strong>Not published</strong><br /><small>{formatUncertaintyStatus(row.uncertaintyStatus)}</small></>}</td>
              <td><strong>{row.sourceVintage}</strong><br /><Link href={row.sourceUrl}>Publisher file</Link><br /><small>{row.exportPermission === "allowed" ? "Civica export allowed with attribution" : "Download from publisher; Civica bulk export blocked"}</small></td>
            </tr>
          ))}</tbody>
        </DataTable>
      </section>
      <nav className="editorial-footer-nav"><Button href={`/api/governance-evidence/${evidence.country.slug}`} variant="secondary">Download rights-safe JSON</Button><Link href="/licensing#rights-manifest">Rights manifest</Link><Link href="/civica-index/methodology">Index research methodology</Link></nav>
    </div>
  );
}
