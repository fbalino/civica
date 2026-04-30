# Civica Pulse Taxonomy v2 — Gap Analysis

**Status:** proposal under review · do not implement until approved
**Author:** Phase 5.8 closeout review (2026-04-30)
**Predecessor:** `src/lib/pulse/v2/taxonomy.ts` (30 categories, locked
2026-04-29 per commit `5dbd8c3` — see "TAXONOMY DECISION" comment)
**Backtest signal triggering this review:** Sri Lanka 2022 partial
(stability dimension empty — no current category fits a constitutional
crisis without coup or armed conflict)

---

## Why this exists

The Sri Lanka 2022 backtest partial revealed that the current 30-category
taxonomy has at least one structural gap. Patching that single category
without auditing the full theoretical space would set up a pattern of
ad-hoc additions every time a new edge case surfaces. Within 12-24 months
the taxonomy would be a Frankenstein of accumulated patches with no
coherent theoretical scaffolding.

This document does the principled review **once** before any v2 work
ships, derives candidate categories from established political-science
frameworks rather than from individual cases, and produces an explicit
covered / partial / uncovered status for every theoretical event class.

The Pulse Beta launch readiness is conditional on a complete taxonomy,
not on hitting 9 / 10 backtests with the current one.

---

## Frameworks consulted

| Framework | Purpose in this review | What it gives us |
|---|---|---|
| **V-Dem (Varieties of Democracy)** Liberal Democracy index components and mid-level indicators | Comprehensive institutional taxonomy of democratic governance — what V-Dem measures, the Pulse should be able to register a *change* in. | Electoral, liberal, civic-society, judicial, executive-constraints, civil-liberties sub-indicators (~70 mid-level indicators). |
| **ACLED** event-type taxonomy | Authoritative event-level vocabulary for political violence + protest + strategic developments. | Six top-level event types and ~25 sub-event types covering battles, violence against civilians, riots, protests, explosions/remote violence, strategic developments. |
| **Comparative Constitutions Project (CCP)** | Constitutional change typologies — what constitutional events can move governance dimensions. | Amendment vs replacement, scope (rights / institutional / federal structure), procedural rigidity, de jure vs de facto provisions. |
| **Center for Systemic Peace — Polity Project** regime change codings | Regime-transition vocabulary: democratization, autocratization, interregnum, transition, anarchy, foreign-imposition. | Polity transition codes, durability, parcomp (participation competitiveness) tracking. |
| **Freedom House — Freedom in the World** indicator categories | Civil-liberties + political-rights checklist with 25 indicators across two scores. | Granular civil-liberties categories: religious freedom, academic freedom, property rights, equal treatment, freedom of movement, etc. |

These five are the most-cited indices in cross-national governance
research. Together they give nearly-complete coverage of the theoretical
space the Pulse should be able to detect movement in.

---

## Approach

For each of the four CI dimensions plus Stability, this review:

1. Lists the relevant indicator categories from each framework.
2. Maps each theoretical category to the closest existing Pulse v1
   category.
3. Marks the status as one of:
   - **Covered** — existing category fully addresses the theoretical category.
     No action.
   - **Partial** — existing category overlaps but does not fully cover.
     Needs a sibling category for distinct sub-cases. Action: propose new
     category with theoretical justification.
   - **Uncovered** — no existing category fits. Action: propose new
     category with theoretical justification.
4. For Partial / Uncovered categories, defines the proposed addition with:
   definition, framework citation, real-world example, proposed dimension,
   proposed severity tiers, proposed half-life.

**Constraint applied throughout:** if a candidate has >70% conceptual
overlap with an existing category, it is flagged for discussion rather
than added. Taxonomic bloat is treated as a real failure mode.

---

## Dimension 1: Democratic Quality

Theoretical event space drawn from V-Dem (Electoral Democracy Index
sub-indicators), Polity (regime transition codings), Freedom House
(Political Rights indicators A and B), and CCP (electoral provisions in
constitutions).

### V1 categories on this dimension

`fair_election`, `flawed_election`, `election_cancellation`,
`constitutional_override_electoral`, `mass_disenfranchisement`,
`peaceful_transfer`, `term_extension`.

### Candidate gaps

