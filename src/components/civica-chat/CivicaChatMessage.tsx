"use client";

import ReactMarkdown from "react-markdown";

export interface CivicaChatMessageProps {
  /** "user" renders as the right-aligned filled bubble; "ai" as left
   *  with the avatar. */
  role: "user" | "ai";
  /** Markdown text content. AI responses come through as markdown from
   *  /api/chat; user text usually doesn't, but is rendered through the
   *  same pipeline so a stray markdown character in user input doesn't
   *  break the layout. */
  text: string;
  /** Optional eyebrow rendered above the bubble (e.g. "About Nigeria
   *  · Lower house"). Atlas-style only. */
  lead?: string;
  /** Optional citation chip rendered after the bubble. */
  cite?: string;
  /** Show "Thinking…" placeholder when AI bubble is still empty mid-stream. */
  isStreaming?: boolean;
  /** Visual variant.
   *  - "atlas": avatar on the left, prose bubble (right-rail layout)
   *  - "drawer": no avatar, left-aligned bubble for AI / right-aligned
   *    filled bubble for user (bottom-drawer layout) */
  variant?: "atlas" | "drawer";
}

/**
 * Single chat message bubble shared between AskCivicaPanel (atlas right
 * rail) and CivicaAIDrawer (factbook bottom drawer).
 *
 * Markdown rendering is identical across both surfaces — the variant
 * only affects layout chrome (avatar, alignment). All typography +
 * styling lives in `src/app/civica-chat.css` so the two surfaces stay
 * in sync visually.
 */
export function CivicaChatMessage({
  role,
  text,
  lead,
  cite,
  isStreaming = false,
  variant = "atlas",
}: CivicaChatMessageProps) {
  const showThinking = role === "ai" && text === "" && isStreaming;

  return (
    <div
      className={`civica-chat-msg civica-chat-msg--${variant} civica-chat-msg--${role}`}
    >
      {variant === "atlas" && (
        <div
          className={`civica-chat-msg-av${role === "ai" ? " civica-chat-msg-av--ai" : ""}`}
          aria-hidden
        >
          {role === "ai" ? "C" : "U"}
        </div>
      )}
      <div className="civica-chat-msg-bub">
        {variant === "drawer" && (
          <div className="civica-chat-msg-role" aria-hidden>
            {role === "user" ? "You" : "Civica"}
          </div>
        )}
        {lead && <div className="civica-chat-msg-lead">{lead}</div>}
        {showThinking ? (
          <p className="civica-chat-msg-thinking">Thinking…</p>
        ) : (
          <div className="civica-chat-msg-md">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
        {cite && <div className="civica-chat-msg-cite">{cite}</div>}
      </div>
    </div>
  );
}
