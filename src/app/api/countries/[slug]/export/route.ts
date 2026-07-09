import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getCountryFacts } from "@/lib/db/queries";
import { checkInMemoryRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import {
  getCanonicalFactsForJurisdiction,
  buildApiProvenanceEntry,
  FACTBOOK_RECONCILIATION_META,
  type ApiProvenanceEntry,
} from "@/lib/factbook/reconcile/api";

// Abuse control: this endpoint streams a full per-country dump and was
// previously unthrottled — a cheap scraping / DoS vector across all 260+
// countries. We bound it with the same per-IP in-memory limiter the public
// /api/v1 routes use. 30 exports / minute / IP sits well above any normal
// "download this country's data" click while stopping a tight scrape loop.
const EXPORT_RATE_LIMIT_MAX = 30;
const EXPORT_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Phase F.4 — provenance map for the bulk export.
 *
 * Mirrors `FACT_FIELDS` in `/api/v1/countries/[code]/route.ts` so the
 * export shares one provenance contract with the public country API.
 * The flat field name (e.g. `population`) matches the back-compat
 * top-level field; the value is the canonical Phase F fact-key
 * (e.g. `population_total`).
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
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Abuse control (see the note above): bound this full-country dump to
  // 30 exports / minute / IP with the same per-IP in-memory limiter the
  // public /api/v1 routes use.
  const { allowed, retryAfterSeconds } = checkInMemoryRateLimit({
    scope: "countries-export",
    key: getRequestIp(req),
    max: EXPORT_RATE_LIMIT_MAX,
    windowMs: EXPORT_RATE_LIMIT_WINDOW_MS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const { slug } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";

  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [facts, canonicalFacts] = await Promise.all([
    getCountryFacts(jurisdiction.id),
    getCanonicalFactsForJurisdiction(jurisdiction.id, Object.values(FACT_FIELDS)),
  ]);

  /**
   * For each flat field, prefer the resolver's canonical value over the
   * legacy `jurisdictions` cache when both exist. The cache is
   * eventually-consistent; the resolver IS the source of truth.
   */
  function resolverValueFor(field: FlatFieldName): {
    text: string | null;
    numeric: number | null;
  } {
    const out = canonicalFacts[FACT_FIELDS[field]];
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

  // Phase F.4 — build provenance block (one entry per flat field with
  // a canonical row). Fields with no canonical row are omitted.
  const provenance: Record<string, ApiProvenanceEntry> = {};
  for (const [flatField, factKey] of Object.entries(FACT_FIELDS) as Array<
    [FlatFieldName, string]
  >) {
    const out = canonicalFacts[factKey];
    if (!out) continue;
    const entry = buildApiProvenanceEntry(factKey, out);
    if (entry) provenance[flatField] = entry;
  }

  const data = {
    name: jurisdiction.name,
    iso2: jurisdiction.iso2,
    iso3: jurisdiction.iso3,
    continent: jurisdiction.continent,
    // ── Reconciled flat fields. Resolver canonical takes precedence
    // over the `jurisdictions` cache; cache is the back-compat
    // fallback for fields the resolver doesn't cover yet. ──
    capital: capitalResolver.text ?? jurisdiction.capital,
    population:
      popResolver.numeric != null
        ? Math.round(popResolver.numeric)
        : jurisdiction.population,
    gdpBillions: gdpResolver.numeric ?? jurisdiction.gdpBillions,
    areaSqKm:
      areaResolver.numeric != null
        ? Math.round(areaResolver.numeric)
        : jurisdiction.areaSqKm,
    languages: languagesResolver.text ?? jurisdiction.languages,
    currency: currencyResolver.text ?? jurisdiction.currency,
    governmentType: jurisdiction.governmentType,
    governmentTypeDetail: jurisdiction.governmentTypeDetail,
    governmentClassification: jurisdiction.governmentClassification ?? null,
    democracyIndex: jurisdiction.democracyIndex,
    // ── Phase F.4 — peer-grouping classifications (new fields). ──
    worldBankRegion: wbRegionResolver.text,
    worldBankIncomeGroup: wbIncomeResolver.text,
    vdemRow: vdemRowResolver.text,
    monarchyStatus: monarchyResolver.text,
    governmentFormDescription: govFormResolver.text,
    facts: facts.map((f) => ({
      category: f.category,
      key: f.factKey,
      value: f.factValue,
      numericValue: f.factValueNumeric,
      unit: f.factUnit,
      year: f.factYear,
    })),
    // ── Phase F.4 — provenance block keyed by flat field name. ──
    provenance,
  };

  if (format === "csv") {
    const header = "category,key,value,numeric_value,unit,year";
    const rows = data.facts.map((f) =>
      [f.category, f.key, `"${(f.value ?? "").replace(/"/g, '""')}"`, f.numericValue ?? "", f.unit ?? "", f.year ?? ""].join(",")
    );
    // CSV consumers can't carry the structured provenance block, but we
    // still cite the reconciliation methodology + vintage in a comment
    // header so the export is self-describing when opened in a text
    // editor or imported into a research tool.
    // PUBLIC_CLAIM: export.full-provenance
    const citation = [
      `# Civica Atlas country export — ${jurisdiction.name}`,
      `# Reconciliation: ${FACTBOOK_RECONCILIATION_META.status} ${FACTBOOK_RECONCILIATION_META.version}`,
      `# Vintage: ${FACTBOOK_RECONCILIATION_META.vintage}`,
      `# Methodology: ${FACTBOOK_RECONCILIATION_META.reference}`,
      `# For full per-fact provenance, request format=json.`,
    ].join("\n");
    const csv = [citation, header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${slug}-data.csv"`,
      },
    });
  }

  // ── Back-compat: keep flat top-level fields. `provenance` and
  // `meta` are additive siblings so existing consumers reading
  // `data.population` etc. continue to work unchanged. ──
  return NextResponse.json(
    {
      ...data,
      meta: {
        reconciliation: FACTBOOK_RECONCILIATION_META,
      },
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="${slug}-data.json"`,
      },
    }
  );
}
