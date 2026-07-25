import type { ReactNode } from "react";
import Link from "next/link";
import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

/**
 * PageHero — the ONE canonical page hero for every browse/landing surface.
 *
 * Owner mandate (2026-07-06, after repeated hero drift): every reader
 * browse/landing page shares ONE hero shell. The frame never varies — same
 * full-bleed band, same shared `--hero-height`, same 1200px inner column, same
 * eyebrow → serif H1 → dek type scale, same optional engraving + scrim, same
 * on-mount stagger. Only the CONTENT (eyebrow text, title, dek, and the
 * optional search / chips / stats slots) changes per page.
 *
 * This composes the canonical `.factbook-landing-hero` + `.factbook-hero-*`
 * class family (styled in `src/app/factbook.css` / `globals.css`) — the exact
 * shell the homepage, /country, and /about already use — so any page moved onto
 * it renders IDENTICAL to those. Given the same content it is pixel-for-pixel
 * the current /about hero.
 *
 * Exclusions (do NOT use PageHero here): `/blog` + `/blog/*` keep their
 * editorial nameplate, and every methodology page uses `methodology-layout` +
 * `ReaderSidebar`. Those are documented in DESIGN.md's "Picking the layout"
 * table and the Hero subsection.
 *
 * Server component: `HeroReveal` / `HeroRevealItem` / `ParallaxImage` are the
 * "use client" motion primitives, but PageHero itself only composes them, so it
 * stays a server component and can be dropped straight into any server page.
 * When the hero content is interactive (a live search box, filter chips wired
 * to client state — /country, /parties), render PageHero from inside that
 * page's existing client component and pass the interactive nodes as slots.
 */
export interface PageHeroProps {
  /** Small-caps terracotta eyebrow above the title (e.g. "Countries"). */
  eyebrow?: ReactNode;
  /** The serif H1. Required — every hero has a title. */
  title: ReactNode;
  /** The standfirst / dek paragraph under the title. */
  description?: ReactNode;
  /**
   * Optional background engraving (light asset). When set, the parallax
   * engraving + left-protecting scrim render behind the content, exactly like
   * /country and /about. Omit for pages with no dedicated engraving — the hero
   * renders clean on paper with no image, no scrim.
   */
  engraving?: {
    /** Light-mode asset, e.g. "/engravings/pages/about.webp". */
    src: string;
    /** Optional dark-mode asset; CSS swaps by theme when present. */
    darkSrc?: string | null;
  };
  /**
   * Optional search slot — rendered in the canonical hero search position
   * under the dek (max-width column, raised search field). Pass the page's
   * `<CountrySearchCombobox>` / `<GlobalSearch>` etc.
   */
  search?: ReactNode;
  /**
   * Optional chips / filter row slot — rendered under the search in the
   * canonical hero chip position (e.g. region quick-filters).
   */
  chips?: ReactNode;
  /**
   * Accessible name for an interactive chip collection. When provided, the
   * canonical chip wrapper becomes the semantic group so slot consumers do
   * not need a nested layout wrapper that can break gap and wrapping.
   */
  chipsAriaLabel?: string;
  /**
   * Optional trailing slot for any extra hero content (a stat strip, an
   * advanced-filter bar, CTAs). Rendered last, inside the same stagger, so it
   * inherits the on-mount reveal. Prefer the dedicated `search` / `chips` slots
   * where they fit; use this for anything else.
   */
  children?: ReactNode;
  /**
   * Accessible id for the H1, wired to the section's `aria-labelledby`.
   * Defaults to "page-hero-title"; override when a page has more than one
   * labelled landmark or needs a stable anchor id.
   */
  titleId?: string;
  /**
   * Element the title renders as. Defaults to "h1" — every real page hero
   * IS that page's single h1. The ONE sanctioned exception is `/design-system`,
   * which renders a live PageHero instance purely as a component swatch (the
   * page's actual h1 is its own page title); that call site passes a
   * non-heading tag so the swatch doesn't introduce a second h1. Do not pass
   * anything other than "h1" from a real page.
   */
  titleAs?: "h1" | "p" | "div";
  /** Extra className on the outer <section> (rare — layout escape hatch). */
  className?: string;
}

export function PageHero({
  eyebrow,
  title,
  description,
  engraving,
  search,
  chips,
  chipsAriaLabel,
  children,
  titleId = "page-hero-title",
  titleAs = "h1",
  className,
}: PageHeroProps) {
  const sectionClass = ["factbook-landing-hero", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClass} aria-labelledby={titleId}>
      {engraving ? (
        <>
          <ParallaxImage
            className="factbook-hero-art"
            src={engraving.src}
            darkSrc={engraving.darkSrc ?? null}
            alt=""
            aria-hidden="true"
          />
          <div className="factbook-hero-scrim" aria-hidden="true" />
        </>
      ) : null}

      <HeroReveal className="factbook-hero-inner">
        {eyebrow != null ? (
          <HeroRevealItem className="factbook-hero-eyebrow">
            {eyebrow}
          </HeroRevealItem>
        ) : null}

        <HeroRevealItem as={titleAs} id={titleId} className="factbook-hero-title">
          {title}
        </HeroRevealItem>

        {description != null ? (
          <HeroRevealItem as="p" className="factbook-hero-dek">
            {description}
          </HeroRevealItem>
        ) : null}

        {search != null ? (
          <HeroRevealItem className="factbook-hero-search">
            {search}
          </HeroRevealItem>
        ) : null}

        {chips != null ? (
          <HeroRevealItem
            className="factbook-hero-chips"
            role={chipsAriaLabel ? "group" : undefined}
            aria-label={chipsAriaLabel}
          >
            {chips}
          </HeroRevealItem>
        ) : null}

        {children != null ? <HeroRevealItem>{children}</HeroRevealItem> : null}

        {engraving ? (
          <HeroRevealItem className="page-hero-art-disclosure">
            <span>Editorial illustration ·</span>
            <Link href="/licensing#imagery">AI-assisted, non-documentary</Link>
          </HeroRevealItem>
        ) : null}
      </HeroReveal>
    </section>
  );
}
