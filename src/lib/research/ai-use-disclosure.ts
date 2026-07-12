import { createHash } from "node:crypto";

export const AI_USE_DISCLOSURE_VERSION = "civica-ai-use-disclosure/v1" as const;

export const AI_USE_DISCLOSURE = Object.freeze({
  schemaVersion: AI_USE_DISCLOSURE_VERSION,
  effectiveOn: "2026-07-11",
  responsibleHuman: "Fernando Balino",
  standing:
    "Models and agents assist production and research preparation. They are not authors, independent peer reviewers, or a substitute for qualified human validation.",
  uses: Object.freeze([
    {
      id: "code_and_planning",
      label: "Code, planning, and documentation assistance",
      systems: ["OpenAI Codex", "Anthropic Claude/Claude Code", "Fable 5 design-decision agent"],
      role: "Draft code and prose, inspect repositories, run tests, prepare plans, research candidates, and suggest implementation or design decisions.",
      controls: "Changes remain in version control and must pass the applicable automated, build, data, claims, and browser gates. Fernando accepts or rejects the final work.",
      limitation: "Historical sessions do not all retain an exact model/version transcript. The project does not infer missing session metadata.",
    },
    {
      id: "agent_audits",
      label: "Agent audits and critique",
      systems: ["Blind Audit multi-agent workflow", "Codex and Claude bounded audit workers", "Fable 5 for consequential design choices"],
      role: "Find defects, challenge assumptions, compare alternatives, and test instructions before external review.",
      controls: "Findings become versioned tasks, decisions, tests, or explicit rejections. Agreement among agents has no special evidentiary status.",
      limitation: "Agent critique is internal quality assurance. It is never described as peer review, independent review, or academic validation.",
    },
    {
      id: "pulse_production",
      label: "Pulse production classification",
      systems: ["DeepSeek V4 Flash", "Zhipu GLM 4.7", "Anthropic Claude Haiku 4.5", "Anthropic Claude Sonnet 4.6"],
      role: "Three cross-vendor voters propose event categories; Haiku supplies a separate adversarial verification signal; Sonnet attributes primary and affected jurisdictions. Haiku may also draft a non-decisive review summary.",
      controls: "Schema validation, quorum rules, separate decision axes, evidence references, unresolved failure states, versioned runtime metadata, and public experimental labels constrain output.",
      limitation: "Model agreement does not establish truth. Pulse has not completed method-matched prospective evaluation or independent human validation and remains experimental.",
    },
    {
      id: "annotation_proposals",
      label: "Annotation and coding dry runs",
      systems: ["GPT-5.3 Codex Spark dry-run agents"],
      role: "Exercise blinded Pulse coding instructions and workspace mechanics to reveal ambiguous rules and schema defects.",
      controls: "Synthetic submissions are labelled as agent pilots, kept separate from qualified human studies, and permanently ineligible for gold labels.",
      limitation: "Agent labels cannot measure human reliability, construct validity, or real-world accuracy.",
    },
    {
      id: "structured_extraction_and_summaries",
      label: "Structured extraction and summaries",
      systems: ["Anthropic Claude Haiku 4.5 (including pinned 20251001 where recorded)"],
      role: "Produce bounded bill summaries, Pulse review-summary aids, and selected structured extraction such as the Stats SA adapter.",
      controls: "Each production path has its own schema, source, failure, and persistence rules. Summary text does not alter Pulse classification or numeric output.",
      limitation: "Generated summaries and extracted fields may contain errors and retain the standing of their validated pipeline, not the authority of the model.",
    },
    {
      id: "reader_chat",
      label: "Reader chat",
      systems: ["Anthropic Claude Sonnet 4.6"],
      role: "Answer reader questions through the Ask Civica interface using supplied site context.",
      controls: "The chat route has bounded input/context and is separate from canonical Atlas facts, research decisions, and publication workflows.",
      limitation: "Chat answers are generated assistance. They are not a citation, correction decision, source record, or research result.",
    },
    {
      id: "editorial_prose",
      label: "Editorial and methodological prose",
      systems: ["OpenAI Codex", "Anthropic Claude/Claude Code"],
      role: "Draft, rewrite, and audit portions of blog, product, methodology, policy, and operational prose.",
      controls: "Fernando is the named responsible author and approves publication; claims, terminology, numeric templates, source links, and version contracts receive their applicable checks.",
      limitation: "The historical corpus does not have complete sentence-level model attribution. Authorship records responsibility and does not claim every sentence was drafted without tools.",
    },
    {
      id: "editorial_illustrations",
      label: "Editorial illustrations",
      systems: ["Codex-driven AI image-generation tooling; exact model/version recorded only where an asset manifest exists"],
      role: "Create country, territory, and editorial engravings used as non-documentary illustration.",
      controls: "Reader captions link to the imagery policy; technical checks cover defined asset properties; new or replaced assets retain generation records; errors have a correction route.",
      limitation: "The launch corpus lacks complete prompt, reference-image, and model-version records, and complete independent visual review has not occurred.",
    },
  ]),
  prohibitedClaims: Object.freeze([
    "A model or agent is a Civica author or accountable decision-maker.",
    "An agent audit, model panel, temperature variation, or model agreement is peer review or independent validation.",
    "Generated text, extraction, classification, or imagery is accurate because a named model produced it.",
    "Human approval alone converts model output into independently validated evidence.",
  ]),
  updateRule:
    "Update this record when a material production model, provider, role, publication boundary, or retained-record policy changes. Runtime-specific disclosures remain versioned with their pipelines.",
});

export function aiUseDisclosureHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function aiUseDisclosureErrors(record: typeof AI_USE_DISCLOSURE = AI_USE_DISCLOSURE): string[] {
  const errors: string[] = [];
  if (record.schemaVersion !== AI_USE_DISCLOSURE_VERSION) errors.push("wrong schema version");
  const required = ["code_and_planning", "agent_audits", "pulse_production", "annotation_proposals", "structured_extraction_and_summaries", "reader_chat", "editorial_prose", "editorial_illustrations"];
  const ids = new Set(record.uses.map(({ id }) => id));
  if (required.some((id) => !ids.has(id)) || ids.size !== required.length) errors.push("AI-use category closure drifted");
  for (const use of record.uses) {
    if (!use.systems.length || !use.role || !use.controls || !use.limitation) errors.push(`${use.id}: incomplete disclosure`);
  }
  if (!record.standing.includes("not authors") || !record.standing.includes("independent peer reviewers")) errors.push("authorship/review boundary missing");
  return errors;
}
