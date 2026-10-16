import type { FactSourcePanel } from "@/lib/api/contract/fact-source-panel";
import type { FactSourceRef } from "./fact-panel-model";

/**
 * Pages are cached and rebuilt nightly, while the source panel is read live
 * when opened. The panel is current when it describes the same canonical row,
 * retrieved at the same time, as the value the page rendered beside the dot.
 * Otherwise the reader is told the record changed after the page was built.
 */
export function factPanelMatchesPage(
  rendered: Pick<FactSourceRef, "canonicalRowId" | "canonicalRetrievedAt">,
  panel: Pick<FactSourcePanel, "canonicalId" | "canonicalRetrievedAt">,
): boolean {
  return (
    rendered.canonicalRowId === panel.canonicalId &&
    rendered.canonicalRetrievedAt === panel.canonicalRetrievedAt
  );
}
