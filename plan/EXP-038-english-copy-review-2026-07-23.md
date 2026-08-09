# EXP-038 — English-first editorial copy review

**Status:** approved edits applied on 2026-07-25; four gated decisions remain.

## Editorial standard

The pass used four tests:

1. Lead with what the reader can do or learn.
2. Prefer concrete nouns and verbs over slogans, institutional imitation, or
   internal implementation language.
3. Keep limitations close to the claim they qualify.
4. Preserve every registered claim, release status, rights boundary, and
   absence-state distinction.

The review also removed or flagged common machine-writing patterns: ornamental
antithesis, stacked lists, rhetorical scaffolding, vague superlatives, and
headings that sound like campaign copy rather than a reference work.

No public copy was changed during the review itself. Fernando approved the
English copy bundle on 2026-07-25 except for A4, which remains held while he
considers whether and how his name should appear. H5, T3, and T4 retain their
separate factual or operational gates. The unambiguous approved edits were then
applied to the named source files.

## Source snapshot

| Surface | Source | SHA-256 reviewed |
| --- | --- | --- |
| Home | `src/components/home/HomeGrid.tsx` | `d4debe74fe99fd14c1491e82c9ada632efc84309c1847be9183d736d7fb2008d` |
| About | `content/about.md` | `9896c97ba28d57c32559a4c036460617db074aab0b473e1dfff1664e65234406` |
| Methodology landing | `src/app/(reader)/methodology/page.tsx` | `3da2cdb5fb764b23d7091fcd93479196d93e7df9ffd4c337f15a9a37ce0382f4` |
| Methodology prose | `content/methodology-overview.md` | `7db3484aa48d838e1165bba36d624883d4c5966e9c40c645b90b30882aa8e5fa` |
| Country factbook | `src/app/(reader)/country/[slug]/page.tsx` | `4b5dc25c01b1b711195dd3d738c784bb7c2484eeb9dbb089a21625650ee5b33c` |
| Country data | `src/app/(reader)/country/[slug]/civica-data/page.tsx` | `0b67f13261622aaa2900f55fac42d38d2fefc8a3b77672759b1623e3cbf475df` |
| Country constitution | `src/app/(reader)/country/[slug]/constitution/page.tsx` | `01abfa2c4cb69956ba4b26712e1e6e054372e79685791cc5bbf23507ce987344` |
| Governance Evidence | `src/app/governance-evidence/page.tsx` | `d293e21e769d28f82c8d7966a488a1078a9ead831a95730c62f7c690e99ccdb2` |
| Licensing | `src/app/licensing/page.tsx` | `cc969a81d4b4390c8e9f8965ef096f8d9d57f9bbbd5f1e51457a706901b85fa6` |
| Contact metadata | `src/app/contact/page.tsx` | `e4478a2df5541637cc23c4de891a5ee7a7b4b7cc64e38c5d49e44720a33c8aa8` |
| Contact page | `src/app/contact/ContactClient.tsx` | `14bb689c2e59b562d8da8f7715e1f2bfa26f95725eb4d30d259b0168c00be5fb` |
| Advisory charter | `src/app/about/advisory-board/page.tsx` | `db3860becff81d0f73c77b4850b9569a964f458aa045e1f650ba78a0c00637aa` |
| Advisory apply metadata | `src/app/about/advisory-board/apply/page.tsx` | `906567110f8a42666b4b612843098c9066d5dcda7a0928c89501cd81dfbfd662` |
| Advisory application | `src/app/about/advisory-board/apply/ApplyClient.tsx` | `8a90a0d96514e84e92df5955f174b94f84ebe3a493931877e630515ce0f335da` |

If a source hash changes before approval, re-review the affected item rather
than applying stale prose.

## Proposed edits

### Home

#### H1 · Country section heading

Current:

> Explore country profiles and key facts at a glance.

Proposed:

> Start with a country. See its institutions, leaders, and source-linked facts.

