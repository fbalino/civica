import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/*
 * Button (component spec v1 §3) — thin, token-only wrapper over the `.btn`
 * class system defined in globals.css. Renders a <button>, a Next <Link>, or an
 * <a> depending on `href`. All visual treatment lives in CSS; this component
 * only composes class names and the optional trailing arrow / loading spinner.
 *
 * PRIMARY auto-inverts by theme via the CSS (navy fill + ivory label in light,
 * cream fill + dark label in dark) — see `.btn--primary` in globals.css.
 */

type ButtonVariant = "primary" | "secondary" | "tertiary" | "text";
type ButtonSize = "sm" | "md" | "lg";

interface CommonButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show the canonical trailing arrow (→). */
  arrow?: boolean;
  /** Replace the arrow with a spinner and disable interaction. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  /** When set, renders a link (internal → Next <Link>, external → <a>). */
  href?: string;
  /** Forwarded to <button> only. */
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  "aria-label"?: string;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  tertiary: "btn--tertiary",
  text: "btn--text",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn--sm",
  md: "",
  lg: "btn--lg",
};

function buttonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  loading: boolean,
  className?: string
): string {
  return ["btn", VARIANT_CLASS[variant], SIZE_CLASS[size], loading ? "is-loading" : "", className]
    .filter(Boolean)
    .join(" ");
}

function ButtonInner({
  children,
  arrow,
  loading,
}: {
  children: ReactNode;
  arrow?: boolean;
  loading?: boolean;
}) {
  return (
    <>
      <span>{children}</span>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : arrow ? (
        <span className="btn__arrow" aria-hidden="true">
          &rarr;
        </span>
      ) : null}
    </>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  arrow = false,
  loading = false,
  disabled = false,
  className,
  href,
  type = "button",
  onClick,
  "aria-label": ariaLabel,
}: CommonButtonProps) {
  const cls = buttonClassName(variant, size, loading, className);
  const inner = (
    <ButtonInner arrow={arrow} loading={loading}>
      {children}
    </ButtonInner>
  );

  if (href && !disabled && !loading) {
    const isExternal = /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a className={cls} href={href} aria-label={ariaLabel}>
          {inner}
        </a>
      );
    }
    return (
      <Link className={cls} href={href} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      className={cls}
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading || undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {inner}
    </button>
  );
}
