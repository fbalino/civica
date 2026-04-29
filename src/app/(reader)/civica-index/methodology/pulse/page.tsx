import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Banner } from "@/components/editorial/Banner";

export const metadata: Metadata = {
  title: "Pulse methodology (Beta) — Civica Index",
  description:
    "How the Civica Pulse Beta detects, classifies, and scores governance events between quarterly index updates. Source taxonomy, multi-run classifier, asymmetric scoring, decay model, and known limitations.",
  alternates: {
    canonical:
      "https://civicaatlas.org/civica-index/methodology/pulse",
  },
};

export default function PulseMethodologyPage() {
  return (
    <EditorialPage
      breadcrumbs={
        <>
          <Link href="/civica-index">← Civica Index</Link>
          <span style={{ margin: "0 8px", color: "var(--color-text-40)" }}>
            /
          </span>
          <Link href="/civica-index/methodology">Methodology</Link>
          <span style={{ margin: "0 8px", color: "var(--color-text-40)" }}>
            /
          </span>
          Pulse methodology
        </>
      }
      title={
        <>
          Pulse methodology{" "}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-status-warning)",
              fontWeight: "var(--font-weight-mono)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              verticalAlign: "middle",
              padding: "2px 8px",
              border: "1px solid var(--color-status-warning)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            Beta
          </span>
        </>
      }
      meta={
        <>
          A real-time governance shock monitor layered on top of the quarterly
          Civica Index. Beta — methodology under active validation.
        </>
      }
    >
      <Banner variant="warn">
        <div style={{ padding: "14px 18px", lineHeight: 1.5 }}>
          <strong>This is an experimental system.</strong> Pulse values are
          not yet peer-reviewed and should not be cited as authoritative.
          The pipeline is under active validation; backtesting against
          historical governance shocks is in progress, with at least 80% of
          the 10 named test cases required to match expert consensus before
          the Pulse graduates to publishable status.
        </div>
      </Banner>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          What the Pulse is
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          The Civica Pulse fills the gap between quarterly Civica Index
          updates. A coup in March shouldn&apos;t wait until the next V-Dem
          dataset release eighteen months later to register. A peaceful
          transfer of power shouldn&apos;t be invisible until the next
          quarterly composite. The Pulse classifies governance-relevant
          events worldwide and publishes their impact as{" "}
          <strong>per-dimension deltas</strong> — not as a single merged
          score that competes with the CI.
        </p>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          On every country page you see five rows — one per dimension —
          each showing the cumulative decayed impact of recent events
          mapped to that dimension. Below them are the 1–2 events driving
          the largest contribution. The dimensional format prevents
          single-number misreading and makes each impact explainable.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          What the Pulse is not
        </h2>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.7,
            color: "var(--color-text-55)",
          }}
        >
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

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Sources — specialist feeds first, news second
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          The first version of the Pulse relied on general news ingestion
          (GDELT + Google News). This produced the{" "}
          <strong>media asymmetry problem</strong>: closed regimes produce
          few detectable events because journalists are restricted, while
          free-press democracies produce many. The naive aggregation ended
          up rewarding censorship. Fatal if unaddressed.
        </p>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          Pulse Beta uses <strong>stacked source integration</strong>:
          specialised structured feeds are the primary signal; general news
          augments but does not dominate.
        </p>

        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-18)",
            margin: "24px 0 8px",
            color: "var(--color-text-primary)",
          }}
        >
          Primary (specialist)
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.6,
            color: "var(--color-text-55)",
          }}
        >
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

        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-18)",
            margin: "24px 0 8px",
            color: "var(--color-text-primary)",
          }}
        >
          Secondary (news, corroboration only)
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.6,
            color: "var(--color-text-55)",
          }}
        >
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
        <p
          style={{
            marginTop: 16,
            lineHeight: 1.6,
            color: "var(--color-text-55)",
          }}
        >
          An event detected only in news without specialist corroboration
          is held at lower confidence. In countries where the press freedom
          score is low, news-only signals do not trigger classification on
          their own — see the press-freedom rule below.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Daily pipeline
        </h2>
        <ol
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.7,
            color: "var(--color-text-55)",
          }}
        >
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

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Multi-run classifier — agreement is the confidence signal
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          LLM self-reported confidence is not calibrated. The Pulse
          ignores it. Instead, each cluster is classified three times with
          different temperature settings, and{" "}
          <strong>agreement across runs</strong> drives the confidence
          signal:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.7,
            color: "var(--color-text-55)",
          }}
        >
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
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          The full per-run output (category, tier, severity, rationale) is
          stored on every event row for audit. Disputes can reference the
          exact classifier outputs that produced the published value.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Asymmetric scoring — anti-gaming
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          Authoritarian regimes can manufacture positive-seeming events
          (sham elections, symbolic anti-corruption prosecutions, announced
          reforms without implementation) more easily than they can
          manufacture negative ones. Symmetric scoring invites gaming.
        </p>
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-18)",
            margin: "16px 0 8px",
            color: "var(--color-text-primary)",
          }}
        >
          For positive events:
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.6,
            color: "var(--color-text-55)",
          }}
        >
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
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-18)",
            margin: "16px 0 8px",
            color: "var(--color-text-primary)",
          }}
        >
          For negative events:
        </h3>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.6,
            color: "var(--color-text-55)",
          }}
        >
          <li>
            Standard corroboration: one specialist source plus one news
            source, or two independent news sources.
          </li>
          <li>No announcement vs. implementation distinction.</li>
          <li>No discount based on source type.</li>
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Press-freedom rule
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          A country&apos;s current RSF Press Freedom score modulates how
          much weight news-only signals carry:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.7,
            color: "var(--color-text-55)",
          }}
        >
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
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          This addresses the media asymmetry problem directly. In closed
          regimes the primary signal comes from specialist feeds (ACLED,
          CIVICUS, RSF, HRW) that actively work to document events despite
          media restrictions. In free-press environments, news coverage
          itself is a reliable signal.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Decay — different events fade at different rates
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          A coup d&apos;état has structural impact for years. A
          journalist-arrest event is incident-level and fades faster.
          Pulse Beta uses event-type-specific half-lives instead of a
          single uniform decay constant.
        </p>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 16,
            fontSize: "var(--text-13)",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-card-border)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-11)",
                  fontWeight: "var(--font-weight-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-text-40)",
                }}
              >
                Category
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-11)",
                  fontWeight: "var(--font-weight-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-text-40)",
                }}
              >
                Half-life (days)
              </th>
            </tr>
          </thead>
          <tbody>
            {[
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
            ].map(([category, halfLife]) => (
              <tr
                key={String(category)}
                style={{
                  borderBottom: "1px solid var(--color-card-border)",
                }}
              >
                <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>
                  {category}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-55)",
                  }}
                >
                  {halfLife}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p
          style={{
            marginTop: 12,
            lineHeight: 1.6,
            color: "var(--color-text-55)",
          }}
        >
          Decay is exponential:{" "}
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              background: "var(--color-card-bg)",
              padding: "1px 6px",
              borderRadius: 3,
            }}
          >
            impact = severity × confidence × exp(−ln2 × days / half_life)
          </code>
          .
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Bounds and double-counting prevention
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          Each dimensional delta is clamped to <strong>[−15, +10]</strong>{" "}
          against the CI baseline for that dimension. Asymmetric bounds
          acknowledge that governance can deteriorate faster than it can
          improve. The cap also prevents a single catastrophic event from
          completely overriding years of structural data.
        </p>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          When the quarterly CI absorbs an event via updated source data
          (e.g. a coup from last quarter is now reflected in V-Dem&apos;s
          new release), the corresponding Pulse delta is zeroed so the
          event isn&apos;t counted twice. The audit trail in the event row
          records when this happens.
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Known limitations
        </h2>
        <ul
          style={{
            margin: 0,
            paddingLeft: 24,
            lineHeight: 1.7,
            color: "var(--color-text-55)",
          }}
        >
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

      <section style={{ marginTop: 32, marginBottom: 48 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-26)",
            margin: "0 0 12px",
            color: "var(--color-text-primary)",
          }}
        >
          Corrections and disputes
        </h2>
        <p style={{ lineHeight: 1.6, color: "var(--color-text-55)" }}>
          File a Pulse dispute via the{" "}
          <Link
            href="/civica-index/corrections"
            style={{ color: "var(--color-accent)" }}
          >
            corrections form
          </Link>
          . Pulse-specific dispute categories include event
          misclassification, severity miscalibration, false positives,
          missing events, and duplicate events. Each dispute is logged
          publicly with its disposition and outcome. Resolution target: 7
          days initial response, 30 days full disposition.
        </p>
      </section>

      <nav
        aria-label="Methodology navigation"
        style={{
          paddingTop: 24,
          borderTop: "1px solid var(--color-card-border)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-55)",
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <Link href="/civica-index/methodology" style={{ color: "var(--color-accent)" }}>
          ← Civica Index methodology
        </Link>
        <Link href="/civica-index/pulse-changelog" style={{ color: "var(--color-accent)" }}>
          Pulse changelog →
        </Link>
        <Link href="/civica-index/corrections" style={{ color: "var(--color-accent)" }}>
          Corrections form
        </Link>
      </nav>
    </EditorialPage>
  );
}
