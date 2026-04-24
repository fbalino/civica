import Link from "next/link";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { ShellCountryRail } from "@/components/shell/ShellCountryRail";

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
          <Link
            href="/atlas"
            className="back-btn"
            style={{ textDecoration: "none" }}
          >
            ← Atlas map
          </Link>
          <div className="kicker">Atlas</div>
          <div className="title">Pick a country</div>
        </>
      }
    />
  );
}
