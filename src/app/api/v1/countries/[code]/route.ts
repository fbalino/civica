import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { buildGovernmentClassificationMap } from "@/lib/db/government-taxonomy";
import { getCICountryDetail } from "@/lib/db/queries";
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
import {
  getCanonicalFactsForJurisdiction,
  buildApiProvenanceEntry,
  FACTBOOK_RECONCILIATION_META,
  type ApiProvenanceEntry,
} from "@/lib/factbook/reconcile/api";
import {
  STRUCTURAL_FAMILY_DEPRECATION_META,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";

/**
 * Phase F.4 — public-API provenance map.
 *
 * Each entry maps a flat top-level response field (e.g.
 * `"population"`) to the canonical Phase F fact-key that backs it
 * (e.g. `"population_total"`). The order of this object is the
 * order provenance entries appear in the JSON response.
 *
 * Adding a new reconciled field to the API:
 *   1. Add it here.
 *   2. Read its value into `data` from
 *      `facts[FACT_FIELDS[<flatName>]]?.canonical`.
 *   3. Update API documentation.
 */
const FACT_FIELDS = {
  capital: "capital",
  population: "population_total",
  gdpBillions: "gdp_ppp_usd_billions",
  areaSqKm: "area_total_km2",
  languages: "official_languages",
  currency: "currency_code",
  worldBankRegion: "world_bank_region",
  worldBankIncomeGroup: "world_bank_income_group",
  vdemRow: "vdem_row",
  monarchyStatus: "monarchy_status",
  governmentFormDescription: "government_form_description",
} as const;

type FlatFieldName = keyof typeof FACT_FIELDS;

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
      return withStructuralFamilyDeprecation(
        apiError(`Country not found: ${code}`, 404),
      );
    }
    const classificationMap = await buildGovernmentClassificationMap([country]);

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

    // Phase E — include Civica Index composite + dimensions + Pulse
    // latest in the JSON download so a researcher pulling
    // /api/v1/countries/<slug> gets a comprehensive snapshot.
    let ciDetail: Awaited<ReturnType<typeof getCICountryDetail>> = null;
    try {
      ciDetail = await getCICountryDetail(country.slug);
    } catch {
      /* CI tables may be missing in fresh dev DBs — keep the response
       * useful even when the score subsystem isn't available. */
    }

    // Phase F.4 — resolver-direct fetch for every reconciled fact.
    // One batch query covers all 11 in-scope fact-keys.
    const facts = await getCanonicalFactsForJurisdiction(
      country.id,
      Object.values(FACT_FIELDS)
    );

    /**
     * For each flat field, prefer the resolver's canonical value
     * over the legacy `jurisdictions` cache when both exist. The
     * cache is eventually-consistent; the resolver IS the source
     * of truth.
     */
    function resolverValueFor(field: FlatFieldName): {
      text: string | null;
      numeric: number | null;
    } {
      const out = facts[FACT_FIELDS[field]];
      const row = out?.canonical;
      if (!row) return { text: null, numeric: null };
      return {
        text: row.factValue,
        numeric: row.factValueNumeric,
      };
    }

    const popResolver = resolverValueFor("population");
    const gdpResolver = resolverValueFor("gdpBillions");
    const areaResolver = resolverValueFor("areaSqKm");
    const capitalResolver = resolverValueFor("capital");
    const languagesResolver = resolverValueFor("languages");
    const currencyResolver = resolverValueFor("currency");
    const wbRegionResolver = resolverValueFor("worldBankRegion");
    const wbIncomeResolver = resolverValueFor("worldBankIncomeGroup");
    const vdemRowResolver = resolverValueFor("vdemRow");
    const monarchyResolver = resolverValueFor("monarchyStatus");
    const govFormResolver = resolverValueFor("governmentFormDescription");

    /**
     * Build the provenance block — one entry per flat field where
     * the resolver returned a canonical row. Fields with no
     * canonical row (rare; means we have zero sources for that
     * fact) are omitted from `provenance` entirely.
     */
    const provenance: Record<string, ApiProvenanceEntry> = {};
    for (const [flatField, factKey] of Object.entries(FACT_FIELDS) as Array<
      [FlatFieldName, string]
    >) {
      const out = facts[factKey];
      if (!out) continue;
      const entry = buildApiProvenanceEntry(factKey, out);
      if (entry) provenance[flatField] = entry;
    }

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

    return withStructuralFamilyDeprecation(apiResponse({
      data: {
        slug: country.slug,
        name: country.name,
        iso2: country.iso2,
        iso3: country.iso3,
        continent: country.continent,
        // ── Reconciled flat fields. Resolver canonical takes
        // precedence over the `jurisdictions` cache; cache is the
        // back-compat fallback for fields the resolver doesn't
        // cover yet.
        capital: capitalResolver.text ?? country.capital,
        population:
          popResolver.numeric != null
            ? Math.round(popResolver.numeric)
            : country.population,
        gdpBillions: gdpResolver.numeric ?? country.gdpBillions,
        areaSqKm:
          areaResolver.numeric != null
            ? Math.round(areaResolver.numeric)
            : country.areaSqKm,
        languages: languagesResolver.text ?? country.languages,
        currency: currencyResolver.text ?? country.currency,
        democracyIndex: country.democracyIndex,
        // ── Phase F.4 — peer-grouping classifications (new fields).
        worldBankRegion: wbRegionResolver.text,
        worldBankIncomeGroup: wbIncomeResolver.text,
        vdemRow: vdemRowResolver.text,
        monarchyStatus: monarchyResolver.text,
        governmentFormDescription: govFormResolver.text,
        // ── Existing fields ──
        governmentType: country.governmentType,
        governmentTypeDetail: country.governmentTypeDetail,
        governmentClassification: classificationMap.get(country.id) ?? null,
        flagUrl: country.flagUrl,
        constitution: constitutionResults[0] ?? null,
        government: branches,
        civicaIndex: ciDetail
          ? {
              quarter: ciDetail.composite?.quarter ?? null,
              composite: ciDetail.composite
                ? {
                    score: ciDetail.composite.score,
                    rank: ciDetail.composite.rank,
                    totalRanked: ciDetail.composite.totalRanked,
                    isPartial: ciDetail.composite.isPartial,
                  }
                : null,
              dimensions: ciDetail.dimensions.map((d) => ({
                dimension: d.dimension,
                // v2 fixed-bound display score so this snapshot matches
                // the country page + /api/v1/index; the stored
                // normalized_score is the legacy v1 value and doesn't
                // reconcile with the v2 headline.
                normalizedScore:
                  displayDimensionScore(d.rawValue, d.sourceId) ??
                  d.normalizedScore,
                rawValue: d.rawValue,
              })),
            }
          : null,
        civicaPulse: ciDetail?.pulse
          ? {
              scoreDate: ciDetail.pulse.scoreDate,
              pulseScore: ciDetail.pulse.pulseScore,
              ciBaseline: ciDetail.pulse.ciBaseline,
              eventImpact: ciDetail.pulse.eventImpact,
              activeEvents: ciDetail.pulse.activeEvents,
              isLowConfidence: ciDetail.pulse.isLowConfidence,
            }
          : null,
        // ── Phase F.4 — provenance block keyed by flat field ──
        provenance,
      },
      meta: {
        reconciliation: FACTBOOK_RECONCILIATION_META,
        methodology: CI_METHODOLOGY_META,
        ...STRUCTURAL_FAMILY_DEPRECATION_META,
      },
    }));
  } catch (e) {
    console.error("API /v1/countries/[code] error:", e);
    return withStructuralFamilyDeprecation(
      apiError("Internal server error", 500),
    );
  }
}

export async function OPTIONS() {
  return corsOptions();
}
