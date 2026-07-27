import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { BetaChip } from "@/components/editorial/BetaChip";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { Pill } from "@/components/editorial/Pill";
import { DataTable } from "@/components/editorial/DataTable";
import { Reveal } from "@/components/motion/Reveal";
import { ResearchVisualizationDisclosure } from "@/components/research/ResearchVisualizationDisclosure";
import {
  getBacktestSnapshot,
  getBacktestStats,
  type BacktestSnapshotCase,
} from "@/lib/db/queries-backtest";
import { pulse } from "@/lib/content/site-state";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Civica Pulse Backtest Report (Beta)",
  description:
    "Archived diagnostic results from ten hand-curated Pulse scenarios. These results do not validate the current production ensemble.",
  alternates: {
    canonical:
      "https://civicaatlas.org/civica-index/methodology/pulse/backtest",
  },
};

const DIMENSION_LABELS: Record<string, string> = {
  democratic_quality: "Democratic Quality",
  rule_of_law: "Rule of Law",
  freedom_rights: "Rights & Freedoms",
  corruption_control: "Corruption Control",
  stability: "Stability",
};

const VERDICT_VARIANT: Record<
  string,
  "default" | "accent" | "success" | "warn" | "danger"
> = {
  pass: "success",
  partial: "warn",
  fail: "danger",
};

const VERDICT_LABEL: Record<string, string> = {
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
};

function formatDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** SVG sparkline of the trajectory for one dimension. The −30 through +90
 *  highlight band makes the verdict window obvious. */
