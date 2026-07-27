import {
  classifyJurisdictionStatus,
  JURISDICTION_STATUS_DISPLAY_POLICY,
  JURISDICTION_STATUS_SOURCES,
  JURISDICTION_STATUS_TYPES,
  JURISDICTION_STATUS_VERSION,
  type JurisdictionStatusSourceId,
  type JurisdictionStatusType,
} from "./status-taxonomy";

export type JurisdictionStatusSourceLink = {
  id: JurisdictionStatusSourceId;
  label: string;
  url: string;
};

export type JurisdictionStatusPresentation = {
  version: typeof JURISDICTION_STATUS_VERSION;
  type: JurisdictionStatusType;
  label: string;
  note: string;
  reviewedAt: string;
  administeringJurisdictionIso3: string | null;
  disputed: boolean;
  includeInSovereignStateCounts: boolean;
  sources: JurisdictionStatusSourceLink[];
};

export type JurisdictionStatusInput = {
  slug: string;
  iso3: string | null;
  type: string;
  statusSourceIds: string[];
  statusReviewedAt: string;
  statusNote: string;
  administeringJurisdictionIso3: string | null;
  statusDisputed: boolean;
};

function isStatusType(value: string): value is JurisdictionStatusType {
  return (JURISDICTION_STATUS_TYPES as readonly string[]).includes(value);
}

function sourceLink(id: string): JurisdictionStatusSourceLink {
  if (!(id in JURISDICTION_STATUS_SOURCES)) {
    throw new Error(`Unknown jurisdiction-status source: ${id}`);
  }
  const sourceId = id as JurisdictionStatusSourceId;
  const source = JURISDICTION_STATUS_SOURCES[sourceId];
  return { id: sourceId, label: source.label, url: source.url };
}

export function buildJurisdictionStatusPresentation(
  input: JurisdictionStatusInput,
): JurisdictionStatusPresentation {
  if (!isStatusType(input.type)) {
    throw new Error(`Unknown jurisdiction-status type: ${input.type}`);
  }
  if (!input.statusNote.trim()) {
    throw new Error("Jurisdiction status note is required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.statusReviewedAt)) {
    throw new Error("Jurisdiction status review date must be YYYY-MM-DD");
  }
  if (input.statusSourceIds.length === 0) {
    throw new Error("Jurisdiction status requires at least one source");
  }

  const canonical = classifyJurisdictionStatus({
    slug: input.slug,
    iso3: input.iso3,
    dependencyStatus: input.statusNote,
  });
  if (canonical.type !== input.type) {
    throw new Error(
      `Stored jurisdiction status ${input.type} disagrees with ${canonical.type} for ${input.slug}`,
    );
  }
  if (
    canonical.administeringJurisdictionIso3 !==
      input.administeringJurisdictionIso3 ||
    canonical.disputed !== input.statusDisputed
  ) {
    throw new Error(
      `Stored jurisdiction status details drifted for ${input.slug}`,
    );
  }

  return {
    version: JURISDICTION_STATUS_VERSION,
    type: input.type,
    label: canonical.displayLabel,
    note: input.statusNote,
    reviewedAt: input.statusReviewedAt,
    administeringJurisdictionIso3: input.administeringJurisdictionIso3,
    disputed: input.statusDisputed,
    includeInSovereignStateCounts:
      JURISDICTION_STATUS_DISPLAY_POLICY[input.type]
        .includeInSovereignStateCounts,
    sources: [...new Set(input.statusSourceIds)].map(sourceLink),
  };
}
