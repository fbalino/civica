"use client";

import { useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { onCivicaAsk } from "@/lib/shell/events";
import { useShell } from "@/components/shell/ShellContext";

export interface AskCivicaContextChip {
  label: string;
  value: string;
}

export interface AskCivicaSuggestion {
  q: string;
  label: string;
}

export interface AskCivicaPanelProps {
  /** Eyebrow label in the chat header (defaults to "Ask Civica"). */
  title?: string;
  /** Right-aligned subtitle in the header ("AI · context-aware" by default). */
  subtitle?: string;
  /** Context pills rendered below the header. */
  contextChips?: AskCivicaContextChip[];
  /** Quick-tap prompt suggestions. */
  suggestions?: AskCivicaSuggestion[];
  /** Placeholder text for the input. */
  inputPlaceholder?: string;
  /** Seed "lead" prefix attached to each AI response (e.g. "About France · Lower house"). */
  messageLead?: string;
  /** Initial greeting message from Civica. */
  greeting?: string;
  /** Arbitrary extra context passed to /api/chat — e.g. tab, house, parties. */
  apiContext?: Record<string, unknown>;
  /**
   * Listen for `civica:ask` CustomEvents on window and pre-fill / auto-send.
   * Triggers (like a bill card's "Ask AI" button) dispatch via
   * `dispatchCivicaAsk()` from `@/lib/shell/events`. Enable only on the
   * active route slot — the idle default slot should leave this off so it
   * doesn't intercept events meant for a specific route's panel.
   */
  listenForExternalAsk?: boolean;
  /**
   * Stable key for persisting chat history across route transitions within
   * the shell. Each @right/page.tsx provides its own (e.g. "atlas:country:
   * united-states") so hopping between countries preserves each
   * conversation. When omitted, the panel falls back to a shared "default"
   * thread.
   */
  threadKey?: string;
}

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  lead?: string;
  cite?: string;
};

const DEFAULT_GREETING =
  "I'm **Civica**. I can explain bills in plain language, compare countries, or walk you through any chamber. What do you want to know?";

/**
 * The Ask Civica chat right-pane. Extracted from AtlasApp so the same
 * component can be dropped into any shell route via that route's
 * @right/page.tsx slot. Self-contained: holds its own chat history, manages
 * streaming from /api/chat, auto-scrolls on new messages.
 */
export function AskCivicaPanel({
  title = "Ask Civica",
  subtitle = "AI · context-aware",
  contextChips = [],
  suggestions = [],
  inputPlaceholder = "Ask anything…",
  messageLead,
  greeting = DEFAULT_GREETING,
  apiContext,
  listenForExternalAsk = false,
  threadKey = "default",
}: AskCivicaPanelProps) {
  const { getThread, setThread } = useShell();
  const chatHistory = getThread(threadKey, greeting) as ChatMessage[];
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed the persistent thread with the greeting on first mount for this
  // key. Without this, the greeting would live only in getThread's
  // fallback and disappear on the first setThread call.
  useEffect(() => {
    setThread(threadKey, (prev) =>
      prev.length === 0 ? [{ role: "ai", text: greeting }] : prev
    );
  }, [threadKey, greeting, setThread]);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const send = useCallback(async (prefill?: string) => {
    const text = prefill || inputRef.current?.value?.trim() || "";
    if (!text) return;
    if (inputRef.current) inputRef.current.value = "";

    setThread(threadKey, (prev) => [
      ...prev,
      { role: "user", text },
      { role: "ai", lead: messageLead, text: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: apiContext ?? {},
        }),
      });

      if (!res.ok || !res.body) {
        setThread(threadKey, (prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "ai",
            lead: messageLead,
            text: "Sorry, something went wrong. Please try again.",
          };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setThread(threadKey, (prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "ai",
            lead: messageLead,
            text: accumulated,
          };
          return next;
        });
      }

      // Defense against a 200 OK with zero bytes — leaves the user stuck
      // on "Thinking…" otherwise. Usually means /api/chat caught a
      // server-side error and closed the stream without enqueuing.
      if (accumulated.trim() === "") {
        setThread(threadKey, (prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "ai",
            lead: messageLead,
            text:
              "The assistant returned no response. If this keeps happening, check that ANTHROPIC_API_KEY_CHAT is set and /api/chat isn't throwing.",
          };
          return next;
        });
      }
    } catch {
      setThread(threadKey, (prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "ai",
          lead: messageLead,
          text: "Network error — please check your connection and try again.",
        };
        return next;
      });
    }
  }, [apiContext, messageLead, setThread, threadKey]);

  // Cross-pane trigger bus (bill cards etc.). Enabled per route so only the
  // active panel responds — see listenForExternalAsk prop docs.
  useEffect(() => {
    if (!listenForExternalAsk) return;
    return onCivicaAsk(({ question, autoSend }) => {
      if (inputRef.current) inputRef.current.value = question;
      if (autoSend !== false) send(question);
    });
  }, [listenForExternalAsk, send]);

  return (
    <>
      <div className="atlas-chat-head">
        <span className="dot" />
        <span className="t">{title}</span>
        <span className="s">{subtitle}</span>
      </div>
      {contextChips.length > 0 && (
        <div className="atlas-chat-ctx">
          Context:
          {contextChips.map((chip, i) => (
            <span
              key={`${chip.label}-${i}`}
              className="pill"
              title={chip.label}
            >
              {chip.value}
            </span>
          ))}
        </div>
      )}
      <div className="atlas-chat-scroll" ref={scrollRef}>
        {chatHistory.map((m, i) => (
          <div key={i} className="atlas-msg">
            <div className={`av${m.role === "ai" ? " ai" : ""}`}>
              {m.role === "ai" ? "C" : "U"}
            </div>
            <div className="bub">
              {m.lead && <div className="lead">{m.lead}</div>}
              {m.role === "ai" && m.text === "" ? (
                <p
                  style={{
                    color: "var(--atlas-muted)",
                    fontStyle: "italic",
                  }}
                >
                  Thinking…
                </p>
              ) : (
                <ReactMarkdown>{m.text}</ReactMarkdown>
              )}
              {m.cite && <div className="cite">{m.cite}</div>}
            </div>
          </div>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="atlas-suggest">
          {suggestions.map((s) => (
            <span
              key={s.label}
              className="s"
              onClick={() => send(s.q)}
              role="button"
              tabIndex={0}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="atlas-chat-input">
        <textarea
          ref={inputRef}
          placeholder={inputPlaceholder}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={() => send()}>Send</button>
      </div>
    </>
  );
}