Reason: tells the reader what is present and removes generic “at a glance”
language.

#### H2 · Country section description

Current:

> Country profiles bring government, leaders, legislature, economy, and
> society together. Resolver-backed detail pages expose source context where
> implemented; these compact cards link onward and do not claim inline
> provenance for each summary value.

Proposed:

> Each profile brings together government structure, current leaders,
> legislature, economy, and society. Open the profile for source details and
> known gaps; the summary cards do not show provenance for every value.

Reason: replaces implementation terms such as “resolver-backed” with the
reader action and keeps the existing provenance limitation.

#### H3 · Atlas heading

Current:

> See the world. Understand its contexts.

Proposed:

> Compare political systems and institutions on one map.

Reason: the current line is ornamental and vague. The draft names the actual
interaction without claiming analysis the map does not provide.

#### H4 · Atlas description

Current:

> A connected atlas of legislatures, chambers, political systems, and the
> institutions that hold power around the world.

Proposed:

> Browse legislatures, chambers, government systems, and other institutions
> across countries.

Reason: shorter, more literal, and easier to scan.

#### H5 · Independence label — hold

Current:

> Independent & nonpartisan

Recommendation: do not approve a replacement until GOV-003 confirms the
project’s funding, sponsorship, affiliations, vendor relationships, and
editorial-control facts. If the disclosure supports it, use the exact approved
language from that record. The copy pass must not manufacture an independence
claim from repository silence.

### About

#### A1 · Product posture

Current:

> The project publishes its methods and aims to expose source disagreement
> rather than hiding it, without claiming that every value is already
> reconciled or independently reviewed.

Proposed:

> The project publishes its methods and records source disagreement where the
> data supports it. Some values remain unreconciled, and the project has not
> completed independent review.

Reason: replaces an intention claim with two checkable limitations.

#### A2 · Pipeline opening

Current:

> The data pipeline has three layers, each addressing a known failure mode in
> single-source reference works.

Proposed:

> Civica separates source ingestion, reconciliation, and reader presentation.
> Each layer has its own provenance and failure checks.

Reason: names the layers immediately and avoids a broad claim about other
reference works.

#### A3 · Source ingestion

Current:

> A dedicated module per upstream publisher pulls fresh data on a documented
> cadence and writes into the canonical `country_facts` table with
> statement-level provenance.

Proposed:

> Each production source has a registered ingestion path and cadence. Supported
> observations retain source and retrieval metadata; statement-level coverage
> remains incomplete.

Reason: the current text overgeneralizes scheduled freshness and universal
statement-level provenance. The draft matches the current coverage posture.

#### A4 · Standing posture

Current:

> We are not these institutions. We do not have their funding, their staff,
> their decades of accumulated trust, or their formal review processes. Civica
> instead keeps versioned methodology records, labels novel work as beta, and
> aims to surface disagreement rather than hiding it.

Proposed:

> Civica is a small project led by Fernando Baliño. It does not have the formal
> review structures of the institutions it cites. Versioned methods, visible
> beta labels, source records, and correction history make the project’s own
> work inspectable while external review remains pending.

Reason: removes repetitive contrast and states the accountability and review
boundary directly. Final adoption should use the owner-confirmed GOV-003
disclosure if it changes this description.

Owner follow-up on 2026-07-25: the sentence remains unchanged while Fernando
considers whether the About narrative should name him this prominently.

The rationale for naming him was accountability, not promotion. The checked
authorship and governance records name Fernando as the responsible publisher
with final editorial authority; naming the person prevents “we” or
institution-like wording from obscuring who makes final decisions. The word
“led,” however, is imprecise and can sound organizational or self-promotional.
Two safer alternatives for a later owner decision are:

> Civica is independently maintained by Fernando Baliño, who has final
> editorial responsibility.

or, if the name should live only in the formal disclosure:

> Civica is an independently maintained project without a formal external
> review structure.

Neither alternative is approved or applied yet.

### Methodology landing

#### M1 · Start-here introduction

