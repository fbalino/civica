/**
 * Phase 5.6 — Civica Pulse dimensional-delta panel.
 *
 * Renders the per-dimension Pulse impact for one country. Layout
 * follows spec §1.3: header eyebrow + Beta pill, then one row per
 * dimension showing delta value + 0–2 driving event headlines.
 *
 * Server component — receives the result of getPulseV2ForCountry()
 * directly, no client-side fetching.
 */

import Link from "next/link";
import { Pill } from "@/components/editorial/Pill";
import { Tooltip } from "@/components/editorial/Tooltip";
import type { PulseV2ForCountry, DimensionRow } from "@/lib/db/queries-pulse-v2";
import type { PulseDimension } from "@/lib/pulse/v2/types";
import { SCORE_WINDOW_DAYS } from "@/lib/pulse/v2/taxonomy";
import { pulse } from "@/lib/content/site-state";
import "./PulseDimensionalDeltas.css";

const DIMENSION_LABELS: Record<PulseDimension, string> = {
  democratic_quality: "Democratic Quality",
  rule_of_law: "Rule of Law",
  freedom_rights: "Rights & Freedoms",
  corruption_control: "Corruption Control",
  stability: "Stability",
};

/** A delta is large enough to show its event links when |δ| ≥ 0.5. */
const SIGNIFICANCE_THRESHOLD = 0.5;

interface Props {
  data: PulseV2ForCountry;
}

function formatDelta(d: number): string {
  if (d === 0) return "0";
  const rounded = Math.round(d * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

function formatLastComputed(iso: string | null): string {
  if (!iso) return "Not yet computed";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ProvenanceDot() {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 12,
        height: 12,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "999px",
          background: "var(--color-source-live)",
          opacity: 0.2,
          animation: "civ-pulse 2s ease-out infinite",
        }}
      />
      <span
        style={{
          position: "relative",
          width: 8,
          height: 8,
          borderRadius: "999px",
          background: "var(--color-source-live)",
          boxShadow: "0 0 0 1px color-mix(in oklab, var(--color-success) 22%, transparent)",
        }}
      />
    </span>
  );
}

function DimensionRowView({
  row,
  countrySlug,
}: {
  row: DimensionRow;
  countrySlug: string;
}) {
  const hasEvidence = row.evidence.nEvents > 0;
  const significant =
    hasEvidence &&
    row.delta !== null &&
    Math.abs(row.delta) >= SIGNIFICANCE_THRESHOLD;
  // A delta resting on thin evidence is shown de-emphasized — its
  // magnitude is no longer treated as an authoritative score. The
  // CSS class supplies the muted color + lighter weight. All other deltas use
  // neutral ink; sign and numeric magnitude communicate direction without a
  // traffic-light country verdict.
  const limited = row.limitedSignal;
  const color = limited
    ? undefined
    : significant
      ? "var(--color-text-primary)"
      : "var(--color-text-40)";

  return (
    <div
      className="pulse-dimension-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(160px, 200px) auto 1fr",
        gap: 16,
        alignItems: "baseline",
        padding: "14px 0",
        borderTop: "1px solid var(--color-card-border)",
      }}
    >
      <div
        className="pulse-dimension-label"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-15)",
          color: "var(--color-text-primary)",
          fontWeight: 500,
        }}
      >
        <span className="pulse-dimension-name">
          {DIMENSION_LABELS[row.dimension]}
        </span>
        {limited && row.limitedReason ? (
          <Tooltip
            content="This delta rests on thin evidence — read it as a provisional signal, not a confident score."
            className="pulse-dimension-limited-tooltip"
          >
            <span className="pulse-dimension-limited-tag">
              <span className="pulse-dimension-limited-dot" aria-hidden="true" />
              Limited signal · {row.limitedReason}
            </span>
          </Tooltip>
        ) : null}
      </div>

      <div
        className={
          limited
            ? "pulse-dimension-value pulse-dimension-value--limited"
            : "pulse-dimension-value"
        }
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: limited ? undefined : "var(--font-weight-mono)",
          fontSize: "var(--text-18)",
          color,
          minWidth: 56,
          textAlign: "right",
          letterSpacing: "0.02em",
        }}
      >
        {hasEvidence && row.delta !== null ? formatDelta(row.delta) : "—"}
      </div>

      <div style={{ minWidth: 0 }}>
        {significant && row.drivingEvents.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {row.drivingEvents.map((ev) => (
              <li
                key={ev.id}
                className="pulse-dimension-event"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-55)",
                  lineHeight: 1.4,
                  display: "flex",
                  gap: 8,
                  alignItems: "baseline",
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  className="pulse-dimension-event-date"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-40)",
                    flexShrink: 0,
                    minWidth: 60,
                  }}
                >
                  {ev.eventDate}
                </span>
                <Link
                  href={`/civica-index/pulse-changelog?country=${countrySlug}#evt-${ev.id}`}
                  className="pulse-dimension-event-link"
                  style={{
                    minWidth: 0,
                    color: "var(--color-text-55)",
                    textDecoration: "none",
                    borderBottom:
                      "1px dotted var(--color-card-border)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {ev.headline}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-40)",
            }}
          >
            {hasEvidence
              ? "Experimental effect below ±0.5"
              : "No published event detected"}
          </span>
        )}
      </div>
    </div>
  );
}

