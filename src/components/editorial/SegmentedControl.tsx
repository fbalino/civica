"use client";

import { useRef, type KeyboardEvent } from "react";

/*
 * SegmentedControl (component spec v1 §5) — NEW.
 * Controlled toggle: a container "well" with a navy active segment.
 * Token-only; all visual treatment lives in `.segmented*` (globals.css).
 */

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string = string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activate = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    requestAnimationFrame(() => tabRefs.current[index]?.focus());
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    activate(nextIndex);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={["segmented", className].filter(Boolean).join(" ")}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`segmented__item${active ? " segmented__item--active" : ""}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
