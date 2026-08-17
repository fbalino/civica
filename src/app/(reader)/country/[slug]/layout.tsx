import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync } from "fs";
import { join } from "path";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { reconciliation } from "@/lib/content/site-state";
import {
  darkEngravingCaption,
  engravingCaption,
} from "@/lib/data/engraving-captions";
import {
  darkTerritoryEngravingCaption,
  territoryEngravingCaption,
} from "@/lib/data/territory-engraving-captions";
import { withOg } from "@/lib/og";
import { JsonLd } from "@/lib/seo/json-ld";
import {
  buildBreadcrumbList,
  buildJurisdiction,
  type JsonLdNode,
} from "@/lib/seo/jsonld";
import { FactbookHeaderStrip } from "@/components/factbook/FactbookHeaderStrip";
import { CivicaAIDrawer } from "@/components/factbook/CivicaAIDrawer";
import { CountryTabBar } from "@/components/country/CountryTabBar";
import { BetaChip } from "@/components/editorial/BetaChip";
import type { LightboxImage } from "@/components/factbook/FactbookLightbox";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import { db } from "@/lib/db";
import { getCurrentEntityNameForms } from "@/lib/i18n/name-form-store";
import { classifyGovernment } from "@/lib/data/government-category";
import { formatGovernmentType } from "@/lib/text/clean";
import { getCountryGallery, wikimediaUrl } from "@/lib/data/country-photos";
import { getCountryBounds } from "@/lib/data/country-bounds";
import { countryHeroPhoto } from "@/lib/data/country-hero-photos";

