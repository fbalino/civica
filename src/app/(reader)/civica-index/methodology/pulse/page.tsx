import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { pulse, disputeSla } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pulse methodology (Beta) — Civica Index",
  description:
    "How the Civica Pulse Beta detects, classifies, and scores governance events between quarterly index updates. Source taxonomy, multi-run classifier, asymmetric scoring, decay model, and known limitations.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/methodology/pulse",
  },
};

const HALF_LIVES: Array<[string, number]> = [
  ["Coup d'état", 365],
  ["State collapse", 730],
  ["Constitutional override / self-coup", 365],
  ["Judicial purge", 365],
  ["Free and fair election", 90],
  ["Flawed election", 180],
  ["Journalist arrest (individual)", 60],
  ["Media shutdown", 180],
  ["Protest crackdown (discrete)", 90],
  ["Systematic crackdown (pattern)", 180],
  ["Anti-corruption conviction", 120],
  ["Peace agreement (signed)", 90],
  ["Peace agreement (implemented)", 365],
  ["Armed conflict (active)", 180],
];

const SECTIONS = [
  { id: "what-pulse-is", label: "What the Pulse is" },
  { id: "what-pulse-is-not", label: "What the Pulse is not" },
  { id: "sources", label: "Sources" },
  { id: "daily-pipeline", label: "Daily pipeline" },
  { id: "event-categories", label: "Event categories" },
  { id: "disambiguation", label: "Disambiguation" },
  { id: "cascade-model", label: "Cascade model" },
  { id: "multi-run-classifier", label: "Multi-run classifier" },
  { id: "asymmetric-scoring", label: "Asymmetric scoring" },
  { id: "press-freedom-rule", label: "Press-freedom rule" },
  { id: "decay", label: "Decay" },
  { id: "bounds", label: "Bounds" },
  { id: "coverage-limitations", label: "Coverage limitations" },
  { id: "known-limitations", label: "Known limitations" },
  { id: "corrections", label: "Corrections" },
  { id: "cite", label: "Cite this page" },
];

