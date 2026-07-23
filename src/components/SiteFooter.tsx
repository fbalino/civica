import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { CivicaLogo } from "@/components/CivicaLogo";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { tier1Publishers } from "@/lib/content/site-state";
import { RIGHTS_REGISTRY_PATH } from "@/lib/claims/reuse-rights";
import { getAllJurisdictions } from "@/lib/db/queries";
import { readCachedFieldFromRow } from "@/lib/factbook/reconcile/api";

// Per-request memoized so the footer's country list is fetched at most once
// per render pass. (The header search fetches the same rows; deduping those
// two callsites needs a `cache()` wrapper at the `getAllJurisdictions` query
// layer, which lives outside this component.)
const getFooterCountries = cache(getAllJurisdictions);

// Sources NOT covered by `tier1Publishers` — supporting feeds,
// governance specialists, and indices. Update by hand when a major
// new non-Tier-1 source lands. Tier-1 publishers are appended below
// from `tier1Publishers.filter(p => p.shipped)`.
const NON_TIER1_FOOTER_SOURCES = [
  "CIA World Factbook (archived)",
  "Wikidata",
  "Wikimedia Commons",
  "V-Dem",
  "IPU Parline",
  "Constitute Project",
  "BR/CGV",
  "Freedom House",
  "Transparency CPI",
  "Global Peace Index",
  "Fragile States Index",
  "GDELT",
] as const;

