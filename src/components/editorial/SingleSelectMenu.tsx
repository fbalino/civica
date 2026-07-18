"use client";

/**
 * SingleSelectMenu — the canonical tokenised single-select popover for compact
 * filter controls inside a tool/editorial surface (region, country, metric,
 * lens, year, …). A small-caps label sits above a token-styled trigger button
 * that opens a `role="listbox"` popover of options with a check on the active
 * item.
 *
 * Extracted once (2026-07-06) from OutcomesExplorer's local copy so the
 * conditions explorer and the party browser share ONE control — the design
 * system is a closed set (owner mandate); no duplicated control component.
 *
 * Tokens only: every colour is a role token, every font a stack token. The
 * caller owns open/close state (so a parent can enforce "only one menu open at
 * a time") and outside-click / Escape dismissal.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

export interface SingleSelectItem {
  value: string;
  label: string;
}

export interface SingleSelectMenuProps {
  /** Small-caps label shown above the trigger. */
  label: string;
  /** Currently-selected item value. */
  value: string;
  items: SingleSelectItem[];
  /** Whether the popover is open (caller-owned). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: string) => void;
  /** Optional min-width for the trigger (defaults to a compact 160px). */
  minWidth?: number;
  /** Tabular numerals for numeric option sets (e.g. Year). */
  tabularNums?: boolean;
  ariaLabel: string;
}

export function SingleSelectMenu({
  label,
  value,
  items,
  open,
  onOpenChange,
  onSelect,
  minWidth = 160,
  tabularNums = false,
  ariaLabel,
}: SingleSelectMenuProps) {
  const selected = items.find((item) => item.value === value);
  const summary = selected?.label ?? "Select";
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const openFocusIndexRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex);

  const focusOption = (index: number) => {
    setFocusedIndex(index);
    requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const closeAndRestoreTrigger = () => {
    onOpenChange(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;

    wasOpenRef.current = true;
    const index = openFocusIndexRef.current ?? selectedIndex;
    openFocusIndexRef.current = null;
    focusOption(index);
  }, [open, selectedIndex]);

  const selectItem = (item: SingleSelectItem) => {
    onSelect(item.value);
    closeAndRestoreTrigger();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeAndRestoreTrigger();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();

    if (open) {
      focusOption(focusedIndex);
      return;
    }

    openFocusIndexRef.current = selectedIndex;
    onOpenChange(true);
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreTrigger();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectItem(items[index]);
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    focusOption(nextIndex);
  };

  return (
    <div style={{ position: "relative", minWidth }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: "var(--font-weight-medium)" as CSSProperties["fontWeight"],
          fontSize: "var(--text-12)",
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase",
          color: "var(--color-text-30)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-select-bg, var(--color-surface-elevated))",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-14)",
          fontVariantNumeric: tabularNums ? "tabular-nums" : "normal",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-text-40)",
            transition: "transform 140ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: "var(--z-popover)",
            minWidth: "100%",
            maxWidth: 320,
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-dark)",
            padding: "8px",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 2,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {items.map((item, index) => {
              const active = item.value === value;
              return (
                <button
                  key={item.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={active}
                  tabIndex={index === focusedIndex ? 0 : -1}
                  onClick={() => selectItem(item)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: active
                      ? "var(--color-surface-elevated)"
                      : "transparent",
                    color: active
                      ? "var(--color-text-primary)"
                      : "var(--color-text-60)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-14)",
                    fontVariantNumeric: tabularNums ? "tabular-nums" : "normal",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      flexShrink: 0,
                      color: "var(--color-accent)",
                    }}
                  >
                    {active ? "✓" : ""}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
