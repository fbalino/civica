import { NextResponse } from "next/server";
import {
  ORGANIZATIONS,
  ORG_TYPE_ORDER,
  ORG_TYPE_LABEL,
  ORG_TYPE_COLOR,
  getMemberCount,
} from "@/lib/data/international-organizations";

/**
 * GET /api/organizations
 *
 * Returns the organisation index grouped by category, used by the Atlas
 * left-pane when Organisations mode is active.
 */
export async function GET() {
  const groups = ORG_TYPE_ORDER.map((type) => ({
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

  return NextResponse.json({ groups });
}