Current:

> If you're new to how Civica handles country data and want a plain-English
> walkthrough before the deep specifications, start here. Every methodology
> page below assumes the reader has read this one or its equivalent.

Proposed:

> New to Civica’s data methods? Start with the plain-English overview. The
> technical pages below explain the individual contracts in more detail.

Reason: removes the unsupported assumption that every reader has completed a
prerequisite.

#### M2 · Reconciliation card

Current:

> The full specification of how the resolver works. Source taxonomy, the
> canonical-fact layer, freshness rules, editorial assertions, the dispute
> system, forecast vs measurement, multi-canonical with scope predicate.

Proposed:

> How Civica selects among source observations, records disputes, separates
> forecasts from measurements, and preserves scoped alternatives.

Reason: turns an internal noun list into a readable description while
preserving the concepts.

#### M3 · Peer-grouping card

Current:

> The peer-lens architecture, why government type is not a peer-grouping
> primitive, how the n ≥ 8 minimum-n rule works, the documented fallback chain.

Proposed:

> How the research defines comparison groups, why government type is excluded
> from grouping, and what happens when a group has fewer than eight cases.

Reason: explains the rule in ordinary language. The number remains tied to the
published method.

#### M4 · “Not yet published” ending

Current:

> Public publication of a curated subset is a v1.x deliverable — the goal is
> for any external reviewer to be able to read both *what* Civica decided and
> *how*.

Proposed:

> A later release may publish a reviewed subset. Until then, the public
> methodology pages identify the decisions they can support and leave the
> remaining working records unpublished.

Reason: removes roadmap jargon and does not promise a release that has not been
scheduled.

### Country-page module intros and states

#### C1 · Factbook outage

Current pattern:

> Factbook sections are temporarily unavailable. Civica is keeping this tab
> visible rather than presenting an outage as though [country] has no reference
> information.

Proposed:

> Factbook sections are temporarily unavailable. This is a loading error, not
> a zero-data state for [country].

Reason: keeps the crucial absence-state distinction in half the words.

#### C2 · Government structure intro

Current:

> How power is organised — the offices, bodies, and current officeholders.

Recommendation: retain. It is concise, concrete, and correctly scoped.

#### C3 · Constitution empty state

Current:

> Civica indexes the world’s constitutions from the Constitute Project, the
> standard scholarly repository. We haven’t indexed [country]’s constitution
> here yet — but you can still explore its government, institutions and
> governance evidence.

Proposed:

> Civica indexes constitution texts supplied by the Constitute Project.
> [Country] is not yet in this index. Its government, institutions, and
> governance evidence remain available elsewhere in the country profile.

Reason: removes the unsupported superlative “the standard scholarly
repository” and separates corpus absence from other country coverage.

### Governance Evidence

#### G1 · Landing title and description

Recommendation: retain “What the established sources report” and the current
source list. The copy names the publishers, native-scale treatment, uncertainty,
rights, and nonaggregation boundary without hype.

#### G2 · Interpretation heading

Current:

> Five observations, no verdict.

Recommendation: retain. This is a factual contrast, not decorative antithesis:
the page displays five publisher observations and deliberately withholds a
Civica country judgment.

#### G3 · Release note

Current:

> Original publication cut: none retained; this is not an as-published
> historical release.

Proposed:

> Original publication cut: not retained. This release was assembled later
> from harmonized publisher series and is not an as-published 2024 snapshot.

Reason: the draft explains the consequence in plain language. Keep the dynamic
publisher citation and release ID unchanged.

### Licensing

#### L1 · Reuse heading

Current:

> Treat provenance as part of the data, not decoration.

Recommendation: retain. The contrast carries a precise instruction: source,
license, and freshness metadata must travel with reused values.

#### L2 · Point-of-use guidance

Current:

> For exact reuse obligations, follow the upstream publisher license shown with
> the specific data point where available, or check its named source in the
> registry below when point-of-use coverage is absent.

Proposed:

