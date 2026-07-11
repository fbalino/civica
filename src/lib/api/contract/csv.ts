/** Shared CSV contract for the DAT-027 country research export. */
import { COUNTRY_RESEARCH_EXPORT_CSV_COLUMNS } from "@/lib/exports/country-research-export";

export const COUNTRY_EXPORT_CSV_COLUMNS = COUNTRY_RESEARCH_EXPORT_CSV_COLUMNS;
export const COUNTRY_EXPORT_CSV_HEADER = COUNTRY_EXPORT_CSV_COLUMNS.join(",");
