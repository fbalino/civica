import { NextResponse } from "next/server";
import {
  getJurisdictionBySlug,
  getGovernmentHierarchy,
} from "@/lib/db/queries";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import {
  isUnlistedRosterOffice,
  publishedTermStartDate,
} from "@/lib/factbook/cabinet-roster";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors("api/countries/[slug]/structure", async () => {
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

    const {
      bodies,
      offices: allOffices,
      currentTerms,
      parties,
    } = await getGovernmentHierarchy(jurisdiction.id);
    // DAT-037: a roster title the latest CIA page no longer lists, with no
    // current holder, is historical rather than a vacant current office.
    const heldOffices = new Set(currentTerms.map((t) => t.term.officeId));
    const offices = allOffices.filter(
      (o) => !isUnlistedRosterOffice(o, heldOffices.has(o.id)),
    );
    const officeTypeById = new Map(allOffices.map((o) => [o.id, o.officeType]));

    return NextResponse.json({
      country: jurisdiction.name,
      bodies: bodies.map((b) => ({
        id: b.id,
        name: b.name,
        branch: b.branch,
        bodyType: b.bodyType,
        chamberType: b.chamberType,
        totalSeats: b.totalSeats,
        hierarchyLevel: b.hierarchyLevel,
        parentBodyId: b.parentBodyId ?? null,
      })),
      offices: offices.map((o) => ({
        id: o.id,
        bodyId: o.bodyId,
        name: o.name,
        officeType: o.officeType,
        reportsToOfficeId: o.reportsToOfficeId ?? null,
      })),
      currentTerms: currentTerms.map((t) => ({
        term: {
          officeId: t.term.officeId,
          partyName: t.term.partyName,
          partyColor: t.term.partyColor,
          startDate: publishedTermStartDate(
            officeTypeById.get(t.term.officeId),
            t.term.startDate,
          ),
          endDate: publishedTermStartDate(
            officeTypeById.get(t.term.officeId),
            t.term.endDate,
          ),
        },
        person: {
          name: t.person.name,
          photoUrl: t.person.photoUrl,
          wikidataQid: t.person.wikidataQid,
        },
      })),
      parties: parties.map((p) => ({
        bodyId: p.bodyId,
        partyName: p.partyName,
        partyColor: p.partyColor,
        seatCount: p.seatCount,
        isRulingCoalition: p.isRulingCoalition,
      })),
    });
  });
}
