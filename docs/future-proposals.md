# Civica Pulse — Future Proposals (post-v2.0)

**Status:** parking lot for items deliberately deferred
**Last updated:** 2026-04-30 (v2.0 launch)
**Re-evaluate:** after at least one quarter of v2.0 production data

---

## Why this document exists

Phase 5.8 closeout produced a top-down review of the Pulse taxonomy
(`docs/taxonomy-v2-gap-analysis.md`). v2.0 implemented 31 of 42
candidate categories. The remaining 11 were intentionally deferred
because each has a documented overlap risk with existing categories
or doesn&apos;t fit the discrete-event Pulse model.

This document carries those 11 candidates plus other deferred items
forward, so they don&apos;t get lost between sessions.

**Process:** when v2.0 has at least one quarter of production
classification data, revisit each item below with empirical evidence
about how the related v2 categories are actually used. Any item that
shows clear, separable signal in real classifications becomes a
candidate for v2.1.

---

## v2.1 candidates from the gap analysis

Numbering matches `docs/taxonomy-v2-gap-analysis.md`. Each item lists
the proposed category, the v2 category it overlaps with (the reason
for deferral), and the empirical question to answer with v2.0 data.

### Democratic Quality

**D2 — `referendum_manipulation`**
Overlaps with `flawed_election` &gt;70%. Referendums have distinct
dynamics (binary stakes, often constitutional) but most cases the
v1+v2 taxonomy cleanly handles via `flawed_election`.
*Empirical question:* are there v2.0-classified events tagged
`flawed_election` that involve referendums where reviewers feel the
binary nature changes the severity calculus?

**D7 — `subnational_election`**
Requires subnational attribution schema affecting database design,
country-page UI, and aggregation logic. Separate proposal, not a
taxonomy add.
*Empirical question:* deferred until subnational schema is in scope.
Track interest from researchers / users.

### Rule of Law

**L5 — `constitutional_court_abolition`**
Overlaps with `judicial_purge` &gt;70%. Court restructuring is the
common shape; specifically abolishing a constitutional court is a
narrower variant.
*Empirical question:* examine v2.0 events classified
`judicial_purge` to see whether constitutional-court-specific cases
warrant separate severity bounds (catastrophic vs severe).

### Rights & Freedoms

**R10 — `equality_of_opportunity`**
Overlaps with R2 (`minority_rights_change`) and R3 (`lgbt_rights_change`)
&gt;70%. Anti-discrimination law in practice usually targets specific
protected classes; the catch-all category would mostly fire when
those more-specific categories already do.
*Empirical question:* does v2.0 produce events that don&apos;t fit
either minority_rights_change or lgbt_rights_change but do involve
equality-of-opportunity legal change? E.g., disability rights,
women&apos;s reproductive rights when not LGBT-coded.

**R13 — `sexual_violence_policy`**
Overlaps with `systematic_crackdown` &gt;70%. Sexual violence as a
weapon of war / state policy currently classifies under the
systematic_crackdown umbrella.
*Empirical question:* are there events where reviewers explicitly
flag sexual violence as the defining feature and the
systematic_crackdown classification undersells the dimensional
impact? ACLED has a dedicated sub-event-type — worth re-evaluating
if event volume justifies separate signal.

### Corruption Control

**C3 — `procurement_integrity`**
Overlaps partially with `corruption_scandal` (when scandals exposed)
and `anticorruption_law` (when reforms enacted). Procurement-specific
events are typically captured by these existing categories.
*Empirical question:* are there procurement events that don&apos;t
fit either pattern? Especially asymmetric ones (transparency
reform without scandal).

**C4 — `illicit_finance` (cross-border)**
Pulse is country-level by design; international enforcement events
are awkward to attribute. Tax-haven crackdowns, beneficial-ownership
treaties, sanctions-related financial actions all involve multiple
jurisdictions.
*Empirical question:* deferred indefinitely. Re-evaluate only if
Pulse architecture moves toward country-pair or international
attribution.

**C6 — `regulatory_capture`**
Slow trend, not a discrete event. The Pulse&apos;s discrete-event
design choice is itself a constraint — regulatory capture
typically manifests over years, not in single events. CI handles
slow trends; Pulse handles shocks.
*Empirical question:* not applicable. This is a structural
mismatch with the Pulse model.

### Stability

**S8 — `anarchy_declaration`**
Overlaps with `state_collapse` &gt;70%. Polity distinguishes anarchy
(no governing authority, -77) from state collapse (formal loss of
statehood). The distinction is rare and the cases are usually
catastrophic enough that state_collapse fires regardless.
*Empirical question:* examine v2.0 events classified
`state_collapse` to see whether sub-cases of "no recognised
governing authority" but not "formal collapse" are present and
under-served.

**S10 — `mass_migration` tipping point**
Mass migration is typically a *consequence* of stability erosion
rather than a stability event itself. Risk of double-counting with
armed_conflict, state_collapse, and constitutional_crisis.
*Empirical question:* deferred. Worth revisiting if Civica adds an
explicit forced-migration data layer.

