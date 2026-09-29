import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getLeaderTimeline } from "@/lib/db/queries";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import { publishedTermStartDate } from "@/lib/factbook/cabinet-roster";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors("api/countries/[slug]/leaders", async () => {
    const limited = await enforceRequestRateLimit(
      req,
      getRequestRateLimitPolicy("public-dynamic-read"),
    );
    if (limited) return limited;

    const path = await parsePathContract(params, "jurisdiction-slug-params/v1");
    if (!path.ok) return path.response;
    const { slug } = path.data;
    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) return apiProblem("NOT_FOUND");

    const rawLeaders = await getLeaderTimeline(jurisdiction.id);

    // Deduplicate: group by person+office, keep the term with the earliest start date
    const seen = new Map<string, (typeof rawLeaders)[number]>();
    for (const l of rawLeaders) {
      const key = `${l.personName}::${l.officeName}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, l);
      } else if (l.isCurrent && !existing.isCurrent) {
        seen.set(key, l);
      } else if (
        l.isCurrent === existing.isCurrent &&
        l.startDate &&
        existing.startDate &&
        l.startDate < existing.startDate
      ) {
        seen.set(key, { ...l, endDate: existing.endDate });
      }
    }
    // DAT-037: roster offices are undated listings; a stored date on one is
    // not a tenure date and is never published.
    const leaders = Array.from(seen.values()).map((leader) => ({
      ...leader,
      startDate: publishedTermStartDate(leader.officeType, leader.startDate),
      endDate: publishedTermStartDate(leader.officeType, leader.endDate),
    }));

    return NextResponse.json({
      country: jurisdiction.name,
      leaders,
    });
  });
}
