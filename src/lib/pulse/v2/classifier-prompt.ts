/**
 * Shared classifier prompts — classify, then verify.
 *
 * Single source of truth for the prompts sent to configured providers during
 * production classification (`classify.ts`) and the selected backtest engine
 * (`backtest.ts`). Keeping them aligned prevents prompt drift —
 * a class of subtle bugs where the backtest harness uses a slightly
 * different prompt than production and validates the wrong thing.
 *
 * The confidence model is the one published in
 * `content/methodology-pulse.md` (§ "Classification confidence —
 * classify, then verify"): two separate reasoning calls,
 * NOT repeated sampling of one prompt at different temperatures.
 *   1. CLASSIFIER_SYSTEM_PROMPT — assign category, severity, and the
 *      runner-up category considered.
 *   2. VERIFY_SYSTEM_PROMPT — a separate pass that actively
 *      tries to REFUTE the first, yielding a high/medium/low confidence.
 *
 * Disambiguation rules live here so they apply to both paths
 * identically. See `taxonomy.ts` (CLASSIFIER DISAMBIGUATION RULES
 * comment block) for the policy rationale and case-by-case examples.
 */

import { EVENT_CATEGORIES } from "./taxonomy";
import type { ClassifierAgreement, SeverityTier } from "./types";

export const CLASSIFIER_SYSTEM_PROMPT = (() => {
  const taxonomyLines = EVENT_CATEGORIES.map(
    (c) =>
      `  ${c.id}: "${c.label}" → dimension=${c.dimension}, direction=${c.direction}, allowed_tiers=[${c.allowedTiers.join(", ")}]`
  ).join("\n");

  return `You are a governance-event classifier for Civica's Pulse Beta. You receive a single news/specialist-feed event description and must classify it according to the v2 taxonomy.

Pick exactly ONE category from this list:

${taxonomyLines}

Severity tier numeric ranges:
  low_pos: +1 to +2
  moderate_pos: +3 to +4
  high_pos: +5 to +6
  low_neg: -1 to -2
  moderate_neg: -3 to -4
  severe_neg: -5 to -7
  catastrophic_neg: -8 to -10

DISAMBIGUATION RULES — when an event could fit multiple categories,
pick the MORE DIMENSION-SPECIFIC one. The direct governance-outcome
category beats the generic procedural category every time.

  1. emergency_declaration LOSES to:
     - term_extension (when the emergency is being used to extend
       a leader's mandate beyond constitutional limits)
     - mass_disenfranchisement (when the emergency annuls or
       prevents an electoral process)
     - election_cancellation (when the emergency cancels or
       postpones a scheduled election)
     - constitutional_override_electoral (when the emergency overrides
       an electoral mandate)
     - judicial_purge (when the emergency justifies firing judges
       en masse)
     - martial_law (when military tribunals or military jurisdiction
       are explicitly invoked over civilians)

     Example — Tunisia 2021 Aug 24: President Saied "extended the
     parliamentary suspension indefinitely under emergency powers."
     This wraps a term_extension in emergency-declaration framing.
     Pick term_extension. The democratic-quality consequence is the
     defining feature; the emergency framing is procedural packaging.

  2. systematic_crackdown LOSES to any category with a named
     institutional target:
     - judicial_independence_rollback (judges + courts)
     - ngo_restriction (NGOs + civil society legal regimes)
     - media_shutdown (media outlets specifically)
     - religious_freedom_change (religious practice or institutions)
     - academic_freedom_change (universities, scholars, curricula)
     - lgbt_rights_change (LGBT-specific laws or enforcement)
     - minority_rights_change (ethnic/linguistic/religious minorities
       de jure)
     - assembly_rights_restriction (de jure assembly law)

     systematic_crackdown is the residual umbrella for cross-cutting
     repression patterns without a single named target.

  3. mass_detention LOSES to:
     - opposition_prosecution (when the detained are named opposition
       political figures with formal charges or proceedings)
     - detention_conditions (when the focus is on conditions —
       solitary, length without trial, torture allegations — rather
       than the act of detaining)
     - judicial_independence_rollback (when the focus is on the
       judiciary's complicity in the detentions)

  4. coup WINS over:
     - government_collapse (when military force is involved or an
       unconstitutional seizure has occurred)
     - constitutional_crisis (when an unconstitutional seizure of
       power has occurred — even if framed as a constitutional move)

     constitutional_crisis is for institutional deadlock or
     standoff WITHOUT a coup or armed takeover (cf. Sri Lanka 2022,
     Peru 2022 Castillo dissolution attempt).

  5. protest_crackdown is for STATE response to a discrete protest
     event. It LOSES to:
     - electoral_violence (when partisan groups clash with each other
       around an election)
     - assembly_rights_restriction (when the focus is a de jure law
       restricting assembly, not a state response to a specific event)

  6. journalist_arrest is for ARRESTS of journalists. It LOSES to:
     - political_assassination (when journalists are killed, not
       arrested)
     - media_shutdown (when entire outlets are closed, not specific
       individuals detained)

SCOPE RULES — what is NOT a Pulse event:

  - Inter-state / foreign-policy acts. An action by one country against
    another (imposing sanctions, embargoes, aid cuts, expelling
    diplomats, recognizing or derecognizing a government) is the
    SENDER's foreign-policy act, not a change to the TARGET's own
    domestic governance — respond category="none". The Pulse scores a
    country's OWN domestic institutions; a sanction's downstream
    consequences inside the target (a resulting crackdown, unrest) are
    scored separately and only if independently reported as domestic
    events.

  - Mere announcements / proposals / pledges. A verbal pledge, a draft
    bill, or a "plan to reform" that has NOT been enacted is
    category="none". BUT a formally ENACTED instrument IS a real event
    and scores on its category at full tier: a law gazetted or passed, a
    court packed, an emergency decree issued, a constitutional amendment
    ratified, a judge dismissed — passage itself is the governance change
    ("autocratic legalism"), so classify it on its category, not as a
    non-event.

If the event does NOT clearly match any of the categories above (e.g.
it's a sports story, weather event, or routine politics), respond
with category="none".

Also name the SINGLE runner-up category you most seriously considered but
rejected (the closest alternative), or "none" if the winner was unambiguous
and no other category came close. A clear winner over the runner-up is a
stronger signal than a close call.

Respond with JSON ONLY, no preamble:
{
  "category": "<id from list or 'none'>",
  "runner_up": "<id from list or 'none'>",
  "severity_tier": "<one of the allowed_tiers for that category>",
  "severity_value": <integer in the tier's range, signed>,
  "self_confidence": <float 0.0-1.0>,
  "rationale": "<one sentence>"
}`;
})();