function galleryCaption(p: { caption: string; license?: string }): string {
  const license =
    p.license && p.license !== "Wikimedia Commons" ? ` · ${p.license}` : "";
  return `${p.caption}${license} · Wikimedia Commons`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return { title: "Country Not Found" };
  const status = jurisdiction.jurisdictionStatus;
  const title = `${jurisdiction.name} — Government & Political System`;
  // PUBLIC_CLAIM: country.source-layer
  const description = `${status.label}: how ${jurisdiction.name} is governed, with branches of power, geography, people, economy, and source-linked status context.`;
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

  // A DB/query failure must bubble to the error boundary (500, non-indexable),
  // NOT be swallowed into a 404 (indexable, would de-index a real country).
  // getJurisdictionBySlug returns null only for a genuinely absent slug. (PLT-026)
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) notFound();

  // Resolver batch for the two masthead pills (Pop + GDP).
  const headerFacts = await getCanonicalFactsForJurisdiction(jurisdiction.id, [
    "population_total",
    "gdp_ppp_usd_billions",
  ]).catch(
    () =>
      ({}) as Record<
        string,
        import("@/lib/factbook/reconcile/types").ResolverOutput
      >,
  );

  const govLabel =
    formatGovernmentType(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType,
    ) ||
    classifyGovernment(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType,
    ).label;

  // Gallery: Wikimedia photos + map assets. Slug lookup covers media for
  // territory pages without changing reconciliation identity fields.
  const gallery = getCountryGallery({
    iso3: jurisdiction.iso3,
    slug: jurisdiction.slug,
  });
  // alt="" (decorative): the lightbox renders `caption` as a visible caption
  // immediately beside the enlarged image (FactbookLightbox.tsx), so a
  // matching `alt` would announce the same sentence twice (DESIGN.md
  // "Alternative text").
  const mapImages: LightboxImage[] = gallery
    ? gallery.mapImages.map((p) => ({
        src: wikimediaUrl(p.file, 1200),
        alt: "",
        caption: galleryCaption(p),
      }))
    : [];
  const photos: LightboxImage[] = gallery
    ? gallery.photos.map((p) => ({
        src: wikimediaUrl(p.file, 1200),
        alt: "",
        caption: galleryCaption(p),
      }))
    : [];

  // Bounding box + centroid for the masthead's live interactive map (falls back
  // to the static locator tile when a country has no bounds entry).
  const bounds = getCountryBounds(jurisdiction.iso3);
  const mapboxAvailable = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  const engravingCode = jurisdiction.iso3
    ? jurisdiction.iso3.toLowerCase()
    : null;
  // Release art is WebP-only. Raw generation exports never enter a reader path.
  const engravingDir = join(process.cwd(), "public", "engravings", "countries");
  const territoryEngravingDir = join(
    process.cwd(),
    "public",
    "engravings",
    "territories",
  );
  const iso3EngravingSrc = engravingCode
    ? existsSync(join(engravingDir, `${engravingCode}.webp`))
      ? `/engravings/countries/${engravingCode}.webp`
      : null
    : null;
  const territoryEngravingSrc = existsSync(
    join(territoryEngravingDir, `${slug}.webp`),
  )
    ? `/engravings/territories/${slug}.webp`
    : null;
  const countryEngravingSrc = iso3EngravingSrc ?? territoryEngravingSrc;
  const iso3EngravingDarkSrc =
    engravingCode &&
    existsSync(join(engravingDir, `${engravingCode}-dark.webp`))
      ? `/engravings/countries/${engravingCode}-dark.webp`
      : null;
  const territoryEngravingDarkSrc = existsSync(
    join(territoryEngravingDir, `${slug}-dark.webp`),
  )
    ? `/engravings/territories/${slug}-dark.webp`
    : null;
  const countryEngravingDarkSrc = iso3EngravingSrc
    ? iso3EngravingDarkSrc
    : territoryEngravingSrc
      ? territoryEngravingDarkSrc
      : null;
  const photoHero = countryHeroPhoto(jurisdiction.iso3);
  const countryHeroSrc = photoHero?.lightSrc ?? countryEngravingSrc;
  const countryHeroDarkSrc = photoHero?.darkSrc ?? countryEngravingDarkSrc;
  const heroCaption =
    photoHero?.lightCaption ??
    (iso3EngravingSrc
      ? engravingCaption(jurisdiction.iso3)
      : territoryEngravingSrc
        ? territoryEngravingCaption(slug)
        : null);
  const heroDarkCaption =
    photoHero?.darkCaption ??
    (iso3EngravingDarkSrc
      ? (darkEngravingCaption(jurisdiction.iso3) ?? heroCaption)
      : territoryEngravingDarkSrc
        ? (darkTerritoryEngravingCaption(slug) ?? heroCaption)
        : null);

  // Structured data: Home → Countries & areas → {Name} breadcrumb, plus a
  // Country node only for the closed sovereign-state class and a neutral Place
  // for other sourced jurisdiction types. No extra DB query is required.
  // EXP-029: stored, source-backed official name forms for the masthead.
  // Absent forms stay absent — never derived from the English display name.
  let officialNameForms: { value: string; languageTag: string }[] = [];
  try {
    const storedForms = await getCurrentEntityNameForms(
      db,
      "jurisdiction",
      jurisdiction.id,
    );
    officialNameForms = storedForms
      .filter((form) => form.nameRole === "official")
      .map((form) => ({ value: form.value, languageTag: form.languageTag }));
  } catch {
    // An outage renders the masthead without source forms; nothing is implied.
  }

  const countryPath = `/country/${slug}`;
  const seoNodes: JsonLdNode[] = [
    buildBreadcrumbList([
      { name: "Home", url: "/" },
      { name: "Countries & areas", url: "/country" },
      { name: jurisdiction.name },
    ]),
  ];
  const countryNode = buildJurisdiction({
    name: jurisdiction.name,
    path: countryPath,
    wikidataQid: jurisdiction.wikidataQid,
    sovereignState: jurisdiction.type === "sovereign_state",
    statusLabel: jurisdiction.jurisdictionStatus.label,
    statusNote: jurisdiction.jurisdictionStatus.note,
  });
  if (countryNode) seoNodes.push(countryNode);

  return (
    <>
      <JsonLd data={seoNodes} />
      <FactbookHeaderStrip
        slug={slug}
        countryName={jurisdiction.name}
        officialNameForms={officialNameForms}
        iso2={jurisdiction.iso2}
        governmentTypeLabel={govLabel}
        jurisdictionStatus={jurisdiction.jurisdictionStatus}
        population={jurisdiction.population}
        gdp={
          jurisdiction.gdpBillions
            ? jurisdiction.gdpBillions * 1_000_000_000
            : null
        }
        populationResolver={headerFacts["population_total"] ?? null}
        gdpResolver={headerFacts["gdp_ppp_usd_billions"] ?? null}
        mapImages={mapImages}
        photos={photos}
        bounds={bounds}
        mapboxAvailable={mapboxAvailable}
        inAtlas={jurisdiction.type === "sovereign_state"}
        engravingSrc={countryHeroSrc}
        engravingDarkSrc={countryHeroDarkSrc}
        heroArtKind={photoHero ? "photographic" : "engraving"}
        heroCaption={heroCaption}
        heroDarkCaption={heroDarkCaption}
        reconciliationNotice={
          (headerFacts["population_total"]?.canonical &&
            headerFacts["population_total"].canonical.sourceId !==
              "cia_factbook") ||
          (headerFacts["gdp_ppp_usd_billions"]?.canonical &&
            headerFacts["gdp_ppp_usd_billions"].canonical.sourceId !==
              "cia_factbook") ? (
            <>
              Some figures reconciled across multiple sources via Civica&apos;s
              methodology ({reconciliation.version.replace(/-beta$/, "")}
              {reconciliation.status === "beta" ? (
                <>
                  {" "}
                  <BetaChip />
                </>
              ) : null}
              ).{" "}
              <Link
                href="/country/methodology/reconciliation"
                className="factbook-reconciliation-notice__link"
              >
                Methodology →
              </Link>
            </>
          ) : null
        }
        nav={<CountryTabBar slug={slug} />}
      />

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
