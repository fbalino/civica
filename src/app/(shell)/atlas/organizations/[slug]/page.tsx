import { notFound } from "next/navigation";
import {
  getOrganizationBySlug,
  getMembersOfOrg,
  ORG_TYPE_LABEL,
} from "@/lib/data/international-organizations";
import { COUNTRIES } from "@/components/atlas/data";
import { OrgDetailPanel } from "@/components/atlas/OrgDetailPanel";
import type { OrgDetail } from "@/components/atlas/organizations";

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
      description: org.description ?? null,
      extra: (org.extra ?? null) as Record<string, unknown> | null,
    },
    members,
  };

  return <OrgDetailPanel detail={detail} countries={COUNTRIES} />;
}
