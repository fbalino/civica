// Curated glossary of governance and Civica vocabulary.
//
// Reference content: each definition is plain, precise, and neutral, written in
// our own words. Where a term maps to an authoritative reference (an
// encyclopedia, dictionary, codebook, or institution), `source` attributes the
// work the definition is based on — definitions paraphrase, they never copy.
// Where a term maps to a Civica concept, `seeAlso` carries an optional internal
// link to the relevant methodology page. `tag` attaches a small tinted category
// label rendered as an `.editorial-chip`-style pill on the page.
//
// This is the single source of truth for the /glossary page. Terms are sorted
// and grouped by first letter at render time, so insertion order here doesn't
// matter — keep the array readable instead.

/** Tonal category of a term, mapped to a tinted tag colour on the page. */
export type GlossaryTag =
  | "regime type"
  | "CI dimension"
  | "outcome"
  | "structure"
  | "process"
  | "provenance";

export interface GlossarySeeAlso {
  /** Visible label. Append " →" in the data when the link leaves the glossary. */
  label: string;
  /** Internal href (a methodology page) or an in-page anchor like "#rule-of-law". */
  href: string;
}

/** Authoritative reference a definition is paraphrased from. */
export interface GlossarySource {
  /** Display name of the work or institution, e.g. "Encyclopædia Britannica". */
  name: string;
  /** Optional canonical URL for the entry. */
  url?: string;
}