export function PulseDimensionalDeltas({ data }: Props) {
  const { jurisdiction, dimensions, lastComputedAt, totalEvents } = data;
  const dimensionRows = Object.values(dimensions);
  const significantCount = dimensionRows.filter(
    (r) =>
      r.evidence.nEvents > 0 &&
      r.delta !== null &&
      Math.abs(r.delta) >= SIGNIFICANCE_THRESHOLD
  ).length;

  return (
    <section
      className="pulse-dimensions-panel"
      aria-label={`Civica Pulse Beta dimensional impact for ${jurisdiction.name}`}
      style={{
        background: "var(--color-card-bg)",
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-sm)",
        padding: "24px 28px 20px",
        boxShadow: "var(--shadow-hard-lg)",
        marginBottom: 24,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div
          className="pulse-dimensions-heading"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <ProvenanceDot />
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
            Civica Pulse
          </span>
          {pulse.status === "beta" ? <Pill variant="warn">Beta</Pill> : null}
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
            Trailing {SCORE_WINDOW_DAYS} days
          </span>
        </div>

        <Link
          href={`/civica-index/pulse-changelog?country=${jurisdiction.slug}`}
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
            textDecoration: "none",
          }}
        >
          See all events →
        </Link>
      </header>

      {data.pressFreedomContext.directLookup &&
      data.pressFreedomContext.score < 30 ? (
        <div
          className="editorial-warning"
          style={{ margin: "8px 0 16px" }}
        >
          <strong>Coverage caveat.</strong> Civica&apos;s provisional,
          incomplete 2024 press-freedom context lookup flags a severely
          restricted information environment for {jurisdiction.name}. The
          Pulse depends on observable
          events; in restricted-press environments it systematically
          under-detects events, and the lookup itself is not a complete or
          current RSF dataset. Consult the underlying country evidence and
          named sources. See the{" "}
          <Link
            href="/civica-index/methodology/pulse#coverage-limitations"
            style={{ color: "var(--color-accent)" }}
          >
            Pulse coverage limitations
          </Link>{" "}
          for details.
        </div>
      ) : null}

      {totalEvents === 0 ? (
        <p
          style={{
            margin: "8px 0 12px",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-15)",
            color: "var(--color-text-55)",
            lineHeight: 1.5,
          }}
        >
          No published Pulse events were detected for {jurisdiction.name} in
          the current evidence window. This is not evidence that governance
          was stable. Events queued for human review do not contribute to the
          public experimental deltas. See the{" "}
          <Link
            href="/civica-index/pulse-changelog"
            style={{ color: "var(--color-accent)" }}
          >
            global changelog
          </Link>{" "}
          for current activity, or{" "}
          <Link
            href="/civica-index/methodology/pulse"
            style={{ color: "var(--color-accent)" }}
          >
            methodology
          </Link>{" "}
          for how the ledger and experimental effects are computed.
        </p>
      ) : (
        <div>
          {dimensionRows.map((row) => (
            <DimensionRowView
              key={row.dimension}
              row={row}
              countrySlug={jurisdiction.slug}
            />
          ))}
        </div>
      )}

      <footer
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid var(--color-card-border)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          letterSpacing: "0.06em",
          color: "var(--color-text-40)",
        }}
      >
        <span>
          {totalEvents === 0
            ? "No experimental delta available"
            : significantCount === 0
              ? `${totalEvents} published event${totalEvents === 1 ? "" : "s"} · effects below ±0.5`
            : `${significantCount} dimension${significantCount === 1 ? "" : "s"} moving · ${totalEvents} event${totalEvents === 1 ? "" : "s"} in window`}
        </span>
        <span>Last computed {formatLastComputed(lastComputedAt)}</span>
      </footer>
    </section>
  );
}
