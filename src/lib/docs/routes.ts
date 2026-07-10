/**
 * App-route filesystem scanner + redirect-destination matcher
 * (CLM-009 §6). DB-free, network-free, deterministic: walks
 * `src/app` on disk and returns the URL patterns it finds.
 *
 * Deliberately does NOT import `next.config.ts` (that file imports
 * this module's sibling `redirects.ts`, and importing the config back
 * would create a cycle plus pull in Next's config-loading machinery —
 * exactly the kind of broad module trace Turbopack already warns
 * about). Callers pass `REDIRECTS` from `src/lib/routing/redirects.ts`
 * directly.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export interface AppRoute {
  /** URL segments in Next.js filesystem syntax, e.g.
   *  ["country", "[slug]", "civica-data"]. Route-group segments
   *  (`(name)`) and parallel-route slots (`@name`) are already
   *  stripped/excluded. */
  segments: string[];
  /** Repo-relative path to the page.tsx/route.ts file. */
  file: string;
  type: "page" | "route";
}

const DEFAULT_APP_DIR = path.resolve(process.cwd(), "src/app");

/**
 * Recursively walk an App Router directory and collect every
 * page/route file as an `AppRoute`. Route groups `(name)` don't
 * contribute a URL segment; parallel-route slots `@name` are skipped
 * entirely (Civica has none as of CLM-009, but the skip is cheap
 * insurance against a future reintroduction).
 */
export async function scanAppRoutes(
  rootDir: string = DEFAULT_APP_DIR,
): Promise<AppRoute[]> {
  const routes: AppRoute[] = [];

  async function walk(dir: string, segments: string[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("@")) continue;
        const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
        const nextSegments = isGroup ? segments : [...segments, entry.name];
        await walk(path.join(dir, entry.name), nextSegments);
      } else if (entry.isFile()) {
        if (entry.name === "page.tsx" || entry.name === "page.ts") {
          routes.push({
            segments,
            file: relFromRoot(path.join(dir, entry.name)),
            type: "page",
          });
        } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
          routes.push({
            segments,
            file: relFromRoot(path.join(dir, entry.name)),
            type: "route",
          });
        }
      }
    }
  }

  await walk(rootDir, []);
  return routes;
}

function relFromRoot(abs: string): string {
  return path.relative(process.cwd(), abs).split(path.sep).join("/");
}

// ─────────────────────────────────────────────────────────────────────
// Segment classification
// ─────────────────────────────────────────────────────────────────────

type RouteSegmentKind = "static" | "dynamic" | "catchall" | "optionalCatchall";

function routeSegmentKind(seg: string): RouteSegmentKind {
  if (/^\[\[\.\.\..+\]\]$/.test(seg)) return "optionalCatchall";
  if (/^\[\.\.\..+\]$/.test(seg)) return "catchall";
  if (/^\[.+\]$/.test(seg)) return "dynamic";
  return "static";
}

type DestSegmentKind = "static" | "dynamic" | "wildcard";

/** Classify one path segment of a redirect DESTINATION (Next.js
 *  `:param` / `:param*` syntax, not filesystem bracket syntax). */
function destSegmentKind(seg: string): DestSegmentKind {
  if (!seg.startsWith(":")) return "static";
  return seg.endsWith("*") ? "wildcard" : "dynamic";
}

/** Split a path into segments, stripping any query string or hash
 *  fragment first (those don't affect which page/route file serves
 *  the request). */
export function pathSegments(urlPath: string): string[] {
  const withoutHash = urlPath.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  return withoutQuery.split("/").filter(Boolean);
}

/** True if any segment of the destination is a Next.js `:param*`
 *  multi-segment wildcard (e.g. `/civica-index/:path*`). These splice
 *  in whatever the SOURCE pattern's wildcard matched, so the resolved
 *  target can be any of many pages under that prefix — not one
 *  concrete route. Per CLM-009 §6 ("skip dynamic JSX expressions
 *  rather than guessing"), the validator skips structural resolution
 *  for these instead of asserting something it can't determine. */
export function destinationHasWildcardSegment(destination: string): boolean {
  return pathSegments(destination).some(
    (seg) => destSegmentKind(seg) === "wildcard",
  );
}

/**
 * Structural match between one filesystem route's segments and one
 * redirect destination's segments (already split via `pathSegments`).
 *
 *   - static route segment  → destination segment must be the SAME
 *     static literal (a `:param` there would be a real bug: a runtime
 *     value can't literally equal a fixed path segment).
 *   - dynamic route segment (`[slug]`) → destination segment may be
 *     ANY concrete literal (e.g. "/organizations/un" resolving into
 *     `organizations/[slug]`) or a `:param` passthrough — both are
 *     valid concrete instances of a dynamic segment.
 *   - catchall / optional catchall route segment → absorbs all
 *     remaining destination segments (a required catchall needs at
 *     least one remaining segment; optional does not).
 *
 * Segment counts must otherwise match exactly.
 */
