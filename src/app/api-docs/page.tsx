import type { Metadata } from "next";
import Link from "next/link";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import type { ReaderSidebarItem } from "@/components/editorial/ReaderSidebar";
import { Banner } from "@/components/editorial/Banner";
import { Chip } from "@/components/editorial/Pill";
import { withOg } from "@/lib/og";
import {
  getRouteContract,
  type RouteContract,
  type RouteParam,
} from "@/lib/api/contract/registry";
import {
  renderExample,
  renderCountryExportCsvExample,
  type ExampleId,
} from "@/lib/api/contract/examples";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Public API — Sovereign-State Governance Data",
  // PUBLIC_CLAIM: api.coverage-and-products
  description:
    "Documentation for the Civica public REST API: sovereign-state government structure, country metadata, source provenance, and political-system classifications.",
  alternates: { canonical: "https://civicaatlas.org/api-docs" },
  openGraph: withOg({
    title: "Public API — Sovereign-State Governance Data · Civica Atlas",
    description:
      "Documentation for the Civica public REST API. Access sovereign-state government structure and governance data.",
    url: "https://civicaatlas.org/api-docs",
  }),
};

const BASE_URL = "https://civicaatlas.org/api/v1";

const SECTIONS: ReaderSidebarItem[] = [
  { id: "overview", label: "Overview" },
  { id: "endpoints", label: "Endpoints" },
  { id: "countries", label: "List countries" },
  { id: "country-detail", label: "Country detail" },
  { id: "elections", label: "Election research export" },
  { id: "government-types", label: "Government types (deprecated)" },
  { id: "peer-groupings", label: "Peer groupings" },
  { id: "index-rankings", label: "Index rankings" },
  { id: "index-country", label: "Index country" },
  { id: "index-history", label: "Index country history" },
  { id: "index-by-government-type", label: "Index by government type" },
  { id: "index-compare", label: "Index compare" },
  { id: "index-methodology", label: "Index methodology version" },
  { id: "pulse-methodology", label: "Pulse runtime method" },
  { id: "pulse-cluster-coverage", label: "Pulse cluster coverage" },
  { id: "pulse-source-coverage", label: "Pulse source coverage" },
  { id: "pulse-dimensions", label: "Pulse dimensions" },
  { id: "pulse-events", label: "Pulse country events" },
  { id: "pulse-changelog-v2", label: "Pulse changelog" },
  { id: "usage-examples", label: "Usage examples" },
  { id: "bulk-data", label: "Bulk data" },
  { id: "data-sources", label: "Data sources" },
  { id: "widget-embed", label: "Retired widget embed" },
];

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function CodeBlock({ children }: { children: string }) {
  return <pre className="api-code-block">{children}</pre>;
}

/** Every endpoint's parameter table renders from `RouteContract.params`
 *  (contract/registry.ts) rather than a hand-typed array, so a param a
 *  handler actually reads can't silently go undocumented — see
 *  scripts/validate-api-docs.ts's param-drift check. */
function toDocParams(params: RouteParam[]) {
  return params.map((p) => ({
    name: p.name,
    type: p.type,
    description: p.description,
  }));
}

function DeprecationNote({ route }: { route: RouteContract }) {
  if (!route.deprecation || route.deprecation.wholeRoute) return null;
  const entry = route.deprecation.meta.deprecations[0];
  const conditional =
    route.deprecation.appliesWhen === "taxonomy-structural-regime";
  return (
    <Banner variant="warn">
      <strong>{entry.identifier}</strong> ({entry.kind}) is deprecated,
      sunsetting {route.deprecation.sunsetIso}. Replaced by{" "}
      {entry.replacedBy.join(", ")} — see{" "}
      <Link href={route.deprecation.successor}>
        {route.deprecation.successor}
      </Link>
      .{" "}
      {conditional ? (
        <>
          Requests using <code>taxonomy=structural</code> or{" "}
          <code>taxonomy=regime</code> carry <code>Deprecation</code>/
          <code>Sunset</code>/<code>Link</code> headers. Successful JSON
          responses also include a <code>meta.deprecations</code> block with the
          same information.
        </>
      ) : (
        <>
          Every response from this endpoint carries <code>Deprecation</code>/
          <code>Sunset</code>/<code>Link</code> headers. Successful JSON
          responses also include a <code>meta.deprecations</code> block with the
          same information.
        </>
      )}
    </Banner>
  );
}

