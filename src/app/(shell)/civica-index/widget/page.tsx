import type { Metadata } from "next";
import Link from "next/link";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { getCIRankings } from "@/lib/db/queries";
import { WidgetCopyButton } from "@/components/widget/WidgetCopyButton";
import { WidgetCountrySearch } from "@/components/widget/WidgetCountrySearch";
import { WidgetBuilder } from "@/components/widget/WidgetBuilder";

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
type ThemeChoice = "auto" | "light" | "dark";

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

function buildEmbedSrc(
  slug: string,
  size: WidgetSize,
  theme: ThemeChoice,
  dims: boolean
): string {
  const params = new URLSearchParams({ size: size.key });
  if (theme !== "auto") params.set("theme", theme);
  // Dimension bars only render on the large layout.
  if (dims && size.key === "lg") params.set("dims", "1");
  return `/embed/${slug}?${params.toString()}`;
}

function buildEmbedSnippet(
  slug: string,
  size: WidgetSize,
  theme: ThemeChoice,
  dims: boolean
): string {
  const src = `${PUBLIC_ORIGIN}${buildEmbedSrc(slug, size, theme, dims)}`;
  return `<iframe src="${src}" width="${size.width}" height="${size.height}" frameborder="0" loading="lazy" title="Civica Index score"></iframe>`;
}

function buildGalleryHref(params: {
  slug: string;
  theme: ThemeChoice;
  dims: boolean;
  override?: Partial<{ theme: ThemeChoice; dims: boolean }>;
}): string {
  const theme = params.override?.theme ?? params.theme;
  const dims = params.override?.dims ?? params.dims;
  const qs = new URLSearchParams({ c: params.slug });
  if (theme !== "auto") qs.set("theme", theme);
  if (dims) qs.set("dims", "1");
  return `/civica-index/widget?${qs.toString()}`;
}

