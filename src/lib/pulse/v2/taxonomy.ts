/**
 * Phase 5.5 — Pulse Beta event taxonomy. Version 2.0.
 *
 * Hard-coded per Pulse Beta v0.9 spec §3.2 (categories per dimension),
 * §3.3 (severity → numeric mapping), and §4.1 (event-type-specific
 * decay half-lives). Single source of truth — the classifier picks
 * from `EVENT_CATEGORIES`, the corroboration step reads
 * `SEVERITY_TIER_RANGES`, and the scoring step reads `HALF_LIFE_DAYS`.
 *
 * ─────────────────────────────────────────────────────────────────
 *  v2.0 (2026-04-30) — additive expansion, 31 new categories
 * ─────────────────────────────────────────────────────────────────
 *
 * v2.0 was produced through a top-down completeness review against
 * five established political-science frameworks:
 *
 *   - V-Dem (Varieties of Democracy) Liberal Democracy index sub-
 *     indicators
 *   - ACLED event-type taxonomy
 *   - Comparative Constitutions Project (CCP) typologies
 *   - Center for Systemic Peace — Polity Project regime-transition
 *     codings
 *   - Freedom House — Freedom in the World indicator categories
 *
 * Each new category cites its theoretical source in an inline comment.
 * The full derivation, including 11 flagged candidates that were NOT
 * added, lives in `docs/taxonomy-v2-gap-analysis.md`.
 *
 * v2.0 changes:
 *   - Additive only. All 30 v1 categories preserved verbatim.
 *   - 31 new categories appended (5 dq, 7 rol, 11 fnr, 2 cc, 6 stab).
 *   - No removals or renames (deferred to v2.1 conversation after at
 *     least one quarter of real classification data).
 *   - New categories adopt the bidirectional convention where the
 *     underlying phenomenon is genuinely bidirectional (rights,
 *     surveillance regimes, electoral access). Existing v1 categories
 *     keep their asymmetric shape — additive only.
 *
 * ─────────────────────────────────────────────────────────────────
 *  TAXONOMY DECISION — coups map to STABILITY, not democratic_quality
 * ─────────────────────────────────────────────────────────────────
 *
 * The `coup` and `state_collapse` categories live on the `stability`
 * dimension. Reviewers occasionally raise the question
 * "shouldn't a coup drive democratic_quality?" — the answer is yes,
 * but indirectly, through the cascade.
 *
 * Civica Pulse models a coup as the *stability rupture*. The
 * democratic_quality damage that follows is captured through the
 * cascade of post-coup events that are independently classifiable:
 *
 *   - Parliament dissolution    → constitutional_override_electoral
 *                                  → democratic_quality
 *   - Election results annulled → mass_disenfranchisement
 *                                  → democratic_quality
 *   - Term extensions / "transition plans"
 *                                → term_extension
 *                                  → democratic_quality
 *   - Show trials of opposition → opposition_prosecution (v2)
 *                                  → rule_of_law
 *   - Martial law / military tribunals
 *                                → martial_law
 *                                  → rule_of_law
 *   - Civilian state of emergency without military jurisdiction
 *                                → emergency_declaration (v2)
 *                                  → rule_of_law
 *   - Press shutdowns           → media_shutdown / journalist_arrest
 *                                  → freedom_rights
 *
 * Implication for ground-truth seed data (backtesting): a single
 * "coup" headline is not enough to reach catastrophic-magnitude
 * deltas on democratic_quality or rule_of_law. The cascade events
 * must be present too. See `data/backtest/myanmar-2021.json` for
 * the canonical example.
 *
 * ─────────────────────────────────────────────────────────────────
 *  CLASSIFIER DISAMBIGUATION RULES (v2)
 * ─────────────────────────────────────────────────────────────────
 *
 * Several v2 categories overlap with v1 categories at the prompt
 * level (a single event could fit either). To prevent regression on
 * v1-passing backtest cases, the classifier prompt enforces a
 * "more dimension-specific wins" rule:
 *
 *   When an event could plausibly fit BOTH a generic procedural
 *   category (e.g., emergency_declaration) AND a category whose
 *   direct effect targets a specific governance outcome (e.g.,
 *   term_extension, mass_disenfranchisement, judicial_independence_
 *   rollback), the classifier MUST pick the dimension-specific one.
 *
 * Concrete precedence rules in the system prompt:
 *
 *   1. emergency_declaration loses to: term_extension,
 *      mass_disenfranchisement, election_cancellation,
 *      constitutional_override_electoral, judicial_purge,
 *      martial_law (when military tribunals are involved).
 *
 *   2. systematic_crackdown loses to: any category with a
 *      named institutional target (judicial_independence_rollback,
 *      ngo_restriction, media_shutdown, religious_freedom_change,
 *      academic_freedom_change, lgbt_rights_change,
 *      minority_rights_change).
 *
 *   3. mass_detention loses to: opposition_prosecution (when the
 *      detained are named opposition figures with formal charges),
 *      detention_conditions (when the focus is on conditions of
 *      confinement, not the act of detention).
 *
 *   4. coup wins over: government_collapse (when military force
 *      is involved), constitutional_crisis (when an unconstitutional
 *      seizure of power has occurred).
 *
 * These rules ensure that v2 expands resolution without breaking
 * v1's classification of canonical cases (Myanmar, Niger, Tunisia,
 * Afghanistan, Hungary).
 */

