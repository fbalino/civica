import { AskCivicaPanel } from "@/components/shell/AskCivicaPanel";
import { CI_INDEX_PROMPTS } from "@/lib/shell/suggested-prompts";

/**
 * Right-pane chat for /civica-index. apiContext names the mode so the
 * model knows the user is looking at the ranked index, not a specific
 * country. No house here — house is strictly a Chamber-tab concern.
 */
export default function CivicaIndexRight() {
  return (
    <AskCivicaPanel
      title="Ask Civica · Index"
      subtitle="AI · Rankings"
      suggestions={CI_INDEX_PROMPTS}
      inputPlaceholder="Ask about the Civica Index…"
      messageLead="About the Civica Index"
      apiContext={{ mode: "civica-index" }}
      listenForExternalAsk
    />
  );
}