export function routeMatchesDestinationSegments(
  routeSegments: readonly string[],
  destSegments: readonly string[],
): boolean {
  let di = 0;
  for (let ri = 0; ri < routeSegments.length; ri++) {
    const kind = routeSegmentKind(routeSegments[ri]);
    if (kind === "catchall" || kind === "optionalCatchall") {
      const remaining = destSegments.length - di;
      if (kind === "catchall" && remaining < 1) return false;
      return true;
    }
    if (di >= destSegments.length) return false;
    const dSeg = destSegments[di];
    if (kind === "static") {
      if (destSegmentKind(dSeg) !== "static") return false;
      if (dSeg !== routeSegments[ri]) return false;
    }
    // kind === "dynamic": any destination segment kind is acceptable.
    di++;
  }
  return di === destSegments.length;
}

/**
 * Segments of `destSegments` up to (excluding) the first non-static
 * segment. Empty if the destination has no dynamic/wildcard segment,
 * or if its very first segment already is one.
 */
function staticPrefixSegments(destSegments: readonly string[]): string[] {
  const firstDynamicIdx = destSegments.findIndex(
    (seg) => destSegmentKind(seg) !== "static",
  );
  return firstDynamicIdx === -1
    ? [...destSegments]
    : destSegments.slice(0, firstDynamicIdx);
}

/**
 * Is one filesystem route's leading segments COMPATIBLE with a
 * destination's static prefix (the literal segments before its first
 * `:param`/`:param*`)? A route's dynamic/catchall segment at a prefix
 * position is compatible with anything (per
 * `routeMatchesDestinationSegments`'s "dynamic accepts any concrete
 * value" rule); a route's static segment must equal the prefix
 * literal exactly; a route shorter than the prefix (with no
 * catch-all to absorb the rest) is not compatible.
 */
function routePrefixCompatible(
  routeSegments: readonly string[],
  prefix: readonly string[],
): boolean {
  for (let i = 0; i < prefix.length; i++) {
    if (i >= routeSegments.length) return false;
    const kind = routeSegmentKind(routeSegments[i]);
    if (kind === "catchall" || kind === "optionalCatchall") return true;
    if (kind === "dynamic") continue;
    if (routeSegments[i] !== prefix[i]) return false;
  }
  return true;
}

/**
 * Does ANY known route's static-prefix "family" plausibly reach the
 * destination's own static prefix? Used to distinguish a genuinely
 * ambiguous dynamic passthrough (skip) from a destination whose
 * static lead-in doesn't correspond to any route at all (stale).
 */
function anyRoutePlausiblePrefix(
  prefix: readonly string[],
  routes: readonly AppRoute[],
): boolean {
  return routes.some((route) => routePrefixCompatible(route.segments, prefix));
}

/**
 * Does this redirect destination resolve to at least one known app
 * route?
 *
 *   - `true`  — a route structurally matches.
 *   - `false` — either (a) the destination is fully static (no
 *     `:param` segments at all) and no route matches, or (b) the
 *     destination has a dynamic/wildcard segment but NO known route
 *     even shares its static prefix — there is no route family this
 *     could plausibly resolve into, so it is unambiguously stale, not
 *     merely ambiguous. (CLM-009 bounded-repair F3: closes the
 *     "any `:param` automatically skips" blind spot — a destination
 *     like `/totally-fake-route/:path*`, where no route starts with
 *     `totally-fake-route`, now fails instead of silently skipping.)
 *   - `"skipped"` — the destination contains a `:param` or `:param*`
 *     segment, didn't fully structurally match, but DOES share a
 *     plausible route family's static prefix. This is deliberately
 *     NOT reported as a failure: some Civica redirects forward a
 *     captured legacy value into a small set of enumerated static
 *     children (e.g. `/country/vatican/:tab` →
 *     `/country/holy-see-vatican-city/:tab`, where `/country/[slug]`
 *     has no `[tab]` segment — only the literal
 *     `civica-data`/`constitution` children — so whether the
 *     forwarded value resolves depends on the runtime-captured value,
 *     not on anything the filesystem alone can confirm). Asserting
 *     pass/fail here would be guessing; per CLM-009 §6 the validator
 *     skips instead and reports the skip explicitly rather than
 *     silently dropping it.
 *
 * Known bounded limitation: if a destination's VERY FIRST segment is
 * already dynamic/wildcard (empty static prefix), `anyRoutePlausiblePrefix`
 * is trivially satisfied by any route at all, so such a destination
 * can never be classified `false` here. None of Civica's current
 * redirects have this shape (every dynamic segment follows at least
 * one static segment); a future one with a bare leading `:param`
 * would need a stronger check than this structural pass affords.
 */
export function destinationResolves(
  destination: string,
  routes: readonly AppRoute[],
): boolean | "skipped" {
  const destSegments = pathSegments(destination);
  const hasDynamicSegment = destSegments.some(
    (seg) => destSegmentKind(seg) !== "static",
  );
  const matched = routes.some((route) =>
    routeMatchesDestinationSegments(route.segments, destSegments),
  );
  if (matched) return true;
  if (hasDynamicSegment) {
    const prefix = staticPrefixSegments(destSegments);
    return anyRoutePlausiblePrefix(prefix, routes) ? "skipped" : false;
  }
  return false;
}
