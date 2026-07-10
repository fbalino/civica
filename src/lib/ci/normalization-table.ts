/**
 * CI normalization transform table — pure derivation layer (CLM-009 §A).
 *
 * The published methodology table ("Dimension | Source | Native scale |
 * Transform to 0–100") is rendered in two places that must never drift:
 * a generated markdown block in `content/methodology-civica-index.md`
 * (via `scripts/generate-ci-normalization-table.ts`) and, potentially, a
 * TSX-rendered table on the methodology page. Both consume this module
 * rather than retyping the transform formula.
 *
 * The transform-formula TEXT is derived deterministically from
 * `normalizationDescriptors()` (nativeMin/nativeMax/isInverted) in
 * `normalize-v2.ts` — the actual production bounds table. Only display
 * metadata that isn't recoverable from those three numbers (the
 * dimension's display label, the source's display name, how many
 * decimal places to render, and a short native-scale annotation like
 * "sum, inverted") is declared here as static row metadata.
 */

import {
  normalizationDescriptor,
  type CISourceId,
} from "@/lib/ci/normalize-v2";
import { V2_DIMENSIONS, V2_DIMENSION_LABELS, type CIDimensionV2 } from "@/lib/ci/dimensions-v2";

const EN_DASH = "–";
const MINUS = "−";
const TIMES = "×";

/** The primary production source_id each headline CI dimension is ingested
 *  from — mirrors the mapping documented in
 *  `src/lib/ci/__tests__/worked-examples.test.ts` ("production
 *  source_id actually written by each dimension's ingestion adapter").
 *  Kept local here (rather than in `dimensions-v2.ts`, which CLM-009
 *  treats as already-satisfied/unowned) since it is display metadata
 *  for this table, not part of the scoring pipeline. */
const HEADLINE_DIMENSION_SOURCE: Record<CIDimensionV2, CISourceId> = {
  democratic_quality: "vdem",
  rule_of_law: "worldbank_wgi",
  freedom_rights: "freedom_house",
  corruption_control: "transparency_intl",
};

/** Display-only metadata per source: the human-readable source name,
 *  how many decimal places its native bounds render with (a source's
 *  raw numeric bounds can't distinguish `0` from `0.0`), and an
 *  optional short annotation appended to the native-scale cell. */
const SOURCE_DISPLAY: Record<
  CISourceId,
  { sourceLabel: string; decimals: number; nativeScaleNote?: string }
> = {
  vdem: { sourceLabel: "V-Dem Liberal Democracy Index", decimals: 1 },
  vdem_polyarchy: { sourceLabel: "V-Dem Polyarchy Index", decimals: 1 },
  vdem_rule: { sourceLabel: "V-Dem Rule of Law Index", decimals: 1 },
  worldbank_wgi: { sourceLabel: "World Bank WGI Rule of Law", decimals: 1 },
  worldbank_wgi_corruption: {
    sourceLabel: "World Bank WGI Control of Corruption",
    decimals: 1,
  },
  transparency_intl: {
    sourceLabel: "Transparency International CPI",
    decimals: 0,
  },
  freedom_house: {
    sourceLabel: "Freedom House (PR + CL, combined)",
    decimals: 0,
    nativeScaleNote: "sum, inverted",
  },
  rsf_press_freedom: {
    sourceLabel: "Reporters Without Borders Press Freedom Index",
    decimals: 0,
  },
  global_peace_index: {
    sourceLabel: "Institute for Economics and Peace, Global Peace Index",
    decimals: 1,
  },
  undp_hdi: { sourceLabel: "UNDP Human Development Index", decimals: 3 },
};

export interface NormalizationTableRow {
  dimensionId: CIDimensionV2;
  dimensionLabel: string;
  sourceId: CISourceId;
  sourceLabel: string;
  nativeScaleLabel: string;
  transformLabel: string;
}

function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/** Trim trailing ".0"/".00" etc. from a formatted multiplier so
 *  "100.0" renders as "100" (matches the published "score × 100"). */