import type { PulseDimension, SeverityTier } from "./types";

export type EventDirection = "positive" | "negative" | "mixed";

export interface EventCategory {
  id: string;
  label: string;
  dimension: PulseDimension;
  direction: EventDirection;
  allowedTiers: SeverityTier[];
  halfLifeDays: number;
}

export const SEVERITY_TIER_RANGES: Record<
  SeverityTier,
  { min: number; max: number }
> = {
  low_pos: { min: 1, max: 2 },
  moderate_pos: { min: 3, max: 4 },
  high_pos: { min: 5, max: 6 },
  low_neg: { min: -2, max: -1 },
  moderate_neg: { min: -4, max: -3 },
  severe_neg: { min: -7, max: -5 },
  catastrophic_neg: { min: -10, max: -8 },
};

export function isPositiveTier(tier: SeverityTier): boolean {
  return tier === "low_pos" || tier === "moderate_pos" || tier === "high_pos";
}

export const HUMAN_REVIEW_TIERS = new Set<SeverityTier>([
  "severe_neg",
  "catastrophic_neg",
  "high_pos",
]);

export const EVENT_CATEGORIES: EventCategory[] = [
  // ═══════════════════════════════════════════════════════════════
  //  v1 categories — preserved verbatim
  // ═══════════════════════════════════════════════════════════════

  // --- Democratic Quality (v1) ---
  {
    id: "fair_election",
    label: "Free and fair election",
    dimension: "democratic_quality",
    direction: "positive",
    allowedTiers: ["low_pos", "moderate_pos", "high_pos"],
    halfLifeDays: 90,
  },
  {
    id: "flawed_election",
    label: "Flawed but contested election",
    dimension: "democratic_quality",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "election_cancellation",
    label: "Election cancellation or postponement",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "constitutional_override_electoral",
    label: "Constitutional override of electoral result",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "mass_disenfranchisement",
    label: "Mass disenfranchisement",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "peaceful_transfer",
    label: "Successful peaceful transfer of power",
    dimension: "democratic_quality",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 90,
  },
  {
    id: "term_extension",
    label: "Constitutional term extension (self-coup)",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 365,
  },

  // --- Rule of Law (v1) ---
  {
    id: "judicial_purge",
    label: "Judicial purge (mass dismissal of judges)",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 365,
  },
  {
    id: "executive_constitutional_override",
    label: "Constitutional override by executive",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "anticorruption_conviction",
    label: "Independent anti-corruption conviction (high-profile)",
    dimension: "rule_of_law",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 120,
  },
  {
    id: "judicial_independence_expansion",
    label: "Judicial independence reform (expansion)",
    dimension: "rule_of_law",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "judicial_independence_rollback",
    label: "Judicial independence rollback (curtailment)",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "martial_law",
    label: "Martial law declaration",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 365,
  },

  // --- Rights & Freedoms (v1) ---
  {
    id: "journalist_arrest",
    label: "Journalist arrested or killed",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg"],
    halfLifeDays: 60,
  },
  {
    id: "media_shutdown",
    label: "Media outlet shutdown",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "protest_crackdown",
    label: "Protest crackdown with casualties",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg", "catastrophic_neg"],
    halfLifeDays: 90,
  },
  {
    id: "systematic_crackdown",
    label: "Systematic crackdown (pattern of abuse)",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 180,
  },
  {
    id: "mass_detention",
    label: "Mass political detention",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "press_freedom_expansion",
    label: "Press freedom law expansion",
    dimension: "freedom_rights",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "assembly_rights_expansion",
    label: "Assembly / association rights expansion",
    dimension: "freedom_rights",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "internet_shutdown",
    label: "Internet shutdown",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 60,
  },

  // --- Corruption Control (v1) ---
  {
    id: "corruption_conviction",
    label: "High-level corruption conviction",
    dimension: "corruption_control",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 120,
  },
  {
    id: "corruption_scandal",
    label: "Major corruption scandal (documented)",
    dimension: "corruption_control",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 120,
  },
  {
    id: "anticorruption_law",
    label: "Anti-corruption law enactment",
    dimension: "corruption_control",
    direction: "positive",
    allowedTiers: ["low_pos", "moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "anticorruption_dismantling",
    label: "Anti-corruption institution dismantling",
    dimension: "corruption_control",
    direction: "negative",
    allowedTiers: ["severe_neg"],
    halfLifeDays: 365,
  },

  // --- Stability (v1) ---
  {
    id: "armed_conflict",
    label: "Armed conflict outbreak",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 180,
  },
  {
    id: "peace_agreement_signed",
    label: "Peace agreement signed (announcement)",
    dimension: "stability",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 90,
  },
  {
    id: "peace_agreement_implemented",
    label: "Peace agreement implementation evidence",
    dimension: "stability",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 365,
  },
  {
    id: "coup",
    label: "Coup d'état",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["catastrophic_neg"],
    halfLifeDays: 365,
  },
  {
    id: "state_collapse",
    label: "State collapse",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["catastrophic_neg"],
    halfLifeDays: 730,
  },

  // ═══════════════════════════════════════════════════════════════
  //  v2 additions — derived from political-science frameworks
  //  See docs/taxonomy-v2-gap-analysis.md for derivation per category.
  // ═══════════════════════════════════════════════════════════════

  // --- Democratic Quality (v2 adds) ---
  {
    // V-Dem v2elirreg (election irregularities); FH A-1, A-2.
    // Distinct from `flawed_election` (clearly compromised) and
    // `fair_election` (clean) — sits in the middle: contested + close +
    // post-election challenges. Real-world: US 2000 Bush v. Gore;
    // Nicaragua 2008 municipal elections; Kenya 2017 (annulled by court).
    id: "disputed_election",
    label: "Disputed election outcome",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg"],
    halfLifeDays: 90,
  },
  {
    // V-Dem v2elboycot, v2elaccept; FH A-3 ("electoral framework fair").
    // Pre-election structural redistricting that advantages the
    // governing party; not equivalent to mass_disenfranchisement
    // (post-fact). Real-world: Hungary 2012 electoral law; US
    // post-2010 redistricting cycles.
    id: "gerrymandering",
    label: "Gerrymandering / electoral boundary manipulation",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg"],
    halfLifeDays: 365,
  },
  {
    // V-Dem v2psbars, v2psoppaut; FH B-1.
    // Disqualification of opposition candidates from electoral
    // competition. Distinct from mass_disenfranchisement (voters)
    // and from constitutional_override_electoral (full override).
    // Real-world: Russia barring Navalny 2018; Pakistan barring
    // Imran Khan 2023; Brazil TSE barring Bolsonaro 2023 (positive
    // when applied to anti-democratic actors).
    id: "candidate_disqualification",
    label: "Candidate disqualification",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    // V-Dem v2xeg_eqaccess, v2elsuffrage; FH A.
    // Pre-election changes to voter access — voter ID requirements,
    // registration purges, polling-station closures or expansions.
    // Bidirectional: can be restrictive (negative) or expansive
    // (positive automatic-registration, expanded suffrage).
    // Real-world: US state-level voter ID changes 2010s; UK 2023
    // voter ID introduction; Argentina 2009 universal suffrage law.
    id: "electoral_access_change",
    label: "Electoral-law access change (voter ID, registration, polling)",
    dimension: "democratic_quality",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 365,
  },
  {
    // Polity transition codings (positive moves on POLITY index);
    // CCP transition typology. The agreement-to-transition itself,
    // distinct from the elections that follow (fair_election) or
    // peaceful transfer (peaceful_transfer). Real-world: Spain 1976
    // Pacto de la Moncloa; South Africa 1990-94 negotiations;
    // Chile 1988-90 plebiscite-and-transition pact.
    id: "negotiated_transition",
    label: "Pacted / negotiated democratic transition",
    dimension: "democratic_quality",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 365,
  },

  // --- Rule of Law (v2 adds) ---
  {
    // V-Dem v2juncind; FH F-1.
    // Distinct institutional layer from judiciary. Firing of
    // independent prosecutors (politically motivated), or
    // strengthening of prosecutorial independence (creation of
    // independent offices, removal of executive control).
    // Real-world: Trump firing of US Attorneys 2017, 2025; Poland
    // 2015-2023 prosecutor-general consolidation; Israel 2023
    // standoff over attorney-general independence.
    id: "prosecutorial_independence",
    label: "Prosecutorial independence change",
    dimension: "rule_of_law",
    direction: "mixed",
    allowedTiers: ["moderate_neg", "severe_neg", "moderate_pos"],
    halfLifeDays: 180,
  },
  {
    // V-Dem v2jucomp (compliance with judiciary); FH F-1.
    // Refusing to comply with binding judicial decisions.
    // Distinct from executive_constitutional_override (which is
    // overriding the constitution itself). Real-world: Israel
    // 2023 judicial-overhaul standoff; multiple Trump-era cases
    // 2017-2024; Hungary 2014 ECJ-defiance episodes.
    id: "executive_court_defiance",
    label: "Executive defiance of court rulings",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 90,
  },
  {
    // V-Dem v2clrspct, v2clkill; FH F-3.
    // Bidirectional: civilian-oversight expansion or restriction.
    // Real-world: Floyd-era oversight expansions in US cities 2020-22;
    // Russia 2022-23 narrowing of police accountability.
    id: "police_accountability",
    label: "Police accountability change (civilian oversight)",
    dimension: "rule_of_law",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 180,
  },
  {
    // V-Dem v2cltort, v2clkill; FH F-3.
    // Pretrial detention duration changes; conditions of confinement
    // (solitary, communications); torture allegations institutionalised
    // or curbed. Real-world: Egypt 2013 terrorism-law detention
    // expansion; US 2014 sentencing reforms; Rwanda 2018 detention
    // reforms.
    id: "detention_conditions",
    label: "Detention conditions change",
    dimension: "rule_of_law",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 180,
  },
  {
    // CCP institutional-tracking; V-Dem oversight indicators.
    // Auditor-general, ombudsman, electoral commission, public-sector
    // ethics body. Distinct from anticorruption_dismantling (which is
    // already on corruption_control dimension and specific to
    // anti-corruption agencies). Real-world: Hungary 2010-12
    // ombudsman office restructuring; Brazil 2019 weakening of
    // accountability controls; Mexico 2024 INE attempted overhaul.
    id: "oversight_body_dismantling",
    label: "Oversight body dismantling (non-anti-corruption)",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg"],
    halfLifeDays: 365,
  },
  {
    // Distinct from martial_law (which involves military jurisdiction).
    // Civilian state-of-emergency declarations under counter-terrorism,
    // public-health, or civil-disturbance frameworks. V-Dem
    // v2regsupgroups_ord proxy. FH F.
    // Real-world: Sri Lanka 2022 emergency; France 2015-17
    // post-attack emergency; Philippines Duterte drug-war emergency
    // periods. Magnitude varies — most expire on schedule (low_neg);
    // some entrench (severe_neg).
    id: "emergency_declaration",
    label: "Civilian state of emergency declaration",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg"],
    halfLifeDays: 90,
  },
  {
    // V-Dem v2juhcind (high court independence) + V-Dem politically
    // motivated prosecutions sub-indicators.
    // Specific use of prosecution against named opposition figures —
    // distinct from judicial_independence_rollback (institutional)
    // and from anticorruption_conviction (positive when warranted).
    // Real-world: Lula 2018 Curitiba prosecutions; Navalny multiple
    // prosecutions 2021-2024; Khan 2023; Ousmane Sonko 2023.
    id: "opposition_prosecution",
    label: "Politically motivated prosecution of opposition figure",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },

  // --- Rights & Freedoms (v2 adds) ---
  {
    // V-Dem v2clrelig; FH D-2.
    // State-sanctioned restriction or expansion of religious practice,
    // proselytisation, religious organisation registration.
    // Real-world: Russia 2016 Yarovaya restrictions; India CAA 2019;
    // Iran post-2022 enforcement waves; Norway 2022 religious-marriage
    // law.
    id: "religious_freedom_change",
    label: "Religious freedom change",
    dimension: "freedom_rights",
    direction: "mixed",
    allowedTiers: ["moderate_neg", "severe_neg", "moderate_pos"],
    halfLifeDays: 365,
  },
  {
    // V-Dem v2clpolcl, v2pepwrses; FH G-4.
    // De jure changes affecting ethnic, linguistic, religious minorities
    // (citizenship-by-descent rules, language laws, official-religion
    // changes). Distinct from systematic_crackdown (active oppression).
    // Real-world: India CAA 2019 (NRC corollary); Ethiopia
    // 2018-19 ethnic-federalism reforms; Sri Lanka post-war
    // language reforms.
    id: "minority_rights_change",
    label: "Minority group rights change (de jure)",
    dimension: "freedom_rights",
    direction: "mixed",
    allowedTiers: ["moderate_neg", "severe_neg", "moderate_pos"],
    halfLifeDays: 365,
  },
  {
    // V-Dem v2clrgunev (equal treatment under law); FH G-4.
    // Real-world: Hungary 2021 anti-LGBT law; Brazil 2025 marriage
    // codification; multiple US state-level rollbacks 2022-2024;
    // India 2018 Section 377 ruling (positive).
    id: "lgbt_rights_change",
    label: "LGBT rights change",
    dimension: "freedom_rights",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 365,
  },
  {
    // V-Dem v2cldiscm, v2cldiscw (private discussion freedom);
    // FH D-4. Real-world: NSA reform 2015; UK Investigatory
    // Powers Act 2016; India Pegasus deployment 2019-21;
    // Apple iCloud E2EE expansion 2022 (positive).
    id: "surveillance_regime_change",
    label: "Surveillance regime change",
    dimension: "freedom_rights",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 365,
  },
  {
    // V-Dem v2smgovsm; FH D-1.
    // Distinct from internet_shutdown (full shutdown). Content blocking,
    // throttling, DPI deployment, content laws. Real-world: Pakistan
    // 2023-24 social-media throttling; Russia "fake news" laws 2022;
    // Turkey 2022 disinformation law.
    id: "internet_content_restriction",
    label: "Internet content restriction (blocking, throttling, content law)",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg"],
    halfLifeDays: 180,
  },
  {
    // V-Dem v2cafres, v2cacontent (academic freedom dedicated indices);
    // FH D-3. Real-world: Hungary 2017 CEU forced relocation; Turkey
    // 2016 mass academic dismissals; China 2019 7-Don'ts directives.
    id: "academic_freedom_change",
    label: "Academic freedom change",
    dimension: "freedom_rights",
    direction: "mixed",
    allowedTiers: ["moderate_neg", "severe_neg", "moderate_pos"],
    halfLifeDays: 365,
  },
  {
    // V-Dem v2cseeorgs (CSO entry/exit autonomy); FH E.
    // De jure NGO-specific legal regimes — registration laws,
    // foreign-funding restrictions, dissolution orders. Real-world:
    // Russia "foreign agents" 2012 (multiple expansions through 2022);
    // Hungary "Stop Soros" 2018; India FCRA tightening 2020;
    // Israel 2024 NGO-funding bill.
    id: "ngo_restriction",
    label: "NGO / civil society restriction (de jure)",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 365,
  },
  {
    // FH G-1.
    // Travel bans, exit visas, internal-passport requirements.
    // Bidirectional. Real-world: Russia exit-visa for mobilisation
    // 2022; US travel-ban EOs 2017; EU Schengen expansions
    // (positive).
    id: "movement_freedom_change",
    label: "Freedom of movement change",
    dimension: "freedom_rights",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 180,
  },
  {
    // FH E-1; ACLED protest sub-types. Mirrors `assembly_rights_expansion`
    // on the negative side: de jure restrictions (permit regimes,
    // public-order acts, blanket protest bans) distinct from
    // protest_crackdown (state response to a specific protest event).
    // Real-world: UK Public Order Act 2023; Russia 2022 anti-war
    // protest restrictions; France 2023 retirement-protest restrictions.
    id: "assembly_rights_restriction",
    label: "Assembly rights restriction (de jure)",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    // ACLED `Violence against civilians: Attack` sub-event-type;
    // V-Dem v2caviol.
    // Targeted assassinations of journalists, activists, opposition
    // figures (distinct from journalist_arrest which is detention).
    // Real-world: Khashoggi 2018; Marielle Franco 2018; Daphne
    // Caruana Galizia 2017; Roman Protasevich detention 2021.
    id: "political_assassination",
    label: "Political assassination / targeted killing",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 90,
  },
  {
    // V-Dem v2clprptyw, v2clprptym; FH G-2.
    // Expropriation, asset seizures targeting groups, property-rights
    // protections established or weakened. Real-world: Venezuelan
    // expropriations 2007-19; Belarusian asset seizures of opposition
    // figures 2020-2024; Argentina 2017 property-rights reforms (positive).
    id: "property_rights_change",
    label: "Property rights change",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg"],
    halfLifeDays: 365,
  },

  // --- Corruption Control (v2 adds) ---
  {
    // V-Dem v2juacgr (whistleblower protections); FH C-3.
    // Real-world: EU Whistleblower Directive 2019 (positive);
    // US 2024 prosecutions of intelligence-community whistleblowers
    // (negative); UK 2023 Public Interest Disclosure changes.
    id: "whistleblower_protection_change",
    label: "Whistleblower protection change",
    dimension: "corruption_control",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 365,
  },
  {
    // FH C-3.
    // Asset-disclosure requirements for officials, beneficial-ownership
    // registries, financial-disclosure regimes. Real-world: Russia
    // 2017 narrowing of official asset declarations; UK Companies
    // House beneficial-ownership 2016 (positive); EU 5AMLD 2018
    // (positive); India election-bond opacity 2018 (negative,
    // overturned 2024).
    id: "financial_disclosure_change",
    label: "Asset / financial disclosure requirement change",
    dimension: "corruption_control",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "low_pos", "moderate_pos"],
    halfLifeDays: 365,
  },

  // --- Stability (v2 adds) ---
  {
    // Polity interregnum (-88) and partial-transition codings; CCP
    // "constitutional moments" literature; ACLED strategic-developments
    // `Other`. Sub-coup discontinuities — institutional deadlock or
    // partial breakdown without military takeover or full state collapse.
    // Real-world: Sri Lanka 2022 (palace storm + Rajapaksa flight +
    // peaceful constitutional succession); Peru 2022 Castillo
    // dissolution attempt; Israel 2023 judicial-overhaul standoff.
    // This is the category that catches the Sri Lanka case from
    // backtesting that revealed this gap.
    id: "constitutional_crisis",
    label: "Constitutional crisis without coup",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    // Distinct from coup. Parliamentary mechanism for replacing
    // governments — usually low-magnitude (routine in Westminster
    // systems) but can register larger when chronic (Italy 1990s,
    // Belgium 2010-11 540-day stalemate). Real-world: UK 2022
    // Truss/Sunak transition; Belgium 2010 record stalemate;
    // Netherlands 2023 government collapse over migration.
    id: "government_collapse",
    label: "Government collapse via no-confidence / coalition breakdown",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg"],
    halfLifeDays: 90,
  },
  {
    // ACLED strategic-developments `Non-violent transfer of territory`;
    // Polity territorial composition tracking.
    // Distinct from armed_conflict when largely peaceful. Includes
    // independence referendums (Quebec 1995, Scotland 2014, Catalonia
    // 2017), unrecognised declarations (Catalonia 2017), and
    // separation processes (UK Brexit 2016-20, Sudan-South Sudan 2011).
    id: "secession_or_territorial_dispute",
    label: "Secession or territorial dispute event",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 365,
  },
  {
    // ACLED `Riots: Mob violence`, `Violence against civilians: Attack`
    // (when partisan-motivated). Distinct from protest_crackdown
    // (state-on-civilian) and from armed_conflict (organised armed
    // groups). Inter-partisan, election-period violence. Real-world:
    // Kenya 2007-08; Nigeria 2023 election-period clashes; Pakistan
    // 2024 PTI rallies + state response.
    id: "electoral_violence",
    label: "Electoral violence (sub-armed-conflict threshold)",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg"],
    halfLifeDays: 90,
  },
  {
    // Stability-side mirror of `negotiated_transition` (democratic_quality).
    // Pacted transitions out of authoritarianism — the de-escalation
    // of a previously-conflictual regime situation. Real-world:
    // Spain 1976 Pacto de la Moncloa (stability stabiliser); South
    // Africa 1990-94; Northern Ireland Good Friday 1998 stability
    // dimension (Good Friday is also peace_agreement_signed but the
    // negotiated-transition framing applies).
    id: "negotiated_transition_stability",
    label: "Pacted regime transition (stability-side)",
    dimension: "stability",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 365,
  },
  {
    // Polity -66 (foreign occupation/imposition).
    // Real-world: Iraq 2003-11 US occupation; Afghanistan 2001-21
    // ISAF; multiple OPT subsets; partial coverage of Crimea 2014+
    // and Ukraine occupied territories 2022+.
    id: "foreign_occupation",
    label: "Foreign occupation or imposition",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 730,
  },
];

export const EVENT_CATEGORY_INDEX: Record<string, EventCategory> =
  Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): EventCategory | null {
  return EVENT_CATEGORY_INDEX[id] ?? null;
}

export function halfLifeFor(categoryId: string): number {
  return EVENT_CATEGORY_INDEX[categoryId]?.halfLifeDays ?? 90;
}

export const DELTA_LOWER_BOUND = -15;
export const DELTA_UPPER_BOUND = 10;
export const SCORE_WINDOW_DAYS = 365;
