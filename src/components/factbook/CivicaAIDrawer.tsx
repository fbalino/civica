"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CivicaChatMessage } from "@/components/civica-chat/CivicaChatMessage";
import { onCivicaAsk } from "@/lib/shell/events";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  source?: string;
  timestamp: number;
}

interface CivicaAIDrawerProps {
  countryName: string;
  /** Storage key — e.g. `factbook:nigeria`. Persists conversation in
   *  localStorage so it survives navigation. */
  threadKey: string;
  /** Suggestion prompts shown above the input when the conversation is
   *  active. */
  suggestions?: string[];
  /** Active tab/surface — passed to /api/chat as context. */
  apiTab?: string;
}

const DEFAULT_SUGGESTIONS = [
  "How does the government work?",
  "Recent Pulse events",
  "When's the next election?",
];

// Granola-style chat drawer.
// - Empty (no messages): just the input bar.
// - Active (>=1 message): handle bar on top, conversation, suggestions, input.
// - Minimised: handle bar + input ONLY (body and suggestions hidden).
// Conversation persists across navigation in localStorage under threadKey.
// Streams responses from /api/chat in real time.
//
// Markdown rendering + scrollbar styling come from <CivicaChatMessage>
// + civica-chat.css so this drawer matches the atlas right-rail chat.
export function CivicaAIDrawer({
  countryName,
  threadKey,
  suggestions = DEFAULT_SUGGESTIONS,
  apiTab = "factbook",
}: CivicaAIDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`civica.chat.${threadKey}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // ignore corrupt storage
    }
  }, [threadKey]);

  // Persist on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `civica.chat.${threadKey}`,
        JSON.stringify(messages)
      );
    } catch {
      // quota errors etc.
    }
  }, [messages, threadKey]);

  // Auto-scroll to bottom on new messages or token chunk.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || streaming) return;
    setDraft("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: t,
      timestamp: Date.now(),
    };
    const aiMsgId = crypto.randomUUID();
    const aiSeed: Message = {
      id: aiMsgId,
      role: "ai",
      content: "",
      source: "Civica",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg, aiSeed]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: t,
          context: {
            country: countryName,
            tab: apiTab,
            // No `house` — irrelevant on the factbook surface. The route
            // skips the Chamber line in the system prompt when absent.
          },
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: "Sorry — chat is unavailable right now." }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: acc } : m
          )
        );
      }
      if (!acc.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content:
                    "Sorry — Civica didn't return any text. Check the server logs.",
                }
              : m
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: `Chat error: ${msg}` } : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }, [apiTab, countryName, streaming]);

  useEffect(() => {
    return onCivicaAsk(({ question, autoSend }) => {
      setDraft(question);
      setCollapsed(false);
      if (autoSend !== false) void send(question);
    });
  }, [send]);

  const isEmpty = messages.length === 0;
  const showBody = !isEmpty && !collapsed;

  return (
    <aside
      aria-label="Civica AI assistant"
      className="factbook-drawer"
      style={{
        // Explicit per-state cap. `auto` for empty/collapsed lets the
        // handle + input rows define their own height; `min(560px, …)`
        // for the active state caps the conversation body.
        maxHeight: showBody ? "min(560px, 70vh)" : "auto",
      }}
    >
      {/* Handle — shown whenever there are messages, even when collapsed */}
      {!isEmpty && (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!collapsed}
          aria-controls="civica-ai-drawer-body"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            setCollapsed((c) => !c);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if ((e.target as HTMLElement).closest("button")) return;
              e.preventDefault();
              setCollapsed((c) => !c);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-4) var(--space-5)",
            borderBottom: showBody ? "1px solid var(--color-stat-border)" : "none",
            cursor: "pointer",
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: streaming
                ? "var(--color-warn)"
                : "var(--color-source-live)",
              boxShadow: streaming
                ? "0 0 0 3px color-mix(in srgb, var(--color-warn) 30%, transparent)"
                : "0 0 0 3px color-mix(in oklab, var(--color-success) 20%, transparent)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-10)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-wider)",
              color: "var(--color-text-40)",
            }}
          >
            Civica AI
          </span>
          <span
            style={{
              fontSize: "var(--text-12)",
              color: "var(--color-text-60)",
              flex: 1,
            }}
          >
            {streaming
              ? `Thinking about ${countryName}…`
              : `Conversation about ${countryName} · ${messages.length} message${messages.length === 1 ? "" : "s"}`}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
            aria-label={collapsed ? "Expand" : "Minimize"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--space-2)",
              color: "var(--color-text-60)",
              fontSize: "var(--text-14)",
              lineHeight: 1,
            }}
          >
            {collapsed ? "▴" : "▾"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMessages([]);
              setCollapsed(false);
            }}
            aria-label="Clear conversation"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--space-2)",
              color: "var(--color-text-60)",
              fontSize: "var(--text-14)",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Conversation body + suggestions: hidden in empty + collapsed states */}
      {showBody && (
        <>
          <div
            id="civica-ai-drawer-body"
            ref={bodyRef}
            className="civica-chat-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "var(--space-5)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-5)",
            }}
          >
            {messages.map((m) => (
              <CivicaChatMessage
                key={m.id}
                role={m.role}
                text={m.content}
                variant="drawer"
                isStreaming={streaming}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              padding: "0 var(--space-5) var(--space-4)",
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={streaming}
                style={{
                  background: "none",
                  border: "1px solid var(--color-stat-border)",
                  padding: "var(--space-2) var(--space-4)",
                  fontSize: "var(--text-12)",
                  cursor: streaming ? "default" : "pointer",
                  color: "var(--color-text-60)",
                  fontFamily: "inherit",
                  opacity: streaming ? 0.5 : 1,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Input row — ALWAYS visible (empty, active, AND collapsed states) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-4) var(--space-5)",
          borderTop:
            isEmpty ? "none" : "1px solid var(--color-stat-border)",
          flexShrink: 0,
        }}
      >
        <div
          className="factbook-drawer-beta"
          aria-label="Civica AI is in beta. Verify important answers."
        >
          <span className="factbook-drawer-beta__pill">Beta</span>
          <span className="factbook-drawer-beta__copy">
            Verify important answers
          </span>
        </div>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask anything about ${countryName}…`}
          disabled={streaming}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-primary)",
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || streaming}
          style={{
            width: 32,
            height: 32,
            border: "1px solid var(--color-text-primary)",
            borderRadius: "50%",
            background: "transparent",
            cursor: draft.trim() && !streaming ? "pointer" : "default",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            fontSize: "var(--text-14)",
            color: "var(--color-text-primary)",
            opacity: draft.trim() && !streaming ? 1 : 0.4,
            fontFamily: "inherit",
          }}
        >
          ↑
        </button>
      </form>
    </aside>
  );
}
