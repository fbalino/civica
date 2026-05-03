import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";

export const metadata: Metadata = {
  title: "Peer grouping in Civica — Methodology",
  description:
    "Why countries are compared the way they are. Civica's peer-grouping architecture: World Bank region × income for material indicators, V-Dem Regimes of the World for governance, BR/CGV as alternate regime lens, constitutional form as descriptive metadata. Replaces the retired structural_family heuristic per the 2026-05-02 peer-grouping resolution.",
  alternates: {
    canonical:
      "https://civicaatlas.org/civica-index/methodology/peer-grouping",
  },
};

const MONARCHY_ENUM: Array<{ key: string; description: string }> = [
  {
    key: "none",
    description: "No reigning monarch.",
  },
  {
    key: "constitutional",
    description:
      "Reigning monarch with constitutional limits and meaningful executive role (Liechtenstein, Jordan).",
  },
  {
    key: "ceremonial",
    description:
      "Reigning monarch with no executive role (United Kingdom, Sweden, Spain, Japan, Cambodia).",
  },
  {
    key: "elective",
    description:
      "Monarch chosen via political or religious process (Vatican conclave; Malaysia's rotating sultanate).",
  },
  {
    key: "absolute",
    description:
      "Reigning monarch without constitutional limits (Saudi Arabia).",
  },
  {
    key: "theocratic",
    description:
      "Religious head conflated with head of state where this is the load-bearing classification.",
  },
];

const HALF_LIFE_NOTE = ""; // unused; layout-only placeholder

const FALLBACK_TABLE: Array<{
  jurisdiction: string;
  worldBank: string;
  vdemRow: string;
  plan: string;
}> = [
  {
    jurisdiction: "Taiwan",
    worldBank: "Not listed",
    vdemRow: "Covered",
    plan: "Use V-Dem RoW for governance; for material indicators, fall back to East Asia & Pacific + High income with a documented note.",
  },
  {
    jurisdiction: "Kosovo",
    worldBank: "Listed",
    vdemRow: "Not in RoW pre-2008",
    plan: "Both lenses available; flag RoW data as starting from inclusion year.",
  },
  {
    jurisdiction: "Palestine",
    worldBank: "Listed (West Bank and Gaza)",
    vdemRow: "Not in RoW",
    plan: "World Bank for material; for governance, fall back to global with a 'no V-Dem coverage' indicator.",
  },
  {
    jurisdiction: "Western Sahara",
    worldBank: "Not listed",
    vdemRow: "Not in RoW",
    plan: "Both lenses unavailable; show only government_form_description and a 'limited peer comparison available' pill.",
  },
  {
    jurisdiction: "Vatican City",
    worldBank: "Not listed",
    vdemRow: "Not in RoW",
    plan: "Same as Western Sahara — descriptive metadata only.",
  },
];

