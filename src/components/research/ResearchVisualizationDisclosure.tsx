import type { ReactNode } from "react";

import { SourceDot } from "@/components/SourceDot";

export interface ResearchVisualizationSource {
  /** Omit for a Civica-derived method/release that has no single source row. */
  id?: string;
  label: string;
  href?: string;
  retrievedAt: string | Date | null | undefined;
  upstreamVintage?: string | null;
}

export type ResearchVisualizationDataAccess =
  | {
      kind: "download";
      href: string;
      label: string;
    }
  | {
      kind: "withheld";
      reason: string;
      href?: string;
    };

interface ResearchVisualizationDisclosureProps {
  title: string;
  description: string;
  sources: readonly ResearchVisualizationSource[];
  missingData: string;
  dataAccess: ResearchVisualizationDataAccess;
  tableLabel?: string;
  children?: ReactNode;
}

/**
 * The shared reader disclosure for a data-bearing visual. The visual itself
 * still owns its geometry and interactions; this component keeps the adjacent
 * plain-language route to provenance, missingness, native data, and rights
 * explicit and repeatable.
 */
export function ResearchVisualizationDisclosure({
  title,
  description,
  sources,
  missingData,
  dataAccess,
  tableLabel = "Show data table alternative",
  children,
}: ResearchVisualizationDisclosureProps) {
  return (
    <section
      className="research-viz-disclosure"
      aria-label={`${title} data disclosure`}
    >
      <p className="research-viz-disclosure__description">{description}</p>
      <dl className="research-viz-disclosure__facts">
        <div>
          <dt>Source and vintage</dt>
          <dd>
            {sources.map((source, index) => (
              <span key={`${source.id ?? "method"}-${source.label}`}>
                {index > 0 ? "; " : null}
                {source.href ? <a href={source.href}>{source.label}</a> : source.label}{" "}
                {source.id ? (
                  <SourceDot
                    source={source.id}
                    retrievedAt={source.retrievedAt}
                    upstreamVintage={source.upstreamVintage ?? null}
                  />
                ) : null}
                {source.upstreamVintage
                  ? ` · ${source.upstreamVintage}`
                  : " · upstream vintage not recorded"}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Missing-data treatment</dt>
          <dd>{missingData}</dd>
        </div>
        <div>
          <dt>Data access</dt>
          <dd>
            {dataAccess.kind === "download" ? (
              <a href={dataAccess.href} download>
                {dataAccess.label}
              </a>
            ) : (
              <>
                {dataAccess.reason}{" "}
                <a href={dataAccess.href ?? "/licensing#rights-manifest"}>
                  See source-rights policy.
                </a>
              </>
            )}
          </dd>
        </div>
      </dl>
      {children ? (
        <details className="research-viz-disclosure__table">
          <summary>{tableLabel}</summary>
          {children}
        </details>
      ) : null}
    </section>
  );
}
