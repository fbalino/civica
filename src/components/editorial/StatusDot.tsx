import type { CSSProperties } from "react";

type StatusDotState = "active" | "idle" | "warn" | "down";

interface StatusDotProps {
  state?: StatusDotState;
  size?: number;
  label?: string;
}

const STATE_COLOR: Record<StatusDotState, string> = {
  active: "var(--color-status-active)",
  idle:   "var(--color-status-idle)",
  warn:   "var(--color-status-warn)",
  down:   "var(--color-status-down)",
};

export function StatusDot({ state = "active", size = 8, label }: StatusDotProps) {
  const style: CSSProperties = {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: "50%",
    background: STATE_COLOR[state],
    flexShrink: 0,
  };
  return <span style={style} role="img" aria-label={label ?? state} />;
}