function formatMultiplier(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function formatSigned(value: number, decimals: number): string {
  const sign = value < 0 ? MINUS : "+";
  return `${sign}${formatNumber(Math.abs(value), decimals)}`;
}

function nativeScaleLabel(
  nativeMin: number,
  nativeMax: number,
  decimals: number,
  note: string | undefined,
): string {
  const base =
    nativeMin < 0
      ? `${formatSigned(nativeMin, decimals)} to ${formatSigned(nativeMax, decimals)}`
      : `${formatNumber(nativeMin, decimals)} ${EN_DASH} ${formatNumber(nativeMax, decimals)}`;
  return note ? `${base} (${note})` : base;
}

function transformLabel(
  nativeMin: number,
  nativeMax: number,
  isInverted: boolean,
  decimals: number,
): string {
  const range = nativeMax - nativeMin;
  const rangeFmt = formatNumber(range, decimals);

  if (isInverted) {
    const maxFmt = formatNumber(nativeMax, decimals);
    return `((${maxFmt} ${MINUS} score) / ${rangeFmt}) ${TIMES} 100`;
  }

  if (nativeMin === 0 && nativeMax === 100) {
    return "score (already on target scale)";
  }
  if (nativeMin === 0) {
    return `score ${TIMES} ${formatMultiplier(100 / nativeMax)}`;
  }

  const offset = -nativeMin;
  const sign = offset >= 0 ? "+" : MINUS;
  const offsetFmt = formatNumber(Math.abs(offset), decimals);
  return `((score ${sign} ${offsetFmt}) / ${rangeFmt}) ${TIMES} 100`;
}

/**
 * The active source-transform rows. The deployed 2024-Q4 release uses WGI
 * Voice & Accountability only where V-Dem has no row; keeping that
 * substitution here prevents the public methodology from pretending every
 * democratic-quality value is V-Dem.
 */
export function getNormalizationTableRows(): readonly NormalizationTableRow[] {
  const primary = V2_DIMENSIONS.map((dimensionId) => {
    const sourceId = HEADLINE_DIMENSION_SOURCE[dimensionId];
    const descriptor = normalizationDescriptor(sourceId);
    if (!descriptor) {
      throw new Error(
        `normalization-table: no bounds registered for source "${sourceId}" (dimension "${dimensionId}")`,
      );
    }
    const display = SOURCE_DISPLAY[sourceId];
    return {
      dimensionId,
      dimensionLabel: V2_DIMENSION_LABELS[dimensionId],
      sourceId,
      sourceLabel: display.sourceLabel,
      nativeScaleLabel: nativeScaleLabel(
        descriptor.nativeMin,
        descriptor.nativeMax,
        display.decimals,
        display.nativeScaleNote,
      ),
      transformLabel: transformLabel(
        descriptor.nativeMin,
        descriptor.nativeMax,
        descriptor.isInverted,
        display.decimals,
      ),
    };
  });
  const descriptor = normalizationDescriptor("worldbank_wgi");
  if (!descriptor) {
    throw new Error("normalization-table: WGI fallback bounds are missing");
  }
  const display = SOURCE_DISPLAY.worldbank_wgi;
  const fallback: NormalizationTableRow = {
    dimensionId: "democratic_quality",
    dimensionLabel: "Democratic quality (coverage fallback)",
    sourceId: "worldbank_wgi",
    sourceLabel: "World Bank WGI Voice & Accountability",
    nativeScaleLabel: nativeScaleLabel(
      descriptor.nativeMin,
      descriptor.nativeMax,
      display.decimals,
      display.nativeScaleNote,
    ),
    transformLabel: transformLabel(
      descriptor.nativeMin,
      descriptor.nativeMax,
      descriptor.isInverted,
      display.decimals,
    ),
  };
  return [primary[0], fallback, ...primary.slice(1)];
}

/** Render the rows as a GFM markdown table, matching the published
 *  methodology table's column order and header text exactly. */
export function renderNormalizationTableMarkdown(): string {
  const rows = getNormalizationTableRows();
  const header = "| Dimension | Source | Native scale | Transform to 0–100 |";
  const divider = "|---|---|---|---|";
  const body = rows.map(
    (r) =>
      `| ${r.dimensionLabel} | ${r.sourceLabel} | ${r.nativeScaleLabel} | ${r.transformLabel} |`,
  );
  return [header, divider, ...body].join("\n");
}
