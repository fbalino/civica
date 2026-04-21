import type { Metadata } from "next";
import Link from "next/link";
import { getCIRankings, getDistinctGovernmentTypes } from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";

export const metadata: Metadata = {
  title: "Civica Index — Global Governance Rankings",
  description:
    "Explore the Civica Index: a composite governance quality score for 190+ countries, spanning democratic quality, rule of law, human development, freedom, corruption control, and stability.",
  alternates: { canonical: "https://civicaatlas.org/index" },
  openGraph: {
    title: "Civica Index — Global Governance Rankings | Civica",
    description:
      "Composite governance scores for 190+ countries across 6 dimensions.",
    url: "https://civicaatlas.org/index",
  },
};

const CONTINENTS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
];

function ciTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 90)
    return { label: "Elite", color: "#fff", bg: "oklch(55% 0.18 245)" };
  if (score >= 75)
    return { label: "Strong", color: "#fff", bg: "oklch(52% 0.18 145)" };
  if (score >= 50)
    return {
      label: "Moderate",
      color: "#1a1208",
      bg: "oklch(82% 0.17 85)",
    };
  if (score >= 25)
    return { label: "Weak", color: "#fff", bg: "oklch(60% 0.17 45)" };
  return { label: "Critical", color: "#fff", bg: "oklch(52% 0.20 25)" };
}

function TierBadge({ score }: { score: number }) {
  const tier = ciTier(score);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--font-weight-mono)",
        fontSize: "var(--text-12)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "var(--radius-sm)",
          background: tier.bg,
          color: tier.color,
          fontSize: "var(--text-11)",
          lineHeight: 1.4,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {tier.label}
      </span>
      <span style={{ color: "var(--color-text-60)" }}>{score.toFixed(1)}</span>
    </span>
  );
}