// Footer link taxonomy. Every internal href is verified to resolve to a real
// route under `src/app`; external destinations open in a new tab. The four
// AGENTS.md footer invariants (Blog, API Docs, Design System, Status Page,
// Licensing, Contact, GitHub) all appear below and must survive refactors.
type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Explore",
    links: [
      { label: "Evidence Dashboard", href: "/governance-evidence" },
      { label: "Governance Change", href: "/governance-change" },
      { label: "Countries", href: "/country" },
      { label: "Parties", href: "/parties" },
      { label: "World Atlas", href: "/atlas" },
      { label: "Compare", href: "/compare" },
      { label: "Elections", href: "/elections" },
      { label: "Electoral Systems", href: "/elections/systems" },
      { label: "Rankings", href: "/rankings" },
      { label: "Conditions", href: "/civica-conditions" },
      { label: "Organizations", href: "/organizations" },
      { label: "Glossary", href: "/glossary" },
    ],
  },
  {
    title: "Governance Evidence",
    links: [
      { label: "Evidence Dashboard", href: "/governance-evidence" },
      { label: "Research Status", href: "/civica-index" },
      { label: "Index Methodology", href: "/civica-index/methodology" },
      { label: "The Pulse", href: "/civica-index/methodology/pulse" },
      { label: "Pulse Changelog", href: "/civica-index/pulse-changelog" },
      { label: "Replication", href: "/civica-index/replication" },
      { label: "Corrections", href: "/civica-index/corrections" },
      { label: "Report a Data Issue", href: "/report-data-issue" },
    ],
  },
  {
    title: "Research",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Our Approach", href: "/methodology/approach" },
      {
        label: "Data Reconciliation",
        href: "/country/methodology/reconciliation",
      },
      { label: "Atlas Case Studies", href: "/methodology/case-studies" },
      {
        label: "Peer Grouping",
        href: "/civica-index/methodology/peer-grouping",
      },
      { label: "Policies", href: "/policies" },
      { label: "The Record (Blog)", href: "/blog" },
      { label: "API Docs", href: "/api-docs" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "About", href: "/about" },
      { label: "Advisory Board", href: "/about/advisory-board" },
      { label: "Contact", href: "/contact" },
      { label: "Accessibility", href: "/accessibility" },
      { label: "Licensing", href: "/licensing" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Design System", href: "/design-system" },
      {
        label: "Status Page",
        href: "https://statuspage.incident.io/civica-atlas",
        external: true,
      },
      {
        label: "GitHub",
        href: "https://github.com/fbalino/civica",
        external: true,
      },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (link.external) {
    return (
      <li>
        <a href={link.href} target="_blank" rel="noopener noreferrer">
          {link.label}
          <span className="site-footer__ext" aria-hidden="true">
            {" ↗"}
          </span>
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={link.href}>{link.label}</Link>
    </li>
  );
}

export async function SiteFooter() {
  const tier1ShippedShortNames = tier1Publishers
    .filter((p) => p.shipped)
    .map((p) => p.shortName);
  const footerSourceList = [
    ...NON_TIER1_FOOTER_SOURCES,
    ...tier1ShippedShortNames,
  ].join(", ");

  // Real, working country search — fed by the same jurisdictions query the
  // header search uses. Soft-fails to an empty list so the footer still
  // renders when the DB is unreachable.
  let countries: {
    slug: string;
    name: string;
    iso2: string | null;
    capital: string | null;
  }[] = [];
  try {
    const all = await getFooterCountries();
    countries = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      capital: readCachedFieldFromRow(c, "capital"),
    }));
  } catch {}

  return (
    <footer className="site-footer">
      <section
        className="site-footer__trust"
        aria-label="Civica commitments and source publishers"
      >
        <div className="site-footer__trust-inner">
          <div className="site-footer__trust-copy">
            <h2>Accessible. Traceable. Nonpartisan.</h2>
            <p>
              Civica Atlas is free to access. Reuse terms vary by source; see{" "}
              <Link href={RIGHTS_REGISTRY_PATH}>Licensing</Link> for the
              current rights posture.
            </p>
          </div>

          <div className="site-footer__trust-rule" aria-hidden="true" />

          <div className="site-footer__sources-feature">
            <p>Source publishers include:</p>
            <Image
              className="site-footer__source-logo-strip theme-engraving-light"
              src="/engravings/trusted-source-logos.webp"
              width={2000}
              height={126}
              alt="World Bank, IMF, United Nations, V-Dem Institute, and Freedom House"
            />
            <Image
              className="site-footer__source-logo-strip theme-engraving-dark"
              src="/engravings/trusted-source-logos-dark.webp"
              width={2000}
              height={126}
              alt="World Bank, IMF, United Nations, V-Dem Institute, and Freedom House"
            />
          </div>
        </div>
      </section>

      <div className="site-footer__inner">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <div className="site-footer__mark">
              <CivicaLogo size={28} />
              <span>Civica Atlas</span>
            </div>

            <p className="site-footer__mission">
              {/* PUBLIC_CLAIM: home.visible-positioning */}
              Civica Atlas is a provenance-first comparative reference to how
              every country is governed.
            </p>

            <div className="site-footer__search">
              <CountrySearchCombobox
                countries={countries}
                countryPathPrefix="/country"
                placeholder="Find a country…"
                ariaLabel="Find a country"
              />
            </div>

            <div className="site-footer__legend">
              <span>
                <span className="site-footer__dot site-footer__dot--live" />
                Live source
              </span>
              <span>
                <span className="site-footer__dot site-footer__dot--frozen" />
                Archived
              </span>
            </div>

            <p className="site-footer__source">
              Sources include {footerSourceList}.
            </p>
          </div>

          <nav
            className="site-footer__nav"
            aria-label="Footer navigation"
          >
            {FOOTER_COLUMNS.map((column) => (
              <div className="site-footer__col" key={column.title}>
                <h3 className="site-footer__col-title">{column.title}</h3>
                <ul className="site-footer__col-links">
                  {column.links.map((link) => (
                    <FooterLinkItem key={link.label} link={link} />
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__copyright">
            © 2026 Civica Atlas · Source-linked data with per-source reuse terms.
          </p>
          <div className="site-footer__legal">
            <Link href="/privacy">Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link href="/licensing">Licensing</Link>
          </div>
        </div>
      </div>

      {/* The brand moment: a full-bleed CIVICA wordmark cropped flush at the
          bottom edge. Real text (var(--font-heading)), sized in viewport units
          to bleed edge-to-edge on one line, very low contrast, static, and
          hidden from assistive tech (it is pure ornament). */}
      <div className="site-footer__brandmark" aria-hidden="true">
        <span className="site-footer__brandmark-word">Civica</span>
      </div>
    </footer>
  );
}
