import Link from "next/link";
import {
  Building2,
  Flag,
  Globe2,
  Landmark,
  ListOrdered,
  Map,
  Scale,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { ExploreMenuDemo } from "./ExploreMenuDemo";
import { EXPLORE_NAV_GROUPS } from "@/components/exploreNavItems";

const EMBLEM_BY_HREF: Record<string, LucideIcon> = {
  "/country": Flag,
  "/atlas": Globe2,
  "/compare": Scale,
  "/constitution": ScrollText,
  "/parties": Landmark,
  "/elections": Building2,
  "/rankings": ListOrdered,
  "/organizations": Map,
};

/**
 * EXP-014's three read-only directions. These are not a second navigation
 * implementation: they are browser-rendered decision mockups, all driven by
 * the shared destination identity used by the current desktop/mobile menus.
 */
export function ExploreConceptDemos() {
  return (
    <div className="explore-concepts" data-testid="explore-concept-mockups">
      <section
        className="explore-concept explore-concept--index"
        aria-labelledby="explore-concept-index-title"
        data-concept="typography-first-scholarly-index"
      >
        <ConceptIntro
          number="Direction 01"
          title="The scholarly index"
          description="A quiet typographic register: the atlas reads like a reference index before it reads like a product menu."
          titleId="explore-concept-index-title"
        />
        <nav className="explore-index" aria-label="Scholarly index Explore concept">
          {EXPLORE_NAV_GROUPS.map((group) => (
            <section className="explore-index__group" key={group.label}>
              <h5>{group.label}</h5>
              <ul>
                {group.items.map((item, index) => (
                  <li key={item.href}>
                    <Link href={item.href}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </section>

      <section
        className="explore-concept explore-concept--emblems"
        aria-labelledby="explore-concept-emblems-title"
        data-concept="emblem-led-compact-menu"
      >
        <ConceptIntro
          number="Direction 02"
          title="The civic cabinet"
          description="A compact array of named destinations led by functional line emblems, with every destination still explicit in text."
          titleId="explore-concept-emblems-title"
        />
        <nav className="explore-emblem-grid" aria-label="Emblem-led Explore concept">
          {EXPLORE_NAV_GROUPS.flatMap((group) =>
            group.items.map((item) => {
              const Icon = EMBLEM_BY_HREF[item.href];
              return (
                <Link className="explore-emblem" href={item.href} key={item.href}>
                  <Icon aria-hidden="true" focusable="false" />
                  <span>{item.label}</span>
                </Link>
              );
            }),
          )}
        </nav>
      </section>

      <section
        className="explore-concept explore-concept--reading-room"
        aria-labelledby="explore-concept-reading-room-title"
        data-concept="editorial-mega-menu"
      >
        <ConceptIntro
          number="Direction 03"
          title="The reading room"
          description="A two-register editorial menu, pairing named destinations with brief descriptions and existing spot engravings."
          titleId="explore-concept-reading-room-title"
        />
        <ExploreMenuDemo />
      </section>
    </div>
  );
}

function ConceptIntro({
  number,
  title,
  description,
  titleId,
}: {
  number: string;
  title: string;
  description: string;
  titleId: string;
}) {
  return (
    <div className="explore-concept__intro">
      <p className="explore-concept__number">{number}</p>
      <h4 id={titleId}>{title}</h4>
      <p>{description}</p>
    </div>
  );
}
