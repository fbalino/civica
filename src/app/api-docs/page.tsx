import type { Metadata } from "next";
import Link from "next/link";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import type { ReaderSidebarItem } from "@/components/editorial/ReaderSidebar";
import { Banner } from "@/components/editorial/Banner";
import { Chip } from "@/components/editorial/Pill";
import { withOg } from "@/lib/og";
import { getRouteContract, type RouteContract, type RouteParam } from "@/lib/api/contract/registry";
import { renderExample, renderCountryExportCsvExample, type ExampleId } from "@/lib/api/contract/examples";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Public API — Sovereign-State Governance Data",
  // PUBLIC_CLAIM: api.coverage-and-products
  description:
    "Documentation for the Civica public REST API: sovereign-state government structure, country metadata, Civica Index scores, and political-system classifications.",
  alternates: { canonical: "https://civicaatlas.org/api-docs" },
  openGraph: withOg({
    title: "Public API — Sovereign-State Governance Data · Civica Atlas",
    description:
      "Documentation for the Civica public REST API. Access sovereign-state government structure and governance data.",
    url: "https://civicaatlas.org/api-docs",
  }),
};

const BASE_URL = "https://civicaatlas.org/api/v1";
const SITE_URL = "https://civicaatlas.org";

const SECTIONS: ReaderSidebarItem[] = [
  { id: "overview", label: "Overview" },
  { id: "endpoints", label: "Endpoints" },
  { id: "countries", label: "List countries" },
  { id: "country-detail", label: "Country detail" },
  { id: "government-types", label: "Government types (deprecated)" },
  { id: "peer-groupings", label: "Peer groupings" },
  { id: "index-rankings", label: "Index rankings" },
  { id: "index-country", label: "Index country" },
  { id: "index-history", label: "Index country history" },
  { id: "index-by-government-type", label: "Index by government type" },
  { id: "index-compare", label: "Index compare" },
  { id: "index-methodology", label: "Index methodology version" },
  { id: "pulse-methodology", label: "Pulse runtime method" },
  { id: "pulse-dimensions", label: "Pulse dimensions" },
  { id: "pulse-events", label: "Pulse country events" },
  { id: "pulse-changelog-v2", label: "Pulse changelog" },
  { id: "usage-examples", label: "Usage examples" },
  { id: "bulk-data", label: "Bulk data" },
  { id: "data-sources", label: "Data sources" },
  { id: "widget-embed", label: "Widget embed" },
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
      <strong>{entry.identifier}</strong> (
      {entry.kind}) is deprecated, sunsetting {route.deprecation.sunsetIso}. Replaced by{" "}
      {entry.replacedBy.join(", ")} — see{" "}
      <Link href={route.deprecation.successor}>{route.deprecation.successor}</Link>.{" "}
      {conditional ? (
        <>
          Requests using <code>taxonomy=structural</code> or{" "}
          <code>taxonomy=regime</code> carry <code>Deprecation</code>/
          <code>Sunset</code>/<code>Link</code> headers. Successful JSON
          responses also include a <code>meta.deprecations</code> block with
          the same information.
        </>
      ) : (
        <>
          Every response from this endpoint carries <code>Deprecation</code>/
          <code>Sunset</code>/<code>Link</code> headers. Successful JSON
          responses also include a <code>meta.deprecations</code> block with
          the same information.
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
          This entire endpoint is deprecated, sunsetting {route.deprecation.sunsetIso}. Use{" "}
          <Link href={route.deprecation.successor}>{route.deprecation.successor}</Link> instead. Every
          response carries <code>Deprecation</code>/<code>Sunset</code>/<code>Link</code> headers.
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
        Values and totals shown below are illustrative; live responses may differ. The shape is generated
        from, and validated against, the same schema the route itself is contract-tested against — see{" "}
        <code>npm run validate:api-docs</code>.
      </p>
      <CodeBlock>{exampleResponse}</CodeBlock>
    </section>
  );
}

function docExample(exampleId: ExampleId): string {
  return renderExample(exampleId);
}

const EMBED_PARAMS = [
  {
    name: "size",
    type: "sm | md | lg | custom",
    description:
      "Widget dimensions. sm=300×80, md=320×180, lg=400×260. Use custom to build your own card with the include/w/h params below. Default: md",
  },
  {
    name: "theme",
    type: "light | dark",
    description: "Override color scheme. Default: system prefers-color-scheme",
  },
  {
    name: "dims",
    type: "0 | 1",
    description:
      "Show available Civica Index dimension mini-bars in the large widget when real dimension scores are present. Default: 0",
  },
  {
    name: "include",
    type: "comma list",
    description:
      "size=custom only. Datapoints to render, in order: ci, capital, gov, pop, gdp, area. Default when omitted: ci,capital,gov.",
  },
  {
    name: "w",
    type: "integer",
    description: "size=custom only. Widget width in px. Clamped 280–600. Default 360.",
  },
  {
    name: "h",
    type: "integer",
    description: "size=custom only. Widget height in px. Clamped 120–800. Default 320.",
  },
];

export default function ApiDocsPage() {
  const countriesRoute = getRouteContract("countries");
  const countryDetailRoute = getRouteContract("country-detail");
  const governmentTypesRoute = getRouteContract("government-types");
  const peerGroupingsRoute = getRouteContract("peer-groupings");
  const indexRankingsRoute = getRouteContract("index-rankings");
  const indexCountryRoute = getRouteContract("index-country");
  const indexHistoryRoute = getRouteContract("index-history");
  const indexByGovernmentTypeRoute = getRouteContract("index-by-government-type");
  const indexCompareRoute = getRouteContract("index-compare");
  const indexMethodologyRoute = getRouteContract("index-methodology");
  const pulseMethodologyRoute = getRouteContract("pulse-methodology");
  const pulseDimensionsRoute = getRouteContract("pulse-dimensions");
  const pulseEventsRoute = getRouteContract("pulse-events");
  const pulseChangelogRoute = getRouteContract("pulse-changelog-v2");
  const countryExportRoute = getRouteContract("country-export");

  return (
    <MethodologyLayout items={SECTIONS} contentClassName="methodology-content--wide">
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Civica</Link>
        <span>/</span>
        <span aria-current="page">API Docs</span>
      </nav>
      <section id="overview" className="editorial-section">
        <h1 className="editorial-page-title">Public API</h1>
        <div className="api-accent-rule" aria-hidden="true" />

        <p className="api-intro">
          The Civica API provides read-only access to government structure data for
          sovereign states. All <code>/api/v1/*</code> responses are JSON. The bulk
          export below also supports CSV. No authentication is required.
        </p>

        <div className="api-info-card">
          <div className="api-info-card__row">
            <h3 className="api-section-label">Base URL</h3>
            <code className="api-info-card__value">{BASE_URL}</code>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">Rate Limits</h3>
            <p className="api-info-card__body">
              Every <code>/api/v1/*</code> endpoint applies a best-effort per-IP throttle
              of {countriesRoute.rateLimit?.max} requests per {(countriesRoute.rateLimit?.windowMs ?? 0) / 1000}{" "}
              seconds (in-memory, per server instance — not a durable global counter).
              The bulk <code>/api/countries/:slug/export</code> endpoint below has its own,
              separate limit of {countryExportRoute.rateLimit?.max} requests per{" "}
              {(countryExportRoute.rateLimit?.windowMs ?? 0) / 1000} seconds. Exceeding either
              returns a 429 status with a <code>Retry-After</code> header.
            </p>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">CORS</h3>
            <p className="api-info-card__body">
              Every <code>/api/v1/*</code> endpoint supports cross-origin requests
              (<code>Access-Control-Allow-Origin: *</code>). The bulk{" "}
              <code>/api/countries/:slug/export</code> endpoint does not send CORS
              headers — it is designed for server-side/CLI pulls, not in-browser
              <code>fetch</code>.
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
        <h2>Bulk Data</h2>

        <p className="api-intro">
          Each sovereign state&rsquo;s full record is downloadable in one request
          as JSON or CSV. To assemble the sovereign-state dataset, enumerate
          countries with <code>/api/v1/countries</code> and pull each
          country&rsquo;s export. The JSON export carries a structured provenance
          block for supported headline fields when a canonical resolver row
          exists; its broader <code>facts[]</code> rows do not yet carry
          per-row source, vintage, or license fields. The CSV export carries a
          reconciliation citation header, not per-row provenance.
        </p>

        <Banner variant="info">
          This endpoint is <strong>not</strong> part of the <code>/api/v1</code> contract —
          it lives at <code>/api/countries/:slug/export</code>, has its own{" "}
          {countryExportRoute.rateLimit?.max} req/{(countryExportRoute.rateLimit?.windowMs ?? 0) / 1000}s
          rate limit, sends no CORS headers, and its JSON response has no{" "}
          <code>data</code> envelope — every field is top-level, for back-compat
          with existing consumers.
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

        <h3 className="api-example-heading">CSV export — illustrative example</h3>
        <p className="api-info-card__body">
          Values shown are illustrative. Columns and the citation comment
          header are generated by the same function the route calls — see{" "}
          <code>src/lib/api/contract/csv.ts</code>.
        </p>
        <CodeBlock>{renderCountryExportCsvExample()}</CodeBlock>

        <h3 className="api-example-heading">Full-dataset pull (bash)</h3>
        <CodeBlock>{`# 1. Enumerate every sovereign-state slug (paginate with limit/offset until meta.hasMore is false).
curl "${BASE_URL}/countries?limit=250&offset=0" | jq -r '.data[].slug' > slugs.txt

# 2. Download each country's full record. Stay under the 30/min/IP export limit.
while read slug; do
  curl -s "${SITE_URL}/api/countries/$slug/export?format=json" -o "data/$slug.json"
  sleep 2
done < slugs.txt`}</CodeBlock>

        <h3 className="api-example-heading">CSV export</h3>
        <CodeBlock>{`curl "${SITE_URL}/api/countries/france/export?format=csv" -o france-data.csv`}</CodeBlock>

        <p className="api-info-card__body">
          A single frozen, versioned dataset artifact — one download for the
          entire atlas, with a persistent identifier for citation — is a planned
          addition. Until it ships, the per-country export plus the country list
          above is the supported path for a sovereign-state pull. Treat the
          current files as incomplete provenance exports: JSON links supported
          headline fields only, while <code>facts[]</code> and CSV rows omit
          per-row source, license, and vintage. DAT-027 owns the canonical-plus-
          alternates research export that closes that gap.
        </p>
      </section>

      <hr className="api-section-divider" />

      <section id="data-sources" className="editorial-section">
        <h2>Data Sources & Licensing</h2>
        <p className="api-info-card__body">
          API data is sourced from the CIA World Factbook (public domain, archived
          January 2026), Wikidata (CC0), IPU Parline, and the Constitute Project,
          among others. Public-domain and CC0 sources are generally reusable;
          IPU Parline and Constitute Project data is subject to their respective
          non-commercial licenses. Free, no-account API access is not itself a
          reuse license — see{" "}
          <Link href="/licensing#reuse">Licensing</Link> for the current,
          source-by-source posture before redistributing API data.
        </p>
      </section>

      <hr className="api-section-divider" />

      <section id="widget-embed" className="editorial-section">
        <h2>Widget Embed</h2>
        <p className="api-intro">
          Embed a live Civica Index widget on any website using a standard{" "}
          <code>&lt;iframe&gt;</code>. Widgets update every 5 minutes and respect
          the visitor&rsquo;s system color scheme by default. Override with{" "}
          <code>?theme=light</code> or <code>?theme=dark</code>. Add{" "}
          <code>?dims=1</code> to the large widget to show available Civica
          Index dimension mini-bars when real dimension scores are present. For
          full control, use <code>?size=custom</code> with{" "}
          <code>?include=</code> to choose which datapoints render and{" "}
          <code>?w=</code>/<code>?h=</code> to set the dimensions.
        </p>

        <div className="api-embed-block">
          <p className="api-embed-size-label">Small — 300 × 80</p>
          <CodeBlock>{`<iframe src="https://civicaatlas.org/embed/brazil?size=sm"
        width="300" height="80" loading="lazy"
        title="Civica Index — Brazil"></iframe>`}</CodeBlock>
        </div>

        <div className="api-embed-block">
          <p className="api-embed-size-label">Medium — 320 × 180</p>
          <CodeBlock>{`<iframe src="https://civicaatlas.org/embed/denmark?size=md"
        width="320" height="180" loading="lazy"
        title="Civica Index — Denmark"></iframe>`}</CodeBlock>
        </div>

        <div className="api-embed-block">
          <p className="api-embed-size-label">Large — 400 × 260 (optional CI dimensions)</p>
          <CodeBlock>{`<iframe src="https://civicaatlas.org/embed/brazil?size=lg&dims=1"
        width="400" height="260" loading="lazy"
        title="Civica Index — Brazil"></iframe>`}</CodeBlock>
        </div>

        <div className="api-embed-block">
          <p className="api-embed-size-label">
            Custom — pick your datapoints and dimensions
          </p>
          <CodeBlock>{`<iframe src="https://civicaatlas.org/embed/brazil?size=custom&include=ci,capital,pop&w=360&h=320"
        width="360" height="320" loading="lazy"
        title="Civica Index — Brazil"></iframe>`}</CodeBlock>
        </div>

        <div className="api-params api-params--embed">
          <div className="api-params__header">
            <span className="api-section-label">Query Parameters</span>
          </div>
          {EMBED_PARAMS.map((param) => (
            <div key={param.name} className="api-params__row">
              <code className="api-params__name">{param.name}</code>
              <span className="api-params__type">{param.type}</span>
              <span className="api-params__desc">{param.description}</span>
            </div>
          ))}
        </div>
      </section>
    </MethodologyLayout>
  );
}