function TrajectorySparkline({
  samples,
  width = 280,
  height = 72,
  thresholdAbs = 1,
}: {
  samples: Array<{ dayOffset: number; delta: number }>;
  width?: number;
  height?: number;
  thresholdAbs?: number;
}) {
  if (samples.length === 0) return null;

  const xs = samples.map((s) => s.dayOffset);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  // Domain: [-15, +10] is the spec clamping range; fix axis so all
  // sparklines compare visually.
  const yMin = -15;
  const yMax = 10;

  const padX = 6;
  const padY = 4;
  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;

  const xScale = (x: number) =>
    padX + ((x - xMin) / Math.max(1, xMax - xMin)) * innerW;
  const yScale = (y: number) =>
    padY + ((yMax - y) / (yMax - yMin)) * innerH;

  const points = samples
    .map((s) => `${xScale(s.dayOffset).toFixed(1)},${yScale(s.delta).toFixed(1)}`)
    .join(" ");

  // Day-0 marker
  const x0 = xScale(0);
  // Day −30 through +90 verdict-window highlight.
  const xLo = xScale(-30);
  const xHi = xScale(90);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Dimensional trajectory: ${samples.map((sample) => `day ${sample.dayOffset >= 0 ? "+" : ""}${sample.dayOffset}, delta ${sample.delta.toFixed(2)}`).join("; ")}`}
      style={{ display: "block" }}
    >
      {/* zero line */}
      <line
        x1={padX}
        x2={width - padX}
        y1={yScale(0)}
        y2={yScale(0)}
        stroke="var(--color-card-border)"
        strokeWidth="1"
      />
      {/* threshold lines */}
      <line
        x1={padX}
        x2={width - padX}
        y1={yScale(thresholdAbs)}
        y2={yScale(thresholdAbs)}
        stroke="var(--color-text-30)"
        strokeWidth="0.5"
        strokeDasharray="2 3"
      />
      <line
        x1={padX}
        x2={width - padX}
        y1={yScale(-thresholdAbs)}
        y2={yScale(-thresholdAbs)}
        stroke="var(--color-text-30)"
        strokeWidth="0.5"
        strokeDasharray="2 3"
      />
      {/* verdict window highlight */}
      <rect
        x={xLo}
        y={padY}
        width={xHi - xLo}
        height={innerH}
        fill="var(--color-accent)"
        opacity="0.06"
      />
      {/* day-0 marker */}
      <line
        x1={x0}
        x2={x0}
        y1={padY}
        y2={height - padY}
        stroke="var(--color-accent)"
        strokeWidth="0.5"
        strokeDasharray="3 2"
      />
      {/* trajectory line */}
      <polyline
        fill="none"
        stroke="var(--color-text-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

function CaseSection({ caseRow }: { caseRow: BacktestSnapshotCase }) {
  const trajectoryByDim = new Map<
    string,
    Array<{ dayOffset: number; delta: number }>
  >();
  if (caseRow.latest) {
    for (const s of caseRow.latest.trajectory) {
      const arr = trajectoryByDim.get(s.dimension) ?? [];
      arr.push({ dayOffset: s.dayOffset, delta: s.delta });
      trajectoryByDim.set(s.dimension, arr);
    }
    for (const arr of trajectoryByDim.values()) {
      arr.sort((a, b) => a.dayOffset - b.dayOffset);
    }
  }

  return (
    <Reveal as="section" className="editorial-section" id={caseRow.id} amount={0.1}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>
          {caseRow.countryName} —{" "}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-15)",
              color: "var(--color-text-40)",
              letterSpacing: "0.04em",
            }}
          >
            {caseRow.id}
          </span>
        </h2>
        <div
          style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}
        >
          {caseRow.latest ? (
            <Pill variant={VERDICT_VARIANT[caseRow.latest.verdict]}>
              Earlier harness: {VERDICT_LABEL[caseRow.latest.verdict]}
            </Pill>
          ) : (
            <Pill>Not yet run</Pill>
          )}
          <Pill>{formatDate(caseRow.eventDate)}</Pill>
        </div>
      </header>

      <p>{caseRow.description}</p>

      <h3>Expected vs. computed</h3>
      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Expected</th>
            <th>Peak Δ</th>
            <th>Peak day</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {caseRow.expected.map((exp, i) => {
            const detail = caseRow.latest?.detail.find(
              (d) => d.expected.dimension === exp.dimension
            );
            return (
              <tr key={`${exp.dimension}-${i}`}>
                <td>{DIMENSION_LABELS[exp.dimension] ?? exp.dimension}</td>
                <td>
                  {exp.magnitude} {exp.direction}
                </td>
                <td className="editorial-td-num">
                  {detail
                    ? `${detail.peakDelta > 0 ? "+" : ""}${detail.peakDelta.toFixed(2)}`
                    : "—"}
                </td>
                <td className="editorial-td-num">
                  {detail
                    ? `${detail.peakDay > 0 ? "+" : ""}${detail.peakDay}d`
                    : "—"}
                </td>
                <td>
                  {detail ? (detail.pass ? "✓" : "✕") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {caseRow.latest && trajectoryByDim.size > 0 ? (
        <>
          <h3>Trajectories</h3>
          <p>
            Sampled every 30 days from −180 to +360. Vertical accent
            line marks the case event date; the lighter band is the
            −30 through +90 day verdict window. Dashed grid lines mark ±1 (the
            moderate threshold).
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              marginTop: 12,
            }}
          >
            {Array.from(trajectoryByDim.entries()).map(([dim, samples]) => (
              <div
                key={dim}
                style={{
                  background: "var(--color-card-bg)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "var(--radius-md)",
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-12)",
                    fontWeight: "var(--font-weight-mono)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--color-text-40)",
                    marginBottom: 6,
                  }}
                >
                  {DIMENSION_LABELS[dim] ?? dim}
                </div>
                <TrajectorySparkline samples={samples} />
              </div>
            ))}
          </div>
          <ResearchVisualizationDisclosure
            title={`${caseRow.countryName} archived trajectory`}
            description="The small multiples show the diagnostic delta samples used by the earlier harness. The table below is the exact nonvisual equivalent, not a current-production evaluation."
            sources={[
              {
                label: `Archived Pulse backtest case ${caseRow.id}`,
                retrievedAt: caseRow.latest.ranAt,
                upstreamVintage: caseRow.latest.ranAt,
              },
            ]}
            missingData="A dimension with no retained samples has no sparkline and is not interpreted as a zero effect."
            dataAccess={{
              kind: "withheld",
              reason:
                "Raw backtest event evidence is not publicly redistributed; this archived diagnostic table exposes only the derived samples shown in the visual.",
            }}
            tableLabel="Show archived trajectory samples"
          >
            <DataTable aria-label={`${caseRow.countryName} archived trajectory sample table`}>
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Day offset</th>
                  <th scope="col">Derived delta</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(trajectoryByDim.entries()).flatMap(
                  ([dimension, samples]) =>
                    samples.map((sample) => (
                      <tr key={`${dimension}-${sample.dayOffset}`}>
                        <th scope="row">
                          {DIMENSION_LABELS[dimension] ?? dimension}
                        </th>
                        <td>{sample.dayOffset >= 0 ? `+${sample.dayOffset}` : sample.dayOffset}</td>
                        <td>{sample.delta.toFixed(2)}</td>
                      </tr>
                    )),
                )}
              </tbody>
            </DataTable>
          </ResearchVisualizationDisclosure>
        </>
      ) : null}

      {caseRow.latest && caseRow.latest.detail.length > 0 ? (
        <>
          <h3>Notes</h3>
          <ul>
            {caseRow.latest.detail.map((d, i) => (
              <li key={i}>
                <strong>
                  {DIMENSION_LABELS[d.expected.dimension] ?? d.expected.dimension}
                </strong>
                : {d.notes}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {caseRow.latest ? (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
            letterSpacing: "0.04em",
            marginTop: 8,
          }}
        >
          Last ran {formatDate(caseRow.latest.ranAt)}
        </p>
      ) : null}
    </Reveal>
  );
}

export default async function BacktestReportPage() {
  let snapshot: BacktestSnapshotCase[] = [];
  let stats: Awaited<ReturnType<typeof getBacktestStats>> = {
    totalCases: 0,
    passCount: 0,
    partialCount: 0,
    failCount: 0,
    unrunCount: 0,
    lastRunAt: null,
  };

  try {
    [snapshot, stats] = await Promise.all([
      getBacktestSnapshot(),
      getBacktestStats(),
    ]);
  } catch {
    // Keep methodology readable when Neon is unavailable.
  }

  const sidebarItems = [
    { id: "summary", label: "Summary" },
    { id: "verdict-thresholds", label: "Verdict thresholds" },
    ...snapshot.map((c) => ({
      id: c.id,
      label: c.countryName,
    })),
    { id: "cite", label: "Cite this page" },
  ];

  return (
    <MethodologyLayout items={sidebarItems}>
      <EditorialPage>
      <SmartBreadcrumbs />

      <h1 className="editorial-page-title">
        Pulse backtest report
        {pulse.status === "beta" ? <BetaChip inHeading /> : null}
      </h1>
      <p className="editorial-page-subtitle">
        An internal smoke-test archive over hand-curated historical scenarios.
        It is useful for regression debugging, not as evidence that the current
        production ensemble is accurate.
      </p>

      <div className="editorial-warning">
        <strong>These are not current-runtime validation results.</strong>{" "}
        The displayed run predates the cross-vendor production ensemble and
        used an earlier single-model architecture. The scenarios are
        hand-curated rather than a representative, independently labelled
        sample. Their pass/partial/fail labels therefore do not establish
        accuracy, expert consensus, or readiness to graduate from Beta.
      </div>

      <Reveal as="section" className="editorial-section" id="summary" amount={0.3}>
        <h2>Archived diagnostic summary</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total cases</td>
              <td className="editorial-td-num">{stats.totalCases}</td>
            </tr>
            <tr>
              <td>Earlier-harness pass</td>
              <td className="editorial-td-num">{stats.passCount}</td>
            </tr>
            <tr>
              <td>Earlier-harness partial</td>
              <td className="editorial-td-num">{stats.partialCount}</td>
            </tr>
            <tr>
              <td>Earlier-harness fail</td>
              <td className="editorial-td-num">{stats.failCount}</td>
            </tr>
            <tr>
              <td>Not yet run</td>
              <td className="editorial-td-num">{stats.unrunCount}</td>
            </tr>
            <tr>
              <td>Last diagnostic run</td>
              <td className="editorial-td-num">
                {stats.lastRunAt
                  ? formatDate(stats.lastRunAt)
                  : "(never)"}
              </td>
            </tr>
          </tbody>
        </table>
      </Reveal>

      <Reveal as="section" className="editorial-section" id="verdict-thresholds" amount={0.3}>
        <h2>Verdict thresholds</h2>
        <p>
          For each expected (dimension, direction) row, the case passes
          if the absolute peak |Δ| from day −30 through day +90
          (relative to the case&apos;s event date) reaches the magnitude
          threshold in the right direction. Magnitudes:
        </p>
        <ul>
          <li>
            <strong>Moderate</strong>: |Δ| ≥ 1.0
          </li>
          <li>
            <strong>Severe</strong>: |Δ| ≥ 3.0
          </li>
          <li>
            <strong>Catastrophic</strong>: |Δ| ≥ 5.0
          </li>
        </ul>
      </Reveal>

      {snapshot.map((c) => (
        <CaseSection key={c.id} caseRow={c} />
      ))}

      <Reveal as="section" className="editorial-section" id="cite" amount={0.15}>
        <h2>Cite this page</h2>
        <CiteAccordion
          subject="Civica Atlas Methodology — Pulse backtest report (Beta)"
          pageTitle="Pulse backtest report"
          url="https://civicaatlas.org/civica-index/methodology/pulse/backtest"
          dataVintage={stats.lastRunAt ?? undefined}
        />
      </Reveal>

      <nav
        className="editorial-footer-nav"
        aria-label="Backtest navigation"
      >
        <Link href="/civica-index/methodology/pulse">
          ← Pulse methodology
        </Link>
        <Link href="/civica-index/pulse-changelog">Pulse changelog</Link>
        <Link href="/civica-index/corrections">Corrections form</Link>
      </nav>
      </EditorialPage>
    </MethodologyLayout>
  );
}
