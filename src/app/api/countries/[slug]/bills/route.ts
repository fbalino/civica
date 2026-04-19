import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { billSummaryCache } from "@/lib/db/schema";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { fetchParliamentBills, type Bill as RawBill } from "@/lib/data/parliament-feeds";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function statusToStage(status: string): number {
  const s = status.toLowerCase();
  if (s.includes("enacted") || s.includes("became law") || s.includes("royal assent") || s.includes("became public law")) return 4;
  if (s.includes("presented to the president") || s.includes("signed by the president") || s.includes("passed senate") || s.includes("passed the senate") || s.includes("passed house") || s.includes("passed the house") || s.includes("agreed to in senate") || s.includes("agreed to in house")) return 3;
  if (s.includes("floor") || s.includes("engrossed") || s.includes("ordered to be reported") || s.includes("placed on") || s.includes("report stage") || s.includes("3rd reading") || s.includes("third reading")) return 2;
  if (s.includes("committee") || s.includes("referred to") || s.includes("reading") || s.includes("introduced")) return 1;
  return 0;
}

function makeCacheKey(iso2: string, billTitle: string): string {
  // Simple stable key: country + first 120 chars of title (covers identifier + start of formal title)
  return `${iso2}::${billTitle.slice(0, 120)}`;
}

async function getSummaryFromDb(cacheKey: string): Promise<string | null> {
  try {
    const db = getDb();
    const rows = await db.select().from(billSummaryCache).where(eq(billSummaryCache.cacheKey, cacheKey)).limit(1);
    return rows[0]?.summary ?? null;
  } catch {
    return null;
  }
}

async function saveSummaryToDb(cacheKey: string, summary: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .insert(billSummaryCache)
      .values({ cacheKey, summary })
      .onConflictDoUpdate({ target: billSummaryCache.cacheKey, set: { summary, updatedAt: new Date() } });
  } catch {
    // Non-fatal: cache write failure just means next load re-generates
  }
}

async function generateSummariesBatch(bills: { title: string; longTitle?: string; status: string }[]): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return bills.map(() => "");

  const billList = bills
    .map((b, i) => {
      const name = b.longTitle ?? b.title;
      return `${i + 1}. "${name}"`;
    })
    .join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `For each bill below, write exactly ONE plain-English sentence (15–30 words) explaining what the bill aims to do or what it would change if passed, written for a general audience. Focus on real-world impact. Return ONLY a raw JSON array of strings — no markdown, no code fences, no explanation.\n\nBills:\n${billList}`,
        },
      ],
    });

    let raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";
    // Strip markdown code fences if Claude wrapped in them
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length === bills.length) {
      return (parsed as string[]).map((s) => (typeof s === "string" ? s : ""));
    }
  } catch {
    // fall through
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
  const iso2 = jurisdiction.iso2 ?? "XX";

  // Build cache keys for all bills
  const cacheKeys = rawBills.map((b) => makeCacheKey(iso2, b.longTitle ?? b.title));

  // Fetch cached summaries from DB
  const cachedSummaries = await Promise.all(cacheKeys.map((key) => getSummaryFromDb(key)));

  // Find which bills need AI generation
  const needsGeneration = rawBills
    .map((b, i) => (cachedSummaries[i] === null ? i : -1))
    .filter((i) => i >= 0);

  if (needsGeneration.length > 0) {
    const toGenerate = needsGeneration.map((i) => rawBills[i]);
    const newSummaries = await generateSummariesBatch(toGenerate);

    // Fill in generated summaries and save to DB
    await Promise.all(
      needsGeneration.map(async (billIdx, genIdx) => {
        const summary = newSummaries[genIdx];
        if (summary) {
          cachedSummaries[billIdx] = summary;
          await saveSummaryToDb(cacheKeys[billIdx], summary);
        }
      })
    );
  }

  const bills = rawBills.map((b, i) => ({
    title: b.longTitle ? `${b.title} - ${b.longTitle}` : b.title,
    summary: cachedSummaries[i] ?? (b.summary && b.summary !== b.status ? b.summary : ""),
    tags: [b.source === "congress_gov" ? "U.S. Congress" : b.source === "uk_parliament" ? "UK Parliament" : b.source],
    stage: statusToStage(b.status),
    votes: null,
    url: b.url,
    date: b.date,
  }));

  return NextResponse.json({ country: jurisdiction.name, bills });
}
