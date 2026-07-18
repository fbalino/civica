import Link from "next/link";
import { getCivicaConditionsForJurisdiction } from "@/lib/db/queries";
import { ScorePosition } from "@/components/editorial/ScorePosition";
import { CURRENT_CONDITIONS_METHODOLOGY_VERSION } from "@/lib/conditions/contract";

// ── Dimension metadata ────────────────────────────────────────────────────────

const DIMENSION_META: Record<
  string,
  { label: string; shortLabel: string; description: string }
> = {
  human_development: {
    label: "Human Development",
    shortLabel: "HDI",
    description: "Education, health, and standard of living. Source: UNDP Human Development Index.",
  },
  peace_security: {
    label: "Peace & Security",
    shortLabel: "GPI",
    description: "Absence of conflict, violence, and militarisation. Source: Global Peace Index (IEP).",
  },
  economic_stability: {
    label: "Economic Stability",
    shortLabel: "WB",
    description: "Source-native inflation, unemployment, and real GDP growth inputs. No stability composite is currently published. Source: World Bank.",
  },
};

const DIMENSION_ORDER = ["human_development", "peace_security", "economic_stability"];

// ── Single dimension card ─────────────────────────────────────────────────────

function DimensionCard({
  dimension,
  score,
  sourceName,
  quarter,
  unscoredReason,
}: {
  dimension: string;
  score: number | null;
  sourceName: string | null;
  quarter: string | null;
  unscoredReason?: string;
}) {
  const meta = DIMENSION_META[dimension] ?? {
    label: dimension,
    shortLabel: dimension,
    description: "",
  };

  const displayScore = score != null ? Math.round(score) : null;

  return (
    <div
      style={{
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-sm)",
        padding: "20px 20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        flex: "1 1 200px",
      }}
    >
      {/* Dimension label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* Score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 400,
            fontSize: "clamp(36px, 7vw, 52px)",
            letterSpacing: "-0.02em",
            lineHeight: 0.9,
            color: "var(--color-text-primary)",
          }}
        >
          {displayScore != null ? displayScore : "—"}
        </span>
        {displayScore != null && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-40)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            / 100
          </span>
        )}
      </div>

      {/* Neutral numeric position — no grade or qualitative verdict. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-50)",
            }}
          >
            {score != null ? "Numeric estimate" : "Coming soon"}
          </span>
          {score != null ? (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-30)",
              }}
            >
              Research beta
            </span>
          ) : null}
        </div>
        <ScorePosition value={score} label={meta.label} compact />
      </div>

      {/* Source / quarter meta */}
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          lineHeight: 1.4,
        }}
      >
        {score != null
          ? [sourceName ?? meta.shortLabel, quarter].filter(Boolean).join(" · ")
          : unscoredReason ?? "Data not yet available for this country."}
      </p>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface CivicaConditionsPanelProps {
  jurisdictionId: string;
  methodologyVersion?: string;
}

export async function CivicaConditionsPanel({
  jurisdictionId,
  methodologyVersion = CURRENT_CONDITIONS_METHODOLOGY_VERSION,
}: CivicaConditionsPanelProps) {
  let rows: Awaited<ReturnType<typeof getCivicaConditionsForJurisdiction>> = [];
  try {
    rows = await getCivicaConditionsForJurisdiction(jurisdictionId, methodologyVersion);
  } catch {
    // DB not connected in dev or table doesn't exist yet — render gracefully
  }

  // Index fetched rows by dimension for O(1) lookup
  const rowMap = new Map(rows.map((r) => [r.dimension, r]));

  return (
    <section aria-label="Civica Conditions">
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
            margin: 0,
          }}
        >
          Civica Conditions
        </h2>
        <Link
          href="/civica-conditions"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-accent)",
            textDecoration: "none",
            letterSpacing: "0.06em",
          }}
        >
          Explore all countries &rarr;
        </Link>
      </div>

      {/* Explainer */}
      <p
        style={{
          fontFamily: "var(--font-body-sans, var(--font-body))",
          fontSize: "var(--text-14)",
          color: "var(--color-text-55)",
          lineHeight: "var(--leading-relaxed)",
          margin: "0 0 16px",
        }}
      >
        Material conditions — separate from governance. Reading these alongside
        the Civica Index tells a fuller story: a country can score well on
        governance while still facing difficult material conditions, or vice versa.
      </p>

      {/* Dimension cards */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {DIMENSION_ORDER.map((dim) => {
          const row = rowMap.get(dim);
          return (
            <DimensionCard
              key={dim}
              dimension={dim}
              score={dim === "economic_stability" ? null : row?.normalizedScore ?? null}
              sourceName={row?.sourceName ?? null}
              quarter={row?.quarter ?? null}
              unscoredReason={
                dim === "economic_stability"
                  ? "Source-native inputs are retained; no stability score is published while longitudinal validation is under way."
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}
