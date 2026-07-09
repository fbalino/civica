# Decision — Public claim tiers v1

- **Status:** Adopted
- **Date:** 2026-07-09
- **Decision ID:** APR-D015
- **Implementation:** `src/lib/claims/claim-tiers.ts`
- **Registry:** `src/lib/claims/public-claims.ts`
- **Validator:** `npm run validate:public-claims`

## Decision

Every headline empirical or institutional claim published by Civica belongs to
exactly one canonical tier. The tier describes what kind of evidence supports
the claim and therefore what language and disclosure it may use. Registration
is an inventory of current copy, not an endorsement: the registry deliberately
includes overclaims that later CLM tasks must qualify or remove.

The six empirical/output tiers required by the master plan are joined by one
`institutional-posture` tier. That seventh tier is necessary because the claims
registry also covers product scope, release status, licensing, advisory-board
commitments, and academic-standing claims; misclassifying those statements as
empirical measurements would hide their real evidence requirements.

## Canonical vocabulary

| Tier | What it means | Allowed language | Required disclosure | Language that is not allowed |
|---|---|---|---|---|
| `institutional-posture` | A verifiable statement about Civica's scope, status, policy, process, rights, or commitment. | “Civica publishes…”, “The project is in beta…”, “The project plans to…” | Current status and effective date; shipped versus planned; governing implementation, policy, or status evidence. | No implied review, authority, openness, completeness, or finished institution before the relevant gate; no aspiration presented as current fact. |
| `source-reported-fact` | A value or statement reproduced from one named upstream source without Civica choosing among observations. | “Source X reports…”, “According to Source X…” | Publisher; observation period or vintage; release/retrieval date; rights; source caveats; measurement/forecast status. | No claim that the value is Civica's finding or definitive beyond the source's own standing. |
| `reconciled-fact` | A canonical value selected from multiple observations by a versioned Civica rule. | “Civica's reconciled value…”, “Selected under reconciliation version…” | Selected and alternate sources; vintages; rights; reconciliation version; disputes/overrides; missingness; correction route. | No “objective truth,” blanket “authoritative,” or universal provenance/completeness claim without measured coverage. |
| `derived-descriptive-metric` | Transparent arithmetic—count, rate, distribution, transformation, or comparison—without a latent normative estimate. | “Calculated from…”, “Coverage is…”, “The observed difference…” | Inputs; formula; unit; vintage; exclusions; missing-data rule; transformation version; dated or generated changing counts. | No causal or overall-governance inference from the transformation; no undated hardcoded live count. |
| `research-beta-estimate` | A versioned estimate of a defined construct still under validation and external review. | “Research-beta estimate…”, “Experimental estimate under version…” | Beta label; construct; inputs; version; vintage; uncertainty posture; missingness; limitations; validation state; correction route and graduation gate. | No “validated,” “authoritative,” or “definitive” claim before G3/G5; no judgmental letter grades; no unsupported confidence-interval language. |
| `experimental-heuristic` | A model-assisted signal, classifier output, prototype, or rule-of-thumb that is not yet a validated measurement. | “Experimental classifier output…”, “Candidate signal…”, “Event-ledger classification awaiting review…” | Experimental label; ontology/pipeline version; source coverage; real cadence; review state; known failure modes; non-authoritative warning; event record separated from inferred impact. | No inference that no detected event means stability; no “daily,” “live,” “calibrated,” or “human-reviewed” claim without runtime evidence; no model-agreement-as-validation claim. |
| `retired-deprecated-output` | A historical field, score, grade, taxonomy, endpoint, or method kept only for audit or migration. | “Deprecated as of…”, “Historical output; do not use for current analysis…” | Retirement date; last valid version; reason; replacement or no-replacement decision; sunset behavior; historical/current separation. | No current or recommended presentation; no comparison across incompatible versions; no silent revival. |

The TypeScript tier definitions are the machine-readable enforcement source.
If this decision and the code disagree, the task changing either is incomplete.

## Classification rules

1. Classify the smallest claim that can stand or fail independently. A sentence
   combining product status, an estimate, and provenance should become several
   registry entries even if it remains one sentence in public copy.
2. Choose the highest-intervention tier. A source value that Civica selects
   from alternatives is `reconciled-fact`, not `source-reported-fact`; a
   composite built from transparent inputs is `research-beta-estimate`, not a
   merely descriptive metric, when it estimates a latent construct.
3. A claim has one scalar `tier`. It may cite multiple evidence sources, but it
   may not use multiple tiers to blur the disclosure standard.
4. “Beta” is not a universal escape hatch. The tier still requires exact
   construct, version, vintage, limitations, and gate language.
5. Retired outputs stay registered until every public consumer is removed or
   explicitly historical. Deletion from current UI does not erase the audit
   trail.

## Claim marker and validation contract

The comment `PUBLIC_CLAIM: <stable-id>` sits beside each registered headline
claim. Markdown and CFF use non-rendering comments; TypeScript and TSX use
ordinary source comments. Each registry row records:

- public route or artifact;
- exact sentence or dynamic template;
- one claim tier;
- evidence sources;
- implementation owner;
- methodology/version handle;
- earliest master-plan gate for stronger standing;
- source file and exact source fragment.

`npm run validate:public-claims` fails when a required surface is uncovered, a
claim lacks one of those fields, a tier is unknown or incomplete, evidence or
source paths disappear, exact copy drifts, generated README markers diverge,
or a marked headline claim is not registered. The first registry covers home,
country pages, Index, Pulse, methodology, about, licensing, advisory board,
API docs, README, `CITATION.cff`, default metadata, exports, and embeds.

CLM-017 will later combine this registry check with numeric-claim discovery,
prohibited-language lint, route/anchor checks, API examples, methodology
fixtures, and CI. That later automation does not weaken this v1 contract.

## Consequences

- Copy changes that alter a registered claim must update the registry and its
  evidence in the same task.
- Methodology or implementation changes that alter a claim must update every
  registered public surface in the same task.
- A passing registry check proves inventory consistency, not academic validity.
  G3 and G5 still govern measurement decisions and independent review.
- Claims that fail their evidence gate are qualified, demoted, or removed;
  registry presence never grants permission to retain an overclaim.
