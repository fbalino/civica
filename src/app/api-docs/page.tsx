import type { Metadata } from "next";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import type { ReaderSidebarItem } from "@/components/editorial/ReaderSidebar";

export const metadata: Metadata = {
  title: "API Documentation — Civica Public API",
  description:
    "Documentation for the Civica public REST API. Access government structure data, country metadata, and political system classifications for 250+ countries.",
  alternates: { canonical: "https://civicaatlas.org/api-docs" },
  openGraph: {
    title: "API Documentation — Civica Public API | Civica",
    description:
      "Documentation for the Civica public REST API. Access government structure data for 250+ countries.",
    url: "https://civicaatlas.org/api-docs",
  },
};

const BASE_URL = "https://civicaatlas.org/api/v1";

const SECTIONS: ReaderSidebarItem[] = [
  { id: "overview", label: "Overview" },
  { id: "endpoints", label: "Endpoints" },
  { id: "countries", label: "List countries" },
  { id: "country-detail", label: "Country detail" },
  { id: "government-types", label: "Government types" },
  { id: "peer-groupings", label: "Peer groupings" },
  { id: "peer-groupings-migration", label: "Migration table" },
  { id: "usage-examples", label: "Usage examples" },
  { id: "data-sources", label: "Data sources" },
  { id: "widget-embed", label: "Widget embed" },
];

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function CodeBlock({ children }: { children: string }) {
  return <pre className="api-code-block">{children}</pre>;
}

function EndpointSection({
  id,
  method,
  path,
  description,
  parameters,
  exampleResponse,
}: {
  id: string;
  method: HttpMethod;
  path: string;
  description: string;
  parameters?: { name: string; type: string; description: string }[];
  exampleResponse: string;
}) {
  const methodModifier = `api-method-badge--${method.toLowerCase()}`;
  return (
    <section className="api-endpoint" id={id}>
      <div className="api-endpoint-head">
        <span className={`api-method-badge ${methodModifier}`}>{method}</span>
        <code className="api-endpoint-path">{path}</code>
      </div>

      <p className="api-endpoint-desc">{description}</p>

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

      <h4 className="api-section-label">Example Response</h4>
      <CodeBlock>{exampleResponse}</CodeBlock>
    </section>
  );
}

const EMBED_PARAMS = [
  { name: "size", type: "sm | md | lg", description: "Widget dimensions. Default: md" },
  {
    name: "theme",
    type: "light | dark",
    description: "Override color scheme. Default: system prefers-color-scheme",
  },
  {
    name: "dims",
    type: "0 | 1",
    description: "Show 6 dimension mini-bars in large widget. Default: 0",
  },
];

