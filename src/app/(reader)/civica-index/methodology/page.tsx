import type { Metadata } from "next";
import Link from "next/link";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { Reveal } from "@/components/motion/Reveal";
import { ScorePosition } from "@/components/editorial/ScorePosition";
import {
  getCIMethodology,
} from "@/lib/db/queries";
import { humanizeSectionLabel } from "@/lib/data/humanize-label";
import { civicaIndex, disputeSla, pulse } from "@/lib/content/site-state";
import { dimensionColorVar } from "@/lib/ci/dimension-colors";
import { INDEX_DISPOSITION } from "@/lib/ci/index-disposition";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Civica Index Research Methodology and Disposition",
  description:
    "The source-native Governance Evidence Dashboard is Civica's selected public comparison product. The composite remains versioned research and is not a recommended country ranking.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/methodology" },
};

const SECTIONS = [
  { id: "disposition", num: 0, label: "Current disposition" },
  { id: "scale", num: 1, label: "Scale" },
  { id: "dimensions", num: 2, label: "Dimensions" },
  { id: "normalization", num: 3, label: "Normalization" },
  { id: "weights", num: 4, label: "Weights" },
  { id: "uncertainty", num: 5, label: "Input ranges" },
  { id: "presentation", num: 6, label: "Presentation policy" },
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
  colorVar: string;
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
  Pick<DimensionRow, "primary" | "secondary">
> = {
  democratic_quality: {
    primary: "V-Dem Liberal Democracy Index",
    secondary: "V-Dem Electoral Democracy Index",
  },
  rule_of_law: {
    primary: "World Bank WGI Rule of Law",
    secondary: "V-Dem Rule of Law",
  },
  freedom_rights: {
    primary: "Freedom House (PR + CL combined)",
    secondary: "RSF Press Freedom Index",
  },
  corruption_control: {
    primary: "Transparency International CPI",
    secondary: "World Bank WGI Control of Corruption",
  },
};

const DIMENSIONS: DimensionRow[] = civicaIndex.dimensions.map((d) => ({
  label: d.label,
  weight: Math.round(d.weight * 100),
  colorVar: dimensionColorVar(d.id),
  ...DIMENSION_PRESENTATION[d.id],
}));

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

export default async function MethodologyPage() {
  let methodology: Awaited<ReturnType<typeof getCIMethodology>> | null = null;
  try {
    methodology = await getCIMethodology();
  } catch {
    // DB not seeded
  }

  const lastRevision = methodology?.publishedAt
    ? formatDate(methodology.publishedAt)
    : civicaIndex.lastRevision;
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
        <span>Independent review pending</span>
      </div>

      <div className="editorial-warning">
        <strong>Research status.</strong> The confirmatory tournament has no
        winner. The composite fails the original-measurement test, and its
        current league-table presentation fails the misuse audit. Qualified
        reader and external-review gates remain pending.
      </div>

      <p className="meth-abstract">
        {INDEX_DISPOSITION.publicSummary}
      </p>

      <Reveal as="section" id="disposition" className="editorial-section">
        <h2>
          <span className="meth-num">Current disposition</span>Source-native
          comparison is the public product
        </h2>
        <p>{INDEX_DISPOSITION.publicProduct.claim}</p>
        <p>
          The composite remains available for methods research and exact
          reproduction. It cannot be presented as original measurement or a
          recommended league table. Reconsideration requires the frozen reader
          utility test, a presentation that passes the misuse gate, and renewed
          reliability, coverage, rights, and reproduction checks.
        </p>
        <p>
          <Link href={INDEX_DISPOSITION.publicProduct.route}>
            Open the Governance Evidence Dashboard
          </Link>
          {" · "}
          <Link href="/civica-index/replication">Review research evidence status</Link>
        </p>
      </Reveal>

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
          aria-label={`Historical dimension weights (PCA-informed by the limited 2023 cross-section, adopted ${civicaIndex.lastRevision})`}
        >
          {DIMENSIONS.map((d) => (
            <div
              key={d.label}
              className="meth-weight-slice"
              style={{ background: d.colorVar, flex: d.weight }}
            >
              <strong>{d.weight}%</strong>
              <small>{d.label}</small>
            </div>
          ))}
        </div>

        <div className="editorial-table-scroll">
          <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Weight</th>
              <th>Primary source</th>
              <th>Candidate cross-check (not currently ingested)</th>
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
        </div>

        <p>
          <strong>The archived Beta weights are PCA-informed.</strong>{" "}
          They were calculated from a {civicaIndex.pca.panelSize}-country
          2023 cross-section, then rounded and adopted for the historical
          Beta formula. The derivation record and its limitations are at{" "}
          <Link href="/civica-index/methodology/pca-appendix">
            /civica-index/methodology/pca-appendix
          </Link>
          . The proposed fifth dimension, <em>Administrative Capacity</em>,
          was not included in that run or the later four-input temporal
          analysis. Civica has made no factor decision about it.
        </p>
      </Reveal>

      {/* Sections 3-5 (markdown body): Normalization, Weights, input ranges */}
      <Reveal as="section" className="editorial-section">
        <MarkdownContent
          file="content/methodology-civica-index.md"
          stats={null}
          state={state as unknown as Record<string, unknown>}
          ctx={ctx}
          slice={{ from: "normalization", to: "missing" }}
        />
      </Reveal>

      {/* Section 6 — presentation policy. */}
      <Reveal as="section" id="presentation" className="editorial-section">
        <h2>
          <span className="meth-num">Section 6</span>Presentation policy
        </h2>
        <p>
          Civica does not publish country letter grades or qualitative score
          labels. Those devices imply a validated categorical verdict that the
          current research-beta methodology cannot support. Country displays,
          APIs, and exports use the numeric estimate and its declared inputs
          without assigning a grade.
        </p>
        <ScorePosition
          value={72}
          label="Illustrative Civica Index estimate"
        />
        <p>
          Current surfaces show the numeric estimate on a neutral 0–100 line.
          Position communicates magnitude only; blue is not a good/bad scale.
          No composite uncertainty band is shown. Every display must identify
          the output as research beta and link back to the source dimensions
          and limitations on this page.
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

      {/* Section 14 — Versioning (TSX: bespoke version strip). */}
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
            <div className="meth-version-label">Independent review</div>
            <div className="meth-version-value">Pending</div>
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
      </Reveal>
    </MethodologyLayout>
  );
}