/**
 * Verify (refute) prompt — the separate adversarial reasoning pass.
 *
 * Per the published methodology, this pass re-reads the source and
 * actively tries to REFUTE the first classification rather than merely
 * re-sampling it. It judges four things and returns a single confidence:
 *   - Is the category right rather than the named runner-up?
 *   - Is the severity tier/value justified by the source?
 *   - Is the subject country the one the event is ABOUT (not the
 *     source's language or outlet)?
 *   - Is it a discrete, enacted governance event at all (not opinion,
 *     an un-enacted announcement, or an inter-state foreign-policy act)?
 *
 * confidence is "high" or "medium" ONLY when the classification survives
 * this scrutiny and the call is unambiguous; otherwise "low". Low-
 * confidence is a verifier objection; in ensemble mode it routes to review
 * only when the non-unanimous majority is also weak or degraded.
 */
export const VERIFY_SYSTEM_PROMPT = `You are the VERIFIER for Civica's Pulse Beta. You receive a governance event, a first-pass classification of it, and the runner-up category the classifier considered. Your job is NOT to re-classify from scratch — it is to separately try to REFUTE the first pass and report how much it survives scrutiny.

Actively challenge the first-pass classification on four axes:
1. CATEGORY — Is the chosen category genuinely the best fit, or is the named runner-up (or some other category) at least as good? Apply the same dimension-specificity precedence the classifier uses (the more dimension-specific category beats a generic procedural one).
2. SEVERITY — Is the severity tier and signed value justified by what the source actually reports, or is it inflated/understated?
3. SUBJECT COUNTRY — Is the event PRIMARILY about the governance of the stated subject country, judged by the SUBJECT of the event and NOT the language of the text or the country of the outlet? An inter-state / foreign-policy act (one country sanctioning, invading, or recognizing another) is the SENDER's act, not a change to the target's own domestic governance.
4. IS IT AN EVENT — Is this a discrete, formally ENACTED governance event, or is it opinion/commentary, a mere announcement/pledge/draft that was never enacted, a market/business story, or routine politics? If it is not a real governance event, that is a decisive refutation.

Then assign confidence:
- "high": the classification survives on all four axes and every call is unambiguous.
- "medium": it survives, but at least one axis is a somewhat close call.
- "low": you found a genuine problem on any axis, OR the category-vs-runner-up call is close, OR you cannot confirm it is a real, correctly-attributed governance event. When in doubt, choose "low".

Respond with JSON ONLY, no preamble:
{
  "verdict": "<one of: confirmed | revised | rejected>",
  "confidence": "<one of: high | medium | low>",
  "category_ok": <true|false>,
  "severity_ok": <true|false>,
  "subject_ok": <true|false>,
  "is_event": <true|false>,
  "rationale": "<one sentence naming the strongest objection you found, or why none survives>"
}`;

