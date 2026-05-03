import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";

export const metadata: Metadata = {
  title: "Factbook reconciliation methodology (Beta) — Civica Atlas",
  description:
    "How Civica picks one canonical value per country fact across CIA Factbook, Wikidata, and named statistical agencies. Source allowlist, resolver rules, vintaging, disputes, and replication.",
  alternates: {
    canonical:
      "https://civicaatlas.org/factbook/methodology/reconciliation",
  },
};

export default function ReconciliationMethodologyPage() {
  return (
    <EditorialPage>
      <nav className="editorial-breadcrumbs">
        <Link href="/factbook">← Factbook</Link>
        <span>/</span>
        Methodology
        <span>/</span>
        Reconciliation
      </nav>

      <h1 className="editorial-page-title">
        Factbook Reconciliation
        <span className="editorial-beta-tag">Beta</span>
      </h1>
      <p className="editorial-page-subtitle">
        How Civica picks one canonical value per country fact when multiple
        sources disagree, and how readers can audit the choice. Methodology
        v0.1 — under active development.
      </p>
      <div className="editorial-meta">
        <span>Version v0.1 (Beta)</span>
        <span>Published 2026-05-02</span>
      </div>

      <div className="editorial-warning">
        <strong>This methodology is in Beta.</strong> The resolver rules,
        source allowlist, and vintage cadence may change before v1.0.
        Quarterly vintages still freeze, so a citation pinned to a specific
        vintage (for example,{" "}
        <code>Civica Atlas 2026Q3</code>) is stable; the rules that produced
        it are the part still under review. See the Beta status section
        below for graduation criteria.
      </div>

      <section className="editorial-section">
        <h2>What this is</h2>
        <p>
          Civica&apos;s factbook draws on multiple sources for the same
          underlying fact. The CIA World Factbook is comprehensive but
          stopped updating in January 2026. Wikidata is fresh but its
          claims vary in quality. Multilateral statistical agencies (the
          World Bank, IMF, UN) are authoritative but cover narrower fact
          sets. For any given country and fact — Nigeria&apos;s population,
          France&apos;s capital, Brazil&apos;s GDP — Civica may hold two,
          three, or four candidate values from different sources, each
          with its own measurement date and reference chain.
        </p>
        <p>
          The reconciliation layer is the rule-based system that picks
          one value to display, preserves the rest for transparency, and
          escalates disagreements that look like data errors or contested
          changes. The rules are deterministic: no language model, no
          confidence scores, no convergence loops. A third party with our
          inputs and the source allowlist must be able to reproduce the
          choice.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Scope</h2>
        <p>
          We classify each fact into one of three groups by an explicit
          per-fact-key decision, not at runtime. The group determines how
          the resolver weights freshness against authority.
        </p>

        <h3>Group A — Slow-changing identity facts</h3>
        <p>
          These facts barely move from year to year. Wording matters and
          readers cite them by name.
        </p>
        <ul>
          <li>
            Examples: capital, official short and long names, ISO 2/3
            codes, currency code, official languages, total area in
            square kilometres, time zones, internet TLD, calling code.
          </li>
          <li>
            <strong>Default:</strong> CIA wording wins. Wikidata can
            override only when CIA is empty and the Wikidata claim has a
            Tier 1 or Tier 2 reference. Any silent override of a
            non-empty CIA value is a bug — the dispute path is the only
            way through.
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
            GDP growth, inflation, public debt as % of GDP, unemployment,
            life expectancy, electricity generation by source, internet
            users, CO2 emissions.
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
            Examples: government type (raw CIA string), chief of state
            title, electoral system, suffrage age, legal system family,
            religion breakdown, ethnic group breakdown, climate type,
            terrain summary, natural resources, land use breakdown.
          </li>
          <li>
            <strong>Default:</strong> CIA wins, full stop. The exception
            is census-derived breakdowns (religion, ethnicity) where a
            recent national census from an allow-listed national
            statistical office crosses a defined threshold; that
            triggers a dispute, never a silent swap.
          </li>
        </ul>

        <h3>Out of scope</h3>
        <p>
          The reconciliation layer does not govern judgment claims —
          regime classification, human rights status, contested
          geopolitical labels, &ldquo;is X a democracy.&rdquo; Each of
          these has a named primary source with its own published
          ingestion path:{" "}
          <Link href="/civica-index/methodology">Civica Index</Link>{" "}
          dimension scores (V-Dem, Freedom House, World Bank WGI, UNDP
          HDI, Transparency CPI, Global Peace Index),{" "}
          <Link href="/civica-index/methodology/pulse">Civica Pulse</Link>{" "}
          events, the Bjornskov-Rode / CGV regime taxonomy, and
          constitutional text from the Constitute Project. Officeholders
          (heads of state, heads of government) and party seat counts
          are also out of scope — they have purpose-built sync paths
          that predate Phase F.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Sources</h2>
        <p>
          A Wikidata claim is accepted only if its references — via the{" "}
          <code>P248</code> &ldquo;stated in&rdquo; property or the{" "}
          <code>P854</code> reference URL — point to an entry on the
          allowlist. Allowlist entries are organised in four tiers; the
          full list lives in{" "}
          <Link href="https://github.com/civicaatlas/civica/blob/main/src/lib/factbook/reconcile/source-allowlist.ts">
            <code>src/lib/factbook/reconcile/source-allowlist.ts</code>
          </Link>
          {" "}and is the single source of truth — both the schema and the
          resolver import from it.
        </p>

        <h3>Tier 1 — Multilateral statistical agencies</h3>
        <ul>
          <li>
            <Link href="https://data.worldbank.org">World Bank Open Data</Link>
          </li>
          <li>
            <Link href="https://www.imf.org">
              International Monetary Fund
            </Link>{" "}
            (WEO, IFS)
          </li>
          <li>
            <Link href="https://unstats.un.org">
              United Nations Statistics Division
            </Link>
          </li>
          <li>
            <Link href="https://hdr.undp.org">
              UNDP Human Development Reports
            </Link>
          </li>
          <li>
            <Link href="https://www.who.int/data/gho">
              WHO Global Health Observatory
            </Link>
          </li>
          <li>
            <Link href="https://uis.unesco.org">
              UNESCO Institute for Statistics
            </Link>
          </li>
          <li>
            <Link href="https://stats.oecd.org">OECD.Stat</Link>
          </li>
          <li>
            <Link href="https://www.fao.org/faostat">FAO FAOSTAT</Link>
          </li>
          <li>
            <Link href="https://www.iea.org">IEA energy data</Link>
          </li>
          <li>
            <Link href="https://ilostat.ilo.org">ILO ILOSTAT</Link>
          </li>
          <li>
            <Link href="https://ec.europa.eu/eurostat">Eurostat</Link>
          </li>
          <li>
            <Link href="https://stats.wto.org">WTO Stats</Link>
          </li>
        </ul>

        <h3>Tier 2 — Curated national statistical offices</h3>
        <p>
          A curated set of roughly 30–40 NSO domains known to be stable,
          machine-readable, and English-friendly: US Census Bureau,
          ONS-UK, INSEE-FR, Destatis-DE, Statistics Canada, IBGE-BR,
          Stats SA, NBS-Nigeria, and others. We add NSOs to the list on
          demand — when a fact-key for a specific country has no Tier 1
          coverage and an NSO is its authoritative source. Every
          addition triggers a methodology version bump.
        </p>

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
          purposes. What we trust is the Tier 1 or Tier 2 source the
          claim points at; Wikidata is the structured query path. A
          Wikidata claim with no allow-listed reference is rejected at
          sync time and never enters the canonical store.
        </p>

        <h3>Explicitly rejected references</h3>
        <p>
          Wikidata claims whose only references are imported-from-Wikipedia
          (<code>P143</code>), Wikipedia itself, generic news aggregators
          (Worldometers, Statista&apos;s free tier), personal blogs,
          social media, self-published advocacy NGO claims for facts they
          are not the primary source of, or a Wikidata mirror of CIA
          Factbook (we want the primary CIA file directly). A claim with
          multiple references is accepted if at least one reference is
          on the allowlist; a majority is not required.
        </p>
      </section>

      <section className="editorial-section">
        <h2>The resolver</h2>
        <p>
          Given a country and a fact key, the resolver returns one
          canonical value plus the full list of alternates. Rules are
          evaluated in order. If only one source row exists for a fact,
          that value is used. Otherwise the rules below apply by group.
        </p>
        <p>
          For Groups A and C, when sources agree within tolerance
          (within 2% for counts, within 0.5 percentage points for rates,
          exact match for strings after Unicode normalisation), CIA is
          preferred when present. For Group B the resolver does not
          short-circuit on agreement — even when CIA and a fresher
          source agree within tolerance, the fresher allow-listed source
          wins and CIA is preserved as an alternate. This is because
          freshness is the whole point for fast-changing facts.
        </p>
        <p>
          When sources disagree, two guards apply for Group B:
        </p>
        <ul>
          <li>
            <strong>Material-error rejection.</strong> A fresher value
            differing from the older one by more than a per-category
            &ldquo;impossible&rdquo; threshold (population &gt; 50% in a
            year, GDP nominal in USD &gt; 80%, rate facts flipping
            outside [-1%, +101%]) is rejected as likely data corruption
            or a unit-of-measure error. A dispute row is created and the
            prior canonical value remains until reviewed.
          </li>
          <li>
            <strong>Reference-quality floor.</strong> The fresher source
            must have at least one Tier 1 or Tier 2 reference. A
            Wikidata claim whose references are all rejected per the
            allowlist cannot win even if it is fresher.
          </li>
        </ul>
        <p>
          The five worked examples below are normative — they are the
          fixtures the resolver tests use.
        </p>

        <div className="editorial-card">
          <div className="editorial-card-headline">
            Nigeria population — Group B, fresher source wins
          </div>
          <div className="editorial-card-desc">
            <strong>Situation.</strong> CIA reports 230,842,743 (2023
            estimate). Wikidata reports 226,683,440 (2024) citing the
            World Bank. The World Bank itself reports the same 2024
            value directly.
          </div>
          <div className="editorial-card-desc">
            <strong>Resolver.</strong> Fast-changing fact, sources
            disagree by under 2%. Both guards pass: 2% disagreement is
            inside the material-error threshold; 2024 is newer than
            2023; the World Bank reference is Tier 1. World Bank wins.
            CIA stays in the country-facts store and renders in the
            alternate-values panel.
          </div>
          <div className="editorial-card-desc">
            <strong>Why.</strong> For Group B, freshness is the
            tie-breaker. The reader sees the most current measurement
            and the older CIA estimate one click away.
          </div>
        </div>

        <div className="editorial-card">
          <div className="editorial-card-headline">
            Nigeria capital — Group A, agreement
          </div>
          <div className="editorial-card-desc">
            <strong>Situation.</strong> CIA: &ldquo;Abuja.&rdquo;
            Wikidata: &ldquo;Abuja,&rdquo; cited to the Federal
            Government of Nigeria (Tier 2).
          </div>
          <div className="editorial-card-desc">
            <strong>Resolver.</strong> Identity fact, exact match after
            Unicode normalisation. CIA wins by Group A default. Both
            citations are surfaced in the alternate-values panel.
          </div>
          <div className="editorial-card-desc">
            <strong>Why.</strong> Identity facts default to CIA wording
            because it is public-domain and citable; Wikidata&apos;s
            stylebook varies by editor. Agreement plus a Tier 2 backing
            citation makes both rows worth showing.
          </div>
        </div>

        <div className="editorial-card">
          <div className="editorial-card-headline">
            Nigeria official languages — Group A, CIA default with rejected reference
          </div>
          <div className="editorial-card-desc">
            <strong>Situation.</strong> CIA: &ldquo;English (official).&rdquo;
            Wikidata: English with <em>preferred</em> rank, plus Hausa,
            Yoruba, Igbo with <em>normal</em> rank, all referenced to
            the Constitution of Nigeria via Wikisource. Wikisource is
            not on the allowlist.
          </div>
          <div className="editorial-card-desc">
            <strong>Resolver.</strong> CIA is non-empty so CIA wins by
            Group A default. The Wikisource reference is rejected. The
            Wikidata claim is recorded but not surfaced as canonical,
            and no dispute is opened — the CIA value already covers the
            ground.
          </div>
          <div className="editorial-card-desc">
            <strong>Why.</strong> A non-empty CIA Group A value is
            never silently overridden. The Wikidata claim&apos;s
            references would need at least one Tier 1 or Tier 2 entry
            for the override path to even open.
          </div>
        </div>

        <div className="editorial-card">
          <div className="editorial-card-headline">
            Nigeria GDP nominal — Group B, material-error catch
          </div>
          <div className="editorial-card-desc">
            <strong>Situation.</strong> CIA: $440B (2024 estimate).
            Wikidata: $4,400B (2024) — a unit-of-measure data
            corruption where billions was written as trillions
            upstream.
          </div>
          <div className="editorial-card-desc">
            <strong>Resolver.</strong> The disagreement is 10×, far
            beyond the 80% material-error threshold for GDP nominal.
            The fresher value is rejected at sync time, a dispute row
            is opened, and the prior canonical value (CIA) continues to
            render. An operator reviews, confirms data corruption, and
            marks the dispute resolved with a corrected note.
          </div>
          <div className="editorial-card-desc">
            <strong>Why.</strong> The material-error guard exists to
            catch unit-of-measure errors and copy-paste corruption
            before they reach readers. Disputes are visible publicly
            so the catch is itself audit-able.
          </div>
        </div>

        <div className="editorial-card">
          <div className="editorial-card-headline">
            Vatican religion breakdown — Group C, CIA default
          </div>
          <div className="editorial-card-desc">
            <strong>Situation.</strong> CIA: &ldquo;Roman Catholic
            100%.&rdquo; Wikidata: &ldquo;Catholic 99%, Other 1%.&rdquo;
          </div>
          <div className="editorial-card-desc">
            <strong>Resolver.</strong> Group C, so CIA wins regardless
            of disagreement size. Wikidata is recorded for transparency
            and surfaces in the alternate-values panel. No dispute — the
            1% delta is editorial colour rather than a meaningful
            disagreement, and the threshold for opening a Group C
            breakdown dispute is a 5-percentage-point line item.
          </div>
          <div className="editorial-card-desc">
            <strong>Why.</strong> Group C is the zone where Wikidata
            edits most often encode interpretation rather than fact.
            Better to be slightly stale than to silently surface a
            contested edit.
          </div>
        </div>
      </section>

      <section className="editorial-section">
        <h2>Vintaging</h2>
        <p>
          Each country-facts row carries the upstream measurement date
          (<code>as_of</code>), our retrieval date, and the upstream
          dataset version where known (e.g.{" "}
          <code>WB WDI 2026.04</code>,{" "}
          <code>CIA Factbook 2026-01-frozen</code>). On top of those
          per-row vintages, Civica freezes a quarterly{" "}
          <strong>reconciled-fact vintage</strong> — a snapshot of the
          resolver&apos;s output for every country and fact at quarter
          end. The cadence mirrors the Civica Index.
        </p>
        <p>
          Pinning a citation to a specific vintage gives the reader a
          value that will not move. If the upstream World Bank revises
          a 2024 GDP figure six months later, that revision lands in a
          new vintage; the prior snapshot is unchanged. A representative
          citation looks like this:
        </p>
        <p>
          <em>
            Civica Atlas, Nigeria population, vintage 2026Q3 →
            244,344,060 (CIA Factbook 2026-01-frozen, retrieved
            2026-05-02).
          </em>
        </p>
        <p>
          The changelog page filters vintages so quarters where nothing
          materially changed are not shown — readers do not need to
          scroll past silent vintages. Non-filtered storage is
          uniform; only the display is filtered.
        </p>
      </section>

      <section className="editorial-section">
        <h2>How to read a SourceDot</h2>
        <p>
          Every reconciled fact on the site carries a small dot to its
          right. The dot colour signals freshness:
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
            the fact has an open dispute. The fact continues to render
            its prior canonical value while the dispute is open.
          </li>
        </ul>
        <p>
          Click any SourceDot to open the alternate-values panel. The
          panel lists every source row Civica holds for that fact, with
          the canonical row highlighted, the rejected rows shown with
          the reason, the measurement date for each row, and a direct
          link to the upstream reference. The panel header carries the
          methodology version. When a dispute is open, the panel opens
          by default with a banner naming the contested rows.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Disputes</h2>
        <p>
          A dispute row is opened automatically when a numeric
          disagreement exceeds the material-error guard, when a
          Group A or Group C silent-override would have been required,
          when a claim is rejected per the plausibility envelope, or
          when a Wikidata claim flips from non-deprecated to deprecated
          rank for an existing canonical value.
        </p>
        <p>
          Readers can also file a dispute manually. The unified
          corrections form at{" "}
          <Link href="/civica-index/corrections">
            /civica-index/corrections
          </Link>{" "}
          accepts factbook fact disputes; per-fact &ldquo;report this
          fact&rdquo; links pre-fill the country and fact key for you,
          which substantially improves submission quality. Each
          submission becomes a row in the operator queue.
        </p>
        <p>
          Operators review through the same shell as Pulse review.
          They see both values, both citations, both measurement dates,
          a diff highlight, the resolver&apos;s proposed action and
          rationale, and three buttons: accept the proposal, override
          and pick a specific source, or hold for further investigation.
          Every action writes to an audit log with before-and-after JSON
          snapshots, the reviewer&apos;s identity, the action, and any
          notes.
        </p>
        <p>
          Resolution targets — these are targets, not gates; the fact
          continues to render the prior canonical value while the
          dispute is open:
        </p>
        <ul>
          <li>
            Numeric disagreements with both sources Tier 1 — 14 days.
          </li>
          <li>Group A identity overrides — 7 days.</li>
          <li>Group C breakdown overrides — 30 days.</li>
          <li>
            Plausibility-envelope rejections (likely data corruption) —
            24 hours, since these are usually pipeline bugs rather
            than data questions.
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2>Replication</h2>
        <p>
          The resolver is a pure function. Given a fixed snapshot of
          the inputs, it produces the same output every time. A third
          party should be able to reproduce any vintage&apos;s values
          from public artefacts.
        </p>
        <p>
          The deterministic inputs are:
        </p>
        <ul>
          <li>
            The git-tagged schema (DDL for the country-facts and
            related tables).
          </li>
          <li>
            The source allowlist file at the same git tag —{" "}
            <code>
              src/lib/factbook/reconcile/source-allowlist.ts
            </code>
            . The allowlist is immutable per methodology version; the
            git history is its change log.
          </li>
          <li>
            The sync scripts that populate the source rows — for the
            CIA file, for Wikidata via the SPARQL query interface, and
            for each multilateral agency adapter.
          </li>
          <li>
            The resolver itself, at the same git tag —{" "}
            <code>src/lib/factbook/reconcile/resolver.ts</code>.
          </li>
          <li>
            The vintage snapshot script that writes the quarterly
            vintage rows.
          </li>
          <li>
            The upstream payload archive — every Wikidata, World Bank,
            and IMF response is hashed and stored alongside the
            country-facts rows. Snapshot artefacts make a vintage
            replayable even if upstream values later change.
          </li>
        </ul>
        <p>
          Crucially, the resolver does not call a language model. Fact
          reconciliation is rule-based — that is the entire point of
          the design. A language model can summarise a dispute for an
          operator, but the canonical resolver output is deterministic
          boolean and numeric logic only. The full replication recipe,
          including the SQL snapshots and a worked walk-through, is
          published at{" "}
          <code>/factbook/methodology/reconciliation/replication</code>
          {" "}(scaffold landing in F.5).
        </p>
      </section>

      <section className="editorial-section">
        <h2>Beta status and roadmap</h2>
        <p>
          The reconciliation layer ships behind a Beta pill. While the
          version stays at v0.x, the source allowlist, the resolver
          tie-break order, and the material-error and plausibility
          thresholds may change. The resolver embeds the methodology
          version on every country-facts row, so any vintage&apos;s
          data is tied to the rules that produced it.
        </p>
        <p>
          v1.0 graduation requires:
        </p>
        <ul>
          <li>
            At least one external reviewer outside Civica with relevant
            expertise — data quality, statistical agencies, or
            computational journalism — and a public response to their
            feedback.
          </li>
          <li>
            At least three quarters of vintaged Beta data, so reviewers
            can audit drift between vintages.
          </li>
          <li>
            At least two documented disputes resolved end-to-end through
            the public queue.
          </li>
          <li>
            An interactive resolver demo at{" "}
            <code>/factbook/methodology/reconciliation/explore</code>{" "}
            and a read-only public disputes log at{" "}
            <code>/factbook/methodology/reconciliation/disputes</code>,
            both targeted for the F.7 graduation milestone.
          </li>
        </ul>
        <p>
          v1.0 onward, allowlist changes are version-bumped (v1.1, v1.2,
          and so on); v2.0 indicates a methodology change so substantive
          that prior vintages are not directly comparable. Changes from
          v1.0 onward require Civica advisory-board sign-off.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Citing this methodology</h2>
        <p>
          Recommended citation:
        </p>
        <p>
          <em>
            Civica Atlas Reconciliation Methodology v0.1 (Beta),
            retrieved [date].{" "}
            <Link href="https://civicaatlas.org/factbook/methodology/reconciliation">
              https://civicaatlas.org/factbook/methodology/reconciliation
            </Link>
            .
          </em>
        </p>
        <p>
          When citing a specific reconciled fact, pin the vintage:
          &ldquo;Civica Atlas, [country] [fact], vintage [YYYYQn].&rdquo;
          The vintage is the part that does not move; the underlying
          methodology version is recorded alongside it for full
          reproducibility.
        </p>
      </section>

      <nav
        className="editorial-footer-nav"
        aria-label="Methodology navigation"
      >
        <Link href="/factbook">← Factbook</Link>
        <Link href="/civica-index/methodology">
          Civica Index methodology
        </Link>
        <Link href="/civica-index/methodology/pulse">
          Pulse methodology
        </Link>
        <Link href="/factbook/methodology/reconciliation/changelog">
          Changelog
        </Link>
        <Link href="/civica-index/corrections">Corrections form</Link>
      </nav>
    </EditorialPage>
  );
}
