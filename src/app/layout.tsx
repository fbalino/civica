import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalSearchWrapper } from "@/components/GlobalSearchWrapper";
import { CivicaLogo } from "@/components/CivicaLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { DevDesignMount } from "@/components/dev/DevDesignMount";
import { tier1Publishers } from "@/lib/content/site-state";
import "./globals.css";
import "./editorial.css";
import "./atlas.css";
import "./shell.css";
import "./civica-index.css";
import "./civica-index-detail.css";
import "./factbook.css";
import "./civica-chat.css";
import "./v2.css";
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

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  weight: "variable",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://civicaatlas.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Civica — Interactive Atlas of World Government Structures | 250+ Countries",
    template: "%s | Civica",
  },
  description:
    "Explore how every country in the world is governed. Interactive visualizations of government structures, branches of power, and political systems for 250+ nations. The modern successor to the CIA World Factbook.",
  openGraph: {
    type: "website",
    siteName: "Civica",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
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
      className={`${fraunces.variable} ${inter.variable}`}
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
                <Link href="/contact">Contact</Link>
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
