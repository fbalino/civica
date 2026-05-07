import { AskCivicaPanel } from "@/components/shell/AskCivicaPanel";
import { WIDGET_PROMPTS } from "@/lib/shell/suggested-prompts";

export const revalidate = 3600;

export default function CivicaIndexWidgetRight() {
  return (
    <AskCivicaPanel
      title="Ask Civica · Widgets"
      subtitle="AI · Embeds"
      suggestions={WIDGET_PROMPTS}
      inputPlaceholder="Ask about embedding a Civica widget…"
      messageLead="About the Civica widget"
      apiContext={{ mode: "civica-widget" }}
      threadKey="civica-index:widget"
    />
  );
}