| # | Candidate | Status | Notes |
|---|---|---|---|
| D1 | **Disputed election outcome** (close + irregularity claims, recount/court challenges) | **Uncovered** | Distinct from `flawed_election` (clearly compromised) and from `fair_election` (clean). Sits in the middle. V-Dem `v2elirreg` (election irregularities) sub-indicator. FH A-1, A-2. |
| D2 | **Referendum manipulation** | **Partial** | `flawed_election` covers it conceptually but referendums have distinct dynamics (binary; often constitutional-stakes). CCP amendment-procedure tracking. Recommend keeping under `flawed_election` unless we see referendum-specific use cases — not in spec test set. **Flag for discussion, do not add yet.** |
| D3 | **Gerrymandering / electoral boundary changes** | **Uncovered** | Not equivalent to `mass_disenfranchisement` (which is post-fact). Structural pre-election change. V-Dem `v2elboycot`, `v2elaccept` sub-indicators. FH A-3 ("electoral framework fair"). |
| D4 | **Candidate disqualification** | **Uncovered** | Distinct from `mass_disenfranchisement` (voters) — this targets opposition figures. V-Dem `v2psbars`, `v2psoppaut`. FH B-1. Hungary 2010 case actually had several events of this kind we could not classify cleanly. |
| D5 | **Electoral-law access changes** (voter ID, registration, polling-station closures) | **Uncovered** | Pre-election structural changes affecting who can vote. Distinct from `mass_disenfranchisement` (post-fact removal of mandates). V-Dem `v2xeg_eqaccess`, `v2elsuffrage`. FH A. |
| D6 | **Disputed referendum outcome** | **Partial** | Subset of D1 / D2. Do not add. |
| D7 | **Local / sub-national election integrity** | **Uncovered** | Not equivalent to national-election categories — pertains to mayoral, regional, prefectural elections. Often the first venue for backsliding (cf. Turkey 2019, Russia 2010s). V-Dem `v2ellocelc`, `v2elsrgel`. **Flag for discussion** — could overlap with `flawed_election` >70%. |
| D8 | **Pacted / negotiated regime transition** (away from authoritarianism) | **Uncovered** | Distinct from `peaceful_transfer` (normal democratic alternation) and from `fair_election` (which is the event that follows). This is the *agreement to transition* — Spain 1976, South Africa 1991-94, Chile 1988-90. Polity transition coding. **Add as positive event.** |
| D9 | **Constitutional referendum on regime change** | **Partial** | Could be `flawed_election` (negative) or `peaceful_transfer` (positive) depending on outcome. Specific dynamics (one-time, no incumbent campaign rules) make it slightly distinct. **Flag for discussion.** |

**Add to v2:** D1 (`disputed_election`), D3 (`gerrymandering`),
D4 (`candidate_disqualification`), D5 (`electoral_access_change`),
D8 (`negotiated_transition`).

**Flag for discussion:** D2 (referendum_manipulation), D7 (subnational_election).

---

## Dimension 2: Rule of Law

Theoretical event space drawn from V-Dem (Liberal Component / Rule of
Law sub-indicators), Freedom House (Civil Liberties F1-F4), ACLED
(strategic developments — arrests of high-level figures), and CCP
(institutional provisions).

### V1 categories on this dimension

`judicial_purge`, `executive_constitutional_override`,
`anticorruption_conviction`, `judicial_independence_expansion`,
`judicial_independence_rollback`, `martial_law`.

### Candidate gaps

