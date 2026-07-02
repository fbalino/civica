import type { Metadata } from "next";
import Link from "next/link";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { Reveal } from "@/components/motion/Reveal";
import {
  getCIMethodology,
  getCIMethodologyHistory,
} from "@/lib/db/queries";
import { humanizeSectionLabel } from "@/lib/data/humanize-label";
import { civicaIndex, disputeSla, pulse } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica Index Methodology — How Governance Is Scored",
  description:
    `The Civica Index methodology: ${civicaIndex.dimensionCount} governance dimensions, fixed-bound normalization, Monte Carlo uncertainty intervals, A–F rank bands, and a separate Civica Conditions companion layer.${civicaIndex.status === "beta" ? " Beta — methodology in active development." : ""}`,
  alternates: { canonical: "https://civicaatlas.org/civica-index/methodology" },
};

const SECTIONS = [
  { id: "scale", num: 1, label: "Scale" },
  { id: "dimensions", num: 2, label: "Dimensions" },
  { id: "normalization", num: 3, label: "Normalization" },
  { id: "weights", num: 4, label: "Weights" },
  { id: "uncertainty", num: 5, label: "Uncertainty" },
  { id: "bands", num: 6, label: "Rank bands" },
  { id: "missing", num: 7, label: "Missing data" },
  { id: "conditions", num: 8, label: "Conditions" },
  { id: "gov-type", num: 9, label: "Government type" },
  { id: "pulse", num: 10, label: "Civica Pulse" },
  { id: "vintages", num: 11, label: "Vintages" },
  { id: "limitations", num: 12, label: "Limitations" },
  { id: "citation", num: 13, label: "Citation" },
  { id: "versioning", num: 14, label: "Versioning" },
];

interface DimensionRow {
  label: string;
  weight: number;
  tierVar: string;
  primary: string;
  secondary: string;
}

/**
 * Per-dimension presentation metadata (visualization color + source
 * attribution). Adopted weights are read from
 * `state.civicaIndex.dimensions` to keep the methodology page in sync
 * with the running scorer (`src/lib/ci/dimensions-v2.ts`). The PCA
 * appendix at /civica-index/methodology/pca-appendix is the canonical
 * derivation record.
 */
const DIMENSION_PRESENTATION: Record<
  string,
  Pick<DimensionRow, "tierVar" | "primary" | "secondary">
> = {
  democratic_quality: {
    tierVar: "var(--tier-exceptional)",
    primary: "V-Dem Liberal Democracy Index",
    secondary: "V-Dem Electoral Democracy Index",
  },
  rule_of_law: {
    tierVar: "var(--tier-strong)",
    primary: "V-Dem Rule of Law",
    secondary: "World Bank WGI Rule of Law",
  },
  freedom_rights: {
    tierVar: "var(--color-accent)",
    primary: "Freedom House (PR + CL combined)",
    secondary: "RSF Press Freedom Index",
  },
  corruption_control: {
    tierVar: "var(--tier-weak)",
    primary: "Transparency International CPI",
    secondary: "World Bank WGI Control of Corruption",
  },
};

const DIMENSIONS: DimensionRow[] = civicaIndex.dimensions.map((d) => ({
  label: d.label,
  weight: Math.round(d.weight * 100),
  ...DIMENSION_PRESENTATION[d.id],
}));

