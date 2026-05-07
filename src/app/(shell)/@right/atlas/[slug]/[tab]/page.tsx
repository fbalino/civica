import { AskCivicaPanel, type AskCivicaContextChip } from "@/components/shell/AskCivicaPanel";
import { ATLAS_COUNTRY_PROMPTS } from "@/lib/shell/suggested-prompts";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import {
  ATLAS_TAB_LABELS,
  DEFAULT_ATLAS_TAB,
  isAtlasHouse,
  isAtlasTab,
  slugToCountry,
  tabNeedsHouse,
} from "@/lib/atlas/ids";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string; tab: string }>;
  searchParams: Promise<{ house?: string }>;
}

export default async function AtlasCountryRight({
  params,
  searchParams,
}: PageProps) {
  const { slug, tab } = await params;
  const { house: rawHouse } = await searchParams;
  const house = rawHouse && isAtlasHouse(rawHouse) ? rawHouse : "lower";

  const { countries } = await loadAtlasData();
  const match = slugToCountry(slug, countries);
  const countryName = match?.name ?? slug;

  const validTab = isAtlasTab(tab) ? tab : DEFAULT_ATLAS_TAB;
  const tabLabel = ATLAS_TAB_LABELS[validTab];

  // THE HOUSE-CHIP CONTEXT FIX: only include house in the chat's context
  // chips and apiContext when the active tab actually cares about upper /
  // lower (chamber + bills). For country-level tabs like democracy or
  // constitution, the ?house= URL param is still preserved in the URL so
  // returning to Chamber restores the user's choice — but it is NOT
  // plumbed into /api/chat where it would be noise. See
  // .claude/rules/memory-decisions.md (2026-04-24) for the rule.
  const needsHouse = tabNeedsHouse(validTab);
  const houseLabel = house === "upper" ? "Upper" : "Lower";

  const contextChips: AskCivicaContextChip[] = [
    { label: "Country", value: countryName },
    ...(needsHouse ? [{ label: "House", value: houseLabel }] : []),
    { label: "Tab", value: tabLabel },
  ];

  const apiContext: Record<string, unknown> = {
    mode: "atlas-country",
    country: countryName,
    countrySlug: slug,
    tab: validTab,
    ...(needsHouse ? { house } : {}),
  };

  // Title and subtitle are kept minimal — the duplicated "United States ·
  // AI · LEADERS" used to read as redundant noise alongside the context
  // chips below. The chips own the scope label now.
  return (
    <AskCivicaPanel
      title="Ask Civica"
      subtitle="AI"
      contextChips={contextChips}
      suggestions={ATLAS_COUNTRY_PROMPTS}
      inputPlaceholder={`Ask about ${countryName}…`}
      messageLead={`About ${countryName} · ${tabLabel}`}
      apiContext={apiContext}
      listenForExternalAsk
      threadKey={`atlas:country:${slug}`}
    />
  );
}
