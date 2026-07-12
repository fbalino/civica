// Shared types for international-organization data shown in the Atlas left
// rail and the InternationalTab. Extracted from AtlasApp.tsx as part of the
// Phase 2.1 decomposition.

export type OrgType = "security" | "regional" | "trade" | "un" | "cultural";

export interface OrgGroupEntry {
  id: string;
  slug: string;
  name: string;
  fullName: string;
  type: OrgType;
  foundedYear: number | null;
  hqCountry: string | null;
  memberCount: number;
}

export interface OrgGroup {
  type: OrgType;
  label: string;
  color: string;
  organizations: OrgGroupEntry[];
}

export interface OrgMember {
  id: string;
  name: string;
  slug: string;
  region: string;
  joinYear: number | null;
  role: string | null;
  inAtlas?: boolean;
  /** ATL-012 — "withdrawn" marks a membership that has formally ended. */
  status?: "current" | "withdrawn";
  /** Year the membership ended, when status is "withdrawn". */
  endYear?: number | null;
}

export interface OrgDetail {
  organization: {
    id: string;
    slug: string;
    name: string;
    fullName: string;
    type: OrgType;
    foundedYear: number | null;
    hqCountry: string | null;
    memberCount: number;
    description: string | null;
    extra: Record<string, unknown> | null;
  };
  members: OrgMember[];
}

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  un: "United Nations & Agencies",
  security: "Security Alliances",
  regional: "Regional Blocs",
  trade: "Trade & Economic",
  cultural: "Cultural & Linguistic",
};

export const ORG_TYPE_COLOR: Record<OrgType, string> = {
  un: "var(--cat-un)",
  security: "var(--cat-security)",
  regional: "var(--cat-regional)",
  trade: "var(--cat-trade)",
  cultural: "var(--cat-cultural)",
};
