"use client";

/**
 * Phase F.4 — Alternate-values panel content.
 *
 * Renders the table of all source rows the resolver received for a
 * given (jurisdiction, fact_key), with the canonical pick
 * highlighted. Presentational: takes the server-built
 * `FactSourcePanel` view model (fetched when the panel opens, see
 * `useFactSourcePanel`) and renders it. Pairs with `<FactValueDot>`
 * which manages the popover open/close state.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §6.2
 * Plan:        ~/civica/plan/phase-f-implementation-plan.md F.4
 */
import Link from "next/link";
import { DataValueState } from "@/components/DataValueState";
import { AtlasChangeHistoryDisclosure } from "@/components/atlas/AtlasChangeHistoryDisclosure";
import { Button } from "@/components/editorial/Button";
import type { FactSourcePanel } from "@/lib/api/contract/fact-source-panel";

export type FactValuePanelState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; panel: FactSourcePanel };

export interface FactValuePanelProps {
  factKey: string;
  factLabel: string;
  state: FactValuePanelState;
  onRetry: () => void;
}

export function FactValuePanel({
  factKey,
  factLabel,
  state,
  onRetry,
}: FactValuePanelProps) {
  const header = (
    <header className="fact-value-panel-head">
      <h3 className="fact-value-panel-title">{factLabel}</h3>
      <span className="fact-value-panel-fact-key">{factKey}</span>
    </header>
  );

  if (state.status !== "ready") {
    return (
      <div
        className="fact-value-panel"
        role="dialog"
        aria-label={`${factLabel} sources`}
        aria-busy={state.status === "loading"}
      >
        {header}
        {state.status === "loading" ? (
          <p className="fact-value-panel-status" role="status">
            Loading sources…
          </p>
        ) : (
          <div className="fact-value-panel-status" role="alert">
            <p>The source details could not be loaded.</p>
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { panel } = state;
  const { evidence } = panel;

  return (
    <div className="fact-value-panel" role="dialog" aria-label={`${factLabel} sources`}>
      {header}

      {panel.isDisputed && (
        <div className="fact-value-disputed-banner">
          <strong>This fact has a pending data dispute.</strong>{" "}
          The value below is the prior canonical value while
          reviewers investigate the conflict. See the{" "}
          <Link href="/country/methodology/reconciliation#disputes">
            methodology
          </Link>{" "}
          for what this means.
        </div>
      )}

      <section
        className={`fact-value-evidence fact-value-evidence--${evidence.posture}`}
        aria-label="Evidence relationship"
      >
        <strong>{evidence.heading}</strong>
        <p>{evidence.explanation}</p>
        <p className="fact-value-evidence-rationale">
          <span>Why this value:</span> {evidence.rationale}
        </p>
        {panel.trace.length > 0 ? (
          <details className="fact-value-decision-trace">
            <summary>Show the complete resolver trace</summary>
            <ol>
              {panel.trace.map((step) => (
                <li key={step.code}>
                  <strong>{step.code.replaceAll("_", " ")}</strong>
                  <span>{step.detail}</span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </section>

      <ul className="fact-value-rows">
        {panel.rows.map((row) => (
          <li
            key={row.id}
            className={
              "fact-value-row" +
              (row.isCanonical ? " fact-value-row--canonical" : "") +
              (row.isRejected ? " fact-value-row--rejected" : "") +
              (row.isProjected ? " fact-value-row--projected" : "") +
              (row.stackedValue ? " fact-value-row--stacked-value" : "")
            }
          >
            <div className="fact-value-row-source-block">
              <div className="fact-value-row-source">{row.sourceLabel}</div>
              {row.isCanonical && (
                <span className="fact-value-row-canonical-tag">
                  Civica pick
                </span>
              )}
              {row.isRejected && (
                <span className="fact-value-row-status">rejected</span>
              )}
              {row.isProjected && (
                <span className="fact-value-row-projected-tag">Projected</span>
              )}
            </div>
            <div className="fact-value-row-value">
              <DataValueState
                status={row.valueStatus}
                reason={row.valueStatusReason}
              >
                {row.value}
              </DataValueState>
            </div>
            <div className="fact-value-row-meta">
              As of {row.asOfText}
              {row.vintageLabel ? ` · ${row.vintageLabel}` : ""}
              {/* Growth basis (non-null only on growth fact-keys) —
                  disclosed on EVERY row so a reader comparing, e.g.,
                  Stats SA's quarter-on-quarter figure against the World
                  Bank's annual one can see they sit on different bases.
                  This is what the methodology page means by "the full
                  basis is recorded in the alternates panel." */}
              {row.growthBasisLabel ? ` · ${row.growthBasisLabel}` : ""}
              {row.sourceUrl ? (
                <>
                  {" · "}
                  <a href={row.sourceUrl} target="_blank" rel="noreferrer noopener">
                    Source
                  </a>
                </>
              ) : null}
              {row.isRejected && row.statusReason ? (
                <> · {row.statusReason}</>
              ) : null}
              <span className="fact-value-row-lineage">
                Producing family: {row.producingFamily.replaceAll("_", " ")} ·{" "}
                {row.relationship}
                {!row.independentEligible
                  ? " · not counted as independent evidence"
                  : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {panel.canonicalId ? (
        <AtlasChangeHistoryDisclosure
          entityType="fact"
          entityId={panel.canonicalId}
        />
      ) : null}

      <footer className="fact-value-panel-foot">
        <span className="fact-value-panel-foot-cite">
          Reconciled per Civica Atlas methodology {panel.methodology.version}
          {panel.methodology.isBeta ? (
            <span className="fact-value-panel-foot-beta">Beta</span>
          ) : null}
        </span>
        <Link
          className="fact-value-panel-foot-link"
          href="/country/methodology/reconciliation"
        >
          Methodology →
        </Link>
      </footer>
    </div>
  );
}
