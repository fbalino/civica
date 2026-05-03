import { NextResponse } from "next/server";
import {
  getOrganizationBySlug,
  getMembersOfOrg,
  getMemberCount,
  getOrgMemberCountryFallback,
} from "@/lib/data/international-organizations";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { countries } = await loadAtlasData();
  const membersRaw = getMembersOfOrg(org.id);
  const members = membersRaw
    .map((m) => {
      const c = countries.find((x) => x.id === m.countryId);
      const fallback = c ? null : getOrgMemberCountryFallback(m.countryId);
      if (!c && !fallback) return null;
      return {
        id: c?.id ?? fallback!.id,
        name: c?.name ?? fallback!.name,
        slug: c?.slug ?? fallback!.slug,
        region: c?.region ?? fallback!.region,
        joinYear: m.joinYear,
        role: m.role ?? null,
        inAtlas: !!c,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a!.joinYear ?? 0) - (b!.joinYear ?? 0));

  return NextResponse.json({
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      fullName: org.fullName,
      type: org.type,
      foundedYear: org.foundedYear,
      hqCountry: org.hqCountry ?? null,
      memberCount: getMemberCount(org.id),
      description: org.description ?? null,
      extra: org.extra ?? null,
    },
    members,
  });
}
