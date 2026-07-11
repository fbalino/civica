import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { getAllJurisdictions } from "@/lib/db/queries";
import {
  readCachedFieldFromRow,
  getCanonicalFactsForJurisdictions,
} from "@/lib/factbook/reconcile/api";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CountryCard, type CountryCardStat } from "@/components/home/CountryCard";
import {
  Reveal,
  HeroReveal,
  HeroRevealItem,
} from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

const countryEngravingDir = join(process.cwd(), "public", "engravings", "countries");

function countryDarkEngravingSrc(iso3: string): string | null {
  return existsSync(join(countryEngravingDir, `${iso3}-dark.webp`))
    ? `/engravings/countries/${iso3}-dark.webp`
    : null;
}

function SpotEngraving({
  src,
  darkSrc,
}: {
  src: string;
  darkSrc: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="theme-engraving-light" src={src} alt="" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="theme-engraving-dark" src={darkSrc} alt="" aria-hidden="true" />
    </>
  );
}

type FeaturedCountryRow = Awaited<ReturnType<typeof getAllJurisdictions>>[number];

/** Human-readable population (e.g. "123.3M", "1.41B"). Null-safe. */
function formatPopulation(pop: number | string | null): string | null {
  const n = typeof pop === "string" ? Number(pop) : pop;
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

/** Government-type label: prefer the human regime label, else raw type. */
function govLabel(row: FeaturedCountryRow): string | null {
  return row.governmentClassification?.regimeTypeLabel ?? row.governmentType ?? null;
}

/** Build the (real-data-only) stat columns for a featured CountryCard. */
function buildCardStats(row: FeaturedCountryRow): CountryCardStat[] {
  const stats: CountryCardStat[] = [];
  const gov = govLabel(row);
  if (gov) stats.push({ label: "Government type", value: gov });
  const pop = formatPopulation(row.population);
  if (pop) stats.push({ label: "Population", value: pop });
  return stats;
}

export async function HomeGrid() {
  // Country list for the hero search (graceful empty on DB error).
  let countries: { slug: string; name: string; iso2: string | null; capital: string | null }[] =
    [];
  let allJurisdictions: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    allJurisdictions = await getAllJurisdictions();
    const all = allJurisdictions;
    countries = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      capital: readCachedFieldFromRow(c, "capital"),
    }));
  } catch {}

  // Featured cards use the atlas jurisdiction spine, never a derived ranking.
  const findRow = (slug: string, iso3: string) =>
    allJurisdictions.find(
      (r) => r.slug === slug || r.iso3?.toLowerCase() === iso3,
    ) ?? null;
  const japan = findRow("japan", "jpn");
  const estonia = findRow("estonia", "est");

  // Resolve income-group chips for the featured cards (canonical fact layer).
  const featuredIds = [japan, estonia]
    .filter((r): r is FeaturedCountryRow => r != null)
    .map((r) => r.id);
  const incomeByJur: Record<string, string | null> = {};
  if (featuredIds.length > 0) {
    try {
      const resolved = await getCanonicalFactsForJurisdictions(featuredIds, [
        "world_bank_income_group",
      ]);
      for (const id of featuredIds) {
        incomeByJur[id] =
          resolved[id]?.["world_bank_income_group"]?.canonical?.factValue ?? null;
      }
    } catch {}
  }

  const catalogCount = countries.length || null;
  const japanDarkEngraving = countryDarkEngravingSrc("jpn");
  const estoniaDarkEngraving = countryDarkEngravingSrc("est");

  return (
    <div className="home">
      {/* Hero */}
      <section className="home-hero" aria-labelledby="home-title">
        <ParallaxImage
          className="home-hero-art-img"
          src="/engravings/hero.webp"
          darkSrc="/engravings/hero-dark.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="home-hero-inner">
          <HeroReveal className="home-hero-main">
            <HeroRevealItem as="h1" id="home-title" className="home-hero-title">
              Civica Atlas
            </HeroRevealItem>
            {/* PUBLIC_CLAIM: home.visible-positioning */}
            <HeroRevealItem as="p" className="home-hero-dek">
              A provenance-first comparative reference to how every country is
              governed.
            </HeroRevealItem>
            <HeroRevealItem className="home-hero-search">
              <GlobalSearch countries={countries} />
            </HeroRevealItem>
            <HeroRevealItem className="home-stats" role="group" aria-label="Coverage">
              {/* PROVENANCE_COVERAGE: home.catalog-count */}
              <div className="home-stat">
                <span className="home-stat-value">{catalogCount ?? "—"}</span>
                <span className="home-stat-label">Countries &amp; territories</span>
              </div>
              <div className="home-stat">
                <span className="home-stat-mark" aria-hidden="true">◆</span>
                <span className="home-stat-label">Source-native evidence</span>
              </div>
              <div className="home-stat home-stat--mark">
                <span className="home-stat-mark" aria-hidden="true">
                  ◆
                </span>
                <span className="home-stat-label">Source links &amp; provenance</span>
              </div>
              <div className="home-stat home-stat--mark">
                <span className="home-stat-mark" aria-hidden="true">
                  ◆
                </span>
                <span className="home-stat-label">Independent &amp; nonpartisan</span>
              </div>
            </HeroRevealItem>
          </HeroReveal>
        </div>
      </section>

      {/* 01 — Factbook */}
      <Reveal as="section" className="home-feature">
        <div className="home-feature-num">01</div>
        <div className="home-feature-main">
          <div className="home-eyebrow">Countries</div>
          <h2 className="home-feature-title">
            Explore country profiles and key facts at a glance.
          </h2>
          <p className="home-feature-desc">
            Country profiles bring government, leaders, legislature, economy,
            and society together. Resolver-backed detail pages expose source
            context where implemented; these compact cards link onward and do
            not claim inline provenance for each summary value.
          </p>
          <Link href="/country" className="btn btn--text">
            <span>Explore Countries</span>
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
        <div className="home-feature-visual-slot">
          {japan ? (
            <CountryCard
              name={japan.name}
              iso2={japan.iso2}
              incomeGroup={incomeByJur[japan.id] ?? null}
              stats={buildCardStats(japan)}
              iso3="jpn"
              engravingDarkSrc={japanDarkEngraving}
              href={`/country/${japan.slug}`}
            />
          ) : (
            <div className="home-feature-visual">
              <div className="home-engraving">
                <SpotEngraving
                  src="/engravings/spot-column.webp"
                  darkSrc="/engravings/spot-column-dark.webp"
                />
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {/* 02 — Atlas */}
      <Reveal as="section" className="home-feature">
        <div className="home-feature-num">02</div>
        <div className="home-feature-main">
          <div className="home-eyebrow">Atlas</div>
          <h2 className="home-feature-title">See the world. Understand its contexts.</h2>
          <p className="home-feature-desc">
            A connected atlas of legislatures, chambers, political systems, and the
            institutions that hold power around the world.
          </p>
          <Link href="/atlas" className="btn btn--text">
            <span>Explore Atlas</span>
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
        <div className="home-feature-visual-slot">
          {estonia ? (
            <CountryCard
              name={estonia.name}
              iso2={estonia.iso2}
              incomeGroup={incomeByJur[estonia.id] ?? null}
              stats={buildCardStats(estonia)}
              iso3="est"
              engravingDarkSrc={estoniaDarkEngraving}
              href={`/country/${estonia.slug}`}
            />
          ) : (
            <div className="home-feature-visual">
              <div className="home-engraving">
                <SpotEngraving
                  src="/engravings/spot-globe.webp"
                  darkSrc="/engravings/spot-globe-dark.webp"
                />
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {/* 03 — Governance Evidence */}
      <Reveal as="section" className="home-feature">
        <div className="home-feature-num">03</div>
        <div className="home-feature-main">
          <div className="home-eyebrow">Governance Evidence</div>
          <h2 className="home-feature-title">Compare what established sources report.</h2>
          {/* PUBLIC_CLAIM: home.secondary-research */}
          <p className="home-feature-desc">
            The dashboard presents governance observations on their original
            scales, with source, vintage, and rights context. It does not average
            them into a Civica country ranking.
          </p>
          <Link href="/governance-evidence" className="btn btn--text">
            <span>Explore Governance Evidence</span>
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
        <div className="home-feature-visual-slot">
          {/* PROVENANCE_COVERAGE: home.evidence-teaser */}
          <div className="home-feature-visual">
            <div className="home-engraving">
              <SpotEngraving
                src="/engravings/spot-globe.webp"
                darkSrc="/engravings/spot-globe-dark.webp"
              />
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