export default function PulseMethodologyPage() {
  const taxonomy = pulse.taxonomy;
  const dimsPer = taxonomy.categoriesPerDimension;
  const backtestCount = pulse.backtest.cases.length;
  const graduationRatio = pulse.backtest.graduationThresholdRatio;
  const graduationPct = Math.round(graduationRatio * 100);
  const graduationCount = Math.ceil(backtestCount * graduationRatio);
  // v1 → v2 evolution from versionHistory (first vs current entry).
  const v1Entry = taxonomy.versionHistory[0];
  const currentEntry =
    taxonomy.versionHistory[taxonomy.versionHistory.length - 1];

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
      <SmartBreadcrumbs />

      <h1 className="editorial-page-title">
        Pulse methodology
        {pulse.status === "beta" ? (
          <span className="editorial-beta-tag">Beta</span>
        ) : null}
      </h1>
      <p className="editorial-page-subtitle">
        A real-time governance shock monitor layered on top of the quarterly
        Civica Index. Beta — methodology under active validation.
      </p>

      <div className="editorial-warning">
        <strong>This is an experimental system.</strong> Pulse values are not
        yet peer-reviewed and should not be cited as authoritative. The
        pipeline is under active validation; backtesting against historical
        governance shocks is in progress, with at least {graduationPct}% (
        {graduationCount} of {backtestCount}) of the named test cases
        required to match expert consensus before the Pulse graduates to
        publishable status.
      </div>

      <section className="editorial-section" id="what-pulse-is">
        <h2>What the Pulse is</h2>
        <p>
          The Civica Pulse fills the gap between quarterly Civica Index
          updates. A coup in March shouldn&apos;t wait until the next V-Dem
          dataset release eighteen months later to register. A peaceful
          transfer of power shouldn&apos;t be invisible until the next
          quarterly composite. The Pulse classifies governance-relevant
          events worldwide and publishes their impact as{" "}
          <strong>per-dimension deltas</strong> — not as a single merged
          score that competes with the CI.
        </p>
        <p>
          On every country page you see five rows — one per dimension —
          each showing the cumulative decayed impact of recent events
          mapped to that dimension. Below them are the 1–2 events driving
          the largest contribution. The dimensional format prevents
          single-number misreading and makes each impact explainable.
        </p>
      </section>

      <section className="editorial-section" id="what-pulse-is-not">
        <h2>What the Pulse is not</h2>
        <ul>
          <li>
            Not a co-equal score alongside the CI. There is no single
            &ldquo;Pulse number&rdquo; that competes with the CI composite.
          </li>
          <li>
            Not a citable standard at launch. Treat values as experimental
            indicators, not ground truth.
          </li>
          <li>
            Not an attempt to outperform specialised sources. ACLED is still
            the authority on conflict events; V-Dem is still the authority
            on democratic trajectory. The Pulse aggregates and scores; it
            does not claim original empirical authority.
          </li>
          <li>
            Not fully automated. High-severity events require human review
            before they affect published scores.
          </li>
        </ul>
      </section>

      <section className="editorial-section" id="sources">
        <h2>Sources — specialist feeds first, news second</h2>
        <p>
          The first version of the Pulse relied on general news ingestion
          (GDELT + Google News). This produced the{" "}
          <strong>media asymmetry problem</strong>: closed regimes produce
          few detectable events because journalists are restricted, while
          free-press democracies produce many. The naive aggregation ended
          up rewarding censorship. Fatal if unaddressed.
        </p>
        <p>
          Pulse {pulse.status === "beta" ? "Beta" : "v1"} uses{" "}
          <strong>stacked source integration</strong>: specialised structured
          feeds are the primary signal; general news augments but does not
          dominate.
        </p>

        <h3>Primary (specialist)</h3>
        <ul>
          <li>
            <strong>ACLED</strong> — Armed Conflict Location & Event Data
            Project. Real-time structured records of conflict, protest,
            political violence, and riots.
          </li>
          <li>
            <strong>CIVICUS Monitor</strong> — civic-space alerts:
            restrictions on assembly, expression, association.
          </li>
          <li>
            <strong>RSF</strong> — Reporters Without Borders press-freedom
            alerts: journalist arrests, media shutdowns, attacks on press.
          </li>
          <li>
            <strong>V-Dem early warning</strong> — democratic backsliding
            signals.
          </li>
          <li>
            <strong>HRW + Amnesty International</strong> — human rights
            violations, mass detentions.
          </li>
          <li>
            <strong>IPU Parline</strong> — legislative actions,
            constitutional events, cabinet changes.
          </li>
        </ul>

        <h3>Secondary (news, corroboration only)</h3>
        <ul>
          <li>
            <strong>GDELT</strong> — global structured event records from
            news.
          </li>
          <li>
            <strong>Reuters and AP wire</strong> — authoritative breaking
            news.
          </li>
          <li>
            <strong>Google News</strong> — broad aggregation.
          </li>
        </ul>
        <p>
          An event detected only in news without specialist corroboration
          is held at lower confidence. In countries where the press freedom
          score is low, news-only signals do not trigger classification on
          their own — see the press-freedom rule below.
        </p>
      </section>

      <section className="editorial-section" id="daily-pipeline">
        <h2>Daily pipeline</h2>
        <ol>
          <li>
            <strong>Ingest.</strong> Pull the trailing 24 hours of records
            from every primary and secondary feed. Resolve country names to
            jurisdiction ids. Write to a staging table.
          </li>
          <li>
            <strong>Cluster.</strong> Embed each record with a sentence
            transformer (all-MiniLM-L6-v2, 384-dim). Group records by
            country and ±48-hour window using cosine similarity ≥ 0.75.
            Each cluster represents one real-world event regardless of how
            many sources covered it.
          </li>
          <li>
            <strong>Classify.</strong> For each cluster, run an LLM
            classifier <strong>three times</strong> at temperatures 0.0,
            0.4, and 0.8. Compare the resulting (category, severity tier)
            tuples for agreement.
          </li>
          <li>
            <strong>Corroborate.</strong> Count distinct specialist
            sources, distinct news sources, and source diversity. Apply the
            asymmetric and press-freedom rules below to compute a
            corroboration confidence in [0, 1].
          </li>
          <li>
            <strong>Human review.</strong> Severe and catastrophic
            severity events, plus events where the classifier
            didn&apos;t reach consensus, route to a review queue and do
            not affect published scores until reviewed.
          </li>
          <li>
            <strong>Score.</strong> Multiply each event&apos;s severity by
            its corroboration confidence and decay it by event-type-specific
            half-life. Sum per (country, dimension), clamp to [−15, +10],
            and write to the dimensional-deltas table.
          </li>
        </ol>
      </section>

      <section className="editorial-section" id="event-categories">
        <h2>Event categories — the {taxonomy.version} taxonomy</h2>
        <p>
          The Pulse classifies every event into exactly one category
          drawn from a fixed taxonomy. {taxonomy.version} ships{" "}
          <strong>{taxonomy.categoryCount} categories</strong> across the
          five dimensions, derived from a top-down completeness review
          against five established political-science frameworks (V-Dem,
          ACLED, the Comparative Constitutions Project, the Polity
          Project, and Freedom House). Full derivation lives in{" "}
          <Link href="https://github.com/civicaatlas/civica/blob/main/docs/taxonomy-v2-gap-analysis.md">
            the gap-analysis document
          </Link>
          .
        </p>

        <h3>Democratic Quality ({dimsPer.democratic_quality} categories)</h3>
        <ul>
          <li>
            <code>fair_election</code> — free and fair election (V-Dem
            Electoral Democracy Index, FH A-1).
          </li>
          <li>
            <code>flawed_election</code> — irregularity-laden election
            (V-Dem v2elirreg).
          </li>
          <li>
            <code>disputed_election</code> — close, contested,
            challenged-in-court election (V-Dem v2elirreg, FH A-2).
          </li>
          <li>
            <code>election_cancellation</code> — postponement or
            cancellation of a scheduled election.
          </li>
          <li>
            <code>gerrymandering</code> — pre-election boundary
            manipulation (V-Dem v2elaccept, FH A-3).
          </li>
          <li>
            <code>candidate_disqualification</code> — opposition
            candidate barred from competing (V-Dem v2psbars, FH B-1).
          </li>
          <li>
            <code>electoral_access_change</code> — voter ID,
            registration, polling-station rules (bidirectional —
            V-Dem v2xeg_eqaccess, FH A).
          </li>
          <li>
            <code>mass_disenfranchisement</code> — annulment of
            electoral mandate or large-scale disqualification of
            voters.
          </li>
          <li>
            <code>peaceful_transfer</code> — successful transfer of
            power between governments through normal democratic
            channels.
          </li>
          <li>
            <code>negotiated_transition</code> — pacted democratic
            transition out of authoritarianism (Polity transition
            codings; Spain 1976, South Africa 1990-94).
          </li>
          <li>
            <code>term_extension</code> — constitutional term
            extension or self-coup that prolongs a leader&apos;s
            mandate.
          </li>
          <li>
            <code>constitutional_override_electoral</code> —
            constitutional override of a specific electoral mandate.
          </li>
        </ul>

        <h3>Rule of Law ({dimsPer.rule_of_law} categories)</h3>
        <ul>
          <li>
            <code>judicial_purge</code> — mass dismissal or
            replacement of judges (V-Dem v2juhcind).
          </li>
          <li>
            <code>judicial_independence_rollback</code> —
            institutional erosion of judicial independence.
          </li>
          <li>
            <code>judicial_independence_expansion</code> —
            institutional strengthening of judicial independence.
          </li>
          <li>
            <code>prosecutorial_independence</code> — independent
            prosecutors fired or strengthened (V-Dem v2juncind, FH F-1).
          </li>
          <li>
            <code>executive_constitutional_override</code> — executive
            overriding the constitution itself.
          </li>
          <li>
            <code>executive_court_defiance</code> — executive refusing
            to comply with binding court rulings (V-Dem v2jucomp, FH F-1).
          </li>
          <li>
            <code>opposition_prosecution</code> — politically motivated
            prosecution of named opposition figures (V-Dem
            v2juhcind, politically motivated prosecutions).
          </li>
          <li>
            <code>oversight_body_dismantling</code> — auditor-general,
            ombudsman, or non-anti-corruption oversight body weakened.
          </li>
          <li>
            <code>police_accountability</code> — civilian oversight of
            police expanded or restricted (V-Dem v2clrspct, FH F-3).
          </li>
          <li>
            <code>detention_conditions</code> — pretrial detention,
            solitary, torture-allegation regime changes (V-Dem
            v2cltort, FH F-3).
          </li>
          <li>
            <code>martial_law</code> — military-jurisdiction
            declaration over civilians.
          </li>
          <li>
            <code>emergency_declaration</code> — civilian state of
            emergency without military jurisdiction (FH F).
          </li>
          <li>
            <code>anticorruption_conviction</code> — high-profile
            anti-corruption conviction in independent court (also
            scored on Corruption Control).
          </li>
        </ul>

        <h3>Rights &amp; Freedoms ({dimsPer.freedom_rights} categories)</h3>
        <ul>
          <li>
            <code>journalist_arrest</code>, <code>media_shutdown</code>{" "}
            — press-freedom incidents (RSF, V-Dem v2mecenefm).
          </li>
          <li>
            <code>protest_crackdown</code> — state response to a
            specific protest event with casualties.
          </li>
          <li>
            <code>assembly_rights_restriction</code> /
            <code>{" "}assembly_rights_expansion</code> — de jure
            assembly law (FH E-1).
          </li>
          <li>
            <code>internet_shutdown</code> — full internet shutdown.
          </li>
          <li>
            <code>internet_content_restriction</code> — content
            blocking, throttling, content laws (V-Dem v2smgovsm).
          </li>
          <li>
            <code>mass_detention</code> — mass political detentions
            (cross-cutting freedom_rights signal).
          </li>
          <li>
            <code>systematic_crackdown</code> — cross-cutting
            repression pattern without a single named target.
          </li>
          <li>
            <code>religious_freedom_change</code> — restrictions or
            expansions of religious practice (V-Dem v2clrelig, FH D-2).
          </li>
          <li>
            <code>minority_rights_change</code> — de jure changes
            affecting ethnic / linguistic / religious minorities
            (V-Dem v2clpolcl, FH G-4).
          </li>
          <li>
            <code>lgbt_rights_change</code> — LGBT-specific rights
            changes (V-Dem v2clrgunev).
          </li>
          <li>
            <code>academic_freedom_change</code> — university,
            scholar, curriculum freedom (V-Dem v2cafres).
          </li>
          <li>
            <code>ngo_restriction</code> — NGO-specific legal regimes
            (foreign-agent laws, etc. V-Dem v2cseeorgs).
          </li>
          <li>
            <code>surveillance_regime_change</code> — bulk
            surveillance authority expanded or restricted (V-Dem
            v2cldiscm, FH D-4).
          </li>
          <li>
            <code>movement_freedom_change</code> — travel bans, exit
            visas, internal-passport requirements (FH G-1).
          </li>
          <li>
            <code>property_rights_change</code> — expropriation,
            asset seizures, property protections (V-Dem v2clprptyw,
            FH G-2).
          </li>
          <li>
            <code>political_assassination</code> — targeted killing of
            journalists, activists, opposition figures (ACLED VAC
            attack sub-event-type).
          </li>
          <li>
            <code>press_freedom_expansion</code> — press-freedom law
            expansion (positive).
          </li>
        </ul>

        <h3>Corruption Control ({dimsPer.corruption_control} categories)</h3>
        <ul>
          <li>
            <code>corruption_conviction</code> — high-level corruption
            conviction.
          </li>
          <li>
            <code>corruption_scandal</code> — major documented
            corruption scandal.
          </li>
          <li>
            <code>anticorruption_law</code> — anti-corruption law
            enactment.
          </li>
          <li>
            <code>anticorruption_dismantling</code> —
            anti-corruption institution weakened.
          </li>
          <li>
            <code>whistleblower_protection_change</code> —
            whistleblower-protection regime changes (V-Dem v2juacgr).
          </li>
          <li>
            <code>financial_disclosure_change</code> — asset-disclosure
            and beneficial-ownership requirement changes (FH C-3).
          </li>
        </ul>

        <h3>Stability ({dimsPer.stability} categories)</h3>
        <ul>
          <li>
            <code>armed_conflict</code>, <code>state_collapse</code> —
            ACLED battles + Polity codings.
          </li>
          <li>
            <code>coup</code> — military or unconstitutional seizure
            of power.
          </li>
          <li>
            <code>foreign_occupation</code> — foreign occupation /
            imposition (Polity -66).
          </li>
          <li>
            <code>constitutional_crisis</code> — institutional
            deadlock or partial breakdown without coup or armed
            conflict (Polity interregnum -88; Sri Lanka 2022 example).
          </li>
          <li>
            <code>government_collapse</code> — coalition breakdown or
            no-confidence collapse via parliamentary mechanism.
          </li>
          <li>
            <code>secession_or_territorial_dispute</code> — independence
            referendum, declaration, or non-violent territorial
            transfer.
          </li>
          <li>
            <code>electoral_violence</code> — partisan-group violence
            below armed-conflict threshold (ACLED riots / VAC).
          </li>
          <li>
            <code>peace_agreement_signed</code> /
            <code>{" "}peace_agreement_implemented</code> — formal
            peace agreements (positive).
          </li>
          <li>
            <code>negotiated_transition_stability</code> —
            stabilising side of pacted regime transitions (positive).
          </li>
        </ul>

        <p>
          Each category in the taxonomy ships with: an inline
          theoretical citation, an allowed-severity-tier list, a decay
          half-life, and a direction (positive / negative / mixed). The
          classifier picks exactly one category per event; multiple
          related events on different dimensions form what the
          methodology calls a <em>cascade</em> — see below.
        </p>
      </section>

      <section className="editorial-section" id="disambiguation">
        <h2>Disambiguation — when an event could fit multiple categories</h2>
        <p>
          {currentEntry.version} expanded the taxonomy from{" "}
          {v1Entry.categoryCount} to {currentEntry.categoryCount}{" "}
          categories. Several of the new fine-grained categories overlap
          at the prompt level with {v1Entry.version} categories — an
          event could plausibly fit either. The classifier prompt
          enforces a single rule for these cases:
        </p>
        <p>
          <strong>The more dimension-specific category wins over the
          more generic procedural one.</strong>
        </p>
        <p>
          Concrete precedence:
        </p>
        <ul>
          <li>
            <code>emergency_declaration</code> loses to{" "}
            <code>term_extension</code>, <code>mass_disenfranchisement</code>,{" "}
            <code>election_cancellation</code>,{" "}
            <code>constitutional_override_electoral</code>,{" "}
            <code>judicial_purge</code>, and <code>martial_law</code>{" "}
            when the event has a named institutional target.
          </li>
          <li>
            <code>systematic_crackdown</code> loses to any category
            with a named institutional target (e.g.{" "}
            <code>ngo_restriction</code>,{" "}
            <code>media_shutdown</code>, <code>academic_freedom_change</code>).
          </li>
          <li>
            <code>mass_detention</code> loses to{" "}
            <code>opposition_prosecution</code> when the detained are
            named figures with formal charges.
          </li>
          <li>
            <code>coup</code> wins over{" "}
            <code>government_collapse</code> and{" "}
            <code>constitutional_crisis</code> when there is an
            unconstitutional seizure of power.
          </li>
        </ul>
        <p>
          The disambiguation rules live in{" "}
          <code>src/lib/pulse/v2/classifier-prompt.ts</code> as part
          of the system prompt sent to Claude. The same prompt drives
          both production classification and backtesting — they cannot
          drift apart.
        </p>
      </section>

      <section className="editorial-section" id="cascade-model">
        <h2>How coups are classified — the cascade model</h2>
        <p>
          Reviewers occasionally ask why a coup d&apos;état drives the
          Stability dimension rather than Democratic Quality. The
          answer is that it drives both — but indirectly, through the
          cascade.
        </p>
        <p>
          The Pulse models a coup as the <strong>stability rupture</strong>.
          The democratic damage that follows is captured through the
          cascade of post-coup events that the classifier handles
          independently:
        </p>
        <ul>
          <li>
            Parliament dissolution → <code>constitutional_override_electoral</code>
            {" "}→ Democratic Quality
          </li>
          <li>
            Annulment of prior elections → <code>mass_disenfranchisement</code>
            {" "}→ Democratic Quality
          </li>
          <li>
            &ldquo;Transition plans&rdquo; or term extensions → <code>term_extension</code>
            {" "}→ Democratic Quality
          </li>
          <li>
            Show trials of opposition figures →{" "}
            <code>judicial_independence_rollback</code> → Rule of Law
          </li>
          <li>
            Martial law / military tribunals for civilians →{" "}
            <code>martial_law</code> → Rule of Law
          </li>
          <li>
            Press shutdowns and journalist arrests →{" "}
            <code>media_shutdown</code> / <code>journalist_arrest</code> →
            Rights &amp; Freedoms
          </li>
        </ul>
        <p>
          This mirrors how political scientists model regime breakdown:
          the coup is the rupture event, the consolidation is what
          kills democratic institutions over the following weeks and
          months. Each cascade event is independently classifiable;
          their dimensional impacts accumulate naturally on the right
          rows. A reader looking at the country page sees Stability
          plummet on day one and Democratic Quality, Rule of Law, and
          Rights &amp; Freedoms degrade over the following months as
          the new regime consolidates power.
        </p>
      </section>

      <section className="editorial-section" id="multi-run-classifier">
        <SectionHeader
          eyebrow="Classification"
          title="Multi-run classifier"
          dek="Agreement across runs is the confidence signal — LLM self-reported confidence is ignored."
        />
        <p>
          LLM self-reported confidence is not calibrated. The Pulse
          ignores it. Instead, each cluster is classified three times with
          different temperature settings, and{" "}
          <strong>agreement across runs</strong> drives the confidence
          signal:
        </p>
        <ul>
          <li>
            All three runs agree on category and tier → confidence boost
            +0.2.
          </li>
          <li>Two of three agree → neutral.</li>
          <li>
            No agreement → confidence penalty −0.3 and the event routes to
            human review.
          </li>
        </ul>
        <p>
          The full per-run output (category, tier, severity, rationale) is
          stored on every event row for audit. Disputes can reference the
          exact classifier outputs that produced the published value.
        </p>
      </section>

      <section className="editorial-section" id="asymmetric-scoring">
        <h2>Asymmetric scoring — anti-gaming</h2>
        <p>
          Authoritarian regimes can manufacture positive-seeming events
          (sham elections, symbolic anti-corruption prosecutions, announced
          reforms without implementation) more easily than they can
          manufacture negative ones. Symmetric scoring invites gaming.
        </p>
        <h3>For positive events:</h3>
        <ul>
          <li>
            Require independent corroboration from at least one non-state
            source (international observer, opposition media, international
            NGO, foreign government).
          </li>
          <li>
            Distinguish announcement vs. implementation. Announcement alone
            receives 30% of the severity value; full severity unlocks only
            after evidence of implementation 30–90 days post-announcement.
          </li>
          <li>
            In low-press-freedom environments, require ≥2 non-state
            corroborating sources.
          </li>
          <li>Discount severity by 50% if the only sources are state media.</li>
        </ul>
        <h3>For negative events:</h3>
        <ul>
          <li>
            Standard corroboration: one specialist source plus one news
            source, or two independent news sources.
          </li>
          <li>No announcement vs. implementation distinction.</li>
          <li>No discount based on source type.</li>
        </ul>
      </section>

      <section className="editorial-section" id="press-freedom-rule">
        <h2>Press-freedom rule</h2>
        <p>
          A country&apos;s current RSF Press Freedom score modulates how
          much weight news-only signals carry:
        </p>
        <ul>
          <li>
            <strong>Score ≥ 70 (free press).</strong> News-only signals
            trigger classification with full confidence.
          </li>
          <li>
            <strong>Score 50–69 (partially free).</strong> News-only
            signals trigger classification with 20% reduced confidence;
            specialist corroboration preferred.
          </li>
          <li>
            <strong>Score &lt; 50 (restricted press).</strong> News-only
            signals do not trigger classification on their own. They are
            held in pending review state until a specialist source
            corroborates.
          </li>
        </ul>
        <p>
          This addresses the media asymmetry problem directly. In closed
          regimes the primary signal comes from specialist feeds (ACLED,
          CIVICUS, RSF, HRW) that actively work to document events despite
          media restrictions. In free-press environments, news coverage
          itself is a reliable signal.
        </p>
      </section>

      <section className="editorial-section" id="decay">
        <h2>Decay — different events fade at different rates</h2>
        <p>
          A coup d&apos;état has structural impact for years. A
          journalist-arrest event is incident-level and fades faster.
          Pulse Beta uses event-type-specific half-lives instead of a
          single uniform decay constant.
        </p>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Half-life (days)</th>
            </tr>
          </thead>
          <tbody>
            {HALF_LIVES.map(([category, halfLife]) => (
              <tr key={category}>
                <td>{category}</td>
                <td className="editorial-td-num">{halfLife}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Decay is exponential:{" "}
          <code>
            impact = severity × confidence × exp(−ln2 × days / half_life)
          </code>
          .
        </p>
      </section>

      <section className="editorial-section" id="bounds">
        <h2>Bounds and double-counting prevention</h2>
        <p>
          Each dimensional delta is clamped to <strong>[−15, +10]</strong>{" "}
          against the CI baseline for that dimension. Asymmetric bounds
          acknowledge that governance can deteriorate faster than it can
          improve. The cap also prevents a single catastrophic event from
          completely overriding years of structural data.
        </p>
        <p>
          When the quarterly CI absorbs an event via updated source data
          (e.g. a coup from last quarter is now reflected in V-Dem&apos;s
          new release), the corresponding Pulse delta is zeroed so the
          event isn&apos;t counted twice. The audit trail in the event row
          records when this happens.
        </p>
      </section>

      <section className="editorial-section" id="coverage-limitations">
        <h2>Coverage limitations — closed regimes</h2>
        <p>
          The Pulse depends on observable, reportable events. For
          countries with severely restricted press freedom (RSF Press
          Freedom score below 30) or where international monitoring
          organisations have limited access — North Korea, Eritrea,
          Turkmenistan, parts of contemporary Afghanistan — the Pulse
          will systematically <strong>under-detect</strong> events and
          may show artificially stable dimensional deltas.
        </p>
        <p>
          This is a known limitation of any real-time governance
          monitor that depends on documented evidence. For these
          countries, the structural{" "}
          <Link href="/civica-index">Civica Index</Link> remains the
          primary signal — it draws on expert assessments aggregated
          annually (V-Dem, Freedom House, etc.) and does not depend on
          observable real-time events.
        </p>
        <p>
          Country pages where the country&apos;s RSF score falls below
          30 surface this caveat directly on the Pulse panel.
        </p>
      </section>

      <section className="editorial-section" id="known-limitations">
        <h2>Known limitations</h2>
        <ul>
          <li>
            Coverage is uneven. Countries with rich specialist feed
            coverage (Sub-Saharan Africa via ACLED, etc.) will have richer
            Pulse signals than countries with sparse coverage. Sparse-
            coverage countries may show more stable deltas, which can
            understate real events.
          </li>
          <li>
            LLM classification is imperfect. Every classification decision
            is logged with the per-run outputs and is subject to correction
            via the disputes process below.
          </li>
          <li>
            Positive events require stronger corroboration than negative
            events. This is intentional anti-gaming. In free-press
            environments it has minimal effect; in closed regimes it means
            state-originated positive claims are discounted unless
            independently verified.
          </li>
          <li>
            Dimensional deltas are bounded. A single event cannot produce
            more than −15 or +10 points of movement on any single
            dimension. This prevents extremes from distorting comparisons
            but may understate truly catastrophic situations.
          </li>
          <li>
            The Pulse is not yet peer-reviewed and should not be cited as
            authoritative.
          </li>
        </ul>
      </section>

      <section className="editorial-section" id="corrections">
        <h2>Corrections and disputes</h2>
        <p>
          File a Pulse dispute via the{" "}
          <Link href="/civica-index/corrections">corrections form</Link>.
          Pulse-specific dispute categories include event misclassification,
          severity miscalibration, false positives, missing events, and
          duplicate events. Each dispute is logged publicly with its
          disposition and outcome. Resolution target:{" "}
          {disputeSla.initialResponseDays} days initial response,{" "}
          {disputeSla.fullDispositionDays} days full disposition.
        </p>
      </section>

      <section className="editorial-section" id="cite">
        <h2>Cite this page</h2>
        <CiteAccordion
          subject="Civica Atlas Methodology — Pulse methodology (Beta)"
          pageTitle="Pulse methodology"
          url="https://civicaatlas.org/civica-index/methodology/pulse"
        />
      </section>

      <nav className="editorial-footer-nav" aria-label="Methodology navigation">
        <Link href="/civica-index/methodology">← Civica Index methodology</Link>
        <Link href="/civica-index/methodology/pulse/backtest">Backtest report →</Link>
        <Link href="/civica-index/pulse-changelog">Pulse changelog</Link>
        <Link href="/civica-index/corrections">Corrections form</Link>
      </nav>
      </EditorialPage>
    </MethodologyLayout>
  );
}