/** Rank bands — see rank bands section. */
const BANDS: Array<{
  letter: string;
  range: string;
  label: string;
  color: string;
}> = [
  { letter: "A", range: "85 – 100", label: "Exceptional", color: "var(--tier-exceptional)" },
  { letter: "B", range: "70 – 84", label: "Strong", color: "var(--tier-strong)" },
  { letter: "C", range: "55 – 69", label: "Mixed", color: "var(--tier-mixed)" },
  { letter: "D", range: "40 – 54", label: "Weak", color: "var(--tier-weak)" },
  { letter: "E", range: "25 – 39", label: "Very weak", color: "var(--tier-failed)" },
  { letter: "F", range: "0 – 24", label: "Failed / authoritarian", color: "var(--tier-failed)" },
];

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
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

  const lastRevision = methodology?.publishedAt
    ? formatDate(methodology.publishedAt)
    : civicaIndex.lastRevision;
  const cutoverTarget = civicaIndex.cutoverTarget;
  const pc1VariancePct = (civicaIndex.pca.pc1VarianceExplained * 100).toFixed(
    1,
  );
  const [corrLow, corrHigh] = civicaIndex.pca.correlationRange;
  const sidebarItems = SECTIONS.map((s) => ({
    id: s.id,
    label: humanizeSectionLabel(s.label),
  }));

  // Pre-computed helpers for the markdown body. Per Phase 5 §3.2.
  // Keys must match the validator's per-file allowlist in
  // scripts/validate-content-templates.ts.
  const ctx = {
    lastRevision,
    pc1VariancePct,
    corrLow,
    corrHigh,
  };

  const state = { civicaIndex, disputeSla, pulse };

  return (
    <MethodologyLayout items={sidebarItems}>
      <SmartBreadcrumbs />
      <h1 className="editorial-page-title">The Civica Index methodology.</h1>
      <div className="editorial-page-meta">
        <span>Beta — methodology in active development</span>
        <span>·</span>
        <span>{lastRevision}</span>
        <span>·</span>
        <span>Cut-over target {cutoverTarget}</span>
      </div>

      <div className="editorial-warning">
        <strong>Beta.</strong> The methodology described on this page
        is in active development. Civica&rsquo;s published scores will
        be republished under these rules at cut-over (target{" "}
        {cutoverTarget}). The empirical factor analysis described in
        §4 has shipped — the dimension weights below are the
        PCA-derived adopted values, documented in detail at{" "}
        <Link href="/civica-index/methodology/pca-appendix">
          /civica-index/methodology/pca-appendix
        </Link>
        . External academic review is still pending.
      </div>

      <p className="meth-abstract">
        The Civica Index measures the quality of governing
        institutions in every country on a 0–100 scale, with explicit
        uncertainty, rank bands, and full transparency on sources. It
        is the scoring layer of Civica Atlas — useful for orientation,
        honestly presented, never oversold as definitive.
      </p>

      {/* Section 1 — Scale (markdown body). Slice ends at the
          next markdown anchor (normalization), since Section 2
          isn't represented in markdown. */}
      <Reveal as="section" className="editorial-section">
        <MarkdownContent
          file="content/methodology-civica-index.md"
          stats={null}
          state={state as unknown as Record<string, unknown>}
          ctx={ctx}
          slice={{ from: "scale", to: "normalization" }}
        />
      </Reveal>

      {/* Section 2 — Dimensions (TSX: bespoke weights bar + dimensions table) */}
      <Reveal as="section" id="dimensions" className="editorial-section">
        <h2>
          <span className="meth-num">Section 2</span>Dimensions
        </h2>
        <p>
          The CI measures{" "}
          <strong>governing institutions and practices</strong> — and
          only those. Material conditions like human development,
          security, and economic stability live on the separate{" "}
          <a href="#conditions">Civica Conditions</a> layer. The{" "}
          {civicaIndex.dimensionCount} governance dimensions:
        </p>

        <div
          className="meth-weights-bar"
          role="img"
          aria-label={`Dimension weight visualization (PCA-derived, adopted ${civicaIndex.lastRevision})`}
        >
          {DIMENSIONS.map((d) => (
            <div
              key={d.label}
              className="meth-weight-slice"
              style={{ background: d.tierVar, flex: d.weight }}
            >
              <strong>{d.weight}%</strong>
              <small>{d.label}</small>
            </div>
          ))}
        </div>

        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Weight</th>
              <th>Primary source</th>
              <th>Secondary / cross-check</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td className="editorial-td-num">{d.weight}%</td>
                <td>{d.primary}</td>
                <td>{d.secondary}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>
          <strong>The weights above are PCA-derived and adopted.</strong>{" "}
          They come from the empirical factor analysis described in §4
          and documented in full at{" "}
          <Link href="/civica-index/methodology/pca-appendix">
            /civica-index/methodology/pca-appendix
          </Link>
          . A fifth dimension — <em>Administrative Capacity</em>,
          drawn from World Bank WGI Government Effectiveness and
          Regulatory Quality — is added if and only if it emerges as
          empirically distinct from Rule of Law in a future re-run of
          that analysis once the WGI indicator is ingested.
        </p>
      </Reveal>

      {/* Sections 3-5 (markdown body): Normalization, Weights, Uncertainty */}
      <Reveal as="section" className="editorial-section">
        <MarkdownContent
          file="content/methodology-civica-index.md"
          stats={null}
          state={state as unknown as Record<string, unknown>}
          ctx={ctx}
          slice={{ from: "normalization", to: "missing" }}
        />
      </Reveal>

      {/* Section 6 — Rank bands (TSX: bespoke band-scale visualization) */}
      <Reveal as="section" id="bands" className="editorial-section">
        <h2>
          <span className="meth-num">Section 6</span>Rank bands
        </h2>
        <p>
          The difference between rank 42 and rank 44 is, in any honest
          reading, nothing — it&rsquo;s well within the uncertainty
          interval of either country. Civica publishes{" "}
          <strong>rank bands</strong> instead of exact ranks as the
          primary presentation:
        </p>

        <div
          className="meth-band-scale"
          role="img"
          aria-label="Six-band interpretation scale (A–F)"
        >
          {BANDS.map((b) => (
            <div
              key={b.letter}
              className="meth-band-cell"
              style={{ background: b.color }}
            >
              <strong>
                {b.letter} · {b.range}
              </strong>
              <small>{b.label}</small>
            </div>
          ))}
        </div>

        <p>
          Country pages display the band prominently: e.g. &ldquo;CI
          72 — Strong (B).&rdquo; Within a band, countries are sorted
          alphabetically or by region rather than by exact integer
          score. The exact integer remains available via the API for
          researchers who want it.
        </p>
      </Reveal>

      {/* Sections 7-13 (markdown body): Missing, Conditions, Gov-type, Pulse, Vintages, Limitations, Citation */}
      <Reveal as="section" className="editorial-section">
        <MarkdownContent
          file="content/methodology-civica-index.md"
          stats={null}
          state={state as unknown as Record<string, unknown>}
          ctx={ctx}
          slice={{ from: "missing" }}
        />
      </Reveal>

      {/* Cite block — placed after the markdown's §13 Citation prose
          per the page's existing structure. The CiteAccordion needs
          to be a TSX component because it's interactive. */}
      <Reveal as="section" className="editorial-section">
        <h3>13.4 · Generate a citation</h3>
        <CiteAccordion
          subject="Civica Atlas Methodology — Civica Index methodology (Beta)"
          pageTitle="Civica Index methodology"
          url="https://civicaatlas.org/civica-index/methodology"
          dataVintage={civicaIndex.lastRevisionIso}
        />
      </Reveal>

      {/* Section 14 — Versioning (TSX: bespoke version-strip + DB-driven
          revision history). Per content-templating audit §3.4. */}
      <Reveal as="section" id="versioning" className="editorial-section">
        <h2>
          <span className="meth-num">Section 14</span>Versioning
        </h2>
        <div className="meth-version-strip">
          <div className="meth-version-cell">
            <div className="meth-version-label">Status</div>
            <div className="meth-version-value">
              {civicaIndex.status === "beta" ? "Beta" : "Stable"}
            </div>
          </div>
          <div className="meth-version-cell">
            <div className="meth-version-label">Last revision</div>
            <div className="meth-version-value">{lastRevision}</div>
          </div>
          <div className="meth-version-cell">
            <div className="meth-version-label">Cut-over target</div>
            <div className="meth-version-value">{cutoverTarget}</div>
          </div>
          <div className="meth-version-cell">
            <div className="meth-version-label">Quarterly update</div>
            <div className="meth-version-value">Mar / Jun / Sep / Dec</div>
          </div>
        </div>
        <p>
          The methodology is versioned: every change to weights,
          sources, or formulas creates a new methodology snapshot.
          Vintages — the actual published scores — are frozen against
          the methodology that produced them. Cited values resolve to
          the original score under its original methodology,
          regardless of how the methodology evolves afterward.
        </p>
        {history.length > 0 && (
          <>
            <h3>Revision history</h3>
            <ul>
              {history.map((h) => (
                <li key={h.id}>
                  <strong>
                    {h.publishedAt ? formatDate(h.publishedAt) : "Snapshot"}
                  </strong>
                  {h.notes ? ` — ${h.notes}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </Reveal>
    </MethodologyLayout>
  );
}
