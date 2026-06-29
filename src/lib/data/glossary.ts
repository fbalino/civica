// Curated glossary of governance and Civica vocabulary.
//
// Reference content: each definition is plain, precise, and neutral. Where a
// term maps to a Civica concept, `seeAlso` carries an optional internal link to
// the relevant methodology page. `tag` attaches a small tinted category label
// rendered as an `.editorial-chip`-style pill on the page.
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
  | "provenance";

export interface GlossarySeeAlso {
  /** Visible label. Append " →" in the data when the link leaves the glossary. */
  label: string;
  /** Internal href (a methodology page) or an in-page anchor like "#rule-of-law". */
  href: string;
}

export interface GlossaryTerm {
  /** Stable kebab-case id used for the in-page anchor. */
  id: string;
  /** Display name (serif). */
  term: string;
  /** 1–3 sentence definition, plain and precise. */
  definition: string;
  /** Optional tinted category tag. */
  tag?: GlossaryTag;
  /** Optional "See also" cross-references. */
  seeAlso?: GlossarySeeAlso[];
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: "accountability",
    term: "Accountability",
    definition:
      "The obligation of officials and institutions to answer for the exercise of power — to explain decisions, justify the use of public resources, and face consequences when conduct falls short. Civica treats horizontal accountability (checks between branches of government) and vertical accountability (to the electorate) as distinct strands.",
    seeAlso: [
      { label: "Rule of Law", href: "#rule-of-law" },
      { label: "Corruption control", href: "#corruption-control" },
    ],
  },
  {
    id: "authoritarianism",
    term: "Authoritarianism",
    tag: "regime type",
    definition:
      "A form of government in which political power is concentrated and not subject to meaningful, contestable elections or independent checks. In the V-Dem framework Civica uses, it spans closed and electoral autocracies — the latter holding elections that are real but neither free nor fair.",
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
    seeAlso: [
      { label: "Separation of powers", href: "#separation-of-powers" },
      { label: "Parliamentary system", href: "#parliamentary-system" },
    ],
  },
  {
    id: "civic-space",
    term: "Civic Space",
    definition:
      "The environment that enables people to organise, participate, and communicate freely — exercising the rights to associate, assemble peacefully, and express opinions without fear of reprisal. A narrowing civic space is an early signal of democratic erosion, often visible before formal institutions change.",
    seeAlso: [
      { label: "Civil liberties", href: "#civil-liberties" },
      { label: "Freedom of the press", href: "#freedom-of-the-press" },
    ],
  },
  {
    id: "civil-liberties",
    term: "Civil Liberties",
    definition:
      "The protections that shield individuals from undue interference by the state — freedom of expression, assembly, association, belief, and movement, together with due-process guarantees. They are a core input to the freedom and rights dimension of the Civica Index.",
    seeAlso: [
      { label: "Rule of Law", href: "#rule-of-law" },
      { label: "Index methodology →", href: "/civica-index/methodology" },
    ],
  },
  {
    id: "constitution",
    term: "Constitution",
    definition:
      "The supreme body of law that establishes a state's institutions, distributes authority among them, and sets the limits of governmental power. Constitutions may be codified in a single document or, as in the United Kingdom, drawn from statutes, conventions, and judicial decisions; their force depends less on their text than on whether institutions honour them.",
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
      "The degree to which the use of public power for private gain is constrained. In the Civica Index it draws primarily on Transparency International's Corruption Perceptions Index and the World Bank's governance indicators, measured against a quarterly reference period.",
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
    seeAlso: [
      { label: "Electoral democracy", href: "#electoral-democracy" },
      { label: "Authoritarianism", href: "#authoritarianism" },
    ],
  },
  {
    id: "electoral-democracy",
    term: "Electoral Democracy",
    tag: "regime type",
    definition:
      "A regime that holds free and fair multiparty elections with broad suffrage, but where the additional guarantees of a liberal democracy — robust rule of law, strong checks on the executive, and protected minority rights — are not yet fully in place. It is the Regimes of the World tier between electoral autocracy and liberal democracy.",
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
    seeAlso: [
      { label: "Sovereignty", href: "#sovereignty" },
      { label: "Separation of powers", href: "#separation-of-powers" },
    ],
  },
  {
    id: "freedom-of-the-press",
    term: "Freedom of the Press",
    definition:
      "The capacity of journalists and media outlets to report, investigate, and publish without censorship, state control, or fear of retaliation. A free press underpins accountability by exposing abuses of power; its suppression is among the most reliable warning signs of authoritarian drift.",
    seeAlso: [
      { label: "Civic space", href: "#civic-space" },
      { label: "Civil liberties", href: "#civil-liberties" },
    ],
  },
  {
    id: "governance",
    term: "Governance",
    definition:
      "The traditions and institutions by which authority is exercised in a country — how governments are selected and replaced, their capacity to formulate and implement policy, and the respect of citizens and the state for the institutions that govern them. It is the organising concept behind the entire Civica Index.",
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
      "A measure of well-being that combines health, education, and living standards rather than income alone, published by the UNDP as the Human Development Index. Civica uses it as an outcome indicator — evidence of what governance produces — kept analytically separate from governance itself.",
    seeAlso: [
      { label: "Governance", href: "#governance" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "institutional-quality",
    term: "Institutional Quality",
    definition:
      "The capacity of a state's formal institutions — courts, bureaucracy, electoral administration, oversight bodies — to function impartially, predictably, and free of capture. High institutional quality is what lets a democracy absorb shocks without bending its rules.",
    seeAlso: [
      { label: "Accountability", href: "#accountability" },
      { label: "Rule of Law", href: "#rule-of-law" },
    ],
  },
  {
    id: "judiciary-independence",
    term: "Judiciary Independence",
    definition:
      "The principle that courts decide cases on the law and the facts, free from pressure by the executive, the legislature, or private interests. It depends on secure tenure, protected budgets, and transparent appointment — and is a precondition for the rule of law, since rights mean little without an impartial body to enforce them.",
    seeAlso: [
      { label: "Rule of Law", href: "#rule-of-law" },
      { label: "Separation of powers", href: "#separation-of-powers" },
    ],
  },
  {
    id: "parliamentary-system",
    term: "Parliamentary System",
    tag: "structure",
    definition:
      "A system in which the executive derives its authority from, and is accountable to, the legislature: the head of government and cabinet hold office only while they command the confidence of the parliamentary majority and can be removed by a vote of no confidence. The head of state is usually a separate, largely ceremonial figure.",
    seeAlso: [
      { label: "Presidential system", href: "#presidential-system" },
      { label: "Head of state vs head of government", href: "#head-of-state" },
    ],
  },
  {
    id: "peer-group",
    term: "Peer Group",
    definition:
      "The set of comparable countries against which Civica frames a country's scores, so that figures are read in context rather than in isolation. Material outcomes are compared within World Bank region and income groupings, while governance outcomes are compared within Regimes of the World tiers.",
    seeAlso: [
      { label: "Peer grouping methodology →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "presidential-system",
    term: "Presidential System",
    tag: "structure",
    definition:
      "A system in which a directly or separately elected president serves as both head of state and head of government for a fixed term, independent of legislative confidence. The executive and legislature are chosen separately and check one another, which can produce both stronger separation of powers and the risk of deadlock.",
    seeAlso: [
      { label: "Parliamentary system", href: "#parliamentary-system" },
      { label: "Semi-presidential system", href: "#semi-presidential-system" },
    ],
  },
  {
    id: "provenance",
    term: "Provenance",
    tag: "provenance",
    definition:
      "The documented origin of a data point — which source it came from, under what licence, and when it was last refreshed. In Civica every published fact traces to a source record, and a small dot marks whether that source is live or archived, so readers can judge the evidence behind a number.",
    seeAlso: [
      { label: "How we approach data →", href: "/methodology" },
    ],
  },
  {
    id: "regime-type",
    term: "Regime Type",
    tag: "regime type",
    definition:
      "A classification of how democratic or autocratic a country is in practice, independent of its formal government structure. Civica's default lens is V-Dem's Regimes of the World, with the Bjørnskov–Rode / CGV taxonomy available as an alternate; both describe how power is actually held and contested.",
    seeAlso: [
      { label: "Government type", href: "#government-type" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
    ],
  },
  {
    id: "rule-of-law",
    term: "Rule of Law",
    tag: "CI dimension",
    definition:
      "The principle that everyone — including the government — is bound by, and entitled to the benefit of, laws that are publicly known, applied equally, and adjudicated by an independent judiciary. It is a foundational dimension of the Civica Index and a precondition for the others.",
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
      "A hybrid system combining a directly elected president with a prime minister and cabinet that are accountable to the legislature. Executive power is shared between the two, and their relationship — and the risk of friction — shifts depending on whether the president's party also controls parliament.",
    seeAlso: [
      { label: "Presidential system", href: "#presidential-system" },
      { label: "Parliamentary system", href: "#parliamentary-system" },
    ],
  },
  {
    id: "separation-of-powers",
    term: "Separation of Powers",
    definition:
      "The division of government authority among legislative, executive, and judicial branches so that no single branch may act without check from the others. The overlapping nature of these checks — their redundancy — is what makes capture costly and slow.",
    seeAlso: [
      { label: "Institutional quality", href: "#institutional-quality" },
      { label: "Judiciary independence", href: "#judiciary-independence" },
    ],
  },
  {
    id: "sovereignty",
    term: "Sovereignty",
    definition:
      "The supreme authority of a state to govern itself within its territory, free from external control, and to be recognised as an equal by other states. It has an internal face — final authority over a population and territory — and an external face — independence in the international system.",
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
    seeAlso: [
      { label: "Electoral democracy", href: "#electoral-democracy" },
      { label: "Democracy", href: "#democracy" },
    ],
  },
  {
    id: "transparency",
    term: "Transparency",
    definition:
      "The openness of government decision-making — budgets, laws, data, and the conduct of officials — to public scrutiny. Transparency is a precondition for accountability: citizens and watchdogs cannot hold power to account for what they cannot see.",
    seeAlso: [
      { label: "Accountability", href: "#accountability" },
      { label: "Corruption control", href: "#corruption-control" },
    ],
  },
  {
    id: "v-dem-regimes-of-the-world",
    term: "V-Dem / Regimes of the World",
    tag: "regime type",
    definition:
      "V-Dem (Varieties of Democracy) is a research project that scores hundreds of indicators of democratic practice across the world. Its Regimes of the World classification sorts countries into four tiers — closed autocracy, electoral autocracy, electoral democracy, and liberal democracy — which Civica adopts as its default lens for governance comparison.",
    seeAlso: [
      { label: "Regime type", href: "#regime-type" },
      { label: "Peer grouping →", href: "/civica-index/methodology/peer-grouping" },
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
