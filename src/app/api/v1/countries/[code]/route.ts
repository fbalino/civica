import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import {
  jurisdictions,
  governmentBodies,
  offices,
  terms,
  persons,
  legislatureParties,
  constitutions,
} from "@/lib/db/schema";
import { eq, sql, asc, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { code } = await params;
    const lookup = code.toLowerCase();

    const results = await db
      .select()
      .from(jurisdictions)
      .where(
        sql`(LOWER(${jurisdictions.slug}) = ${lookup} OR LOWER(${jurisdictions.iso2}) = ${lookup} OR LOWER(${jurisdictions.iso3}) = ${lookup})`
      )
      .limit(1);

    const country = results[0];
    if (!country) {
      return apiError(`Country not found: ${code}`, 404);
    }

    const bodies = await db
      .select()
      .from(governmentBodies)
      .where(eq(governmentBodies.jurisdictionId, country.id))
      .orderBy(asc(governmentBodies.hierarchyLevel));

    const bodyIds = bodies.map((b) => b.id);

    let allOffices: (typeof offices.$inferSelect)[] = [];
    let currentTerms: { term: typeof terms.$inferSelect; person: typeof persons.$inferSelect }[] = [];
    let parties: (typeof legislatureParties.$inferSelect)[] = [];

    if (bodyIds.length > 0) {
      [allOffices, parties] = await Promise.all([
        db
          .select()
          .from(offices)
          .where(sql`${offices.bodyId} IN ${bodyIds}`),
        db
          .select()
          .from(legislatureParties)
          .where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)
          .orderBy(desc(legislatureParties.seatCount)),
      ]);

      const officeIds = allOffices.map((o) => o.id);
      if (officeIds.length > 0) {
        currentTerms = await db
          .select({ term: terms, person: persons })
          .from(terms)
          .innerJoin(persons, eq(terms.personId, persons.id))
          .where(sql`${terms.officeId} IN ${officeIds} AND ${terms.isCurrent} = true`);
      }
    }

    const constitutionResults = await db
      .select({
        year: constitutions.year,
        yearUpdated: constitutions.yearUpdated,
      })
      .from(constitutions)
      .where(eq(constitutions.jurisdictionId, country.id))
      .limit(1);

    const branches = bodies.reduce(
      (acc, body) => {
        const branch = body.branch ?? "other";
        if (!acc[branch]) acc[branch] = [];

        const bodyOffices = allOffices
          .filter((o) => o.bodyId === body.id)
          .map((office) => {
            const holder = currentTerms.find(
              (t) => t.term.officeId === office.id
            );
            return {
              id: office.id,
              name: office.name,
              type: office.officeType,
              isElected: office.isElected,
              currentHolder: holder
                ? {
                    name: holder.person.name,
                    party: holder.term.partyName,
                    since: holder.term.startDate,
                    photoUrl: holder.person.photoUrl,
                  }
                : null,
            };
          });

        const bodyParties = parties
          .filter((p) => p.bodyId === body.id)
          .map((p) => ({
            name: p.partyName,
            seats: p.seatCount,
            color: p.partyColor,
            isRulingCoalition: p.isRulingCoalition,
          }));

        acc[branch].push({
          id: body.id,
          name: body.name,
          type: body.bodyType,
          chamberType: body.chamberType,
          totalSeats: body.totalSeats,
          offices: bodyOffices,
          parties: bodyParties.length > 0 ? bodyParties : undefined,
        });

        return acc;
      },
      {} as Record<string, unknown[]>
    );

    return apiResponse({
      data: {
        slug: country.slug,
        name: country.name,
        iso2: country.iso2,
        iso3: country.iso3,
        continent: country.continent,
        capital: country.capital,
        population: country.population,
        governmentType: country.governmentType,
        governmentTypeDetail: country.governmentTypeDetail,
        gdpBillions: country.gdpBillions,
        areaSqKm: country.areaSqKm,
        languages: country.languages,
        currency: country.currency,
        democracyIndex: country.democracyIndex,
        flagUrl: country.flagUrl,
        constitution: constitutionResults[0] ?? null,
        government: branches,
      },
    });
  } catch (e) {
    console.error("API /v1/countries/[code] error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
