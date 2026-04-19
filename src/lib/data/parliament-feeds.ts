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

export function getParliamentSource(iso2: string | null | undefined): string | null {
  if (!iso2) return null;
  return ISO2_TO_SOURCE[iso2] ?? null;
}

async function fetchUSBills(): Promise<Bill[]> {
  const apiKey = process.env.CONGRESS_API_KEY ?? "DEMO_KEY";
  const res = await fetch(
    `https://api.congress.gov/v3/bill?format=json&limit=5&sort=updateDate+desc&api_key=${apiKey}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    bills?: Array<{
      title?: string;
      latestAction?: { text?: string; actionDate?: string };
      updateDate?: string;
      url?: string;
      congress?: number;
      type?: string;
      number?: number;
    }>;
  };
  return (json.bills ?? []).map((b) => {
    const typeMap: Record<string, string> = {
      HR: "H.R.", HJRES: "H.J.Res.", HRES: "H.Res.", HCONRES: "H.Con.Res.",
      S: "S.", SJRES: "S.J.Res.", SRES: "S.Res.", SCONRES: "S.Con.Res.",
    };
    const typeLabel = b.type ? (typeMap[b.type] ?? b.type) : "";
    const identifier = typeLabel && b.number != null ? `${typeLabel} ${b.number}` : undefined;
    // Use identifier as title for Congress bills; the long formal title becomes longTitle for AI context
    const formalTitle = b.title ?? "Untitled";
    const displayTitle = identifier ?? formalTitle;
    return {
      title: displayTitle,
      longTitle: formalTitle !== displayTitle ? formalTitle : undefined,
      status: b.latestAction?.text ?? "In Congress",
      date: b.latestAction?.actionDate ?? b.updateDate ?? "",
      url: b.url ?? `https://www.congress.gov/bill/${b.congress}th-congress/${(b.type ?? "").toLowerCase()}-bill/${b.number}`,
      source: "congress_gov",
      identifier,
    };
  });
}

async function fetchUKBills(): Promise<Bill[]> {
  const res = await fetch(
    "https://bills-api.parliament.uk/api/v1/Bills?CurrentHouse=Commons&SortOrder=DateUpdatedDescending&Take=5",
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: Array<{
      billId?: number;
      shortTitle?: string;
      longTitle?: string;
      lastUpdate?: string;
      currentStage?: { description?: string };
    }>;
  };
  return (json.items ?? []).map((b) => ({
    title: b.shortTitle ?? b.longTitle ?? "Untitled",
    summary: b.longTitle && b.shortTitle && b.longTitle !== b.shortTitle ? b.longTitle : undefined,
    status: b.currentStage?.description ?? "In Parliament",
    date: b.lastUpdate ?? "",
    url: `https://bills.parliament.uk/bills/${b.billId}`,
    source: "uk_parliament",
    identifier: b.billId != null ? String(b.billId) : undefined,
  }));
}

export async function fetchParliamentBills(iso2: string | null | undefined): Promise<Bill[]> {
  try {
    if (iso2 === "US") return await fetchUSBills();
    if (iso2 === "GB") return await fetchUKBills();
    return [];
  } catch {
    return [];
  }
}
