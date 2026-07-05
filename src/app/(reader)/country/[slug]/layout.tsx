import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync } from "fs";
import { join } from "path";
import {
  getJurisdictionBySlug,
  getCICountryDetail,
} from "@/lib/db/queries";
import { getPulseV2ForCountry } from "@/lib/db/queries-pulse-v2";
import { reconciliation } from "@/lib/content/site-state";
import {
  darkEngravingCaption,
  engravingCaption,
} from "@/lib/data/engraving-captions";
import { withOg } from "@/lib/og";
import { JsonLd } from "@/lib/seo/json-ld";
import {
  buildBreadcrumbList,
  buildCountry,
  type JsonLdNode,
} from "@/lib/seo/jsonld";
import { FactbookHeaderStrip } from "@/components/factbook/FactbookHeaderStrip";
import { CivicaAIDrawer } from "@/components/factbook/CivicaAIDrawer";
import { CountryTabBar } from "@/components/country/CountryTabBar";
import type { LightboxImage } from "@/components/factbook/FactbookLightbox";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import { classifyGovernment } from "@/lib/data/government-category";
import { formatGovernmentType } from "@/lib/text/clean";
import { getCountryGallery, wikimediaUrl } from "@/lib/data/country-photos";
import { getCountryBounds } from "@/lib/data/country-bounds";

export const revalidate = 3600;

function galleryCaption(p: { caption: string; license?: string }): string {
  const license = p.license && p.license !== "Wikimedia Commons" ? ` · ${p.license}` : "";
  return `${p.caption}${license} · Wikimedia Commons`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) return { title: "Country Not Found" };
  const govLabel =
    formatGovernmentType(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ) || "sovereign state";
  const title = `${jurisdiction.name} — Government & Political System`;
  const description = `How ${jurisdiction.name} is governed: its ${govLabel.toLowerCase()} system, branches of power, geography, people, and economy — sourced from the CIA World Factbook with Civica governance overlays.`;
  const url = `https://civicaatlas.org/country/${slug}`;
  return {
    title,
    // withOg injects the shared default social image, because Next replaces
    // (not merges) the root layout's openGraph when a page sets its own. The
    // document `title` gets the "· Civica Atlas" template appended by Next; the
    // OG title is standalone, so we brand it explicitly and never double-suffix.
    description,
    alternates: { canonical: url },
    openGraph: withOg({
      title: `${title} · Civica Atlas`,
      description,
      url,
      type: "website",
    }),
  };
}