| # | Candidate | Status | Notes |
|---|---|---|---|
| L1 | **Prosecutorial independence events** (firing of independent prosecutors, replacement with politically aligned figures; or strengthening of prosecutorial independence) | **Uncovered** | Distinct institutional layer from judiciary. V-Dem `v2juncind`, FH F-1. Real-world: US firings of US Attorneys (2017, 2025), Poland 2015-2023 prosecutor-general consolidation. |
| L2 | **Executive defiance of court rulings** | **Uncovered** | Distinct from `executive_constitutional_override` (which is a constitutional-level override). This is specifically refusing to comply with binding judicial decisions. V-Dem `v2jucomp` (compliance with judiciary). FH F-1. Real-world: Israel judicial-overhaul standoff 2023, multiple Trump-Pence administration cases 2017-2024. |
| L3 | **Police accountability changes** (civilian-oversight expansions or restrictions) | **Uncovered** | V-Dem `v2clrspct`, `v2clkill`. FH F-3 (freedom from violence). Real-world: George Floyd protests prompted formal civilian-oversight changes in many cities; Russia 2022-23 narrowed police accountability. |
| L4 | **Detention conditions changes** (length without trial, solitary, torture allegations institutionalised or curbed) | **Uncovered** | V-Dem `v2cltort`, `v2clkill`. FH F-3. Real-world: ICE detention condition reports; Egypt 2013 "law on terror" expanded pretrial detention windows. |
| L5 | **Constitutional court abolition or replacement** | **Partial** | `judicial_purge` covers court restructuring. Constitutional courts specifically (where they exist as separate bodies) are a sharper category. CCP institutional-tracking. **Flag for discussion** — likely >70% overlap with `judicial_purge`. |
| L6 | **Independent oversight body abolition or curtailment** (auditor-general, ombudsman, anti-corruption agency) | **Partial** | `anticorruption_dismantling` (corruption_control) covers anti-corruption agency cases. Auditor-general / ombudsman are distinct rule-of-law layers. **Add as new category (for non-anti-corruption oversight).** |
| L7 | **Use of state of emergency / declared emergency outside martial law** | **Partial** | `martial_law` covers military-tribunal version. Civilian-emergency declarations (COVID, terrorism, civil disturbance) are distinct — they suspend rights without invoking military jurisdiction. V-Dem `v2regsupgroups_ord` proxies. FH F. **Add as new category** — Sri Lanka 2022 Apr 1 emergency was actually classified as `martial_law`, which was wrong. |
| L8 | **Habeas corpus suspension specifically** | **Partial** | Subset of L7. Do not add. |
| L9 | **Politically motivated prosecutions of opposition figures** | **Partial** | `judicial_independence_rollback` covers institutional aspect. Specific use of prosecution against named opposition figures (Lula 2018, Navalny 2021, Khan 2023) is sometimes more prosecution-side than judiciary-side. **Add as new category targeted at the prosecutorial use.** |

**Add to v2:** L1 (`prosecutorial_independence`),
L2 (`executive_court_defiance`), L3 (`police_accountability`),
L4 (`detention_conditions`), L6 (`oversight_body_dismantling` — non-anti-corruption),
L7 (`emergency_declaration`), L9 (`opposition_prosecution`).

**Flag for discussion:** L5 (constitutional_court_abolition).

---

## Dimension 3: Rights & Freedoms

Theoretical event space drawn from V-Dem (Liberties / Civil Society sub-indicators),
Freedom House (Civil Liberties D, E, G), ACLED (violence against civilians;
protests).

### V1 categories on this dimension

`journalist_arrest`, `media_shutdown`, `protest_crackdown`,
`systematic_crackdown`, `mass_detention`, `press_freedom_expansion`,
`assembly_rights_expansion`, `internet_shutdown`.

### Candidate gaps

