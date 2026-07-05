import { notFound } from "next/navigation";
import {
  getOrganizationBySlug,
  getMembersOfOrg,
  getMemberCount,
  getOrgMemberCountryFallback,
  ORGANIZATIONS,
  ORG_TYPE_ORDER,
  ORG_TYPE_LABEL,
} from "@/lib/data/international-organizations";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { OrgDetailPanel } from "@/components/atlas/OrgDetailPanel";
import { OrganizationsNav } from "@/components/atlas/OrganizationsNav";
import {
  ORG_TYPE_LABEL as ORG_GROUP_LABEL,
  ORG_TYPE_COLOR,
} from "@/components/atlas/organizations";
import type { OrgDetail, OrgGroup } from "@/components/atlas/organizations";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  if (!org) return { title: "Organization Not Found" };
  const title = `${org.name} — ${ORG_TYPE_LABEL[org.type]}`;
  const description = `${org.fullName}: ${ORG_TYPE_LABEL[org.type].toLowerCase()} profile with membership map, regional breakdown, and full member list on Civica Atlas.`;
  return {
    title,
    description,
    alternates: {
      canonical: `https://civicaatlas.org/organizations/${org.slug}`,
    },
    openGraph: withOg({
      title: `${title} · Civica Atlas`,
      description,
      url: `https://civicaatlas.org/organizations/${org.slug}`,
    }),
  };
}

// Standalone /organizations/[slug] reader page (Option B, Phase 2): moved out
// of the three-pane shell. Renders an in-page org picker + the OrgDetailPanel
// (masthead, member map, regional breakdown, member list) full-width.
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

  const groups: OrgGroup[] = ORG_TYPE_ORDER.map((type) => ({
    type,
    label: ORG_GROUP_LABEL[type],
    color: ORG_TYPE_COLOR[type],
    organizations: ORGANIZATIONS.filter((o) => o.type === type).map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      fullName: o.fullName,
      type: o.type,
      foundedYear: o.foundedYear,
      hqCountry: o.hqCountry ?? null,
      memberCount: getMemberCount(o.id),
    })),
  }));

  return (
    <div className="org-standalone">
      <aside className="org-standalone__sidebar" aria-label="Organization picker">
        <div className="org-standalone__sidebar-head">
          <div className="kicker">Atlas</div>
          <div className="title">Organizations</div>
        </div>
        <OrganizationsNav groups={groups} selectedSlug={slug} />
      </aside>
      <div className="org-standalone__detail">
        <OrgDetailPanel detail={detail} countries={countries} />
      </div>
    </div>
  );
}
