import type { Metadata } from "next";
import Link from "next/link";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { getCIRankings } from "@/lib/db/queries";
import { WidgetCopyButton } from "@/components/widget/WidgetCopyButton";

export const metadata: Metadata = {
  title: "Civica Widget Gallery — Embed a governance score anywhere",
  description:
    "Grab a ready-to-embed Civica Index score widget for any country. Three sizes, light/dark themes, one-line iframe snippet.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/widget" },
};

const DEFAULT_SLUG = "denmark";
const PUBLIC_ORIGIN = "https://civicaatlas.org";

const WIDGET_SIZES = [
  { key: "sm", label: "Small", width: 300, height: 80, note: "Sidebar / inline" },
  { key: "md", label: "Medium", width: 320, height: 180, note: "Card, default" },
  { key: "lg", label: "Large", width: 400, height: 260, note: "Feature block" },
] as const;

type WidgetSize = (typeof WIDGET_SIZES)[number];

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

function buildEmbedSrc(slug: string, size: WidgetSize["key"]): string {
  return `/embed/${slug}?size=${size}`;
}

function buildEmbedSnippet(
  slug: string,
  size: WidgetSize
): string {
  const src = `${PUBLIC_ORIGIN}${buildEmbedSrc(slug, size.key)}`;
  return `<iframe src="${src}" width="${size.width}" height="${size.height}" frameborder="0" loading="lazy" title="Civica Index score"></iframe>`;
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

        <section
          className="widget-sizes"
          aria-label="Widget size previews"
        >
          {WIDGET_SIZES.map((size) => {
            const snippet = buildEmbedSnippet(slug, size);
            return (
              <article
                key={size.key}
                className="widget-size-card"
                aria-labelledby={`widget-size-${size.key}`}
              >
                <header className="widget-size-head">
                  <div className="widget-size-eyebrow">
                    Preview · {size.label}
                  </div>
                  <div
                    className="widget-size-dims"
                    id={`widget-size-${size.key}`}
                  >
                    {size.width} × {size.height} · {size.note}
                  </div>
                </header>

                <div className="widget-size-frame">
                  <iframe
                    src={buildEmbedSrc(slug, size.key)}
                    title={`${countryName} Civica Index widget — ${size.label}`}
                    width={size.width}
                    height={size.height}
                    loading="lazy"
                  />
                </div>

                <div className="widget-size-snippet">
                  <code>{snippet}</code>
                </div>

                <WidgetCopyButton snippet={snippet} />
              </article>
            );
          })}
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

        .widget-sizes {
          padding-top: 28px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .widget-size-card {
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          padding: 20px;
          background: var(--color-card-bg);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .widget-size-head { display: flex; flex-direction: column; gap: 4px; }
        .widget-size-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .widget-size-dims {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-12);
          color: var(--color-text-55);
        }
        .widget-size-frame {
          display: flex;
          justify-content: center;
          padding: 20px 0;
          background: var(--color-bg);
          border: 1px dashed var(--color-card-border);
          border-radius: var(--radius-sm);
        }
        .widget-size-frame iframe {
          border: 0;
          box-shadow: var(--shadow-hard-sm, 2px 2px 0 var(--color-card-border));
        }
        .widget-size-snippet {
          background: var(--color-page-bg);
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          overflow-x: auto;
        }
        .widget-size-snippet code {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-12);
          color: var(--color-text-60);
          white-space: nowrap;
        }
        .widget-copy-btn {
          align-self: flex-start;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          padding: 9px 14px;
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          background: var(--color-bg);
          color: var(--color-text-primary);
          cursor: pointer;
          transition: background-color .15s, border-color .15s;
        }
        .widget-copy-btn:hover {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }
      `}</style>
    </div>
  );
}
