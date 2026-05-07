import { AskCivicaPanel } from "@/components/shell/AskCivicaPanel";
import { ATLAS_COUNTRY_PROMPTS } from "@/lib/shell/suggested-prompts";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";

export const revalidate = 3600;

export default async function CivicaIndexCountryRight({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { countries } = await loadAtlasData();
  const match = slugToCountry(slug, countries);
  const countryName = match?.name ?? slug;

  return (
    <AskCivicaPanel
      title={`Ask Civica · ${countryName}`}
      subtitle="AI · Civica Index"
      suggestions={ATLAS_COUNTRY_PROMPTS}
      inputPlaceholder={`Ask about ${countryName}'s score…`}
      messageLead={`About ${countryName} · Civica Index`}
      apiContext={{
        mode: "civica-index-country",
        country: countryName,
        countrySlug: slug,
      }}
      listenForExternalAsk
      threadKey={`civica-index:country:${slug}`}
    />
  );
}
