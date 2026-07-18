import type { CSSProperties } from "react";

type ThemeImageStyle = CSSProperties & Record<`--${string}`, string>;

function cssImageUrl(src: string): string {
  // Local public-asset paths are the only callers today. Escaping the delimiter
  // still keeps this utility safe if a future caller supplies a generated path.
  return `url("${src.replaceAll('"', "%22")}")`;
}

/**
 * A decorative, theme-aware image that lets the browser fetch only the
 * computed theme's asset. Rendering light and dark <img> siblings hides one
 * visually but still makes both eligible for transfer.
 *
 * Callers own their layout class; this primitive only supplies the two image
 * variables and the shared `.civica-themed-image` rendering hook.
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
      className={["civica-themed-image", className].filter(Boolean).join(" ")}
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