export default function ApiDocsPage() {
  return (
    <MethodologyLayout items={SECTIONS} contentClassName="methodology-content--wide">
      <section id="overview" className="editorial-section">
        <h1 className="editorial-page-title">Public API</h1>
        <div className="api-accent-rule" aria-hidden="true" />

        <p className="api-intro">
          The Civica API provides read-only access to government structure data for
          250+ countries. All responses are JSON. No authentication is required.
        </p>

        <div className="api-info-card">
          <div className="api-info-card__row">
            <h3 className="api-section-label">Base URL</h3>
            <code className="api-info-card__value">{BASE_URL}</code>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">Rate Limits</h3>
            <p className="api-info-card__body">
              60 requests per minute per IP address. Exceeding the limit returns a
              429 status with a Retry-After header.
            </p>
          </div>
          <div className="api-info-card__row">
            <h3 className="api-section-label">CORS</h3>
            <p className="api-info-card__body">
              All endpoints support cross-origin requests. The API sets{" "}
              <code>Access-Control-Allow-Origin: *</code>.
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
          method="GET"
          path="/api/v1/countries"
          description="Returns a paginated list of sovereign states with basic metadata. Filter by continent or peer-lens taxonomy. The legacy ?taxonomy=structural and ?taxonomy=regime filters remain functional through 2027-03-31; new code should pass the typed peer-lens values (region | income | vdem | cgv | monarchy)."
          parameters={[
            {
              name: "continent",
              type: "string",
              description: 'Filter by continent (e.g. "Africa", "Europe")',
            },
            {
              name: "taxonomy",
              type: "string",
              description:
                "Filter lens. Accepts: raw | region | income | vdem | cgv | monarchy | structural (DEPRECATED) | regime (DEPRECATED). When non-raw, pair with `government_type` to filter by lens value.",
            },
            {
              name: "government_type",
              type: "string",
              description:
                'Lens value. With taxonomy=region: "Sub-Saharan Africa". With taxonomy=vdem: "Liberal Democracy". With taxonomy=raw: partial match against the CIA prose. See /api/v1/peer-groupings for the full list of valid values per lens.',
            },
            {
              name: "limit",
              type: "integer",
              description: "Results per page (default 50, max 250)",
            },
            {
              name: "offset",
              type: "integer",
              description: "Number of results to skip (default 0)",
            },
          ]}
          exampleResponse={`{
  "data": [
    {
      "slug": "united-states",
      "name": "United States",
      "iso2": "US",
      "iso3": "USA",
      "continent": "North America",
      "capital": "Washington, DC",
      "population": 339996563,
      "governmentType": "presidential republic",
      "governmentTypeDetail": "constitutional federal republic",
      "governmentClassification": {
        "rawLabel": "constitutional federal republic",
        "regimeType": "presidential_democracy",
        "regimeSource": "Bjornskov-Rode / CGV (QoG Standard)",
        "regimeYear": 2025,
        "structuralFamily": "presidential_republic (DEPRECATED — sunset T+2 vintages)",
        "structuralSubtype": "federal_presidential_republic (DEPRECATED — sunset T+2 vintages)",
        "primitives": {
          "isFederal": true,
          "isMonarchy": false,
          "executiveStructure": "single_executive",
          "governmentDependency": "fixed_term"
        }
      },
      "gdpBillions": 25.46,
      "areaSqKm": 9833520,
      "flagUrl": "..."
    }
  ],
  "meta": {
    "total": 195,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}`}
        />

        <EndpointSection
          id="country-detail"
          method="GET"
          path="/api/v1/countries/:code"
          description="Returns detailed government structure for a single country. Look up by slug, ISO 3166-1 alpha-2, or alpha-3 code."
          parameters={[
            {
              name: ":code",
              type: "string",
              description:
                'Country slug, ISO-2, or ISO-3 code (e.g. "us", "USA", "united-states")',
            },
          ]}
          exampleResponse={`{
  "data": {
    "slug": "france",
    "name": "France",
    "iso2": "FR",
    "iso3": "FRA",
    "continent": "Europe",
    "capital": "Paris",
    "population": 68170228,
    "governmentType": "semi-presidential republic",
    "governmentTypeDetail": "...",
    "governmentClassification": {
      "rawLabel": "semi-presidential republic",
      "regimeType": "semi_presidential_democracy",
      "regimeSource": "Bjornskov-Rode / CGV (QoG Standard)",
      "regimeYear": 2025,
      "structuralFamily": "semi_presidential (DEPRECATED — sunset T+2 vintages)",
      "structuralSubtype": "semi_presidential_republic (DEPRECATED — sunset T+2 vintages)",
      "primitives": {
        "isFederal": false,
        "isMonarchy": false,
        "executiveStructure": "dual_executive",
        "governmentDependency": "mixed_dependency"
      }
    },
    "gdpBillions": 2.78,
    "areaSqKm": 643801,
    "languages": "French",
    "currency": "Euro (EUR)",
    "democracyIndex": 7.99,
    "flagUrl": "...",
    "constitution": { "year": 1958, "yearUpdated": 2008 },
    "government": {
      "executive": [
        {
          "name": "Presidency of France",
          "type": "head_of_state",
          "offices": [
            {
              "name": "President",
              "type": "head_of_state",
              "currentHolder": {
                "name": "Emmanuel Macron",
                "party": "Renaissance",
                "since": "2017-05-14",
                "photoUrl": "..."
              }
            }
          ]
        }
      ],
      "legislative": [...]
    }
  }
}`}
        />

        <EndpointSection
          id="government-types"
          method="GET"
          path="/api/v1/government-types"
          description="DEPRECATED — sunsets 2027-03-31. Returns government types under the retired structural_family heuristic. Successor: /api/v1/peer-groupings (single endpoint returning all four peer-grouping lenses)."
          exampleResponse={`{
  "data": [
    {
      "governmentType": "presidential republic",
      "count": 42,
      "topExamples": ["United States", "Brazil", "Indonesia", "Nigeria", "Mexico"]
    }
  ],
  "meta": {
    "total": 12,
    "deprecations": [
      {
        "identifier": "structural_family",
        "kind": "field+filter",
        "sunset": "2027-03-31",
        "successor": "/api/v1/peer-groupings",
        "replacedBy": [
          "world_bank_region",
          "world_bank_income_group",
          "vdem_row",
          "monarchy_status",
          "government_form_description"
        ],
        "migrationTable": "/civica-index/methodology/peer-grouping/migration"
      }
    ]
  }
}`}
        />

        <EndpointSection
          id="peer-groupings"
          method="GET"
          path="/api/v1/peer-groupings"
          description="Civica's peer-grouping successor endpoint. Returns the four peer-grouping lenses (World Bank region, World Bank income group, V-Dem RoW, BR/CGV regime) plus monarchy_status as descriptive metadata, in a single response. See https://civicaatlas.org/civica-index/methodology/peer-grouping for the underlying methodology."
          exampleResponse={`{
  "data": {
    "world_bank_region": {
      "factKey": "world_bank_region",
      "filterParam": "region",
      "source": "world_bank",
      "sourceName": "World Bank",
      "description": "World Bank Country and Lending Groups regional classification (7 regions). Default material peer lens — pair with world_bank_income_group for the canonical material cohort. Refreshed annually each July.",
      "values": [
        { "value": "East Asia & Pacific", "label": "East Asia & Pacific", "totalCountries": 29, "scoredCountries": 29 },
        { "value": "Europe & Central Asia", "label": "Europe & Central Asia", "totalCountries": 52, "scoredCountries": 52 }
      ]
    },
    "vdem_row": {
      "factKey": "vdem_row",
      "filterParam": "vdem",
      "source": "vdem",
      "sourceName": "V-Dem",
      "values": [
        { "value": "Liberal Democracy", "label": "Liberal Democracy", "totalCountries": 33, "scoredCountries": 33 }
      ]
    }
  },
  "meta": {
    "peerGrouping": {
      "status": "stable",
      "version": "v1.0",
      "adopted": "2026-05-02",
      "methodology": "https://civicaatlas.org/civica-index/methodology/peer-grouping",
      "migrationTable": "/civica-index/methodology/peer-grouping/migration",
      "replaces": "structural_family (sunset 2027-03-31)"
    }
  }
}`}
        />

        <EndpointSection
          id="peer-groupings-migration"
          method="GET"
          path="/api/v1/peer-groupings/migration"
          description="Per-country migration table — bulk-rewrite source for replication scripts that join on the retired structural_family column. Returns one row per sovereign state with both the deprecated values and their peer-lens replacements. Same data the reader-facing /civica-index/methodology/peer-grouping/migration page renders."
          exampleResponse={`{
  "data": [
    {
      "slug": "united-states",
      "name": "United States",
      "iso2": "US",
      "iso3": "USA",
      "structuralFamily": "presidential_republic",
      "structuralSubtype": "federal_presidential_republic",
      "worldBankRegion": "North America",
      "worldBankIncomeGroup": "High income",
      "vdemRow": "Liberal Democracy",
      "cgvRegime": "presidential_democracy",
      "monarchyStatus": "none",
      "governmentFormDescription": "constitutional federal republic"
    }
  ],
  "meta": {
    "total": 195,
    "schema": {
      "deprecated": ["structuralFamily", "structuralSubtype"],
      "replacement": [
        "worldBankRegion",
        "worldBankIncomeGroup",
        "vdemRow",
        "cgvRegime",
        "monarchyStatus",
        "governmentFormDescription"
      ]
    }
  }
}`}
        />
      </section>

      <hr className="api-section-divider" />

      <section id="usage-examples" className="editorial-section">
        <h2>Usage Examples</h2>

        <h3 className="api-example-heading">curl</h3>
        <CodeBlock>{`curl "${BASE_URL}/countries?continent=Europe&limit=10"
curl "${BASE_URL}/countries/us"
curl "${BASE_URL}/peer-groupings"            # successor (preferred)
curl "${BASE_URL}/peer-groupings/migration"  # per-country migration
curl "${BASE_URL}/government-types"          # DEPRECATED — sunsets 2027-03-31`}</CodeBlock>

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

      <section id="data-sources" className="editorial-section">
        <h2>Data Sources & Licensing</h2>
        <p className="api-info-card__body">
          API data is sourced from the CIA World Factbook (public domain, archived
          January 2026), Wikidata (CC0), IPU Parline, and the Constitute Project.
          All public-domain and CC0 data is freely available for any use. Data from
          IPU Parline and Constitute Project is subject to their respective
          non-commercial licenses.
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
          <code>?dims=1</code> to the large widget to show dimension mini-bars.
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
          <p className="api-embed-size-label">Large — 400 × 260 (with dimensions)</p>
          <CodeBlock>{`<iframe src="https://civicaatlas.org/embed/brazil?size=lg&dims=1"
        width="400" height="260" loading="lazy"
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
