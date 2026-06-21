---
name: pulse-daily
description: Run the Civica Pulse daily refresh on the Claude subscription (NOT the paid API). Ingests + clusters news events (free), then YOU (the agent) classify each unclassified cluster by governance category, severity, and SUBJECT country, and apply the results. Use when asked to "run the pulse daily refresh", "update pulse", or when invoked by the daily Pulse routine.
---

# Civica Pulse — daily refresh (subscription-billed)

The goal: keep the Civica Pulse fresh **without spending Anthropic API credits**.
The expensive step is classification. Instead of the API-based pipeline
(`npm run pulse:v2:all`, which bills the API), **YOU classify the events yourself**
— your reasoning is billed to the Claude Max subscription. The ingest, cluster,
corroborate, and score stages are free and run via scripts.

## Critical rule: attribute by SUBJECT, not by source language/outlet
The whole reason this exists: the cheap resolver mis-files events by the
language of the article or the country of the outlet. A Chinese-language story
about US redistricting is a **USA** event. A Romanian story about Hungary's
LGBTQ law is a **HUNGARY** event. Judge by the country whose governance the
event is actually about. Return its ISO 3166-1 alpha-3 code as `subjectIso3`.
For a domestic action by a leader (e.g. "Trump pardons X") → that leader's
country. For genuinely supranational/multi-country items with no single subject,
set `isGovernanceEvent: false` (skip them — don't force a country).

## Steps

1. **Export (free — ingest + cluster, no API):**
   ```
   npx tsx scripts/pulse-export-clusters.ts --out=/tmp/pulse-clusters.json
   ```
   This fetches new news, clusters near-duplicates, and writes every
   unclassified cluster to the JSON file. If it reports 0 clusters, you're
   done — stop.

2. **Read the taxonomy** so you classify with the real categories/tiers:
   - `src/lib/pulse/v2/taxonomy.ts` — `EVENT_CATEGORIES` (the 61 valid
     `category` slugs, each with its `dimension`, `allowedTiers`, and
     `direction`) and `SEVERITY_TIER_RANGES`.
   - `content/methodology-pulse.md` — the scoring philosophy + severity tiers.

3. **Classify each cluster** in `/tmp/pulse-clusters.json`. For each, read its
   `title` + `body` and decide:
   - `isGovernanceEvent` (boolean): is this a governance/politics/rights/rule-of-
     law/corruption/stability event about a specific country? If not (sports,
     business, weather, pure international-body news with no single subject
     country), set `false`. Two scope rules:
       - **Inter-state / foreign-policy acts are out of scope.** One country
         sanctioning, embargoing, cutting aid to, or expelling diplomats from
         another is the *sender's* foreign-policy act, not a change to the
         *target's* own domestic governance → `false`. (A sanction's downstream
         domestic effects inside the target — a crackdown, unrest — are scored
         only if separately reported as domestic events.)
       - **Announcements vs. enactment.** A verbal pledge, draft bill, or
         "plan to reform" that is NOT yet enacted → `false`. But a formally
         *enacted* instrument IS the event and scores at full tier: a law
         passed/gazetted, a court packed, an emergency decree issued, an
         amendment ratified, a judge dismissed — passage itself is the change.
   - `category`: one of the EVENT_CATEGORIES slugs (must match exactly).
   - `severityTier`: one of the category's `allowedTiers`
     (`low_pos|moderate_pos|high_pos|low_neg|moderate_neg|severe_neg|catastrophic_neg`).
   - `severityValue`: a signed number inside that tier's range (positive for
     improvements, negative for deteriorations).
   - `subjectIso3`: the ISO3 of the country the event is about (the rule above),
     or null if `isGovernanceEvent` is false.
   - `confidence`: `high` | `medium` | `low`. **This replaces the old
     same-prompt-different-temperature "agreement" signal** (which was
     meaningless and isn't available on the subscription anyway). Use a
     **classify → verify** method instead: after you classify a cluster,
     re-read the source and try to REFUTE your own call — is the category
     right vs. a close alternative? is the severity justified? is the subject
     country the one the event is *about* (not the source language/outlet)?
     Set `confidence: low` whenever it's a genuine close call or you can't
     fully confirm it. Be strict: most raw news is commentary / partisan
     opinion / business / un-enacted announcements — mark those
     `isGovernanceEvent: false`, not low-confidence events.

   Write the array to `/tmp/pulse-decisions.json`:
   ```json
   [{"clusterId":"...","isGovernanceEvent":true,"category":"judicial_purge","severityTier":"severe_neg","severityValue":-7,"subjectIso3":"USA","confidence":"high"}]
   ```
   Include one object per cluster (use `isGovernanceEvent:false` to drop one).
   **Low-confidence events are written to the human review queue, not
   auto-published** — so reserve `high`/`medium` for events you're sure of.

4. **Apply (free — write + corroborate + score):**
   ```
   npx tsx scripts/pulse-apply-classifications.ts --clusters=/tmp/pulse-clusters.json --decisions=/tmp/pulse-decisions.json
   ```
   This writes the events (severe/positive-high tiers auto-route to the human
   review queue, exactly like the API pipeline), then recomputes corroboration
   and the dimensional deltas the country pages display.

5. Report a one-line summary: clusters classified, events written, skipped.

## Cost discipline
- Do NOT run `npm run pulse:v2:classify` or `npm run pulse:v2:all` — those call
  the paid Anthropic API. Classify the clusters yourself instead.
- The scripts in steps 1 and 4 make no paid Anthropic calls.