export default function PeerGroupingMethodologyPage() {
  void HALF_LIFE_NOTE;
  return (
    <EditorialPage>
      <nav className="editorial-breadcrumbs">
        <Link href="/civica-index">← Civica Index</Link>
        <span>/</span>
        <Link href="/civica-index/methodology">Methodology</Link>
        <span>/</span>
        Peer grouping
      </nav>

      <h1 className="editorial-page-title">
        Peer grouping in Civica
      </h1>
      <p className="editorial-page-subtitle">
        Why countries are compared the way they are.
      </p>
      <div className="editorial-page-meta">
        <span>Methodology v1.0</span>
        <span>·</span>
        <span>Adopted 2026-05-02</span>
        <span>·</span>
        <span>Pending external review</span>
      </div>

      <div className="editorial-warning">
        <strong>Pending external review.</strong> This methodology page is
        published in v1.0 form before external comparative-politics
        review. Material revisions, if any, will ship as methodology
        v1.1 with a documented changelog at the bottom of this page.
        The underlying classifications (World Bank region, World Bank
        income group, V-Dem Regimes of the World, Bjørnskov-Rode / CGV)
        are externally-attested standards published by their respective
        institutions; Civica is citing them, not asserting a novel
        composite.
      </div>

      <section className="editorial-section">
        <h2>The problem</h2>
        <p>
          Every comparison needs a peer set. Saying that France
          &ldquo;ranks 12th&rdquo; is meaningless without specifying the
          ranking universe — 12th out of what? Civica&rsquo;s previous
          peer set was the in-house <code>structural_family</code>{" "}
          taxonomy, which used regular-expression matching over CIA
          World Factbook prose to bin every country into one of ten
          buckets (parliamentary democracy, presidential republic,
          semi-presidential, constitutional monarchy, absolute monarchy,
          one-party state, military rule, theocracy, directorial
          republic, and a residual <em>other</em> category).
        </p>
        <p>
          Two examples of how the classification broke down:
        </p>
        <ul>
          <li>
            <strong>Material outcomes.</strong> Defaulting peer
            grouping to government type would group Nigeria&rsquo;s
            Human Development Index against fellow{" "}
            <em>presidential democracies</em> — the United States,
            France, Brazil, Indonesia, the Philippines. That is not an
            analytically useful peer set for human development; the
            relevant peers are sub-Saharan Africa lower-middle-income
            economies.
          </li>
          <li>
            <strong>Governance outcomes.</strong> A regime
            classification grouped 64 countries from China to Belarus
            to pre-2025 Saudi Arabia into a single{" "}
            <em>civilian dictatorship</em> bucket. The bucket is
            analytically meaningless because it conflates closed
            autocracies (no meaningful electoral competition) with
            electoral autocracies (multi-party elections that are
            unfair but real).
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2>The principle: peer sets are domain-specific</h2>
        <p>
          No major reference institution defaults peer grouping to a
          single universal primitive. Our World in Data publishes
          development indicators against World Bank regional and income
          groupings; the World Bank itself groups by region (seven
          buckets), income (four tiers), and lending category; the
          International Monetary Fund and United Nations follow
          similar conventions.<sup>[1]</sup>{" "}
          <sup>[2]</sup> <sup>[3]</sup> When governance is the subject,
          comparative politics standardly uses regime classifications
          like V-Dem&rsquo;s Regimes of the World or the Polity
          Project&rsquo;s scale.<sup>[6]</sup> <sup>[8]</sup>
        </p>
        <p>
          Civica adopts the same domain-specific architecture. Material
          and governance indicators get different peer-grouping
          primitives because they answer different questions.
          Constitutional form &mdash; whether a country has a king,
          whether it&rsquo;s federal, whether it&rsquo;s a republic
          &mdash; is preserved as descriptive metadata, not as an
          analytical taxonomy.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Material outcomes — World Bank region × income</h2>
        <p>
          For Civica Conditions, the Human Development Index, GDP-based
          measures, demographics, and health outcomes, the default peer
          set is the country&rsquo;s World Bank region intersected with
          its World Bank income group. That gives seven regions × four
          income tiers = up to 28 cohorts; in practice only ~18 are
          populated.<sup>[5]</sup>
        </p>
        <p>
          Why region+income? The World Bank publishes country-and-lending
          groups precisely because policy-relevant material comparisons
          generally need both axes. A high-income East Asian economy
          (Singapore, Japan) has structurally different material
          outcomes from a low-income East Asian economy (Cambodia, Lao
          PDR), even though both share regional context. Conversely, a
          high-income economy in Sub-Saharan Africa (Seychelles) faces
          different material conditions from a high-income economy in
          North America (United States), even at matched income.
          Civica takes the World Bank&rsquo;s convention as authoritative
          here.<sup>[4]</sup> <sup>[5]</sup>
        </p>
      </section>

      <section className="editorial-section">
        <h2>Governance outcomes — V-Dem Regimes of the World</h2>
        <p>
          For Civica Index dimensions (democratic quality, rule of law,
          freedoms and rights, corruption control), Pulse signals, and
          any governance-flavored ranking, the default peer set is the
          country&rsquo;s tier on V-Dem&rsquo;s Regimes of the World
          classification &mdash; one of four buckets:{" "}
          <em>closed autocracy</em>, <em>electoral autocracy</em>,{" "}
          <em>electoral democracy</em>, or{" "}
          <em>liberal democracy</em>.<sup>[8]</sup>
        </p>
        <p>
          Why V-Dem RoW over Bjørnskov-Rode / CGV for the default? RoW
          splits autocracy along the analytically meaningful
          electoral / closed axis &mdash; eliminating the 64-country
          civilian-dictatorship blob that prompted the change &mdash; and
          is methodologically coherent with the Civica Index&rsquo;s
          existing V-Dem dependency.<sup>[8]</sup> <sup>[9]</sup>
        </p>
        <p>
          <strong>Transparency note on V-Dem dependency.</strong> The
          Civica Index already uses V-Dem indicators in two of its four
          dimensions (Democratic Quality, Rule of Law). Using V-Dem RoW
          as the governance peer set is presentational only — it
          determines which countries appear together in a ranking, not
          how their scores are computed. The CI&rsquo;s scoring formula
          is unchanged. There is no circularity, but the overlap is
          worth disclosing.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Optional alternate regime lens — Bjørnskov-Rode / CGV</h2>
        <p>
          For users who want the executive-form-of-autocracy distinction
          (military dictatorship vs civilian dictatorship vs royal
          dictatorship), Bjørnskov-Rode / CGV remains available as a
          user-toggleable alternate lens.<sup>[7]</sup> <sup>[10]</sup>{" "}
          <sup>[11]</sup> <sup>[12]</sup> CGV has six buckets:
          parliamentary democracy, presidential democracy,
          semi-presidential democracy, civilian dictatorship, military
          dictatorship, and royal dictatorship.
        </p>
        <p>
          BR/CGV is preserved for two reasons. First, it&rsquo;s the
          taxonomy used in a substantial body of comparative political
          economy research, and Civica should not silently make that
          literature harder to cite against. Second, the
          executive-form distinction is sometimes the analytically
          relevant grouping &mdash; for example, when comparing fiscal
          discipline across military vs civilian autocracies. We make
          it accessible without making it the default.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Constitutional form as metadata</h2>
        <p>
          &ldquo;Is there a king?&rdquo; &ldquo;Is the country
          federal?&rdquo; &ldquo;Is it a republic or a monarchy?&rdquo;
          These are facts about the constitutional shell of the state,
          not analytical claims about how it should be compared. Civica
          preserves them as descriptive metadata, in two forms:
        </p>
        <ul>
          <li>
            <strong>government_form_description</strong> — free-text
            description drawn from the CIA World Factbook&rsquo;s
            government type field (e.g. &ldquo;federal parliamentary
            democracy under a constitutional monarchy&rdquo;).<sup>[13]</sup>
          </li>
          <li>
            <strong>monarchy_status</strong> — small controlled
            vocabulary for filterability:
          </li>
        </ul>
        <ul>
          {MONARCHY_ENUM.map((entry) => (
            <li key={entry.key}>
              <code>{entry.key}</code> &mdash; {entry.description}
            </li>
          ))}
        </ul>
        <p>
          Neither field is used as a peer-grouping primitive. They are
          available as filters (&ldquo;show me all ceremonial
          monarchies&rdquo;) and as searchable text on country pages.
          The vocabulary above is provisional &mdash; if the canonical
          fact-layer derivation lands a different vocabulary, this
          methodology adopts theirs and notes the diff in the changelog.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Minimum-n rule and fallback chain</h2>
        <p>
          A peer band only renders when the cohort has at least{" "}
          <strong>n ≥ 8</strong> countries. Below that floor, the panel
          falls back to a broader grouping with an explanatory label,
          following these chains:
        </p>
        <p>
          <strong>Material lens (region × income):</strong>
        </p>
        <ol>
          <li>region + income (the default)</li>
          <li>region only</li>
          <li>income only</li>
          <li>global</li>
        </ol>
        <p>
          <strong>Governance lens (V-Dem RoW tier):</strong>
        </p>
        <ol>
          <li>V-Dem RoW tier (the default)</li>
          <li>global</li>
        </ol>
        <p>
          The governance fallback is flatter on purpose. RoW only has
          four tiers, so once a country is outside its tier the
          next-most-meaningful grouping is &ldquo;all democracies&rdquo;
          or &ldquo;all autocracies&rdquo; &mdash; categories that are
          honestly less interpretable than a clean global comparison.
        </p>
        <p>
          When the fallback fires, the panel displays a small note
          such as &ldquo;n=4 in region+income; using region only
          (n=21).&rdquo; Readers should always be able to see when a
          substitution has happened.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Coverage limitations — non-sovereign and ambiguous jurisdictions</h2>
        <p>
          Some jurisdictions lack World Bank or V-Dem coverage entirely.
          Civica documents the per-jurisdiction fallback explicitly
          rather than silently mapping these to the closest peer:
        </p>
        <div className="editorial-table-scroll">
          <table className="editorial-table">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th>World Bank</th>
                <th>V-Dem RoW</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {FALLBACK_TABLE.map((row) => (
                <tr key={row.jurisdiction}>
                  <td>{row.jurisdiction}</td>
                  <td>{row.worldBank}</td>
                  <td>{row.vdemRow}</td>
                  <td>{row.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          When neither lens applies, country pages display only the
          <code> government_form_description</code> and a &ldquo;limited
          peer comparison available&rdquo; pill. This explicit
          unavailability state is preferred to silent miscoding.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Reference vintage</h2>
        <p>
          Every external classification is pinned to a specific upstream
          vintage. The current pinned vintages, refreshed quarterly with
          the rest of the Civica reference data:
        </p>
        <ul>
          <li>
            <strong>World Bank region + income</strong> — World Bank
            Country and Lending Groups, refreshed annually each July.
            Civica pulls the latest at the next quarterly cut.<sup>[5]</sup>
          </li>
          <li>
            <strong>V-Dem Regimes of the World</strong> — V-Dem dataset,
            refreshed annually each spring. The pinned-vintage label
            appears on every Civica surface that displays a V-Dem-derived
            cohort.<sup>[9]</sup>
          </li>
          <li>
            <strong>Bjørnskov-Rode / CGV</strong> — distributed via the
            Quality of Government dataset, refreshed annually each
            January.<sup>[12]</sup>
          </li>
          <li>
            <strong>government_form_description</strong> — CIA World
            Factbook, frozen January 2026. The Factbook is no longer
            actively maintained beyond that date; Civica may add a
            Wikidata cross-check in a future version, but for v1.0 the
            field is effectively static.<sup>[13]</sup>
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2>How this methodology was decided</h2>
        <p>
          Civica adopted this peer-grouping architecture on
          2026-05-02 after a multi-LLM deliberation panel rejected
          two alternatives: writing a methodology paper for the
          existing <code>structural_family</code> heuristic, and
          keeping the heuristic with a disclaimer. The full audit
          trail &mdash; problem framing, three-option briefing,
          deliberation transcript, and unanimous resolution &mdash; is
          preserved in the planning archive under{" "}
          <code>peer-grouping-resolution-v1.md</code> and{" "}
          <code>peer-grouping-deliberation-transcript.md</code>.<sup>[14]</sup>{" "}
          <sup>[15]</sup>
        </p>
        <p>
          Future maintainers, external reviewers, or readers who want
          to challenge the methodology should be able to see HOW Civica
          reached the decision, not just WHAT was decided. The audit
          trail is part of the deliverable.
        </p>
      </section>

      <section className="editorial-section">
        <h2>Limitations</h2>
        <ul>
          <li>
            <strong>V-Dem cadence.</strong> V-Dem updates annually.
            Intra-year regime transitions (a coup; a successful
            democratic transition) are not reflected in the peer-set
            classification until the next V-Dem release. Civica Pulse
            captures these events at daily cadence and presents them
            separately, but the peer-set tier itself lags by months.
          </li>
          <li>
            <strong>Non-sovereign jurisdictions.</strong> Coverage gaps
            (Taiwan, Kosovo, Palestine, Western Sahara, Vatican City)
            are documented above. Civica falls back to global
            comparison or marks the lens unavailable rather than
            silently mapping to a near-peer.
          </li>
          <li>
            <strong>government_form_description currency.</strong> CIA
            Factbook is frozen January 2026. Constitutional changes
            after that date are not reflected in the description until
            an alternative source pipeline is wired up. The field is
            descriptive metadata, not analytical taxonomy, so this
            staleness is bounded in impact.
          </li>
          <li>
            <strong>Single-lens defaults.</strong> Each domain has one
            default peer lens. Power users may want to compose lenses
            (&ldquo;electoral democracies in Sub-Saharan Africa&rdquo;)
            for finer-grained comparisons. Compound peer sets are not
            in v1.0; they are an explicit deferred enhancement.
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2>Migration table</h2>
        <p>
          The full per-country mapping &mdash; old{" "}
          <code>structural_family</code> values to new peer-lens
          fields, country by country &mdash; is published as a
          separate page at{" "}
          <Link href="/civica-index/methodology/peer-grouping/migration">
            /civica-index/methodology/peer-grouping/migration
          </Link>
          . Replication-script maintainers can consume the same data
          as JSON via{" "}
          <Link href="/api/v1/peer-groupings/migration">
            /api/v1/peer-groupings/migration
          </Link>
          .
        </p>
        <p>
          The summary mapping below shows the typical replacement for
          each retired bucket. There are deliberately rows where the
          mapping is one-to-many or many-to-one &mdash; that is the
          point of the change. The legacy <code>structural_family</code>{" "}
          column and API field remain for two quarterly vintages with{" "}
          <code>Deprecation</code> + <code>Sunset</code> headers
          pointing at <code>2027-03-31</code>; the hard cut lands on
          that date.
        </p>
        <div className="editorial-table-scroll">
          <table className="editorial-table">
            <thead>
              <tr>
                <th>Old structural_family bucket</th>
                <th>Typical V-Dem RoW</th>
                <th>Typical CGV regime</th>
                <th>Typical region+income</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>parliamentary_democracy</td>
                <td>Liberal / electoral democracy</td>
                <td>parliamentary_democracy</td>
                <td>Distributed across many region × income cohorts</td>
              </tr>
              <tr>
                <td>presidential_republic</td>
                <td>Liberal / electoral democracy / electoral autocracy</td>
                <td>presidential_democracy / civilian_dictatorship</td>
                <td>Distributed</td>
              </tr>
              <tr>
                <td>semi_presidential</td>
                <td>Mixed</td>
                <td>semi_presidential_democracy</td>
                <td>Distributed</td>
              </tr>
              <tr>
                <td>constitutional_monarchy</td>
                <td>Liberal / electoral democracy</td>
                <td>parliamentary_democracy</td>
                <td>Distributed (high-income Europe + Asia + Pacific)</td>
              </tr>
              <tr>
                <td>absolute_monarchy</td>
                <td>Closed autocracy</td>
                <td>royal_dictatorship</td>
                <td>Mostly Middle East / Gulf</td>
              </tr>
              <tr>
                <td>one_party_state</td>
                <td>Closed / electoral autocracy</td>
                <td>civilian_dictatorship</td>
                <td>Distributed</td>
              </tr>
              <tr>
                <td>military_rule</td>
                <td>Closed / electoral autocracy</td>
                <td>military_dictatorship</td>
                <td>Distributed (typically lower-income)</td>
              </tr>
              <tr>
                <td>theocracy</td>
                <td>Closed autocracy</td>
                <td>civilian_dictatorship / royal_dictatorship</td>
                <td>Iran, Vatican (special-case)</td>
              </tr>
              <tr>
                <td>directorial_republic</td>
                <td>Liberal democracy</td>
                <td>parliamentary_democracy</td>
                <td>Switzerland (n=1; descriptive metadata only)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="editorial-section">
        <h2>Versioning + changelog</h2>
        <ul>
          <li>
            <strong>v1.0 (2026-05-02).</strong> Initial publication.
            Adopted via peer-grouping-resolution-v1. Pending external
            review by a comparative-politics scholar; v1.1 entries
            below if material revisions return.
          </li>
        </ul>
      </section>

      <section className="editorial-section">
        <h2>References</h2>
        <ol>
          <li>
            Our World in Data peer-grouping conventions{" "}
            <a
              href="https://ourworldindata.org/grapher-faqs"
              rel="noopener noreferrer"
            >
              (ourworldindata.org)
            </a>
            .
          </li>
          <li>
            World Bank lending categories overview{" "}
            <a
              href="https://datahelpdesk.worldbank.org/knowledgebase/articles/906519"
              rel="noopener noreferrer"
            >
              (datahelpdesk.worldbank.org)
            </a>
            .
          </li>
          <li>
            International Monetary Fund, World Economic Outlook country
            grouping{" "}
            <a
              href="https://www.imf.org/external/pubs/ft/weo/faq.htm"
              rel="noopener noreferrer"
            >
              (imf.org)
            </a>
            .
          </li>
          <li>
            Our World in Data, HDI peer-grouping convention{" "}
            <a
              href="https://ourworldindata.org/human-development-index"
              rel="noopener noreferrer"
            >
              (ourworldindata.org)
            </a>
            .
          </li>
          <li>
            World Bank, Country and Lending Groups (annual){" "}
            <a
              href="https://datahelpdesk.worldbank.org/knowledgebase/articles/906519-world-bank-country-and-lending-groups"
              rel="noopener noreferrer"
            >
              (datahelpdesk.worldbank.org)
            </a>
            .
          </li>
          <li>
            Cheibub, Gandhi, and Vreeland (2010). Democracy and
            dictatorship revisited.{" "}
            <em>Public Choice</em> 143(1–2): 67–101.{" "}
            <a
              href="https://doi.org/10.1007/s11127-009-9491-2"
              rel="noopener noreferrer"
            >
              (doi.org/10.1007/s11127-009-9491-2)
            </a>
          </li>
          <li>
            Bjørnskov, C. and Rode, M. (2020). Regime types and regime
            change: a new dataset on democracy, coups, and political
            institutions. <em>The Review of International Organizations</em>{" "}
            15: 531–551.{" "}
            <a
              href="https://doi.org/10.1007/s11558-019-09345-1"
              rel="noopener noreferrer"
            >
              (doi.org/10.1007/s11558-019-09345-1)
            </a>
          </li>
          <li>
            Lührmann, A., Tannenberg, M. and Lindberg, S. I. (2018).
            Regimes of the World (RoW): opening new avenues for the
            comparative study of political regimes.{" "}
            <em>Politics and Governance</em> 6(1): 60–77.{" "}
            <a
              href="https://doi.org/10.17645/pag.v6i1.1214"
              rel="noopener noreferrer"
            >
              (doi.org/10.17645/pag.v6i1.1214)
            </a>
          </li>
          <li>
            V-Dem Institute, Varieties of Democracy dataset documentation{" "}
            <a
              href="https://www.v-dem.net/data/the-v-dem-dataset/"
              rel="noopener noreferrer"
            >
              (v-dem.net)
            </a>
            .
          </li>
          <li>
            CGV original codebook (Cheibub, Gandhi, Vreeland 2010
            replication archive){" "}
            <a
              href="https://sites.google.com/site/joseantoniocheibub/datasets/dd"
              rel="noopener noreferrer"
            >
              (sites.google.com/site/joseantoniocheibub)
            </a>
            .
          </li>
          <li>
            Bjørnskov-Rode regime data archive{" "}
            <a
              href="https://sites.google.com/view/martinrode/data"
              rel="noopener noreferrer"
            >
              (sites.google.com/view/martinrode)
            </a>
            .
          </li>
          <li>
            Quality of Government Standard Dataset, distributing the
            BR/CGV data{" "}
            <a
              href="https://www.gu.se/en/quality-government/qog-data/data-downloads/standard-dataset"
              rel="noopener noreferrer"
            >
              (gu.se/en/quality-government)
            </a>
            .
          </li>
          <li>
            CIA World Factbook (frozen January 2026){" "}
            <a
              href="https://www.cia.gov/the-world-factbook/"
              rel="noopener noreferrer"
            >
              (cia.gov/the-world-factbook)
            </a>
            .
          </li>
          <li>
            Peer-grouping resolution v1, internal Civica planning
            archive (<code>peer-grouping-resolution-v1.md</code>).
          </li>
          <li>
            Peer-grouping deliberation transcript, internal Civica
            planning archive (
            <code>peer-grouping-deliberation-transcript.md</code>).
          </li>
        </ol>
      </section>

      <footer className="editorial-footer-nav">
        <Link href="/civica-index/methodology">
          ← Civica Index methodology
        </Link>
        <Link href="/civica-index/methodology/pulse">
          Pulse methodology →
        </Link>
      </footer>
    </EditorialPage>
  );
}