> Check the publisher terms attached to the value. If no terms appear there,
> find the source in the registry below. A citation or public page does not by
> itself grant reuse permission.

Reason: shorter instructions with the existing rights boundary stated
explicitly. Counsel review under BRD-010/012 may still require changes.

### Contact

#### T1 · Page title

Current:

> Dispatch desk

Proposed:

> Contact the editors

Reason: “Dispatch desk” is atmospheric but unclear and does not match the page
metadata.

#### T2 · Page introduction

Current:

> Story tips, data corrections, partnerships, press. Pick a category and send
> a note — a human on the editorial team will read it.

Proposed:

> Send a data correction, research question, press inquiry, or collaboration
> proposal. Fernando Baliño reviews submissions manually.

Reason: matches the named human accountability record and uses categories that
fit a comparative reference project.

#### T3 · Response-time promise — owner decision

Current:

> We usually reply within 3 business days.

Proposed default:

> Messages are reviewed manually. A reply is not guaranteed.

Alternative, only if Fernando confirms the service target:

> Fernando aims to reply within three business days, but research and
> correction requests may take longer.

Reason: the current SLA appears in both the success panel and an information
tile. Keep it only if the owner can support and monitor it.

#### T4 · Data-correction route

Current:

> For urgent data corrections, open an issue on GitHub.

Proposed after ATL-024 production activation:

> For a specific Atlas value, use Report a Data Issue and keep the receipt
> shown after submission.

Until ATL-024 is active:

> For a specific Atlas value, include the country, field, displayed source, and
> page URL in your message.

Reason: avoids sending readers to a generic code issue tracker and respects the
current schema-pending correction flow.

### Advisory board and application

#### V1 · Charter subtitle and warning

Recommendation: retain. “Independent advice with a narrow remit, disclosed
conflicts, and no implied endorsement” accurately summarizes the charter, and
the warning immediately states that no board or endorsement currently exists.

#### V2 · Application introduction

Current:

> Civica Atlas accepts private expressions of interest across the five charter
> areas: governance measurement, political event data, research-data curation,
> data-heavy accessibility, and source rights. Fernando Baliño reads each
> application. Applying is not an appointment, a review, or an endorsement.

Proposed:

> Civica Atlas accepts private expressions of interest in the five areas named
> by the charter: governance measurement, political event data, research-data
> curation, data-heavy accessibility, and source rights. Fernando Baliño reads
> each application. Submission does not confer membership, a review role, or
> endorsement.

Reason: keeps all five real fields while making the status boundary more
formal and consistent with the success receipt.

## Approval record

Owner: Fernando Baliño

Decision: English copy approved as a bundle on 2026-07-25, except for the
explicit holds below.

Items approved and applied: H1–H4, A1–A3, M1–M4, C1, C3, G3, L2, T1–T2,
and V2.

Items approved as retained without source changes: C2, G1–G2, L1, and V1.

Items held: H5 pending the completed GOV-003
disclosure; T3 pending a choice between the no-guarantee text and a genuinely
monitored target; T4 pending an explicit choice of the interim instruction or
ATL-024 production activation.

A4 update on 2026-08-09: Fernando approved naming him in the About narrative
("about page can mention me, yes"). The applied wording is the deck's safer
naming alternative — "Civica is independently maintained by Fernando Baliño,
who has final editorial responsibility." followed by the review-boundary and
inspectability sentences — replacing the "We are not these institutions"
paragraph in `content/about.md`.

Decision date: 2026-07-25 (bundle); 2026-08-09 (A4)

Approved source baseline: `cd9ed1e64d499100fb5951fd18091a49584710d5`.
The L2 sentence was separately re-read against the working tree because the
Licensing page also contained unrelated owner changes; the approved edit
changed only that sentence.

EXP-038 remains open because A4, H5, T3, and T4 are not approved for
application. Completion also requires refreshed source hashes, passing
claims/docs gates, and rendered desktop/mobile checks of every applied surface.
