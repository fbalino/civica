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
import { cacheControlFor } from "@/lib/platform/cache-consistency";
import { withResponseCacheProfile } from "@/lib/api/response-cache";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import {
  ASK_CIVICA_MAX_OUTPUT_TOKENS,
  ASK_CIVICA_MODEL,
  ASK_CIVICA_SYSTEM_PROMPT,
  askCivicaCitationFooter,
  askCivicaUserPayload,
  isAskCivicaDirectInjectionAttempt,
  loadAskCivicaEvidence,
  recordAskCivicaAudit,
  type AskCivicaContextRepository,
} from "@/lib/ask-civica/contract";
import { recordErrorMonitoringEvent } from "@/lib/platform/error-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const askCivicaRepository: AskCivicaContextRepository = {
  getJurisdictionBySlug,
  getCanonicalFactsForJurisdiction: (jurisdictionId, keys) =>
    getCanonicalFactsForJurisdiction(jurisdictionId, [...keys]),
};

function unavailableResponse(): Response {
  return new Response("Ask Civica is temporarily unavailable. Please try again shortly.", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "60",
      "Cache-Control": cacheControlFor("private-live"),
    },
  });
}

async function handleChat(req: NextRequest) {
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
  const { message, context } = parsed.data;

  // 3) Keep the semantic blank-message check separate from structure.
  if (message.trim().length === 0) {
    return requestInputErrorResponse("INVALID_REQUEST_BODY");
  }
  const userMessage = message.trim();

  // 4) Direct attacks never reach the paid model. More importantly, no
  // browser-supplied prose is interpolated into the system prompt: the only
  // evidence comes from the server-side country/source read below.
  if (isAskCivicaDirectInjectionAttempt(userMessage)) {
    recordAskCivicaAudit({ outcome: "input_rejected" });
    return new Response(
      "Ask Civica cannot help override its safety rules or expose protected system details. I can help with the cited country evidence.",
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": cacheControlFor("private-live"),
        },
      },
    );
  }

  let evidence;
  try {
    evidence = await loadAskCivicaEvidence(context, askCivicaRepository);
  } catch {
    recordAskCivicaAudit({ outcome: "context_unavailable" });
    await recordErrorMonitoringEvent({
      surface: "server",
      routeId: "api.chat.post",
      errorCode: "ask-civica.context-unavailable",
    });
    return unavailableResponse();
  }
  if (!evidence) {
    recordAskCivicaAudit({ outcome: "context_unavailable" });
    return new Response("The selected country context is unavailable. Please reopen the country profile and try again.", {
      status: 422,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": cacheControlFor("private-live"),
      },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY_CHAT?.trim();
  if (!apiKey) {
    recordAskCivicaAudit({
      outcome: "model_unavailable",
      evidenceFactCount: evidence.facts.length,
    });
    await recordErrorMonitoringEvent({
      surface: "server",
      routeId: "api.chat.post",
      errorCode: "ask-civica.model-unavailable",
    });
    return unavailableResponse();
  }

  recordAskCivicaAudit({ outcome: "started", evidenceFactCount: evidence.facts.length });
  const client = new Anthropic({ apiKey });
  const userPayload = askCivicaUserPayload(userMessage, evidence);
  const citationFooter = askCivicaCitationFooter(evidence);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: ASK_CIVICA_MODEL,
          max_tokens: ASK_CIVICA_MAX_OUTPUT_TOKENS,
          system: ASK_CIVICA_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPayload }],
        });
        let sawText = false;
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            sawText = true;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        if (!sawText) {
          controller.enqueue(
            encoder.encode(
              "I could not produce a sourced answer from the current Civica evidence bundle.",
            ),
          );
        }
        controller.enqueue(encoder.encode(citationFooter));
        recordAskCivicaAudit({
          outcome: "completed",
          evidenceFactCount: evidence.facts.length,
        });
      } catch (err) {
        // Never log the provider exception: SDK errors can include request
        // metadata or content. PLT-018 records only a closed error identity.
        void err;
        recordAskCivicaAudit({
          outcome: "provider_failure",
          evidenceFactCount: evidence.facts.length,
        });
        await recordErrorMonitoringEvent({
          surface: "server",
          routeId: "api.chat.post",
          errorCode: "ask-civica.provider-failure",
        });
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
      "Cache-Control": cacheControlFor("private-live"),
    },
  });
}

export async function POST(req: NextRequest) {
  return withResponseCacheProfile("private-live", () => handleChat(req));
}
