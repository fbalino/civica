"use client";

import { useState } from "react";

export function WidgetCopyButton({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className="widget-copy-btn"
      onClick={onCopy}
      aria-label="Copy embed code"
    >
      {copied ? "Copied ✓" : "Copy embed code"}
    </button>
  );
}
