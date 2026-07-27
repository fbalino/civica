"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { INDEX_NAV_ITEMS } from "@/components/indexNavItems";
import { METHODOLOGY_NAV_ITEMS } from "@/components/methodologyNavItems";
import {
  EXPLORE_NAV_GROUPS,
  type ExploreNavItem,
} from "@/components/exploreNavItems";
import { ExploreNavArtwork } from "@/components/ExploreMenuPanel";
import { EDITORIAL_NAV_ITEMS } from "@/components/editorialNavItems";
import { ThemedDecorativeImage } from "@/components/ThemedDecorativeImage";
import {
  isGovernanceEvidenceGroupActive,
  isMethodologyGroupActive,
} from "@/components/navActiveState";

const UTILITY_LINKS = [
  { href: "/about#sources", label: "Sources" },
  { href: "/api-docs", label: "API" },
  { href: "/contact", label: "Contact" },
  { href: "/licensing", label: "Licensing" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

function useIsActive(pathname: string) {
  return (href: string) => {
    const path = href.split("#")[0];
    if (!path) return false;
    return path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`);
  };
}

export function MobileNav({
  searchSlot,
  logoSlot,
}: {
  searchSlot?: ReactNode;
  logoSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="mobile-menu-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="civica-full-menu"
      >
        <span aria-hidden="true" className="mobile-menu-trigger__lines">
          <span />
          <span />
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <MenuOverlay
            dialogRef={dialogRef}
            closeRef={closeRef}
            onClose={() => setOpen(false)}
            pathname={pathname}
            searchSlot={searchSlot}
            logoSlot={logoSlot}
          />,
          document.body,
        )}
    </>
  );
}

function MenuOverlay({
  dialogRef,
  closeRef,
  onClose,
  pathname,
  searchSlot,
  logoSlot,
}: {
  dialogRef: RefObject<HTMLDivElement | null>;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  pathname: string;
  searchSlot?: ReactNode;
  logoSlot?: ReactNode;
}) {
  const isActive = useIsActive(pathname);

  return (
    <div
      ref={dialogRef}
      id="civica-full-menu"
      className="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
    >
      <div className="mobile-menu__art" aria-hidden="true">
        <ThemedDecorativeImage
          className="mobile-menu__art-image"
          src="/engravings/hero.webp"
          darkSrc="/engravings/hero-dark.webp"
        />
      </div>
      <div className="mobile-menu__wash" aria-hidden="true" />

      <header className="mobile-menu__header">
        <Link className="mobile-menu__brand" href="/">
          {logoSlot}
          <span>Civica Atlas</span>
        </Link>
        <span className="mobile-menu__folio">Navigation · Reference atlas</span>
        <div className="mobile-menu__header-actions">
          <ThemeToggle />
          <button
            ref={closeRef}
            type="button"
            className="mobile-menu__close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <span>Close</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
            >
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mobile-menu__canvas">
        <section className="mobile-menu__explore" aria-labelledby="menu-explore-title">
          <div className="mobile-menu__intro mobile-menu__reveal">
            <span className="mobile-menu__eyebrow">Explore Civica</span>
            <h2 id="menu-explore-title">Every government. One atlas.</h2>
            <p>Countries, institutions, evidence, and the documents behind them.</p>
          </div>
          {searchSlot ? (
            <div className="mobile-menu__search mobile-menu__reveal">{searchSlot}</div>
          ) : null}
          <div className="mobile-menu__explore-groups mobile-menu__reveal">
            {EXPLORE_NAV_GROUPS.map((group) => (
              <div className="mobile-menu__explore-group" key={group.label}>
                <p className="mobile-menu__group-label">{group.label}</p>
                <nav aria-label={group.label}>
                  {group.items.map((item) => (
                    <ExploreLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                    />
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </section>

        <aside className="mobile-menu__reading-room">
          <MenuLinkGroup
            title="Governance Evidence"
            href="/governance-evidence"
            items={INDEX_NAV_ITEMS}
            isActive={isActive}
            groupActive={isGovernanceEvidenceGroupActive(pathname)}
          />
          <MenuLinkGroup
            title="Methodology"
            href="/methodology"
            items={METHODOLOGY_NAV_ITEMS}
            isActive={isActive}
            groupActive={isMethodologyGroupActive(pathname)}
          />
          <nav className="mobile-menu__editorial-links" aria-label="Editorial">
            {EDITORIAL_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? "is-active" : ""}
              >
                <span>{item.label}</span>
                <small>{item.descriptor}</small>
              </Link>
            ))}
          </nav>
        </aside>
      </div>

      <footer className="mobile-menu__footer">
        <a
          className="mobile-menu__status"
          href="https://statuspage.incident.io/civica-atlas"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true" />
          All systems operational
        </a>
        <nav className="mobile-menu__utility" aria-label="Reference and legal">
          {UTILITY_LINKS.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <span className="mobile-menu__edition">Civica Atlas · 2026 edition</span>
      </footer>
    </div>
  );
}

function ExploreLink({
  item,
  active,
}: {
  item: ExploreNavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`mobile-menu__explore-link${active ? " is-active" : ""}`}
    >
      <ExploreNavArtwork item={item} className="mobile-menu__spot" />
      <span className="mobile-menu__explore-copy">
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </span>
      <ArrowUpRight
        className="mobile-menu__arrow"
        aria-hidden="true"
        focusable="false"
      />
    </Link>
  );
}

function MenuLinkGroup({
  title,
  href,
  items,
  isActive,
  groupActive,
}: {
  title: string;
  href: string;
  items: ReadonlyArray<{ href: string; label: string; descriptor: string }>;
  isActive: (href: string) => boolean;
  groupActive: boolean;
}) {
  return (
    <section className="mobile-menu__link-group mobile-menu__reveal">
      <Link
        className={`mobile-menu__link-group-title${groupActive ? " is-active" : ""}`}
        href={href}
      >
        {title}<span aria-hidden="true">→</span>
      </Link>
      <nav aria-label={title}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "is-active" : ""}
          >
            <span>{item.label}</span>
            <small>{item.descriptor}</small>
          </Link>
        ))}
      </nav>
    </section>
  );
}
