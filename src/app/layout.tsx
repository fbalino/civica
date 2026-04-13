import type { Metadata } from "next";
import { IBM_Plex_Serif, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLinks } from "@/components/NavLinks";
import { MobileNav } from "@/components/MobileNav";
import "./globals.css";

const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-ibm-plex-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Civica — World Government Atlas",
  description:
    "An interactive platform visualizing government structures for every country in the world. A modern successor to the CIA World Factbook.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSerif.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}else{d.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <ThemeProvider>
          <header className="w-full border-b border-[var(--color-border)] sticky top-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-sm">
            <div className="full-bleed-container flex items-center justify-between h-14">
              <a href="/" className="font-heading text-xl font-medium tracking-tight text-[var(--color-text-primary)] no-underline hover:text-[var(--color-text-primary)]">
                Civica
              </a>
              <div className="hidden md:flex items-center gap-6">
                <NavLinks />
                <ThemeToggle />
              </div>
              <div className="flex md:hidden items-center gap-2">
                <ThemeToggle />
                <MobileNav />
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--color-border)] mt-[var(--spacing-section)]">
            <div className="full-bleed-container py-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <span className="font-heading text-lg font-medium text-[var(--color-text-primary)]">
                    Civica
                  </span>
                  <p className="mt-2 text-sm text-[var(--color-text-tertiary)] leading-relaxed max-w-xs">
                    An open reference to the world&rsquo;s governments, political systems, and country data.
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Explore
                  </span>
                  <nav className="mt-3 flex flex-col gap-2">
                    <a href="/countries" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline">Countries</a>
                    <a href="/rankings" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline">Rankings</a>
                    <a href="/about" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors no-underline">About</a>
                  </nav>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Sources
                  </span>
                  <nav className="mt-3 flex flex-col gap-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Wikidata (CC0)</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">CIA World Factbook (PD)</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">IPU Parline</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">Constitute Project</span>
                  </nav>
                </div>
              </div>
              <hr className="border-[var(--color-border-muted)] my-8" />
              <p className="text-xs text-[var(--color-text-tertiary)] text-center">
                Civica &mdash; Open data for open governments
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
