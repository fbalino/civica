import type { Metadata } from "next";
import Link from "next/link";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { getCIRankings } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Civica Widget Gallery — Embed a governance score anywhere",
  description:
    "Grab a ready-to-embed Civica Index score widget for any country. Three sizes, light/dark themes, one-line iframe snippet.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/widget" },
};

const DEFAULT_SLUG = "denmark";

interface LandingRow {
  slug: string;
  rank: number;
}

async function resolveDefaultSlug(): Promise<string> {
  try {
    const rows = (await getCIRankings()) as unknown as LandingRow[];
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.slug) {
      return rows[0].slug;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SLUG;
}

export default async function CivicaIndexWidgetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawSlug = typeof sp?.c === "string" ? sp.c : null;
  const { countries } = await loadAtlasData();
  const match = rawSlug ? slugToCountry(rawSlug, countries) : null;
  const slug = match?.slug ?? (await resolveDefaultSlug());
  const country = slugToCountry(slug, countries);
  const countryName = country?.name ?? slug;

  const embedSrc = `/embed/${slug}?size=md`;

  return (
    <div className="widget-gallery">
      <div className="widget-container">
        <section className="widget-hero">
          <div className="widget-hero-eyebrow">
            Civica Widgets · Embed anywhere
          </div>
          <h1 className="widget-hero-title">
            A Civica Index score, ready for your site.
          </h1>
          <p className="widget-hero-lede">
            Drop a one-line iframe into any page and show the live
            governance score for{" "}
            <strong>{countryName}</strong> — or{" "}
            <Link href="/civica-index/widget">any country</Link>. Three
            sizes, light or dark, updated quarterly with the rest of
            the Civica Index.
          </p>
        </section>

        <section className="widget-preview-section" aria-label="Live widget preview">
          <div className="widget-preview-eyebrow">Preview · Medium (320×180)</div>
          <div className="widget-preview-frame">
            <iframe
              src={embedSrc}
              title={`${countryName} Civica Index widget`}
              width={320}
              height={180}
              style={{ border: "1px solid var(--color-card-border)" }}
              loading="lazy"
            />
          </div>
          <p className="widget-preview-note">
            Three sizes and theme/dimension toggles land in the next
            commits. This scaffold just proves the pane wiring.
          </p>
        </section>
      </div>

      <style>{`
        .widget-gallery {
          background: var(--color-bg);
          min-height: 100vh;
        }
        .widget-container {
          max-width: var(--max-w-content, 1200px);
          margin: 0 auto;
          padding: 40px var(--spacing-page-x) 60px;
        }
        .widget-hero { padding-bottom: 28px; border-bottom: 1px solid var(--color-divider); }
        .widget-hero-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 12px;
        }
        .widget-hero-title {
          font-family: var(--font-heading);
          font-size: var(--text-32);
          font-weight: 400;
          letter-spacing: var(--tracking-tighter);
          line-height: 1.08;
          color: var(--color-text-primary);
          margin: 0 0 14px;
          text-wrap: balance;
        }
        .widget-hero-lede {
          font-size: var(--text-14);
          color: var(--color-text-60);
          line-height: 1.55;
          margin: 0;
          max-width: 640px;
        }
        .widget-hero-lede a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .widget-hero-lede a:hover { text-decoration: underline; }

        .widget-preview-section { padding-top: 28px; }
        .widget-preview-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 12px;
        }
        .widget-preview-frame {
          display: inline-block;
          background: var(--color-card-bg);
          padding: 16px;
          border-radius: var(--radius-sm);
        }
        .widget-preview-note {
          margin-top: 14px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          color: var(--color-text-25);
          max-width: 520px;
        }
      `}</style>
    </div>
  );
}
