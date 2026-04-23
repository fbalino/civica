"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

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
}: AskCivicaPanelProps) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: "ai", text: greeting },
  ]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  async function send(prefill?: string) {
    const text = prefill || inputRef.current?.value?.trim() || "";
    if (!text) return;
    if (inputRef.current) inputRef.current.value = "";

    setChatHistory((prev) => [
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
        setChatHistory((prev) => {
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
        setChatHistory((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "ai",
            lead: messageLead,
            text: accumulated,
          };
          return next;
        });
      }
    } catch {
      setChatHistory((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "ai",
          lead: messageLead,
          text: "Network error — please check your connection and try again.",
        };
        return next;
      });
    }
  }

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