export default async function CountryLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;

  // .catch(() => null) collapses both "not found" and DB-down cases to a
  // 404. Don't swallow other errors silently — let them bubble to the
  // Next.js error boundary so they appear in logs.
  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) notFound();

  const [ciDetail, pulseV2, headerFacts] = await Promise.all([
    getCICountryDetail(slug).catch(() => null),
    getPulseV2ForCountry(slug).catch(() => null),
    // Resolver batch for the two masthead pills (Pop + GDP).
    getCanonicalFactsForJurisdiction(jurisdiction.id, [
      "population_total",
      "gdp_ppp_usd_billions",
    ]).catch(
      () => ({}) as Record<string, import("@/lib/factbook/reconcile/types").ResolverOutput>
    ),
  ]);

  const ciScore =
    ciDetail?.composite?.score != null
      ? Number(ciDetail.composite.score)
      : null;

  // Pulse delta: pick the largest-magnitude dimension as the headline.
  // Always show CP when pulseV2 returned (zero-flat is a meaningful state).
  let cpDelta: number | null = null;
  let cpTrend: "up" | "down" | "flat" | null = null;
  if (pulseV2 && pulseV2.dimensions) {
    const allDims = Object.values(pulseV2.dimensions);
    const sorted = [...allDims].sort(
      (a, b) =>
        Math.abs(Number(b.delta ?? 0)) - Math.abs(Number(a.delta ?? 0))
    );
    const top = sorted[0];
    const d = Number(top?.delta ?? 0);
    cpDelta = d;
    cpTrend = d > 0.5 ? "up" : d < -0.5 ? "down" : "flat";
  }

  const govLabel =
    formatGovernmentType(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ) ||
    classifyGovernment(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ).label;

  // Gallery: Wikimedia photos + map assets. Slug lookup covers media for
  // territory pages without changing reconciliation identity fields.
  const gallery = getCountryGallery({
    iso3: jurisdiction.iso3,
    slug: jurisdiction.slug,
  });
  const mapImages: LightboxImage[] = gallery
    ? gallery.mapImages.map((p) => ({
        src: wikimediaUrl(p.file, 1200),
        alt: p.caption,
        caption: galleryCaption(p),
      }))
    : [];
  const photos: LightboxImage[] = gallery
    ? gallery.photos.map((p) => ({
        src: wikimediaUrl(p.file, 1200),
        alt: p.caption,
        caption: galleryCaption(p),
      }))
    : [];

  // Bounding box + centroid for the masthead's live interactive map (falls back
  // to the static locator tile when a country has no bounds entry).
  const bounds = getCountryBounds(jurisdiction.iso3);
  const mapboxAvailable = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  const engravingCode = jurisdiction.iso3 ? jurisdiction.iso3.toLowerCase() : null;
  // Prefer the optimized .webp; fall back to a raw .png drop (so new Codex
  // exports saved to public/engravings/countries/ appear before conversion).
  const engravingDir = join(process.cwd(), "public", "engravings", "countries");
  const countryEngravingSrc = engravingCode
    ? existsSync(join(engravingDir, `${engravingCode}.webp`))
      ? `/engravings/countries/${engravingCode}.webp`
      : existsSync(join(engravingDir, `${engravingCode}.png`))
        ? `/engravings/countries/${engravingCode}.png`
        : null
    : null;
  const countryEngravingDarkSrc =
    engravingCode && existsSync(join(engravingDir, `${engravingCode}-dark.webp`))
      ? `/engravings/countries/${engravingCode}-dark.webp`
      : null;
  const heroCaption = countryEngravingSrc
    ? engravingCaption(jurisdiction.iso3)
    : null;
  const heroDarkCaption = countryEngravingDarkSrc
    ? darkEngravingCaption(jurisdiction.iso3) ?? heroCaption
    : null;

  // Structured data: Home → Countries → {Name} breadcrumb, plus a Country node
  // with a Wikidata `sameAs` when the already-fetched jurisdiction carries a
  // QID (no extra DB query). buildCountry returns null when there's no QID.
  const countryPath = `/country/${slug}`;
  const seoNodes: JsonLdNode[] = [
    buildBreadcrumbList([
      { name: "Home", url: "/" },
      { name: "Countries", url: "/country" },
      { name: jurisdiction.name },
    ]),
  ];
  const countryNode = buildCountry({
    name: jurisdiction.name,
    path: countryPath,
    wikidataQid: jurisdiction.wikidataQid,
  });
  if (countryNode) seoNodes.push(countryNode);

  return (
    <>
      <JsonLd data={seoNodes} />
      <FactbookHeaderStrip
        slug={slug}
        countryName={jurisdiction.name}
        iso2={jurisdiction.iso2}
        governmentTypeLabel={govLabel}
        population={jurisdiction.population}
        gdp={
          jurisdiction.gdpBillions
            ? jurisdiction.gdpBillions * 1_000_000_000
            : null
        }
        populationResolver={headerFacts["population_total"] ?? null}
        gdpResolver={headerFacts["gdp_ppp_usd_billions"] ?? null}
        ciScore={ciScore}
        cpDelta={cpDelta}
        cpTrend={cpTrend}
        mapImages={mapImages}
        photos={photos}
        bounds={bounds}
        mapboxAvailable={mapboxAvailable}
        inAtlas={jurisdiction.type === "sovereign_state"}
        engravingSrc={countryEngravingSrc}
        engravingDarkSrc={countryEngravingDarkSrc}
        heroCaption={heroCaption}
        heroDarkCaption={heroDarkCaption}
        nav={<CountryTabBar slug={slug} />}
      />

      {/* Show a one-line reconciliation disclosure whenever at least one
       *  header fact has a non-CIA canonical source (i.e. the resolver
       *  actually swapped in fresher data). Quiet when only CIA values
       *  render. */}
      {(headerFacts["population_total"]?.canonical &&
        headerFacts["population_total"].canonical.sourceId !== "cia_factbook") ||
      (headerFacts["gdp_ppp_usd_billions"]?.canonical &&
        headerFacts["gdp_ppp_usd_billions"].canonical.sourceId !==
          "cia_factbook") ? (
        <div className="factbook-reconciliation-notice">
          <div className="factbook-reconciliation-notice__inner">
            Some figures reconciled across multiple sources via Civica&apos;s
            methodology ({reconciliation.version.replace(/-beta$/, "")}
            {reconciliation.status === "beta" ? (
              <>
                {" "}
                <span className="factbook-reconciliation-notice__beta">
                  Beta
                </span>
              </>
            ) : null}
            ).{" "}
            <Link
              href="/country/methodology/reconciliation"
              className="factbook-reconciliation-notice__link"
            >
              Methodology →
            </Link>
          </div>
        </div>
      ) : null}

      {/* The "jump to another country" search + its sticky-bar handoff now
       *  live INSIDE each tab via <CountryJumpSearch> (a normal-flow field at
       *  the top of the tab content + a sentinel + the shared sticky bar). The
       *  layout no longer owns the sentinel or the sticky bar, so the reveal
       *  is driven by the in-content field's own position — identical on every
       *  tab, and guaranteed one-at-a-time. Each tab fetches its own country
       *  list and renders the component. */}
      {children}

      <CivicaAIDrawer
        countryName={jurisdiction.name}
        threadKey={`country:${slug}`}
        suggestions={[
          `How does ${jurisdiction.name}'s government work?`,
          "Recent Pulse events",
          "When's the next election?",
        ]}
      />
    </>
  );
}
