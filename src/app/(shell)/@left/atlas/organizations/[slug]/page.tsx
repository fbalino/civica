import {
  ORGANIZATIONS,
  ORG_TYPE_ORDER,
  ORG_TYPE_LABEL,
  ORG_TYPE_COLOR,
  getMemberCount,
} from "@/lib/data/international-organizations";
import type { OrgGroup } from "@/components/atlas/organizations";
import { ShellOrgRail } from "@/components/shell/ShellOrgRail";

export default async function OrgLeftSlot({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const groups: OrgGroup[] = ORG_TYPE_ORDER.map((type) => ({
    type,
    label: ORG_TYPE_LABEL[type],
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

  return <ShellOrgRail groups={groups} selectedSlug={slug} />;
}
