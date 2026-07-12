import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { CountryFlag } from "@/components/CountryFlag";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { GovernanceEvidenceTable } from "@/components/governance-evidence/GovernanceEvidenceTable";
import {
  getGovernanceEvidence,
  getGovernanceEvidenceCountries,
} from "@/lib/db/queries-governance-evidence";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Governance Evidence Dashboard",
  description:
    "Compare established governance sources on their native scales, with provenance, vintage, uncertainty, and missingness preserved.",
};

type Countries = Awaited<ReturnType<typeof getGovernanceEvidenceCountries>>;

/* The flagship landing: canonical PageHero (owner mandate 2026-07-06 — every
   browse/landing surface shares the one hero shell) with the country search in
   the hero slot, followed by a how-to-read section and the full country index.
   There is deliberately NO default country: /governance-evidence without a
   valid ?country= renders this landing, mirroring the country explorer. */
function GovernanceEvidenceLanding({ countries }: { countries: Countries }) {
  return (
    <>
      <PageHero
        eyebrow="Governance Evidence"
        titleId="governance-evidence-hero-title"
        title="What the established sources report."
        description={
          <>
            Published governance observations from V-Dem, Freedom House, the
            World Bank&rsquo;s WGI, and Transparency International — kept on
            their native scales, with source, vintage, published uncertainty,
            and reuse rights preserved. Civica does not average them, grade
            countries, or resolve their disagreement.
          </>
        }
        engraving={{
          src: "/engravings/hero.webp",
          darkSrc: "/engravings/hero-dark.webp",
        }}
        search={
          <CountrySearchCombobox
            countries={countries}
            placeholder="Find a country…"
            ariaLabel="Choose a country"
            countryPathPrefix="/governance-evidence"
            countryQueryParam="country"
          />
        }
      />

      <div className="editorial-page editorial-page--full">
        <section className="editorial-section" aria-labelledby="ge-how">
          <div className="editorial-section-header">
            <span className="editorial-eyebrow">How to read it</span>
            <h2 id="ge-how">Five observations, no verdict.</h2>
            <p>
              Each country page shows the five current observations side by
              side, each on the scale its publisher defined, with the
              publisher&rsquo;s own uncertainty where one is published and an
              explicit absence where none is.
            </p>
          </div>
          <Banner variant="info">
            These sources overlap in constructs and upstream evidence.
            Agreement between rows is not independent corroboration, and Civica
            does not turn the rows into a country-quality verdict.
          </Banner>
        </section>

        <section className="editorial-section" aria-labelledby="ge-countries">
          <div className="editorial-section-header">
            <span className="editorial-eyebrow">Browse</span>
            <h2 id="ge-countries">
              {countries.length > 0
                ? `All ${countries.length} sovereign states.`
                : "Sovereign states."}
            </h2>
          </div>
          <ul className="editorial-index-grid">
            {countries.map((country) => (
              <li key={country.slug}>
                <Link href={`/governance-evidence?country=${country.slug}`}>
                  <CountryFlag iso2={country.iso2} size={16} /> {country.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <nav className="editorial-footer-nav">
          <Link href="/licensing#reuse">Rights and reuse</Link>
          <Link href="/licensing#rights-manifest">Rights manifest</Link>
          <Link href="/civica-index/methodology">
            Index research methodology
          </Link>
        </nav>
      </div>
    </>
  );
}

export default async function GovernanceEvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const countries = await getGovernanceEvidenceCountries();
  const requested = (await searchParams).country;
  const selected = requested
    ? countries.find((country) => country.slug === requested)
    : undefined;

  // No country requested — or an unknown slug — lands on the selector, never
  // on a hardcoded default country and never on a 404 for a bad query param.
  if (!selected) return <GovernanceEvidenceLanding countries={countries} />;

  const evidence = await getGovernanceEvidence(selected.slug);
  if (!evidence) return <GovernanceEvidenceLanding countries={countries} />;

  return (
    <div className="editorial-tool-page">
      <span className="editorial-eyebrow">
        <Link href="/governance-evidence">Governance Evidence</Link> ·
        source-native view
      </span>
      <h1 className="editorial-tool-title">
        What the established sources report.
      </h1>
      <p className="editorial-tool-dek">
        Five published observations, kept on their own scales. Civica does not
        average them, grade the country, or resolve their disagreement.
      </p>
      <CountrySearchCombobox
        countries={countries}
        placeholder={`Change country · ${evidence.country.name}`}
        ariaLabel="Choose a country"
        countryPathPrefix="/governance-evidence"
        countryQueryParam="country"
      />
      <section className="editorial-section" aria-labelledby="evidence-country">
        <div className="editorial-section-header">
          <span className="editorial-eyebrow">
            Reference year {evidence.year}
          </span>
          <h2 id="evidence-country">
            <CountryFlag iso2={evidence.country.iso2} size={28} />{" "}
            {evidence.country.name}
          </h2>
          <p>
            Release <code>{evidence.releaseId}</code>.{" "}
            {evidence.series.citationLabel}. Original publication cut:{" "}
            {evidence.series.originalPublicationCutAt ??
              "none retained; this is not an as-published historical release"}
            .
          </p>
        </div>
        <Banner variant="info">
          These sources overlap in constructs and upstream evidence. The
          current 2024 observations were assembled in 2026 from harmonized
          publisher series. They do not show what Civica or each publisher
          reported in 2024.
        </Banner>
        <GovernanceEvidenceTable
          countryName={evidence.country.name}
          rows={evidence.rows}
        />
      </section>
      <nav className="editorial-footer-nav">
        <Button
          href={`/api/governance-evidence/${evidence.country.slug}`}
          variant="secondary"
        >
          Download rights-safe JSON
        </Button>
        <Link href="/governance-evidence">All countries</Link>
        <Link href="/licensing#reuse">Rights and reuse</Link>
        <Link href="/licensing#rights-manifest">Rights manifest</Link>
        <Link href="/civica-index/methodology">Index research methodology</Link>
      </nav>
    </div>
  );
}
