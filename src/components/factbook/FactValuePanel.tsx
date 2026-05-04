/**
 * Phase F.4 — Alternate-values panel content.
 *
 * Renders the table of all source rows the resolver received for a
 * given (jurisdiction, fact_key), with the canonical pick
 * highlighted. Pure presentational component — takes a
 * `ResolverOutput` and renders. Pairs with `<FactValueDot>` which
 * manages the popover open/close state.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §6.2
 * Plan:        ~/civica/plan/phase-f-implementation-plan.md F.4
 */
import Link from "next/link";
import type { FactRow, ResolverOutput } from "@/lib/factbook/reconcile/types";

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
  if (factKey.endsWith("_pct") || factKey.includes("rate_pct")) {
    return `${v.toFixed(1)}%`;
  }
  if (factKey.includes("usd_billions")) {
    if (v >= 1000) return `$${(v / 1000).toFixed(2)}T`;
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}B`;
  }
  if (factKey === "population_total" || factKey === "population") {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    return v.toLocaleString();
  }
  return v.toLocaleString();
}

function formatValue(row: FactRow, factKey: string): string {
  // Prefer the upstream display string when it looks formatted —
  // CIA prose has commas + (year est.) tags that are informative.
  // Wikidata raw values like "190886311" are plain integers; use
  // the numeric formatter instead.
  if (row.factValue) {
    const looksRaw = /^\d+(\.\d+)?$/.test(row.factValue.trim());
    if (!looksRaw) return row.factValue;
  }
  if (row.factValueNumeric === null) return row.factValue ?? "—";
  return formatNumeric(row.factValueNumeric, factKey);
}

function formatAsOf(row: FactRow): string {
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

export interface FactValuePanelProps {
  factKey: string;
  factLabel: string;
  resolverOutput: ResolverOutput;
  /** When true, panel renders a dispute banner. */
  disputed?: boolean;
}

export function FactValuePanel({
  factKey,
  factLabel,
  resolverOutput,
  disputed,
}: FactValuePanelProps) {
  const isDisputed = disputed ?? resolverOutput.isDisputed;
  const canonicalId = resolverOutput.canonical?.id ?? null;

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

  return (
    <div className="fact-value-panel" role="dialog" aria-label={`${factLabel} sources`}>
      <header className="fact-value-panel-head">
        <h3 className="fact-value-panel-title">{factLabel}</h3>
        <span className="fact-value-panel-fact-key">{factKey}</span>
      </header>

      {isDisputed && (
        <div className="fact-value-disputed-banner">
          <strong>This fact has a pending data dispute.</strong>{" "}
          The value below is the prior canonical value while
          reviewers investigate the conflict. See the{" "}
          <Link href="/factbook/methodology/reconciliation#disputes">
            methodology
          </Link>{" "}
          for what this means.
        </div>
      )}

      <ul className="fact-value-rows">
        {ordered.map((row) => {
          const isCanonical = row.id === canonicalId;
          const url = buildSourceUrl(row);
          const isRejected = row.status === "rejected";
          const value = formatValue(row, factKey);
          return (
            <li
              key={row.id}
              className={
                "fact-value-row" +
                (isCanonical ? " fact-value-row--canonical" : "") +
                (isRejected ? " fact-value-row--rejected" : "") +
                (shouldStackValue(value) ? " fact-value-row--stacked-value" : "")
              }
            >
              <div className="fact-value-row-source-block">
                <div className="fact-value-row-source">
                  {sourceLabel(row.sourceId)}
                </div>
                {isCanonical && (
                  <span className="fact-value-row-canonical-tag">
                    Civica pick
                  </span>
                )}
                {isRejected && (
                  <span className="fact-value-row-status">
                    rejected
                  </span>
                )}
              </div>
              <div className="fact-value-row-value">
                {value}
              </div>
              <div className="fact-value-row-meta">
                As of {formatAsOf(row)}
                {row.upstreamVintageLabel
                  ? ` · ${row.upstreamVintageLabel}`
                  : ""}
                {url ? (
                  <>
                    {" · "}
                    <a href={url} target="_blank" rel="noreferrer noopener">
                      Source
                    </a>
                  </>
                ) : null}
                {isRejected && row.statusReason ? (
                  <> · {row.statusReason}</>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="fact-value-panel-foot">
        <span className="fact-value-panel-foot-cite">
          Reconciled per Civica Atlas methodology v0.1
          <span className="fact-value-panel-foot-beta">Beta</span>
        </span>
        <Link
          className="fact-value-panel-foot-link"
          href="/factbook/methodology/reconciliation"
        >
          Methodology →
        </Link>
      </footer>
    </div>
  );
}