| # | Candidate | Status | Notes |
|---|---|---|---|
| R1 | **Religious freedom changes** (state-sanctioned restrictions on or expansions of religious practice) | **Uncovered** | V-Dem `v2clrelig`. FH D-2. Real-world: Russia 2016 Yarovaya laws; India CAA 2019; Iran post-2022. **Add (both negative and positive tiers).** |
| R2 | **Minority group rights changes** (ethnic, linguistic, religious minorities — beyond systematic_crackdown) | **Partial** | `systematic_crackdown` covers active oppression. Distinct from law-level changes affecting minority rights (citizenship-by-descent, language laws). V-Dem `v2clpolcl`, `v2pepwrses`. FH G-4. **Add as new category for de jure changes.** |
| R3 | **LGBT rights changes** | **Uncovered** | V-Dem `v2clrgunev` (equal treatment under law). FH G-4. Real-world: Hungary 2021 anti-LGBT law; Brazil 2025 marriage codification. **Add (both directions).** |
| R4 | **Surveillance regime expansion or restriction** | **Uncovered** | V-Dem `v2cldiscm`, `v2cldiscw` (private discussion freedom). FH D-4. Real-world: NSA reforms post-Snowden; UK Investigatory Powers Act 2016. |
| R5 | **Internet content restriction beyond shutdowns** (content blocking, throttling, DPI deployment, content laws) | **Partial** | `internet_shutdown` is total shutdown. Content-level restrictions are distinct and more common. V-Dem `v2smgovsm` (gov regulation of social media). FH D-1. **Add as new category.** |
| R6 | **Academic freedom changes** | **Uncovered** | V-Dem has full `v2cafres`, `v2cacontent` indicators specifically for this. FH D-3. Real-world: Hungary 2017 CEU forced relocation; Turkey 2016 academic dismissals. **Add (both directions).** |
| R7 | **NGO / civil society group restrictions** (registration laws, foreign-funding restrictions, dissolution orders) | **Partial** | `systematic_crackdown` overlaps. NGO-specific legal regimes are more structural — Russia "foreign agent" 2012/2022, Hungary "Stop Soros" 2018, India FCRA 2020. V-Dem `v2cseeorgs`. **Add as new category for de jure restrictions.** |
| R8 | **Freedom of movement restrictions / expansions** (travel bans, exit visas, internal passport requirements) | **Uncovered** | FH G-1. Real-world: Russia exit-visa for mobilisation 2022; US travel-ban EOs 2017. **Add (both directions).** |
| R9 | **Assembly-rights restrictions** (vs `assembly_rights_expansion` already on the positive side) | **Partial** | `protest_crackdown` covers state response. De jure restrictions (permit regimes, public-order acts) are distinct. **Add `assembly_rights_restriction`** — fills the negative side of an asymmetric category pair. |
| R10 | **Equality-of-opportunity changes** (discrimination law, anti-discrimination enforcement) | **Partial** | FH G-4. **Flag for discussion** — could overlap with R3 (LGBT) and R2 (minority) >70%. |
| R11 | **Targeted political violence / assassinations** (assassinations of journalists, activists, opposition figures) | **Partial** | `journalist_arrest` is specifically arrests; doesn't cover killings. ACLED `Violence against civilians: Attack` sub-event-type. V-Dem `v2caviol`. **Add as new category** — Khashoggi 2018, Marielle Franco 2018, Roman Protasevich detention 2021. |
| R12 | **Property rights changes** (expropriation, asset seizures targeting groups) | **Uncovered** | FH G-2. V-Dem `v2clprptyw`, `v2clprptym`. Real-world: Venezuelan expropriations 2007-2019; Belarusian asset seizures of opposition figures 2020-2024. **Add.** |
| R13 | **Sexual / gender-based violence as policy** | **Partial** | `systematic_crackdown` covers it but loses signal. ACLED has specific `Sexual violence` sub-event-type. **Flag for discussion** — likely >70% overlap with `systematic_crackdown`. |

**Add to v2:** R1 (`religious_freedom_change`),
R2 (`minority_rights_change`), R3 (`lgbt_rights_change`),
R4 (`surveillance_regime_change`), R5 (`internet_content_restriction`),
R6 (`academic_freedom_change`), R7 (`ngo_restriction`),
R8 (`movement_freedom_change`), R9 (`assembly_rights_restriction`),
R11 (`political_assassination`), R12 (`property_rights_change`).

**Flag for discussion:** R10 (equality_of_opportunity), R13 (sexual_violence_policy).

---

## Dimension 4: Corruption Control

Theoretical event space drawn from V-Dem (Corruption Index sub-indicators),
Freedom House (Political Rights C-2, C-3), Transparency International CPI
sources, ACLED strategic-developments arrests.

### V1 categories on this dimension

`corruption_conviction`, `corruption_scandal`, `anticorruption_law`,
`anticorruption_dismantling`.

### Candidate gaps

| # | Candidate | Status | Notes |
|---|---|---|---|
| C1 | **Whistleblower protection changes** | **Uncovered** | V-Dem `v2juacgr`. FH C-3. Real-world: US 2024 prosecutions of whistleblowers; EU Whistleblower Directive 2019. **Add (both directions).** |
| C2 | **Asset disclosure / financial transparency requirement changes** | **Uncovered** | FH C-3. Real-world: Russia 2017 narrowing official-asset declarations; multiple countries' beneficial-ownership registry requirements. **Add (both directions).** |
| C3 | **Procurement / public-finance integrity events** (rigged contracts exposed, transparency reforms) | **Partial** | `corruption_scandal` covers exposures. Reform side is distinct from `anticorruption_law` (criminal code) — procurement is administrative. **Flag for discussion.** |
| C4 | **Tax-haven / illicit-finance enforcement** | **Partial** | International dimension. **Flag for discussion** — Pulse is country-level by design; international enforcement is awkward to attribute. |
| C5 | **Public-finance auditor independence changes** | **Partial** | Overlaps with L6 (oversight body) — should be classified there. |
| C6 | **Major regulatory-capture event** (industry lobby visible erosion of oversight) | **Uncovered** | V-Dem `v2regimpgroup`. Real-world: Brazil meat-industry corruption 2017; US 2017 financial-deregulation. **Flag for discussion** — hard to event-trigger; usually a slow trend not a discrete event. |

