import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXPLORE_NAV_GROUPS } from "../exploreNavItems";
import { INDEX_NAV_ITEMS } from "../indexNavItems";
import { METHODOLOGY_NAV_ITEMS } from "../methodologyNavItems";
import { EDITORIAL_NAV_ITEMS } from "../editorialNavItems";

/**
 * EXP-018 drift lock.
 *
 * The desktop "Explore" megamenu (`NavLinks.tsx`) and the mobile menu
 * (`MobileNav.tsx`) are both driven by the same four destination lists —
 * `EXPLORE_NAV_GROUPS`, `INDEX_NAV_ITEMS`, `METHODOLOGY_NAV_ITEMS`, and
 * `EDITORIAL_NAV_ITEMS` — imported from a single canonical module each.
 * `href` is the natural unique identifier for every entry (it is already
 * used as the React `key` on both surfaces).
 *
 * This fixture:
 *  1. Proves the four shared lists are well-formed (unique, internal hrefs;
 *     non-empty labels) — the actual "destination set" data.
 *  2. Proves both `NavLinks.tsx` and `MobileNav.tsx` import every list from
 *     its one canonical module and consume it unmodified (a direct
 *     `.map(...)` call or an unmodified prop-pass), so the rendered
 *     destination set, order, and labels can never fork between desktop
 *     and mobile.
 *  3. Guards against reintroducing a hand-duplicated destination list (the
 *     shape of the bug this task fixed: `TRAILING_LINKS` on desktop vs.
 *     `EDITORIAL_LINKS` on mobile, two independently authored arrays with
 *     the same hrefs).
 *  4. Checks the one external link that lives inside these primary/mobile
 *     nav surfaces (the mobile menu's status-page link) carries the
 *     required `target`/`rel` security attributes, and that none of the
 *     four shared destination lists silently contain an unhandled
 *     absolute-URL entry.
 *  5. Checks the Explore item's accessible name — built from `item.label`
 *     then `item.description`, in that order, with no overriding
 *     `aria-label` — is constructed identically on both surfaces.
 *
 * Source-backed and pure: no rendering, no DOM, no jsdom dependency.
 */

const NAV_LINKS_PATH = join(process.cwd(), "src/components/NavLinks.tsx");
const MOBILE_NAV_PATH = join(process.cwd(), "src/components/MobileNav.tsx");
const EXPLORE_PANEL_PATH = join(
  process.cwd(),
  "src/components/ExploreMenuPanel.tsx",
);

const navLinksSrc = readFileSync(NAV_LINKS_PATH, "utf8");
const mobileNavSrc = readFileSync(MOBILE_NAV_PATH, "utf8");
const explorePanelSrc = readFileSync(EXPLORE_PANEL_PATH, "utf8");

const EXPLORE_ITEMS = EXPLORE_NAV_GROUPS.flatMap((g) => g.items);

type HrefLabelled = { href: string; label: string };

function assertWellFormedList(name: string, items: readonly HrefLabelled[]) {
  assert.ok(items.length > 0, `${name} must not be empty`);
  const hrefs = items.map((i) => i.href);
  assert.deepEqual(
    hrefs,
    Array.from(new Set(hrefs)),
    `${name} hrefs must be unique (href is the nav item id)`,
  );
  for (const item of items) {
    assert.ok(
      item.href.startsWith("/"),
      `${name} entry "${item.href}" must be an internal route (starts with "/")`,
    );
    assert.ok(
      item.label.trim().length > 0,
      `${name} entry "${item.href}" must have a non-empty label`,
    );
  }
}

test("shared destination lists are well-formed (unique internal hrefs, non-empty labels)", () => {
  assertWellFormedList("EXPLORE_NAV_GROUPS items", EXPLORE_ITEMS);
  assertWellFormedList("INDEX_NAV_ITEMS", INDEX_NAV_ITEMS);
  assertWellFormedList("METHODOLOGY_NAV_ITEMS", METHODOLOGY_NAV_ITEMS);
  assertWellFormedList("EDITORIAL_NAV_ITEMS", EDITORIAL_NAV_ITEMS);
});

test("no shared destination list contains an unhandled external href", () => {
  // None of the four primary/mobile nav destination lists carry an
  // absolute-URL entry today. Neither NavLinks.tsx nor MobileNav.tsx opens
  // these items with target/rel handling, so an external href slipped in
  // here would silently render as a same-tab internal-style link. Lock the
  // current all-internal state; adding an external destination must come
  // with rendering support and an update to this test.
  for (const [name, items] of [
    ["EXPLORE_NAV_GROUPS items", EXPLORE_ITEMS],
    ["INDEX_NAV_ITEMS", INDEX_NAV_ITEMS],
    ["METHODOLOGY_NAV_ITEMS", METHODOLOGY_NAV_ITEMS],
    ["EDITORIAL_NAV_ITEMS", EDITORIAL_NAV_ITEMS],
  ] as const) {
    for (const item of items) {
      assert.ok(
        !/^https?:\/\//.test(item.href),
        `${name} entry "${item.href}" is an absolute URL; primary/mobile nav rendering has no external-link handling for these lists`,
      );
    }
  }
});

