import type { Metadata } from "next";
import { Source_Serif_4, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalSearchWrapper } from "@/components/GlobalSearchWrapper";
import { CivicaLogo, CivicaLogoSprite } from "@/components/CivicaLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DevDesignMount } from "@/components/dev/DevDesignMount";
import { OG_IMAGES, OG_DEFAULT_IMAGE } from "@/lib/og";
import { JsonLd } from "@/lib/seo/json-ld";
import { buildOrganization, buildWebSite } from "@/lib/seo/jsonld";
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
    default: "Civica Atlas — How Every Country Is Governed",
    template: "%s · Civica Atlas",
  },
  // PUBLIC_CLAIM: metadata.default-atlas-scope
  description:
    "Civica Atlas is a provenance-first comparative reference to how every country is governed, with source-linked country profiles, institutions, constitutions, and elections.",
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
    siteName: "Civica Atlas",
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
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${inter.variable}`}
      // The root scroller uses NO CSS smooth scrolling (globals.css sets
      // `scroll-behavior: auto`) so the router's scroll-to-top on navigation
      // is always instant and can never be canceled mid-animation by the new
      // page's render. In-page smooth scrolling is JS-driven with explicit
      // `behavior: "smooth"` where wanted. Do not reintroduce a global
      // `scroll-behavior: smooth` — it strands readers mid-page after
      // navigation (observed on both mobile and desktop).
      suppressHydrationWarning
    >
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* The Civica mark geometry, emitted once per document as a hidden
            <symbol>. Every <CivicaLogo> below is a lightweight <use> reference,
            so the ~228 KB vector is inlined once instead of ~3× per view. */}
        <CivicaLogoSprite />
        {/* Site-wide structured data: publisher Organization + WebSite. One
            <script type="application/ld+json"> per node. Next injects the
            metadata tags into <head> itself. */}
        <JsonLd data={[buildOrganization(), buildWebSite()]} />
        <ThemeProvider>
          <SiteHeader
            searchSlot={<GlobalSearchWrapper />}
            logoSlot={<CivicaLogo size={40} />}
            logoSlotSmall={<CivicaLogo size={26} />}
          />

          <main style={{ flex: 1 }}>{children}</main>

          <SiteFooter />
          <DevDesignMount />
        </ThemeProvider>
      </body>
    </html>
  );
}