**Add to v2:** C1 (`whistleblower_protection_change`),
C2 (`financial_disclosure_change`).

**Flag for discussion:** C3 (procurement_integrity), C4 (illicit_finance), C6 (regulatory_capture).

---

## Dimension 5: Stability

Theoretical event space drawn from ACLED (battles, riots, strategic
developments), Polity (regime transitions, anarchy, foreign occupation),
and CCP (constitutional crisis typologies).

### V1 categories on this dimension

`armed_conflict`, `peace_agreement_signed`, `peace_agreement_implemented`,
`coup`, `state_collapse`.

### Candidate gaps

| # | Candidate | Status | Notes |
|---|---|---|---|
| S1 | **Constitutional crisis without coup** (institutional deadlock or partial breakdown without military takeover or full state collapse) | **Uncovered** | This is the Sri Lanka 2022 case. Polity codes interregnum (-88) and transition (+88) for sub-coup discontinuities. CCP "constitutional moments" literature. ACLED strategic-developments `Other`. Real-world: Sri Lanka 2022, Peru 2022 Castillo dissolution attempt, Israel 2023 judicial-overhaul standoff. **Add.** |
| S2 | **Government collapse via no-confidence** (parliamentary mechanism — distinct from coup) | **Partial** | Routine no-confidence in Westminster systems is normal democratic functioning; doesn't move stability negatively much. Major government collapses (Italy 1990s, Belgium 2010-11 540-day stalemate) are distinct. **Add as low-magnitude category** — can also code positive when system handles it cleanly. |
| S3 | **Secession or territorial-dispute event** (referendum, declaration, unrecognised independence) | **Uncovered** | Distinct from `armed_conflict` when largely peaceful (Quebec, Catalonia, Scotland, Brexit). Polity tracks territorial composition changes. ACLED strategic-developments `Non-violent transfer of territory`. **Add.** |
| S4 | **Electoral violence below armed-conflict threshold** (clashes between partisan groups, election-period intimidation) | **Partial** | `protest_crackdown` is state-on-civilian. Partisan inter-group violence is distinct. ACLED `Riots: Mob violence`, `Violence against civilians: Attack`. Real-world: Kenya 2007-08, Nigeria 2023, Pakistan 2024. **Add.** |
| S5 | **Negotiated regime transition (positive on stability)** | **Partial** | This is the *positive* version of S1. Pacted transitions out of authoritarianism (Spain 1976, South Africa 1990-94) — currently no category. D8 covers the democratic-quality side; the stability side is the de-escalation of a previously-conflictual situation. **Add as positive on stability.** |
| S6 | **Peaceful constitutional succession** | **Covered** | This is what `peaceful_transfer` already does, but on Democratic Quality. Adding a stability-side mirror is >70% overlap. **Do not add — already covered.** |
| S7 | **Foreign occupation / imposition** (Polity -66) | **Uncovered** | Polity tracks this explicitly. Real-world: Iraq 2003-2011; Afghanistan 2001-2021; multiple OPT subsets. **Add.** |
| S8 | **Anarchy declaration / loss of monopoly on violence** (Polity -77) | **Partial** | `state_collapse` covers severe end. Polity distinguishes anarchy (no governing authority) from state collapse (formal loss of statehood). **Flag for discussion** — likely >70% overlap with `state_collapse`. |
| S9 | **Foreign-imposed regime change** (occupation-led government formation) | **Partial** | Subset of S7. Do not add. |
| S10 | **Mass migration / refugee outflow tipping point** | **Partial** | Often a *consequence* of stability erosion rather than a stability event itself. **Flag for discussion** — risk of double-counting with armed_conflict. |
| S11 | **Successful coup attempt by elected leader** (self-coup / autogolpe) | **Partial** | `executive_constitutional_override` (rule_of_law) and `term_extension` (democratic_quality) cover most cases. Stability rupture component might warrant separate code. **Flag for discussion** — already cascaded across two dimensions. |

**Add to v2:** S1 (`constitutional_crisis`), S2 (`government_collapse`),
S3 (`secession_or_territorial_dispute`), S4 (`electoral_violence`),
S5 (`negotiated_transition_stability` — positive side of D8),
S7 (`foreign_occupation`).

**Flag for discussion:** S8 (anarchy declaration), S10 (mass migration), S11 (self-coup).

---

## Summary

