"use client";

/**
 * ParallaxImage — a restrained, editorial parallax for the hero engravings.
 *
 * Civica is a fine-press almanac, so this is a *small* drift (the image moves
 * a little slower than the page as you scroll), not a dramatic one. It lives at
 * the same low spot on the motion dial as <Reveal>.
 *
 * How it works (same Motion idiom as Reveal — NEVER scroll listeners / useState):
 *   • `useScroll({ target, offset: ["start start","end start"] })` tracks how far
 *     the OWN hero SECTION has scrolled past the top of the viewport (0 when the
 *     hero's top hits the viewport top, 1 when its bottom does).
 *   • `useTransform` maps that 0→1 progress to a small translateY (~10%).
 *
 * IMPORTANT — the scroll target is the hero SECTION, not the <img> itself. The
 * img is `position:absolute` and carries the parallax transform; measuring its
 * own (moving, over-scanned) rect makes `useScroll` report a degenerate range
 * and the value freezes. So we resolve the img's nearest non-positioned-by-us
 * ancestor (the hero section) into `sectionRef` after mount, and track THAT.
 * Motion reads `sectionRef.current` lazily on each scroll/resize, so populating
 * it in a layout effect is enough.
 *
 * No blank edge: the IMAGE OVER-SCAN is owned by CSS (each hero img class sets
 * `inset: -10% 0; height: 120%` so the image is taller than the clipped hero).
 * The parallax translate (≤12%) stays inside that headroom, so no empty edge is
 * ever revealed at the top or bottom. Keeping the over-scan in CSS lets a hero's
 * mobile media query reset positioning (e.g. the country masthead, whose img
 * becomes an in-flow banner on small screens) without the component fighting it.
 *
 * Safety rails (mirrored from Reveal):
 *   • `prefers-reduced-motion` → render a plain, static <img> with no transform.
 *   • SSR / pre-mount → render with NO transform (resting position), so first
 *     paint is correct and there is never a window read during render. The
 *     transform only attaches once mounted on the client.
 *   • When a dark-mode asset is supplied, both images keep the same hero class
 *     and the global theme-image CSS swaps them via `data-theme`.
 */

import {
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { themedDecorativeImageStyle } from "@/components/ThemedDecorativeImage";

/** True only on the client (false during SSR + first hydration render). Lets us
 *  keep the transform off the SSR HTML so first paint matches the resting pose. */
const emptySubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client
    () => false, // server
  );
}

/* Max downward drift, as a % of the image's own height, at intensity 1. The CSS
   over-scan is 20% (±10% headroom), so any value < 20 keeps the drift inside the
   over-scan and prevents a blank edge. 12% is a quiet, editorial amount. */
const BASE_DRIFT_PCT = 12;

function ParallaxImageLayer({
  src,
  darkSrc,
  className,
  alt = "",
  intensity = 1,
  style,
  ...rest
}: {
  src: string;
  /** A themed asset is rendered once as a CSS background, not as two images. */
  darkSrc?: string | null;
  /** Carries the existing classes that own position/over-scan, object-fit,
   *  and object-position — always pass the hero img's original className. */
  className?: string;
  /** Decorative by default. */
  alt?: string;
  /** Scales the drift. 1 ≈ 12% over the hero's scroll; <1 calmer, >1 stronger. */
  intensity?: number;
  style?: CSSProperties;
  /** Passthrough (aria-hidden, loading, fetchPriority, …). */
  [prop: string]: unknown;
}) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  const elementRef = useRef<HTMLElement | null>(null);
  const themed = Boolean(darkSrc);
  const elementClassName = [
    themed ? "civica-themed-image" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const imageStyle = themed
    ? themedDecorativeImageStyle(src, darkSrc, style)
    : style;
  const { "aria-hidden": ariaHidden = true, ...elementProps } = rest;

  // Scroll target = the hero SECTION (the img's parent), a stable non-moving box.
  const sectionRef = useRef<HTMLElement | null>(null);

  // Resolve the hero section once mounted. A semantic <figure> may sit between
  // the image and section; tracking the figure would fail when it uses
  // display:contents to preserve the hero grid.
  // on scroll/resize, so setting it here (before paint) is sufficient.
  useLayoutEffect(() => {
    sectionRef.current = elementRef.current?.closest("section") ?? null;
  }, []);

  // Track the hero section's scroll: 0 when its top meets the viewport top, 1
  // when its bottom does.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Map progress → a small downward drift. The CSS over-scan starts the image
  // pulled UP by 10%; this drifts it down by `driftPct`, staying inside the
  // bottom headroom so no blank edge is revealed.
  const driftPct = Math.min(18, BASE_DRIFT_PCT * intensity);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", `${driftPct}%`]);

  // Reduced-motion OR pre-mount → plain static asset, no transform.
  // (Pre-mount keeps the SSR HTML transform-free; CSS owns the resting pose.)
  if (reduce || !mounted) {
    if (themed) {
      return (
        <span
          ref={(node) => {
            elementRef.current = node;
          }}
          className={elementClassName}
          style={imageStyle}
          aria-hidden={ariaHidden as boolean | "true" | "false"}
          {...elementProps}
        />
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={(node) => {
          elementRef.current = node;
        }}
        className={elementClassName}
        src={src}
        alt={alt}
        style={imageStyle}
        aria-hidden={ariaHidden as boolean | "true" | "false"}
        {...elementProps}
      />
    );
  }

  if (themed) {
    return (
      <motion.span
        ref={(node) => {
          elementRef.current = node;
        }}
        className={elementClassName}
        style={{ y, ...imageStyle }}
        aria-hidden={ariaHidden as boolean | "true" | "false"}
        {...elementProps}
      />
    );
  }

  return (
    <motion.img
      ref={(node) => {
        elementRef.current = node;
      }}
      className={elementClassName}
      src={src}
      alt={alt}
      style={{ y, ...imageStyle }}
      aria-hidden={ariaHidden as boolean | "true" | "false"}
      {...elementProps}
    />
  );
}

export function ParallaxImage(props: Parameters<typeof ParallaxImageLayer>[0]) {
  return <ParallaxImageLayer {...props} />;
}
