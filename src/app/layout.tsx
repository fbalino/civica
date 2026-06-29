import type { Metadata } from "next";
import Link from "next/link";
import { Source_Serif_4, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalSearchWrapper } from "@/components/GlobalSearchWrapper";
import { CivicaLogo } from "@/components/CivicaLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { DevDesignMount } from "@/components/dev/DevDesignMount";
import { tier1Publishers } from "@/lib/content/site-state";
import { OG_IMAGES, OG_DEFAULT_IMAGE } from "@/lib/og";
import "./globals.css";
import "./editorial.css";
import "./atlas.css";
import "./home.css";
import "./shell.css";
import "./civica-index.css";
import "./civica-index-detail.css";
import "./factbook.css";
import "./civica-chat.css";
import "@/components/dev/dev-design.css";

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

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

// Canonical host. The apex `civicaatlas.org` is the production domain and is
// what every other surface already declares — sitemap.ts, robots.ts,
// api-docs, and every per-page `alternates.canonical`. Keeping the apex here
// keeps all of those consistent. (Making the apex serve 200 instead of
// 307-redirecting to www is a hosting/next.config concern handled separately.)
const SITE_URL = "https://civicaatlas.org";

// The default social-share image (1200x630) and its alt text now live in
// `@/lib/og` so the ~17 pages that override `openGraph` can share one source
// of truth. Resolved against `metadataBase` to an absolute apex URL; colours
// are baked into the asset from the live design tokens — no hex lives in code.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Civica — Interactive Atlas of World Government Structures | 250+ Countries",
    template: "%s | Civica",
  },
  description:
    "Explore how every country in the world is governed. Interactive visualizations of government structures, branches of power, and political systems for 250+ nations. The modern successor to the CIA World Factbook.",
  // Default self-referencing canonical on the apex host. The relative "./"
  // resolves to the CURRENT route against `metadataBase` (Next runs it through
  // `path.posix.resolve(pathname, "./")`), so every page that doesn't set its
  // own `alternates.canonical` — most importantly the atlas country pages,
  // which previously emitted no canonical at all — gets a correct
  // `https://civicaatlas.org/<route>` canonical instead of an inconsistent or
  // missing one. Pages that declare an absolute canonical override this.
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    siteName: "Civica",
    locale: "en_US",
    images: OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_DEFAULT_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tier1ShippedShortNames = tier1Publishers
    .filter((p) => p.shipped)
    .map((p) => p.shortName);
  const footerSourceList = [
    ...NON_TIER1_FOOTER_SOURCES,
    ...tier1ShippedShortNames,
  ].join(", ");

  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
      </head>
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ThemeProvider>
          <SiteHeader
            searchSlot={<GlobalSearchWrapper />}
            logoSlot={<CivicaLogo size={40} />}
            logoSlotSmall={<CivicaLogo size={26} />}
          />

          <main style={{ flex: 1 }}>{children}</main>

          <footer className="site-footer">
            <div className="site-footer__inner">
              <div className="site-footer__brand">
                <div className="site-footer__mark">
                  <CivicaLogo size={28} />
                  <span>Civica</span>
                </div>
                <p className="site-footer__source">
                  Sources include {footerSourceList}.
                </p>
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
              </div>

              <nav className="site-footer__links" aria-label="Footer navigation">
                <Link href="/blog">Blog</Link>
                <span>&middot;</span>
                <Link href="/api-docs">API Docs</Link>
                <span>&middot;</span>
                <Link href="/design-system">Design System</Link>
                <span>&middot;</span>
                <a
                  href="https://statuspage.incident.io/civica-atlas"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Status Page
                </a>
                <span>&middot;</span>
                <Link href="/licensing">Licensing</Link>
                <span>&middot;</span>
                <Link href="/contact">Contact</Link>
                <span>&middot;</span>
                <a
                  href="https://github.com/fbalino/civica"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                <span>&middot;</span>
                <Link href="/about">About</Link>
                <span>&middot;</span>
                <Link href="/about#sources">Sources</Link>
              </nav>
            </div>
          </footer>
          <DevDesignMount />
        </ThemeProvider>
      </body>
    </html>
  );
}
