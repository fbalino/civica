import { AskCivicaPanel } from "@/components/shell/AskCivicaPanel";
import { ATLAS_MAP_PROMPTS } from "@/lib/shell/suggested-prompts";

/**
 * Right-pane chat for /atlas (map root). No country is selected yet, so
 * the apiContext is minimal — just the mode.
 */
export default function AtlasMapRight() {
  return (
    <AskCivicaPanel
      title="Ask Civica · Atlas"
      suggestions={ATLAS_MAP_PROMPTS}
      inputPlaceholder="Ask about any country on the map…"
      apiContext={{ mode: "atlas-map" }}
      threadKey="atlas:map"
    />
  );
}
