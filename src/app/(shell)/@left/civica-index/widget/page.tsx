import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { ShellCountryRail } from "@/components/shell/ShellCountryRail";

export const revalidate = 3600;

export default async function CivicaIndexWidgetLeftSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const slug = typeof sp?.c === "string" ? sp.c : null;
  const { countries } = await loadAtlasData();
  const active = slug ? slugToCountry(slug, countries) : null;

  return (
    <ShellCountryRail
      countries={countries}
      selectedId={active?.id ?? null}
      hrefMode={{ type: "widget" }}
      header={
        <>
          <div className="kicker">Widget gallery</div>
          <div className="title">Pick a country</div>
        </>
      }
    />
  );
}
