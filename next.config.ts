import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* cacheComponents: true — re-enable after adding `use cache` to data functions */
  async redirects() {
    return [
      {
        source: "/preview",
        destination: "/",
        permanent: true,
      },
      {
        source: "/index",
        destination: "/civica-index",
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
      // Phase C — tab consolidation 8 → 6.
      // Chamber folded into Structure (the house toggle now lives there).
      {
        source: "/atlas/:slug/chamber",
        destination: "/atlas/:slug/structure",
        permanent: true,
      },
      // Democracy folded into Scores & Rankings.
      {
        source: "/atlas/:slug/democracy",
        destination: "/atlas/:slug/scores",
        permanent: true,
      },
      // Elections at the country level retired; the global /elections
      // page is the canonical home for the elections directory.
      {
        source: "/atlas/:slug/elections",
        destination: "/elections",
        permanent: true,
      },
      // Phase 5.10 polish — the legacy v1 changelog page reads from
      // pulse_changelog / pulse_daily_scores tables that are no longer
      // surfaced post-cut-over. Public users get the v2 changelog at
      // /civica-index/pulse-changelog. Preserve any external links.
      {
        source: "/civica-index/changelog",
        destination: "/civica-index/pulse-changelog",
        permanent: true,
      },
      // Phase D.2 — /factbook is the new canonical country reader.
      // The legacy /countries/[slug] parent page stays live (per the
      // factbook plan §2.2), but the per-tab sub-routes redirect into
      // the matching factbook section anchor. /countries/[slug]/outcomes
      // is intentionally NOT redirected — Outcomes is postponed pending
      // a methodology project, so the legacy page is the only home for
      // peer-band data right now.
      {
        source: "/countries/:slug/leaders",
        destination: "/factbook/:slug#leaders",
        permanent: true,
      },
      {
        source: "/countries/:slug/democracy",
        destination: "/factbook/:slug#scores",
        permanent: true,
      },
      {
        source: "/countries/:slug/constitution",
        destination: "/atlas/:slug/constitution",
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
      // Crawler-trap neutralization (2026-05-07). Bots ignored robots.txt
      // and kept hammering filter-permutation URLs on these two pages,
      // burning Vercel function invocations. Redirects run at the Vercel
      // edge with no function invocation and no DB query — defense that
      // works regardless of bot compliance. The pages still exist in code
      // and can be reached via the canonical URLs once we re-architect to
      // a non-trap shape (e.g. paginated cursor instead of filter combos).
      {
        source: "/factbook/methodology/reconciliation/disputes",
        destination: "/factbook/methodology/reconciliation#disputes",
        permanent: false,
      },
      {
        source: "/factbook/methodology/reconciliation/disputes/:path*",
        destination: "/factbook/methodology/reconciliation#disputes",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
