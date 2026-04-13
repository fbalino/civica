import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLinks } from "@/components/NavLinks";
import { MobileNav } from "@/components/MobileNav";
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

export const metadata: Metadata = {
  title: "Civica — Atlas of Governance",
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
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}
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
          <header className="w-full border-b border-[var(--color-border)] sticky top-0 z-40 bg-[var(--color-surface)]/92 backdrop-blur-sm">
            <div className="wide-container flex items-center justify-between py-4">
              <a href="/" className="no-underline flex items-baseline gap-2">
                <span className="font-heading text-[26px] font-normal tracking-tight text-[var(--color-text-primary)]">
                  Civica
                </span>
                <span className="hidden sm:inline font-mono text-[9px] text-[var(--color-text-tertiary)] tracking-[0.15em] uppercase">
                  Atlas of governance
                </span>
              </a>
              <div className="hidden md:flex items-center gap-1">
                <NavLinks />
                <div className="ml-4">
                  <ThemeToggle />
                </div>
              </div>
              <div className="flex md:hidden items-center gap-2">
                <ThemeToggle />
                <MobileNav />
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--color-border)] mt-16">
            <div className="wide-container py-10">
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div>
                  <span className="font-heading text-xl text-[var(--color-text-primary)]">Civica</span>
                  <p className="font-mono text-[11px] text-[var(--color-text-tertiary)] mt-2 leading-relaxed">
                    Data from Wikidata (CC0), IPU Parline, Constitute Project, CIA World Factbook (archived)
                  </p>
                  <div className="flex gap-3 mt-3">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-text-tertiary)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-source-live)]" />
                      Live source
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-text-tertiary)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-source-frozen)]" />
                      Archived (Jan 2026)
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[11px] text-[var(--color-text-tertiary)] md:text-right">
                  <div className="flex gap-3 md:justify-end">
                    <a href="/countries" className="hover:text-[var(--color-text-secondary)] transition-colors no-underline text-[var(--color-text-tertiary)]">Countries</a>
                    <span>&middot;</span>
                    <a href="/compare" className="hover:text-[var(--color-text-secondary)] transition-colors no-underline text-[var(--color-text-tertiary)]">Compare</a>
                    <span>&middot;</span>
                    <a href="/rankings" className="hover:text-[var(--color-text-secondary)] transition-colors no-underline text-[var(--color-text-tertiary)]">Rankings</a>
                  </div>
                  <div className="mt-1.5 flex gap-3 md:justify-end">
                    <a href="/about" className="hover:text-[var(--color-text-secondary)] transition-colors no-underline text-[var(--color-text-tertiary)]">About</a>
                    <span>&middot;</span>
                    <a href="/about" className="hover:text-[var(--color-text-secondary)] transition-colors no-underline text-[var(--color-text-tertiary)]">Sources</a>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
