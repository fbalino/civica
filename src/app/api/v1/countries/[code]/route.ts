import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
} from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { buildGovernmentClassificationMap } from "@/lib/db/government-taxonomy";
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
  buildApiDataValueStatus,
  type ApiProvenanceEntry,
  type ApiDataValueStatus,
} from "@/lib/factbook/reconcile/api";
import { withStructuralFamilyDeprecation } from "@/lib/api/deprecation";
import {
  shapeCountryDetail,
  shapeCountryDetailMeta,
} from "@/lib/api/contract/shapes";
import type { zCountryDetail } from "@/lib/api/contract/schemas";
import type { z } from "zod";
import {
  getFrozenFactsForJurisdiction,
  metadataFromResolutions,
  parseAtlasReadSelection,
} from "@/lib/factbook/read-selection";
import { buildJurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";

type CountryDetailGovernment = z.infer<typeof zCountryDetail>["government"];
type CountryDetailBody = CountryDetailGovernment[string][number];

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
  { params }: { params: Promise<{ code: string }> },
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return withStructuralFamilyDeprecation(rateLimited);

  try {
    const parsedSelection = parseAtlasReadSelection(
      new URL(request.url).searchParams.get("as_of"),
    );
    if (!parsedSelection.selection)
      return withStructuralFamilyDeprecation(
        apiError(parsedSelection.error, 400),
      );
    const selection = parsedSelection.selection;
    const { code } = await params;
    const lookup = code.toLowerCase();

    const results = await db
      .select()
      .from(jurisdictions)
      .where(
        sql`(LOWER(${jurisdictions.slug}) = ${lookup} OR LOWER(${jurisdictions.iso2}) = ${lookup} OR LOWER(${jurisdictions.iso3}) = ${lookup})`,
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
    let currentTerms: {
      term: typeof terms.$inferSelect;
      person: typeof persons.$inferSelect;
    }[] = [];
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
          .where(
            sql`${legislatureParties.bodyId} IN ${bodyIds}
              AND ${legislatureParties.isCurrent} = true`,
          )
          .orderBy(desc(legislatureParties.seatCount)),
      ]);

      const officeIds = allOffices.map((o) => o.id);
      if (officeIds.length > 0) {
        currentTerms = await db
          .select({ term: terms, person: persons })
          .from(terms)
          .innerJoin(persons, eq(terms.personId, persons.id))
          .where(
            sql`${terms.officeId} IN ${officeIds} AND ${terms.isCurrent} = true`,
          );
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

    // Phase F.4 — resolver-direct fetch for every reconciled fact.
    // One batch query covers all 11 in-scope fact-keys.
    const factKeys = Object.values(FACT_FIELDS);
    const frozen =
      selection.mode === "vintage"
        ? await getFrozenFactsForJurisdiction(
            country.id,
            factKeys,
            selection.asOf,
          )
        : null;
    if (frozen && !frozen.exists)
      return withStructuralFamilyDeprecation(
        apiError(`Unsupported immutable vintage: ${selection.asOf}`, 400),
      );
    const facts =
      frozen?.resolutions ??
      (await getCanonicalFactsForJurisdiction(country.id, factKeys));
    const selectionMetadata = metadataFromResolutions(
      selection,
      facts,
      frozen ?? undefined,
    );
    const liveFallback = selection.mode === "live";

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

    const flatValues: Record<FlatFieldName, string | number | null> = {
      capital: capitalResolver.text ?? (liveFallback ? country.capital : null),
      population:
        popResolver.numeric != null
          ? Math.round(popResolver.numeric)
          : (liveFallback ? country.population : null),
      gdpBillions:
        gdpResolver.numeric ?? (liveFallback ? country.gdpBillions : null),
      areaSqKm:
        areaResolver.numeric != null
          ? Math.round(areaResolver.numeric)
          : liveFallback
            ? country.areaSqKm
            : null,
      languages:
        languagesResolver.text ?? (liveFallback ? country.languages : null),
      currency:
        currencyResolver.text ?? (liveFallback ? country.currency : null),
      worldBankRegion: wbRegionResolver.text,
      worldBankIncomeGroup: wbIncomeResolver.text,
      vdemRow: vdemRowResolver.text,
      monarchyStatus: monarchyResolver.text,
      governmentFormDescription: govFormResolver.text,
    };

    /**
     * Build the provenance block — one entry per flat field where
     * the resolver returned a canonical row. Fields with no
     * canonical row (rare; means we have zero sources for that
     * fact) are omitted from `provenance` entirely.
     */
    const provenance: Record<string, ApiProvenanceEntry> = {};
    const valueStatus: Record<string, ApiDataValueStatus> = {};
    for (const [flatField, factKey] of Object.entries(FACT_FIELDS) as Array<
      [FlatFieldName, string]
    >) {
      const out = facts[factKey];
      valueStatus[flatField] = buildApiDataValueStatus(
        out,
        flatValues[flatField],
      );
      if (!out) continue;
      const entry = buildApiProvenanceEntry(factKey, out);
      if (entry) provenance[flatField] = entry;
    }

    const branches = bodies.reduce<CountryDetailGovernment>((acc, body) => {
      const branch = body.branch ?? "other";
      if (!acc[branch]) acc[branch] = [];

      const bodyOffices = allOffices
        .filter((o) => o.bodyId === body.id)
        .map((office) => {
          const holder = currentTerms.find(
            (t) => t.term.officeId === office.id,
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

      const entry: CountryDetailBody = {
        id: body.id,
        name: body.name,
        type: body.bodyType,
        chamberType: body.chamberType,
        totalSeats: body.totalSeats,
        offices: bodyOffices,
        parties: bodyParties.length > 0 ? bodyParties : undefined,
      };
      acc[branch].push(entry);

      return acc;
    }, {});

    return withStructuralFamilyDeprecation(
      apiResponse({
        data: shapeCountryDetail({
          slug: country.slug,
          name: country.name,
          iso2: country.iso2,
          iso3: country.iso3,
          continent: country.continent,
          // ── Reconciled flat fields. Resolver canonical takes
          // precedence over the `jurisdictions` cache; cache is the
          // back-compat fallback for fields the resolver doesn't
          // cover yet.
          capital: flatValues.capital as string | null,
          population: flatValues.population as number | null,
          gdpBillions: flatValues.gdpBillions as number | null,
          areaSqKm: flatValues.areaSqKm as number | null,
          languages: flatValues.languages as string | null,
          currency: flatValues.currency as string | null,
          democracyIndex: country.democracyIndex,
          // ── Phase F.4 — peer-grouping classifications (new fields).
          worldBankRegion: flatValues.worldBankRegion as string | null,
          worldBankIncomeGroup: flatValues.worldBankIncomeGroup as
            string | null,
          vdemRow: flatValues.vdemRow as string | null,
          monarchyStatus: flatValues.monarchyStatus as string | null,
          governmentFormDescription: flatValues.governmentFormDescription as
            string | null,
          // ── Existing fields ──
          governmentType: country.governmentType,
          governmentTypeDetail: country.governmentTypeDetail,
          governmentClassification: classificationMap.get(country.id) ?? null,
          jurisdictionStatus: buildJurisdictionStatusPresentation(country),
          flagUrl: country.flagUrl,
          constitution: constitutionResults[0] ?? null,
          government: branches,
          // ── Phase F.4 — provenance block keyed by flat field ──
          provenance,
          valueStatus,
        }),
        meta: shapeCountryDetailMeta(selectionMetadata),
      }),
    );
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