export interface GlossaryTerm {
  /** Stable kebab-case id used for the in-page anchor. */
  id: string;
  /** Display name (serif). */
  term: string;
  /** 1–3 sentence definition, plain and precise, in our own words. */
  definition: string;
  /** Optional tinted category tag. */
  tag?: GlossaryTag;
  /** Optional "See also" cross-references. */
  seeAlso?: GlossarySeeAlso[];
  /** Optional authoritative reference the definition is based on. */
  source?: GlossarySource;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: "accountability",
    term: "Accountability",
    definition:
      "The obligation of those who hold power to answer for how they use it — to explain decisions, justify the use of public resources, and face consequences when conduct falls short. Civica follows V-Dem in treating accountability as several strands at once: vertical (to voters through elections), horizontal (checks between state institutions), and diagonal (scrutiny by media and civil society).",
    source: {
      name: "V-Dem Institute (Accountability indices)",
      url: "https://www.v-dem.net/media/publications/pb_22_final.pdf",
    },
    seeAlso: [
      { label: "Rule of Law", href: "#rule-of-law" },
      { label: "Corruption control", href: "#corruption-control" },
    ],
  },
  {
    id: "apportionment",
    term: "Apportionment",
    tag: "process",
    definition:
      "The process of distributing legislative seats among constituencies — typically in proportion to population — so that a representative assembly reflects the electorate it speaks for. Where boundaries or seat counts fall out of step with population, representation is said to be malapportioned.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/legislative-apportionment",
    },
    seeAlso: [
      { label: "Gerrymandering", href: "#gerrymandering" },
      { label: "Proportional representation", href: "#proportional-representation" },
    ],
  },
  {
    id: "authoritarianism",
    term: "Authoritarianism",
    tag: "regime type",
    definition:
      "A form of government in which political power is concentrated and not subject to meaningful, contestable elections or independent checks. In the V-Dem framework Civica uses, it spans closed and electoral autocracies — the latter holding elections that are real but neither free nor fair.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/authoritarianism",
    },
    seeAlso: [
      { label: "Democracy", href: "#democracy" },
      { label: "Regime type", href: "#regime-type" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "autocracy",
    term: "Autocracy",
    tag: "regime type",
    definition:
      "A regime in which one person or a narrow group holds power without effective electoral or institutional constraint. The Regimes of the World classification distinguishes closed autocracies, where executives are not chosen through multiparty elections, from electoral autocracies, where elections occur but fall short of being free and fair.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/autocracy",
    },
    seeAlso: [
      { label: "Authoritarianism", href: "#authoritarianism" },
      { label: "Electoral democracy", href: "#electoral-democracy" },
    ],
  },
  {
    id: "bicameral-legislature",
    term: "Bicameral / Unicameral legislature",
    tag: "structure",
    definition:
      "A legislature is bicameral when it has two chambers — typically a lower house representing population and an upper house representing regions, states, or another constituency — and unicameral when it has a single chamber. Bicameral systems add an internal check by requiring agreement across both houses to pass most laws.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/bicameral-system",
    },
    seeAlso: [
      { label: "Separation of powers", href: "#separation-of-powers" },
      { label: "Parliamentary system", href: "#parliamentary-system" },
    ],
  },
  {
    id: "cabinet",
    term: "Cabinet",
    tag: "structure",
    definition:
      "The senior group of ministers who lead government departments and, together with the head of government, set and coordinate policy. In parliamentary systems the cabinet is drawn from the legislature and governs collectively for as long as it holds the legislature's confidence.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/cabinet-government",
    },
    seeAlso: [
      { label: "Executive", href: "#executive" },
      { label: "Parliamentary system", href: "#parliamentary-system" },
      { label: "Vote of confidence", href: "#vote-of-confidence" },
    ],
  },
  {
    id: "caretaker-government",
    term: "Caretaker Government",
    tag: "structure",
    definition:
      "A temporary government that holds office between administrations — after an election is called, a government falls, or a coalition collapses — and is expected only to keep essential functions running rather than launch major new policy. Its limited remit, by convention or by law, marks the gap until a permanent government is formed.",
    source: {
      name: "Cambridge Dictionary",
      url: "https://dictionary.cambridge.org/dictionary/english/caretaker-government",
    },
    seeAlso: [
      { label: "Coalition government", href: "#coalition-government" },
      { label: "Cabinet", href: "#cabinet" },
    ],
  },
  {
    id: "checks-and-balances",
    term: "Checks and Balances",
    definition:
      "The arrangement by which each branch of government holds powers that can restrain the others — a legislature's power of the purse, an executive's veto, a court's power of review — so that no single branch can act unchecked. It is the working mechanism that gives the separation of powers its force.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/checks-and-balances",
    },
    seeAlso: [
      { label: "Separation of powers", href: "#separation-of-powers" },
      { label: "Veto", href: "#veto" },
      { label: "Judicial review", href: "#judicial-review" },
    ],
  },
  {
    id: "civic-space",
    term: "Civic Space",
    definition:
      "The environment that lets people organise, participate, and speak freely — the degree to which law and practice protect the freedoms of association, peaceful assembly, and expression. The CIVICUS Monitor rates each country's civic space from open to closed; a narrowing space is an early signal of democratic erosion, often visible before formal institutions change.",
    source: {
      name: "CIVICUS Monitor",
      url: "https://monitor.civicus.org/about/how-it-works/what-is-civic-space/",
    },
    seeAlso: [
      { label: "Civil liberties", href: "#civil-liberties" },
      { label: "Freedom of the press", href: "#freedom-of-the-press" },
    ],
  },
  {
    id: "civil-liberties",
    term: "Civil Liberties",
    definition:
      "The protections that shield individuals from undue interference by the state — freedom of expression, assembly, association, belief, and movement, together with due-process guarantees. Freedom House scores them as one of two pillars of its Freedom in the World assessment, alongside political rights, and they feed the freedom and rights dimension of the Civica Index.",
    source: {
      name: "Freedom House (Freedom in the World)",
      url: "https://freedomhouse.org/reports/freedom-world/freedom-world-research-methodology",
    },
    seeAlso: [
      { label: "Rule of Law", href: "#rule-of-law" },
      { label: "Index methodology →", href: "/civica-index/methodology" },
    ],
  },
  {
    id: "coalition-government",
    term: "Coalition Government",
    tag: "structure",
    definition:
      "A government formed when no single party holds a legislative majority and two or more parties agree to share power, pooling their seats to command a majority and dividing cabinet posts between them. Coalitions broaden the base of a government but can be fragile, since any partner's withdrawal may bring it down.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/coalition-government",
    },
    seeAlso: [
      { label: "Parliamentary system", href: "#parliamentary-system" },
      { label: "Cabinet", href: "#cabinet" },
      { label: "Vote of confidence", href: "#vote-of-confidence" },
    ],
  },
  {
    id: "constitution",
    term: "Constitution",
    definition:
      "The supreme body of law that establishes a state's institutions, distributes authority among them, and sets the limits of governmental power. Constitutions may be codified in a single document or, as in the United Kingdom, drawn from statutes, conventions, and judicial decisions; their force depends less on their text than on whether institutions honour them.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/constitution-politics-and-law",
    },
    seeAlso: [
      { label: "Separation of powers", href: "#separation-of-powers" },
      { label: "Rule of Law", href: "#rule-of-law" },
    ],
  },
  {
    id: "corruption-control",
    term: "Corruption (control of)",
    tag: "CI dimension",
    definition:
      "The degree to which the use of public power for private gain is constrained. In the Civica Index it draws primarily on Transparency International's Corruption Perceptions Index — which scores perceived public-sector corruption from 0 (highly corrupt) to 100 (very clean) — and the World Bank's governance indicators, measured against a quarterly reference period.",
    source: {
      name: "Transparency International (Corruption Perceptions Index)",
      url: "https://www.transparency.org/en/cpi",
    },
    seeAlso: [
      { label: "Accountability", href: "#accountability" },
      { label: "Index methodology →", href: "/civica-index/methodology" },
    ],
  },
  {
    id: "democracy",
    term: "Democracy",
    tag: "regime type",
    definition:
      "A system of government in which rulers are selected through free, fair, and regularly contested elections, and in which civil liberties and the rule of law constrain the use of power. Civica distinguishes electoral democracies from liberal democracies, following the Regimes of the World classification.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/democracy",
    },
    seeAlso: [
      { label: "Electoral democracy", href: "#electoral-democracy" },
      { label: "Authoritarianism", href: "#authoritarianism" },
    ],
  },
  {
    id: "devolution",
    term: "Devolution",
    tag: "structure",
    definition:
      "The transfer of powers from a central government to subnational authorities — regions, nations, or local bodies — usually by ordinary statute rather than constitutional change. Because the centre can in principle reclaim what it has devolved, a devolved state remains unitary rather than federal.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/devolution-government-and-politics",
    },
    seeAlso: [
      { label: "Federalism", href: "#federalism" },
      { label: "Unitary state", href: "#unitary-state" },
    ],
  },
  {
    id: "direct-democracy",
    term: "Direct Democracy",
    tag: "process",
    definition:
      "A form of democracy in which citizens decide policy themselves rather than only choosing representatives — through assemblies, referendums, or citizen-initiated ballots. It contrasts with representative democracy, and most modern states blend the two, reserving direct votes for constitutional or especially weighty questions.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/direct-democracy",
    },
    seeAlso: [
      { label: "Referendum", href: "#referendum" },
      { label: "Plebiscite", href: "#plebiscite" },
      { label: "Democracy", href: "#democracy" },
    ],
  },
  {
    id: "electoral-college",
    term: "Electoral College",
    tag: "process",
    definition:
      "A body of intermediaries who formally elect a head of state on the electorate's behalf, rather than the office being filled by a direct popular vote. In the United States each state is allotted electors roughly in proportion to its congressional delegation, and a candidate must win a majority of them to become president.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/electoral-college",
    },
    seeAlso: [
      { label: "Suffrage", href: "#suffrage" },
      { label: "Plurality vs. majority", href: "#plurality-vs-majority" },
    ],
  },
  {
    id: "electoral-democracy",
    term: "Electoral Democracy",
    tag: "regime type",
    definition:
      "A regime that holds free and fair multiparty elections with broad suffrage, but where the additional guarantees of a liberal democracy — robust rule of law, strong checks on the executive, and protected minority rights — are not yet fully in place. It is the Regimes of the World tier between electoral autocracy and liberal democracy.",
    source: {
      name: "V-Dem Institute (Regimes of the World)",
      url: "https://www.v-dem.net/",
    },
    seeAlso: [
      { label: "Democracy", href: "#democracy" },
      { label: "Suffrage", href: "#suffrage" },
    ],
  },
  {
    id: "executive",
    term: "Executive",
    tag: "structure",
    definition:
      "The branch of government responsible for carrying out and enforcing the law — headed by a president, prime minister, monarch, or collective body, and supported by ministries and the public administration. Its relationship to the legislature is what most sharply distinguishes presidential, parliamentary, and semi-presidential systems.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/executive-branch",
    },
    seeAlso: [
      { label: "Head of state vs head of government", href: "#head-of-state" },
      { label: "Separation of powers", href: "#separation-of-powers" },
    ],
  },
  {
    id: "federalism",
    term: "Federalism",
    tag: "structure",
    definition:
      "A system in which sovereignty is constitutionally divided between a central government and constituent units — states, provinces, or cantons — each with its own sphere of authority that the centre cannot unilaterally override. It contrasts with unitary systems, where sub-national powers are delegated by, and revocable by, the centre.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/federalism",
    },
    seeAlso: [
      { label: "Sovereignty", href: "#sovereignty" },
      { label: "Unitary state", href: "#unitary-state" },
      { label: "Devolution", href: "#devolution" },
    ],
  },
  {
    id: "filibuster",
    term: "Filibuster",
    tag: "process",
    definition:
      "A delaying tactic by which a minority in a legislature — sometimes a single member — prolongs debate to obstruct or block a measure that would otherwise pass. It is most associated with the U.S. Senate, where unlimited debate can normally be cut off only by a supermajority vote for cloture.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/filibuster",
    },
    seeAlso: [
      { label: "Supermajority", href: "#supermajority" },
      { label: "Quorum", href: "#quorum" },
    ],
  },
  {
    id: "freedom-of-the-press",
    term: "Freedom of the Press",
    definition:
      "The capacity of journalists and media outlets to report, investigate, and publish without censorship, state control, or fear of retaliation. A free press underpins accountability by exposing abuses of power; its suppression is among the most reliable warning signs of authoritarian drift.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/freedom-of-the-press",
    },
    seeAlso: [
      { label: "Civic space", href: "#civic-space" },
      { label: "Civil liberties", href: "#civil-liberties" },
    ],
  },
  {
    id: "gerrymandering",
    term: "Gerrymandering",
    tag: "process",
    definition:
      "Drawing the boundaries of electoral districts to favour one party or group — by concentrating opposing voters into a few districts or thinly spreading them across many so their votes elect fewer representatives. It distorts the link between votes cast and seats won, and is named after a salamander-shaped Massachusetts district approved under Governor Elbridge Gerry.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/gerrymandering",
    },
    seeAlso: [
      { label: "Apportionment", href: "#apportionment" },
      { label: "Plurality vs. majority", href: "#plurality-vs-majority" },
    ],
  },
  {
    id: "governance",
    term: "Governance",
    definition:
      "The traditions and institutions by which authority is exercised in a country — how governments are selected, monitored, and replaced; their capacity to formulate and implement sound policy; and the respect of citizens and the state for the institutions that govern them. This World Bank framing is the organising concept behind the entire Civica Index.",
    source: {
      name: "World Bank (Worldwide Governance Indicators)",
      url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
    },
    seeAlso: [
      { label: "Institutional quality", href: "#institutional-quality" },
      { label: "Index methodology →", href: "/civica-index/methodology" },
    ],
  },
  {
    id: "government-type",
    term: "Government Type",
    tag: "structure",
    definition:
      "A description of how a state organises its highest offices and the relationship between its branches — for example a presidential republic, a parliamentary democracy, or a constitutional monarchy. Civica treats this structural description as distinct from a country's regime type, which concerns how democratic or autocratic it is in practice.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/political-system",
    },
    seeAlso: [
      { label: "Regime type", href: "#regime-type" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "head-of-state",
    term: "Head of State vs Head of Government",
    tag: "structure",
    definition:
      "The head of state is the chief public representative of the country — a monarch or president — while the head of government leads the executive and runs day-to-day administration, usually a prime minister. In presidential systems one person holds both roles; in parliamentary systems they are typically separated.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/head-of-state",
    },
    seeAlso: [
      { label: "Executive", href: "#executive" },
      { label: "Parliamentary system", href: "#parliamentary-system" },
    ],
  },
  {
    id: "human-development",
    term: "Human Development (HDI)",
    tag: "outcome",
    definition:
      "A measure of well-being that combines three dimensions — a long and healthy life, knowledge, and a decent standard of living — rather than income alone, published by the UNDP as the Human Development Index on a 0-to-1 scale. Civica uses it as an outcome indicator — evidence of what governance produces — kept analytically separate from governance itself.",
    source: {
      name: "UNDP Human Development Report Office",
      url: "https://hdr.undp.org/data-center/human-development-index",
    },
    seeAlso: [
      { label: "Governance", href: "#governance" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "impeachment",
    term: "Impeachment",
    tag: "process",
    definition:
      "A formal charge of serious misconduct brought against a public official by a legislature — the first stage of a process that can lead to removal from office. Impeachment is the accusation, not the verdict: removal typically requires a separate conviction, often by a supermajority of the trying chamber.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/impeachment",
    },
    seeAlso: [
      { label: "Checks and balances", href: "#checks-and-balances" },
      { label: "Supermajority", href: "#supermajority" },
    ],
  },
  {
    id: "institutional-quality",
    term: "Institutional Quality",
    definition:
      "The capacity of a state's formal institutions — courts, bureaucracy, electoral administration, oversight bodies — to function impartially, predictably, and free of capture. High institutional quality is what lets a democracy absorb shocks without bending its rules.",
    source: {
      name: "World Bank (Worldwide Governance Indicators)",
      url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
    },
    seeAlso: [
      { label: "Accountability", href: "#accountability" },
      { label: "Rule of Law", href: "#rule-of-law" },
    ],
  },
  {
    id: "judicial-review",
    term: "Judicial Review",
    tag: "process",
    definition:
      "The power of courts to examine the acts of the legislature and executive against the constitution and to strike down those they find inconsistent with it. It makes the constitution enforceable rather than merely declaratory, and is a central check on the other branches.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/judicial-review",
    },
    seeAlso: [
      { label: "Judiciary independence", href: "#judiciary-independence" },
      { label: "Checks and balances", href: "#checks-and-balances" },
      { label: "Constitution", href: "#constitution" },
    ],
  },
  {
    id: "judiciary-independence",
    term: "Judiciary Independence",
    definition:
      "The principle that courts decide cases on the law and the facts, free from pressure by the executive, the legislature, or private interests. It depends on secure tenure, protected budgets, and transparent appointment — and is a precondition for the rule of law, since rights mean little without an impartial body to enforce them.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/judiciary",
    },
    seeAlso: [
      { label: "Rule of Law", href: "#rule-of-law" },
      { label: "Separation of powers", href: "#separation-of-powers" },
    ],
  },
  {
    id: "mandate",
    term: "Mandate",
    definition:
      "The authority an electorate is taken to grant a government or representative to act on its behalf — and, more narrowly, the claim that a decisive election result endorses a particular programme. A clear win with high turnout is read as a strong mandate; a narrow one is more easily contested.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/election-political-science",
    },
    seeAlso: [
      { label: "Suffrage", href: "#suffrage" },
      { label: "Plurality vs. majority", href: "#plurality-vs-majority" },
    ],
  },
  {
    id: "ombudsman",
    term: "Ombudsman",
    tag: "structure",
    definition:
      "An independent official, usually appointed by the legislature, who investigates citizens' complaints of maladministration or abuse by public bodies. An ombudsman can recommend remedies and publicise findings but generally cannot compel action — its influence rests on independence and public reporting rather than coercive power.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/ombudsman",
    },
    seeAlso: [
      { label: "Accountability", href: "#accountability" },
      { label: "Transparency", href: "#transparency" },
    ],
  },
  {
    id: "parliamentary-system",
    term: "Parliamentary System",
    tag: "structure",
    definition:
      "A system in which the executive derives its authority from, and is accountable to, the legislature: the head of government and cabinet hold office only while they command the confidence of the parliamentary majority and can be removed by a vote of no confidence. The head of state is usually a separate, largely ceremonial figure.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/parliamentary-system",
    },
    seeAlso: [
      { label: "Presidential system", href: "#presidential-system" },
      { label: "Head of state vs head of government", href: "#head-of-state" },
      { label: "Vote of confidence", href: "#vote-of-confidence" },
    ],
  },
  {
    id: "peer-group",
    term: "Peer Group",
    definition:
      "The set of comparable countries against which Civica frames a country's scores, so that figures are read in context rather than in isolation. Material outcomes are compared within World Bank region and income groupings, while governance outcomes are compared within Regimes of the World tiers.",
    source: {
      name: "Civica Index methodology",
      url: "/civica-index/methodology/peer-grouping",
    },
    seeAlso: [
      { label: "Peer grouping methodology →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "plebiscite",
    term: "Plebiscite",
    tag: "process",
    definition:
      "A direct vote in which the whole electorate is asked to approve or reject a fundamental question — a constitution, a change of sovereignty, or the legitimacy of a regime or leader. The term overlaps with referendum but often carries the connotation of a vote staged by a government, sometimes an autocratic one, to ratify a course already chosen.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/plebiscite",
    },
    seeAlso: [
      { label: "Referendum", href: "#referendum" },
      { label: "Direct democracy", href: "#direct-democracy" },
    ],
  },
  {
    id: "plurality-vs-majority",
    term: "Plurality vs. Majority",
    tag: "process",
    definition:
      "A plurality is the largest share of the vote, even if below half; a majority is more than half. Plurality (first-past-the-post) systems elect whoever leads the count, which can hand victory to a candidate most voters opposed; majority systems require an outright majority, often through a runoff or ranked ballot.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/electoral-system",
    },
    seeAlso: [
      { label: "Proportional representation", href: "#proportional-representation" },
      { label: "Electoral college", href: "#electoral-college" },
    ],
  },
  {
    id: "presidential-system",
    term: "Presidential System",
    tag: "structure",
    definition:
      "A system in which a directly or separately elected president serves as both head of state and head of government for a fixed term, independent of legislative confidence. The executive and legislature are chosen separately and check one another, which can produce both stronger separation of powers and the risk of deadlock.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/presidential-system",
    },
    seeAlso: [
      { label: "Parliamentary system", href: "#parliamentary-system" },
      { label: "Semi-presidential system", href: "#semi-presidential-system" },
    ],
  },
  {
    id: "proportional-representation",
    term: "Proportional Representation",
    tag: "process",
    definition:
      "An electoral system that allocates seats to parties in proportion to their share of the vote, so a party winning a fifth of the votes wins roughly a fifth of the seats. It gives smaller parties a foothold and broadens representation, but tends to produce multiparty legislatures and coalition governments.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/proportional-representation",
    },
    seeAlso: [
      { label: "Plurality vs. majority", href: "#plurality-vs-majority" },
      { label: "Coalition government", href: "#coalition-government" },
      { label: "Apportionment", href: "#apportionment" },
    ],
  },
  {
    id: "provenance",
    term: "Provenance",
    tag: "provenance",
    definition:
      "The documented origin of a data point — which source it came from, under what licence, and when it was last refreshed. In Civica every published fact traces to a source record, and a small dot marks whether that source is live or archived, so readers can judge the evidence behind a number.",
    source: {
      name: "Civica data methodology",
      url: "/methodology",
    },
    seeAlso: [
      { label: "How we approach data →", href: "/methodology" },
    ],
  },
  {
    id: "quorum",
    term: "Quorum",
    tag: "process",
    definition:
      "The minimum number of members who must be present for a legislature or other body to conduct business validly. Without a quorum, decisions taken have no legal force — which is why denying one (by walking out or staying away) can itself be a tactic to block action.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/quorum",
    },
    seeAlso: [
      { label: "Supermajority", href: "#supermajority" },
      { label: "Filibuster", href: "#filibuster" },
    ],
  },
  {
    id: "ratification",
    term: "Ratification",
    tag: "process",
    definition:
      "The formal act by which a state, or a body within it, gives final approval to a treaty, constitutional amendment, or other instrument so that it takes legal effect. Ratification often requires a heightened threshold — a legislative supermajority, or approval by subnational units — reflecting the gravity of the commitment.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/ratification",
    },
    seeAlso: [
      { label: "Constitution", href: "#constitution" },
      { label: "Supermajority", href: "#supermajority" },
    ],
  },
  {
    id: "referendum",
    term: "Referendum",
    tag: "process",
    definition:
      "A direct vote by the electorate on a specific question — a proposed law, constitutional change, or policy — rather than a vote for representatives. A referendum may be binding or merely advisory, and may be required by the constitution, called by the government, or triggered by citizens through petition.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/referendum",
    },
    seeAlso: [
      { label: "Plebiscite", href: "#plebiscite" },
      { label: "Direct democracy", href: "#direct-democracy" },
    ],
  },
  {
    id: "regime-type",
    term: "Regime Type",
    tag: "regime type",
    definition:
      "A classification of how democratic or autocratic a country is in practice, independent of its formal government structure. Civica's default lens is V-Dem's Regimes of the World, with the Bjørnskov–Rode / CGV taxonomy available as an alternate; both describe how power is actually held and contested.",
    source: {
      name: "V-Dem Institute (Regimes of the World)",
      url: "https://www.v-dem.net/",
    },
    seeAlso: [
      { label: "Government type", href: "#government-type" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "republic",
    term: "Republic",
    tag: "structure",
    definition:
      "A form of government in which the state is a public concern and its leaders are elected or appointed representatives rather than hereditary rulers, with ultimate authority resting in the citizen body. A republic is defined by the absence of a monarch, not by how democratic it is — republics range from liberal democracies to one-party states.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/republic-government",
    },
    seeAlso: [
      { label: "Government type", href: "#government-type" },
      { label: "Sovereignty", href: "#sovereignty" },
    ],
  },
  {
    id: "rule-of-law",
    term: "Rule of Law",
    tag: "CI dimension",
    definition:
      "The principle that everyone — including the government — is bound by, and entitled to the benefit of, laws that are publicly known, stable, applied equally, and adjudicated by an independent judiciary, rather than by the arbitrary will of those in power. It is a foundational dimension of the Civica Index and a precondition for the others.",
    source: {
      name: "Stanford Encyclopedia of Philosophy",
      url: "https://plato.stanford.edu/entries/rule-of-law/",
    },
    seeAlso: [
      { label: "Judiciary independence", href: "#judiciary-independence" },
      { label: "Civil liberties", href: "#civil-liberties" },
      { label: "Index methodology →", href: "/civica-index/methodology" },
    ],
  },
  {
    id: "semi-presidential-system",
    term: "Semi-presidential System",
    tag: "structure",
    definition:
      "A hybrid system combining a directly elected president with a prime minister and cabinet that are accountable to the legislature. Executive power is shared between the two, and their relationship — and the risk of friction — shifts depending on whether the president's party also controls parliament. The term was popularised by political scientist Maurice Duverger.",
    source: {
      name: "Maurice Duverger, “A new political system model: Semi-presidential government” (1980)",
      url: "https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1475-6765.1980.tb00569.x",
    },
    seeAlso: [
      { label: "Presidential system", href: "#presidential-system" },
      { label: "Parliamentary system", href: "#parliamentary-system" },
    ],
  },
  {
    id: "separation-of-powers",
    term: "Separation of Powers",
    definition:
      "The division of government authority among legislative, executive, and judicial branches so that no single branch may act without check from the others. First given its modern form by Montesquieu, the doctrine aims to prevent the concentration of power that makes arbitrary rule possible.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/separation-of-powers",
    },
    seeAlso: [
      { label: "Checks and balances", href: "#checks-and-balances" },
      { label: "Judiciary independence", href: "#judiciary-independence" },
    ],
  },
  {
    id: "sovereignty",
    term: "Sovereignty",
    definition:
      "The supreme authority of a state to govern itself within its territory, free from external control, and to be recognised as an equal by other states. It has an internal face — final authority over a population and territory — and an external face — independence in the international system.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/sovereignty",
    },
    seeAlso: [
      { label: "Federalism", href: "#federalism" },
      { label: "Constitution", href: "#constitution" },
    ],
  },
  {
    id: "suffrage",
    term: "Suffrage",
    definition:
      "The right to vote in public elections. Universal suffrage — extending the vote to all adult citizens regardless of property, sex, or race — is a defining feature of modern democracy and was secured only gradually, through successive reforms, in most countries.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/suffrage",
    },
    seeAlso: [
      { label: "Electoral democracy", href: "#electoral-democracy" },
      { label: "Democracy", href: "#democracy" },
    ],
  },
  {
    id: "supermajority",
    term: "Supermajority",
    tag: "process",
    definition:
      "A voting threshold higher than a simple majority — commonly three-fifths, two-thirds, or three-quarters — required for especially consequential decisions such as constitutional amendments, treaty ratification, or overriding a veto. The higher bar forces broader consensus and protects against narrow, transient majorities.",
    source: {
      name: "Merriam-Webster",
      url: "https://www.merriam-webster.com/dictionary/supermajority",
    },
    seeAlso: [
      { label: "Ratification", href: "#ratification" },
      { label: "Veto", href: "#veto" },
      { label: "Impeachment", href: "#impeachment" },
    ],
  },
  {
    id: "transparency",
    term: "Transparency",
    definition:
      "The openness of government decision-making — budgets, laws, data, and the conduct of officials — to public scrutiny. Transparency is a precondition for accountability: citizens and watchdogs cannot hold power to account for what they cannot see.",
    source: {
      name: "Transparency International",
      url: "https://www.transparency.org/en/what-is-corruption",
    },
    seeAlso: [
      { label: "Accountability", href: "#accountability" },
      { label: "Corruption control", href: "#corruption-control" },
    ],
  },
  {
    id: "unitary-state",
    term: "Unitary State",
    tag: "structure",
    definition:
      "A state in which sovereign authority rests with a single central government, and any powers exercised by regional or local bodies are granted by that centre and can be altered or withdrawn by it. Most countries are unitary; it is the principal alternative to federalism.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/unitary-state",
    },
    seeAlso: [
      { label: "Federalism", href: "#federalism" },
      { label: "Devolution", href: "#devolution" },
      { label: "Sovereignty", href: "#sovereignty" },
    ],
  },
  {
    id: "universal-suffrage",
    term: "Universal Suffrage",
    definition:
      "The extension of the right to vote to effectively all adult citizens, without restriction by property, income, sex, race, or literacy. Reached only through successive reforms in most countries, it is a benchmark of full electoral democracy — though its meaning depends on whether voting is also free and fair.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/suffrage",
    },
    seeAlso: [
      { label: "Suffrage", href: "#suffrage" },
      { label: "Electoral democracy", href: "#electoral-democracy" },
    ],
  },
  {
    id: "v-dem-regimes-of-the-world",
    term: "V-Dem / Regimes of the World",
    tag: "regime type",
    definition:
      "V-Dem (Varieties of Democracy) is a research project that scores hundreds of indicators of democratic practice across the world. Its Regimes of the World classification sorts countries into four tiers — closed autocracy, electoral autocracy, electoral democracy, and liberal democracy — which Civica adopts as its default lens for governance comparison.",
    source: {
      name: "V-Dem Institute (V-Dem Codebook)",
      url: "https://www.v-dem.net/",
    },
    seeAlso: [
      { label: "Regime type", href: "#regime-type" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "veto",
    term: "Veto",
    tag: "process",
    definition:
      "The power of one office or body to block an action of another — most often an executive's power to reject a bill passed by the legislature. A veto is rarely absolute: legislatures can usually override it, typically by a supermajority, which keeps it a check rather than a trump card.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/veto",
    },
    seeAlso: [
      { label: "Checks and balances", href: "#checks-and-balances" },
      { label: "Supermajority", href: "#supermajority" },
    ],
  },
  {
    id: "vote-of-confidence",
    term: "Vote of Confidence",
    tag: "process",
    definition:
      "A legislative vote that tests whether a government still commands majority support. Losing a confidence motion — or passing a motion of no confidence — typically forces the government to resign or call elections, and is the principal mechanism by which parliamentary systems hold the executive accountable between elections.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/vote-of-confidence",
    },
    seeAlso: [
      { label: "Parliamentary system", href: "#parliamentary-system" },
      { label: "Coalition government", href: "#coalition-government" },
      { label: "Cabinet", href: "#cabinet" },
    ],
  },
  {
    id: "whip",
    term: "Whip",
    tag: "structure",
    definition:
      "A legislator appointed by a party to enforce discipline — ensuring members attend key votes and support the party line. Whips count likely votes, relay leadership's position, and apply pressure or persuasion; the strength of the whip is a measure of how cohesively a party acts in the legislature.",
    source: {
      name: "Encyclopædia Britannica",
      url: "https://www.britannica.com/topic/whip-government",
    },
    seeAlso: [
      { label: "Cabinet", href: "#cabinet" },
      { label: "Quorum", href: "#quorum" },
    ],
  },
];

/** A letter group: an uppercase letter and its alphabetically sorted terms. */
export interface GlossaryGroup {
  letter: string;
  terms: GlossaryTerm[];
}

/**
 * Group the glossary into A–Z buckets by the first letter of each term,
 * sorted alphabetically within and across groups. Letters with no terms are
 * omitted (the A–Z strip dims them separately).
 */
export function getGlossaryGroups(): GlossaryGroup[] {
  const byLetter = new Map<string, GlossaryTerm[]>();
  for (const term of GLOSSARY_TERMS) {
    const letter = term.term.charAt(0).toUpperCase();
    const bucket = byLetter.get(letter);
    if (bucket) bucket.push(term);
    else byLetter.set(letter, [term]);
  }
  return Array.from(byLetter.entries())
    .map(([letter, terms]) => ({
      letter,
      terms: terms
        .slice()
        .sort((a, b) => a.term.localeCompare(b.term, "en")),
    }))
    .sort((a, b) => a.letter.localeCompare(b.letter, "en"));
}

/** The 26 uppercase letters of the alphabet, for the A–Z index strip. */
export const ALPHABET = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
);
