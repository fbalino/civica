# Electoral Systems Explainer — Implementation v1

Reader page at `/elections/systems` explaining how the world's electoral systems
translate votes into representation, driven by **real** per-chamber
classifications from **IPU Parline** (CC-BY-NC-SA-4.0), which Civica already syncs.

## Source of truth: IPU Parline chamber fields

The IPU `/chambers` endpoint carries a two-level electoral-system taxonomy per
chamber (fields are versioned; we take the latest value):

- `electoral_system.value.term` — **family**. Exactly four values:
  `plurality_majority`, `proportional_representation`, `mixed_system`,
  `other_systems`.
- `electoral_subsystem.value.term` — **sub-type**. Values observed:
  `first_past_the_post_fptp`, `list_proportional_representation_list_pr`,
  `two_round_system_trs`, `parallel_systems`,
  `mixed_member_proportional_system_mmp`, `single_non_transferable_vote_sntv`,
  `block_vote_bv`, `single_transferable_vote_stv`, `alternative_vote_av`,
  `other`, and a rare combo `first_past_the_post_fptp__block_vote_bv`.
- `electoral_systems` (plural) — array combining the two; we do not store it
  (redundant with the two scalar fields).

Coverage (as of 2026-07 sync): 280 chambers total; 187 countries have a
classified family on their lower/unicameral chamber. Upper chambers are often
`None` (many are appointed/indirect), so we capture them opportunistically but
the page counts by lower/unicameral chamber (the directly-elected house that
defines a country's system).

## Storage

Two new nullable columns on `government_bodies` (per-chamber, matching IPU's
per-chamber classification):

- `electoral_system_family text` — the IPU family term, verbatim.
- `electoral_subsystem text` — the IPU sub-type term, verbatim.

Written by `scripts/sync-ipu-parline.ts` in the existing chamber upsert loop
(no new fetches — the fields ride on the `/chambers` payload already fetched).
`sources.last_sync_at` continues to be stamped only via `markSourcesSynced()`.

We store IPU's own snake_case terms verbatim (no invented labels in the DB).
Human-readable display labels live in the page layer
(`src/lib/elections/electoral-systems.ts`), keyed 1:1 off the IPU terms.

## Page taxonomy — 1:1 map from IPU's own categories

The page presents six sections. Each maps deterministically from an IPU
sub-type (or, for the mixed family, from IPU's family + its two sub-types). No
country is force-fit; sub-types IPU doesn't slot into the five named systems
fall to "Other systems," which lists IPU's own labels. Countries IPU doesn't
cover are simply absent.

| Page section | IPU family | IPU sub-type(s) mapped in |
|---|---|---|
| First Past the Post | plurality_majority | `first_past_the_post_fptp`, `first_past_the_post_fptp__block_vote_bv` |
| Proportional Representation | proportional_representation | `list_proportional_representation_list_pr` |
| Mixed-Member Systems | mixed_system | `mixed_member_proportional_system_mmp`, `parallel_systems` |
| Ranked Choice / Preferential | plurality_majority / proportional_representation | `alternative_vote_av`, `single_transferable_vote_stv` |
| Two-Round System | plurality_majority | `two_round_system_trs` |
| Other systems | other_systems (+ any unmapped) | `single_non_transferable_vote_sntv`, `block_vote_bv`, `other` |

### Mapping decisions (documented, not force-fit)

- **Mixed-Member groups MMP + Parallel (MMM).** Both are IPU's `mixed_system`
  family. They differ in whether list seats are compensatory (MMP) or
  non-compensatory (parallel/MMM). Rather than send Parallel to "Other," the
  section keeps IPU's whole `mixed_system` family together and labels each
  country chip with its sub-type (MMP vs Parallel) so the compensatory
  distinction stays visible. This is the honest family-level 1:1 map.
- **Ranked Choice merges AV + STV.** Both are preferential/ranked-ballot
  systems in ACE / International IDEA terms. IPU files AV under
  plurality_majority and STV under proportional_representation, but on a
  reader page about *how ballots work* they belong together; each chip shows
  its sub-type. Small (~4 countries national), matching the mockup's scale.
- **Other systems** lists IPU's own sub-type labels (SNTV, Block Vote, and
  IPU's literal `other`) — never relabeled into an invented Civica taxonomy.

The seats-vs-votes illustrations are **abstract** (Party A/B/C) and
illustrative only — they are pedagogy, not per-country results.

## Attribution

Classifications are attributed to IPU Parline (CC-BY-NC-SA-4.0) via a
`<SourceDot source="ipu_parline">` beside every country-count and a footnote
crediting IPU plus the standard explainer references (ACE Electoral Knowledge
Network, International IDEA *Electoral System Design* handbook, Duverger).

## Files

- `src/lib/db/schema.ts` — two new columns on `government_bodies`.
- `drizzle/*` migration via `db:generate` + `db:push`.
- `scripts/sync-ipu-parline.ts` — capture + persist the two terms.
- `src/lib/elections/electoral-systems.ts` — IPU-term → display metadata map +
  the DB query that buckets countries.
- `src/app/elections/systems/page.tsx` — server page (hero + data fetch +
  metadata).
- `src/app/elections/systems/ElectoralSystemsClient.tsx` — client tab UI.
- `src/app/editorial.css` — any new reusable classes (electoral-system layout).
- `src/app/elections/page.tsx` / `ElectionsClient.tsx` — link to the explainer.

## Verified coverage (post-sync, 2026-07-02)

219 chambers classified in total; 187 sovereign states have a classification on
their lower/unicameral chamber. Page-bucket counts (each country counted once,
by its lower/unicameral chamber):

| Page section | Countries | IPU sub-types inside |
|---|---:|---|
| First Past the Post | 46 | fptp (45) + fptp∣block-vote combo (1) |
| Proportional Representation | 74 | list_pr |
| Mixed-Member Systems | 36 | mmp (8) + parallel/MMM (23) + list_pr-coded mixed (5) |
| Ranked Choice & Preferential | 4 | AV (2) + STV (2) |
| Two-Round System | 14 | trs |
| Other Systems | 13 | SNTV (8) + block_vote (3) + plurality/null (1) + other_systems∣parallel (1) |
| **Total** | **187** | |

Every classified country is placed; none dropped or force-fit. The five
`list_pr`-coded chambers that carry a `mixed_system` family (Bolivia, Lesotho,
Madagascar, Nepal, Sudan) land in Mixed-Member via family — correct, as IPU
classifies them as mixed. Chips/tooltips surface each country's own IPU
sub-type label.

## Verification

Counts confirmed by direct DB query and by running `getElectoralSystemBuckets()`.
Browser-verified in the Claude Preview: light + dark themes, desktop + 375px
mobile, all six tabs switch and show the right count, chips carry
`/country/[slug]` hrefs (target resolves 200), and each chip tooltip shows the
IPU sub-type + attribution. Gates: `tsc --noEmit`, `validate:sync-freshness`,
and `next build` all pass (clean build).
