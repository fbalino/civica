"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { Chip } from "@/components/editorial/Pill";
import { Tooltip } from "@/components/editorial/Tooltip";
import { Banner } from "@/components/editorial/Banner";
import { SourceDot } from "@/components/SourceDot";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import type { SystemKey, SystemCountry } from "@/lib/elections/electoral-systems";

/* Abstract Party A/B/C illustration hues — reuse the government-type palette
   tokens so bars stay theme-safe (no hardcoded party colors, per DESIGN.md). */
const PARTY = {
  A: "var(--gov-parl)", // azure
  B: "var(--gov-semi)", // violet
  C: "var(--color-accent)", // terracotta
} as const;

interface SystemCopy {
  key: SystemKey;
  name: string;
  tab: string;
  aka: string[];
  howItWorks: string;
  keyCharacteristic: string;
  advantages: string[];
  disadvantages: string[];
  countLabel: string;
}

/* Explainer copy grounded in ACE Electoral Knowledge Network, International
   IDEA's *Electoral System Design* handbook, and Duverger. Reviewed in English. */
const SYSTEMS: SystemCopy[] = [
  {
    key: "fptp",
    name: "First Past the Post",
    tab: "First Past the Post",
    aka: ["Single-member plurality", "Winner-take-all"],
    howItWorks:
      "The country is divided into single-member districts. Each voter marks one candidate, and the candidate with the most votes in a district wins the seat — a simple plurality, with no requirement to reach an outright majority.",
    keyCharacteristic:
      "Plurality systems are often associated with concentrated party competition, but the pattern varies with district design and political context. Votes cast for losing candidates translate into no seats, so a party's share of seats can diverge sharply from its share of votes.",
    advantages: [
      "Simple to cast and to count",
      "One identifiable local representative per district",
      "Can make single-party governing majorities more likely",
    ],
    disadvantages: [
      "Large numbers of votes elect no one",
      "Seat totals can distort the national vote",
      "District lines are open to manipulation",
      "Smaller and dispersed parties are under-represented",
    ],
    countLabel: "countries",
  },
  {
    key: "pr",
    name: "Proportional Representation",
    tab: "Proportional",
    aka: ["Party-list PR", "D'Hondt", "Sainte-Laguë"],
    howItWorks:
      "Voters choose a party list (open or closed) in multi-member districts. Seats are allocated to each party in proportion to its share of the vote, using a divisor or quota formula. A legal threshold — commonly 3–5% — filters out the smallest parties.",
    keyCharacteristic:
      "List PR is widely used and is often associated with multi-party legislatures and coalition government. Its effects vary with thresholds, district magnitude, party organization, and other institutional rules.",
    advantages: [
      "Seat share closely tracks vote share",
      "Few votes are wasted",
      "Broader range of parties and views represented",
    ],
    disadvantages: [
      "Coalition-building can slow government formation",
      "Weaker link between a voter and one local member",
      "Small pivotal parties can gain outsized leverage",
    ],
    countLabel: "countries",
  },
  {
    key: "mixed",
    name: "Mixed-Member Systems",
    tab: "Mixed-Member",
    aka: ["Two-vote systems", "MMP", "Parallel / MMM"],
    howItWorks:
      "Voters cast two votes: one for a local district candidate and one for a party list. Some seats are filled by district winners; others come from the lists. Under Mixed-Member Proportional (MMP) the list seats compensate so the overall result is proportional; under Parallel (MMM) the two tiers are counted independently, so the result is only partly proportional.",
    keyCharacteristic:
      "Mixed systems pair a local representative with a party-list tier. The compensatory MMP variant is designed to make the overall result more proportional; the parallel MMM variant keeps the tiers separate and can produce less proportional outcomes.",
    advantages: [
      "Combines local representation with list seats",
      "MMP produces broadly proportional results",
      "Voters can split their two votes",
    ],
    disadvantages: [
      "The two-tier ballot is more complex",
      "Parallel systems are only partly proportional",
      "Overhang and top-up rules can be hard to follow",
    ],
    countLabel: "countries",
  },
  {
    key: "ranked",
    name: "Ranked Choice & Preferential",
    tab: "Ranked Choice",
    aka: ["Alternative Vote (AV)", "Single Transferable Vote (STV)"],
    howItWorks:
      "Voters rank candidates in order of preference. Under the Alternative Vote, in a single-member seat, the lowest candidate is eliminated and their ballots transfer to the next preference until one candidate holds a majority. The Single Transferable Vote applies the same ranked ballot across multi-member districts to produce a proportional result.",
    keyCharacteristic:
      "Ranked ballots let voters express more than a single choice and can change tactical incentives. AV identifies a single-seat winner after preference transfers; STV applies preferential transfers in multi-member contests.",
    advantages: [
      "Winners hold majority or quota-level support",
      "Voters can rank rather than pick one",
      "Less pressure to vote tactically",
    ],
    disadvantages: [
      "Counting is more involved",
      "Ranked ballots ask more of voters",
      "STV's large districts weaken the single-member link",
    ],
    countLabel: "national legislatures",
  },
  {
    key: "trs",
    name: "Two-Round System",
    tab: "Two-Round",
    aka: ["Runoff voting", "Ballotage", "Second round"],
    howItWorks:
      "If no candidate wins an outright majority in the first round, a second round is held — usually between the top two candidates, or all who clear a set threshold. The runoff winner takes the seat. It is most familiar from presidential elections but is also used for legislatures.",
    keyCharacteristic:
      "Every eventual winner can claim majority support in the decisive round. The gap between rounds gives parties time to form alliances and voters a clearer final choice.",
    advantages: [
      "The winner secures a majority in the decisive round",
      "Room to build coalitions between rounds",
      "Voters get a clear final choice",
    ],
    disadvantages: [
      "Running two rounds costs more and takes longer",
      "Turnout often falls in the second round",
      "First-round eliminations can still distort choice",
    ],
    countLabel: "countries",
  },
  {
    key: "other",
    name: "Other Systems",
    tab: "Other",
    aka: ["SNTV", "Block Vote", "Other"],
    howItWorks:
      "A smaller set of legislatures use systems that sit outside the main families. Under the Single Non-Transferable Vote, voters cast one vote in a multi-member district and the top finishers win. Under the Block Vote, voters have as many votes as there are seats. IPU Parline also records a residual “other” category for arrangements that do not fit the standard types.",
    keyCharacteristic:
      "These arrangements are the long tail of electoral design. Civica lists them under IPU Parline's own labels rather than force-fitting them into one of the five named systems, so the classification stays faithful to the source.",
    advantages: [
      "Fit specific historical or constitutional contexts",
      "SNTV can let organized minorities win seats",
    ],
    disadvantages: [
      "Results are often hard to predict",
      "Can reward intra-party vote management over policy",
    ],
    countLabel: "countries",
  },
];

