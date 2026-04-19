import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalSearchWrapper } from "@/components/GlobalSearchWrapper";
import { CivicaLogo } from "@/components/CivicaLogo";
import { AtlasHeaderProvider } from "@/context/AtlasHeaderContext";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";
import "./atlas.css";

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
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='light'||(!t&&!window.matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('light')}else{d.classList.remove('light')}}catch(e){}})()`,
          }}
        />
      </head>
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ThemeProvider>
          <AtlasHeaderProvider>
          <SiteHeader
            searchSlot={<GlobalSearchWrapper />}
            logoSlot={<CivicaLogo size={40} />}
            logoSlotSmall={<CivicaLogo size={26} />}
          />

          <main style={{ flex: 1 }}>{children}</main>

          {/* Footer — prototype: border-top, 40px padding, 60px margin-top */}
          <footer
            style={{
              borderTop: "1px solid var(--color-divider)",
              padding: "var(--spacing-page-x)",
              marginTop: 60,
            }}
          >
            <div
              style={{
                maxWidth: "var(--max-w-content)",
                margin: "0 auto",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 24,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CivicaLogo size={28} />
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "var(--text-20)",
                      fontWeight: 400,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Civica
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-11)",
                    color: "var(--color-text-25)",
                    marginTop: 8,
                  }}
                >
                  Data from Wikidata (CC0), IPU Parline, Constitute Project, CIA World Factbook (archived)
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-10)",
                      color: "var(--color-text-30)",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--color-source-live)",
                      }}
                    />
                    Live source
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-10)",
                      color: "var(--color-text-30)",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--color-source-frozen)",
                      }}
                    />
                    Archived (Jan 2026)
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-25)",
                  textAlign: "right",
                }}
              >
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <Link href="/countries" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Countries</Link>
                  <span>&middot;</span>
                  <Link href="/elections" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Elections</Link>
                  <span>&middot;</span>
                  <Link href="/government-types" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Gov Types</Link>
                  <span>&middot;</span>
                  <Link href="/compare" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Compare</Link>
                  <span>&middot;</span>
                  <Link href="/rankings" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Rankings</Link>
                  <span>&middot;</span>
                  <Link href="/blog" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>The Record</Link>
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <Link href="/about" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>About</Link>
                  <span>&middot;</span>
                  <Link href="/api-docs" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>API</Link>
                  <span>&middot;</span>
                  <Link href="/about" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Sources</Link>
                  <span>&middot;</span>
                  <Link href="/contact" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Contact</Link>
                </div>
              </div>
            </div>
          </footer>
          </AtlasHeaderProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
