import type { CSSProperties } from "react";

type ThemeImageStyle = CSSProperties & Record<`--${string}`, string>;

function cssImageUrl(src: string): string {
  return `url("${src.replaceAll('"', "%22")}")`;
}

/**
 * Decorative theme-aware artwork that resolves one background image from the
 * active theme. Unlike hidden light/dark <img> siblings, the inactive asset is
 * not transferred.
 */
export function ThemedDecorativeImage({
  src,
  darkSrc = null,
  className,
  style,
}: {
  src: string;
  darkSrc?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const themedStyle: ThemeImageStyle = {
    ...style,
    "--civica-themed-image-light": cssImageUrl(src),
    "--civica-themed-image-dark": cssImageUrl(darkSrc ?? src),
  };

  return (
    <span
      className={`civica-themed-image${className ? ` ${className}` : ""}`}
      style={themedStyle}
      aria-hidden="true"
    />
  );
}

export function themedDecorativeImageStyle(
  src: string,
  darkSrc: string | null | undefined,
  style?: CSSProperties,
): ThemeImageStyle {
  return {
    ...style,
    "--civica-themed-image-light": cssImageUrl(src),
    "--civica-themed-image-dark": cssImageUrl(darkSrc ?? src),
  };
}