export default async function CivicaIndexWidgetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawSlug = typeof sp?.c === "string" ? sp.c : null;
  const rawTheme = typeof sp?.theme === "string" ? sp.theme : null;
  const theme: ThemeChoice =
    rawTheme === "light" || rawTheme === "dark" ? rawTheme : "auto";
  const dims = sp?.dims === "1";

  const { countries } = await loadAtlasData();
  const match = rawSlug ? slugToCountry(rawSlug, countries) : null;
  const slug = match?.slug ?? (await resolveDefaultSlug());
  const country = slugToCountry(slug, countries);
  const countryName = country?.name ?? slug;

  const themeOptions: { key: ThemeChoice; label: string }[] = [
    { key: "auto", label: "Auto" },
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
  ];

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
          <WidgetCountrySearch
            countries={countries}
            currentSlug={country?.slug ?? slug}
            currentTheme={theme}
            currentDims={dims}
          />
        </section>

        <section className="widget-toolbar" aria-label="Widget appearance">
          <div className="widget-toolbar-group" role="group" aria-label="Theme">
            <span className="widget-toolbar-label">Theme</span>
            {themeOptions.map((opt) => {
              const href = buildGalleryHref({
                slug,
                theme,
                dims,
                override: { theme: opt.key },
              });
              const isActive = opt.key === theme;
              return (
                <Link
                  key={opt.key}
                  href={href}
                  className={`widget-toolbar-chip${isActive ? " on" : ""}`}
                  aria-pressed={isActive}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>

          <div className="widget-toolbar-group" role="group" aria-label="Dimension bars">
            <span className="widget-toolbar-label">
              Dimension bars <em>(Large only)</em>
            </span>
            {[
              { key: false, label: "Off" },
              { key: true, label: "On" },
            ].map((opt) => {
              const href = buildGalleryHref({
                slug,
                theme,
                dims,
                override: { dims: opt.key },
              });
              const isActive = opt.key === dims;
              return (
                <Link
                  key={String(opt.key)}
                  href={href}
                  className={`widget-toolbar-chip${isActive ? " on" : ""}`}
                  aria-pressed={isActive}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section
          className="widget-sizes"
          aria-label="Widget size presets"
        >
          <div className="widget-section-eyebrow">Presets · 3 fixed sizes</div>
          {WIDGET_SIZES.map((size) => {
            const snippet = buildEmbedSnippet(slug, size, theme, dims);
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
                    src={buildEmbedSrc(slug, size, theme, dims)}
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

        {/* Phase G — custom builder. Lives below the three preset cards. */}
        <WidgetBuilder countries={countries} initialSlug={slug} />
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
        .widget-search {
          position: relative;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .widget-search-label {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
        }
        .widget-search-row { position: relative; }
        .widget-search input {
          width: 100%;
          padding: 12px 16px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-13);
          color: var(--color-text-primary);
          background: var(--color-card-bg);
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
        }
        .widget-search input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
        .widget-search-results {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin: 6px 0 0;
          padding: 4px;
          list-style: none;
          background: var(--color-card-bg);
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          z-index: 10;
          box-shadow: var(--shadow-hard-sm, 2px 2px 0 var(--color-card-border));
        }
        .widget-search-results li {
          padding: 9px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--color-text-primary);
        }
        .widget-search-results li.on,
        .widget-search-results li:hover {
          background: var(--color-accent);
          color: var(--color-bg);
        }
        .widget-search-name {
          font-family: var(--font-heading);
          font-size: var(--text-16);
        }
        .widget-search-iso {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-wider);
          color: inherit;
          opacity: 0.7;
        }

        .widget-toolbar {
          padding: 20px 0 0;
          display: flex;
          flex-wrap: wrap;
          gap: 20px 28px;
          align-items: flex-start;
        }
        .widget-toolbar-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .widget-toolbar-label {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-right: 6px;
        }
        .widget-toolbar-label em {
          font-style: normal;
          color: var(--color-text-25);
          text-transform: none;
          letter-spacing: 0;
        }
        .widget-toolbar-chip {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          padding: 6px 12px;
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          background: var(--color-card-bg);
          color: var(--color-text-40);
          text-decoration: none;
          transition: background-color .15s, color .15s, border-color .15s;
        }
        .widget-toolbar-chip:hover {
          background: var(--color-card-hover-bg);
          color: var(--color-text-primary);
          border-color: var(--color-card-hover-border);
        }
        .widget-toolbar-chip.on {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }

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

        .widget-section-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin: 8px 0 4px;
        }

        /* ===== Phase G — builder ===== */
        .wb {
          margin-top: 48px;
          padding-top: 28px;
          border-top: 1px solid var(--color-divider);
        }
        .wb-header { margin-bottom: 22px; }
        .wb-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 8px;
        }
        .wb-title {
          font-family: var(--font-heading);
          font-size: var(--text-28);
          font-weight: 400;
          letter-spacing: var(--tracking-tighter);
          line-height: 1.1;
          margin: 0 0 6px;
        }
        .wb-lede {
          font-family: var(--font-body);
          font-size: var(--text-13);
          color: var(--color-text-55);
          margin: 0;
          max-width: 560px;
        }

        .wb-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 28px;
          align-items: flex-start;
        }
        @media (max-width: 880px) {
          .wb-grid { grid-template-columns: minmax(0, 1fr); }
        }

        .wb-controls,
        .wb-preview-col {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .wb-field { position: relative; }
        .wb-label {
          display: block;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 8px;
        }

        .wb-input {
          width: 100%;
          padding: 10px 14px;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-13);
          color: var(--color-text-primary);
          background: var(--color-card-bg);
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
        }
        .wb-input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
        .wb-results {
          position: absolute;
          top: calc(100% + 4px);
          left: 0; right: 0;
          margin: 0;
          padding: 4px;
          list-style: none;
          background: var(--color-card-bg);
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          z-index: 12;
          box-shadow: var(--shadow-hard-sm, 2px 2px 0 var(--color-card-border));
        }
        .wb-result {
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-family: var(--font-body);
          font-size: var(--text-13);
          color: var(--color-text-primary);
          cursor: pointer;
          border-radius: var(--radius-sm);
        }
        .wb-result:hover,
        .wb-result.on {
          background: var(--color-accent);
          color: var(--color-bg);
        }
        .wb-result-iso {
          font-family: var(--font-mono);
          font-size: var(--text-10);
          letter-spacing: var(--tracking-wider);
          opacity: 0.7;
        }

        .wb-checkboxes {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px 12px;
        }
        .wb-check {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          background: var(--color-card-bg);
          cursor: pointer;
          transition: background-color .12s, border-color .12s;
        }
        .wb-check:hover {
          background: var(--color-card-hover-bg);
          border-color: var(--color-card-hover-border);
        }
        .wb-check.on {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }
        .wb-check input { accent-color: var(--color-accent); cursor: pointer; }
        .wb-check-label {
          font-family: var(--font-body);
          font-size: var(--text-13);
          flex: 1;
        }
        .wb-check-hint {
          font-family: var(--font-mono);
          font-size: var(--text-10);
          letter-spacing: 0.04em;
          opacity: 0.6;
        }

        .wb-toggle-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .wb-toggle {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 7px 12px;
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          background: var(--color-card-bg);
          color: var(--color-text-primary);
          cursor: pointer;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          transition: background-color .12s, border-color .12s, color .12s;
        }
        .wb-toggle:hover {
          background: var(--color-card-hover-bg);
          border-color: var(--color-card-hover-border);
        }
        .wb-toggle.on {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }
        .wb-toggle-sub {
          font-size: var(--text-10);
          letter-spacing: 0.06em;
          text-transform: none;
          opacity: 0.7;
          margin-top: 1px;
        }

        .wb-preview-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: var(--color-bg);
          border: 1px dashed var(--color-card-border);
          border-radius: var(--radius-sm);
          min-height: 260px;
        }
        .wb-preview-frame iframe {
          border: 0;
          box-shadow: var(--shadow-hard-sm, 2px 2px 0 var(--color-card-border));
        }
        .wb-preview-empty {
          font-family: var(--font-mono);
          font-size: var(--text-11);
          color: var(--color-text-30);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
        }

        .wb-snippet {
          font-family: var(--font-mono);
          font-size: var(--text-12);
          color: var(--color-text-60);
          background: var(--color-page-bg);
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          margin: 0 0 10px;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .wb-copy {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid var(--color-card-border);
          border-radius: var(--radius-sm);
          background: var(--color-bg);
          color: var(--color-text-primary);
          cursor: pointer;
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono);
          font-size: var(--text-11);
          letter-spacing: var(--tracking-caps);
          text-transform: uppercase;
          transition: background-color .15s, border-color .15s, color .15s;
        }
        .wb-copy:hover {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }
      `}</style>
    </div>
  );
}
