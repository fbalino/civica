"use client";

import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled
      }
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="post-share">
      <button onClick={handleCopy} className="post-share-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="5" width="9" height="9" rx="1" />
          <path d="M3 11V3a1 1 0 0 1 1-1h8" />
        </svg>
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="post-share-btn"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.3 6.8L14.5 1h-1.2L8.8 6l-3.6-5H1.5l5.4 7.8L1.5 15h1.2l4.7-5.5 3.8 5.5h3.6L9.3 6.8zm-1.7 1.9l-.5-.8L3.2 2h1.9l3.5 5 .5.8 4.5 6.4h-1.9l-3.7-5.3-.4-.2z" />
        </svg>
        X / Twitter
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="post-share-btn"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.5 6.5v7h-2.5v-7h2.5zM4.7 4.2c0 .7-.6 1.3-1.4 1.3s-1.4-.6-1.4-1.3.6-1.3 1.4-1.3 1.4.6 1.4 1.3zM14 9.5v4h-2.5v-3.7c0-.9-.3-1.5-1.1-1.5-.6 0-1 .4-1.1.8v4.4H6.8s0-7 0-7h2.5v1c.3-.5 1-1.2 2.2-1.2 1.6 0 2.8 1 2.8 3.2z" />
        </svg>
        LinkedIn
      </a>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <button onClick={handleShare} className="post-share-btn">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="4" cy="8" r="2" />
            <circle cx="12" cy="4" r="2" />
            <circle cx="12" cy="12" r="2" />
            <line x1="5.8" y1="7" x2="10.2" y2="5" />
            <line x1="5.8" y1="9" x2="10.2" y2="11" />
          </svg>
          Share
        </button>
      )}
    </div>
  );
}