**S11 — `self_coup` separate category**
Already cascades through `executive_constitutional_override`
(rule_of_law) and `term_extension` (democratic_quality). Adding a
stability rupture component would be additive without obviously new
signal.
*Empirical question:* in v2.0 production data, how often do
self-coup events produce stability rupture distinct from the
rule-of-law and democratic-quality cascade? If rare, the cascade
handling is sufficient.

---

## v2.1 conversation: removals + renames

Per the v2.0 launch decision, the additive-only constraint held —
no v1 categories were renamed, removed, or rescoped. After v2.0
runs for at least one quarter, evaluate:

- **`martial_law` vs `emergency_declaration` boundaries.** v2 introduced
  `emergency_declaration` for civilian state-of-emergency declarations
  without military jurisdiction. The boundary is "is military jurisdiction
  invoked?". If real classifications show consistent confusion, consider
  either consolidating, renaming, or sharpening the disambiguation rule.

- **`mass_detention` vs `opposition_prosecution` vs `detention_conditions`.**
  Three categories sharing conceptual overlap (all involve detained people).
  Disambiguation rule says: focus on conditions → detention_conditions;
  named opposition figure with charges → opposition_prosecution; broad
  detention pattern → mass_detention. Verify the rule produces clean
  separation in practice.

- **`systematic_crackdown` overlap.** v2 added many specific categories
  (`ngo_restriction`, `religious_freedom_change`, `academic_freedom_change`,
  etc.) that were previously absorbed into `systematic_crackdown`. After
  one quarter, audit which `systematic_crackdown` events should have
  been the more specific category.

- **`anticorruption_conviction` (rule_of_law) vs `corruption_conviction`
  (corruption_control).** Two categories with similar names on different
  dimensions. Verify the disambiguation is clean in practice.

---

## Other deferred items (non-taxonomy)

### Specialist feed integration — Phase 5.9 (deferred)

Per the locked decision (2026-04-28), licensing audit + advisory board
recruitment + SSRN preprint are deferred until the product is feature-
complete. Specialist feeds requiring licensing (ACLED, CIVICUS in
its commercial mode, RSF for full content) remain in graceful no-op
state until the licensing audit happens.

Currently working specialist feeds:
- HRW (RSS, attribution)
- Amnesty International (RSS, attribution)
- CIVICUS Monitor (RSS, CC-BY-SA)
- IPU Parline (existing client, non-commercial)
- GDELT (open data, news fallback)

Currently dormant (env-gated, no public RSS):
- ACLED (academic non-commercial; needs ACLED_API_KEY + email)
- RSF (no public RSS feed at standard paths as of 2026-04)
- V-Dem pulse (no real-time feed)
- Reuters / AP wire (RSS endpoints rotated; gated on env override)

When Phase 5.9 unblocks: register academic ACLED access, contact RSF
for API access, and verify Reuters / AP RSS endpoints.

### Pulse merged-scalar score

Per spec § 6.5, deferred to post-Beta-graduation. The Pulse
intentionally publishes dimensional deltas only during Beta. A single
merged number may be reintroduced post-Beta if user research confirms
demand and the dimensional model has had time to stabilise.

### Embeddable Pulse widgets

Per spec § 6.5, also deferred to post-graduation. The CI widgets exist
and ship with embed buttons; Pulse-equivalent embeds wait for
graduation.

### Multi-language methodology translations

Post-launch internationalisation. Methodology pages currently English-only.

### Additional backtest cases

10 spec cases plus future expansions. Candidates suggested by the gap
analysis (would test v2 categories more thoroughly):
- Spain 1976 — pacted democratic transition
  (`negotiated_transition` + `negotiated_transition_stability` + `peaceful_transfer`)
- South Africa 1990-94 — same pattern at higher scale
- Philippines 1986 EDSA — peaceful_transfer + foreign-pressure dynamics
- Chile 1988 plebiscite + 1990 transition
- Pakistan 1999 Musharraf coup vs 2008 transition
- Russia 1993 constitutional crisis (`constitutional_crisis` + later
  `term_extension` cascade)
- Turkey 2016 attempted coup → judicial purge cascade
- Israel 2023 judicial-overhaul standoff (`executive_court_defiance`,
  `constitutional_crisis` without coup)
- Pakistan 2023 Imran Khan prosecution (`opposition_prosecution`,
  `candidate_disqualification`)
- Hungary 2024 Sovereignty Protection Office (`oversight_body_dismantling`,
  `ngo_restriction`)

Each adds coverage for a specific v2 category. Backtest expansion is
not blocking but useful for ongoing methodology validation.

---

## How to use this document

When starting a session that touches taxonomy or pipeline design:

1. Read this file first to remember what was deliberately deferred.
2. If a current question matches a deferred item, refer back to
   `docs/taxonomy-v2-gap-analysis.md` for the original derivation.
3. After v2.0 has run for at least one quarter, schedule a v2.1
   review session that audits each item here against real v2.0
   classification data.
4. Promote items from this document to a v2.1 proposal only when
   empirical evidence shows the deferred item produces signal not
   already captured by v2.0 categories.

This document is the safety net against re-deriving the same
deferral logic from scratch in future sessions.
