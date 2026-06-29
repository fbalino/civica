"use client";

/**
 * Reveal — the project's single, restrained entrance-animation primitive.
 *
 * Civica is a fine-press almanac: editorial, quiet, ivory-paper calm. On a 1–10
 * motion dial this lives at a 3 — motion you feel but barely notice. The only
 * gestures here are a small fade + rise as content scrolls into view (or, for
 * the hero, on mount), with a gentle stagger so a group reads in sequence.
 *
 * Hard rules baked in:
 *   • `prefers-reduced-motion` → render plain, fully-visible elements (no opacity:0).
 *   • FAIL-SAFE / NO-JS: the hidden `initial` state is only applied AFTER mount
 *     (see `useHasMounted`). Until then we pass `initial={false}`, so Motion
 *     server-renders the element at its RESTING (visible) state — the SSR HTML
 *     contains NO `opacity:0`. If JS never loads or hydration fails, everything
 *     is fully visible; nothing can be trapped invisible above the fold.
 *     Crucially we keep the SAME motion element across hydration (no plain→motion
 *     remount), so Motion's in-view IntersectionObserver attaches normally and
 *     fires even for elements already on screen at load.
 *   • `whileInView` + `once` for scroll reveals — they end visible, never re-hide.
 *   • Animate ONLY transform + opacity (GPU-friendly).
 *   • Timing mirrors the design tokens: --motion-ease-out = cubic-bezier(.16,1,.3,1).
 */

import {
  useSyncExternalStore,
  type ElementType,
  type ReactNode,
} from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

/* Canonical timing — kept in sync with --motion-ease-out / --motion-slower
   in globals.css. (Motion needs JS numbers/arrays, not CSS var() strings.) */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const REVEAL_DURATION = 0.55;
const STAGGER_STEP = 0.08;

/** True only on the client (false during SSR and the first hydration render).
 *  Lets us keep `opacity:0` out of the SSR/no-JS HTML so content is never
 *  trapped invisible. Implemented with `useSyncExternalStore` — the React-19
 *  recommended way to read a client-only flag without a setState-in-effect. */
const emptySubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}

/* Shared variants for the scroll-reveal stagger group. */
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER_STEP } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: REVEAL_DURATION, ease: EASE_OUT },
  },
};

/* ── <Reveal> ────────────────────────────────────────────────────────────
   A single element that fades + rises as it scrolls into view, once. Use for
   standalone blocks (a feature row, a lead story, a section). For a sequenced
   group, prefer <Stagger> + <StaggerItem>. */
export function Reveal({
  as = "div",
  delay = 0,
  amount = 0.25,
  className,
  children,
  ...rest
}: {
  /** Element to render (div, section, li, article…). */
  as?: ElementType;
  /** Extra delay in seconds before this element animates. */
  delay?: number;
  /** Fraction of the element that must be in view before it reveals. */
  amount?: number;
  className?: string;
  children?: ReactNode;
  /** Passthrough DOM attributes (id, role, aria-*, style, …). */
  [prop: string]: unknown;
}) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  if (reduce) {
    const Tag = as as ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      // Pre-mount: initial={false} → render at the visible resting state (no
      // opacity:0 in SSR). Post-mount: start hidden, then reveal on scroll-in.
      initial={mounted ? { opacity: 0, y: 16 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: REVEAL_DURATION, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

/* ── <Stagger> + <StaggerItem> ───────────────────────────────────────────
   A container whose children reveal in sequence on scroll-into-view. Parent
   owns the orchestration via `variants` + `staggerChildren`; each child opts in
   with <StaggerItem>. Parent and children MUST live in the same client tree. */
export function Stagger({
  as = "div",
  amount = 0.2,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  /** Fraction of the container in view before the sequence starts. */
  amount?: number;
  className?: string;
  children?: ReactNode;
  /** Passthrough DOM attributes (id, role, aria-*, style, …). */
  [prop: string]: unknown;
}) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  if (reduce) {
    const Tag = as as ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      variants={containerVariants}
      initial={mounted ? "hidden" : false}
      whileInView="show"
      viewport={{ once: true, amount }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({
  as = "div",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  /** Passthrough DOM attributes (id, role, aria-*, style, …). */
  [prop: string]: unknown;
}) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  if (reduce) {
    const Tag = as as ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      variants={itemVariants}
      // Pre-mount the item shows its resting state so SSR has no opacity:0;
      // once mounted it picks up the parent's hidden→show orchestration.
      initial={mounted ? undefined : false}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

/* ── <HeroReveal> + <HeroRevealItem> ─────────────────────────────────────
   On-MOUNT entrance for above-the-fold hero content (eyebrow → title → dek →
   search → chips), rising + fading in with a gentle stagger on page load.
   Uses initial/animate (not whileInView) because the hero is already visible.
   Reduced motion → plain static elements; pre-mount → resting/visible. */
export function HeroReveal({
  as = "div",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  /** Passthrough DOM attributes (id, role, aria-*, style, …). */
  [prop: string]: unknown;
}) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  if (reduce) {
    const Tag = as as ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
      }}
      initial={mounted ? "hidden" : false}
      animate="show"
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

export function HeroRevealItem({
  as = "div",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  /** Passthrough DOM attributes (id, role, aria-*, style, …). */
  [prop: string]: unknown;
}) {
  const reduce = useReducedMotion();
  const mounted = useHasMounted();
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  if (reduce) {
    const Tag = as as ElementType;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: REVEAL_DURATION, ease: EASE_OUT },
        },
      }}
      initial={mounted ? undefined : false}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
