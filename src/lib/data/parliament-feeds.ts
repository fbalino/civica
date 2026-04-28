/**
 * Legacy entry point that used to live-fetch US/UK bills on every
 * request. Phase H.1 moved the actual fetchers under
 * `src/lib/bills/sources/{us-congress,uk-parliament}.ts` and changed
 * the read path to a DB-backed query. This file re-exports the legacy
 * `Bill` shape + `fetchParliamentBills` for any caller still using the
 * live-fetch path during the cutover. New code should import from
 * `src/lib/bills/sources/...` directly.
 */

import { fetchUSBillsLive } from "@/lib/bills/sources/us-congress";
import { fetchUKBillsLive } from "@/lib/bills/sources/uk-parliament";

export interface Bill {
  title: string;
  longTitle?: string;
  summary?: string;
  status: string;
  date: string;
  url: string;
  source: string;
  identifier?: string;
}

const ISO2_TO_SOURCE: Record<string, string> = {
  US: "congress_gov",
  GB: "uk_parliament",
};

export function getParliamentSource(
  iso2: string | null | undefined,
): string | null {
  if (!iso2) return null;
  return ISO2_TO_SOURCE[iso2] ?? null;
}

export async function fetchParliamentBills(
  iso2: string | null | undefined,
): Promise<Bill[]> {
  try {
    if (iso2 === "US") return await fetchUSBillsLive();
    if (iso2 === "GB") return await fetchUKBillsLive();
    return [];
  } catch {
    return [];
  }
}
