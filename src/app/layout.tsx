import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLinks } from "@/components/NavLinks";
import { MobileNav } from "@/components/MobileNav";
import { GlobalSearchWrapper } from "@/components/GlobalSearchWrapper";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500"],
});

const SITE_URL = "https://civica-kappa.vercel.app";

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
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}
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
          {/* Nav — prototype: sticky, blur, 16px 40px padding */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--spacing-nav-y) var(--spacing-page-x)",
              borderBottom: "1px solid var(--color-divider)",
              position: "sticky",
              top: 0,
              zIndex: 100,
              background: "var(--color-bg-nav)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <a href="/" style={{ cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-26)",
                  fontWeight: 400,
                  letterSpacing: "var(--tracking-tighter)",
                  color: "var(--color-text-primary)",
                }}
              >
                Civica
              </span>
              <span
                className="hidden sm:inline"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-9)",
                  color: "var(--color-text-30)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                }}
              >
                Atlas of governance
              </span>
            </a>
            <div className="hidden md:flex" style={{ alignItems: "center", gap: 4 }}>
              <NavLinks />
              <div style={{ marginLeft: 12 }}>
                <GlobalSearchWrapper />
              </div>
              <div style={{ marginLeft: 8 }}>
                <ThemeToggle />
              </div>
            </div>
            <div className="flex md:hidden" style={{ alignItems: "center", gap: 8 }}>
              <ThemeToggle />
              <MobileNav searchSlot={<GlobalSearchWrapper />} />
            </div>
          </nav>

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
                  <a href="/countries" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Countries</a>
                  <span>&middot;</span>
                  <a href="/government-types" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Gov Types</a>
                  <span>&middot;</span>
                  <a href="/compare" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Compare</a>
                  <span>&middot;</span>
                  <a href="/rankings" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Rankings</a>
                  <span>&middot;</span>
                  <a href="/blog" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Blog</a>
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <a href="/about" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>About</a>
                  <span>&middot;</span>
                  <a href="/about" style={{ color: "var(--color-text-25)", textDecoration: "none" }}>Sources</a>
                </div>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