const CHIP_LIMIT = 12;

/* ── Per-system seats-vs-votes illustrations (abstract, illustrative only) ── */

function BarRow({
  label,
  color,
  seatsPct,
  detail,
  faded,
}: {
  label: string;
  color: string;
  seatsPct: number;
  detail: string;
  faded?: boolean;
}) {
  return (
    <div className="elsys-bar-row">
      <div className="elsys-bar-head">
        <b style={{ color }}>{label}</b>
        <span>{detail}</span>
      </div>
      <div className="elsys-bar-track">
        <div
          className="elsys-bar-fill"
          style={{
            width: `${seatsPct}%`,
            background: color,
            opacity: faded ? 0.4 : 1,
          }}
        />
      </div>
    </div>
  );
}

function FptpVisual() {
  // 10 single-member districts; A wins 6, B wins 3, C wins 1.
  const districts: Array<keyof typeof PARTY> = [
    "A", "B", "A", "A", "B", "A", "A", "A", "B", "C",
  ];
  return (
    <>
      <p className="elsys-viz-caption">10 districts, 3 parties</p>
      <div className="elsys-districts">
        {districts.map((d, i) => (
          <div
            key={i}
            className="elsys-district"
            style={{ background: PARTY[d] }}
            aria-hidden="true"
          >
            {d}
          </div>
        ))}
      </div>
      <p className="elsys-viz-caption">Seats won vs. share of the vote</p>
      <div className="elsys-bars">
        <BarRow label="Party A" color={PARTY.A} seatsPct={60} detail="6 seats · 42% of votes" />
        <BarRow label="Party B" color={PARTY.B} seatsPct={30} detail="3 seats · 35% of votes" />
        <BarRow label="Party C" color={PARTY.C} seatsPct={10} detail="1 seat · 23% of votes" />
      </div>
      <p className="elsys-note">
        Party C draws 23% of the vote but wins one seat in ten. The same votes,
        counted proportionally, would return closer to 23 seats in a 100-seat
        chamber. Figures are illustrative.
      </p>
    </>
  );
}

function PrVisual() {
  return (
    <>
      <p className="elsys-viz-caption">Seats track the vote (100-seat chamber)</p>
      <div className="elsys-bars">
        <BarRow label="Party A" color={PARTY.A} seatsPct={42} detail="42 seats · 42% of votes" />
        <BarRow label="Party B" color={PARTY.B} seatsPct={35} detail="35 seats · 35% of votes" />
        <BarRow label="Party C" color={PARTY.C} seatsPct={23} detail="23 seats · 23% of votes" />
      </div>
      <p className="elsys-note">
        Each party&rsquo;s seat share mirrors its vote share. The 13-seat gap Party C
        faced under plurality rules closes. Figures are illustrative.
      </p>
    </>
  );
}

