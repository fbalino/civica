import type { Metadata } from "next";
import Link from "next/link";
import { getCIMethodology, getCIMethodologyHistory } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Civica Index Methodology — How We Score Governance",
  description:
    "The Civica Index methodology: 6 dimensions of governance quality, weighted composite scoring, data sources, and normalization approach.",
  alternates: { canonical: "https://civicaatlas.org/index/methodology" },
};

const DIMENSIONS = [
  {
    key: "democratic_quality",
    label: "Democratic Quality",
    weight: 0.3,
    description:
      "Measures the quality and depth of democratic institutions, including electoral integrity, legislative constraints on the executive, freedom of association, and participatory governance.",
    source: "V-Dem (Varieties of Democracy)",
    sourceUrl: "https://www.v-dem.net",
  },
  {
    key: "rule_of_law",
    label: "Rule of Law",
    weight: 0.2,
    description:
      "Captures the strength of legal institutions, judicial independence, contract enforcement, property rights, and constraints on corruption within the justice system.",
    source: "World Bank Worldwide Governance Indicators",
    sourceUrl: "https://info.worldbank.org/governance/wgi/",
  },
  {
    key: "human_development",
    label: "Human Development",
    weight: 0.15,
    description:
      "Reflects outcomes in education, health, and standard of living — the extent to which governance translates into tangible improvements in citizens' lives.",
    source: "UNDP Human Development Index",
    sourceUrl: "https://hdr.undp.org",
  },
  {
    key: "freedom_rights",
    label: "Freedom & Rights",
    weight: 0.15,
    description:
      "Evaluates civil liberties, political rights, press freedom, and individual freedoms — the degree to which citizens can exercise fundamental rights without state interference.",
    source: "Freedom House",
    sourceUrl: "https://freedomhouse.org",
  },
  {
    key: "corruption_control",
    label: "Corruption Control",
    weight: 0.1,
    description:
      "Measures the perceived level of public sector corruption, bribery, diversion of public funds, and the effectiveness of anti-corruption mechanisms.",
    source: "Transparency International CPI",
    sourceUrl: "https://www.transparency.org",
  },
  {
    key: "stability_security",
    label: "Stability & Security",
    weight: 0.1,
    description:
      "Assesses internal peace, absence of political violence, societal safety, and the state's ability to maintain order without excessive force.",
    source: "Global Peace Index (IEP)",
    sourceUrl: "https://www.visionofhumanity.org/maps/",
  },
];

