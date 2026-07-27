"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import {
  EXPLORE_NAV_GROUPS,
  type ExploreNavGroup,
  type ExploreNavItem,
} from "@/components/exploreNavItems";
import { ThemedDecorativeImage } from "@/components/ThemedDecorativeImage";

export function ExploreNavArtwork({
  item,
  className,
  shouldLoad = true,
}: {
  item: ExploreNavItem;
  className: string;
  shouldLoad?: boolean;
}) {
  return (
    <span className={className} aria-hidden="true">
      {shouldLoad ? (
        <ThemedDecorativeImage
          className={`${className}-image`}
          src={`/engravings/navigation/explore-${item.art}.webp`}
          darkSrc={`/engravings/navigation/explore-${item.art}-dark.webp`}
        />
      ) : null}
    </span>
  );
}

export function ExploreMenuPanel({
  shouldLoadArt,
  isActiveHref = () => false,
  onNavigate,
  idPrefix = "explore-menu",
  groups = EXPLORE_NAV_GROUPS,
}: {
  shouldLoadArt: boolean;
  isActiveHref?: (href: string) => boolean;
  onNavigate?: () => void;
  idPrefix?: string;
  groups?: readonly ExploreNavGroup[];
}) {
  return (
    <>
      <header className="explore-menu__header">
        <div>
          <p className="explore-menu__eyebrow">Explore Civica Atlas</p>
          <h2>Start with a place. Follow the evidence.</h2>
        </div>
        <p className="explore-menu__dek">
          Move from country profiles to the institutions, elections, and
          source trails that explain how government works.
        </p>
      </header>

      <div className="explore-menu__registers">
        {groups.map((group, groupIndex) => {
          const labelId = `${idPrefix}-group-${groupIndex}`;
          return (
            <section
              className="explore-register"
              aria-labelledby={labelId}
              key={group.label}
            >
              <p className="explore-register__label" id={labelId}>
                {group.label}
              </p>
              <div className="explore-register__grid">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`explore-item ${
                      isActiveHref(item.href) ? "explore-item--active" : ""
                    }`}
                    onClick={onNavigate}
                  >
                    <ExploreNavArtwork
                      item={item}
                      className="explore-item__art"
                      shouldLoad={shouldLoadArt}
                    />
                    <span className="explore-item__body">
                      <span className="explore-item__copy">
                        <span className="explore-item__name">{item.label}</span>
                        <span className="explore-item__desc">
                          {item.description}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="explore-item__arrow"
                        aria-hidden="true"
                        focusable="false"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
