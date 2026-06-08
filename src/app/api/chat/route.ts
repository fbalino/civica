import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { checkInMemoryRateLimit, getRequestIp } from "@/lib/api/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_CHAT });

// --- Abuse / cost controls -------------------------------------------------
// /api/chat is a PUBLIC, unauthenticated endpoint that calls a paid Anthropic
// model. Per the 2026-06-07 deep audit (Security #1), it previously had no
// rate limit and no input-size cap, leaving the Anthropic budget open to a
// curl loop (financial DoS). We bound abuse without harming a single
// interactive reader by applying two per-IP windows via the shared in-memory
// limiter, and by hard-capping the request payload BEFORE the model is called.
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
// Note: like every other limiter on the site this is in-memory/per-instance,
// so on serverless it is best-effort (audit Security #9). It is the right
// first-line control; a durable shared store is the documented follow-up.
const BURST_MAX = 15;
const BURST_WINDOW_MS = 60_000;
const HOURLY_MAX = 100;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

// Input bounds — reject oversized / malformed payloads before any model call.
const MAX_BODY_CHARS = 16_384; // raw request body ceiling (~360 party rows)
const MAX_MESSAGE_LEN = 4_000; // user message characters
const MAX_CONTEXT_STR_LEN = 200; // country / tab / coalition / nextElection
const MAX_PARTIES = 60; // legislatures rarely list this many parties
const MAX_PARTY_NAME_LEN = 120;

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

function jsonError(
  message: string,
  status: number,
  extraHeaders?: Record<string, string>,
) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

export async function POST(req: NextRequest) {
  // 1) Per-IP rate limiting BEFORE parsing or any model call. Two windows:
  //    a short burst cap and a sustained hourly cap.
  const ip = getRequestIp(req);

  const burst = checkInMemoryRateLimit({
    scope: "chat",
    key: ip,
    max: BURST_MAX,
    windowMs: BURST_WINDOW_MS,
  });
  if (!burst.allowed) {
    return jsonError("Too many requests. Please wait a moment and try again.", 429, {
      "Retry-After": String(burst.retryAfterSeconds),
    });
  }

  const hourly = checkInMemoryRateLimit({
    scope: "chat-hourly",
    key: ip,
    max: HOURLY_MAX,
    windowMs: HOURLY_WINDOW_MS,
  });
  if (!hourly.allowed) {
    return jsonError("Hourly chat limit reached. Please try again later.", 429, {
      "Retry-After": String(hourly.retryAfterSeconds),
    });
  }

  // 2) Read and size-cap the raw body before parsing JSON.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  if (raw.length > MAX_BODY_CHARS) {
    return jsonError("Request body too large.", 413);
  }

  // 3) Parse JSON defensively — malformed payloads are rejected, not 500'd.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }
  if (typeof parsed !== "object" || parsed === null) {
    return jsonError("Invalid request body.", 400);
  }

  const { message, context } = parsed as { message?: unknown; context?: unknown };

  // 4) Validate + bound the user message.
  if (typeof message !== "string" || message.trim().length === 0) {
    return jsonError("Empty message", 400);
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return jsonError(
      `Message must be ${MAX_MESSAGE_LEN} characters or fewer.`,
      413,
    );
  }
  const userMessage = message.trim();

  // 5) Normalise + bound the client-supplied context. All of `context` is
  //    untrusted (audit Security #11): clamp every string, coerce types, and
  //    cap the parties array so an attacker cannot inflate the system prompt.
  //    This bounds prompt size; it is not an integrity guarantee.
  const ctx = (typeof context === "object" && context !== null
    ? context
    : {}) as Record<string, unknown>;
  const clampStr = (v: unknown, max = MAX_CONTEXT_STR_LEN) =>
    typeof v === "string" ? v.slice(0, max) : "";

  const countryName = clampStr(ctx.country) || "the selected country";
  const tabRaw = clampStr(ctx.tab);
  const house =
    ctx.house === "upper" || ctx.house === "lower" ? ctx.house : undefined;
  const coalition = clampStr(ctx.coalition);
  const nextElection = clampStr(ctx.nextElection);

  let parties: { name: string; seats: number }[] = [];
  if (Array.isArray(ctx.parties)) {
    parties = ctx.parties
      .slice(0, MAX_PARTIES)
      .map((p) => {
        const party = (typeof p === "object" && p !== null
          ? p
          : {}) as Record<string, unknown>;
        const name = clampStr(party.name, MAX_PARTY_NAME_LEN);
        const seatsNum = Number(party.seats);
        const seats = Number.isFinite(seatsNum) ? Math.trunc(seatsNum) : 0;
        return { name, seats };
      })
      .filter((p) => p.name.length > 0);
  }

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
