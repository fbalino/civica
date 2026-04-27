import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { ShellCountryRail } from "@/components/shell/ShellCountryRail";
import { AtlasLeftModeToggle } from "@/components/shell/AtlasLeftModeToggle";

// Shell @left for the /atlas map root. Unlike /atlas/[slug]/[tab], there's no
// selected country; clicking a row navigates to /atlas/<slug>/chamber.
export default async function AtlasMapLeftSlot() {
  const { countries } = await loadAtlasData();
  return (
    <ShellCountryRail
      countries={countries}
      selectedId={null}
      hrefMode={{ type: "atlas", tab: "chamber" }}
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