function MixedVisual() {
  return (
    <>
      <p className="elsys-viz-caption">Two-vote structure</p>
      <div className="elsys-split">
        <div className="elsys-panel elsys-panel--accent">
          <p className="elsys-label" style={{ marginBottom: "var(--space-2)" }}>
            Vote 1 · District
          </p>
          <div className="elsys-panel-big">Plurality</div>
          <p className="elsys-panel-sub">a local candidate wins the seat</p>
        </div>
        <div className="elsys-panel elsys-panel--accent">
          <p className="elsys-label" style={{ marginBottom: "var(--space-2)" }}>
            Vote 2 · Party list
          </p>
          <div className="elsys-panel-big">List</div>
          <p className="elsys-panel-sub">list seats fill out the chamber</p>
        </div>
      </div>
      <p className="elsys-note">
        Under <b>MMP</b>, the list tier compensates so the whole chamber is
        proportional. Under <b>Parallel (MMM)</b>, the two tiers are counted
        separately, so the outcome is only partly proportional.
      </p>
    </>
  );
}

function RankedVisual() {
  return (
    <>
      <p className="elsys-viz-caption">Round 1 — no majority</p>
      <div className="elsys-bars">
        <BarRow label="Candidate A" color={PARTY.A} seatsPct={38} detail="38%" />
        <BarRow label="Candidate B" color={PARTY.B} seatsPct={35} detail="35%" />
        <BarRow label="Candidate C — eliminated" color={PARTY.C} seatsPct={27} detail="27%" faded />
      </div>
      <p className="elsys-viz-caption">Round 2 — C&rsquo;s ballots transfer</p>
      <div className="elsys-bars">
        <BarRow label="Candidate B — elected" color={PARTY.B} seatsPct={52} detail="52%" />
        <BarRow label="Candidate A" color={PARTY.A} seatsPct={48} detail="48%" />
      </div>
      <p className="elsys-note">
        Lower-ranked candidates are eliminated and their ballots move to each
        voter&rsquo;s next preference until one candidate passes 50%. Figures are
        illustrative.
      </p>
    </>
  );
}

function TrsVisual() {
  return (
    <>
      <p className="elsys-viz-caption">Two rounds</p>
      <div className="elsys-split">
        <div className="elsys-panel">
          <p className="elsys-label" style={{ marginBottom: "var(--space-2)" }}>
            Round 1
          </p>
          <p className="elsys-panel-sub">
            Candidate A: 28%
            <br />
            Candidate B: 24%
            <br />
            <span style={{ color: "var(--color-text-40)" }}>
              others share the rest — no majority
            </span>
          </p>
        </div>
        <div className="elsys-panel elsys-panel--accent">
          <p className="elsys-label" style={{ marginBottom: "var(--space-2)" }}>
            Round 2 · runoff
          </p>
          <p className="elsys-panel-sub">
            <b>Candidate A: 58%</b>
            <br />
            Candidate B: 42%
          </p>
        </div>
      </div>
      <p className="elsys-note">
        With no first-round majority, the top two meet in a runoff and the
        winner clears 50%. Figures are illustrative.
      </p>
    </>
  );
}

function OtherVisual() {
  return (
    <>
      <p className="elsys-viz-caption">A multi-member district (5 seats)</p>
      <div className="elsys-bars">
        <BarRow label="Independent / bloc" color={PARTY.C} seatsPct={40} detail="2 of 5 seats" />
        <BarRow label="Party A" color={PARTY.A} seatsPct={40} detail="2 of 5 seats" />
        <BarRow label="Party B" color={PARTY.B} seatsPct={20} detail="1 of 5 seats" />
      </div>
      <p className="elsys-note">
        Under the Single Non-Transferable Vote each voter has one vote and the
        top finishers win, which can let organized minorities take seats. Civica
        lists these systems under IPU Parline&rsquo;s own labels. Figures are
        illustrative.
      </p>
    </>
  );
}

const VISUALS: Record<SystemKey, () => React.JSX.Element> = {
  fptp: FptpVisual,
  pr: PrVisual,
  mixed: MixedVisual,
  ranked: RankedVisual,
  trs: TrsVisual,
  other: OtherVisual,
};

/* ── Card ──────────────────────────────────────────────────────────────── */

