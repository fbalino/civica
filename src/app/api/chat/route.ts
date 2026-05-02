import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TAB_LABELS: Record<string, string> = {
  chamber: "Chamber composition",
  bills: "Bills in motion",
  structure: "Government structure",
  elections: "Elections",
  democracy: "Democracy index",
  leaders: "Leadership",
  constitution: "Constitution",
  factbook: "Country factbook",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, context } = body as {
    message: string;
    context: {
      country: string;
      // House is only meaningful on chamber/bills tabs (per
      // memory-decisions.md). Optional so factbook / structure /
      // democracy callers don't bleed a default value into the prompt.
      house?: "lower" | "upper";
      tab: string;
      parties?: { name: string; seats: number }[];
      coalition?: string;
      nextElection?: string;
    };
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "Empty message" }), { status: 400 });
  }

  const tabLabel = TAB_LABELS[context.tab] ?? context.tab;
  const houseLabel = context.house
    ? context.house === "upper"
      ? "upper house"
      : "lower house"
    : null;

  let chamberContext = "";
  if (context.parties && context.parties.length > 0 && houseLabel) {
    const partyList = context.parties
      .map((p) => `${p.name} (${p.seats} seats)`)
      .join(", ");
    chamberContext = `\nCurrent ${houseLabel} seat distribution: ${partyList}.`;
    if (context.coalition) chamberContext += ` Governing coalition: ${context.coalition}.`;
    if (context.nextElection) chamberContext += ` Next election: ${context.nextElection}.`;
  }

  // Only include the Chamber line when house is genuinely relevant.
  const chamberLine = houseLabel ? `\n- Chamber: ${houseLabel}` : "";

  const systemPrompt = `You are Civica AI, an expert on global governance, legislatures, and political systems. You speak clearly, cite facts, and avoid political bias.

Current user context:
- Country: ${context.country}${chamberLine}
- Active tab: ${tabLabel}${chamberContext}

Answer questions grounded in this context. If the user asks about something on the current tab (${tabLabel}), focus your answer there. Be concise — 2-4 short paragraphs max. Use plain language. If you cite a source, say so briefly at the end.`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: message }],
        });
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        console.error("[/api/chat] stream error:", err);
        controller.enqueue(
          encoder.encode(
            `\n\n_(Chat is unavailable — ${err instanceof Error ? err.message : "unknown error"}. Check ANTHROPIC_API_KEY.)_`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