function importsNamedFrom(src: string, importedName: string, modulePath: string): boolean {
  const escapedPath = modulePath.replace(/\//g, "\\/");
  const re = new RegExp(
    `import\\s*(?:type\\s*)?\\{[^}]*\\b${importedName}\\b[^}]*\\}\\s*from\\s*["']${escapedPath}["']`,
  );
  return re.test(src);
}

const CANONICAL_MODULES: Array<{ name: string; module: string }> = [
  { name: "EXPLORE_NAV_GROUPS", module: "@/components/exploreNavItems" },
  { name: "INDEX_NAV_ITEMS", module: "@/components/indexNavItems" },
  { name: "METHODOLOGY_NAV_ITEMS", module: "@/components/methodologyNavItems" },
  { name: "EDITORIAL_NAV_ITEMS", module: "@/components/editorialNavItems" },
];

test("desktop nav (NavLinks.tsx) imports every destination list from its one canonical module", () => {
  for (const { name, module } of CANONICAL_MODULES) {
    assert.ok(
      importsNamedFrom(navLinksSrc, name, module),
      `NavLinks.tsx must import ${name} from "${module}"`,
    );
  }
});

test("mobile nav (MobileNav.tsx) imports every destination list from its one canonical module", () => {
  for (const { name, module } of CANONICAL_MODULES) {
    assert.ok(
      importsNamedFrom(mobileNavSrc, name, module),
      `MobileNav.tsx must import ${name} from "${module}"`,
    );
  }
});

test("desktop Explore renders the shared panel with the canonical groups unmodified", () => {
  assert.ok(
    importsNamedFrom(
      navLinksSrc,
      "ExploreMenuPanel",
      "@/components/ExploreMenuPanel",
    ),
    'NavLinks.tsx must import ExploreMenuPanel from "@/components/ExploreMenuPanel"',
  );
  assert.match(
    navLinksSrc,
    /<ExploreMenuPanel[\s\S]*?\bgroups=\{\s*EXPLORE_NAV_GROUPS\s*\}[\s\S]*?\/>/,
    "NavLinks.tsx must pass the canonical Explore groups directly to the shared panel",
  );
  assert.ok(
    !/<ExploreNavArtwork\b/.test(navLinksSrc),
    "NavLinks.tsx must not recreate Explore cards or artwork outside the shared panel",
  );
});

test("shared Explore panel maps canonical groups/items directly and derives both themed asset paths from item.art", () => {
  assert.ok(
    importsNamedFrom(
      explorePanelSrc,
      "EXPLORE_NAV_GROUPS",
      "@/components/exploreNavItems",
    ),
    'ExploreMenuPanel.tsx must import EXPLORE_NAV_GROUPS from "@/components/exploreNavItems"',
  );
  assert.match(
    explorePanelSrc,
    /\bgroups\s*=\s*EXPLORE_NAV_GROUPS\b/,
    "ExploreMenuPanel must default to the canonical Explore groups",
  );
  assert.match(
    explorePanelSrc,
    /\bgroups\.map\(/,
    "ExploreMenuPanel must map the supplied groups directly",
  );
  assert.match(
    explorePanelSrc,
    /\bgroup\.items\.map\(/,
    "ExploreMenuPanel must map each canonical item list directly",
  );
  assert.match(
    explorePanelSrc,
    /src=\{`\/engravings\/navigation\/explore-\$\{item\.art\}\.webp`\}/,
    "light artwork paths must derive from the canonical item.art basename",
  );
  assert.match(
    explorePanelSrc,
    /darkSrc=\{`\/engravings\/navigation\/explore-\$\{item\.art\}-dark\.webp`\}/,
    "dark artwork paths must derive from the same canonical item.art basename",
  );
  assert.match(
    explorePanelSrc,
    /<span className=\{className\} aria-hidden="true">/,
    "Explore artwork must remain decorative and outside the accessible name",
  );
});

function consumesUnmodified(src: string, ident: string): boolean {
  // Either the identifier is mapped over directly (`IDENT.map(`), or it is
  // handed unmodified to a shared renderer as a prop (`items={IDENT}`).
  // Either shape guarantees the rendered set/order/labels are exactly the
  // imported array's — no independent filter/sort/slice fork.
  const directMap = new RegExp(`\\b${ident}\\.map\\(`);
  const propPass = new RegExp(`=\\{\\s*${ident}\\s*\\}`);
  return directMap.test(src) || propPass.test(src);
}

test("both surfaces consume every shared list unmodified (direct map or unmodified prop-pass)", () => {
  for (const { name } of CANONICAL_MODULES) {
    assert.ok(
      consumesUnmodified(navLinksSrc, name),
      `NavLinks.tsx must render ${name} directly (.map or unmodified prop), not a filtered/sorted copy`,
    );
    assert.ok(
      consumesUnmodified(mobileNavSrc, name),
      `MobileNav.tsx must render ${name} directly (.map or unmodified prop), not a filtered/sorted copy`,
    );
  }
});

test("neither surface re-declares a shared identifier locally (no shadow copy)", () => {
  for (const { name } of CANONICAL_MODULES) {
    const localDeclRe = new RegExp(`\\bconst\\s+${name}\\s*=`);
    assert.ok(
      !localDeclRe.test(navLinksSrc),
      `NavLinks.tsx must not locally redeclare ${name}`,
    );
    assert.ok(
      !localDeclRe.test(mobileNavSrc),
      `MobileNav.tsx must not locally redeclare ${name}`,
    );
  }
});

test("neither surface hand-duplicates a canonical destination as an inline object literal", () => {
  // This is the exact shape of the drift this task fixed: `TRAILING_LINKS`
  // on desktop and `EDITORIAL_LINKS` on mobile were two independently
  // authored `{ href: "...", label: "..." }` arrays covering the same two
  // destinations. Guard against a canonical href being reintroduced as a
  // hardcoded object-literal property (`href: "..."`) rather than read off
  // the shared array (`href={item.href}` / `href={href}`).
  const canonicalHrefs = new Set([
    ...EXPLORE_ITEMS.map((i) => i.href),
    ...INDEX_NAV_ITEMS.map((i) => i.href),
    ...METHODOLOGY_NAV_ITEMS.map((i) => i.href),
    ...EDITORIAL_NAV_ITEMS.map((i) => i.href),
  ]);
  const literalHrefPattern = /href:\s*["']([^"']+)["']/g;

  for (const [label, src] of [
    ["NavLinks.tsx", navLinksSrc],
    ["MobileNav.tsx", mobileNavSrc],
  ] as const) {
    const offenders: string[] = [];
    for (const match of src.matchAll(literalHrefPattern)) {
      const href = match[1];
      if (canonicalHrefs.has(href)) offenders.push(href);
    }
    assert.deepEqual(
      offenders,
      [],
      `${label} hardcodes a canonical destination href as an object literal instead of reading it from the shared array: ${offenders.join(", ")}`,
    );
  }

  // The retired duplicated-array identifiers must not reappear.
  assert.ok(!/\bTRAILING_LINKS\b/.test(navLinksSrc), "NavLinks.tsx must not reintroduce TRAILING_LINKS");
  assert.ok(!/\bEDITORIAL_LINKS\b/.test(mobileNavSrc), "MobileNav.tsx must not reintroduce EDITORIAL_LINKS");
});

test("the mobile menu's external status link carries target=_blank and rel=noopener noreferrer", () => {
  const statusTagMatch = mobileNavSrc.match(
    /<a\b[^>]*\bhref="https:\/\/statuspage\.incident\.io\/civica-atlas"[^>]*>/,
  );
  assert.ok(statusTagMatch, "expected to find the mobile menu status-page link");
  const tag = statusTagMatch![0];
  assert.match(tag, /target="_blank"/, "status link must open in a new tab");
  assert.match(
    tag,
    /rel="noopener noreferrer"/,
    "status link must carry rel=\"noopener noreferrer\"",
  );
});

function extractEnclosingTag(src: string, uniqueMarker: string, tag: string): string {
  const markerIndex = src.indexOf(uniqueMarker);
  assert.ok(markerIndex !== -1, `expected to find "${uniqueMarker}"`);
  const openIndex = src.lastIndexOf(`<${tag}`, markerIndex);
  const closeIndex = src.indexOf(`</${tag}>`, markerIndex);
  assert.ok(
    openIndex !== -1 && closeIndex !== -1,
    `expected an enclosing <${tag}>...</${tag}> around "${uniqueMarker}"`,
  );
  return src.slice(openIndex, closeIndex + tag.length + 3);
}

test("Explore item accessible name (label then description) is built identically on both surfaces, with no aria-label override", () => {
  const desktopBlock = extractEnclosingTag(
    explorePanelSrc,
    "<ExploreNavArtwork",
    "Link",
  );
  const mobileBlock = extractEnclosingTag(mobileNavSrc, "mobile-menu__spot", "Link");

  for (const [name, block] of [
    ["desktop", desktopBlock],
    ["mobile", mobileBlock],
  ] as const) {
    assert.ok(block.includes("{item.label}"), `${name} Explore item must render {item.label}`);
    assert.ok(
      block.includes("{item.description}"),
      `${name} Explore item must render {item.description}`,
    );
    assert.ok(
      block.indexOf("{item.label}") < block.indexOf("{item.description}"),
      `${name} Explore item must announce label before description`,
    );
    assert.ok(
      !block.includes("aria-label"),
      `${name} Explore item link must not override its text-content accessible name with aria-label`,
    );
  }
});