export default async function CivicaIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const continent =
    typeof sp?.continent === "string" ? sp.continent : undefined;
  const governmentType =
    typeof sp?.governmentType === "string" ? sp.governmentType : undefined;

  interface CIRankingRow {
    score: number;
    rank: number;
    totalRanked: number;
    isPartial: boolean;
    dimensionsAvailable: number;
    missingDimensions: string[] | null;
    methodologyVersion: string;
    jurisdictionId: string;
    slug: string;
    name: string;
    iso2: string | null;
    iso3: string | null;
    continent: string | null;
    governmentType: string | null;
    population: number | null;
    flagUrl: string | null;
  }

  let rawRows: CIRankingRow[] = [];
  let govTypes: string[] = [];
  try {
    const [result, gt] = await Promise.all([
      getCIRankings(undefined, { continent, governmentType }),
      getDistinctGovernmentTypes(),
    ]);
    const res = result as unknown as { rows: CIRankingRow[] };
    rawRows = res.rows ?? [];
    govTypes = gt;
  } catch {
    // DB not yet seeded
  }

  const rankings = rawRows.map((r, i) => ({ ...r, displayRank: i + 1 }));

  const activeFilters = continent || governmentType;

  return (
    <div
      style={{
        maxWidth: "var(--max-w-wide, 960px)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <header style={{ marginBottom: 40 }}>
        <h1 className="page-heading">Civica Index</h1>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-18)",
            color: "var(--color-text-60)",
            maxWidth: 600,
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          A composite governance quality score across 6 dimensions, ranking{" "}
          {rankings.length > 0
            ? `${rankings[0]?.totalRanked ?? rankings.length} countries`
            : "countries worldwide"}
          .
        </p>

        <nav
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              alignSelf: "center",
              marginRight: 4,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Region
          </span>
          <FilterPill href="/index" label="All" active={!continent} />
          {CONTINENTS.map((c) => (
            <FilterPill
              key={c}
              href={`/index?continent=${encodeURIComponent(c)}${governmentType ? `&governmentType=${encodeURIComponent(governmentType)}` : ""}`}
              label={c}
              active={continent === c}
            />
          ))}
        </nav>

        {govTypes.length > 0 && (
          <nav
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-30)",
                alignSelf: "center",
                marginRight: 4,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Type
            </span>
            <FilterPill
              href={continent ? `/index?continent=${encodeURIComponent(continent)}` : "/index"}
              label="All"
              active={!governmentType}
            />
            {govTypes.map((g) => (
              <FilterPill
                key={g}
                href={`/index?governmentType=${encodeURIComponent(g)}${continent ? `&continent=${encodeURIComponent(continent)}` : ""}`}
                label={g}
                active={governmentType === g}
              />
            ))}
          </nav>
        )}

        {activeFilters && (
          <div style={{ marginTop: 8 }}>
            <Link
              href="/index"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-12)",
                color: "var(--color-accent)",
                textDecoration: "none",
              }}
            >
              Clear all filters
            </Link>
          </div>
        )}
      </header>

      {rankings.length > 0 ? (
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-30)",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {rankings.length} {rankings.length === 1 ? "country" : "countries"}
            {activeFilters ? " matching filters" : " ranked"}
          </div>

          <div
            role="table"
            aria-label="Civica Index rankings"
            style={{ width: "100%" }}
          >
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 140px 100px",
                gap: 12,
                padding: "8px 12px",
                borderBottom: "1px solid var(--color-card-border)",
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-30)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              <div role="columnheader">#</div>
              <div role="columnheader">Country</div>
              <div role="columnheader">Score</div>
              <div role="columnheader" style={{ textAlign: "right" }}>
                Dimensions
              </div>
            </div>

            {rankings.map((r) => (
              <Link
                key={r.jurisdictionId}
                href={`/index/${r.slug}`}
                className="ci-ranking-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  role="row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr 140px 100px",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px",
                    borderBottom: "1px solid var(--color-card-border)",
                  }}
                >
                  <div
                    role="cell"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-14)",
                      color: "var(--color-text-40)",
                    }}
                  >
                    {r.rank}
                  </div>

                  <div
                    role="cell"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <CountryFlag iso2={r.iso2} size={24} />
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontWeight: 500,
                        fontSize: "var(--text-15)",
                      }}
                    >
                      {r.name}
                    </span>
                    {r.governmentType && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-11)",
                          color: "var(--color-text-25)",
                        }}
                      >
                        {r.governmentType}
                      </span>
                    )}
                  </div>

                  <div role="cell">
                    <TierBadge score={r.score} />
                  </div>

                  <div
                    role="cell"
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-30)",
                    }}
                  >
                    {r.isPartial ? (
                      <span
                        title={`${r.dimensionsAvailable}/6 dimensions available`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {r.dimensionsAvailable}/6
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "oklch(72% 0.17 85)",
                            display: "inline-block",
                          }}
                        />
                      </span>
                    ) : (
                      <span
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        6/6
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "oklch(52% 0.18 145)",
                            display: "inline-block",
                          }}
                        />
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <footer
            style={{
              marginTop: 32,
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-text-25)",
            }}
          >
            <Link
              href="/index/methodology"
              style={{
                color: "var(--color-accent)",
                textDecoration: "none",
              }}
            >
              Methodology
            </Link>
            <Link
              href="/index/compare"
              style={{
                color: "var(--color-accent)",
                textDecoration: "none",
              }}
            >
              Compare countries
            </Link>
            <Link
              href="/index/government-types"
              style={{
                color: "var(--color-accent)",
                textDecoration: "none",
              }}
            >
              By government type
            </Link>
            <Link
              href="/index/changelog"
              style={{
                color: "var(--color-accent)",
                textDecoration: "none",
              }}
            >
              Pulse changelog
            </Link>
          </footer>
        </>
      ) : (
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-18)",
              color: "var(--color-text-40)",
              marginBottom: 8,
            }}
          >
            No Civica Index data available yet.
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-25)",
            }}
          >
            Run <code>npm run ingest:ci</code> and{" "}
            <code>npm run calculate:ci</code> to populate scores.
          </p>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--font-weight-mono)",
        fontSize: "var(--text-12)",
        padding: "5px 12px",
        borderRadius: "var(--radius-sm)",
        textDecoration: "none",
        background: active ? "var(--color-accent)" : "var(--color-card-bg)",
        color: active ? "var(--color-bg)" : "var(--color-text-40)",
        border: active ? "none" : "1px solid var(--color-card-border)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}