function EndpointSection({
  id,
  routeId,
  method,
  path,
  description,
  parameters,
  exampleResponse,
  deprecatedBanner,
}: {
  id: string;
  routeId: string;
  method: HttpMethod;
  path: string;
  description: string;
  parameters?: { name: string; type: string; description: string }[];
  exampleResponse: string;
  deprecatedBanner?: boolean;
}) {
  const route = getRouteContract(routeId);
  const methodModifier = `api-method-badge--${method.toLowerCase()}`;
  return (
    <section className="api-endpoint" id={id}>
      <div className="api-endpoint-head">
        <span className={`api-method-badge ${methodModifier}`}>{method}</span>
        <code className="api-endpoint-path">{path}</code>
        {deprecatedBanner && <Chip variant="warn">Deprecated</Chip>}
      </div>

      <p className="api-endpoint-desc">{description}</p>

      {deprecatedBanner && route.deprecation && (
        <Banner variant="warn">
          This entire endpoint is deprecated, sunsetting{" "}
          {route.deprecation.sunsetIso}. Use{" "}
          <Link href={route.deprecation.successor}>
            {route.deprecation.successor}
          </Link>{" "}
          instead. Every response carries <code>Deprecation</code>/
          <code>Sunset</code>/<code>Link</code> headers.
        </Banner>
      )}
      <DeprecationNote route={route} />

      {parameters && parameters.length > 0 && (
        <>
          <h4 className="api-section-label">Parameters</h4>
          <div className="api-params">
            {parameters.map((param) => (
              <div key={param.name} className="api-params__row">
                <code className="api-params__name">{param.name}</code>
                <span className="api-params__type">{param.type}</span>
                <span className="api-params__desc">{param.description}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h4 className="api-section-label">Illustrative Example Response</h4>
      <p className="api-info-card__body">
        Values and totals shown below are illustrative; live responses may
        differ. The shape is generated from, and validated against, the same
        schema the route itself is contract-tested against — see{" "}
        <code>npm run validate:api-docs</code>.
      </p>
      <CodeBlock>{exampleResponse}</CodeBlock>
    </section>
  );
}

function docExample(exampleId: ExampleId): string {
  return renderExample(exampleId);
}

export default function ApiDocsPage() {
  const countriesRoute = getRouteContract("countries");
  const countryDetailRoute = getRouteContract("country-detail");
  const electionsRoute = getRouteContract("elections");
  const governmentTypesRoute = getRouteContract("government-types");
  const peerGroupingsRoute = getRouteContract("peer-groupings");
  const indexRankingsRoute = getRouteContract("index-rankings");
  const indexCountryRoute = getRouteContract("index-country");
  const indexHistoryRoute = getRouteContract("index-history");
  const indexByGovernmentTypeRoute = getRouteContract(
    "index-by-government-type",
  );
  const indexCompareRoute = getRouteContract("index-compare");
  const indexMethodologyRoute = getRouteContract("index-methodology");
  const pulseMethodologyRoute = getRouteContract("pulse-methodology");
  const pulseClusterCoverageRoute = getRouteContract("pulse-cluster-coverage");
  const pulseSourceCoverageRoute = getRouteContract("pulse-source-coverage");
  const pulseDimensionsRoute = getRouteContract("pulse-dimensions");
  const pulseEventsRoute = getRouteContract("pulse-events");
  const pulseChangelogRoute = getRouteContract("pulse-changelog-v2");
  const countryExportRoute = getRouteContract("country-export");

  return (
    <MethodologyLayout
      items={SECTIONS}
      contentClassName="methodology-content--wide"
    >
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Civica</Link>
        <span>/</span>
        <span aria-current="page">API Docs</span>
      </nav>
      <section id="overview" className="editorial-section">
        <h1 className="editorial-page-title">Public API</h1>
        <div className="api-accent-rule" aria-hidden="true" />

        <p className="api-intro">
          The Civica API provides read-only access to government structure data
          for sovereign states. All <code>/api/v1/*</code> responses are JSON.
          No authentication is required. A frozen, rights-filtered Atlas
          reference package is available below. The former mixed-source
          per-country download remains withheld.
        </p>

        <div className="api-info-card">
          <div className="api-info-card__row">
            <h3 className="api-section-label">Base URL</h3>
            <code className="api-info-card__value">{BASE_URL}</code>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">Rate Limits</h3>
            <p className="api-info-card__body">
              Every <code>/api/v1/*</code> endpoint applies a best-effort per-IP
              throttle of {countriesRoute.rateLimit?.max} requests per{" "}
              {(countriesRoute.rateLimit?.windowMs ?? 0) / 1000} seconds
              (in-memory, per server instance — not a durable global counter).
              The withheld <code>/api/countries/:slug/export</code> route
              returns 503 and does not consume the ordinary API allowance.
              Exceeding a live endpoint&rsquo;s limit returns 429 with a{" "}
              <code>Retry-After</code>
              header.
            </p>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">CORS</h3>
            <p className="api-info-card__body">
              Every <code>/api/v1/*</code> endpoint supports cross-origin
              requests (<code>Access-Control-Allow-Origin: *</code>). The bulk{" "}
              <code>/api/countries/:slug/export</code> endpoint does not send
              CORS headers. It currently returns only a rights-blocked status
              response.
            </p>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">API Status</h3>
            <a
              href="https://statuspage.incident.io/civica-atlas"
              target="_blank"
              rel="noopener noreferrer"
              className="api-info-card__link"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Check current API status on our status page ↗
            </a>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">Value availability</h3>
            <p className="api-info-card__body">
              Country-detail facts include a matching <code>valueStatus</code>
              entry. Its closed states are <code>observed</code>,{" "}
              <code>missing</code>, <code>unknown</code>,{" "}
              <code>not_applicable</code>, <code>not_observed</code>,{" "}
              <code>disputed</code>, and <code>withheld</code>. A zero remains
              an observed number; null never stands in for zero. Non-observed
              states include a reason.
            </p>
          </div>
        </div>
      </section>

      <hr className="api-section-divider" />

      <section id="endpoints" className="editorial-section">
        <h2>Endpoints</h2>

        <EndpointSection
          id="countries"
          routeId="countries"
          method="GET"
          path={countriesRoute.pathTemplate}
          description={countriesRoute.summary}
          parameters={toDocParams(countriesRoute.params)}
          exampleResponse={docExample("countries")}
        />

        <EndpointSection
          id="country-detail"
          routeId="country-detail"
          method="GET"
          path={countryDetailRoute.pathTemplate}
          description={countryDetailRoute.summary}
          parameters={toDocParams(countryDetailRoute.params)}
          exampleResponse={docExample("countryDetail")}
        />

        <EndpointSection
          id="elections"
          routeId="elections"
          method="GET"
          path={electionsRoute.pathTemplate}
          description={electionsRoute.summary}
          parameters={toDocParams(electionsRoute.params)}
          exampleResponse={docExample("elections")}
        />

        <EndpointSection
          id="government-types"
          routeId="government-types"
          method="GET"
          path={governmentTypesRoute.pathTemplate}
          description={governmentTypesRoute.summary}
          parameters={toDocParams(governmentTypesRoute.params)}
          exampleResponse={docExample("governmentTypes")}
          deprecatedBanner
        />

        <EndpointSection
          id="peer-groupings"
          routeId="peer-groupings"
          method="GET"
          path={peerGroupingsRoute.pathTemplate}
          description={`${peerGroupingsRoute.summary} See https://civicaatlas.org/civica-index/methodology/peer-grouping for the methodology.`}
          parameters={toDocParams(peerGroupingsRoute.params)}
          exampleResponse={docExample("peerGroupings")}
        />

        <EndpointSection
          id="index-rankings"
          routeId="index-rankings"
          method="GET"
          path={indexRankingsRoute.pathTemplate}
          description={indexRankingsRoute.summary}
          parameters={toDocParams(indexRankingsRoute.params)}
          exampleResponse={docExample("indexRankings")}
        />

        <EndpointSection
          id="index-country"
          routeId="index-country"
          method="GET"
          path={indexCountryRoute.pathTemplate}
          description={indexCountryRoute.summary}
          parameters={toDocParams(indexCountryRoute.params)}
          exampleResponse={docExample("indexCountry")}
        />

        <EndpointSection
          id="index-history"
          routeId="index-history"
          method="GET"
          path={indexHistoryRoute.pathTemplate}
          description={indexHistoryRoute.summary}
          parameters={toDocParams(indexHistoryRoute.params)}
          exampleResponse={docExample("indexHistory")}
        />

        <EndpointSection
          id="index-by-government-type"
          routeId="index-by-government-type"
          method="GET"
          path={indexByGovernmentTypeRoute.pathTemplate}
          description={indexByGovernmentTypeRoute.summary}
          parameters={toDocParams(indexByGovernmentTypeRoute.params)}
          exampleResponse={docExample("indexByGovernmentType")}
        />

        <EndpointSection
          id="index-compare"
          routeId="index-compare"
          method="GET"
          path={indexCompareRoute.pathTemplate}
          description={indexCompareRoute.summary}
          parameters={toDocParams(indexCompareRoute.params)}
          exampleResponse={docExample("indexCompare")}
        />

        <EndpointSection
          id="index-methodology"
          routeId="index-methodology"
          method="GET"
          path={indexMethodologyRoute.pathTemplate}
          description={indexMethodologyRoute.summary}
          parameters={toDocParams(indexMethodologyRoute.params)}
          exampleResponse={docExample("indexMethodology")}
        />

        <EndpointSection
          id="pulse-methodology"
          routeId="pulse-methodology"
          method="GET"
          path={pulseMethodologyRoute.pathTemplate}
          description={pulseMethodologyRoute.summary}
          parameters={toDocParams(pulseMethodologyRoute.params)}
          exampleResponse={docExample("pulseMethodology")}
        />

        <EndpointSection
          id="pulse-cluster-coverage"
          routeId="pulse-cluster-coverage"
          method="GET"
          path={pulseClusterCoverageRoute.pathTemplate}
          description={pulseClusterCoverageRoute.summary}
          parameters={toDocParams(pulseClusterCoverageRoute.params)}
          exampleResponse={docExample("pulseClusterCoverage")}
        />

        <EndpointSection
          id="pulse-source-coverage"
          routeId="pulse-source-coverage"
          method="GET"
          path={pulseSourceCoverageRoute.pathTemplate}
          description={pulseSourceCoverageRoute.summary}
          parameters={toDocParams(pulseSourceCoverageRoute.params)}
          exampleResponse={docExample("pulseSourceCoverage")}
        />

        <EndpointSection
          id="pulse-dimensions"
          routeId="pulse-dimensions"
          method="GET"
          path={pulseDimensionsRoute.pathTemplate}
          description={pulseDimensionsRoute.summary}
          parameters={toDocParams(pulseDimensionsRoute.params)}
          exampleResponse={docExample("pulseDimensions")}
        />

        <EndpointSection
          id="pulse-events"
          routeId="pulse-events"
          method="GET"
          path={pulseEventsRoute.pathTemplate}
          description={pulseEventsRoute.summary}
          parameters={toDocParams(pulseEventsRoute.params)}
          exampleResponse={docExample("pulseEvents")}
        />

        <EndpointSection
          id="pulse-changelog-v2"
          routeId="pulse-changelog-v2"
          method="GET"
          path={pulseChangelogRoute.pathTemplate}
          description={pulseChangelogRoute.summary}
          parameters={toDocParams(pulseChangelogRoute.params)}
          exampleResponse={docExample("pulseChangelog")}
        />
      </section>

      <hr className="api-section-divider" />

      <section id="usage-examples" className="editorial-section">
        <h2>Usage Examples</h2>

        <h3 className="api-example-heading">curl</h3>
        <CodeBlock>{`curl "${BASE_URL}/countries?continent=Europe&limit=10"
curl "${BASE_URL}/countries/us"
curl "${BASE_URL}/peer-groupings"            # peer-lens metadata`}</CodeBlock>

        <h3 className="api-example-heading">JavaScript (fetch)</h3>
        <CodeBlock>{`const res = await fetch("${BASE_URL}/countries/fr");
const { data } = await res.json();
console.log(data.government.executive);`}</CodeBlock>

        <h3 className="api-example-heading">Python (requests)</h3>
        <CodeBlock>{`import requests

resp = requests.get("${BASE_URL}/countries", params={"government_type": "monarchy"})
for country in resp.json()["data"]:
    print(country["name"], country["population"])`}</CodeBlock>
      </section>

      <hr className="api-section-divider" />

      <section id="bulk-data" className="editorial-section">
        {/* PUBLIC_CLAIM: export.atlas-release */}
        <h2>Bulk Data</h2>

        <p className="api-intro">
          The frozen <code>atlas-2026-07-11</code> package provides stable
          jurisdiction records and canonical facts from the immutable Q1
          snapshot, limited to CIA Factbook, Wikidata, and World Bank. Every
          fact carries its vintage label, cutoff, content hash, method, and an
          embedded source-rights row. Index, Pulse, alternates, restricted
          sources, images, constitution text, and raw publisher payloads are
          excluded.
        </p>

        <p>
          <a
            className="btn btn--primary"
            href="/downloads/civica-atlas-2026-07-11.json.gz"
            download
          >
            Download Atlas JSON (gzip) →
          </a>
        </p>

        <p className="api-info-card__body">
          Schema <code>civica-atlas-export/v3</code> · release date{" "}
          <code>2026-07-11</code> · SHA-256{" "}
          <code>
            60556198b2ee3805f93558db47b1e5620c4f8f5cf372d6f83ebb6265fdcfa9fc
          </code>
          . The package contains its codebook, join keys, deterministic
          ordering, table counts, and source-specific terms. Its{" "}
          <a href="/downloads/civica-atlas-2026-07-11.manifest.json">
            release bill of materials
          </a>{" "}
          records file hashes and sizes, source vintages and semantic hashes,
          schema contracts, the export source commit, and tool versions.
        </p>

        <p className="api-intro">
          Per-country JSON and CSV downloads contain one resolver-selected
          canonical observation for each exported fact key. Alternate
          measurements, projections, and rejected rows are separate records.
        </p>

        <h3 className="api-example-heading">
          Longitudinal indicator observations
        </h3>
        <p className="api-info-card__body">
          <code>/api/countries/:slug/indicator-history?format=json|csv</code>{" "}
          returns source-native country-year observations with units, captured
          release lineage, value states, source terms, and a withheld-series
          manifest. Add <code>&amp;indicator=rl.est</code> to request one
          indicator. Observation rows are emitted only when the checked
          source-rights record permits public export; visible series with
          pending terms keep their values out of the download.
        </p>

        <Banner variant="info">
          Every observation carries its source URL, license, dates, value type,
          lifecycle status, method, selection trace, and dispute state. Rows
          without verified public-export terms are omitted. If the selected
          canonical source is restricted, the fact is withheld instead of
          assigning a different source as canonical.
        </Banner>

        <EndpointSection
          id="country-export"
          routeId="country-export"
          method="GET"
          path={countryExportRoute.pathTemplate}
          description={countryExportRoute.summary}
          parameters={toDocParams(countryExportRoute.params)}
          exampleResponse={docExample("countryExport")}
        />

        <h3 className="api-example-heading">CSV header and sample row</h3>
        <CodeBlock>{renderCountryExportCsvExample()}</CodeBlock>

        <p className="api-info-card__body">
          JSON and CSV use the same observation rows. The CSV
          <code> record_class </code> column distinguishes canonical, alternate,
          projection, and rejected evidence.
        </p>
      </section>

      <hr className="api-section-divider" />

      <section id="data-sources" className="editorial-section">
        <h2>Data Sources & Licensing</h2>
        <p className="api-info-card__body">
          API data is sourced from the CIA World Factbook (public domain,
          archived January 2026), Wikidata (CC0), IPU Parline, and the
          Constitute Project, among others. Public-domain and CC0 sources are
          generally reusable; IPU Parline and Constitute Project data is subject
          to their respective non-commercial licenses. Free, no-account API
          access is not itself a reuse license — see{" "}
          <Link href="/licensing#reuse">Licensing</Link> for the current,
          source-by-source posture before redistributing API data.
        </p>
      </section>

      <hr className="api-section-divider" />

      <section id="widget-embed" className="editorial-section">
        <h2>Retired Widget Embed</h2>
        <p className="api-intro">
          The legacy <code>/embed/:slug</code> widget is retired. Every request,
          including requests with <code>include=ci</code> or{" "}
          <code>include=cp</code>, returns <code>410 Gone</code> and is never
          cached. Existing iframes show a short retirement notice with a link to
          the <Link href="/governance-evidence">Governance Evidence</Link>{" "}
          successor. Civica does not provide a replacement scalar Pulse score,
          rank, or live score widget. Named experimental Pulse deltas remain
          available by country from{" "}
          <code>/api/v1/pulse/:country_slug/dimensions</code>.
        </p>
      </section>
    </MethodologyLayout>
  );
}
