import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Licensing — Data & Code Reuse Terms",
  description:
    "How to reuse Civica Atlas data, sources, public API responses, and code — with the license posture for each upstream source, from public domain to publisher-restricted.",
  alternates: { canonical: "https://civicaatlas.org/licensing" },
  openGraph: withOg({
    title: "Licensing — Data & Code Reuse Terms · Civica Atlas",
    description:
      "How to reuse Civica Atlas data, sources, public API responses, and code, with the license posture for each upstream source.",
    url: "https://civicaatlas.org/licensing",
  }),
};

const SOURCE_ROWS = [
  {
    source: "CIA World Factbook archive",
    license: "Public domain",
    note: "Frozen January 2026 reference layer preserved after the Factbook sunset.",
  },
  {
    source: "Wikidata and selected Wikimedia Commons media",
    license: "CC0 or file-level Commons license",
    note: "Structured facts and media retain their upstream attribution and license metadata.",
  },
  {
    source: "IPU Parline and Constitute Project",
    license: "Non-commercial upstream terms",
    note: "These records are visible for research and reference use but remain subject to publisher restrictions.",
  },
  {
    source: "V-Dem, WGI, HDI, Freedom House, CPI, GPI, FSI, and other index feeds",
    license: "Publisher-specific terms",
    note: "Civica preserves source, vintage, and license context with the derived score inputs.",
  },
  {
    source: "Civica Index and Civica Pulse outputs",
    license: "Civica methodology and derived outputs",
    note: "Cite Civica Atlas and the upstream sources shown with each data point when reusing outputs.",
  },
  {
    source: "Civica source code",
    license: "Repository license",
    note: "Code reuse is governed by the license and notices in the public GitHub repository.",
  },
  {
    source: "Country and territory hero engravings",
    license: "Civica editorial imagery — no third-party reuse license granted",
    note: "AI-assisted editorial illustrations, not documentary photographs. See Imagery below.",
  },
];

export default function LicensingPage() {
  return (
    <EditorialPage
      breadcrumbs={
        <>
          <Link href="/about">About</Link>
          <span>/</span>
          Licensing
        </>
      }
      title="Licensing"
    >
      <section className="editorial-section">
        {/* PUBLIC_CLAIM: licensing.mixed-rights */}
        <p className="editorial-page-subtitle">
          Civica is a mixed-source reference atlas. Public-domain and CC0 data
          can generally be reused freely; publisher-restricted datasets remain
          governed by their original terms.
        </p>

        <Banner variant="info">
          This page is a practical reuse guide, not legal advice. For exact
          reuse obligations, follow the upstream publisher license shown with
          each data point.
        </Banner>
      </section>

      <section id="source-licenses" className="editorial-section">
        <SectionHeader
          eyebrow="Sources"
          title="Source license summary"
          dek="Civica keeps license and freshness metadata attached to source rows and reader-facing data points."
        />

        <DataTable>
          <thead>
            <tr>
              <th>Source</th>
              <th>License posture</th>
              <th>Reuse note</th>
            </tr>
          </thead>
          <tbody>
            {SOURCE_ROWS.map((row) => (
              <tr key={row.source}>
                <td>{row.source}</td>
                <td>{row.license}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </section>

      <section id="reuse" className="editorial-section">
        <SectionHeader
          eyebrow="Reuse"
          title="How to reuse Civica data"
          dek="Treat provenance as part of the data, not decoration."
        />

        <ul>
          <li>
            Preserve source names, license labels, and freshness dates when you
            reuse data from a country, API, or index page.
          </li>
          <li>
            Cite Civica Atlas when reusing Civica Index, Civica Pulse, or
            reconciliation-derived outputs.
          </li>
          <li>
            Do not treat restricted upstream sources as open data just because
            they appear inside Civica.
          </li>
          <li>
            For the full live source list, see{" "}
            <Link href="/about#sources">Data sources</Link>.
          </li>
        </ul>
      </section>

      <section id="imagery" className="editorial-section">
        <SectionHeader
          eyebrow="Imagery"
          title="Country and territory engravings"
          dek="Civica's hero engravings are AI-assisted editorial illustrations, not documentary photographs."
        />

        {/* PUBLIC_CLAIM: licensing.imagery-policy */}
        <p>
          Every country and territory masthead can carry an antique-style
          engraving depicting a well-known landmark or landscape. These
          images are AI-assisted editorial illustrations produced for
          Civica&apos;s almanac design language — they are not photographs
          and are not a claim about what a landmark currently looks like.
          Pages that show one are captioned &ldquo;Editorial engraving&rdquo;
          with a link back to this section.
        </p>

        <SectionHeader eyebrow="Tools" title="How the engravings are made" />
        <p>
          Assets are produced with AI image-generation tooling (Codex-driven
          generation), exported as PNG, then converted to WebP
          (<code>cwebp -q 80 -resize 1500 0</code>) before being committed
          under <code>public/engravings/countries/</code> and{" "}
          <code>public/engravings/territories/</code>. See{" "}
          <a
            href="https://github.com/fbalino/civica/blob/main/public/engravings/README.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            public/engravings/README.md
          </a>{" "}
          for the current format and workflow.
        </p>

        <SectionHeader eyebrow="Records" title="What is and isn't retained" />
        <p>
          Civica does not currently retain a complete per-asset generation
          record — prompt text, reference imagery, and model version — for
          the launch corpus of country and territory engravings. Assets
          created or replaced going forward retain that record. Do not treat
          an existing engraving as having a documented prompt/reference
          history unless a record has been published for it.
        </p>

        <SectionHeader eyebrow="Quality" title="Review and correction" />
        <p>
          Automated checks currently cover defined technical properties —
          asset presence, format, and dimensions — for territory engravings
          (<code>npm run validate:territory-engravings</code>). Human visual
          review of what each engraving depicts and whether its caption
          correctly names the landmark is being strengthened over time; it is
          not yet complete or independently audited. If you notice a wrong
          landmark, an inaccurate caption, or anything else off about an
          engraving, use the{" "}
          <Link href="/contact">contact form</Link> and we will investigate
          and correct it.
        </p>

        <SectionHeader eyebrow="Rights" title="Reuse rights" />
        <p>
          Display of these engravings on Civica Atlas is authorized by
          Civica. Civica does not currently grant a separate license for
          third-party reuse of editorial illustrations outside the site;
          provenance and legal review of this imagery is pending. Contact us
          before reusing an engraving anywhere else.
        </p>
      </section>

      <section id="code" className="editorial-section">
        <SectionHeader
          eyebrow="Code"
          title="Repository"
          dek="Implementation details, issue tracking, and code reuse terms live with the public repository."
        />

        <p>
          The Civica repository is available on{" "}
          <a
            href="https://github.com/fbalino/civica"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          . Check the repository license and notices before redistributing code
          or building a derivative service.
        </p>
      </section>

      <footer className="editorial-footer-nav">
        <Link href="/about#sources">Data sources</Link>
        <Link href="/api-docs">API documentation</Link>
        <Link href="/contact">Contact the editors</Link>
      </footer>
    </EditorialPage>
  );
}
