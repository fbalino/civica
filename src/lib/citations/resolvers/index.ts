/**
 * ATL-019 — the closed entityType -> resolver dispatch table, shared by the
 * API route (`src/app/api/citations/[entityType]/[id]/route.ts`) and the
 * live validator (`scripts/validate-stable-identifiers.ts --live`).
 */
import type { EntityCitation, EntityType } from "@/lib/citations/stable-identity";
import { resolveConstitutionPassageCitation } from "./constitution-passage";
import { resolveElectionCitation } from "./election";
import { resolveFactCitation } from "./fact";
import { resolveIndicatorCitation } from "./indicator";
import { resolveInstitutionCitation } from "./institution";
import { resolveOfficeCitation } from "./office";
import { resolveOrganizationCitation } from "./organization";
import { resolvePersonCitation } from "./person";

export type EntityCitationResolver = (
  id: string,
) => Promise<EntityCitation | null>;

export const ENTITY_CITATION_RESOLVERS: Record<
  EntityType,
  EntityCitationResolver
> = {
  fact: resolveFactCitation,
  institution: resolveInstitutionCitation,
  office: resolveOfficeCitation,
  person: resolvePersonCitation,
  election: resolveElectionCitation,
  "constitution-passage": resolveConstitutionPassageCitation,
  organization: resolveOrganizationCitation,
  indicator: resolveIndicatorCitation,
};

export {
  resolveConstitutionPassageCitation,
  resolveElectionCitation,
  resolveFactCitation,
  resolveIndicatorCitation,
  resolveInstitutionCitation,
  resolveOfficeCitation,
  resolveOrganizationCitation,
  resolvePersonCitation,
};
