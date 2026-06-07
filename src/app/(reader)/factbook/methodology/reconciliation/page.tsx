import type { Metadata } from "next";
import Link from "next/link";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { getSiteStats, type SiteStats } from "@/lib/content/site-stats";
import {
  reconciliation,
  tier1Publishers,
  nsoWave1,
  nsoTarget,
  currentVintage,
  disputeSla,
} from "@/lib/content/site-state";

export const revalidate = 3600;

const tier1Shipped = tier1Publishers.filter((p) => p.shipped);
const nsoActive = nsoWave1.filter((n) => n.status === "in-progress");
const nsoDeferred = nsoWave1.filter(
  (n) => n.status === "deferred" || n.status === "deferred-permanently",
);
const nsoActiveNames = nsoActive.map((n) => n.name);
const nsoActiveNamesProse = nsoActiveNames.join(", ");

// Compose the headline-publisher prose from `tier1Publishers`. Picks the
// first four shipped publishers by short-name and counts the rest, so
// "the World Bank, IMF, UN, WHO, and seven others" stays in sync with
// `tier1Publishers` without hand-editing this prose every time a Tier-1
// orchestrator lands or is scrapped.
const tier1ShippedShortNames = tier1Shipped.map((p) => p.shortName);
const tier1HeadlineFour = tier1ShippedShortNames.slice(0, 4);
const tier1HeadlineRemaining = Math.max(
  0,
  tier1ShippedShortNames.length - tier1HeadlineFour.length,
);
const tier1HeadlineProse = `${tier1HeadlineFour.join(", ")}, and ${tier1HeadlineRemaining} others`;

// NBS-Nigeria status — per user resolution 2026-05-05, NBS-Nigeria is
// `deferred-permanently` (not `deferred` to v1.1). Compose the
// parenthetical from the live state so a future status change here
// updates both the prose and downstream filter buckets.
const nbsNigeria = nsoWave1.find((n) => n.id === "nbs_nigeria");
const nbsNigeriaParenthetical =
  nbsNigeria?.status === "deferred-permanently"
    ? "permanently deferred"
    : "deferred to v1.1";

// Destatis-DE status — short label drawn from `deferReason`. The state
// entry's `deferReason` opens with "Deferred to v1.1 — ..."; we surface
// just the short label here.
const destatisDe = nsoWave1.find((n) => n.id === "destatis_de");
const destatisDeParenthetical =
  destatisDe?.status === "deferred" ? "deferred to v1.1" : "deferred";

export const metadata: Metadata = {
  title: `Factbook reconciliation methodology (${reconciliation.version}) — Civica Atlas`,
  description: `How Civica picks one canonical value per country fact across CIA Factbook, ${tier1Shipped.length} multilateral publishers, ${nsoActive.length} national statistical offices, and Wikidata. Source allowlist, resolver rules, vintaging, disputes, replication, and worked examples drawn from live data.`,
  alternates: {
    canonical:
      "https://civicaatlas.org/factbook/methodology/reconciliation",
  },
};

const SECTIONS = [
  { id: "what-this-is", label: "What this is" },
  { id: "scope", label: "Scope" },
  { id: "sources", label: "Sources" },
  { id: "resolver", label: "The resolver" },
  { id: "value-types", label: "Measurement vs projection" },
  { id: "multi-canonical", label: "Multi-canonical scope" },
  { id: "two-fact-keys", label: "Two-fact-key splits" },
  { id: "vintaging", label: "Vintaging" },
  { id: "source-dot", label: "Reading a SourceDot" },
  { id: "editorial-canonical", label: "Editorial vs displayed" },
  { id: "canonical-flips", label: "Canonical-flip handoffs" },
  { id: "disputes", label: "Disputes" },
  { id: "replication", label: "Replication" },
  { id: "version-policy", label: "Version policy" },
  { id: "citing", label: "Citing this methodology" },
];

