import { notFound } from "next/navigation";
import {
  getOrganizationBySlug,
  getMembersOfOrg,
  getMemberCount,
  getOrgMemberCountryFallback,
  ORG_TYPE_LABEL,
} from "@/lib/data/international-organizations";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { OrgDetailPanel } from "@/components/atlas/OrgDetailPanel";
import type { OrgDetail } from "@/components/atlas/organizations";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  if (!org) return { title: "Organization — Civica" };
  return {
    title: `${org.name} — Atlas — Civica`,
    description: `${org.fullName}. ${ORG_TYPE_LABEL[org.type]}.`,
  };
}

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  if (!org) notFound();

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
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => (a.joinYear ?? 0) - (b.joinYear ?? 0));

  const detail: OrgDetail = {
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
      extra: (org.extra ?? null) as Record<string, unknown> | null,
    },
    members,
  };

  return <OrgDetailPanel detail={detail} countries={countries} />;
}
