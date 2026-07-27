import { NextResponse } from "next/server";
import {
  ORGANIZATIONS,
  getMembershipsForCountry,
  getCoMembers,
} from "@/lib/data/international-organizations";
import { COUNTRIES } from "@/components/atlas/data";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import {
  ORGANIZATION_MEMBERSHIP_RELEASE_VERSION,
  releaseOrganizationMembership,
} from "@/lib/organizations/membership-release";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";

/**
 * GET /api/countries/[slug]/international
 *
 * The Atlas uses 3-letter country ids (`usa`, `fra`, ...) as slugs in the
 * left-pane list. Accept either a 3-letter id or a jurisdiction slug — the
 * curated dataset is keyed by 3-letter id today.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors("api/countries/[slug]/international", async () => {
    const limited = await enforceRequestRateLimit(
      req,
      getRequestRateLimitPolicy("public-dynamic-read"),
    );
    if (limited) return limited;

    const path = await parsePathContract(params, "jurisdiction-slug-params/v1");
    if (!path.ok) return path.response;
    const { slug } = path.data;
    const normalized = slug;

    // Match against the Atlas country list first (handles ids + slugs).
    const country =
      COUNTRIES.find((c) => c.id === normalized) ||
      COUNTRIES.find((c) => c.slug === normalized);
    const jurisdiction = country
      ? null
      : await getJurisdictionBySlug(normalized);
    if (!country && !jurisdiction) return apiProblem("NOT_FOUND");
    const countryId =
      country?.id ?? jurisdiction?.iso3?.toLowerCase() ?? normalized;

    const memberships = getMembershipsForCountry(countryId);
    const orgById = new Map(ORGANIZATIONS.map((o) => [o.id, o]));

    const responseMemberships = memberships
      .map((m) => {
        const org = orgById.get(m.orgId);
        if (!org) return null;
        const released = releaseOrganizationMembership(m);
        return {
          orgId: org.id,
          orgSlug: org.slug,
          orgName: org.name,
          orgFullName: org.fullName,
          type: org.type,
          joinYear: released.joinYear,
          role: m.role ?? null,
          // ATL-012 — status/endYear distinguish current from historical
          // (withdrawn) memberships; omitted status means current.
          status: released.status,
          endYear: released.endYear,
          provenance: {
            sourceId: released.sourceId,
            sourceLabel: released.source.label,
            sourceUrl: released.source.url,
            retrievedAt: released.retrievedAt,
            upstreamVintage: released.upstreamVintage,
            license: released.source.license,
            coverage: released.source.coverage,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.joinYear ?? 0) - (b!.joinYear ?? 0));

    const coMembersRaw = getCoMembers(countryId).slice(0, 12);
    const coMembers = coMembersRaw
      .map((cm) => {
        const c = COUNTRIES.find((x) => x.id === cm.countryId);
        if (!c) return null;
        return {
          id: c.id,
          name: c.name,
          slug: c.slug ?? c.id,
          sharedCount: cm.sharedCount,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      country: country?.name ?? jurisdiction?.name ?? countryId.toUpperCase(),
      countryId,
      release: ORGANIZATION_MEMBERSHIP_RELEASE_VERSION,
      memberships: responseMemberships,
      coMembers,
    });
  });
}
