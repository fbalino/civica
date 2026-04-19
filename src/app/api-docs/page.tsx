import type { Metadata } from "next";

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

const mono = {
  fontFamily: "var(--font-mono)",
  fontWeight: "var(--font-weight-mono)" as const,
};

const bodyText = {
  ...mono,
  fontSize: "var(--text-12)",
  color: "var(--color-text-50)",
  lineHeight: "var(--leading-relaxed)",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        ...mono,
        fontSize: "var(--text-11)",
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-divider)",
        borderRadius: 6,
        padding: "16px 20px",
        overflowX: "auto",
        color: "var(--color-text-60)",
        lineHeight: 1.6,
      }}
    >
      {children}
    </pre>
  );
}

function EndpointSection({
  method,
  path,
  description,
  parameters,
  exampleResponse,
}: {
  method: string;
  path: string;
  description: string;
  parameters?: { name: string; type: string; description: string }[];
  exampleResponse: string;
}) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span
          style={{
            ...mono,
            fontSize: "var(--text-10)",
            color: "var(--color-badge-text)",
            background: method === "GET" ? "var(--color-badge-get)" : "var(--color-badge-post)",
            padding: "2px 8px",
            borderRadius: 4,
            letterSpacing: "var(--tracking-caps)",
          }}
        >
          {method}
        </span>
        <code
          style={{
            ...mono,
            fontSize: "var(--text-14)",
            color: "var(--color-text-primary)",
          }}
        >
          {path}
        </code>
      </div>

      <p style={{ ...bodyText, marginBottom: 16 }}>{description}</p>

      {parameters && parameters.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4
            style={{
              ...mono,
              fontSize: "var(--text-10)",
              color: "var(--color-text-30)",
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Parameters
          </h4>
          <div
            style={{
              border: "1px solid var(--color-divider)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {parameters.map((param, i) => (
              <div
                key={param.name}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "8px 16px",
                  borderTop: i > 0 ? "1px solid var(--color-divider)" : undefined,
                  alignItems: "baseline",
                }}
              >
                <code
                  style={{
                    ...mono,
                    fontSize: "var(--text-11)",
                    color: "var(--color-text-primary)",
                    minWidth: 140,
                  }}
                >
                  {param.name}
                </code>
                <span
                  style={{
                    ...mono,
                    fontSize: "var(--text-10)",
                    color: "var(--color-text-30)",
                    minWidth: 60,
                  }}
                >
                  {param.type}
                </span>
                <span
                  style={{
                    ...mono,
                    fontSize: "var(--text-11)",
                    color: "var(--color-text-50)",
                  }}
                >
                  {param.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h4
        style={{
          ...mono,
          fontSize: "var(--text-10)",
          color: "var(--color-text-30)",
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Example Response
      </h4>
      <CodeBlock>{exampleResponse}</CodeBlock>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <h1 className="page-heading" style={{ marginBottom: 24 }}>
        Public API
      </h1>

      <div
        style={{
          width: 40,
          height: 2,
          background: "var(--color-accent)",
          borderRadius: 1,
          marginBottom: 32,
        }}
      />

      <p style={{ ...bodyText, fontSize: "var(--text-13)", marginBottom: 16 }}>
        The Civica API provides read-only access to government structure data for
        250+ countries. All responses are JSON. No authentication is required.
      </p>

      <div className="cv-card" style={{ marginBottom: 40 }}>
        <h3
          style={{
            ...mono,
            fontSize: "var(--text-10)",
            color: "var(--color-text-30)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Base URL
        </h3>
        <code
          style={{
            ...mono,
            fontSize: "var(--text-13)",
            color: "var(--color-text-primary)",
          }}
        >
          {BASE_URL}
        </code>

        <div style={{ marginTop: 16 }}>
          <h3
            style={{
              ...mono,
              fontSize: "var(--text-10)",
              color: "var(--color-text-30)",
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Rate Limits
          </h3>
          <p style={{ ...bodyText }}>
            60 requests per minute per IP address. Exceeding the limit returns a
            429 status with a Retry-After header.
          </p>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3
            style={{
              ...mono,
              fontSize: "var(--text-10)",
              color: "var(--color-text-30)",
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            CORS
          </h3>
          <p style={{ ...bodyText }}>
            All endpoints support cross-origin requests. The API sets{" "}
            <code style={mono}>Access-Control-Allow-Origin: *</code>.
          </p>
        </div>

        <div style={{ marginTop: 16 }}>
          <h3
            style={{
              ...mono,
              fontSize: "var(--text-10)",
              color: "var(--color-text-30)",
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            API Status
          </h3>
          <a
            href="https://statuspage.incident.io/civica-atlas"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...mono,
              fontSize: "var(--text-11)",
              color: "var(--color-text-50)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Check current API status on our status page ↗
          </a>
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "40px 0",
        }}
      />

      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-24)",
          fontWeight: 400,
          letterSpacing: "var(--tracking-tight)",
          marginBottom: 32,
          color: "var(--color-text-primary)",
        }}
      >
        Endpoints
      </h2>

      <EndpointSection
        method="GET"
        path="/api/v1/countries"
        description="Returns a paginated list of sovereign states with basic metadata. Filter by continent or government type."
        parameters={[
          {
            name: "continent",
            type: "string",
            description: 'Filter by continent (e.g. "Africa", "Europe")',
          },
          {
            name: "government_type",
            type: "string",
            description:
              'Filter by government type (partial match, e.g. "republic")',
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
        method="GET"
        path="/api/v1/government-types"
        description="Returns all government type classifications with the number of countries under each type, plus the five most populous examples."
        exampleResponse={`{
  "data": [
    {
      "governmentType": "presidential republic",
      "count": 42,
      "topExamples": ["United States", "Brazil", "Indonesia", "Nigeria", "Mexico"]
    },
    {
      "governmentType": "parliamentary republic",
      "count": 31,
      "topExamples": ["India", "Germany", "Italy", "South Africa", "Ethiopia"]
    }
  ],
  "meta": { "total": 12 }
}`}
      />

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "40px 0",
        }}
      />

      <section>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Usage Examples
        </h2>

        <h3
          style={{
            ...mono,
            fontSize: "var(--text-12)",
            color: "var(--color-text-primary)",
            marginBottom: 8,
          }}
        >
          curl
        </h3>
        <CodeBlock>{`curl "${BASE_URL}/countries?continent=Europe&limit=10"
curl "${BASE_URL}/countries/us"
curl "${BASE_URL}/government-types"`}</CodeBlock>

        <h3
          style={{
            ...mono,
            fontSize: "var(--text-12)",
            color: "var(--color-text-primary)",
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          JavaScript (fetch)
        </h3>
        <CodeBlock>{`const res = await fetch("${BASE_URL}/countries/fr");
const { data } = await res.json();
console.log(data.government.executive);`}</CodeBlock>

        <h3
          style={{
            ...mono,
            fontSize: "var(--text-12)",
            color: "var(--color-text-primary)",
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          Python (requests)
        </h3>
        <CodeBlock>{`import requests

resp = requests.get("${BASE_URL}/countries", params={"government_type": "monarchy"})
for country in resp.json()["data"]:
    print(country["name"], country["population"])`}</CodeBlock>
      </section>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "40px 0",
        }}
      />

      <section>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Data Sources & Licensing
        </h2>
        <p style={bodyText}>
          API data is sourced from the CIA World Factbook (public domain, archived
          January 2026), Wikidata (CC0), IPU Parline, and the Constitute Project.
          All public-domain and CC0 data is freely available for any use. Data from
          IPU Parline and Constitute Project is subject to their respective
          non-commercial licenses.
        </p>
      </section>
    </div>
  );
}
