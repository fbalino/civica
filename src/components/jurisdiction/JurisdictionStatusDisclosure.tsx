import { ExternalLink } from "lucide-react";

import { Chip } from "@/components/editorial/Pill";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";

function tone(
  type: JurisdictionStatusPresentation["type"],
): "blue" | "sage" | "sand" | "rose" | "neutral" {
  switch (type) {
    case "sovereign_state":
      return "blue";
    case "associated_state":
      return "sage";
    case "dependency_or_territory":
      return "sand";
    case "disputed_or_limited_recognition":
      return "rose";
    case "aggregate_or_special_area":
      return "neutral";
  }
}

export function JurisdictionStatusDisclosure({
  status,
  placement = "surface",
}: {
  status: JurisdictionStatusPresentation;
  placement?: "surface" | "hero";
}) {
  return (
    <details
      className={`jurisdiction-status-disclosure jurisdiction-status-disclosure--${placement}`}
    >
      <summary>
        <Chip variant={tone(status.type)}>{status.label}</Chip>
        <span className="jurisdiction-status-disclosure__hint">
          Scope &amp; sources
        </span>
      </summary>
      <div className="jurisdiction-status-disclosure__panel">
        <p>{status.note}</p>
        {status.administeringJurisdictionIso3 ? (
          <p>
            Administering relationship:{" "}
            <strong>{status.administeringJurisdictionIso3}</strong>
          </p>
        ) : null}
        <p className="jurisdiction-status-disclosure__meta">
          Reviewed {status.reviewedAt} under {status.version}.{" "}
          {status.includeInSovereignStateCounts
            ? "Included in Civica sovereign-state totals."
            : "Excluded from Civica sovereign-state totals."}
        </p>
        <ul>
          {status.sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
                <ExternalLink aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