### Adds proposed (29 categories)

By dimension:

| Dimension | New categories | Count |
|---|---|---|
| Democratic Quality | `disputed_election`, `gerrymandering`, `candidate_disqualification`, `electoral_access_change`, `negotiated_transition` | 5 |
| Rule of Law | `prosecutorial_independence`, `executive_court_defiance`, `police_accountability`, `detention_conditions`, `oversight_body_dismantling`, `emergency_declaration`, `opposition_prosecution` | 7 |
| Rights & Freedoms | `religious_freedom_change`, `minority_rights_change`, `lgbt_rights_change`, `surveillance_regime_change`, `internet_content_restriction`, `academic_freedom_change`, `ngo_restriction`, `movement_freedom_change`, `assembly_rights_restriction`, `political_assassination`, `property_rights_change` | 11 |
| Corruption Control | `whistleblower_protection_change`, `financial_disclosure_change` | 2 |
| Stability | `constitutional_crisis`, `government_collapse`, `secession_or_territorial_dispute`, `electoral_violence`, `negotiated_transition_stability`, `foreign_occupation` | 6 |
| **Total adds** | | **31** |

Wait — that's 31, not 29. Re-count: 5 + 7 + 11 + 2 + 6 = **31 new categories**, taking the taxonomy from 30 → 61 total. (Earlier "29 adds" was a typo; the correct total is 31.)

### Flagged for discussion (not added without approval)

D2 referendum_manipulation · D7 subnational_election ·
L5 constitutional_court_abolition · R10 equality_of_opportunity ·
R13 sexual_violence_policy · C3 procurement_integrity ·
C4 illicit_finance · C6 regulatory_capture · S8 anarchy_declaration ·
S10 mass_migration · S11 self_coup_subcategory

11 flagged. Each has documented overlap rationale; expand only after
discussion with reviewers.

### Removed or renamed

**None.** Per the constraint on this work, v2 is additive only. If the
review surfaces a need to remove or rename existing categories
(e.g., consolidate `martial_law` and `emergency_declaration`), that
becomes a separate v2.1 conversation.

---

## Theoretical justification — the principled basis

Why these 31 specifically, and why the 11 flagged ones don't make the cut:

1. **Each addition cites at least one of the five frameworks** as its
   theoretical source. No additions derive from individual backtest cases
   alone.
2. **Each addition fills a specific institutional layer** that V-Dem,
   Freedom House, Polity, ACLED, or CCP measures separately. Pulse claims
   to track real-time movement on the institutional dimensions those
   indices measure annually; gaps in our taxonomy that correspond to
   gaps relative to those indices are real coverage failures.
