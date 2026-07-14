import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
  requestInputErrorResponse,
} from "@/lib/api/request-body";
import {
  chatBodySchema,
  REQUEST_BODY_LIMITS,
  type ChatBody,
} from "@/lib/api/request-body-schemas";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_CHAT });

// --- Abuse / cost controls -------------------------------------------------
// /api/chat is a PUBLIC, unauthenticated endpoint that calls a paid Anthropic
// model. Per the 2026-06-07 deep audit (Security #1), it previously had no
// rate limit and no input-size cap, leaving the Anthropic budget open to a
// curl loop (financial DoS). Two shared Postgres windows run before body
// parsing or model work, and the request payload is hard-capped before use.
//
// Burst window — 15 requests / 60s per IP. A human chatting interactively
// sends at most a few messages per minute (each reply streams for several
// seconds), so 15/min sits comfortably above legitimate use while stopping a
// tight request loop.
//
// Sustained window — 100 requests / hour per IP. Bounds single-IP spend over
// time (≈100 completions/hr/IP worst case instead of the ≈900 the minute cap
// alone would allow) and is still far above any real reading session.
//
// Both budgets are durable across instances. A limiter/configuration outage is
// an honest fail-closed 503; it never silently becomes a process-local budget.
const CHAT_BURST_POLICY = getRequestRateLimitPolicy("chat-burst");
const CHAT_SUSTAINED_POLICY = getRequestRateLimitPolicy("chat-sustained");

// Output cap on the Anthropic completion. Bounds per-call token spend.
const MAX_OUTPUT_TOKENS = 1024;

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
  // 1) Shared limits run BEFORE parsing or any model call. The response helper
  //    distinguishes an exhausted budget (429) from protection outage (503).
  const burst = await checkRequestRateLimit(req, CHAT_BURST_POLICY);
  if (burst.status !== "allowed") {
    return rateLimitResponse(burst, CHAT_BURST_POLICY, {
      limitedMessage: "Too many requests. Please wait a moment and try again.",
    });
  }

  const sustained = await checkRequestRateLimit(req, CHAT_SUSTAINED_POLICY);
  if (sustained.status !== "allowed") {
    return rateLimitResponse(sustained, CHAT_SUSTAINED_POLICY, {
      limitedMessage: "Hourly chat limit reached. Please try again later.",
    });
  }

  // 2) Byte-limit and structurally validate the body before any model work.
  const parsed = await parseBoundedRequestBody<ChatBody>(req, {
    maxBytes: REQUEST_BODY_LIMITS.chat,
    media: [{ mediaType: JSON_MEDIA_TYPE, schema: chatBodySchema }],
  });
  if (!parsed.ok) return parsed.response;
  const { message, context = {} } = parsed.data;

  // 3) Keep the semantic blank-message check separate from structure.
  if (message.trim().length === 0) {
    return requestInputErrorResponse("INVALID_REQUEST_BODY");
  }
  const userMessage = message.trim();

  // 4) The strict schema bounds every untrusted context field and collection.
  const countryName = context.country || "the selected country";
  const tabRaw = context.tab ?? "";
  const house = context.house;
  const coalition = context.coalition ?? "";
  const nextElection = context.nextElection ?? "";
  const parties = context.parties ?? [];

  const tabLabel = TAB_LABELS[tabRaw] ?? (tabRaw || "Country");
  // House is only meaningful on chamber/bills tabs (per memory-decisions.md).
  const houseLabel = house
    ? house === "upper"
      ? "upper house"
      : "lower house"
    : null;

  let chamberContext = "";
  if (parties.length > 0 && houseLabel) {
    const partyList = parties
      .map((p) => `${p.name} (${p.seats} seats)`)
      .join(", ");
    chamberContext = `\nCurrent ${houseLabel} seat distribution: ${partyList}.`;
    if (coalition) chamberContext += ` Governing coalition: ${coalition}.`;
    if (nextElection) chamberContext += ` Next election: ${nextElection}.`;
  }

  // Only include the Chamber line when house is genuinely relevant.
  const chamberLine = houseLabel ? `\n- Chamber: ${houseLabel}` : "";

  const systemPrompt = `You are Civica AI, an expert on global governance, legislatures, and political systems. You speak clearly, cite facts, and avoid political bias.

Current user context:
- Country: ${countryName}${chamberLine}
- Active tab: ${tabLabel}${chamberContext}

Answer questions grounded in this context. If the user asks about something on the current tab (${tabLabel}), focus your answer there. Be concise — 2-4 short paragraphs max. Use plain language. If you cite a source, say so briefly at the end.`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: MAX_OUTPUT_TOKENS,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
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
        // Log full detail server-side; never leak SDK errors or internal
        // env-var names to the client (audit Security #10).
        console.error("[/api/chat] stream error:", err);
        controller.enqueue(
          encoder.encode(
            "\n\n_(Chat is temporarily unavailable. Please try again shortly.)_",
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