export default async function ReconciliationMethodologyPage() {
  // Soft-fail: page should still render if the DB is unreachable, with
  // generic prose in place of live counts. Mirrors the canonical pattern
  // at src/app/(reader)/methodology/approach/page.tsx.
  let stats: SiteStats | null = null;
  try {
    stats = await getSiteStats();
  } catch {
    stats = null;
  }

  return (
    <MethodologyLayout items={SECTIONS}>
      <SmartBreadcrumbs />

      <h1 className="editorial-page-title">
        Factbook Reconciliation
        <span className="editorial-beta-tag">{reconciliation.version}</span>
      </h1>
      <p className="editorial-page-subtitle">
        How Civica picks one canonical value per country fact when
        multiple sources disagree, and how readers can audit the
        choice. Methodology {reconciliation.version} — perpetual-beta
        posture; the rules continue to refine, but vintaged data is
        stable.
      </p>
      <div className="editorial-meta">
        <span>Methodology {reconciliation.version}</span>
        <span>First v1 vintage {reconciliation.firstVintage}</span>
        <span>Updated {reconciliation.lastUpdated}</span>
      </div>

      <div className="editorial-warning">
        <strong>Methodology in perpetual beta.</strong> Civica is a
        research lab. Methodology decisions ship as version bumps
        (<code>{reconciliation.version}</code> → next-revision → ...)
        rather than as a graduation event. Each quarterly vintage
        embeds the methodology version that produced it, so a
        citation pinned to{" "}
        <code>
          Civica Atlas Reconciled {reconciliation.version} — vintage{" "}
          {reconciliation.firstVintage}
        </code>{" "}
        is stable: the underlying rules are tied to the label. See
        the{" "}
        <Link href="#version-policy">version-policy section</Link>{" "}
        below for the full posture.
      </div>

      <section className="editorial-section" id="what-this-is">
        <SectionHeader
          eyebrow="Overview"
          title="What this is"
          dek="A rule-based system for picking one canonical value per country fact when multiple sources disagree."
        />
        <p>
          Civica&apos;s factbook draws on multiple sources for the same
          underlying fact. The CIA World Factbook is comprehensive but
          stopped updating in January 2026. Wikidata is fresh but its
          claims vary in quality. Multilateral statistical agencies
          ({tier1HeadlineProse}) are
          authoritative but cover narrower fact sets. National
          statistical offices ({nsoActiveNamesProse}) are authoritative for their own
          country and ship faster than any multilateral. For any
          given country and fact — Argentina&apos;s inflation,
          Brazil&apos;s population, the United Kingdom&apos;s
          consumer-price index — Civica may hold three, five, or even
          twelve candidate values from different sources, each with
          its own measurement date and reference chain.
        </p>
        <p>
          The reconciliation layer is the rule-based system that
          picks one value to display, preserves the rest for
          transparency, and escalates disagreements that look like
          data errors or contested changes. The rules are
          deterministic: no language model, no confidence scores, no
          convergence loops. A third party with our inputs and the
          source allowlist must be able to reproduce the choice.
        </p>
        <p>
          As of vintage {reconciliation.firstVintage}, the
          canonical-fact layer holds{" "}
          {stats
            ? `${stats.totalFacts.toLocaleString()} rows across ${stats.distinctFactKeys} fact-keys and ${stats.activeSources} active sources`
            : "tens of thousands of rows across the declared fact-keys and active sources"}
          .{/* TODO: derive from new stats helper post-sweep */} The
          headline reconciled fact-keys carry six or more publishers
          each: unemployment rate (12 sources), population (11),
          inflation rate (9), GDP real growth rate (7), life
          expectancy (6), public-debt ratio (6).
        </p>
      </section>

      <section className="editorial-section" id="scope">
        <h2>Scope</h2>
        <p>
          We classify each fact into one of three groups by an explicit
          per-fact-key decision, not at runtime. The group determines
          how the resolver weights freshness against authority.
        </p>

        <h3>Group A — Slow-changing identity facts</h3>
        <p>
          These facts barely move from year to year. Wording matters
          and readers cite them by name.
        </p>
        <ul>
          <li>
            Examples: capital, official short and long names, ISO 2/3
            codes, currency code, official languages, total area in
            square kilometres, time zones, internet TLD, calling
            code.
          </li>
          <li>
            <strong>Default:</strong> CIA wording wins. Wikidata can
            override only when CIA is empty and the Wikidata claim
            has a Tier-1 or Tier-2 reference. Any silent override of
            a non-empty CIA value is a bug — the dispute path is the
            only way through.
          </li>
        </ul>

        <h3>Group B — Fast-changing quantitative facts</h3>
        <p>
          These are the figures most likely to be stale on the frozen
          CIA file. Freshness is the priority.
        </p>
        <ul>
          <li>
            Examples: population, GDP nominal and PPP, GDP per capita,
            GDP growth, inflation, public debt as % of GDP,
            unemployment, life expectancy, electricity generation by
            source, internet users, CO2 emissions.
          </li>
          <li>
            <strong>Default:</strong> the fresher allow-listed source
            wins, subject to a material-error guard and a
            reference-quality floor. CIA is preserved as an alternate
            even when superseded.
          </li>
        </ul>

        <h3>Group C — Categorical and structural facts</h3>
        <p>
          These age slowly and Wikidata&apos;s reference graph is
          thinnest here.
        </p>
        <ul>
          <li>
            Examples: government type (raw CIA string), chief of
            state title, electoral system, suffrage age, legal system
            family, religion breakdown, ethnic group breakdown,
            climate type, terrain summary, natural resources, land
            use breakdown.
          </li>
          <li>
            <strong>Default:</strong> CIA wins, full stop. The
            exception is census-derived breakdowns (religion,
            ethnicity) where a recent national census from an
            allow-listed national statistical office crosses a
            defined threshold; that triggers a dispute, never a
            silent swap.
          </li>
        </ul>

        <h3>Out of scope</h3>
        <p>
          The reconciliation layer does not govern judgment claims —
          regime classification, human-rights status, contested
          geopolitical labels, &ldquo;is X a democracy.&rdquo; Each of
          these has a named primary source with its own published
          ingestion path:{" "}
          <Link href="/civica-index/methodology">Civica Index</Link>{" "}
          dimension scores (V-Dem, Freedom House, World Bank WGI,
          UNDP HDI, Transparency CPI, Global Peace Index),{" "}
          <Link href="/civica-index/methodology/pulse">Civica Pulse</Link>{" "}
          events, the Bjornskov-Rode / CGV regime taxonomy, and
          constitutional text from the Constitute Project.
          Officeholders (heads of state, heads of government) and
          party seat counts are also out of scope — they have
          purpose-built sync paths that predate this layer.
        </p>

        <h3>Country coverage policy</h3>
        <p>
          Civica covers all 193 UN member states as sovereign
          jurisdictions, plus the 2 UN observer states (the Holy See
          and Palestine), plus partially-recognized entities that
          have a user-assigned ISO 3166-1 code and are treated as
          distinct statistical units by the World Bank and IMF
          (Kosovo). This mirrors the country lists used by Our World
          in Data, the World Bank, the UN Statistical Division,
          UNDP, and V-Dem. Civica makes no editorial claim about any
          country&rsquo;s sovereignty or recognition status — the
          coverage floor is &ldquo;what UN agencies and the World
          Bank treat as a country,&rdquo; not Civica&rsquo;s own
          judgment.
        </p>
        <p>
          For Palestine, two parallel records exist: territory-level
          CIA Factbook entries for the West Bank and Gaza Strip
          (preserving the Factbook&rsquo;s separate prose for each
          territory) sit alongside a unified <code>PSE</code> row that
          acts as the iso3-keyed reconciliation target for World
          Bank, IMF, WHO, UNDP, UNESCO, and V-Dem data. Kosovo is
          included under the user-assigned ISO code <code>XKX</code>,
          following World Bank, IMF, and UNDP practice. Western
          Sahara, Hong Kong, and other CIA Factbook territory entries
          remain in the database with their Factbook content but
          without iso3 codes — they receive only Civica&rsquo;s CIA
          Factbook treatment because Tier-1 publishers do not write
          separate rows for them.
        </p>
      </section>

      <section className="editorial-section" id="sources">
        <h2>Sources</h2>
        <p>
          A Wikidata claim is accepted only if its references — via
          the <code>P248</code> &ldquo;stated in&rdquo; property or
          the <code>P854</code> reference URL — point to an entry on
          the allowlist. Allowlist entries are organised in four
          tiers; the full list lives in{" "}
          <Link href="https://github.com/fbalino/civica/blob/main/src/lib/factbook/reconcile/source-allowlist.ts">
            <code>src/lib/factbook/reconcile/source-allowlist.ts</code>
          </Link>{" "}
          and is the single source of truth — both the schema and the
          resolver import from it.
        </p>

        <h3>
          Tier 1 — Multilateral statistical agencies ({tier1Shipped.length}{" "}
          active)
        </h3>
        <ul>
          <li>
            <Link href="https://data.worldbank.org">World Bank Open Data</Link>{" "}
            — World Development Indicators (20 indicators ingested).
          </li>
          <li>
            <Link href="https://www.imf.org">International Monetary Fund</Link>{" "}
            — World Economic Outlook (WEO).
          </li>
          <li>
            <Link href="https://unstats.un.org">United Nations Statistics Division</Link>{" "}
            — UN World Population Prospects + UNData portal.
          </li>
          <li>
            <Link href="https://hdr.undp.org">UNDP Human Development Reports</Link>{" "}
            — HDI domain.
          </li>
          <li>
            <Link href="https://www.who.int/data/gho">WHO Global Health Observatory</Link>{" "}
            — health indicators canonical.
          </li>
          <li>
            <Link href="https://uis.unesco.org">UNESCO Institute for Statistics</Link>{" "}
            — literacy and education canonical.
          </li>
          <li>
            <Link href="https://stats.oecd.org">OECD.Stat</Link> —
            member-only scope (38 OECD countries).
          </li>
          <li>
            <Link href="https://www.fao.org/faostat">FAO FAOSTAT</Link>{" "}
            — agriculture domain.
          </li>
          <li>
            <Link href="https://ilostat.ilo.org">ILO ILOSTAT</Link>{" "}
            — unemployment canonical (with measured-vs-projected
            partition for ILOEST nowcasts).
          </li>
          <li>
            <Link href="https://ec.europa.eu/eurostat">Eurostat</Link>{" "}
            — EU-27 + EFTA-4 scope; multi-canonical-with-scope-predicate
            origin pattern.
          </li>
          <li>
            <Link href="https://stats.wto.org">WTO Stats</Link> —
            merchandise trade canonical (with two-fact-key split
            against the World Bank&rsquo;s goods-and-services
            aggregate).
          </li>
        </ul>
        <p>
          The International Energy Agency was scoped for v1 and{" "}
          <strong>scrapped on 4 May 2026</strong> after legal review:
          the IEA Terms of Use restrict redistribution to ≤5 data
          points on an &ldquo;occasional, ad-hoc basis,&rdquo; which
          is incompatible with Civica&rsquo;s quarterly cron and
          ~190-country redistribution model. No commercial budget was
          allocated to upgrade. The audit trail for the scrap
          decision is preserved as an internal resolution document;
          the v1 commitment is the {tier1Shipped.length} active
          publishers above.
        </p>

        <h3>
          Tier 2 — National statistical offices ({nsoActive.length} of{" "}
          {nsoWave1.length} active)
        </h3>
        <p>
          The methodology page enumerated {nsoWave1.length} NSOs by name
          during early design. {nsoActive.length} are live in v1 and{" "}
          {nsoDeferred.length} are deferred with specific blockers (see
          per-NSO entries below). New NSOs are added on demand — when a
          fact-key for a specific country has no Tier-1 coverage, an NSO
          is its authoritative source, or readers ask for it. The
          long-term goal is roughly {nsoTarget.min}–{nsoTarget.max} NSO
          domains, which subsequent NSO waves will pursue. Every addition
          triggers a methodology version bump.
        </p>
        <ul>
          <li>
            <strong>US Census Bureau</strong> (live) — ACS 1-Year +
            Decennial; population, unemployment, urbanisation
            indicators for the United States.
          </li>
          <li>
            <strong>ONS-UK</strong> (live) — public time-series API;
            population, CPIH inflation, GDP real growth, unemployment
            for the United Kingdom.
          </li>
          <li>
            <strong>INSEE-FR</strong> (live) — SDMX-XML; population,
            inflation, GDP, unemployment for France. First
            non-English-language NSO precedent.
          </li>
          <li>
            <strong>Statistics Canada</strong> (live) — Web Data
            Service; population, inflation, GDP, unemployment for
            Canada.
          </li>
          <li>
            <strong>IBGE-BR</strong> (live) — SIDRA REST; population,
            IPCA inflation, PNADC unemployment, real GDP growth for
            Brazil. First Portuguese-only NSO precedent.
          </li>
          <li>
            <strong>Stats SA</strong> (live) — PDF release ingest via
            Anthropic SDK native PDF support; population, CPI
            inflation, QLFS unemployment, quarterly GDP for South
            Africa. First PDF-extraction NSO precedent.
          </li>
          <li>
            <strong>Destatis-DE</strong> ({destatisDeParenthetical}) — the
            Genesis-Online API requires manual account creation with
            regulatory review, which falls outside Civica&rsquo;s
            unattended-cron architecture. Eurostat republishes
            Destatis figures within weeks at harmonised methodology,
            so Germany has Tier-1 coverage today via Eurostat.
            Destatis ships when the registration step is automated
            or manual provisioning becomes feasible.
          </li>
          <li>
            <strong>NBS-Nigeria</strong> ({nbsNigeriaParenthetical}) — the
            National Bureau of Statistics license forbids
            redistribution without a written partnership agreement,
            and the public API surface is unstable. Nigeria has World
            Bank, IMF, UN, and UNDP coverage; the NBS NSO channel
            ships when the license posture is renegotiated.
          </li>
        </ul>

        <h3>Tier 3 — CIA World Factbook</h3>
        <p>
          The CIA file is public-domain and remains the default for
          identity facts (Group A) and categorical facts (Group C),
          regardless of what Wikidata claims. It is treated as
          frozen-as-of January 2026.
        </p>

        <h3>Tier 4 — Wikidata as a structured pipe</h3>
        <p>
          A Wikidata claim is never &ldquo;self-citing&rdquo; for our
          purposes. What we trust is the Tier-1 or Tier-2 source the
          claim points at; Wikidata is the structured query path. A
          Wikidata claim with no allow-listed reference is rejected
          at sync time and never enters the canonical store.
        </p>

        <h3>Explicitly rejected references</h3>
        <p>
          Wikidata claims whose only references are
          imported-from-Wikipedia (<code>P143</code>), Wikipedia
          itself, generic news aggregators (Worldometers,
          Statista&rsquo;s free tier), personal blogs, social media,
          self-published advocacy NGO claims for facts they are not
          the primary source of, or a Wikidata mirror of CIA Factbook
          (we want the primary CIA file directly). A claim with
          multiple references is accepted if at least one reference
          is on the allowlist; a majority is not required.
        </p>
      </section>

      <section className="editorial-section" id="resolver">
        <h2>The resolver</h2>
        <p>
          Given a country and a fact key, the resolver returns one
          canonical value plus the full list of alternates. Rules are
          evaluated in order. If only one source row exists for a
          fact, that value is used. Otherwise the rules below apply
          by group.
        </p>
        <p>
          For Groups A and C, when sources agree within tolerance
          (within 2% for counts, within 0.5 percentage points for
          rates, exact match for strings after Unicode normalisation),
          CIA is preferred when present. For Group B the resolver
          does not short-circuit on agreement — even when CIA and a
          fresher source agree within tolerance, the fresher
          allow-listed source wins and CIA is preserved as an
          alternate. This is because freshness is the whole point for
          fast-changing facts.
        </p>
        <p>When sources disagree, two guards apply for Group B:</p>
        <ul>
          <li>
            <strong>Material-error rejection.</strong> A fresher value
            differing from the older one by more than a per-category
            &ldquo;impossible&rdquo; threshold (population &gt; 50%
            in a year, GDP nominal in USD &gt; 80%, inflation and
            public-debt ratios &gt; 300 percentage points after the
            5 May 2026 hyperinflation hot-fix) is rejected as likely
            data corruption or a unit-of-measure error. A dispute row
            is created and the prior canonical value remains until
            reviewed.
          </li>
          <li>
            <strong>Reference-quality floor.</strong> The fresher
            source must have at least one Tier-1 or Tier-2 reference.
            A Wikidata claim whose references are all rejected per
            the allowlist cannot win even if it is fresher.
          </li>
        </ul>
        <p>
          The eight worked examples that follow are normative — they
          are pinned to the live database as of the methodology{" "}
          {reconciliation.version} cut. Each illustrates a distinct
          reconciliation pattern. Every value is real and was probed
          against the resolver before this page shipped.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
            fontStyle: "italic",
            margin: "var(--space-2) 0 var(--space-5)",
          }}
        >
          Footnote on vintage. Specific numerical values cited below
          reflect {currentVintage}; the methodologically-relevant
          claim in each example is the pattern of canonical/alternate
          attribution, not the exact figure. Future vintages may
          refresh the underlying numbers; the resolver outcome
          (which row wins canonical) is preserved by the rule, not
          the figure.
        </p>

        <h3 id="example-argentina-inflation">
          Worked example 1 — Argentina inflation, hyperinflation hot-fix
        </h3>
        <p>
          <strong>Pattern.</strong> Group B fresher-source-wins after
          the post-canonical-pick-investigation material-error
          threshold raise (50 pp → 300 pp for{" "}
          <code>inflation_rate</code> and{" "}
          <code>public_debt_pct_gdp</code>).
        </p>
        <p>
          <strong>Live rows.</strong> The World Bank reports 219.88%
          (2024). The IMF World Economic Outlook reports 7.5% (2031,
          tagged as a projection). The CIA World Factbook reports
          73.1% (2022, frozen).
        </p>
        <p>
          <strong>Resolver outcome.</strong> The World Bank&rsquo;s
          219.88% (2024) wins canonical with{" "}
          <code>decisionReason=&apos;fresher_winner&apos;</code>. The
          CIA value moves to alternate.
        </p>
        <p>
          <strong>Story.</strong> Before 5 May 2026, the resolver
          picked the CIA&rsquo;s 73.1% (2022) as canonical because
          the material-error guard rejected the World Bank&rsquo;s
          219.88% (2024) reading as a &ldquo;data error&rdquo; — the
          gap of 146.78 percentage points exceeded the original 50 pp
          threshold. But Argentina&rsquo;s inflation really did go
          from ~73% in 2022 to ~220% by 2024 during a hyperinflation
          episode. A targeted investigation raised the threshold to
          300 pp specifically for high-volatility fact-keys. After
          the raise, the World Bank&rsquo;s 2024 reading wins
          canonical correctly. Two material-error disputes from
          prior runs were auto-closed by the disputes-triage cron
          with status <code>resolved_auto_stale</code>.
        </p>

        <h3 id="example-usa-life-expectancy">
          Worked example 2 — United States life expectancy, editorial
          canonical vs freshest
        </h3>
        <p>
          <strong>Pattern.</strong> Editorial-canonical assertion
          preserved alongside freshness-driven canonical pick. Two
          honest answers to two different questions: <em>who measured
          this</em> versus <em>what&rsquo;s the most recent
          measurement</em>.
        </p>
        <p>
          <strong>Live rows.</strong> The World Bank reports 78.89
          years (2024). The CIA reports 80.9 years (2024, frozen).
          WHO Global Health Observatory reports 76.37 years (2021),
          tagged{" "}
          <code>civicaRole=&apos;canonical&apos;</code> as the
          editorial-domain authority. UN WPP reports 77.05 years
          (2024). UNDP HDI reports 79.30 years (2023). Wikidata
          reports 77.0 years (2022).
        </p>
        <p>
          <strong>Resolver outcome.</strong> UN WPP&rsquo;s 77.05
          (2024) wins canonical with{" "}
          <code>decisionReason=&apos;fresher_winner&apos;</code>.
          Multiple Tier-1 publishers (UN, World Bank, CIA) all carry
          a 2024 reading; the runtime canonical pick among same-vintage
          Tier-1 publishers is sensitive to the tied-date tiebreak
          ordering rather than to a methodology assertion (open
          question logged at v1.0-followup §3.1). The alternates panel
          renders WHO 76.37 (2021) labelled as the editorial canonical
          alongside the World Bank, CIA, UNDP, and Wikidata rows.
        </p>
        <p>
          <strong>Story.</strong> WHO is the editorial canonical for{" "}
          <code>life_expectancy_years</code> because nearly every
          other major publisher republishes WHO&rsquo;s underlying
          GHO methodology. But WHO&rsquo;s last release for the
          United States was 2021 on its publisher cycle; UN, the
          World Bank, and the CIA all have 2024 readings that are
          fresher. Civica&rsquo;s resolver picks the freshest
          within-envelope row, while the alternates panel discloses
          the editorial canonical alongside. When WHO ships its 2024
          release, the canonical pick will move back to WHO
          automatically — no methodology change needed. The longer
          expansion of this pattern lives in the &ldquo;Editorial
          canonical vs displayed value&rdquo; section below.
        </p>

        <h3 id="example-germany-gdp">
          Worked example 3 — Germany GDP growth, multi-canonical with
          scope predicate
        </h3>
        <p>
          <strong>Pattern.</strong> Multi-canonical-with-scope-predicate
          pattern (Eurostat origin). Eurostat is canonical for the
          EU-27 + EFTA-4 subset on{" "}
          <code>gdp_real_growth_rate</code>, while the IMF and World
          Bank stay canonical globally. Both publishers can be tagged{" "}
          <code>civicaRole=&apos;canonical&apos;</code> for the same
          fact-key, distinguished by scope.
        </p>
        <p>
          <strong>Live rows.</strong> Eurostat reports 0.2% (2025),
          tagged canonical for the EU+EFTA scope. The World Bank
          reports −0.50% (2024), tagged canonical globally. The IMF
          reports 0.6% (2031), tagged as a projection (excluded from
          the candidate pool).
        </p>
        <p>
          <strong>Resolver outcome.</strong> Eurostat&rsquo;s 0.2%
          (2025) wins canonical with{" "}
          <code>decisionReason=&apos;incumbent_held&apos;</code>. The
          alternates panel labels Eurostat <em>canonical (EU+EFTA)</em>{" "}
          and the World Bank <em>canonical (global)</em>.
        </p>
        <p>
          <strong>Story.</strong> Eurostat republishes Destatis data
          for Germany within weeks of national release with
          EU-harmonised methodology. For EU-27 + EFTA-4
          jurisdictions, Eurostat ships canonical alongside the
          global Tier-1 publishers without forcing any of them to
          alternate. The scope predicate (<code>iso2 IN (EU27 + EFTA4)</code>)
          is the methodology primitive that lets two publishers
          coexist as canonical. Because the resolver is
          freshness-driven, whichever publisher ships latest wins the
          runtime pick; the editorial-canonical layer just records
          that both are authoritative for their declared scopes.
          When Destatis ships in v1.1, Germany will see three
          canonical publishers: Eurostat, Destatis, and IMF.
        </p>

        <h3 id="example-uk-inflation">
          Worked example 4 — United Kingdom inflation, NSO override
        </h3>
        <p>
          <strong>Pattern.</strong> NSO-as-canonical-override via
          freshness alone. The same multi-canonical-with-scope-predicate
          pattern, extended to country-singleton scope.
        </p>
        <p>
          <strong>Live rows.</strong> ONS-UK reports 3.9% CPIH (2025).
          The World Bank reports 3.27% (2024). The IMF reports 2.0%
          (2031, projected). The CIA reports 3.3% (2024, frozen).
        </p>
        <p>
          <strong>Resolver outcome.</strong> ONS-UK&rsquo;s 3.9%
          (2025) wins canonical with{" "}
          <code>decisionReason=&apos;fresher_winner&apos;</code>. CPIH
          (the UK&rsquo;s statistical concept that includes
          owner-occupied housing) has been the ONS headline measure
          since 2017.
        </p>
        <p>
          <strong>Story.</strong> ONS publishes UK inflation 3–9 months
          ahead of the World Bank or IMF. The resolver&rsquo;s
          freshness primitive picks ONS without any schema change —{" "}
          <code>civicaRole=&apos;canonical&apos;</code> is editorial
          metadata, not a resolver input. The methodology resolution
          for ONS-UK explicitly chose &ldquo;freshness alone
          implements the NSO override&rdquo; rather than introducing
          an NSO priority tier. The same pattern applies to all{" "}
          {nsoActive.length} NSOs in v1: {nsoActiveNamesProse}. CPI as a separate ONS measure is
          deferred to v1.1 with a future <code>inflation_rate_cpi</code>{" "}
          fact-key extension; for v1, only CPIH ships.
        </p>

        <h3 id="example-sa-unemployment">
          Worked example 5 — South Africa unemployment, PDF-extraction NSO
        </h3>
        <p>
          <strong>Pattern.</strong> Novel ingest pattern — PDF
          extraction via the Anthropic SDK&rsquo;s native PDF support.
          Stats SA has no API; its data ships as monthly and
          quarterly PDF releases at stable URLs. The methodology is
          &ldquo;scrape with a deterministic LLM call, not a
          regex.&rdquo;
        </p>
        <p>
          <strong>Live rows.</strong> Stats SA reports 31.4% (Q4
          2025, with <code>as_of=2025-12-31</code>) from the LU1 row
          of Quarterly Labour Force Survey Table A. The World Bank
          reports 32.39% (2025). ILO ILOSTAT reports 32.59% (2027,
          tagged as an ILOEST nowcast projection — excluded from the
          candidate pool). The IMF reports 31.9% (2031, projected).
          The CIA reports 33.2% (2024, frozen). Wikidata holds an
          older 27.2% (2018) claim.
        </p>
        <p>
          <strong>Resolver outcome.</strong> Stats SA&rsquo;s 31.4%
          (Q4 2025) wins canonical with{" "}
          <code>decisionReason=&apos;fresher_winner&apos;</code>.
        </p>
        <p>
          <strong>Story.</strong> Stats SA publishes the Quarterly
          Labour Force Survey (P0211) as a 5 MB PDF at a stable URL
          pattern. The R.19 sync uses a Claude Haiku call with{" "}
          <code>temperature: 0</code> to extract Table A&rsquo;s LU1
          row deterministically, with the prompt structured as a
          tool-use call so the output JSON is shape-stable. There is
          no <code>pdftotext</code> binary available in the
          deployment runtime, no <code>pdf-parse</code> dependency
          added, and no fragile regex against template-rejigs at the
          publisher. The cost is roughly $0.01 per quarterly sync.
          The same pattern applies to inflation (P0141) and quarterly
          GDP growth (P0441). The pattern is reusable for any future
          NSO whose primary release surface is PDF rather than a
          machine-readable API.
        </p>

        <h3 id="example-imf-projection">
          Worked example 6 — IMF projection vs measurement
        </h3>
        <p>
          <strong>Pattern.</strong> The <code>value_type</code>{" "}
          partition. IMF WEO ships forward projections through the
          current year + 5 years. The resolver requires the
          canonical pick to be a measurement whenever any measurement
          exists for the same (jurisdiction, fact-key) pair.
          Projections only win canonical when no measurement exists
          (e.g., <code>fiscal_balance_pct_gdp</code> for IMF-only
          countries).
        </p>
        <p>
          <strong>Live rows for Argentina population_total.</strong>{" "}
          The CIA reports 45,418,096 (2025, measured). The World Bank
          reports 45,696,160 (2024, measured). UN WPP reports
          45,696,160 (2024, measured — bit-exact match to the World
          Bank because the World Bank republishes UN WPP). The IMF
          reports 50,394,000 (2031, projected). Wikidata holds an
          older 44,938,712 (2019, measured) claim.
        </p>
        <p>
          <strong>Resolver outcome.</strong> The CIA&rsquo;s 45.4 M
          (2025) wins canonical with{" "}
          <code>decisionReason=&apos;incumbent_held&apos;</code>. The
          IMF&rsquo;s 50.4 M (2031 projection) is excluded from the
          candidate pool by the measurement-vs-projection partition;
          it surfaces in the alternates panel labelled <em>(projected)</em>.
        </p>
        <p>
          <strong>Story.</strong> Before the 4 May 2026 fix, the
          IMF&rsquo;s 2031 projection was winning Argentina&rsquo;s
          canonical race against UN/WB 2024 measurements because the
          freshness comparator treated future <code>as_of</code> dates
          the same as past ones. The fix added an explicit{" "}
          <code>value_type</code> enum to <code>country_facts</code>{" "}
          (<code>measured</code> | <code>projected</code>) and a
          year-based discriminator at IMF sync time:{" "}
          <code>fact_year &gt; current_year → projected</code>. The
          resolver&rsquo;s candidate pool now filters to{" "}
          <code>value_type=&apos;measured&apos;</code> first; IMF
          projections appear in the alternates panel with a
          projection flag. 1,716 IMF rows tagged{" "}
          <code>projected</code>; 1,396 (jurisdiction, fact-key)
          pairs un-flipped to the correct measurement. The underlying
          methodology is documented further in the &ldquo;Measurement
          vs projection&rdquo; section below.
        </p>

        <h3 id="example-brazil-population">
          Worked example 7 — Brazil population, six publishers, IBGE
          override
        </h3>
        <p>
          <strong>Pattern.</strong> NSO override layered over
          multi-publisher disagreement that is methodologically real,
          not an error.
        </p>
        <p>
          <strong>Live rows.</strong> IBGE reports 213,421,040
          (2025), tagged{" "}
          <code>civicaRole=&apos;canonical&apos;</code> for Brazil.
          The CIA reports 221,359,387 (2025, frozen). The World Bank
          reports 211,998,573 (2024). UN WPP reports 211,998,573
          (2024, bit-exact match — World Bank republishes UN). The
          IMF reports 216,988,990 (2031, projected). Wikidata holds
          an older 203,062,512 (2022) claim.
        </p>
        <p>
          <strong>Resolver outcome.</strong> IBGE&rsquo;s 213.4 M
          (2025) wins canonical with{" "}
          <code>decisionReason=&apos;fresher_winner&apos;</code>. The
          CIA&rsquo;s 221.4 M (2025) is the second-place alternate.
        </p>
        <p>
          <strong>Story.</strong> Brazil is the showcase reconciliation
          case: the same fact has six values from five publishers,
          all at different vintages and using slightly different
          methodology. IBGE wins canonical because it is the freshest
          measurement from the country&rsquo;s own statistical office.
          The CIA&rsquo;s 221.4 M (2025) is a CIA Factbook 2025
          projection that diverges from IBGE&rsquo;s 213.4 M actual
          estimate by about 3.7%, reflecting different underlying
          demographic models. UN/WB&rsquo;s 211.99 M (2024) is one
          year older. The IMF&rsquo;s 216.99 M (2031) is a forecast.
          The alternates panel shows all six rows labelled by
          methodology, vintage, and source role.
        </p>

        <h3 id="example-marshall-islands">
          Worked example 8 — Marshall Islands population,
          disputed-pending case
        </h3>
        <p>
          <strong>Pattern.</strong> The disputes system in production.
          The material-error gap is real — about 119% between the
          CIA&rsquo;s value and the World Bank&rsquo;s — and the
          disagreement reflects a genuine definitional split, not a
          typo. The auto-resolve cron preserves these as open rather
          than auto-closing.
        </p>
        <p>
          <strong>Live rows.</strong> The CIA reports 82,011 (2024,
          frozen). The World Bank reports 37,548 (2024). UN WPP
          reports 37,548 (2024, bit-exact match). The IMF reports
          33,000 (2031, projected). Wikidata holds an older 53,127
          (2017) claim.
        </p>
        <p>
          <strong>Resolver outcome.</strong> The CIA&rsquo;s 82,011
          (2024) holds canonical via{" "}
          <code>decisionReason=&apos;incumbent_held&apos;</code>. The
          material-error guard fires because the gap exceeds the
          population threshold, so the World Bank cannot displace the
          CIA on freshness alone. Two open <code>material_error</code>{" "}
          disputes sit in the queue at{" "}
          <Link href="/factbook/methodology/reconciliation/disputes">
            /factbook/methodology/reconciliation/disputes
          </Link>{" "}
          awaiting human review.
        </p>
        <p>
          <strong>Story.</strong> This is a genuine multi-source
          disagreement, not a data-entry mistake. The CIA&rsquo;s
          82,011 figure follows in-country census methodology; the
          World Bank and UN&rsquo;s 37,548 follows a different
          demographic accounting that excludes the large Marshallese
          diaspora holding permanent right of residency under the
          Compact of Free Association with the United States. Both
          methodologies are defensible; the resulting answers differ.
          The disputes-triage cron correctly preserves these as{" "}
          <code>status=&apos;open&apos;</code> rather than
          auto-closing them. By contrast, 31 of 33 disputes in the
          live system were stale by-products of pre-threshold-raise
          resolver runs, and the cron correctly closed them as{" "}
          <code>status=&apos;resolved_auto_stale&apos;</code>. The
          Marshall Islands case is the closest the live system has to
          a textbook disputed-pending case — open for review,
          methodology-grade rather than mechanical.
        </p>
      </section>

      <section className="editorial-section" id="value-types">
        <h2>Measurement vs projection</h2>
        <p>
          Some publishers — most prominently the IMF World Economic
          Outlook and the ILO ILOEST nowcasts — ship rows whose{" "}
          <code>as_of</code> date is in the future, because the row is
          a forward projection rather than a historical measurement.
          The resolver requires the canonical pick to be a
          measurement whenever any measurement exists for the same
          (jurisdiction, fact-key) pair, by tagging every row with an
          explicit <code>value_type</code> enum (<code>measured</code>{" "}
          | <code>projected</code>) and partitioning the candidate
          pool to <code>measured</code> first. Projections only win
          canonical as a fallback (the IMF&rsquo;s{" "}
          <code>fiscal_balance_pct_gdp</code> for countries with no
          alternate publisher is the canonical singleton case). The
          methodology is documented in detail in the internal
          forecast-vs-measurement resolution document; the
          implementation pins the year-based discriminator
          (<code>fact_year &gt; current_year → projected</code>) at
          sync time per publisher.
        </p>
        <p>
          Because of this partition, the alternates panel always
          shows the IMF projection alongside the canonical
          measurement, labelled with a projection flag. Worked
          Example 6 above (Argentina population) is the canonical
          illustration.
        </p>
      </section>

      <section className="editorial-section" id="multi-canonical">
        <h2>Multi-canonical with scope predicate</h2>
        <p>
          Sometimes two or three publishers are concurrently
          authoritative for the same fact-key, each at a different
          scope. Eurostat is canonical for EU-27 + EFTA-4
          jurisdictions on macroeconomic indicators; the IMF is
          canonical globally. ONS-UK is canonical for the United
          Kingdom; the World Bank is canonical globally. IBGE is
          canonical for Brazil; the IMF and World Bank stay canonical
          globally. Civica resolves this with a per-row{" "}
          <code>civicaRole</code> tag scoped by jurisdiction predicate,
          rather than forcing one publisher to alternate for the
          same fact-key.
        </p>
        <p>
          The pattern matters because the alternates panel will
          sometimes show two or three rows tagged <em>canonical</em>,
          each labelled with its scope. A reader inspecting
          Germany&rsquo;s GDP growth sees Eurostat tagged canonical
          (EU+EFTA), the World Bank tagged canonical (global), and
          the IMF row tagged as a projection. None of this requires
          resolver schema changes — the resolver itself remains a
          freshness-driven engine; the editorial role tags are
          layered metadata that the alternates panel surfaces.
        </p>
        <p>
          The pattern was first surfaced by OECD&rsquo;s member-only
          scope on <code>public_debt_pct_gdp</code>, then formalised
          by the Eurostat resolution which named the
          &ldquo;multi-canonical with scope predicate&rdquo;
          primitive, then extended by NSO Wave 1 which applied the
          same pattern to country-singleton scopes. Worked Examples
          3 (Germany GDP) and 4 (UK inflation) above are the
          canonical illustrations.
        </p>
      </section>

      <section className="editorial-section" id="two-fact-keys">
        <h2>Two-fact-key splits</h2>
        <p>
          A different methodology question arises when two publishers
          measure <em>different things</em> under similar names. When
          this happens, Civica declares two distinct fact-keys rather
          than forcing one to alternate.
        </p>
        <p>
          The first established case is trade aggregates. The World
          Trade Organization publishes{" "}
          <code>exports_merchandise_usd</code> — goods crossing
          borders, no services. The World Bank publishes{" "}
          <code>exports_goods_services_usd</code> — goods plus
          commercial services. For the United States in 2024, the WTO
          figure is about $2.06 trillion and the World Bank figure is
          about $3.19 trillion — a $1.1 trillion gap that exactly
          matches the missing services component. The two numbers are
          not &ldquo;approximately the same exports figure with
          different vintages&rdquo;; they are exports and
          exports-plus-services. The methodologically correct answer
          is that both are displayed, clearly labelled, side by side.
          The same split applies to imports.
        </p>
        <p>
          A second case is queued for v1.1: ONS-UK&rsquo;s
          Public-Sector Net Debt (PSND, the UK statistical concept)
          versus the IMF&rsquo;s General-Government Gross Debt
          (Maastricht-style). ONS&rsquo;s PSND excludes public-sector
          banks and applies UK-specific accounting; the IMF measure
          applies harmonised international accounting. Forcing them
          into a single <code>public_debt_pct_gdp</code> fact-key
          would mix incommensurable measures. The v1.1 split will
          declare them as siblings under separate fact-keys.
        </p>
        <p>
          The shape mirrors what reference institutions like Our
          World in Data already do: when two upstream publishers
          measure genuinely different things, surface both with
          honest labels.
        </p>
      </section>

      <section className="editorial-section" id="vintaging">
        <h2>Vintaging</h2>
        <p>
          Each <code>country_facts</code> row carries the upstream
          measurement date (<code>as_of</code>), our retrieval date,
          and the upstream dataset version where known (e.g.{" "}
          <code>World Bank WDI 2026Q3</code>,{" "}
          <code>CIA Factbook 2026-01-frozen</code>,{" "}
          <code>IMF WEO 2026 April</code>,{" "}
          <code>ONS UK 2026Q2</code>,{" "}
          <code>IBGE SIDRA 2026Q2</code>,{" "}
          <code>Stats SA 2026Q2</code>). On top of those per-row
          upstream vintages, Civica freezes a quarterly{" "}
          <strong>reconciled-fact vintage</strong> — a snapshot of
          the resolver&rsquo;s output for every country and fact at
          the cut moment. The cadence is{" "}
          <strong>15 days after each calendar quarter end</strong>:
          15 January, 15 April, 15 July, 15 October at 04:00 UTC. The
          T+15 day buffer gives publishers with quarter-end releases
          time to finish their normal cadence before the cut.
        </p>
        <p>The vintage label format is:</p>
        <p>
          <code>
            Civica Atlas Reconciled v&lt;methodology_version&gt; — vintage &lt;YYYY-Qn&gt;
          </code>
        </p>
        <p>
          The first frozen v1 vintage is{" "}
          <strong>
            <code>
              Civica Atlas Reconciled {reconciliation.version} — vintage{" "}
              {reconciliation.firstVintage}
            </code>
          </strong>
          , cut on{" "}
          {new Date(reconciliation.firstVintageCutDate).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
          )}{" "}
          over {stats ? stats.activeSources : "the"} active sources writing through
          the resolver. The methodology version is embedded in the
          label so any cited vintage value carries the rules that
          produced it. When methodology revises to the next version,
          the next vintage label embeds it, and the{" "}
          {reconciliation.version} vintages remain stable as historical
          citations.
        </p>
        <p>
          Pinning a citation to a specific vintage gives the reader a
          value that does not move. If the upstream World Bank
          revises a 2024 GDP figure six months later, that revision
          lands in a new vintage; the prior snapshot is unchanged.
          Civica stores vintages uniformly, while displays can filter
          quarters where nothing materially changed so readers do not
          need to scroll past silent vintages.
        </p>
      </section>

      <section className="editorial-section" id="source-dot">
        <h2>How to read a SourceDot</h2>
        <p>
          Every reconciled fact on the site carries a small dot to
          the right of the value. The dot colour signals freshness:
        </p>
        <ul>
          <li>
            <strong>Green dot.</strong> The upstream source still
            updates and our last sync succeeded. The hover tooltip
            shows the source name, license, and the measurement date.
          </li>
          <li>
            <strong>Amber dot.</strong> The upstream source is frozen
            (the CIA Factbook after January 2026, for example) or our
            sync has not refreshed within the expected cadence.
          </li>
          <li>
            <strong>Disputed chip.</strong> A small{" "}
            <code>(disputed)</code> chip appears next to the dot when
            the fact has an open dispute. The fact continues to
            render its prior canonical value while the dispute is
            open.
          </li>
        </ul>
        <p>
          Click the dot (or the small <code>+</code> affordance next
          to it) to open the alternate-values panel. The panel lists
          every source row Civica holds for that fact, with the
          canonical row highlighted, the rejected rows shown with the
          reason, the measurement date for each row, the editorial
          role tag (<em>canonical</em>, <em>alternate</em>, or{" "}
          <em>projection</em>), and a direct link to the upstream
          reference. The panel header carries the methodology
          version. When a dispute is open, the panel surfaces a
          banner naming the contested rows.
        </p>
        <p>
          On factbook reader pages, multi-year series (inflation,
          public debt, GDP variants, unemployment, military
          expenditure, current-account balance, exports, imports) get
          a &ldquo;Civica canonical (reconciled)&rdquo; row prepended
          above the CIA&rsquo;s per-year prose. The CIA&rsquo;s
          historical context is preserved; the reconciled current
          canonical sits at the top.
        </p>
      </section>

      <section className="editorial-section" id="editorial-canonical">
        <h2>Editorial canonical vs displayed value</h2>
        <p>
          Sometimes the source Civica regards as the editorial
          authority for a fact is not the source whose number ends up
          on the country page. This is intentional. Civica separates
          two questions:
        </p>
        <ul>
          <li>
            <strong>Who measured this?</strong> The editorial
            canonical — the publisher Civica trusts as the
            authoritative reference for the fact. For health facts
            like life expectancy and infant mortality, that is the
            World Health Organization (WHO). For trade
            (merchandise), the World Trade Organization. For
            unemployment, the International Labour Organization. For
            literacy, UNESCO. For HDI, UNDP. Civica records this as a
            tag (<code>civicaRole: &ldquo;canonical&rdquo;</code>) on
            the source row.
          </li>
          <li>
            <strong>What&rsquo;s the most recent measurement?</strong>{" "}
            The displayed value — the freshest within-envelope row
            from any allow-listed source. The resolver picks this by
            date. The alternates panel surfaces the editorial
            canonical alongside, clearly labelled.
          </li>
        </ul>
        <p>
          When the editorial canonical happens to also be the freshest
          source, both questions resolve to the same row and there is
          nothing to explain. But canonical publishers often release
          on slow cycles — the UN Population Division refreshes its
          World Population Prospects dataset every two years, and the
          WHO GHO ships life-expectancy on a similar slow cadence.
          While that cycle runs, fresher data from the CIA, the
          World Bank, or an NSO may sit on the same fact and win on
          freshness. The country page shows the freshest value; the
          alternates panel shows the editorial canonical alongside.
          Worked Example 2 above (United States life expectancy,
          where UN WPP&rsquo;s 77.05 (2024) wins display
          while WHO&rsquo;s 76.37 (2021) is editorially canonical) is
          the textbook case.
        </p>
        <p>
          The same pattern surfaces on Brazil&rsquo;s population.
          Civica holds six values for that fact, each from a
          different publisher, each with a different measurement
          date: IBGE 213,421,040 (2025) — the NSO winner; the CIA
          221,359,387 (2025); the World Bank 211,998,573 (2024); UN
          WPP 211,998,573 (2024, bit-exact match); the IMF
          216,988,990 (2031, projected); Wikidata 203,062,512 (2022).
          UN is the editorial canonical for population because nearly
          every other source — including the World Bank — derives
          its number from UN WPP. IBGE wins on freshness in 2025
          because the country&rsquo;s own statistical office
          publishes ahead of UN&rsquo;s biennial revision. When UN
          ships the next WPP revision, the canonical pick will move
          back to UN automatically — no methodology change needed.
        </p>
        <p>
          This is not a contradiction. It is how Civica balances two
          honest answers to two different questions:{" "}
          <em>who measured this</em>, and{" "}
          <em>what&rsquo;s the most recent measurement</em>. A reader
          who sees an NSO value on the country page and a UN or WHO
          label on the alternates panel is seeing the system working
          as designed.
        </p>
      </section>

      <section className="editorial-section" id="canonical-flips">
        <h2>Canonical-flip handoffs and shared canonical publishers</h2>
        <p>
          Two refinements of the editorial-canonical convention are
          worth surfacing here so a reader who notices the unusual
          pattern in the alternates panel can understand why.
        </p>
        <p>
          <strong>Canonical-flip handoffs.</strong> When Civica adds
          a new sync orchestrator that ingests data directly from an
          upstream-of-record publisher, fact-keys previously sourced
          from a downstream republisher get their editorial role
          flipped — the upstream publisher becomes canonical, the
          republisher becomes alternate. The values do not change;
          only the citation label moves.
        </p>
        <p>
          The flagship example: in early 2026, Civica ingested mean
          and expected years of schooling from the UN Development
          Programme&rsquo;s Human Development Report. UNDP HDR was
          tagged canonical because it was the only Tier-1 source
          Civica ingested for those two indicators. The fact-key
          registry expansion later added a direct UNESCO Institute
          for Statistics sync for the same indicators. UNESCO is the
          upstream-of-record — UNDP republishes UNESCO&rsquo;s
          figures as inputs to the HDI composite. The editorial
          canonical flipped to UNESCO; UNDP rows in{" "}
          <code>country_facts</code> were re-written on the next
          idempotent sync with the alternate label. Same values, same
          citation count, more accurate attribution.
        </p>
        <p>
          <strong>Shared canonical publishers.</strong> A small number
          of fact-keys are computed by two independent Tier-1
          publishers using the same joint methodology. When this
          happens, both publishers ship as canonical — neither is the
          &ldquo;true&rdquo; upstream.
        </p>
        <p>
          The first such case landed at{" "}
          <code>health_expenditure_pct_gdp</code>: the WHO Global
          Health Expenditure Database (~190 countries) and the OECD
          System of Health Accounts (51 countries — 38 OECD members
          plus 13 SHA partners) both apply the SHA-2011 methodology
          jointly developed by WHO, OECD, and Eurostat. Their
          numerators (current health expenditure summed across all
          financing schemes) and denominators (GDP at market prices)
          come from the same primary national health-account
          submissions; values converge to within ~0.1 percentage
          points and the small remaining noise reflects GDP-revision
          pickup timing rather than real methodological disagreement.
          The resolver picks the fresher row within envelope; the
          alternates panel renders both as editorial canonical for
          their respective coverage scopes.
        </p>
        <p>
          A reader who sees two canonical labels next to one fact is
          looking at the second pattern. A reader who sees a UNESCO
          canonical label on a row that used to cite UNDP is looking
          at the first. These patterns are distinct from the
          multi-canonical-with-scope-predicate pattern documented
          above (where two publishers are canonical for the same
          fact-key in different scopes); here the two publishers are
          jointly methodologically responsible for the measurement
          itself.
        </p>
      </section>

      <section className="editorial-section" id="disputes">
        <h2>Disputes</h2>
        <p>
          A dispute row is opened automatically when a numeric
          disagreement exceeds the material-error guard, when a
          Group A or Group C silent-override would have been
          required, when a claim is rejected per the plausibility
          envelope, or when a Wikidata claim flips from
          non-deprecated to deprecated rank for an existing canonical
          value.
        </p>
        <p>
          The full dispute log is published as a public read-only
          surface at{" "}
          <Link href="/factbook/methodology/reconciliation/disputes">
            /factbook/methodology/reconciliation/disputes
          </Link>{" "}
          — every open dispute, every resolved dispute, the system
          actions taken on each, and the methodology rationale where
          one was recorded. Reviewer identity is redacted; submitter
          PII is stripped. The Marshall Islands population case
          (Worked Example 8 above) is a live entry in that log.
        </p>
        <p>
          Readers can also file a dispute manually. The unified
          corrections form at{" "}
          <Link href="/civica-index/corrections">
            /civica-index/corrections
          </Link>{" "}
          accepts factbook fact disputes; per-fact &ldquo;report
          this fact&rdquo; links pre-fill the country and fact key
          for you, which substantially improves submission quality.
          Each submission becomes a row in the operator queue.
        </p>
        <p>
          Operators review through an admin shell. They see both
          values, both citations, both measurement dates, a diff
          highlight, the resolver&rsquo;s proposed action and
          rationale, and three buttons: accept the proposal, override
          and pick a specific source, or hold for further
          investigation. Every action writes to an audit log with
          before-and-after JSON snapshots, the reviewer&rsquo;s
          identity, the action, and any notes.
        </p>
        <p>
          A daily auto-resolve cron at 02:30 UTC re-evaluates every
          open <code>material_error</code> dispute against the current
          resolver output. If the resolver no longer proposes the
          dispute (because thresholds have been refined or because
          the underlying values have shifted), the cron marks it{" "}
          <code>resolved_auto_stale</code> with an audit-log row. The
          stale-cleanup pattern accounts for the empirical observation
          that 31 of 33 disputes in the live system were stale
          by-products of pre-threshold-raise resolver runs. Group A,
          Group C, and plausibility-envelope disputes are{" "}
          <em>never</em> auto-resolved — identity and categorical
          conflicts always require human eyes.
        </p>
        <p>
          Resolution targets — these are targets, not gates; the fact
          continues to render the prior canonical value while the
          dispute is open:
        </p>
        <ul>
          <li>
            Numeric disagreements with both sources Tier-1 —{" "}
            {disputeSla.group.B_tier1} days.
          </li>
          <li>
            Group A identity overrides — {disputeSla.group.A} days.
          </li>
          <li>
            Group C breakdown overrides — {disputeSla.group.C} days.
          </li>
          <li>
            Plausibility-envelope rejections (likely data corruption)
            —{" "}
            {disputeSla.group.plausibility === 1
              ? "1 day"
              : `${disputeSla.group.plausibility} days`}
            , since these are usually pipeline bugs rather than data
            questions.
          </li>
        </ul>
      </section>

      <section className="editorial-section" id="replication">
        <h2>Replication</h2>
        <p>
          The resolver is a pure function. Given a fixed snapshot of
          the inputs, it produces the same output every time. A third
          party should be able to reproduce any vintage&rsquo;s
          values from public artefacts.
        </p>
        <p>The deterministic inputs are:</p>
        <ul>
          <li>
            The git-tagged schema (DDL for the country-facts and
            related tables).
          </li>
          <li>
            The source allowlist file at the same git tag —{" "}
            <code>src/lib/factbook/reconcile/source-allowlist.ts</code>.
            The allowlist is immutable per methodology version; the
            git history is its change log.
          </li>
          <li>
            The sync scripts that populate the source rows — for the
            CIA file, for Wikidata via the SPARQL query interface,
            for each multilateral agency adapter, and for each NSO
            adapter.
          </li>
          <li>
            The resolver itself, at the same git tag —{" "}
            <code>src/lib/factbook/reconcile/resolver.ts</code>.
          </li>
          <li>
            The vintage snapshot script and cron route that write the
            quarterly vintage rows.
          </li>
          <li>
            The upstream payload archive — every Wikidata, World
            Bank, IMF, NSO, and other adapter response is hashed and
            stored alongside the country-facts rows. Snapshot
            artefacts make a vintage replayable even if upstream
            values later change.
          </li>
        </ul>
        <p>
          Crucially, the resolver does not call a language model.
          Fact reconciliation is rule-based — that is the entire
          point of the design. A language model can summarise a
          dispute for an operator, and a deterministic LLM call is
          used at sync time for the Stats SA PDF-extraction case
          (Worked Example 5 above), but the canonical resolver output
          is deterministic boolean and numeric logic only.
        </p>
        <p>
          A full replication recipe — including SQL snapshots and a
          worked walk-through that re-derives a vintage&rsquo;s
          values from the artefacts — is on the v1.1 roadmap as a
          future page at{" "}
          <code>/factbook/methodology/reconciliation/replication</code>{" "}
          (not yet shipped). For the present, the inputs above are
          load-bearing in their git-tagged form, and an external
          reviewer with access to the repository can replay the{" "}
          {reconciliation.version} vintage {reconciliation.firstVintage}{" "}
          cut by running the sync scripts against the archived payloads
          and the snapshot script against the resulting rows.
        </p>
      </section>

      <section className="editorial-section" id="version-policy">
        <h2>Version policy and the perpetual-beta posture</h2>
        <p>
          Civica is operating as a research lab. Methodology decisions
          are first-class citable artefacts; each load-bearing call
          (peer grouping, the forecast-vs-measurement partition, the
          trade-aggregate two-fact-key split, the canonical-pick
          threshold raise, the vintage cadence framework) is
          documented as a resolution document and reviewed before
          implementation. The corpus contains roughly 25 such
          documents and grows as new sources land.
        </p>
        <p>
          The methodology version stamp stays in beta indefinitely.
          Version bumps (<code>{reconciliation.version}</code> →
          successor revisions) signal a methodology refinement; they
          do not signal a graduation event. Civica&rsquo;s posture is
          that the reconciliation rules will continue to refine as new
          publishers ship, new fact-keys are added, and external
          reviewers contribute feedback. There is no calendar gate at
          which the methodology stops being beta.
        </p>
        <p>
          What this does <em>not</em> mean: vintaged data is not
          unstable. The vintage label embeds the methodology version,
          so a reader citing{" "}
          <code>
            Civica Atlas Reconciled {reconciliation.version} — vintage{" "}
            {reconciliation.firstVintage}
          </code>{" "}
          gets a value that does not move and is unambiguously tied
          to the {reconciliation.version} rules. When methodology
          revises to a successor version, the new vintage label
          carries that version; the {reconciliation.version} vintages
          remain as stable historical citations.
        </p>
        <p>
          External review is an explicit project goal, not a
          hypothetical. The {""}
          <Link href="/contact">contact form</Link> is the route in
          for reviewers — data-quality specialists, statistical
          agency staff, computational journalists, comparative
          politics scholars. The methodology version will bump when
          reviewer feedback is incorporated; the audit trail in the
          resolution document corpus tracks the reasoning.
        </p>
        <p>
          The methodology resolution corpus is currently held as
          working documents, available to academic reviewers on
          request. Public publication of a curated subset is on the
          v1.x roadmap. The {""}
          <Link href="/methodology">methodology hub</Link> indexes
          the published methodology pages and summarises the
          unpublished corpus.
        </p>
      </section>

      <section className="editorial-section" id="citing">
        <h2>Citing this methodology</h2>
        <p>
          Three citation forms cover the common cases. Every form
          embeds the methodology version stamp, so a reader citing
          any vintage value gets a stable reference even after future
          methodology revisions.
        </p>

        <h3>Citing the methodology page itself</h3>
        <p>
          <em>
            Civica Atlas Reconciliation Methodology{" "}
            {reconciliation.version}. Civica Atlas, 2026.{" "}
            <Link href="https://civicaatlas.org/factbook/methodology/reconciliation">
              https://civicaatlas.org/factbook/methodology/reconciliation
            </Link>
            . Retrieved [date].
          </em>
        </p>

        <h3>Citing a single reconciled fact</h3>
        <p>
          <em>
            Civica Atlas (2026). [Country] [fact], vintage Civica
            Atlas Reconciled {reconciliation.version} — vintage{" "}
            {reconciliation.firstVintage}. Sourced from [primary
            publisher]. Methodology {reconciliation.version}.
          </em>
        </p>
        <p>
          Worked example, the Argentina inflation case (Worked
          Example 1 above):
        </p>
        <p>
          <em>
            Civica Atlas (2026). Argentina inflation rate, vintage
            Civica Atlas Reconciled {reconciliation.version} — vintage{" "}
            {reconciliation.firstVintage}. Sourced from World Bank
            World Development Indicators 2026Q3 (2024 reading:
            219.88%). Methodology {reconciliation.version}.
          </em>
        </p>

        <h3>Citing a frozen vintage of the entire reconciled atlas</h3>
        <p>
          <em>
            Civica Atlas Reconciled {reconciliation.version} — vintage{" "}
            {reconciliation.firstVintage}. Civica Atlas, 2026.{" "}
            <Link href="https://civicaatlas.org/factbook/methodology/reconciliation">
              https://civicaatlas.org/factbook/methodology/reconciliation
            </Link>
            . Cut date: 5 May 2026. Methodology version{" "}
            {reconciliation.version}.
          </em>
        </p>

        <p>
          The interactive citation widget below generates APA,
          BibTeX, and Chicago citations for this page in one click,
          and offers a JSON download of the underlying reconciled
          data for replication.
        </p>

        <CiteAccordion
          subject={`Civica Atlas Reconciled ${reconciliation.version} — vintage ${reconciliation.firstVintage}`}
          pageTitle="Factbook Reconciliation Methodology"
          url="https://civicaatlas.org/factbook/methodology/reconciliation"
          sourceNames={[
            "World Bank Open Data",
            "International Monetary Fund WEO",
            "United Nations Statistics Division",
            "UNDP Human Development Reports",
            "WHO Global Health Observatory",
            "UNESCO Institute for Statistics",
            "OECD.Stat",
            "FAO FAOSTAT",
            "ILO ILOSTAT",
            "Eurostat",
            "WTO Stats",
            "US Census Bureau",
            "ONS-UK",
            "INSEE-FR",
            "Statistics Canada",
            "IBGE-BR",
            "Stats SA",
            "CIA World Factbook (frozen January 2026)",
            "Wikidata",
          ]}
        />
      </section>

      <nav
        className="editorial-footer-nav"
        aria-label="Methodology navigation"
      >
        <Link href="/methodology">Methodology hub</Link>
        <Link href="/methodology/approach">How we approach data</Link>
        <Link href="/factbook">Factbook</Link>
        <Link href="/factbook/methodology/reconciliation/disputes">
          Disputes log
        </Link>
        <Link href="/civica-index/methodology">
          Civica Index methodology
        </Link>
        <Link href="/civica-index/methodology/pulse">
          Pulse methodology
        </Link>
        <Link href="/civica-index/corrections">Corrections form</Link>
      </nav>
    </MethodologyLayout>
  );
}