3. **The 11 flagged candidates either overlap >70% with existing
   categories** (and would therefore add taxonomic clutter without new
   signal) **or trigger as slow trends rather than discrete events**
   (and don't fit the event-driven Pulse model).
4. **No additions extend the dimension set** beyond the existing
   four CI dimensions plus stability. The taxonomy expands within the
   established structure.

### What this taxonomy will and won't catch

After v2 goes live, the Pulse will be able to register:
- Pre-election structural moves (D3, D4, D5) that V-Dem's annual
  refresh would catch but with 12-18 month lag.
- Sub-judicial rule-of-law movements (L1 prosecutorial,
  L2 court-defiance, L3 police, L4 detention) that current V-Dem
  Liberal-Component sub-indicators measure but the v1 taxonomy folded
  into "judicial independence rollback" generically.
- Civil-liberties movement at the granularity Freedom House publishes
  in its country reports (R1 religious, R3 LGBT, R6 academic,
  R8 movement, R12 property), rather than only the broad
  `systematic_crackdown` umbrella.
- Sub-coup constitutional crises (S1, S2, S3) that Polity's transition
  codings distinguish from full regime ruptures.

The taxonomy still won't catch:
- Slow-trend events (regulatory capture, gradual press-freedom
  erosion), which require quarterly index updates rather than
  event-driven Pulse classification. These are CI signals, not Pulse
  signals.
- International / cross-border events whose attribution to a single
  country is awkward (illicit finance, cross-border conflict spillover).
- Cultural / social-attitude shifts that don't manifest as discrete
  policy or institutional events.

These remaining gaps are documented and are not v2 candidates because
the Pulse's discrete-event design choice is itself a constraint —
slow trends are appropriately handled by the structural CI.

---

## Decay half-lives — proposed

The following half-lives mirror existing categories' patterns
(structural changes 365d, episodic 60-180d, transitional 90d):

| Category | Half-life (days) | Reasoning (mirrors v1 pattern) |
|---|---|---|
| `disputed_election` | 90 | Episodic; resolves through court process |
| `gerrymandering` | 365 | Structural change, multi-cycle effect |
| `candidate_disqualification` | 180 | Mid-duration; effect lasts through one electoral cycle |
| `electoral_access_change` | 365 | Structural |
| `negotiated_transition` | 365 | Structural-positive, year-long stabilising effect |
| `prosecutorial_independence` | 180 | Personnel-level; reverses with leadership change |
| `executive_court_defiance` | 90 | Episodic but signals deeper rupture |
| `police_accountability` | 180 | Mid-duration |
| `detention_conditions` | 180 | Mid-duration |
| `oversight_body_dismantling` | 365 | Structural |
| `emergency_declaration` | 90 | Episodic; declarations expire |
| `opposition_prosecution` | 180 | Mid-duration |
| `religious_freedom_change` | 365 | Structural |
| `minority_rights_change` | 365 | Structural |
| `lgbt_rights_change` | 365 | Structural |
| `surveillance_regime_change` | 365 | Structural |
| `internet_content_restriction` | 180 | Reversible mid-duration |
| `academic_freedom_change` | 365 | Structural |
| `ngo_restriction` | 365 | Structural |
| `movement_freedom_change` | 180 | Mid-duration; varies by mechanism |
| `assembly_rights_restriction` | 180 | Mirrors `assembly_rights_expansion` (180d) |
| `political_assassination` | 90 | Episodic but high-severity |
| `property_rights_change` | 365 | Structural |
| `whistleblower_protection_change` | 365 | Structural |
| `financial_disclosure_change` | 365 | Structural |
| `constitutional_crisis` | 180 | Mid-duration; resolves toward stability or rupture |
| `government_collapse` | 90 | Episodic (parliamentary systems handle routinely) |
| `secession_or_territorial_dispute` | 365 | Structural |
| `electoral_violence` | 90 | Episodic; concentrated around election dates |
| `negotiated_transition_stability` | 365 | Structural-positive |
| `foreign_occupation` | 730 | Multi-year (mirrors `state_collapse` 730d) |

---

## Severity tier rules — proposed

Each new category proposes the same allowed-tier shape as its closest v1
relatives:

| Category | Allowed tiers |
|---|---|
| `disputed_election` | low_neg, moderate_neg |
| `gerrymandering` | low_neg, moderate_neg |
| `candidate_disqualification` | moderate_neg, severe_neg |
| `electoral_access_change` | low_neg, moderate_neg, low_pos, moderate_pos (bidirectional) |
| `negotiated_transition` | moderate_pos, high_pos |
| `prosecutorial_independence` | moderate_neg, severe_neg, moderate_pos |
| `executive_court_defiance` | severe_neg, catastrophic_neg |
| `police_accountability` | low_neg, moderate_neg, low_pos, moderate_pos |
| `detention_conditions` | low_neg, moderate_neg, severe_neg, low_pos, moderate_pos |
| `oversight_body_dismantling` | severe_neg |
| `emergency_declaration` | low_neg, moderate_neg, severe_neg |
| `opposition_prosecution` | moderate_neg, severe_neg |
| `religious_freedom_change` | moderate_neg, severe_neg, moderate_pos |
| `minority_rights_change` | moderate_neg, severe_neg, moderate_pos |
| `lgbt_rights_change` | low_neg, moderate_neg, low_pos, moderate_pos |
| `surveillance_regime_change` | low_neg, moderate_neg, low_pos, moderate_pos |
| `internet_content_restriction` | low_neg, moderate_neg |
| `academic_freedom_change` | moderate_neg, severe_neg, moderate_pos |
| `ngo_restriction` | moderate_neg, severe_neg |
| `movement_freedom_change` | low_neg, moderate_neg, low_pos, moderate_pos |
| `assembly_rights_restriction` | moderate_neg, severe_neg |
| `political_assassination` | severe_neg, catastrophic_neg |
| `property_rights_change` | low_neg, moderate_neg, severe_neg |
| `whistleblower_protection_change` | low_neg, moderate_neg, low_pos, moderate_pos |
| `financial_disclosure_change` | low_neg, moderate_neg, low_pos, moderate_pos |
| `constitutional_crisis` | moderate_neg, severe_neg |
| `government_collapse` | low_neg, moderate_neg |
| `secession_or_territorial_dispute` | moderate_neg, severe_neg |
| `electoral_violence` | low_neg, moderate_neg, severe_neg |
| `negotiated_transition_stability` | moderate_pos, high_pos |
| `foreign_occupation` | severe_neg, catastrophic_neg |

---

## Re-run of 10 backtest cases under v2 — predicted outcomes

The expanded taxonomy must not change any of the 9 currently-passing
cases (over-correction is a failure mode). Sri Lanka should pass cleanly
via new categories. Predicted outcomes (subject to actual run):

| Case | v1 verdict | v2 prediction | New categories likely to fire |
|---|---|---|---|
| Myanmar 2021 | pass | **pass (unchanged)** | `opposition_prosecution` may catch the Suu Kyi prosecutions instead of `judicial_independence_rollback` — same dimension, similar severity. |
| Niger 2023 | pass | **pass (unchanged)** | None expected to shift dimensional totals. |
| Tunisia 2021 | pass | **pass (unchanged)** | Possible: 2021-08-24 emergency event reclassifies as `emergency_declaration` (rule_of_law) instead of `term_extension` (democratic_quality). Could shift dimensional totals — risk to monitor. |
| Afghanistan 2021 | pass | **pass (likely unchanged)** | `religious_freedom_change` could catch some events but main signals unchanged. |
| Sri Lanka 2022 | partial | **pass** | `constitutional_crisis` (stab) catches Jul 9 palace storm + government collapse. `emergency_declaration` (rol) catches Apr 1 emergency more cleanly. |
| Brazil 2023 | pass | **pass (unchanged)** | None expected to shift. |
| Hungary 2010 | pass | **pass (unchanged)** | `gerrymandering` could catch the electoral law. `oversight_body_dismantling` could catch CC/judiciary changes. Same dimensions. |
| Ethiopia 2020 | pass | **pass (unchanged)** | `political_assassination`, `electoral_violence` not expected to fire. |
| Colombia 2016 | pass | **pass (unchanged)** | None expected to shift. |
| Poland 2023 | pass | **pass (unchanged)** | None expected to shift. |

**Risk to monitor:** Tunisia's rule-of-law and democratic-quality
totals could shift if `emergency_declaration` reclassifies the Aug 24
event. Mitigation: in v2 backtest run, verify Tunisia still shows
both dimensions ≥ severe threshold.

---

## Open questions for the reviewer

1. **Tunisia regression risk.** If `emergency_declaration` siphons
   off the Aug 24 event from `term_extension`, will the cascade still
   hit severe on democratic_quality? If not, do we accept Tunisia
   becoming partial as the price of more granular emergency tracking?

2. **Asymmetric category shape.** Several proposed categories are
   bidirectional (`electoral_access_change`, `lgbt_rights_change`,
   `whistleblower_protection_change`). The v1 convention was mostly
   asymmetric (e.g., `assembly_rights_expansion` positive-only,
   `protest_crackdown` negative-only). Should v2 collapse symmetric
   pairs into single bidirectional categories or maintain the
   asymmetric convention?

3. **Subnational events.** D7 (subnational election integrity) is
   flagged. Pulse currently treats every event as country-level. Adding
   subnational signal would also require subnational-attribution
   schema. Worth a separate proposal?

4. **Self-coup as separate category.** S11 (autogolpe / self-coup)
   already cascades through `executive_constitutional_override` (rol)
   and `term_extension` (dq). Does the stability rupture component
   warrant a separate category, or does the cascade do the job?

5. **Removed/renamed conversation.** The constraint here was additive
   only. After v2 ships, should we revisit:
   - `martial_law` vs `emergency_declaration` boundaries?
   - `mass_detention` (currently freedom_rights) vs
     `opposition_prosecution` (proposed rule_of_law) vs
     `detention_conditions` (proposed rule_of_law) — three categories
     sharing conceptual overlap?

---

## Deliverables

- This document: `docs/taxonomy-v2-gap-analysis.md`
- Proposed taxonomy: `src/lib/pulse/v2/taxonomy.ts.proposed`
  (additive — does not overwrite the live taxonomy)

Awaiting reviewer approval before proceeding to:
1. Implementing v2 in `src/lib/pulse/v2/taxonomy.ts`
2. Re-running all 10 backtests under v2
3. Validating no regression on the 9 passing cases
4. Phase 5.10 cut-over decision
