import type { FactbookCountryOption } from "./FactbookCountrySearch";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";

export type FactbookSidebarItem = ReaderSidebarItem;

interface FactbookSidebarProps {
  items: ReadonlyArray<FactbookSidebarItem>;
  /**
   * Optional in-sidebar country search. The country tab now renders the
   * "jump to country" search immediately above this component in the shared
   * left rail via <CountryJumpSearch>. That field scrolls away and hands off
   * to the sticky bar, so this sticky sidebar omits its own search to avoid
   * two bars at once. Pass `countries` only for standalone reader pages that
   * still want a sidebar search.
   */
  countries?: ReadonlyArray<FactbookCountryOption>;
}

export function FactbookSidebar({ items, countries }: FactbookSidebarProps) {
  return (
    <ReaderSidebar
      items={items}
      countries={countries}
      countryPathPrefix="/country"
      searchAriaLabel="Jump to a country"
      className="factbook-sidebar"
    />
  );
}
