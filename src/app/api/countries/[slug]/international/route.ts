import { NextResponse } from "next/server";
import {
  ORGANIZATIONS,
  getMembershipsForCountry,
  getCoMembers,
} from "@/lib/data/international-organizations";
import { COUNTRIES } from "@/components/atlas/data";
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/countries/[slug]/international
 *
 * The Atlas uses 3-letter country ids (`usa`, `fra`, ...) as slugs in the
 * left-pane list. Accept either a 3-letter id or a jurisdiction slug — the
 * curated dataset is keyed by 3-letter id today.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = enforceInMemoryRateLimit(req, {
    scope: "countries-international",
  });
  if (limited) return limited;

  const { slug } = await params;
  const normalized = slug.toLowerCase();

  // Match against the Atlas country list first (handles ids + slugs).
  const country =
    COUNTRIES.find((c) => c.id === normalized) ||
    COUNTRIES.find((c) => c.slug === normalized);
  const countryId = country?.id ?? normalized;

  const memberships = getMembershipsForCountry(countryId);
  const orgById = new Map(ORGANIZATIONS.map((o) => [o.id, o]));

  const responseMemberships = memberships
    .map((m) => {
      const org = orgById.get(m.orgId);
      if (!org) return null;
      return {
        orgId: org.id,
        orgSlug: org.slug,
        orgName: org.name,
        orgFullName: org.fullName,
        type: org.type,
        joinYear: m.joinYear,
        role: m.role ?? null,
        // ATL-012 — status/endYear distinguish current from historical
        // (withdrawn) memberships; omitted status means current.
        status: m.status ?? "current",
        endYear: m.endYear ?? null,
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
    country: country?.name ?? countryId.toUpperCase(),
    countryId,
    memberships: responseMemberships,
    coMembers,
  });
}
