/**
 * Fact source panel view model.
 *
 * Country pages ship only a compact source reference for each reconciled
 * value (`FactSourceRef`). The reconciliation detail a reader sees when a
 * panel opens (evidence relationship, resolver trace, every source row) is
 * built here, on the server, and fetched on demand from
 * `/api/facts/:jurisdictionId/:factKey/panel`. This module owns all panel
 * formatting so the page bundle carries none of it.
 */
import { reconciliation } from "@/lib/content/site-state";
import { growthMethodologyLabel } from "@/lib/data/growth-methodology";
import { parseDataValueStatus } from "@/lib/data/value-state";
import type { FactSourcePanel } from "@/lib/api/contract/fact-source-panel";
import {
  buildFactEvidenceSummary,
  lineageForFactRow,
} from "./fact-evidence-summary";
import { formatPublisherDate, storedPublisherDate } from "./publisher-date";
import type { FactRow, ResolverOutput } from "./types";

/**
 * The compact, always-rendered handle for a reconciled value: enough to draw
 * the source dot and its accessible name, and to request the full panel.
 */
export interface FactSourceRef {
  jurisdictionId: string;
  factKey: string;
  canonicalSourceId: string | null;
  canonicalValueNumeric: number | null;
  /** The canonical row this page rendered; the panel compares against it. */
  canonicalRowId: string | null;
  canonicalRetrievedAt: string | null;
  isDisputed: boolean;
}

export function factSourceRefOf(
  output: ResolverOutput,
  factKey: string = output.factKey,
): FactSourceRef {
  return {
    jurisdictionId: output.jurisdictionId,
    factKey,
    canonicalSourceId: output.canonical?.sourceId ?? null,
    canonicalValueNumeric: output.canonical?.factValueNumeric ?? null,
    canonicalRowId: output.canonical?.id ?? null,
    canonicalRetrievedAt: output.canonical?.retrievedAt ?? null,
    isDisputed: output.isDisputed,
  };
}

const SOURCE_LABELS: Record<string, string> = {
  cia_factbook: "CIA World Factbook",
  wikidata: "Wikidata",
  world_bank: "World Bank",
  imf_weo: "IMF (WEO)",
  un_data: "UN Statistics Division",
  unesco_uis: "UNESCO Institute for Statistics",
  who_gho: "WHO Global Health Observatory",
  oecd_stat: "OECD.Stat",
  fao_faostat: "FAO FAOSTAT",
  iea_data: "International Energy Agency",
  ilo_ilostat: "ILO ILOSTAT",
  eurostat: "Eurostat",
  wto_stats: "WTO Stats",
  vdem: "V-Dem",
  undp_hdi: "UNDP HDR",
};

function sourceLabel(sourceId: string): string {
  return SOURCE_LABELS[sourceId] ?? sourceId;
}