export type VerifyConfidence = "high" | "medium" | "low";

/** Parsed classify-pass output. `category === "none"` means "not a Pulse
 *  event"; the rest of the fields are ignored in that case. */
export interface ClassifyResultLite {
  category: string;
  runnerUp: string;
  severityTier: SeverityTier;
  severityValue: number;
  selfConfidence: number;
  rationale: string;
}

/** Parsed verify-pass output. */
export interface VerifyResultLite {
  verdict: "confirmed" | "revised" | "rejected";
  confidence: VerifyConfidence;
  categoryOk: boolean;
  severityOk: boolean;
  subjectOk: boolean;
  isEvent: boolean;
  rationale: string;
}

/** Strip markdown code fences the model sometimes wraps JSON in. */
function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

/**
 * Parse the classify-pass JSON. Returns null when the payload is
 * unparseable or has no category. Callers treat null as a failed run.
 */
export function parseClassify(text: string): ClassifyResultLite | null {
  const cleaned = stripFences(text);
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(cleaned) as unknown;
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    parsed = value as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed.category) return null;
  if (parsed.category === "none") {
    return {
      category: "none",
      runnerUp: "none",
      severityTier: "low_neg",
      severityValue: 0,
      selfConfidence: 0,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    };
  }
  const severityValue = parsed.severity_value;
  const selfConfidence = parsed.self_confidence;
  if (
    typeof severityValue !== "number" ||
    !Number.isFinite(severityValue) ||
    typeof selfConfidence !== "number" ||
    !Number.isFinite(selfConfidence) ||
    selfConfidence < 0 ||
    selfConfidence > 1
  ) {
    return null;
  }
  return {
    category: String(parsed.category),
    runnerUp:
      typeof parsed.runner_up === "string" ? parsed.runner_up : "none",
    severityTier: parsed.severity_tier as SeverityTier,
    severityValue,
    selfConfidence,
    rationale: String(parsed.rationale ?? ""),
  };
}

/**
 * Parse the verify-pass JSON. Returns null when unparseable or when the
 * verdict/boolean axes are missing or malformed. A malformed or missing
 * confidence is treated conservatively as "low" rather than silently
 * auto-publishing through a weak-consensus gate.
 */
export function parseVerify(text: string): VerifyResultLite | null {
  const cleaned = stripFences(text);
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(cleaned) as unknown;
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    parsed = value as Record<string, unknown>;
  } catch {
    return null;
  }
  const conf = parsed.confidence;
  const confidence: VerifyConfidence =
    conf === "high" || conf === "medium" || conf === "low" ? conf : "low";
  const verdict =
    parsed.verdict === "confirmed" ||
    parsed.verdict === "revised" ||
    parsed.verdict === "rejected"
      ? parsed.verdict
      : null;
  const categoryOk = parsed.category_ok;
  const severityOk = parsed.severity_ok;
  const subjectOk = parsed.subject_ok;
  const isEvent = parsed.is_event;
  if (
    verdict == null ||
    typeof categoryOk !== "boolean" ||
    typeof severityOk !== "boolean" ||
    typeof subjectOk !== "boolean" ||
    typeof isEvent !== "boolean"
  ) {
    return null;
  }
  return {
    verdict,
    confidence,
    categoryOk,
    severityOk,
    subjectOk,
    isEvent,
    rationale: String(parsed.rationale ?? ""),
  };
}

/**
 * Map the published classify→verify confidence onto the persisted
 * `classifier_agreement` column so downstream readers (corroborate.ts,
 * the review UI, the changelog) keep working unchanged. The confidence
 * boost/penalty those readers apply lines up with the three levels:
 *   high   → "all"          (confidence boost +0.2)
 *   medium → "two_of_three" (neutral)
 *   low    → "none"         (penalty −0.3, routes to human review)
 */
export function agreementFromConfidence(
  confidence: VerifyConfidence
): ClassifierAgreement {
  return confidence === "high"
    ? "all"
    : confidence === "medium"
      ? "two_of_three"
      : "none";
}
