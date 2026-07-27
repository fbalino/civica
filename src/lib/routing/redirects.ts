/**
 * Civica's `next.config.ts` redirects, extracted verbatim (CLM-009 §6).
 *
 * `next.config.ts` imports this by a config-safe RELATIVE path (never
 * the `@/*` alias — Next.js loads the config file outside the app's
 * module-resolution context). This is the single source of truth for
 * every redirect rule; `src/lib/docs/routes.ts` reads it (also by
 * relative import) to validate that every redirect destination
 * resolves to a real route.
 *
 * No semantic changes from the array previously inlined in
 * `next.config.ts` — same source/destination/permanent values, same
 * order (order matters: more-specific rules must precede catch-alls).
 */

export interface CivicaRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export const REDIRECTS: CivicaRedirect[] = [
  {
    source: "/preview",
    destination: "/",
    permanent: true,
  },
  {
    source: "/index",
    destination: "/governance-evidence",
    permanent: true,
  },
  // Country-slug shortcut: /index/:slug would otherwise double-hop
  // through /civica-index/:slug before landing on the country reader.
  // The negative lookahead mirrors the /civica-index/:slug rule below
  // so real /civica-index sub-routes (methodology, government-types,
  // widget, pulse-changelog, corrections, replication, changelog) are
  // NOT misread as country slugs and still fall through to the
  // generic /index/:path* rule underneath.
  {
    source:
      "/index/:slug((?!methodology|government-types|widget|pulse-changelog|corrections|replication|changelog).+)",
    destination: "/governance-evidence?country=:slug",
    permanent: true,
  },
  {
    source: "/index/:path*",
    destination: "/civica-index/:path*",
    permanent: true,
  },
  {
    source: "/civica-index/compare",
    destination: "/compare",
    permanent: true,
  },
  {
    source: "/civica-index/compare/:path*",
    destination: "/compare/:path*",
    permanent: true,
  },
  // Legacy SEO-friendly pretty URLs: /compare/united-states-vs-france →
  // /compare?c=united-states&c=france. Preserves canonical authority
  // transfer to the new query-param-driven page.
  {
    source: "/compare/:a-vs-:b",
    destination: "/compare?c=:a&c=:b",
    permanent: true,
  },
  // Phase 5.4 — /outcomes renamed to /civica-conditions.
  // 308 (permanent redirect) transfers SEO authority to the new URL.
  {
    source: "/outcomes",
    destination: "/civica-conditions",
    permanent: true,
  },
  // Option B (Phase 2) — the duplicate atlas country + compare +
  // organizations experiences are retired. The factbook is the
  // canonical per-country reader, /compare is the canonical compare,
  // and the org explorer moved to a standalone /organizations page.
  // These redirects must precede the (now-removed) per-tab routes so
  // external links keep resolving. Order matters: the more-specific
  // /atlas/compare + /atlas/organizations rules come before the
  // catch-all /atlas/:slug/:tab.
  {
    source: "/atlas/compare",
    destination: "/compare",
    permanent: true,
  },
  {
    source: "/atlas/organizations",
    destination: "/organizations/un",
    permanent: true,
  },
  {
    source: "/atlas/organizations/:slug",
    destination: "/organizations/:slug",
    permanent: true,
  },
  // Country tabs → the unified /country/[slug] reader (covers
  // hemicycle, bills, leaders, scores, structure, sections). The
  // global /elections page remains the canonical home for elections,
  // so keep that earlier, more-specific rule winning below.
  {
    source: "/atlas/:slug/elections",
    destination: "/elections",
    permanent: true,
  },
  {
    source: "/atlas/:slug/:tab",
    destination: "/country/:slug",
    permanent: true,
  },
  {
    source: "/atlas/:slug",
    destination: "/country/:slug",
    permanent: true,
  },
  // Phase 5.10 polish — the legacy v1 changelog and scalar output relations
  // were retired post-cut-over. Public users get the v2 changelog at
  // /civica-index/pulse-changelog. Preserve any external links.
  // MUST precede the /civica-index/:slug country-detail catch-all
  // below so "changelog" is handled here rather than treated as a
  // country slug.
  {
    source: "/civica-index/changelog",
    destination: "/civica-index/pulse-changelog",
    permanent: true,
  },
  // The country page flip — /country/[slug] is now the canonical
  // per-country reader (Factbook · Civica Data · Constitution tabs).
  // The three legacy country surfaces (/factbook, /countries,
  // /civica-index/[slug]) retire into it.
  //
  // Legacy /countries/[slug] per-tab sub-routes redirect into the
  // matching /country section anchor. These specific rules MUST
  // precede the bare /countries/:slug rule below.
  {
    source: "/countries/:slug/leaders",
    destination: "/country/:slug/civica-data#leaders",
    permanent: true,
  },
  {
    source: "/countries/:slug/democracy",
    destination: "/country/:slug/civica-data#governance-evidence",
    permanent: true,
  },
  {
    source: "/countries/:slug/constitution",
    destination: "/country/:slug",
    permanent: true,
  },
  // Legacy /factbook/methodology (bare parent) — the reconciliation
  // page is the canonical methodology home. Specific rule must
  // precede the /factbook/:path* catch-all below.
  {
    source: "/factbook/methodology",
    destination: "/country/methodology/reconciliation",
    permanent: true,
  },
  // /factbook landing + every /factbook sub-path (the old country
  // detail at /factbook/[slug] and the methodology tree) move to
  // /country and /country/*.
  {
    source: "/factbook",
    destination: "/country",
    permanent: true,
  },
  {
    source: "/factbook/:path*",
    destination: "/country/:path*",
    permanent: true,
  },
  // Legacy /civica-index/[slug] country detail → the Civica Data tab
  // of the unified country page. The negative lookahead protects the
  // leaderboard sub-routes (methodology, government-types, widget,
  // pulse-changelog, corrections, replication, changelog) so they are
  // NOT treated as country slugs. Does not match /civica-index itself.
  {
    source:
      "/civica-index/:slug((?!methodology|government-types|widget|pulse-changelog|corrections|replication|changelog).+)",
    destination: "/country/:slug/civica-data",
    permanent: true,
  },
  // Legacy /countries landing + /countries/[slug] → /country.
  {
    source: "/countries",
    destination: "/country",
    permanent: true,
  },
  {
    source: "/countries/:slug",
    destination: "/country/:slug",
    permanent: true,
  },
  // /country/methodology (bare parent) → the reconciliation page,
  // the canonical methodology home for the country reader.
  {
    source: "/country/methodology",
    destination: "/country/methodology/reconciliation",
    permanent: true,
  },
  // Intuitive-slug aliases for the Holy See. Its CIA Factbook name is
  // "Holy See (Vatican City)", which the importer slugified to
  // `holy-see-vatican-city` — the canonical URL. Readers reach for
  // /country/vatican-city, /country/vatican, or /country/holy-see, all
  // of which would otherwise 404. 308 to the canonical slug.
  {
    source: "/country/vatican-city",
    destination: "/country/holy-see-vatican-city",
    permanent: true,
  },
  {
    source: "/country/vatican-city/:tab",
    destination: "/country/holy-see-vatican-city/:tab",
    permanent: true,
  },
  {
    source: "/country/vatican",
    destination: "/country/holy-see-vatican-city",
    permanent: true,
  },
  {
    source: "/country/vatican/:tab",
    destination: "/country/holy-see-vatican-city/:tab",
    permanent: true,
  },
  {
    source: "/country/holy-see",
    destination: "/country/holy-see-vatican-city",
    permanent: true,
  },
  {
    source: "/country/holy-see/:tab",
    destination: "/country/holy-see-vatican-city/:tab",
    permanent: true,
  },
  // Phase 3d (structural_family removal) — top-level
  // /government-types and /government-types/[type] pages are
  // archived per the 2026-05-02 peer-grouping resolution. The
  // educational appeal of "what's a parliamentary democracy"
  // now lives in the methodology page, where the constitutional
  // form is descriptive metadata rather than an analytical
  // taxonomy. Implementation plan §B-3d locks this redirect.
  {
    source: "/government-types",
    destination: "/civica-index/methodology/peer-grouping",
    permanent: true,
  },
  {
    source: "/government-types/:type",
    destination: "/civica-index/methodology/peer-grouping",
    permanent: true,
  },
];
