import { NextResponse } from "next/server";
import {
  getOrganizationBySlug,
  getMembersOfOrg,
} from "@/lib/data/international-organizations";
import { COUNTRIES } from "@/components/atlas/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const membersRaw = getMembersOfOrg(org.id);
  const members = membersRaw
    .map((m) => {
      const c = COUNTRIES.find((x) => x.id === m.countryId);
      if (!c) return null;
      return {
        id: c.id,
        name: c.name,
        slug: c.slug ?? c.id,
        region: c.region,
        joinYear: m.joinYear,
        role: m.role ?? null,
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
      description: org.description ?? null,
      extra: org.extra ?? null,
    },
    members,
  });
}