function WeightBar({ weight }: { weight: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 4,
          background: "var(--color-divider)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${weight * 100}%`,
            height: "100%",
            background: "var(--color-accent)",
            borderRadius: 2,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-40)",
          minWidth: 36,
          textAlign: "right",
        }}
      >
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function MethodologyPage() {
  let methodology: Awaited<ReturnType<typeof getCIMethodology>> | null = null;
  let history: Awaited<ReturnType<typeof getCIMethodologyHistory>> = [];

  try {
    [methodology, history] = await Promise.all([
      getCIMethodology(),
      getCIMethodologyHistory(),
    ]);
  } catch {
    // DB not seeded
  }

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content, 720px)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <nav
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-30)",
          marginBottom: 32,
        }}
      >
        <Link
          href="/index"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          Civica Index
        </Link>
        <span style={{ margin: "0 8px", color: "var(--color-text-20)" }}>
          /
        </span>
        Methodology
      </nav>

      <header style={{ marginBottom: 48 }}>
        <h1 className="page-heading">Methodology</h1>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-18)",
            color: "var(--color-text-60)",
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          The Civica Index is a composite governance quality score combining 6
          independently sourced dimensions into a single 0–100 scale.
        </p>
        {methodology && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-25)",
              marginTop: 12,
            }}
          >
            Current version: {methodology.id} · Published{" "}
            {formatDate(methodology.publishedAt)}
          </p>
        )}
      </header>

      {/* Scoring overview */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          How It Works
        </h2>
        <div
          style={{
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize: "var(--text-15)",
            lineHeight: 1.7,
            color: "var(--color-text-60)",
          }}
        >
          <p style={{ marginBottom: 16 }}>
            Each country receives a normalized score (0–100) in each of the 6
            dimensions below. These are drawn from independent, internationally
            recognized datasets. Scores are normalized using min-max scaling
            across all observed values, so a score of 0 represents the global
            minimum and 100 the global maximum.
          </p>
          <p style={{ marginBottom: 16 }}>
            The composite Civica Index score is a weighted average of available
            dimension scores. Countries with fewer than 3 available dimensions
            are excluded from the ranking. When a country is missing some
            dimensions, remaining weights are re-proportioned to sum to 100%.
          </p>
          <p>
            Scores are calculated quarterly. The current methodology applies
            equal-period weighting — each quarter's score is independent, not a
            rolling average.
          </p>
        </div>
      </section>

      {/* Tier system */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Tier System
        </h2>
        <div
          style={{
            display: "grid",
            gap: 1,
            background: "var(--color-divider)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
          }}
        >
          {[
            {
              range: "90–100",
              label: "Elite",
              bg: "oklch(55% 0.18 245)",
              color: "#fff",
            },
            {
              range: "75–89",
              label: "Strong",
              bg: "oklch(52% 0.18 145)",
              color: "#fff",
            },
            {
              range: "50–74",
              label: "Moderate",
              bg: "oklch(82% 0.17 85)",
              color: "#1a1208",
            },
            {
              range: "25–49",
              label: "Weak",
              bg: "oklch(60% 0.17 45)",
              color: "#fff",
            },
            {
              range: "0–24",
              label: "Critical",
              bg: "oklch(52% 0.20 25)",
              color: "#fff",
            },
          ].map((tier) => (
            <div
              key={tier.label}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 100px 1fr",
                gap: 16,
                alignItems: "center",
                padding: "12px 16px",
                background: "var(--color-bg)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-40)",
                }}
              >
                {tier.range}
              </span>
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: tier.bg,
                  color: tier.color,
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  textAlign: "center",
                }}
              >
                {tier.label}
              </span>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: tier.bg,
                  opacity: 0.5,
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Dimensions */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            marginBottom: 24,
            color: "var(--color-text-primary)",
          }}
        >
          Dimensions & Weights
        </h2>
        <div style={{ display: "grid", gap: 24 }}>
          {DIMENSIONS.map((dim) => (
            <div
              key={dim.key}
              style={{
                padding: "20px 24px",
                background: "var(--color-card-bg)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-18)",
                    fontWeight: 400,
                    margin: 0,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {dim.label}
                </h3>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-11)",
                    color: "var(--color-accent)",
                  }}
                >
                  {(dim.weight * 100).toFixed(0)}% weight
                </span>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body, var(--font-sans))",
                  fontSize: "var(--text-14)",
                  lineHeight: 1.6,
                  color: "var(--color-text-50)",
                  margin: "0 0 12px",
                }}
              >
                {dim.description}
              </p>
              <WeightBar weight={dim.weight} />
              <div
                style={{
                  marginTop: 10,
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                }}
              >
                Source:{" "}
                <a
                  href={dim.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--color-accent)",
                    textDecoration: "none",
                  }}
                >
                  {dim.source}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weight summary donut approximation */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Weight Distribution
        </h2>
        <div
          style={{
            display: "flex",
            height: 8,
            borderRadius: 4,
            overflow: "hidden",
            gap: 2,
            marginBottom: 16,
          }}
        >
          {DIMENSIONS.map((dim) => (
            <div
              key={dim.key}
              style={{
                flex: dim.weight,
                background: "var(--color-accent)",
                opacity: 0.3 + dim.weight * 2,
                borderRadius: 2,
              }}
              title={`${dim.label}: ${(dim.weight * 100).toFixed(0)}%`}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 20px",
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-11)",
            color: "var(--color-text-40)",
          }}
        >
          {DIMENSIONS.map((dim) => (
            <span key={dim.key}>
              {dim.label} ({(dim.weight * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      </section>

      {/* Normalization */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Normalization
        </h2>
        <div
          style={{
            fontFamily: "var(--font-body, var(--font-sans))",
            fontSize: "var(--text-15)",
            lineHeight: 1.7,
            color: "var(--color-text-60)",
          }}
        >
          <p style={{ marginBottom: 16 }}>
            Each source dataset uses its own native scale. We apply min-max
            normalization to project all values onto a common 0–100 scale:
          </p>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-14)",
              padding: "16px 20px",
              background: "var(--color-card-bg)",
              border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm)",
              marginBottom: 16,
              color: "var(--color-text-60)",
            }}
          >
            score = ((value - global_min) / (global_max - global_min)) × 100
          </div>
          <p>
            For inverted scales (where lower raw values indicate better
            governance, e.g. Fragile States Index), we reverse the direction
            before normalization. Global min/max values are calculated across all
            observed countries for each dataset year.
          </p>
        </div>
      </section>

      {/* Version history */}
      {history.length > 0 && (
        <section style={{ marginBottom: 56 }}>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-24)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              marginBottom: 16,
              color: "var(--color-text-primary)",
            }}
          >
            Version History
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {history.map((v) => (
              <div
                key={v.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: 16,
                  padding: "12px 16px",
                  background: "var(--color-card-bg)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-14)",
                    color: "var(--color-accent)",
                  }}
                >
                  {v.id}
                </span>
                <div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-40)",
                    }}
                  >
                    {formatDate(v.publishedAt)}
                  </span>
                  {v.notes && (
                    <p
                      style={{
                        fontFamily: "var(--font-body, var(--font-sans))",
                        fontSize: "var(--text-14)",
                        color: "var(--color-text-50)",
                        margin: "4px 0 0",
                        lineHeight: 1.5,
                      }}
                    >
                      {v.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer
        style={{
          borderTop: "1px solid var(--color-divider)",
          paddingTop: 24,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-25)",
        }}
      >
        <Link
          href="/index"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          Back to rankings
        </Link>
        <Link
          href="/index/government-types"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          By government type
        </Link>
        <Link
          href="/index/changelog"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          Pulse changelog
        </Link>
      </footer>
    </div>
  );
}
