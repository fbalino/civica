import type { FactbookCountryOption } from "./FactbookCountrySearch";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";

export type FactbookSidebarItem = ReaderSidebarItem;

interface FactbookSidebarProps {
  items: ReadonlyArray<FactbookSidebarItem>;
  countries: ReadonlyArray<FactbookCountryOption>;
}

export function FactbookSidebar({ items, countries }: FactbookSidebarProps) {
  return (
    <ReaderSidebar
      items={items}
      countries={countries}
      countryPathPrefix="/factbook"
      searchAriaLabel="Jump to a country factbook"
      className="factbook-sidebar"
    />
  );
}
