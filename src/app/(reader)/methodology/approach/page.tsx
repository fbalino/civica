import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { getSiteStats, type SiteStats } from "@/lib/content/site-stats";
import {
  tier1Publishers,
  nsoWave1,
  pulse,
  civicaIndex,
  adoptedResolutionCount,
} from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "How we approach data — Civica Atlas",
  description:
    "A plain-English walkthrough of how Civica handles country data, why multi-source reconciliation matters, and what you'll see on reader pages as a result.",
  alternates: {
    canonical: "https://civicaatlas.org/methodology/approach",
  },
};

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "problem", label: "The problem" },
  { id: "multi-source", label: "Multi-source reconciliation" },
  { id: "disagree", label: "When sources disagree" },
  { id: "reader-pages", label: "What you see" },
  { id: "beta", label: "BETA meaning" },
  { id: "rolling-out", label: "Still rolling out" },
  { id: "dig-deeper", label: "Dig deeper" },
  { id: "contact", label: "Get in touch" },
  { id: "cite", label: "Cite this page" },
];

export default async function ApproachPage() {
  // Soft-fail: page should still render if the DB is unreachable, with
  // generic prose in place of live counts.
  let stats: SiteStats | null = null;
  try {
    stats = await getSiteStats();
  } catch {
    stats = null;
  }

  const tier1Shipped = tier1Publishers.filter((p) => p.shipped);
  const tier1ShortNames = tier1Shipped.map((p) => p.shortName);
  const nsoActive = nsoWave1.filter((n) => n.status === "in-progress");
  const nsoActiveNames = nsoActive.map((n) => n.name);


  return (
    <EditorialPage className="methodology-layout">
      <ReaderSidebar items={SIDEBAR_ITEMS} className="methodology-sidebar" />

      <article className="methodology-content">
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">How we approach data</h1>
        <p className="editorial-page-subtitle">
          A plain-English walkthrough of how Civica handles country data, why
          the approach matters, and what you&apos;ll see on reader pages as a
          result. For the academic specifications, see the{" "}
          <Link href="/methodology">methodology hub</Link>.
        </p>

        <section
          id="problem"
          className="editorial-section"
          aria-labelledby="problem-heading"
        >
          <h2 id="problem-heading">
            The problem with single-source reference works
          </h2>
          <p>
            Public country-data sites generally republish a single upstream
            source &mdash; usually the CIA World Factbook, sometimes Wikipedia
            infoboxes, occasionally the World Bank. This works until the
            source has a problem.
          </p>
          <p>
            The CIA World Factbook was sunset on 4 February 2026. Its last
            vintage is frozen at January 2026 &mdash; a useful reference, but
            it stops getting updates. Wikipedia infoboxes are crowdsourced and
            frequently stale; one country&apos;s population on Wikipedia might
            be from 2014 even though a 2024 measurement is available
            elsewhere. The World Bank publishes excellent data but only for
            the indicators in its World Development Indicators basket, and
            only on its quarterly release cycle.
          </p>
          <p>
            Worse, single-source sites tend to hide the limitation. When the
            source goes stale, the staleness propagates silently. When two
            reasonable people would draw on different sources, the choice
            gets made invisibly. When sources disagree, the disagreement gets
            buried.
          </p>
          <p>
            Civica&apos;s approach is to integrate multiple authoritative
            publishers, expose the disagreements, and document the rules.
          </p>
        </section>

        <section
          id="multi-source"
          className="editorial-section"
          aria-labelledby="multi-source-heading"
        >
          <h2 id="multi-source-heading">Multi-source reconciliation</h2>
          <p>
            Civica integrates{" "}
            {stats ? `${stats.activeSources} ` : "multiple "}
            source orchestrators &mdash; one per upstream publisher &mdash;
            into a single canonical data layer. Currently:
          </p>
          <ul>
            <li>
              <strong>Frozen archive:</strong> CIA World Factbook (final
              January 2026 vintage, public domain).
            </li>
            <li>
              <strong>Tier-1 publishers ({tier1Shipped.length}):</strong>{" "}
              {tier1ShortNames.join(", ")}.
            </li>
            <li>
              <strong>Governance-specialist sources:</strong> V-Dem (Varieties
              of Democracy).
            </li>
            <li>
              <strong>Knowledge spine:</strong> Wikidata.
            </li>
            <li>
              <strong>National statistics offices:</strong> rolling out in
              waves &mdash; {nsoActiveNames.join(", ")} in the first
              in-progress wave of {nsoActive.length}.
            </li>
          </ul>
          <p>
            Each source has a dedicated sync orchestrator that pulls fresh
            data on a documented cadence (quarterly for most Tier-1
            publishers, annually for some classification sources, daily for
            the Pulse event ingest). Each sync writes into a single canonical
            table called <code>country_facts</code>, with statement-level
            provenance: which source, which date the source measured the
            value, which license the data is shared under, which fact-key it
            corresponds to, and whether the row is a measurement or a
            forecast.
          </p>
          <p>
            For a live count of facts, fact-keys, and multi-sourced coverage,
            see the <Link href="/about#sources">about page</Link>. The dataset
            is growing as new sources land and existing sources publish new
            vintages.
          </p>
        </section>

        <section
          id="disagree"
          className="editorial-section"
          aria-labelledby="disagree-heading"
        >
          <h2 id="disagree-heading">
            What happens when sources disagree
          </h2>
          <p>
            When the World Bank says one number and the IMF says another,
            Civica does not silently pick one. The reconciliation resolver
            applies a documented rule set.
          </p>
          <p>
            <strong>Freshness as the default tiebreaker.</strong> When two
            sources publish a value for the same country and indicator, the
            source with the more recent measurement date wins canonical,
            unless overridden by an editorial assertion. This handles the
            most common case &mdash; both publishers measured the same thing,
            one did it more recently, the recent measurement is canonical.
          </p>
          <p>
            <strong>Editorial assertions for domain canonicality.</strong>{" "}
            Some publishers are canonical for some domains. The World Bank is
            canonical for most material indicators. V-Dem is canonical for
            democratic-quality measures. UNESCO is canonical for literacy and
            education. UNDP is canonical for the Human Development Index.
            These assertions are recorded as <code>civicaRole</code> metadata
            on each row. The resolver consults them when two sources have
            similar freshness.
          </p>
          <p>
            <strong>Forecasts vs measurements.</strong> The IMF World Economic
            Outlook publishes both historical measurements and projections
            out to 2030. The ILO publishes nowcasts that extend beyond the
            current year. Civica tags rows distinctly:{" "}
            <code>value_type = &apos;measured&apos;</code> for actuals and{" "}
            <code>value_type = &apos;projected&apos;</code> for forecasts.
            The resolver requires canonical = measured whenever any measured
            row exists. Forecasts only win canonical when no measurement
            exists.
          </p>
          <p>
            <strong>Multi-canonical with scope predicate.</strong> When two
            publishers are concurrently authoritative for a fact-key in a
            defined scope &mdash; for example, Eurostat is canonical for
            European Union public debt while the IMF is canonical globally
            &mdash; the system honors all three (Eurostat + IMF + OECD) with
            the scope predicate documented. Readers see all three; the
            methodology page explains the multi-canonical pattern.
          </p>
          <p>
            <strong>Disputes when sources materially disagree.</strong> When
            two sources disagree by more than a configurable threshold, the
            resolver creates a dispute record routed to a human review queue.
            This protects against typos, unit-confusion bugs (a
            &ldquo;$440B vs $4,400B&rdquo; mistake), and methodology
            mismatches (CIA&apos;s central-government debt vs IMF&apos;s
            general-government debt) without silently picking one.
          </p>
        </section>

        <section
          id="reader-pages"
          className="editorial-section"
          aria-labelledby="reader-heading"
        >
          <h2 id="reader-heading">What you see on reader pages</h2>
          <p>
            When you load a country page on Civica &mdash; the factbook, the
            civica-index detail, the atlas masthead, the compare overview
            &mdash; every value carries a small chevron next to it. That
            chevron is a <em>FactValueDot</em>. Click or hover it and you
            see:
          </p>
          <ul>
            <li>
              <strong>The canonical pick.</strong> Which source the resolver
              chose, the value, the as-of date.
            </li>
            <li>
              <strong>Every alternate source.</strong> Every other publisher
              that has a value for this country and indicator, with their
              value, date, and license.
            </li>
            <li>
              <strong>The freshness winner.</strong> Which source has the
              most recent measurement date.
            </li>
            <li>
              <strong>The editorial canonical.</strong> Which publisher
              Civica regards as the domain canonical, when that&apos;s a
              different question from freshness.
            </li>
            <li>
              <strong>Provenance dots.</strong> A green dot for live,
              regularly updated sources; an amber dot for frozen archives
              like the CIA Factbook.
            </li>
            <li>
              <strong>A dispute marker</strong> when sources materially
              disagree on the value.
            </li>
          </ul>
          <p>
            Multi-year values (inflation, public debt, GDP variants,
            unemployment, military expenditure, current-account balance,
            exports, imports) get a &ldquo;Civica canonical
            (reconciled)&rdquo; row prepended above the CIA&apos;s per-year
            prose. The CIA&apos;s historical context is preserved; the
            reconciled current canonical sits at the top.
          </p>
          <p>
            This is what we mean by &ldquo;every fact carries provenance.
            &rdquo; It&apos;s not a slogan. It&apos;s the reader-facing
            surface of a documented multi-source pipeline.
          </p>
        </section>

        <section
          id="beta"
          className="editorial-section"
          aria-labelledby="beta-heading"
        >
          <h2 id="beta-heading">What &ldquo;BETA&rdquo; means here</h2>
          <p>
            The data layer and reconciliation logic are real and load-bearing.
            The reader pages render real data, computed by the real resolver,
            against real sources.
          </p>
          <p>
            Some surfaces still carry a BETA marker. This means one of two
            things.
          </p>
          <p>
            The <strong>Civica Index</strong> composite scoring methodology
            (PCA-derived weights, {civicaIndex.dimensionCount} governance
            dimensions, frozen reference periods) is published and stable,
            but external academic review has not yet been completed. The
            page is in BETA pending review. Same for the{" "}
            <strong>Civica Pulse</strong> classification taxonomy &mdash;
            it has been backtested against {pulse.backtest.cases.length}{" "}
            historical shocks but has not been externally reviewed.{" "}
            <strong>Reconciliation rules</strong> are documented and live
            but the public-facing methodology page is being expanded as v1
            closes out.
          </p>
          <p>
            External methodologies that Civica cites &mdash; V-Dem Regimes of
            the World, World Bank country classifications, Bjørnskov-Rode
            regime taxonomy, the Cheibub-Gandhi-Vreeland classification
            &mdash; do not carry a BETA marker. They inherit the source
            institution&apos;s standing.
          </p>
          <p>
            The honest framing: where Civica is asserting a novel
            methodology, BETA stays on until external review. Where Civica is
            republishing externally-attested classifications, the
            source&apos;s standing applies.
          </p>
        </section>

        <section
          id="rolling-out"
          className="editorial-section"
          aria-labelledby="rollout-heading"
        >
          <h2 id="rollout-heading">What&apos;s still rolling out</h2>
          <p>
            Civica is in pre-launch. The reconciliation v1 milestone (full
            Tier-1 publisher integration plus the first
            national-statistics-office wave) is in active execution. The
            methodology page rewrite is the v1 capstone.
          </p>
          <p>Things you may notice as the rollout progresses:</p>
          <ul>
            <li>
              <strong>Some fact-keys are single-sourced.</strong>{" "}
              {stats
                ? `${stats.singleSourcedFactKeys} of ${stats.distinctFactKeys} `
                : "Many "}
              declared fact-keys currently have only one publisher.
              Reconciliation requires two sources to compare; for
              single-sourced facts, the reader page renders provenance but no
              alternates panel. As the NSO wave lands, single-sourced
              fact-keys gain second sources.
            </li>
            <li>
              <strong>
                Some methodology pages are still being written.
              </strong>{" "}
              Specifically, the reconciliation methodology page is being
              expanded as the rules formalize. Read the{" "}
              <Link href="/methodology">methodology hub</Link> for the
              current state.
            </li>
            <li>
              <strong>
                Some methodology resolutions are not yet public.
              </strong>{" "}
              Civica has {adoptedResolutionCount}+ adopted internal
              resolution documents covering specific decisions. Public
              publication of a curated subset is on the roadmap.
            </li>
          </ul>
        </section>

        <section
          id="dig-deeper"
          className="editorial-section"
          aria-labelledby="deeper-heading"
        >
          <h2 id="deeper-heading">Where to dig deeper</h2>
          <ul>
            <li>
              Full reconciliation specification:{" "}
              <Link href="/factbook/methodology/reconciliation">
                /factbook/methodology/reconciliation
              </Link>
            </li>
            <li>
              Civica Index composite scoring:{" "}
              <Link href="/civica-index/methodology">
                /civica-index/methodology
              </Link>
            </li>
            <li>
              Civica Pulse event classification:{" "}
              <Link href="/civica-index/methodology/pulse">
                /civica-index/methodology/pulse
              </Link>
            </li>
            <li>
              Peer grouping and country comparison:{" "}
              <Link href="/civica-index/methodology/peer-grouping">
                /civica-index/methodology/peer-grouping
              </Link>
            </li>
            <li>
              Index of all methodology pages:{" "}
              <Link href="/methodology">/methodology</Link>
            </li>
            <li>
              Data sources, licenses, last-sync timestamps:{" "}
              <Link href="/about#sources">/about</Link>
            </li>
            <li>
              API documentation: <Link href="/api-docs">/api-docs</Link>
            </li>
          </ul>
        </section>

        <section
          id="contact"
          className="editorial-section"
          aria-labelledby="contact-heading"
        >
          <h2 id="contact-heading">Get in touch</h2>
          <p>
            If you spot a data error, a methodological gap, or a documentation
            inconsistency, please <Link href="/contact">contact us</Link>. We
            treat external feedback as load-bearing &mdash; the
            project&apos;s academic standing depends on it.
          </p>
        </section>

        <section
          id="cite"
          className="editorial-section"
          aria-labelledby="cite-heading"
        >
          <h2 id="cite-heading">Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — How we approach data"
            pageTitle="How we approach data"
            url="https://civicaatlas.org/methodology/approach"
          />
        </section>
      </article>
    </EditorialPage>
  );
}
