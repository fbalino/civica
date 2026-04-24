import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { ShellCountryRail } from "@/components/shell/ShellCountryRail";

// Reuse the same country-picker rail as /civica-index, but with the
// active country highlighted. No filters on the detail page — they
// belong on the ranked index, not here.
export default async function CivicaIndexCountryLeftSlot({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { countries } = await loadAtlasData();
  const active = slugToCountry(slug, countries);

  return (
    <ShellCountryRail
      countries={countries}
      selectedId={active?.id ?? null}
      hrefMode={{ type: "civica-index" }}
      header={
        <>
          <div className="kicker">Civica Index</div>
          <div className="title">Pick a country</div>
        </>
      }
    />
  );
}
