import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getCountryFacts } from "@/lib/db/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";

  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const facts = await getCountryFacts(jurisdiction.id);

  const data = {
    name: jurisdiction.name,
    iso2: jurisdiction.iso2,
    iso3: jurisdiction.iso3,
    continent: jurisdiction.continent,
    capital: jurisdiction.capital,
    population: jurisdiction.population,
    governmentType: jurisdiction.governmentType,
    governmentTypeDetail: jurisdiction.governmentTypeDetail,
    democracyIndex: jurisdiction.democracyIndex,
    facts: facts.map((f) => ({
      category: f.category,
      key: f.factKey,
      value: f.factValue,
      numericValue: f.factValueNumeric,
      unit: f.factUnit,
      year: f.factYear,
    })),
  };

  if (format === "csv") {
    const header = "category,key,value,numeric_value,unit,year";
    const rows = data.facts.map((f) =>
      [f.category, f.key, `"${(f.value ?? "").replace(/"/g, '""')}"`, f.numericValue ?? "", f.unit ?? "", f.year ?? ""].join(",")
    );
    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${slug}-data.csv"`,
      },
    });
  }

  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="${slug}-data.json"`,
    },
  });
}
