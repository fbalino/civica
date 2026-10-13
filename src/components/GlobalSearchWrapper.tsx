import { GlobalSearch } from "./GlobalSearch";

// The header search is mounted in the root layout on every route. It renders
// no country list: the combobox fetches the one shared, content-addressed
// jurisdiction directory asset (derived from the checked CAC-003 artifact)
// the first time a reader uses it, so no page HTML or RSC payload carries the
// list. The list is deploy-frozen: a new or renamed jurisdiction appears after
// the next deploy.
export function GlobalSearchWrapper() {
  return <GlobalSearch />;
}
