import { AskCivicaPanel } from "@/components/shell/AskCivicaPanel";
import { COMPARE_PROMPTS } from "@/lib/shell/suggested-prompts";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";

export const revalidate = 3600;

/**
 * Right pane for the in-atlas compare route. Ask Civica is scoped to the
 * two countries currently selected via ?a= / ?b= search params, so the
 * apiContext lets the model speak about both sides at once.
 */
export default async function AtlasCompareRightSlot({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const sp = await searchParams;
  const { countries } = await loadAtlasData();
  const aId = sp.a && countries.find((c) => c.id === sp.a || c.slug === sp.a)
    ? countries.find((c) => c.id === sp.a || c.slug === sp.a)!.id
    : "fra";
  const bId = sp.b && countries.find((c) => c.id === sp.b || c.slug === sp.b)
    ? countries.find((c) => c.id === sp.b || c.slug === sp.b)!.id
    : "usa";
  const aName = countries.find((c) => c.id === aId)?.name ?? aId;
  const bName = countries.find((c) => c.id === bId)?.name ?? bId;

  return (
    <AskCivicaPanel
      title="Ask Civica · Compare"
      suggestions={COMPARE_PROMPTS}
      inputPlaceholder={`Ask about ${aName} vs ${bName}…`}
      apiContext={{
        mode: "atlas-compare",
        countryA: aName,
        countryB: bName,
      }}
      threadKey={`atlas:compare:${aId}:${bId}`}
    />
  );
}
