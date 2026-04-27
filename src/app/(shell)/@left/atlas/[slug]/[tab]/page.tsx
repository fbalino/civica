import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { ShellCountryRail } from "@/components/shell/ShellCountryRail";
import { AtlasLeftModeToggle } from "@/components/shell/AtlasLeftModeToggle";

export default async function AtlasCountryLeftSlot({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>;
}) {
  const { slug, tab } = await params;
  const { countries } = await loadAtlasData();
  const active = slugToCountry(slug, countries);

  return (
    <ShellCountryRail
      countries={countries}
      selectedId={active?.id ?? null}
      hrefMode={{ type: "atlas", tab }}
      header={
        <>
          <div className="kicker">Atlas</div>
          <div className="title">Pick a country</div>
          <AtlasLeftModeToggle mode="countries" />
        </>
      }
    />
  );
}
