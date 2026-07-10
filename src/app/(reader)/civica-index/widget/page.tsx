import type { Metadata } from "next";
import Link from "next/link";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";
import { getCIRankings } from "@/lib/db/queries";
import { WidgetCopyButton } from "@/components/widget/WidgetCopyButton";
import { WidgetCountrySearch } from "@/components/widget/WidgetCountrySearch";
import { WidgetBuilder } from "@/components/widget/WidgetBuilder";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica Widget Gallery — Embed a governance score anywhere",
  description:
    "Grab a ready-to-embed research-beta Civica Index score widget for any country. Three sizes, light/dark themes, one-line iframe snippet.",
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
    </div>
  );
}
