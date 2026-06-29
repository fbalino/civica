"use client";

import { useEffect, useState } from "react";
import { ALPHABET } from "@/lib/data/glossary";

interface GlossaryNavProps {
  /** Uppercase letters that have at least one term (anchor targets exist). */
  activeLetters: string[];
}

/**
 * Sticky A–Z index strip with scroll-spy. Active letters link to their
 * `#letter-X` group anchor; unused letters render dimmed and inert. As the
 * reader scrolls, the strip highlights the letter group nearest the top.
 *
 * Smooth-scroll is handled by the browser via `scroll-behavior` + the anchor
 * `scroll-margin-top` set in glossary.css, so clicking a letter lands the group
 * heading just below the two sticky bars.
 */
export function GlossaryNav({ activeLetters }: GlossaryNavProps) {
  const present = new Set(activeLetters);
  const [current, setCurrent] = useState<string>(activeLetters[0] ?? "");

  useEffect(() => {
    const groups = activeLetters
      .map((letter) => document.getElementById(`letter-${letter}`))
      .filter((el): el is HTMLElement => el !== null);

    if (groups.length === 0) return;

    function onScroll() {
      // Account for the sticky header (56px) + the A–Z bar height, plus a
      // little breathing room, when deciding which group is "current".
      const probe = window.scrollY + 160;
      let active = groups[0];
      for (const group of groups) {
        if (group.offsetTop <= probe) active = group;
      }
      const letter = active.id.replace("letter-", "");
      setCurrent((prev) => (prev === letter ? prev : letter));
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [activeLetters]);

  return (
    <nav className="glossary-azbar" aria-label="Alphabetical index">
      <div className="glossary-azbar-inner">
        {ALPHABET.map((letter) => {
          const hasTerms = present.has(letter);
          if (!hasTerms) {
            return (
              <a key={letter} aria-disabled="true" className="is-off">
                {letter}
              </a>
            );
          }
          const isActive = letter === current;
          return (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className={isActive ? "is-active" : undefined}
              aria-current={isActive ? "true" : undefined}
            >
              {letter}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
