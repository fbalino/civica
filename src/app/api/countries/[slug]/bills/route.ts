import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { fetchParliamentBills, type Bill as RawBill } from "@/lib/data/parliament-feeds";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function statusToStage(status: string): number {
  const s = status.toLowerCase();
  if (s.includes("enacted") || s.includes("became law") || s.includes("royal assent") || s.includes("became public law")) return 4;
  if (s.includes("presented to the president") || s.includes("signed by the president") || s.includes("passed senate") || s.includes("passed the senate") || s.includes("passed house") || s.includes("passed the house") || s.includes("agreed to in senate") || s.includes("agreed to in house")) return 3;
  if (s.includes("floor") || s.includes("engrossed") || s.includes("ordered to be reported") || s.includes("placed on") || s.includes("reading") || s.includes("report stage") || s.includes("3rd reading") || s.includes("third reading")) return 2;
  if (s.includes("committee") || s.includes("referred to") || s.includes("1st reading") || s.includes("first reading") || s.includes("2nd reading") || s.includes("second reading")) return 1;
  return 0;
}

async function generateSummaries(bills: RawBill[]): Promise<string[]> {
  if (bills.length === 0) return [];
  if (!process.env.ANTHROPIC_API_KEY) return bills.map(() => "");

  const billList = bills
    .map((b, i) => {
      const name = b.longTitle ?? b.title;
      return `${i + 1}. "${name}" — Status: ${b.status}`;
    })
    .join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `For each bill below, write exactly ONE plain-English sentence (15–30 words) explaining what the bill would do if passed or what it aims to achieve, written for a general audience. Focus on real-world impact, not procedure. Return only a JSON array of strings, one per bill, in order. No markdown, no extra text.\n\nBills:\n${billList}`,
        },
      ],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === bills.length) return parsed as string[];
  } catch {
    // fall through to empty
  }
  return bills.map(() => "");
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawBills = await fetchParliamentBills(jurisdiction.iso2);
  const summaries = await generateSummaries(rawBills);

  const bills = rawBills.map((b, i) => ({
    // Full combined title: "H.R. 8322 - To amend the FISA Amendments Act..."
    title: b.longTitle ? `${b.title} - ${b.longTitle}` : b.title,
    // AI one-sentence description of real-world impact
    summary: summaries[i] || (b.summary && b.summary !== b.status ? b.summary : ""),
    tags: [b.source === "congress_gov" ? "U.S. Congress" : b.source === "uk_parliament" ? "UK Parliament" : b.source],
    stage: statusToStage(b.status),
    votes: null,
    url: b.url,
    date: b.date,
  }));

  return NextResponse.json({ country: jurisdiction.name, bills });
}
