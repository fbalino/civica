import React from "react";

type Tone = "neutral" | "success" | "warning" | "info" | "accent";

export function V2Pill({
  tone = "neutral",
  dot,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`v2-pill v2-pill--${tone}`}>
      {dot && <span className="v2-pill__dot" aria-hidden />}
      {children}
    </span>
  );
}
