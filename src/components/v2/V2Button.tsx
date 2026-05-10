import React from "react";

type Variant = "primary" | "secondary" | "tertiary" | "destructive";

export function V2Button({
  variant = "primary",
  children,
  showArrow,
  ...rest
}: {
  variant?: Variant;
  children: React.ReactNode;
  showArrow?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`v2-btn v2-btn--${variant}`}>
      {children}
      {showArrow && (
        <span aria-hidden className="v2-btn__arrow">
          →
        </span>
      )}
    </button>
  );
}
