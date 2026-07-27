"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LightboxImage {
  src: string;
  alt: string;
  caption: string;
}

interface FactbookLightboxProps {
  open: boolean;
  mode: "map" | "photos";
  images: LightboxImage[];
  initialIndex?: number;
  onClose: () => void;
}

// Lightbox-specific overlay chrome. The dialog renders on top of a
// near-black scrim regardless of the page theme, so these anchor on
// absolute white + black. The literals live in the :root token-definition
// block in globals.css (--color-overlay-*); we only reference the vars here.
const OVERLAY_BG = "var(--color-overlay-bg)";
const OVERLAY_FG = "var(--color-overlay-fg)";
const OVERLAY_CAPTION_BG = "var(--color-overlay-caption-bg)";
const OVERLAY_BORDER_FG = "var(--color-overlay-border)";

export function FactbookLightbox({
  open,
  mode,
  images,
  initialIndex = 0,
  onClose,
}: FactbookLightboxProps) {
  if (!open) return null;

  return (
    <FactbookLightboxDialog
      key={initialIndex}
      mode={mode}
      images={images}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
}

function FactbookLightboxDialog({
  mode,
  images,
  initialIndex = 0,
  onClose,
}: Omit<FactbookLightboxProps, "open">) {
  const [idx, setIdx] = useState(initialIndex);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const next = useCallback(
    (delta: number) => {
      if (images.length === 0) return;
      setIdx((i) => (i + delta + images.length) % images.length);
    },
    [images.length]
  );

  // Keyboard nav + focus management.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (images.length > 1) {
        if (e.key === "ArrowRight") next(1);
        else if (e.key === "ArrowLeft") next(-1);
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [images.length, next, onClose]);

  // Preserve the control that launched the dialog. A lightbox is shared by
  // both map and photo tiles, so restore here rather than depending on every
  // caller to remember the accessibility contract.
  useEffect(() => {
    const activeElement = document.activeElement;
    returnFocusRef.current =
      activeElement instanceof HTMLElement ? activeElement : null;
    requestAnimationFrame(() => closeBtnRef.current?.focus());

    return () => {
      const returnFocus = returnFocusRef.current;
      requestAnimationFrame(() => {
        if (returnFocus?.isConnected) returnFocus.focus();
      });
    };
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const current = images[idx];
  if (!current) return null;
  const hasMultipleImages = images.length > 1;
  const itemLabel = mode === "map" ? "Map" : "Photo";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "map" ? "Country map" : "Photo gallery"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: OVERLAY_BG,
        zIndex: "var(--z-modal)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
      }}
    >
      <button
        ref={closeBtnRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          top: "var(--space-6)",
          right: "var(--space-6)",
          width: 40,
          height: 40,
          border: `1px solid ${OVERLAY_FG}`,
          background: "transparent",
          color: OVERLAY_FG,
          fontSize: "var(--text-24)",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>
      {hasMultipleImages && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => next(-1)}
            style={{
              position: "absolute",
              left: "var(--space-6)",
              top: "50%",
              transform: "translateY(-50%)",
              width: 48,
              height: 48,
              border: `1px solid ${OVERLAY_FG}`,
              background: "transparent",
              color: OVERLAY_FG,
              fontSize: "var(--text-24)",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => next(1)}
            style={{
              position: "absolute",
              right: "var(--space-6)",
              top: "50%",
              transform: "translateY(-50%)",
              width: 48,
              height: 48,
              border: `1px solid ${OVERLAY_FG}`,
              background: "transparent",
              color: OVERLAY_FG,
              fontSize: "var(--text-24)",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ›
          </button>
        </>
      )}
      <img
        src={current.src}
        alt={current.alt}
        // Decorative: `current.caption` renders in the visible caption block
        // immediately below (same text as the source `alt`, always "" as of
        // EXP-023), so the image itself is hidden from the accessibility
        // tree to avoid announcing that sentence twice.
        aria-hidden="true"
        style={{
          maxWidth: "90vw",
          maxHeight: "75vh",
          display: "block",
          border: `1px solid ${OVERLAY_FG}`,
          background: "var(--color-bg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: hasMultipleImages
            ? "calc(var(--space-7) + 80px)"
            : "var(--space-7)",
          left: "50%",
          transform: "translateX(-50%)",
          color: OVERLAY_FG,
          fontSize: "var(--text-15)",
          maxWidth: "80vw",
          textAlign: "center",
          background: OVERLAY_CAPTION_BG,
          padding: "var(--space-3) var(--space-5)",
          border: `1px solid ${OVERLAY_BORDER_FG}`,
        }}
      >
        {current.caption}
      </div>
      {hasMultipleImages && (
        <div
          style={{
            position: "absolute",
            bottom: "var(--space-6)",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "var(--space-2)",
            maxWidth: "90vw",
            overflowX: "auto",
            padding: "var(--space-3) 0",
          }}
        >
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`${itemLabel} ${i + 1}`}
              style={{
                width: 64,
                height: 48,
                padding: 0,
                border: `1px solid ${i === idx ? OVERLAY_FG : "transparent"}`,
                background: "transparent",
                opacity: i === idx ? 1 : 0.5,
                cursor: "pointer",
              }}
            >
              <img
                src={img.src}
                alt=""
                aria-hidden="true"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
