import { AskCivicaPanel } from "@/components/shell/AskCivicaPanel";
import { LANDING_PROMPTS } from "@/lib/shell/suggested-prompts";

/**
 * Default right pane — the idle Ask Civica chat. Shown whenever a
 * (shell) route doesn't declare its own @right/page.tsx.
 */
export default function RightDefault() {
  return (
    <AskCivicaPanel
      suggestions={LANDING_PROMPTS}
      inputPlaceholder="Ask anything about world governance…"
      threadKey="landing"
    />
  );
}