function SystemCard({
  copy,
  countries,
  sourceRetrievedAt,
}: {
  copy: SystemCopy;
  countries: SystemCountry[];
  sourceRetrievedAt: string | null;
}) {
  const [showAllCountries, setShowAllCountries] = useState(false);
  const Visual = VISUALS[copy.key];
  const shown = showAllCountries ? countries : countries.slice(0, CHIP_LIMIT);
  const countryListId = `elsys-country-list-${copy.key}`;

  return (
    <div className="elsys-card">
      <div className="elsys-card-head">
        <h2 className="elsys-card-name">{copy.name}</h2>
        <div className="elsys-card-aka">
          {copy.aka.map((a) => (
            <Chip key={a} variant="neutral">
              {a}
            </Chip>
          ))}
        </div>
      </div>

      <div className="elsys-body">
        <div className="elsys-explain">
          <div className="elsys-block">
            <p className="elsys-label">How it works</p>
            <p className="elsys-text">{copy.howItWorks}</p>
          </div>
          <div className="elsys-block">
            <p className="elsys-label">Key characteristic</p>
            <p className="elsys-text">{copy.keyCharacteristic}</p>
          </div>
          <div className="elsys-proscons">
            <div>
              <p className="elsys-label">Advantages</p>
              <ul className="elsys-list elsys-list--pro">
                {copy.advantages.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="elsys-label">Trade-offs</p>
              <ul className="elsys-list elsys-list--con">
                {copy.disadvantages.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="elsys-visual">
          <Visual />
        </div>
      </div>

      <div className="elsys-countries">
        <div className="elsys-count-block">
          <span className="elsys-count">{countries.length}</span>
          <span className="elsys-count-label">
            {copy.countLabel}
            <SourceDot source="ipu_parline" retrievedAt={sourceRetrievedAt} />
          </span>
        </div>
        <div className="elsys-chips" id={countryListId}>
          {shown.length === 0 ? (
            <span className="elsys-chip-more">
              No countries in IPU Parline&rsquo;s current classification.
            </span>
          ) : (
            <>
              {shown.map((c) => (
                <Tooltip
                  key={c.slug}
                  content={
                    c.subtypeLabel && c.subtypeLabel !== copy.name
                      ? `${c.name} — ${c.subtypeLabel} (IPU Parline)`
                      : `${c.name} (IPU Parline)`
                  }
                >
                  <Link href={`/country/${c.slug}`} className="elsys-chip">
                    <CountryFlag iso2={c.iso2} size={16} decorative />
                    {c.name}
                  </Link>
                </Tooltip>
              ))}
              {countries.length > CHIP_LIMIT && (
                <button
                  type="button"
                  className="btn btn--text btn--sm"
                  aria-expanded={showAllCountries}
                  aria-controls={countryListId}
                  onClick={() => setShowAllCountries((value) => !value)}
                >
                  {showAllCountries
                    ? "Show fewer classifications"
                    : `Show all ${countries.length} classifications`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Client shell ──────────────────────────────────────────────────────── */

export default function ElectoralSystemsClient({
  buckets,
  sourceRetrievedAt,
  dataAvailable,
  dataError,
}: {
  buckets: Record<SystemKey, SystemCountry[]>;
  sourceRetrievedAt: string | null;
  dataAvailable: boolean;
  dataError: string | null;
}) {
  const [active, setActive] = useState<SystemKey>("fptp");
  const activeCopy = SYSTEMS.find((s) => s.key === active)!;
  const instanceId = useId().replaceAll(":", "");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = SYSTEMS.findIndex((system) => system.key === active);
  const panelId = `elsys-panel-${instanceId}`;

  function selectTab(index: number) {
    const next = (index + SYSTEMS.length) % SYSTEMS.length;
    setActive(SYSTEMS[next].key);
    tabRefs.current[next]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectTab(activeIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectTab(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab(SYSTEMS.length - 1);
    }
  }

  if (!dataAvailable) {
    return (
      <div role="alert">
        <Banner variant="warn">
          <strong>Classification data unavailable.</strong>{" "}
          {dataError ??
            "The IPU-backed classification could not be loaded. Try again later."}
        </Banner>
      </div>
    );
  }

  return (
    <>
      <Reveal
        as="div"
        amount={0.4}
        className="elsys-tabs"
      >
        <div
          role="tablist"
          aria-label="Choose an electoral system"
          className="segmented"
        >
          {SYSTEMS.map((system, index) => {
            const selected = system.key === active;
            const tabId = `elsys-tab-${instanceId}-${system.key}`;
            return (
              <button
                key={system.key}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                className={`segmented__item${selected ? " segmented__item--active" : ""}`}
                onClick={() => setActive(system.key)}
                onKeyDown={handleTabKeyDown}
              >
                {system.tab}
              </button>
            );
          })}
        </div>
      </Reveal>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`elsys-tab-${instanceId}-${active}`}
        tabIndex={0}
      >
        <Stagger amount={0.1} key={active}>
          <StaggerItem>
            <SystemCard
              copy={activeCopy}
              countries={buckets[active]}
              sourceRetrievedAt={sourceRetrievedAt}
            />
          </StaggerItem>
        </Stagger>
      </div>
    </>
  );
}
