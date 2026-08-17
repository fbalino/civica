import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { withOg } from "@/lib/og";
import {
  RIGHTS_ARTIFACT_CLASSES,
  CODE_RIGHTS,
  RELEASE_MANIFEST_STATUS,
  ACCESS_VS_REUSE_BOUNDARY,
} from "@/lib/claims/reuse-rights";
import {
  PRODUCT_RIGHTS,
  RELEASE_ARTIFACT_RIGHTS,
  RIGHTS_MANIFEST_PATH,
  RIGHTS_MANIFEST_VERSION,
  SOURCE_RIGHTS,
} from "@/lib/rights/manifest";

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
          This page is a practical reuse guide, not legal advice. Check the
          publisher terms attached to the value. If no terms appear there, find
          the source in the registry below. A citation or public page does not
          by itself grant reuse permission.
        </Banner>

        <Banner variant="info">
          {/* PUBLIC_CLAIM: licensing.rights-manifest */}
          {RELEASE_MANIFEST_STATUS.statement}
        </Banner>
      </section>

      <section id="rights-manifest" className="editorial-section">
        <SectionHeader
          eyebrow={RIGHTS_MANIFEST_VERSION}
          title="Source and export rights registry"
          dek="Pending means the source stays out of public bulk downloads until its terms record is verified."
        />

        <p>
          The same registry is available as{" "}
          <a href={RIGHTS_MANIFEST_PATH}>machine-readable JSON</a>.
        </p>

        <DataTable>
          <thead>
            <tr>
              <th>Source</th>
              <th>License or status</th>
              <th>Public export</th>
              <th>Terms</th>
            </tr>
          </thead>
          <tbody>
            {SOURCE_RIGHTS.map((source) => (
              <tr key={source.sourceId}>
                <td>{source.sourceId}</td>
                <td>
                  {source.licenseId} · {source.reviewStatus}
                </td>
                <td>{source.publicExport}</td>
                <td>
                  <a
                    href={source.termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Publisher terms
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>

        <SectionHeader eyebrow="Products" title="Bulk export decisions" />
        <DataTable>
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCT_RIGHTS.map((product) => (
              <tr key={product.productId}>
                <td>{product.routeOrArtifact}</td>
                <td>{product.publicBulkExport}</td>
                <td>{product.reason}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>

        <SectionHeader eyebrow="Releases" title="Checked artifacts" />
        <DataTable>
          <thead>
            <tr>
              <th>Release</th>
              <th>Artifact</th>
              <th>Distributed</th>
              <th>Excluded payloads</th>
            </tr>
          </thead>
          <tbody>
            {RELEASE_ARTIFACT_RIGHTS.map((artifact) => (
              <tr key={`${artifact.releaseId}:${artifact.artifactPath}`}>
                <td>{artifact.releaseId}</td>
                <td>{artifact.artifactPath}</td>
                <td>{artifact.publicDistribution}</td>
                <td>{artifact.excludedSourcePayloads.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </section>

      <section id="source-licenses" className="editorial-section">
        <SectionHeader
          eyebrow="Sources"
          title="Artifact-class license summary"
          dek="Civica keeps license and freshness metadata attached to source rows and reader-facing data points where that coverage exists today."
        />

        <DataTable>
          <thead>
            <tr>
              <th>Artifact class</th>
              <th>Current permission posture</th>
              <th>Governing basis</th>
              <th>What to do</th>
            </tr>
          </thead>
          <tbody>
            {RIGHTS_ARTIFACT_CLASSES.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                <td>{row.currentPermissionPosture}</td>
                <td>{row.governingBasis}</td>
                <td>{row.readerAction}</td>
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

        {/* PUBLIC_CLAIM: licensing.access-vs-reuse */}
        <p>{ACCESS_VS_REUSE_BOUNDARY}</p>

        <ul>
          <li>
            Preserve source names, license labels, and freshness dates when you
            reuse data from a country, API, or index page.
          </li>
          <li>
            Cite Civica Atlas when reusing Civica Index, Civica Pulse, or
            reconciliation-derived outputs — citing is a request for credit, not
            a grant of reuse permission.
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
          title="Editorial images"
          dek="Civica's engravings and photographic treatments are AI-assisted editorial images, not documentary photographs or source evidence."
        />

        {/* PUBLIC_CLAIM: licensing.imagery-policy */}
        <p>
          Most country and territory mastheads use antique-style scenes of named
          landmarks or landscapes. A limited trial set uses full-color
          photographic treatments in the same editorial role. Landing-page
          engravings use broader civic and archival motifs. All are AI-assisted
          editorial images. They are not documentary photographs, source
          evidence, or claims about what a place currently looks like. Each
          surface links back to this section.
        </p>

        <SectionHeader eyebrow="Tools" title="How the imagery is made" />
        <p>
          Assets are produced with AI image-generation tooling (Codex-driven
          generation), exported as source images, then converted to release WebP
          before being committed. Existing country files use exact 3:2
          dimensions and pass the checked format, size, caption, pair, and
          color-state gate. See{" "}
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
          The{" "}
          <a
            href="https://github.com/fbalino/civica/blob/main/src/lib/illustrations/illustration-manifest.generated.json"
            target="_blank"
            rel="noopener noreferrer"
          >
            <code>civica-editorial-illustration-manifest/v1</code>
          </a>{" "}
          covers every published engraving with its route, intended subject,
          caption, light/dark partner, dimensions, hash, rights note, and QA
          state. Historical generation records remain incomplete: the launch
          sessions did not retain prompt text, reference imagery, model version,
          or seed. Assets created or replaced going forward retain that record.
          A Git capture date is not presented as a generation date.
        </p>

        <SectionHeader eyebrow="Quality" title="Review and correction" />
        <p>
          Automated checks cover inventory, hashes, exact pairing, captions,
          format, dimensions, file bounds, color policy, manifest drift, and
          raw-file release risk. Human visual review of what each engraving
          depicts and whether its caption correctly names the landmark is being
          strengthened over time; it is not yet complete or independently
          audited. If you notice a wrong landmark, an inaccurate caption, or
          anything else off about an engraving, use the{" "}
          <Link href="/contact">contact form</Link> and we will investigate and
          correct it.
        </p>

        <SectionHeader eyebrow="Rights" title="Reuse rights" />
        <p>
          Display of these editorial images on Civica Atlas is authorized by
          Civica. Civica does not currently grant a separate license for
          third-party reuse of editorial imagery outside the site; provenance
          and legal review of this imagery is pending. Contact us before reusing
          an image anywhere else.
        </p>
      </section>

      <section id="code" className="editorial-section">
        <SectionHeader
          eyebrow="Code"
          title="Repository"
          dek="Implementation details, issue tracking, and code reuse terms live with the public repository."
        />

        {/* PUBLIC_CLAIM: licensing.code-status */}
        <p>{CODE_RIGHTS.posture}</p>

        <p>
          The Civica repository is available on{" "}
          <a
            href={CODE_RIGHTS.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          . The root LICENSE and NOTICE are authoritative for code reuse and
          preserve separate contributor, dependency, generated-material, data,
          font, asset, and trademark rights.
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