function formatNumeric(v: number, factKey: string): string {
  // Percentages (rate_pct, _pct, _pct_gdp, growth_rate, inflation_rate,
  // and other rate-shaped fact-keys whose envelope.isPercent is true).
  // The `_pct_gdp` fiscal indicators store the raw percentage value
  // (e.g. 55 for 55% of GDP), not a decimal.
  if (
    factKey.endsWith("_pct") ||
    factKey.endsWith("_pct_gdp") ||
    factKey.includes("rate_pct") ||
    factKey === "gdp_real_growth_rate" ||
    factKey === "inflation_rate" ||
    factKey === "population_growth_rate" ||
    factKey === "birth_rate" ||
    factKey === "death_rate" ||
    factKey === "fertility_rate"
  ) {
    return `${v.toFixed(1)}%`;
  }
  if (factKey.includes("usd_billions")) {
    if (v >= 1000) return `$${(v / 1000).toFixed(2)}T`;
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}B`;
  }
  // GDP per capita is a USD figure that should NOT be scaled to T/B/M
  // (always in the $1k–$200k range). Check before the generic `_usd`
  // bucket since per-capita keys also end with `_usd`.
  if (factKey === "gdp_per_capita_usd" || factKey === "gni_per_capita_ppp_usd") {
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  // USD totals (raw dollars) — exports/imports/current account balance/
  // budget/forex reserves. Display with $-sign + B/T scale where useful.
  if (factKey.endsWith("_usd")) {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000_000)
      return `${v < 0 ? "-" : ""}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000)
      return `${v < 0 ? "-" : ""}$${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000)
      return `${v < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
    return `${v < 0 ? "-" : ""}$${abs.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  }
  if (factKey === "population_total" || factKey === "population") {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    return v.toLocaleString();
  }
  return v.toLocaleString();
}

/**
 * Format a single resolver row's value for display. Shared by the factbook
 * structured-section "Civica canonical (reconciled)" leaf and the source
 * panel so the headline row and the panel's first row stay consistent
 * (`~/civica/plan/factbook-multi-year-rendering-v1.md`).
 */
export function formatFactRowValue(row: FactRow, factKey: string): string {
  return formatValue(row, factKey);
}

function formatValue(row: FactRow, factKey: string): string {
  // Prefer the upstream display string when it looks formatted —
  // CIA prose has commas + (year est.) tags that are informative.
  // Wikidata / WB / IMF / Eurostat raw values like "190886311" or
  // "-1.34293072157739" are plain numbers; use the numeric
  // formatter instead. Allow optional leading minus to catch
  // negative growth rates.
  if (row.factValue) {
    const looksRaw = /^-?\d+(\.\d+)?$/.test(row.factValue.trim());
    if (!looksRaw) return row.factValue;
  }
  if (row.factValueNumeric === null) return row.factValue ?? "—";
  return formatNumeric(row.factValueNumeric, factKey);
}

function formatAsOf(row: FactRow): string {
  const publisherDate = storedPublisherDate(row.valueJson);
  if (publisherDate) {
    return `${formatPublisherDate(publisherDate)} (${publisherDate.precision} precision)`;
  }
  if (row.asOf) {
    return new Date(row.asOf).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  }
  if (row.factYear) return String(row.factYear);
  return "—";
}

function buildSourceUrl(row: FactRow): string | null {
  if (row.sourceUrl) return row.sourceUrl;
  if (row.sourceId === "wikidata" && row.wikidataQid && row.wikidataPid) {
    return `https://www.wikidata.org/wiki/${row.wikidataQid}#${row.wikidataPid}`;
  }
  return null;
}

function shouldStackValue(value: string): boolean {
  return value.length > 40;
}

export function buildFactSourcePanel(
  factKey: string,
  resolverOutput: ResolverOutput,
): FactSourcePanel {
  const canonicalId = resolverOutput.canonical?.id ?? null;
  const evidence = buildFactEvidenceSummary(resolverOutput);

  // Order rows: canonical first, then other active, then rejected.
  const ordered = [...resolverOutput.all].sort((a, b) => {
    if (a.id === canonicalId) return -1;
    if (b.id === canonicalId) return 1;
    if (a.status !== b.status) {
      if (a.status === "active") return -1;
      if (b.status === "active") return 1;
    }
    // Most recent retrieved first as final tiebreak.
    return b.retrievedAt.localeCompare(a.retrievedAt);
  });

  return {
    schemaVersion: "fact-source-panel/v1",
    jurisdictionId: resolverOutput.jurisdictionId,
    factKey,
    isDisputed: resolverOutput.isDisputed,
    canonicalId,
    canonicalRetrievedAt: resolverOutput.canonical?.retrievedAt ?? null,
    evidence: {
      posture: evidence.posture,
      heading: evidence.heading,
      explanation: evidence.explanation,
      rationale: evidence.rationale,
    },
    trace: resolverOutput.decisionTrace.map((step) => ({
      code: step.code,
      detail: step.detail,
    })),
    rows: ordered.map((row) => {
      const value = formatValue(row, factKey);
      const lineage = lineageForFactRow(row, factKey);
      return {
        id: row.id,
        sourceLabel: sourceLabel(row.sourceId),
        isCanonical: row.id === canonicalId,
        isRejected: row.status === "rejected",
        isProjected: row.valueType === "projected",
        stackedValue: shouldStackValue(value),
        value,
        valueStatus: parseDataValueStatus(row.valueStatus),
        valueStatusReason: row.valueStatusReason ?? null,
        asOfText: formatAsOf(row),
        vintageLabel: row.upstreamVintageLabel,
        growthBasisLabel: row.growthMethodology
          ? growthMethodologyLabel(row.growthMethodology)
          : null,
        sourceUrl: buildSourceUrl(row),
        statusReason: row.statusReason,
        producingFamily: lineage.familyId,
        relationship: lineage.relationship,
        independentEligible: lineage.independentEligible,
      };
    }),
    methodology: {
      version: reconciliation.version.replace(/-beta$/, ""),
      isBeta: reconciliation.status === "beta",
    },
  };
}
