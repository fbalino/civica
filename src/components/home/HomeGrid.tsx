import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { getAllReferenceJurisdictions } from "@/lib/db/queries";
import {
  readFreshCachedFieldFromRow,
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
import { Banner } from "@/components/editorial/Banner";
import { ThemedDecorativeImage } from "@/components/ThemedDecorativeImage";

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
    <ThemedDecorativeImage src={src} darkSrc={darkSrc} />
  );
}

type FeaturedCountryRow = Awaited<ReturnType<typeof getAllReferenceJurisdictions>>[number];

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
function buildCardStats(
  row: FeaturedCountryRow,
  cacheReadAt: Date,
): CountryCardStat[] {
  const stats: CountryCardStat[] = [];
  const gov = govLabel(row);
  if (gov) stats.push({ label: "Government type", value: gov });
  const pop = formatPopulation(
    readFreshCachedFieldFromRow(row, "population_total", {
      now: cacheReadAt,
    }).value,
  );
  if (pop) stats.push({ label: "Population", value: pop });
  return stats;
}

export async function HomeGrid() {
  const cacheReadAt = new Date();
  // Country list for the hero search (graceful empty on DB error).
  let countries: Parameters<typeof GlobalSearch>[0]["countries"] = [];
  let allJurisdictions: Awaited<ReturnType<typeof getAllReferenceJurisdictions>> = [];
  let catalogAvailable = true;
  try {
    allJurisdictions = await getAllReferenceJurisdictions();
    const all = allJurisdictions;
    countries = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      capital: readFreshCachedFieldFromRow(c, "capital", {
        now: cacheReadAt,
      }).value,
      status: c.jurisdictionStatus,
    }));
  } catch {
    catalogAvailable = false;
  }

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
            {!catalogAvailable ? (
              <Banner variant="warn">
                The country catalog is temporarily unavailable. Civica is not
                treating this as a zero-country atlas.
              </Banner>
            ) : null}
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
            Start with a country. See its institutions, leaders, and source-linked facts.
          </h2>
          <p className="home-feature-desc">
            Each profile brings together government structure, current leaders,
            legislature, economy, and society. Open the profile for source details
            and known gaps; the summary cards do not show provenance for every value.
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
              stats={buildCardStats(japan, cacheReadAt)}
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
          <h2 className="home-feature-title">
            Compare political systems and institutions on one map.
          </h2>
          <p className="home-feature-desc">
            Browse legislatures, chambers, government systems, and other institutions
            across countries.
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
              stats={buildCardStats(estonia, cacheReadAt)}
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
            <div className="home-engraving home-engraving--landscape">
              <SpotEngraving
                src="/engravings/home-governance-evidence.webp"
                darkSrc="/engravings/home-governance-evidence-dark.webp"
              />
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
